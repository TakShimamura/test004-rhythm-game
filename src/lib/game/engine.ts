import type { Chart, GameConfig, GameState, Lane, ScoreState } from './types.js';
import { DEFAULT_CONFIG, emptyScore } from './types.js';
import { createInputHandler, type InputHandler } from './input.js';
import { createGameAudio, generateMetronomeTrack, playHitSound, type GameAudio } from './audio.js';
import { createRenderer, type JudgmentFlash, type Renderer } from './renderer.js';
import { applyJudgment, judge } from './scoring.js';

export type Engine = {
	start: () => void;
	pause: () => void;
	resume: () => void;
	destroy: () => void;
	getState: () => GameState;
	getScore: () => ScoreState;
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
): Engine {
	let state: GameState = 'waiting';
	let score = emptyScore();
	let rafId = 0;
	const hitNotes = new Set<number>();
	const flashes: JudgmentFlash[] = [];

	const audio: GameAudio = createGameAudio();
	const input: InputHandler = createInputHandler(config);
	const renderer: Renderer = createRenderer({ canvas, chart, config });

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

	function processInput(currentTime: number) {
		const events = input.poll();
		for (const event of events) {
			const audioTime = event.time - (performance.now() / 1000 - audio.currentTime());
			let bestIdx = -1;
			let bestDelta = Infinity;

			for (let i = 0; i < chart.notes.length; i++) {
				if (hitNotes.has(i)) continue;
				const note = chart.notes[i];
				if (note.lane !== event.lane) continue;
				const delta = (audioTime - note.t - offsetSec) * 1000;
				if (Math.abs(delta) < Math.abs(bestDelta)) {
					bestDelta = delta;
					bestIdx = i;
				}
			}

			if (bestIdx >= 0 && Math.abs(bestDelta) <= config.goodWindowMs) {
				const grade = judge(bestDelta, config);
				hitNotes.add(bestIdx);
				setScore(applyJudgment(score, grade));

				flashes.push({
					grade,
					lane: event.lane,
					time: performance.now() / 1000,
				});

				renderer.spawnParticles(event.lane, grade);
				if (grade !== 'miss') {
					playHitSound(audio.ctx, grade);
				}
			}
		}

		// check for missed notes (passed the hit zone by too much)
		for (let i = 0; i < chart.notes.length; i++) {
			if (hitNotes.has(i)) continue;
			const note = chart.notes[i];
			const delta = (currentTime - note.t - offsetSec) * 1000;
			if (delta > config.goodWindowMs) {
				hitNotes.add(i);
				setScore(applyJudgment(score, 'miss'));
				flashes.push({
					grade: 'miss',
					lane: note.lane,
					time: performance.now() / 1000,
				});
			}
		}
	}

	function gameLoop() {
		if (state !== 'playing') return;
		const currentTime = audio.currentTime();

		processInput(currentTime);

		renderer.draw(
			currentTime,
			score,
			(lane: Lane) => input.lanePressed(lane),
			hitNotes,
			flashes,
		);

		// check if song ended
		const lastNote = chart.notes[chart.notes.length - 1];
		if (lastNote && currentTime > lastNote.t + 2) {
			setState('results');
			input.stop();
			return;
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

	return {
		start() {
			if (state !== 'waiting') return;
			setState('playing');
			audio.start();

			const buffer = generateMetronomeTrack(audio.ctx, chart.bpm, chart.notes[chart.notes.length - 1].t + 3);
			trackSource = audio.ctx.createBufferSource();
			trackSource.buffer = buffer;
			trackSource.connect(audio.ctx.destination);
			trackSource.start();

			input.start();
			rafId = requestAnimationFrame(gameLoop);
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
		destroy() {
			cancelAnimationFrame(rafId);
			input.stop();
			trackSource?.stop();
			audio.stop();
			window.removeEventListener('resize', onResize);
		},
		getState() {
			return state;
		},
		getScore() {
			return score;
		},
	};
}
