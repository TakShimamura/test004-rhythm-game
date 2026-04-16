import type { Chart, Lane } from './types.js';

export type InputSimulator = {
	simulateKeyDown: (lane: Lane) => void;
	simulateKeyUp: (lane: Lane) => void;
};

export type Autoplay = {
	start: (audioStartTime: number) => void;
	stop: () => void;
};

export function createAutoplay(chart: Chart, simulator: InputSimulator): Autoplay {
	let timers: ReturnType<typeof setTimeout>[] = [];
	let running = false;

	return {
		start(audioStartTime: number) {
			if (running) return;
			running = true;
			timers = [];

			const now = performance.now();

			for (const note of chart.notes) {
				const delayMs = (note.t - audioStartTime) * 1000;
				if (delayMs < 0) continue;

				const downTimer = setTimeout(() => {
					if (!running) return;
					simulator.simulateKeyDown(note.lane);
				}, delayMs);
				timers.push(downTimer);

				const holdDurationMs = note.duration ? note.duration * 1000 : 50;
				const upTimer = setTimeout(() => {
					if (!running) return;
					simulator.simulateKeyUp(note.lane);
				}, delayMs + holdDurationMs);
				timers.push(upTimer);
			}
		},
		stop() {
			running = false;
			for (const t of timers) {
				clearTimeout(t);
			}
			timers = [];
		},
	};
}
