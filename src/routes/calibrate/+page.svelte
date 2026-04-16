<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { runCalibration } from '$lib/game/calibration.js';
	import { loadSettings, saveSettings } from '$lib/game/settings.js';

	type CalibrationState = 'idle' | 'running' | 'done' | 'error';

	let calibState: CalibrationState = $state('idle');
	let tapIndex = $state(0);
	let totalTaps = $state(8);
	let lastDelta: number | null = $state(null);
	let resultOffset = $state(0);
	let errorMsg = $state('');
	let pulsing = $state(false);
	let pulseInterval: ReturnType<typeof setInterval> | null = null;
	let audioCtx: AudioContext | null = null;
	let saved = $state(false);

	function getAudioContext(): AudioContext {
		if (!audioCtx) {
			audioCtx = new AudioContext();
		}
		return audioCtx;
	}

	async function startCalibration() {
		calibState = 'running';
		tapIndex = 0;
		lastDelta = null;
		saved = false;

		const ctx = getAudioContext();
		if (ctx.state === 'suspended') {
			await ctx.resume();
		}

		// Start pulsing circle at 120 BPM (500ms)
		pulsing = true;
		if (pulseInterval) clearInterval(pulseInterval);
		pulseInterval = setInterval(() => {
			pulsing = false;
			setTimeout(() => { pulsing = true; }, 50);
		}, 500);

		try {
			const offset = await runCalibration(ctx, {
				onProgress(progress) {
					tapIndex = progress.tapIndex;
					totalTaps = progress.totalTaps;
					lastDelta = progress.delta;
				},
				onError(err) {
					errorMsg = err;
					calibState = 'error';
				},
			});
			resultOffset = offset;
			calibState = 'done';
		} catch (err) {
			if (err instanceof Error && err.message === 'Calibration cancelled') {
				calibState = 'idle';
			} else {
				errorMsg = err instanceof Error ? err.message : 'Unknown error';
				calibState = 'error';
			}
		} finally {
			if (pulseInterval) {
				clearInterval(pulseInterval);
				pulseInterval = null;
			}
			pulsing = false;
		}
	}

	function saveOffset() {
		const settings = loadSettings();
		settings.audioOffsetMs = resultOffset;
		saveSettings(settings);
		saved = true;
	}

	onDestroy(() => {
		if (pulseInterval) clearInterval(pulseInterval);
		if (audioCtx) {
			audioCtx.close();
			audioCtx = null;
		}
	});
</script>

<div class="calibrate-page">
	<h1>AUDIO CALIBRATION</h1>

	{#if calibState === 'idle'}
		<p class="instruction">
			This wizard will play a series of clicks.<br />
			Tap any key, click, or touch along with the rhythm.<br />
			Your timing offset will be calculated automatically.
		</p>
		<button class="start-btn" onclick={startCalibration}>
			START CALIBRATION
		</button>

	{:else if calibState === 'running'}
		<p class="instruction">Tap along with the clicks!</p>

		<div class="pulse-container">
			<div class="pulse-circle" class:active={pulsing}></div>
		</div>

		<div class="progress">
			<span class="tap-count">{tapIndex} / {totalTaps}</span>
			{#if lastDelta !== null}
				<span class="delta" class:early={lastDelta < 0} class:late={lastDelta > 0}>
					{lastDelta > 0 ? '+' : ''}{lastDelta}ms
				</span>
			{/if}
		</div>

		<p class="hint">Press Escape to cancel</p>

	{:else if calibState === 'done'}
		<div class="result">
			<p class="result-label">YOUR OFFSET</p>
			<p class="result-value">{resultOffset > 0 ? '+' : ''}{resultOffset}ms</p>
			<p class="result-desc">
				{#if resultOffset > 0}
					You tend to tap late. This offset will shift notes earlier.
				{:else if resultOffset < 0}
					You tend to tap early. This offset will shift notes later.
				{:else}
					Your timing is spot on!
				{/if}
			</p>
		</div>

		<div class="actions">
			<button class="save-btn" onclick={saveOffset}>
				{saved ? 'SAVED!' : 'SAVE OFFSET'}
			</button>
			<button class="retry-btn" onclick={startCalibration}>
				TRY AGAIN
			</button>
		</div>

	{:else if calibState === 'error'}
		<p class="error">{errorMsg}</p>
		<button class="retry-btn" onclick={startCalibration}>
			TRY AGAIN
		</button>
	{/if}

	<a href="/settings" class="back-link">&larr; Back to Settings</a>
</div>

<style>
	.calibrate-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 100vh;
		background: #0a0a0f;
		color: #fff;
		padding: 48px 24px;
		gap: 32px;
		font-family: monospace;
	}

	h1 {
		font-size: 32px;
		letter-spacing: 6px;
		margin: 0;
	}

	.instruction {
		color: #888;
		font-size: 14px;
		text-align: center;
		line-height: 1.8;
	}

	.start-btn {
		font-family: monospace;
		font-size: 18px;
		padding: 14px 40px;
		background: transparent;
		border: 2px solid #4488ff;
		color: #4488ff;
		cursor: pointer;
		letter-spacing: 3px;
		transition: all 0.15s;
	}

	.start-btn:hover {
		background: rgba(68, 136, 255, 0.15);
		box-shadow: 0 0 20px rgba(68, 136, 255, 0.3);
	}

	.pulse-container {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 160px;
		height: 160px;
	}

	.pulse-circle {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		border: 3px solid #4488ff;
		background: rgba(68, 136, 255, 0.1);
		transition: all 0.08s ease-out;
	}

	.pulse-circle.active {
		width: 120px;
		height: 120px;
		background: rgba(68, 136, 255, 0.3);
		border-color: #66aaff;
		box-shadow: 0 0 30px rgba(68, 136, 255, 0.5);
	}

	.progress {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.tap-count {
		font-size: 24px;
		color: #4488ff;
		letter-spacing: 4px;
	}

	.delta {
		font-size: 16px;
		color: #888;
	}

	.delta.early {
		color: #ff8844;
	}

	.delta.late {
		color: #44ff88;
	}

	.hint {
		color: #444;
		font-size: 12px;
	}

	.result {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 24px;
		border: 1px solid #333;
		background: rgba(255, 255, 255, 0.02);
		min-width: 240px;
	}

	.result-label {
		font-size: 12px;
		color: #666;
		letter-spacing: 3px;
		margin: 0;
	}

	.result-value {
		font-size: 36px;
		color: #4488ff;
		margin: 0;
		font-weight: bold;
	}

	.result-desc {
		font-size: 12px;
		color: #888;
		margin: 0;
		text-align: center;
	}

	.actions {
		display: flex;
		gap: 12px;
	}

	.save-btn {
		font-family: monospace;
		font-size: 16px;
		padding: 10px 32px;
		background: transparent;
		border: 2px solid #44ff66;
		color: #44ff66;
		cursor: pointer;
		letter-spacing: 2px;
	}

	.save-btn:hover {
		background: #44ff6620;
	}

	.retry-btn {
		font-family: monospace;
		font-size: 16px;
		padding: 10px 32px;
		background: transparent;
		border: 2px solid #888;
		color: #888;
		cursor: pointer;
		letter-spacing: 2px;
	}

	.retry-btn:hover {
		background: #ffffff10;
		color: #aaa;
	}

	.error {
		color: #ff4466;
		font-size: 14px;
	}

	.back-link {
		font-family: monospace;
		color: #555;
		font-size: 14px;
		text-decoration: none;
	}

	.back-link:hover {
		color: #888;
	}

	@media (max-width: 768px) {
		.calibrate-page {
			padding: 24px 16px;
		}

		h1 {
			font-size: 24px;
		}

		.actions {
			flex-direction: column;
			width: 100%;
			max-width: 300px;
		}

		.save-btn, .retry-btn {
			width: 100%;
			text-align: center;
		}
	}
</style>
