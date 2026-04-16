import type { Chart, GameConfig, GameState, Lane, ScoreState, ReplayData } from './types.js';
import { DEFAULT_CONFIG, DEFAULT_MODE_CONFIG, emptyScore } from './types.js';
import { createGameAudio, generateBackingTrack, playHitSound, playMissSound, playComboMilestone, playFullComboSound, type GameAudio } from './audio.js';
import { createRenderer, type JudgmentFlash, type Renderer } from './renderer.js';
import { applyJudgment, judge, judgeHold } from './scoring.js';
import type { Engine, EngineCallbacks } from './engine.js';

export type ReplayEngine = Engine & {
	setPlaybackSpeed: (speed: number) => void;
	getPlaybackSpeed: () => number;
};

export function createReplayEngine(
	canvas: HTMLCanvasElement,
	chart: Chart,
	config: GameConfig = DEFAULT_CONFIG,
	replayData: ReplayData,
	callbacks: EngineCallbacks = {},
): ReplayEngine {
	let state: GameState = 'waiting';
	let score = emptyScore();
	let rafId = 0;
	let hitNotes = new Set<number>();
	let flashes: JudgmentFlash[] = [];
	let playbackSpeed = 1.0;

	// Virtual time tracking: we run our own clock so speed control works
	let virtualTime = 0;
	let lastRealTime = 0;

	// Replay event cursor: index of next event to process
	let eventCursor = 0;

	// Virtual lane state (simulated from replay events)
	const lanesPressed = new Set<Lane>();

	// Hold note tracking
	let activeHolds = new Map<number, { startTime: number }>();

	const playChart: Chart = { ...chart, notes: [...chart.notes] };

	const effectiveConfig: GameConfig = { ...config };

	const audio: GameAudio = createGameAudio();
	const renderer: Renderer = createRenderer({ canvas, chart: playChart, config: effectiveConfig });

	let trackSource: AudioBufferSourceNode | null = null;

	function setState(s: GameState) {
		state = s;
		callbacks.onStateChange?.(s);
	}

	function setScore(s: ScoreState) {
		score = s;
		callbacks.onScoreChange?.(s);
	}

	const offsetSec = config.audioOffsetMs / 1000;

	const COMBO_MILESTONES = [25, 50, 100];
	function checkComboMilestone(prevCombo: number, newCombo: number) {
		for (const milestone of COMBO_MILESTONES) {
			if (prevCombo < milestone && newCombo >= milestone) {
				playComboMilestone(audio.ctx, milestone);
				break;
			}
		}
	}

	/** Process replay events up to the current virtual time and run scoring. */
	function processReplayInput(currentTime: number) {
		const notes = playChart.notes;
		const events = replayData.events;

		// Fire all replay events up to currentTime
		const newDownEvents: { lane: Lane; time: number }[] = [];

		while (eventCursor < events.length && events[eventCursor].t <= currentTime) {
			const ev = events[eventCursor];
			if (ev.type === 'down') {
				lanesPressed.add(ev.lane);
				newDownEvents.push({ lane: ev.lane, time: ev.t });
			} else {
				lanesPressed.delete(ev.lane);
			}
			eventCursor++;
		}

		// Score tap/hold note starts (same logic as engine.ts processInput)
		for (const event of newDownEvents) {
			let bestIdx = -1;
			let bestDelta = Infinity;

			for (let i = 0; i < notes.length; i++) {
				if (hitNotes.has(i) || activeHolds.has(i)) continue;
				const note = notes[i];
				if (note.lane !== event.lane) continue;
				const delta = (event.time - note.t - offsetSec) * 1000;
				if (Math.abs(delta) < Math.abs(bestDelta)) {
					bestDelta = delta;
					bestIdx = i;
				}
			}

			if (bestIdx >= 0 && Math.abs(bestDelta) <= effectiveConfig.goodWindowMs) {
				const note = notes[bestIdx];

				if (note.duration && note.duration > 0) {
					activeHolds.set(bestIdx, { startTime: currentTime });
					playHitSound(audio.ctx, 'good', note.instrument, note.freq);
				} else {
					const grade = judge(bestDelta, effectiveConfig);
					hitNotes.add(bestIdx);
					const prevCombo = score.combo;
					setScore(applyJudgment(score, grade));

					flashes.push({ grade, lane: event.lane, time: performance.now() / 1000 });
					renderer.spawnParticles(event.lane, grade);

					if (grade !== 'miss') {
						playHitSound(audio.ctx, grade, note.instrument, note.freq);
						checkComboMilestone(prevCombo, score.combo);
					} else {
						playMissSound(audio.ctx);
						renderer.triggerShake();
					}
				}
			}
		}

		// Process active hold notes
		for (const [noteIdx, hold] of activeHolds) {
			const note = notes[noteIdx];
			const duration = note.duration!;
			const elapsed = currentTime - hold.startTime;
			const isLaneHeld = lanesPressed.has(note.lane);
			const holdComplete = elapsed >= duration;

			if (!isLaneHeld || holdComplete) {
				const heldRatio = Math.min(elapsed / duration, 1);
				const grade = judgeHold(heldRatio);
				activeHolds.delete(noteIdx);
				hitNotes.add(noteIdx);
				const prevCombo = score.combo;
				setScore(applyJudgment(score, grade));

				flashes.push({ grade, lane: note.lane, time: performance.now() / 1000 });
				renderer.spawnParticles(note.lane, grade);

				if (grade !== 'miss') {
					playHitSound(audio.ctx, grade, note.instrument, note.freq);
					checkComboMilestone(prevCombo, score.combo);
				} else {
					playMissSound(audio.ctx);
					renderer.triggerShake();
				}
			}
		}

		// Check for missed notes
		for (let i = 0; i < notes.length; i++) {
			if (hitNotes.has(i) || activeHolds.has(i)) continue;
			const note = notes[i];
			const delta = (currentTime - note.t - offsetSec) * 1000;
			if (delta > effectiveConfig.goodWindowMs) {
				hitNotes.add(i);
				setScore(applyJudgment(score, 'miss'));
				flashes.push({ grade: 'miss', lane: note.lane, time: performance.now() / 1000 });
				playMissSound(audio.ctx);
				renderer.triggerShake();
			}
		}
	}

	function gameLoop() {
		if (state !== 'playing') return;

		const now = performance.now() / 1000;
		const realDelta = now - lastRealTime;
		lastRealTime = now;

		virtualTime += realDelta * playbackSpeed;

		processReplayInput(virtualTime);

		renderer.draw(
			virtualTime,
			score,
			(lane: Lane) => lanesPressed.has(lane),
			hitNotes,
			flashes,
		);

		const lastNote = playChart.notes[playChart.notes.length - 1];
		if (lastNote && virtualTime > lastNote.t + 2) {
			const totalNotes = playChart.notes.length;
			if (score.misses === 0 && totalNotes > 0 && (score.perfects + score.goods) === totalNotes) {
				renderer.triggerFullCombo();
				playFullComboSound(audio.ctx);
			}
			setState('results');
			return;
		}

		rafId = requestAnimationFrame(gameLoop);
	}

	renderer.resize();
	const onResize = () => renderer.resize();
	window.addEventListener('resize', onResize);

	// Initial idle draw
	renderer.draw(-2, score, () => false, hitNotes, flashes);

	let analyser: AnalyserNode | null = null;

	function startPlayback() {
		audio.start();

		analyser = audio.ctx.createAnalyser();
		analyser.fftSize = 256;
		analyser.smoothingTimeConstant = 0.7;
		renderer.setAnalyser(analyser);

		const lastNote = playChart.notes[playChart.notes.length - 1];
		const trackDuration = lastNote ? lastNote.t + 3 : 30;
		const buffer = generateBackingTrack(audio.ctx, playChart.bpm, trackDuration, playChart.style);
		trackSource = audio.ctx.createBufferSource();
		trackSource.buffer = buffer;
		trackSource.connect(analyser);
		analyser.connect(audio.ctx.destination);
		trackSource.start();

		virtualTime = 0;
		lastRealTime = performance.now() / 1000;
		eventCursor = 0;

		rafId = requestAnimationFrame(gameLoop);
	}

	return {
		start() {
			if (state !== 'waiting') return;
			setState('playing');
			startPlayback();
		},
		pause() {
			if (state !== 'playing') return;
			setState('paused');
			cancelAnimationFrame(rafId);
			audio.stop();
		},
		resume() {
			if (state !== 'paused') return;
			setState('playing');
			audio.ctx.resume();
			lastRealTime = performance.now() / 1000;
			rafId = requestAnimationFrame(gameLoop);
		},
		restart() {
			cancelAnimationFrame(rafId);
			try { trackSource?.stop(); } catch { /* already stopped */ }
			audio.stop();

			score = emptyScore();
			hitNotes = new Set<number>();
			flashes = [];
			activeHolds = new Map();
			lanesPressed.clear();
			eventCursor = 0;
			virtualTime = 0;
			setScore(score);

			setState('playing');
			audio.ctx.resume().then(() => {
				startPlayback();
			});
		},
		destroy() {
			cancelAnimationFrame(rafId);
			try { trackSource?.stop(); } catch { /* already stopped */ }
			audio.stop();
			window.removeEventListener('resize', onResize);
		},
		getState() {
			return state;
		},
		getScore() {
			return score;
		},
		getModeConfig() {
			return DEFAULT_MODE_CONFIG;
		},
		getLastDeltaMs() {
			return null;
		},
		getReplayData() {
			return replayData;
		},
		setPlaybackSpeed(speed: number) {
			playbackSpeed = speed;
			// Adjust audio playback rate if the source supports it
			if (trackSource) {
				try { trackSource.playbackRate.value = speed; } catch { /* ignore */ }
			}
		},
		getPlaybackSpeed() {
			return playbackSpeed;
		},
	};
}
