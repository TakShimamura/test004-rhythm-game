/**
 * Lightweight performance monitor for gameplay frame timing.
 */

export type PerfStats = {
	/** Current frames per second */
	fps: number;
	/** Average frame time in ms over the sample window */
	avgFrameTime: number;
	/** Number of frames exceeding 33ms (jank) during the session */
	jankCount: number;
	/** Total frames recorded */
	totalFrames: number;
};

export type PerfMonitor = {
	/** Call once per frame (pass the rAF timestamp or performance.now()) */
	tick: (now?: number) => void;
	/** Get current stats snapshot */
	getStats: () => PerfStats;
	/** Reset all counters */
	reset: () => void;
};

const JANK_THRESHOLD_MS = 33;
const SAMPLE_WINDOW = 60; // frames to average over

export function createPerfMonitor(): PerfMonitor {
	let frameTimes: number[] = [];
	let lastTimestamp = 0;
	let jankCount = 0;
	let totalFrames = 0;

	function tick(now?: number): void {
		const ts = now ?? performance.now();
		if (lastTimestamp > 0) {
			const delta = ts - lastTimestamp;
			frameTimes.push(delta);
			totalFrames++;

			if (delta > JANK_THRESHOLD_MS) {
				jankCount++;
			}

			// Keep only the most recent window
			if (frameTimes.length > SAMPLE_WINDOW) {
				frameTimes = frameTimes.slice(-SAMPLE_WINDOW);
			}
		}
		lastTimestamp = ts;
	}

	function getStats(): PerfStats {
		if (frameTimes.length === 0) {
			return { fps: 0, avgFrameTime: 0, jankCount: 0, totalFrames: 0 };
		}

		const sum = frameTimes.reduce((a, b) => a + b, 0);
		const avg = sum / frameTimes.length;
		const fps = avg > 0 ? 1000 / avg : 0;

		return {
			fps: Math.round(fps),
			avgFrameTime: Math.round(avg * 100) / 100,
			jankCount,
			totalFrames,
		};
	}

	function reset(): void {
		frameTimes = [];
		lastTimestamp = 0;
		jankCount = 0;
		totalFrames = 0;
	}

	return { tick, getStats, reset };
}
