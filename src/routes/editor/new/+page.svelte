<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client.js';
	import type { Lane } from '$lib/game/types.js';

	const session = authClient.useSession();

	type Note = { t: number; lane: Lane };

	let songId = $state('');
	let songTitle = $state('');
	let songArtist = $state('');
	let bpm = $state(120);
	let audioUrl = $state('');
	let difficulty = $state('normal');
	let notes: Note[] = $state([]);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');

	// audio
	let audioElement: HTMLAudioElement | null = $state(null);
	let playing = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);

	// editor canvas
	let canvas: HTMLCanvasElement;
	let scrollOffset = $state(0);

	const PX_PER_SEC = 200;
	const LANE_WIDTH = 80;
	const HEADER_H = 40;
	const LANE_COLORS = ['#ff4466', '#44ff66', '#4488ff'];

	onMount(async () => {
		songId = page.url.searchParams.get('songId') ?? '';
		if (!songId) {
			error = 'No songId provided';
			loading = false;
			return;
		}

		const res = await fetch(`/api/songs/${songId}`);
		if (res.ok) {
			const song = await res.json();
			songTitle = song.title;
			songArtist = song.artist;
			bpm = song.bpm;
			duration = song.durationMs / 1000;
			audioUrl = song.audioUrl;
		} else {
			error = 'Song not found';
		}

		loading = false;
		requestAnimationFrame(drawLoop);
	});

	function timeToY(t: number): number {
		return HEADER_H + (t - scrollOffset) * PX_PER_SEC;
	}

	function yToTime(y: number): number {
		return (y - HEADER_H) / PX_PER_SEC + scrollOffset;
	}

	function snapToGrid(t: number): number {
		const beatInterval = 60 / bpm;
		const subdivisions = 4;
		const gridSize = beatInterval / subdivisions;
		return Math.round(t / gridSize) * gridSize;
	}

	function handleCanvasClick(e: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const laneStartX = (rect.width - LANE_WIDTH * 3) / 2;
		const lane = Math.floor((x - laneStartX) / LANE_WIDTH) as Lane;
		if (lane < 0 || lane > 2) return;

		const t = snapToGrid(yToTime(y));
		if (t < 0) return;

		// check if clicking an existing note (to remove it)
		const existingIdx = notes.findIndex(
			(n) => n.lane === lane && Math.abs(n.t - t) < 0.05,
		);

		if (existingIdx >= 0) {
			notes = notes.filter((_, i) => i !== existingIdx);
		} else {
			notes = [...notes, { t: Math.round(t * 1000) / 1000, lane }].sort(
				(a, b) => a.t - b.t,
			);
		}
	}

	function handleScroll(e: WheelEvent) {
		e.preventDefault();
		scrollOffset = Math.max(0, scrollOffset + e.deltaY / PX_PER_SEC);
	}

	function drawLoop() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d')!;
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const w = rect.width;
		const h = rect.height;
		const laneStartX = (w - LANE_WIDTH * 3) / 2;

		// background
		ctx.fillStyle = '#0a0a0f';
		ctx.fillRect(0, 0, w, h);

		// lanes
		for (let i = 0; i <= 3; i++) {
			ctx.strokeStyle = '#222';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(laneStartX + i * LANE_WIDTH, HEADER_H);
			ctx.lineTo(laneStartX + i * LANE_WIDTH, h);
			ctx.stroke();
		}

		// lane labels
		const labels = ['A', 'S', 'D'];
		for (let i = 0; i < 3; i++) {
			ctx.fillStyle = LANE_COLORS[i];
			ctx.font = 'bold 14px monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(labels[i], laneStartX + i * LANE_WIDTH + LANE_WIDTH / 2, HEADER_H / 2);
		}

		// beat grid
		const beatInterval = 60 / bpm;
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

		// playhead
		if (playing && audioElement) {
			const playY = timeToY(audioElement.currentTime);
			if (playY >= HEADER_H && playY <= h) {
				ctx.strokeStyle = '#ffdd00';
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(laneStartX, playY);
				ctx.lineTo(laneStartX + LANE_WIDTH * 3, playY);
				ctx.stroke();
			}
		}

		// notes
		for (const note of notes) {
			const y = timeToY(note.t);
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

		// note count
		ctx.fillStyle = '#666';
		ctx.font = '12px monospace';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillText(`${notes.length} notes`, 8, 8);

		requestAnimationFrame(drawLoop);
	}

	function togglePlayback() {
		if (!audioElement) return;
		if (playing) {
			audioElement.pause();
			playing = false;
		} else {
			audioElement.currentTime = scrollOffset;
			audioElement.play();
			playing = true;
		}
	}

	async function publishChart() {
		if (notes.length === 0) {
			error = 'Add some notes first!';
			return;
		}
		saving = true;
		error = '';

		const res = await fetch('/api/charts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ songId, difficulty, notes }),
		});

		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			error = data.message ?? 'Failed to save chart';
			saving = false;
			return;
		}

		const chart = await res.json();
		goto(`/play?chart=${chart.id}`);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === ' ') {
			e.preventDefault();
			togglePlayback();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="editor-page">
	{#if loading}
		<p class="hint">Loading...</p>
	{:else if !$session.data}
		<h1>LOGIN REQUIRED</h1>
		<a href="/auth" class="btn">LOGIN</a>
	{:else}
		<div class="toolbar">
			<div class="song-info">
				<span class="song-title">{songTitle}</span>
				<span class="song-meta">{songArtist} — {bpm} BPM</span>
			</div>
			<div class="tools">
				<select bind:value={difficulty}>
					<option value="easy">Easy</option>
					<option value="normal">Normal</option>
					<option value="hard">Hard</option>
				</select>
				<button class="tool-btn" onclick={togglePlayback}>
					{playing ? 'PAUSE' : 'PLAY'}
				</button>
				<button class="publish-btn" onclick={publishChart} disabled={saving}>
					{saving ? 'SAVING...' : 'PUBLISH'}
				</button>
			</div>
		</div>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<div class="editor-body">
			<div class="instructions">
				<p>Click to place/remove notes</p>
				<p>Scroll to navigate timeline</p>
				<p>Space to play/pause audio</p>
			</div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<canvas
				bind:this={canvas}
				class="editor-canvas"
				onclick={handleCanvasClick}
				onwheel={handleScroll}
			></canvas>
		</div>

		{#if audioUrl}
			<audio bind:this={audioElement} src={audioUrl} preload="auto"></audio>
		{/if}
	{/if}

	<a href="/songs" class="back-link">&larr; Back to Songs</a>
</div>

<style>
	.editor-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
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

	select {
		background: #111;
		border: 1px solid #333;
		color: #fff;
		font-family: monospace;
		padding: 6px 10px;
		font-size: 13px;
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
		margin: 0;
	}

	.editor-body {
		flex: 1;
		display: flex;
		overflow: hidden;
	}

	.instructions {
		width: 180px;
		padding: 16px;
		border-right: 1px solid #222;
		flex-shrink: 0;
	}

	.instructions p {
		font-size: 12px;
		color: #555;
		margin: 0 0 8px;
	}

	.editor-canvas {
		flex: 1;
		display: block;
		cursor: crosshair;
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
		margin: 0 auto;
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
