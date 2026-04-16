import type { Chart, GameConfig, GameState, GameModeConfig, JudgmentGrade, Lane, ScoreState, ReplayEvent, ReplayData } from './types.js';
import { DEFAULT_CONFIG, DEFAULT_MODE_CONFIG, emptyScore } from './types.js';
import { createInputHandler, type InputHandler } from './input.js';
import { createGameAudio, generateBackingTrack, playHitSound, playMissSound, playComboMilestone, playFullComboSound, createDuckingController, type GameAudio, type DuckingController } from './audio.js';
import { createRenderer, type JudgmentFlash, type Renderer } from './renderer.js';
import { applyJudgment, judge, judgeHold } from './scoring.js';
import { applyMirror } from './modes.js';
import { createEndlessManager } from './endless.js';
import { createGhostOverlay, type GhostState } from './ghost.js';
import { createHealthBar, type HealthBar } from './health.js';
import { calculateDifficultyStars } from './difficulty-calc.js';

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
	/** Get recorded replay data after game ends */
	getReplayData: () => ReplayData;
	/** Current health (0-1). Returns 1 when health bar is disabled. */
	getHealth: () => number;
};

export type EngineCallbacks = {
	onStateChange?: (state: GameState) => void;
	onScoreChange?: (score: ScoreState) => void;
	onHealthChange?: (health: number) => void;
};

export function createEngine(
	canvas: HTMLCanvasElement,
	chart: Chart,
	config: GameConfig = DEFAULT_CONFIG,
	callbacks: EngineCallbacks = {},
	modeConfig: GameModeConfig = DEFAULT_MODE_CONFIG,
	ghostReplay?: ReplayData,
): Engine {
	let state: GameState = 'waiting';
	let score = emptyScore();
	let rafId = 0;
	let hitNotes = new Set<number>();
	let flashes: JudgmentFlash[] = [];
	let lastDeltaMs: number | null = null;
	let replayEvents: ReplayEvent[] = [];

	// Apply mirror mode at chart load time
	const playNotes = modeConfig.mirror ? applyMirror(chart.notes) : [...chart.notes];
	const playChart: Chart = { ...chart, notes: playNotes };

	// Health bar: disabled in no-fail and practice modes
	const healthEnabled = !modeConfig.noFail && !modeConfig.practice;
	const difficultyStars = calculateDifficultyStars(playChart.notes, playChart.bpm);
	let healthBar: HealthBar | null = healthEnabled ? createHealthBar(difficultyStars) : null;

	// Dynamic difficulty: subtle timing window adjustment in normal mode only
	const dynamicDifficultyEnabled = modeConfig.mode === 'normal';
	const ROLLING_WINDOW_SIZE = 10;
	let rollingGrades: JudgmentGrade[] = [];

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

	// Ghost overlay (optional)
	const ghostUpdate = ghostReplay
		? createGhostOverlay(playChart, ghostReplay, effectiveConfig)
		: null;
	let ghostState: GhostState | null = null;

	let trackSource: AudioBufferSourceNode | null = null;
	let ducker: DuckingController | null = null;

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

	/** Apply health bar hit and check for death. */
	function applyHealthHit(grade: JudgmentGrade): void {
		if (!healthBar) return;
		healthBar.applyHit(grade);
		callbacks.onHealthChange?.(healthBar.getHealth());
		if (healthBar.isDead()) {
			setState('failed');
			cancelAnimationFrame(rafId);
			input.stop();
		}
	}

	/** Get dynamic timing windows — subtly adjusts based on rolling accuracy. */
	function getDynamicGoodWindow(): number {
		if (!dynamicDifficultyEnabled || rollingGrades.length < ROLLING_WINDOW_SIZE) {
			return effectiveConfig.goodWindowMs;
		}
		const hits = rollingGrades.filter((g) => g !== 'miss').length;
		const rollingAcc = hits / rollingGrades.length;
		if (rollingAcc < 0.4) {
			return effectiveConfig.goodWindowMs * 1.2;
		}
		if (rollingAcc > 0.95) {
			return effectiveConfig.goodWindowMs * 0.9;
		}
		return effectiveConfig.goodWindowMs;
	}

	function trackRollingGrade(grade: JudgmentGrade): void {
		rollingGrades.push(grade);
		if (rollingGrades.length > ROLLING_WINDOW_SIZE) {
			rollingGrades.shift();
		}
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

	// Track which lanes were pressed last frame for replay up-event detection
	let prevLanesPressed = new Set<Lane>();

	function processInput(currentTime: number) {
		const notes = playChart.notes;
		const events = input.poll();

		// Record replay down events
		for (const event of events) {
			const audioT = event.time - (performance.now() / 1000 - audio.currentTime());
			replayEvents.push({ t: audioT, type: 'down', lane: event.lane });
		}

		// Detect lane releases for replay up events
		for (const lane of prevLanesPressed) {
			if (!input.lanePressed(lane)) {
				replayEvents.push({ t: currentTime, type: 'up', lane });
			}
		}
		prevLanesPressed = new Set<Lane>();
		for (const l of [0, 1, 2] as Lane[]) {
			if (input.lanePressed(l)) prevLanesPressed.add(l);
		}

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

			const dynamicWindow = getDynamicGoodWindow();
			if (bestIdx >= 0 && Math.abs(bestDelta) <= dynamicWindow) {
				const note = notes[bestIdx];

				if (note.duration && note.duration > 0) {
					// Hold note: start tracking, don't score yet
					activeHolds.set(bestIdx, { startTime: currentTime });
					playHitSound(audio.ctx, 'good', note.instrument, note.freq);
				} else {
					// Regular tap note — use dynamic config for judging
					const dynamicConfig = { ...effectiveConfig, goodWindowMs: dynamicWindow };
					const grade = judge(bestDelta, dynamicConfig);
					hitNotes.add(bestIdx);
					lastDeltaMs = bestDelta;
					const prevCombo = score.combo;
					setScore(applyJudgmentWithMode(score, grade));
					trackRollingGrade(grade);
					applyHealthHit(grade);
					if (state === 'failed') return;

					flashes.push({
						grade,
						lane: event.lane,
						time: performance.now() / 1000,
					});

					renderer.spawnParticles(event.lane, grade);
					if (grade !== 'miss') {
						playHitSound(audio.ctx, grade, note.instrument, note.freq);
						checkComboMilestone(prevCombo, score.combo);
					} else {
						playMissSound(audio.ctx);
						ducker?.duckLane(note.lane);
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
				trackRollingGrade(grade);
				applyHealthHit(grade);
				if (state === 'failed') return;

				flashes.push({
					grade,
					lane: note.lane,
					time: performance.now() / 1000,
				});

				renderer.spawnParticles(note.lane, grade);
				if (grade !== 'miss') {
					playHitSound(audio.ctx, grade, note.instrument, note.freq);
					checkComboMilestone(prevCombo, score.combo);
				} else {
					playMissSound(audio.ctx);
					ducker?.duckLane(note.lane);
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
				trackRollingGrade('miss');
				applyHealthHit('miss');
				if (state === 'failed') return;
				flashes.push({
					grade: 'miss',
					lane: note.lane,
					time: performance.now() / 1000,
				});
				playMissSound(audio.ctx);
				ducker?.duckLane(note.lane);
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

		// Update ghost overlay
		if (ghostUpdate) {
			ghostState = ghostUpdate(currentTime);
		}

		renderer.draw(
			currentTime,
			score,
			(lane: Lane) => input.lanePressed(lane),
			hitNotes,
			flashes,
			ghostState ?? undefined,
			healthBar?.getHealth() ?? undefined,
			modeConfig.modifiers,
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

	// AnalyserNode for FFT visualization (passive — does not affect audio clock)
	let analyser: AnalyserNode | null = null;

	function startPlayback() {
		audio.start();

		// Create AnalyserNode for FFT-based visualization
		analyser = audio.ctx.createAnalyser();
		analyser.fftSize = 256;
		analyser.smoothingTimeConstant = 0.7;
		renderer.setAnalyser(analyser);

		const lastNote = playChart.notes[playChart.notes.length - 1];
		const trackDuration = lastNote ? lastNote.t + 3 : 30;
		const buffer = generateBackingTrack(audio.ctx, playChart.bpm, trackDuration, playChart.style);
		trackSource = audio.ctx.createBufferSource();
		trackSource.buffer = buffer;

		// Set up ducking controller for miss feedback
		ducker = createDuckingController(audio.ctx);

		// Route: source -> ducking chain -> analyser -> destination
		trackSource.connect(ducker.input);
		ducker.output.connect(analyser);
		analyser.connect(audio.ctx.destination);
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
			ducker?.destroy();
			ducker = null;
			audio.stop();

			// Reset state
			score = emptyScore();
			hitNotes = new Set<number>();
			flashes = [];
			activeHolds = new Map();
			lastDeltaMs = null;
			replayEvents = [];
			prevLanesPressed = new Set<Lane>();
			rollingGrades = [];
			if (healthEnabled) {
				healthBar = createHealthBar(difficultyStars);
			}
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
			ducker?.destroy();
			ducker = null;
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
		getReplayData(): ReplayData {
			const total = score.perfects + score.goods + score.misses;
			const acc = total === 0 ? 1 : (score.perfects + score.goods * 0.5) / total;
			return {
				chartId: chart.id,
				events: [...replayEvents],
				finalScore: score.score,
				finalAccuracy: acc,
				recordedAt: new Date().toISOString(),
			};
		},
		getHealth() {
			return healthBar?.getHealth() ?? 1;
		},
	};
}
