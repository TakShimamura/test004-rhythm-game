<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client.js';
	import { detectBPM, detectOnsets, generateChart } from '$lib/game/audio-analysis.js';
	import type { Note, Difficulty } from '$lib/game/types.js';

	const session = authClient.useSession();

	// Song state
	let songId = $state('');
	let songTitle = $state('');
	let songArtist = $state('');
	let songBpm = $state(120);
	let audioUrl = $state('');
	let loading = $state(true);
	let error = $state('');

	// Analysis state
	type AnalysisPhase = 'idle' | 'loading-audio' | 'detecting-bpm' | 'detecting-onsets' | 'generating' | 'done';
	let phase = $state<AnalysisPhase>('idle');
	let audioBuffer: AudioBuffer | null = $state(null);
	let detectedBpm = $state(120);
	let bpmOverride = $state(120);
	let useBpmOverride = $state(false);
	let difficulty = $state<Difficulty>('normal');
	let sensitivity = $state(0.5);
	let onsetCount = $state(0);
	let generatedNotes: Note[] = $state([]);
	let publishing = $state(false);

	// Canvas
	let canvas: HTMLCanvasElement;
	let waveformCanvas: HTMLCanvasElement;
	let scrollOffset = $state(0);

	const PX_PER_SEC = 200;
	const LANE_WIDTH = 80;
	const HEADER_H = 40;
	const LANE_COLORS = ['#ff4466', '#44ff66', '#4488ff'];

	let effectiveBpm = $derived(useBpmOverride ? bpmOverride : detectedBpm);

	onMount(async () => {
		songId = page.url.searchParams.get('songId') ?? '';
		if (!songId) {
			error = 'No songId provided';
			loading = false;
			return;
		}

		try {
			const res = await fetch(`/api/songs/${songId}`);
			if (!res.ok) {
				error = 'Song not found';
				loading = false;
				return;
			}
			const song = await res.json();
			songTitle = song.title;
			songArtist = song.artist;
			songBpm = song.bpm;
			audioUrl = song.audioUrl;
			bpmOverride = song.bpm;
		} catch {
			error = 'Failed to load song';
		}

		loading = false;
	});

	async function loadAudioBuffer(): Promise<AudioBuffer> {
		if (audioBuffer) return audioBuffer;
		phase = 'loading-audio';
		const response = await fetch(audioUrl);
		const arrayBuffer = await response.arrayBuffer();
		const ctx = new AudioContext();
		audioBuffer = await ctx.decodeAudioData(arrayBuffer);
		await ctx.close();
		return audioBuffer;
	}

	async function runAnalysis() {
		error = '';
		generatedNotes = [];

		try {
			const buffer = await loadAudioBuffer();

			// BPM detection
			phase = 'detecting-bpm';
			detectedBpm = await detectBPM(buffer);

			// Onset detection
			phase = 'detecting-onsets';
			const onsets = detectOnsets(buffer, sensitivity);
			onsetCount = onsets.length;

			// Draw waveform with onsets
			drawWaveform(buffer, onsets);

			// Chart generation
			phase = 'generating';
			generatedNotes = generateChart(buffer, effectiveBpm, difficulty, sensitivity);

			phase = 'done';

			// Start canvas draw loop
			requestAnimationFrame(drawLoop);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Analysis failed';
			phase = 'idle';
		}
	}

	function drawWaveform(buffer: AudioBuffer, onsets: number[]) {
		if (!waveformCanvas) return;
		const ctx = waveformCanvas.getContext('2d')!;
		const dpr = window.devicePixelRatio || 1;
		const rect = waveformCanvas.getBoundingClientRect();
		waveformCanvas.width = rect.width * dpr;
		waveformCanvas.height = rect.height * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const w = rect.width;
		const h = rect.height;
		const data = buffer.getChannelData(0);
		const duration = buffer.duration;
		const samplesPerPixel = Math.ceil(data.length / w);

		// Background
		ctx.fillStyle = '#0a0a0f';
		ctx.fillRect(0, 0, w, h);

		// Waveform
		ctx.strokeStyle = '#334';
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let x = 0; x < w; x++) {
			const startSample = x * samplesPerPixel;
			let min = 0;
			let max = 0;
			for (let i = 0; i < samplesPerPixel && startSample + i < data.length; i++) {
				const val = data[startSample + i];
				if (val < min) min = val;
				if (val > max) max = val;
			}
			const yMin = h / 2 + min * (h / 2) * 0.9;
			const yMax = h / 2 + max * (h / 2) * 0.9;
			ctx.moveTo(x, yMin);
			ctx.lineTo(x, yMax);
		}
		ctx.stroke();

		// Onset markers
		ctx.strokeStyle = '#ff446688';
		ctx.lineWidth = 1;
		for (const t of onsets) {
			const x = (t / duration) * w;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, h);
			ctx.stroke();
		}

		// Labels
		ctx.fillStyle = '#666';
		ctx.font = '11px monospace';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillText(`${onsets.length} onsets detected`, 6, 4);
	}

	function timeToY(t: number): number {
		return HEADER_H + (t - scrollOffset) * PX_PER_SEC;
	}

	function handleScroll(e: WheelEvent) {
		e.preventDefault();
		scrollOffset = Math.max(0, scrollOffset + e.deltaY / PX_PER_SEC);
	}

	function drawLoop() {
		if (!canvas || phase !== 'done') return;
		const ctx = canvas.getContext('2d')!;
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const w = rect.width;
		const h = rect.height;
		const laneStartX = (w - LANE_WIDTH * 3) / 2;

		// Background
		ctx.fillStyle = '#0a0a0f';
		ctx.fillRect(0, 0, w, h);

		// Lanes
		for (let i = 0; i <= 3; i++) {
			ctx.strokeStyle = '#222';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(laneStartX + i * LANE_WIDTH, HEADER_H);
			ctx.lineTo(laneStartX + i * LANE_WIDTH, h);
			ctx.stroke();
		}

		// Lane labels
		const labels = ['A', 'S', 'D'];
		for (let i = 0; i < 3; i++) {
			ctx.fillStyle = LANE_COLORS[i];
			ctx.font = 'bold 14px monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(labels[i], laneStartX + i * LANE_WIDTH + LANE_WIDTH / 2, HEADER_H / 2);
		}

		// Beat grid
		const beatInterval = 60 / effectiveBpm;
		const startBeat = Math.floor(scrollOffset / beatInterval);
		for (let b = startBeat; b < startBeat + 100; b++) {
			const t = b * beatInterval;
			const y = timeToY(t);
			if (y < HEADER_H || y > h) continue;

			const isMeasure = b % 4 === 0;
			ctx.strokeStyle = isMeasure ? '#333' : '#1a1a1a';
			ctx.lineWidth = isMeasure ? 1 : 0.5;
			ctx.beginPath();
			ctx.moveTo(laneStartX, y);
			ctx.lineTo(laneStartX + LANE_WIDTH * 3, y);
			ctx.stroke();

			if (isMeasure) {
				ctx.fillStyle = '#444';
				ctx.font = '11px monospace';
				ctx.textAlign = 'right';
				ctx.textBaseline = 'middle';
				ctx.fillText(`${t.toFixed(1)}s`, laneStartX - 8, y);
			}
		}

		// Notes
		for (const note of generatedNotes) {
			const y = timeToY(note.t);

			// Hold note tail
			if (note.duration) {
				const yEnd = timeToY(note.t + note.duration);
				if (yEnd >= HEADER_H - 20 && y <= h + 20) {
					const cx = laneStartX + note.lane * LANE_WIDTH + LANE_WIDTH / 2;
					ctx.fillStyle = LANE_COLORS[note.lane] + '44';
					ctx.fillRect(cx - 10, Math.min(y, yEnd), 20, Math.abs(yEnd - y));
				}
			}

			if (y < HEADER_H - 20 || y > h + 20) continue;
			const cx = laneStartX + note.lane * LANE_WIDTH + LANE_WIDTH / 2;

			ctx.beginPath();
			ctx.arc(cx, y, 12, 0, Math.PI * 2);
			ctx.fillStyle = LANE_COLORS[note.lane];
			ctx.fill();
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 2;
			ctx.stroke();
		}

		// Note count
		ctx.fillStyle = '#666';
		ctx.font = '12px monospace';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillText(`${generatedNotes.length} notes`, 8, 8);

		requestAnimationFrame(drawLoop);
	}

	function editInEditor() {
		localStorage.setItem('autoChart_notes', JSON.stringify(generatedNotes));
		localStorage.setItem('autoChart_songId', songId);
		goto(`/editor/new?songId=${songId}`);
	}

	async function publishChart() {
		if (generatedNotes.length === 0) {
			error = 'Generate a chart first!';
			return;
		}
		publishing = true;
		error = '';

		try {
			const res = await fetch('/api/charts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					songId,
					difficulty,
					notes: generatedNotes,
				}),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				error = data.message ?? 'Failed to publish chart';
				return;
			}

			const chart = await res.json();
			goto(`/play?chart=${chart.id}`);
		} finally {
			publishing = false;
		}
	}

	const phaseLabels: Record<AnalysisPhase, string> = {
		idle: '',
		'loading-audio': 'Loading audio file...',
		'detecting-bpm': 'Detecting BPM...',
		'detecting-onsets': 'Finding onsets...',
		generating: 'Generating chart...',
		done: 'Done!',
	};
</script>

<div class="auto-page">
	{#if loading}
		<p class="hint">Loading...</p>
	{:else if !$session.data}
		<h1>LOGIN REQUIRED</h1>
		<a href="/auth" class="btn">LOGIN</a>
	{:else if error && !songId}
		<p class="error">{error}</p>
	{:else}
		<div class="toolbar">
			<div class="song-info">
				<span class="song-title">{songTitle}</span>
				<span class="song-meta">{songArtist} — {songBpm} BPM (uploaded)</span>
			</div>
			<div class="tools">
				{#if phase === 'done'}
					<button class="tool-btn" onclick={editInEditor}>EDIT IN EDITOR</button>
					<button class="publish-btn" onclick={publishChart} disabled={publishing}>
						{publishing ? 'PUBLISHING...' : 'PUBLISH'}
					</button>
				{/if}
			</div>
		</div>

		<div class="controls">
			<div class="control-group">
				<label>
					<span>Difficulty</span>
					<select bind:value={difficulty}>
						<option value="easy">Easy</option>
						<option value="normal">Normal</option>
						<option value="hard">Hard</option>
					</select>
				</label>
				<label>
					<span>Sensitivity</span>
					<div class="slider-row">
						<input type="range" min="0" max="1" step="0.05" bind:value={sensitivity} />
						<span class="slider-val">{sensitivity.toFixed(2)}</span>
					</div>
				</label>
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={useBpmOverride} />
					<span>Override BPM</span>
				</label>
				{#if useBpmOverride}
					<label>
						<span>BPM</span>
						<input type="number" bind:value={bpmOverride} min="40" max="300" class="bpm-input" />
					</label>
				{/if}
			</div>

			<button
				class="generate-btn"
				onclick={runAnalysis}
				disabled={phase !== 'idle' && phase !== 'done'}
			>
				{phase === 'idle' || phase === 'done' ? 'GENERATE' : 'ANALYZING...'}
			</button>
		</div>

		{#if phase !== 'idle'}
			<div class="progress">
				<div class="progress-steps">
					<span class:active={phase === 'loading-audio'} class:done={['detecting-bpm', 'detecting-onsets', 'generating', 'done'].includes(phase)}>
						Load Audio
					</span>
					<span class="arrow">&rarr;</span>
					<span class:active={phase === 'detecting-bpm'} class:done={['detecting-onsets', 'generating', 'done'].includes(phase)}>
						Detect BPM
					</span>
					<span class="arrow">&rarr;</span>
					<span class:active={phase === 'detecting-onsets'} class:done={['generating', 'done'].includes(phase)}>
						Find Onsets
					</span>
					<span class="arrow">&rarr;</span>
					<span class:active={phase === 'generating'} class:done={phase === 'done'}>
						Generate Chart
					</span>
				</div>
				<p class="phase-label">{phaseLabels[phase]}</p>
			</div>
		{/if}

		{#if phase === 'done'}
			<div class="results-bar">
				<span>Detected BPM: <strong>{detectedBpm}</strong></span>
				<span>Effective BPM: <strong>{effectiveBpm}</strong></span>
				<span>Onsets: <strong>{onsetCount}</strong></span>
				<span>Notes: <strong>{generatedNotes.length}</strong></span>
			</div>
		{/if}

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<!-- Waveform display -->
		<canvas bind:this={waveformCanvas} class="waveform-canvas"></canvas>

		<!-- Chart preview -->
		{#if phase === 'done'}
			<div class="preview-container">
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<canvas
					bind:this={canvas}
					class="editor-canvas"
					onwheel={handleScroll}
				></canvas>
			</div>
		{/if}
	{/if}

	<a href="/songs" class="back-link">&larr; Back to Songs</a>
</div>

<style>
	.auto-page {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background: #0a0a0f;
		color: #fff;
		font-family: monospace;
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 20px;
		border-bottom: 1px solid #222;
		flex-shrink: 0;
	}

	.song-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.song-title {
		font-size: 16px;
		font-weight: bold;
	}

	.song-meta {
		font-size: 12px;
		color: #888;
	}

	.tools {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.controls {
		display: flex;
		align-items: flex-end;
		gap: 20px;
		padding: 16px 20px;
		border-bottom: 1px solid #222;
		flex-wrap: wrap;
	}

	.control-group {
		display: flex;
		gap: 16px;
		align-items: flex-end;
		flex-wrap: wrap;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.controls label span {
		font-size: 11px;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.controls select {
		background: #111;
		border: 1px solid #333;
		color: #fff;
		font-family: monospace;
		padding: 6px 10px;
		font-size: 13px;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.slider-row input[type="range"] {
		width: 120px;
		accent-color: #4488ff;
	}

	.slider-val {
		font-size: 13px;
		color: #aaa;
		min-width: 36px;
	}

	.checkbox-label {
		flex-direction: row !important;
		align-items: center !important;
		gap: 6px !important;
	}

	.checkbox-label input[type="checkbox"] {
		accent-color: #4488ff;
	}

	.bpm-input {
		background: #111;
		border: 1px solid #333;
		color: #fff;
		font-family: monospace;
		padding: 6px 10px;
		font-size: 13px;
		width: 80px;
	}

	.bpm-input:focus {
		outline: none;
		border-color: #4488ff;
	}

	.generate-btn {
		font-family: monospace;
		font-size: 14px;
		padding: 8px 24px;
		background: transparent;
		border: 2px solid #ffaa22;
		color: #ffaa22;
		cursor: pointer;
		letter-spacing: 2px;
	}

	.generate-btn:hover { background: #ffaa2220; }
	.generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.progress {
		padding: 12px 20px;
		border-bottom: 1px solid #222;
	}

	.progress-steps {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 13px;
	}

	.progress-steps span {
		color: #444;
		transition: color 0.2s;
	}

	.progress-steps span.active {
		color: #ffaa22;
	}

	.progress-steps span.done {
		color: #44ff66;
	}

	.progress-steps .arrow {
		color: #333;
	}

	.phase-label {
		font-size: 12px;
		color: #888;
		margin: 6px 0 0;
	}

	.results-bar {
		display: flex;
		gap: 24px;
		padding: 10px 20px;
		border-bottom: 1px solid #222;
		font-size: 13px;
		color: #888;
	}

	.results-bar strong {
		color: #fff;
	}

	.waveform-canvas {
		width: 100%;
		height: 80px;
		display: block;
		flex-shrink: 0;
	}

	.preview-container {
		flex: 1;
		overflow: hidden;
		min-height: 300px;
	}

	.editor-canvas {
		width: 100%;
		height: 100%;
		display: block;
		cursor: ns-resize;
	}

	.tool-btn {
		font-family: monospace;
		font-size: 13px;
		padding: 6px 14px;
		background: transparent;
		border: 1px solid #4488ff;
		color: #4488ff;
		cursor: pointer;
	}

	.tool-btn:hover { background: #4488ff20; }

	.publish-btn {
		font-family: monospace;
		font-size: 13px;
		padding: 6px 14px;
		background: transparent;
		border: 1px solid #44ff66;
		color: #44ff66;
		cursor: pointer;
	}

	.publish-btn:hover { background: #44ff6620; }
	.publish-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.error {
		color: #ff4444;
		font-size: 13px;
		padding: 0 20px;
		margin: 8px 0 0;
	}

	.hint {
		color: #555;
		font-size: 14px;
		text-align: center;
		padding: 48px;
	}

	.btn {
		font-family: monospace;
		font-size: 16px;
		padding: 10px 32px;
		background: transparent;
		border: 2px solid #4488ff;
		color: #4488ff;
		text-decoration: none;
		letter-spacing: 2px;
		margin: 24px auto;
	}

	.back-link {
		font-family: monospace;
		color: #555;
		font-size: 14px;
		text-decoration: none;
		padding: 12px 20px;
	}

	.back-link:hover { color: #888; }
</style>
