/**
 * Audio calibration wizard.
 * Plays a steady metronome at 120 BPM (500ms intervals), records user taps,
 * and calculates the average offset to correct audioOffsetMs.
 */

export type CalibrationProgress = {
	tapIndex: number;
	totalTaps: number;
	delta: number | null;
};

export type CalibrationUI = {
	onClickPlay: () => void;
	onProgress: (progress: CalibrationProgress) => void;
	onComplete: (offsetMs: number) => void;
	onError: (error: string) => void;
};

const TOTAL_CLICKS = 8;
const CLICK_INTERVAL_MS = 500; // 120 BPM
const LEAD_IN_CLICKS = 2; // 2 clicks before we start recording taps

/**
 * Generate a short click sound (a brief sine blip).
 */
function playClick(ctx: AudioContext, time: number): void {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.value = 1000;
	gain.gain.setValueAtTime(0.5, time);
	gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.05);
}

/**
 * Run an audio calibration session.
 *
 * Plays (LEAD_IN_CLICKS + TOTAL_CLICKS) clicks at 120 BPM.
 * The first LEAD_IN_CLICKS are just to establish the rhythm.
 * Then TOTAL_CLICKS are played and taps are recorded for offset calculation.
 *
 * Returns the average delta in ms (positive = user taps late, negative = early).
 */
export function runCalibration(
	ctx: AudioContext,
	callbacks?: Partial<CalibrationUI>,
): Promise<number> {
	return new Promise<number>((resolve, reject) => {
		const totalScheduled = LEAD_IN_CLICKS + TOTAL_CLICKS;
		const clickTimes: number[] = [];
		const tapTimes: number[] = [];
		let tapCount = 0;
		let finished = false;

		// Schedule all clicks
		const startTime = ctx.currentTime + 0.3; // small lead-in buffer
		for (let i = 0; i < totalScheduled; i++) {
			const clickTime = startTime + i * (CLICK_INTERVAL_MS / 1000);
			playClick(ctx, clickTime);
			// Only record times for the scored clicks (after lead-in)
			if (i >= LEAD_IN_CLICKS) {
				clickTimes.push(clickTime);
			}
		}

		function handleTap(): void {
			if (finished) return;
			const now = ctx.currentTime;
			tapTimes.push(now);
			tapCount++;

			// Calculate delta for this tap against nearest expected click
			const expectedIndex = Math.min(tapCount - 1, clickTimes.length - 1);
			const delta = (now - clickTimes[expectedIndex]) * 1000; // convert to ms

			callbacks?.onProgress?.({
				tapIndex: tapCount,
				totalTaps: TOTAL_CLICKS,
				delta: Math.round(delta),
			});

			if (tapCount >= TOTAL_CLICKS) {
				finish();
			}
		}

		function finish(): void {
			if (finished) return;
			finished = true;

			// Remove listeners
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('mousedown', onMouse);
			window.removeEventListener('touchstart', onTouch);

			if (tapTimes.length === 0) {
				const msg = 'No taps recorded';
				callbacks?.onError?.(msg);
				reject(new Error(msg));
				return;
			}

			// Calculate average offset
			const deltas: number[] = [];
			for (let i = 0; i < Math.min(tapTimes.length, clickTimes.length); i++) {
				deltas.push((tapTimes[i] - clickTimes[i]) * 1000);
			}
			const avgOffset = Math.round(
				deltas.reduce((sum, d) => sum + d, 0) / deltas.length,
			);

			callbacks?.onComplete?.(avgOffset);
			resolve(avgOffset);
		}

		function onKey(e: KeyboardEvent): void {
			if (e.key === 'Escape') {
				finished = true;
				window.removeEventListener('keydown', onKey);
				window.removeEventListener('mousedown', onMouse);
				window.removeEventListener('touchstart', onTouch);
				reject(new Error('Calibration cancelled'));
				return;
			}
			handleTap();
		}
		function onMouse(): void {
			handleTap();
		}
		function onTouch(): void {
			handleTap();
		}

		window.addEventListener('keydown', onKey);
		window.addEventListener('mousedown', onMouse);
		window.addEventListener('touchstart', onTouch);

		// Timeout: if user doesn't finish in time, auto-complete with what we have
		const timeoutMs = (totalScheduled + 4) * CLICK_INTERVAL_MS;
		setTimeout(() => {
			if (!finished) {
				finish();
			}
		}, timeoutMs);
	});
}
