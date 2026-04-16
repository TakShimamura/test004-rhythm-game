import type { Chart, GameConfig, GameState, GameModeConfig, JudgmentGrade, Lane, ScoreState } from './types.js';
import { DEFAULT_CONFIG, DEFAULT_MODE_CONFIG, emptyScore } from './types.js';
import { createInputHandler, type InputHandler } from './input.js';
import { createGameAudio, generateBackingTrack, playHitSound, playMissSound, playComboMilestone, playFullComboSound, type GameAudio } from './audio.js';
import { createRenderer, type JudgmentFlash, type Renderer } from './renderer.js';
import { applyJudgment, judge, judgeHold } from './scoring.js';
import { applyMirror } from './modes.js';
import { createEndlessManager } from './endless.js';

export type Engine = {
	start: () => void;
	pause: () => void;
	resume: () => void;
	restart: () => void;
	destroy: () => void;
	getState: () => GameState;
	getScore: () => ScoreState;
	getModeConfig: () => GameModeConfig;
	/** For practice mode: ms delta of last hit (null if none yet) */
	getLastDeltaMs: () => number | null;
};

export type EngineCallbacks = {
	onStateChange?: (state: GameState) => void;
	onScoreChange?: (score: ScoreState) => void;
};

export function createEngine(
	canvas: HTMLCanvasElement,
	chart: Chart,
	config: GameConfig = DEFAULT_CONFIG,
	callbacks: EngineCallbacks = {},
	modeConfig: GameModeConfig = DEFAULT_MODE_CONFIG,
): Engine {
	let state: GameState = 'waiting';
	let score = emptyScore();
	let rafId = 0;
	let hitNotes = new Set<number>();
	let flashes: JudgmentFlash[] = [];
	let lastDeltaMs: number | null = null;

	// Apply mirror mode at chart load time
	const playNotes = modeConfig.mirror ? applyMirror(chart.notes) : [...chart.notes];
	const playChart: Chart = { ...chart, notes: playNotes };

	// Endless mode manager (null for non-endless)
	const endlessManager = modeConfig.mode === 'endless'
		? createEndlessManager(chart.bpm)
		: null;
	if (endlessManager) {
		playChart.notes = endlessManager.notes;
	}

	// Apply speed multiplier to scroll speed (visual-only speed mod)
	const effectiveConfig: GameConfig = {
		...config,
		scrollSpeedPx: config.scrollSpeedPx * modeConfig.speedMultiplier,
	};

	// Hold note tracking: noteIndex -> { startTime (audio clock when note was first hit) }
	let activeHolds = new Map<number, { startTime: number }>();

	const audio: GameAudio = createGameAudio();
	const input: InputHandler = createInputHandler(effectiveConfig);
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

	/** Apply judgment with no-fail support: misses count but combo doesn't reset. */
	function applyJudgmentWithMode(s: ScoreState, grade: JudgmentGrade): ScoreState {
		const result = applyJudgment(s, grade);
		if (modeConfig.noFail && grade === 'miss') {
			// Restore combo — misses still counted but combo preserved
			return { ...result, combo: s.combo, maxCombo: Math.max(s.maxCombo, s.combo) };
		}
		return result;
	}

	const COMBO_MILESTONES = [25, 50, 100];
	function checkComboMilestone(prevCombo: number, newCombo: number) {
		for (const milestone of COMBO_MILESTONES) {
			if (prevCombo < milestone && newCombo >= milestone) {
				playComboMilestone(audio.ctx, milestone);
				break;
			}
		}
	}

	function processInput(currentTime: number) {
		const notes = playChart.notes;
		const events = input.poll();
		for (const event of events) {
			const audioTime = event.time - (performance.now() / 1000 - audio.currentTime());
			let bestIdx = -1;
			let bestDelta = Infinity;

			for (let i = 0; i < notes.length; i++) {
				if (hitNotes.has(i) || activeHolds.has(i)) continue;
				const note = notes[i];
				if (note.lane !== event.lane) continue;
				const delta = (audioTime - note.t - offsetSec) * 1000;
				if (Math.abs(delta) < Math.abs(bestDelta)) {
					bestDelta = delta;
					bestIdx = i;
				}
			}

			if (bestIdx >= 0 && Math.abs(bestDelta) <= effectiveConfig.goodWindowMs) {
				const note = notes[bestIdx];

				if (note.duration && note.duration > 0) {
					// Hold note: start tracking, don't score yet
					activeHolds.set(bestIdx, { startTime: currentTime });
					playHitSound(audio.ctx, 'good');
				} else {
					// Regular tap note
					const grade = judge(bestDelta, effectiveConfig);
					hitNotes.add(bestIdx);
					lastDeltaMs = bestDelta;
					const prevCombo = score.combo;
					setScore(applyJudgmentWithMode(score, grade));

					flashes.push({
						grade,
						lane: event.lane,
						time: performance.now() / 1000,
					});

					renderer.spawnParticles(event.lane, grade);
					if (grade !== 'miss') {
						playHitSound(audio.ctx, grade);
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
			const isLaneHeld = input.lanePressed(note.lane);
			const holdComplete = elapsed >= duration;

			if (!isLaneHeld || holdComplete) {
				// Player released or hold duration completed -- judge it
				const heldRatio = Math.min(elapsed / duration, 1);
				const grade = judgeHold(heldRatio);
				activeHolds.delete(noteIdx);
				hitNotes.add(noteIdx);
				const prevCombo = score.combo;
				setScore(applyJudgmentWithMode(score, grade));

				flashes.push({
					grade,
					lane: note.lane,
					time: performance.now() / 1000,
				});

				renderer.spawnParticles(note.lane, grade);
				if (grade !== 'miss') {
					playHitSound(audio.ctx, grade);
					checkComboMilestone(prevCombo, score.combo);
				} else {
					playMissSound(audio.ctx);
					renderer.triggerShake();
				}
			}
		}

		// Check for missed notes (passed the hit zone by too much)
		for (let i = 0; i < notes.length; i++) {
			if (hitNotes.has(i) || activeHolds.has(i)) continue;
			const note = notes[i];
			const delta = (currentTime - note.t - offsetSec) * 1000;
			if (delta > effectiveConfig.goodWindowMs) {
				hitNotes.add(i);
				setScore(applyJudgmentWithMode(score, 'miss'));
				flashes.push({
					grade: 'miss',
					lane: note.lane,
					time: performance.now() / 1000,
				});
				playMissSound(audio.ctx);
				renderer.triggerShake();
			}
		}
	}

	function gameLoop() {
		if (state !== 'playing') return;
		const currentTime = audio.currentTime();

		// Endless mode: generate more notes as player progresses
		if (endlessManager) {
			endlessManager.update(currentTime);
			playChart.notes = endlessManager.notes;
		}

		processInput(currentTime);

		renderer.draw(
			currentTime,
			score,
			(lane: Lane) => input.lanePressed(lane),
			hitNotes,
			flashes,
		);

		// Endless mode never ends on its own — only manual quit
		if (!endlessManager) {
			const lastNote = playChart.notes[playChart.notes.length - 1];
			if (lastNote && currentTime > lastNote.t + 2) {
				// Check for full combo before transitioning
				const totalNotes = playChart.notes.length;
				if (score.misses === 0 && totalNotes > 0 && (score.perfects + score.goods) === totalNotes) {
					renderer.triggerFullCombo();
					playFullComboSound(audio.ctx);
				}
				setState('results');
				input.stop();
				return;
			}
		}

		rafId = requestAnimationFrame(gameLoop);
	}

	renderer.resize();
	const onResize = () => renderer.resize();
	window.addEventListener('resize', onResize);

	// initial idle draw
	renderer.draw(
		-2,
		score,
		() => false,
		hitNotes,
		flashes,
	);

	function startPlayback() {
		audio.start();

		const lastNote = playChart.notes[playChart.notes.length - 1];
		const trackDuration = lastNote ? lastNote.t + 3 : 30;
		const buffer = generateBackingTrack(audio.ctx, playChart.bpm, trackDuration, playChart.style);
		trackSource = audio.ctx.createBufferSource();
		trackSource.buffer = buffer;
		trackSource.connect(audio.ctx.destination);
		trackSource.start();

		input.start();
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
			rafId = requestAnimationFrame(gameLoop);
		},
		restart() {
			// Stop current playback
			cancelAnimationFrame(rafId);
			input.stop();
			try { trackSource?.stop(); } catch { /* already stopped */ }
			audio.stop();

			// Reset state
			score = emptyScore();
			hitNotes = new Set<number>();
			flashes = [];
			activeHolds = new Map();
			lastDeltaMs = null;
			setScore(score);

			// Restart
			setState('playing');
			audio.ctx.resume().then(() => {
				startPlayback();
			});
		},
		destroy() {
			cancelAnimationFrame(rafId);
			input.stop();
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
			return modeConfig;
		},
		getLastDeltaMs() {
			return lastDeltaMs;
		},
	};
}
