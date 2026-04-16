<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client.js';
	import type { Lane, Difficulty, Note } from '$lib/game/types.js';

	const session = authClient.useSession();

	// --- Song metadata ---
	let songId = $state('');
	let songTitle = $state('');
	let songArtist = $state('');
	let bpm = $state(120);
	let audioUrl = $state('');
	let difficulty: Difficulty = $state('normal');
	let notes: Note[] = $state([]);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');

	// --- Audio ---
	let audioContext: AudioContext | null = $state(null);
	let audioBuffer: AudioBuffer | null = $state(null);
	let sourceNode: AudioBufferSourceNode | null = $state(null);
	let waveformData: Float32Array | null = $state(null);
	let playing = $state(false);
	let playbackStartTime = $state(0);
	let playbackStartOffset = $state(0);
	let playbackSpeed = $state(1.0);
	let songDuration = $state(0);
	let clickBuffer: AudioBuffer | null = $state(null);
	let lastClickedNoteIndex = $state(-1);

	// --- Canvas / editor ---
	let canvas: HTMLCanvasElement;
	let scrollOffset = $state(0);
	let subdivision: 4 | 8 | 16 = $state(4);
	let animFrameId = 0;

	// --- Drag for hold notes ---
	let isDragging = $state(false);
	let dragStartY = $state(0);
	let dragStartTime = $state(0);
	let dragLane: Lane = $state(0);
	let dragCurrentY = $state(0);

	// --- Selection ---
	let isSelecting = $state(false);
	let selectionStartTime = $state(0);
	let selectionEndTime = $state(0);
	let clipboard: Note[] = $state([]);

	// --- Undo/redo ---
	type UndoEntry = { notes: Note[] };
	let undoStack: UndoEntry[] = $state([]);
	let redoStack: UndoEntry[] = $state([]);

	const PX_PER_SEC = 200;
	const LANE_WIDTH = 80;
	const HEADER_H = 48;
	const LANE_COLORS = ['#ff4466', '#44ff66', '#4488ff'];
	const LANE_COLORS_DIM = ['#ff446640', '#44ff6640', '#4488ff40'];
	const HOLD_THRESHOLD_PX = 10;
	const DRAFT_KEY = 'chart-editor-draft';

	// --- Helpers ---
	function currentPlayheadTime(): number {
		if (!playing || !audioContext) return playbackStartOffset;
		return playbackStartOffset + (audioContext.currentTime - playbackStartTime) * playbackSpeed;
	}

	function timeToY(t: number): number {
		return HEADER_H + (t - scrollOffset) * PX_PER_SEC;
	}

	function yToTime(y: number): number {
		return (y - HEADER_H) / PX_PER_SEC + scrollOffset;
	}

	function snapToGrid(t: number): number {
		const beatInterval = 60 / bpm;
		const gridSize = beatInterval / (subdivision / 4);
		return Math.round(t / gridSize) * gridSize;
	}

	function roundTime(t: number): number {
		return Math.round(t * 10000) / 10000;
	}

	function pushUndo() {
		undoStack = [...undoStack, { notes: structuredClone(notes) }];
		redoStack = [];
	}

	function undo() {
		if (undoStack.length === 0) return;
		const entry = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);
		redoStack = [...redoStack, { notes: structuredClone(notes) }];
		notes = entry.notes;
	}

	function redo() {
		if (redoStack.length === 0) return;
		const entry = redoStack[redoStack.length - 1];
		redoStack = redoStack.slice(0, -1);
		undoStack = [...undoStack, { notes: structuredClone(notes) }];
		notes = entry.notes;
	}

	function sortNotes() {
		notes = [...notes].sort((a, b) => a.t - b.t);
	}

	// --- Audio setup ---
	async function initAudio(url: string) {
		audioContext = new AudioContext();

		// Create click sound buffer
		const clickLen = audioContext.sampleRate * 0.02;
		clickBuffer = audioContext.createBuffer(1, clickLen, audioContext.sampleRate);
		const clickData = clickBuffer.getChannelData(0);
		for (let i = 0; i < clickLen; i++) {
			clickData[i] = Math.sin(i / clickLen * Math.PI * 2 * 800) * (1 - i / clickLen);
		}

		try {
			const response = await fetch(url);
			const arrayBuffer = await response.arrayBuffer();
			audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
			songDuration = audioBuffer.duration;

			// Extract waveform data (downsampled)
			const channelData = audioBuffer.getChannelData(0);
			const sampleRate = audioBuffer.sampleRate;
			const samplesPerPixel = Math.floor(sampleRate / PX_PER_SEC);
			const totalPixels = Math.ceil(channelData.length / samplesPerPixel);
			waveformData = new Float32Array(totalPixels);
			for (let i = 0; i < totalPixels; i++) {
				let max = 0;
				const start = i * samplesPerPixel;
				const end = Math.min(start + samplesPerPixel, channelData.length);
				for (let j = start; j < end; j++) {
					const abs = Math.abs(channelData[j]);
					if (abs > max) max = abs;
				}
				waveformData[i] = max;
			}
		} catch (e) {
			console.error('Failed to decode audio:', e);
		}
	}

	function playClick() {
		if (!audioContext || !clickBuffer) return;
		const src = audioContext.createBufferSource();
		src.buffer = clickBuffer;
		src.connect(audioContext.destination);
		src.start();
	}

	function startPlayback() {
		if (!audioContext || !audioBuffer) return;
		if (audioContext.state === 'suspended') audioContext.resume();

		stopPlayback();

		sourceNode = audioContext.createBufferSource();
		sourceNode.buffer = audioBuffer;
		sourceNode.playbackRate.value = playbackSpeed;
		sourceNode.connect(audioContext.destination);

		playbackStartOffset = scrollOffset;
		playbackStartTime = audioContext.currentTime;
		lastClickedNoteIndex = -1;

		sourceNode.start(0, playbackStartOffset);
		sourceNode.onended = () => { playing = false; };
		playing = true;
	}

	function stopPlayback() {
		if (sourceNode) {
			try { sourceNode.stop(); } catch { /* already stopped */ }
			sourceNode.disconnect();
			sourceNode = null;
		}
		playing = false;
	}

	function togglePlayback() {
		if (playing) {
			const t = currentPlayheadTime();
			stopPlayback();
			playbackStartOffset = t;
		} else {
			startPlayback();
		}
	}

	// --- Canvas events ---
	function getLaneAtX(x: number, canvasWidth: number): Lane | null {
		const laneStartX = (canvasWidth - LANE_WIDTH * 3) / 2;
		const lane = Math.floor((x - laneStartX) / LANE_WIDTH);
		if (lane < 0 || lane > 2) return null;
		return lane as Lane;
	}

	function findNoteAt(t: number, lane: Lane): number {
		const gridSize = 60 / bpm / (subdivision / 4);
		const threshold = gridSize * 0.4;
		return notes.findIndex(
			(n) => n.lane === lane && Math.abs(n.t - t) < threshold,
		);
	}

	function handleMouseDown(e: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		if (y < HEADER_H) return;

		const lane = getLaneAtX(x, rect.width);

		if (lane === null) {
			// Start selection on empty area
			isSelecting = true;
			selectionStartTime = yToTime(y);
			selectionEndTime = selectionStartTime;
			return;
		}

		const t = snapToGrid(yToTime(y));
		if (t < 0) return;

		// Check if clicking existing note
		const existingIdx = findNoteAt(t, lane);
		if (existingIdx >= 0) {
			pushUndo();
			notes = notes.filter((_, i) => i !== existingIdx);
			return;
		}

		// Start drag for potential hold note
		isDragging = true;
		dragStartY = y;
		dragStartTime = t;
		dragLane = lane;
		dragCurrentY = y;
	}

	function handleMouseMove(e: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const y = e.clientY - rect.top;

		if (isDragging) {
			dragCurrentY = y;
		}
		if (isSelecting) {
			selectionEndTime = yToTime(y);
		}
	}

	function handleMouseUp(e: MouseEvent) {
		if (isSelecting) {
			isSelecting = false;
			// Normalize selection range
			if (selectionStartTime > selectionEndTime) {
				const tmp = selectionStartTime;
				selectionStartTime = selectionEndTime;
				selectionEndTime = tmp;
			}
			return;
		}

		if (!isDragging) return;
		isDragging = false;

		const rect = canvas.getBoundingClientRect();
		const y = e.clientY - rect.top;
		const dragDist = Math.abs(y - dragStartY);

		pushUndo();

		if (dragDist > HOLD_THRESHOLD_PX) {
			// Hold note
			const endTime = snapToGrid(yToTime(y));
			const startT = Math.min(dragStartTime, endTime);
			const endT = Math.max(dragStartTime, endTime);
			const dur = roundTime(endT - startT);
			if (dur > 0) {
				notes = [...notes, { t: roundTime(startT), lane: dragLane, duration: dur }];
				sortNotes();
			}
		} else {
			// Tap note
			notes = [...notes, { t: roundTime(dragStartTime), lane: dragLane }];
			sortNotes();
		}
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		scrollOffset = Math.max(0, Math.min(songDuration, scrollOffset + e.deltaY / PX_PER_SEC));
	}

	// --- Keyboard ---
	function handleKeydown(e: KeyboardEvent) {
		// Ignore if typing in input
		if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

		if (e.key === ' ') {
			e.preventDefault();
			togglePlayback();
			return;
		}

		if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
			e.preventDefault();
			redo();
			return;
		}

		if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			undo();
			return;
		}

		if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			copySelection();
			return;
		}

		if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			pasteAtScroll();
			return;
		}

		if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			deleteSelected();
			return;
		}

		// Quick place at playhead: 1, 2, 3
		if (['1', '2', '3'].includes(e.key)) {
			const lane = (parseInt(e.key) - 1) as Lane;
			const t = snapToGrid(playing ? currentPlayheadTime() : scrollOffset);
			if (t >= 0) {
				const existingIdx = findNoteAt(t, lane);
				pushUndo();
				if (existingIdx >= 0) {
					notes = notes.filter((_, i) => i !== existingIdx);
				} else {
					notes = [...notes, { t: roundTime(t), lane }];
					sortNotes();
				}
			}
		}
	}

	function copySelection() {
		const lo = Math.min(selectionStartTime, selectionEndTime);
		const hi = Math.max(selectionStartTime, selectionEndTime);
		if (hi - lo < 0.01) return;
		clipboard = notes
			.filter((n) => n.t >= lo && n.t <= hi)
			.map((n) => ({ ...n, t: roundTime(n.t - lo) }));
	}

	function pasteAtScroll() {
		if (clipboard.length === 0) return;
		pushUndo();
		const offset = playing ? currentPlayheadTime() : scrollOffset;
		const pasted = clipboard.map((n) => ({ ...n, t: roundTime(n.t + offset) }));
		notes = [...notes, ...pasted];
		sortNotes();
	}

	function deleteSelected() {
		const lo = Math.min(selectionStartTime, selectionEndTime);
		const hi = Math.max(selectionStartTime, selectionEndTime);
		if (hi - lo < 0.01) return;
		pushUndo();
		notes = notes.filter((n) => n.t < lo || n.t > hi);
	}

	// --- Save / Publish ---
	function saveDraft() {
		const draft = { songId, difficulty, notes, scrollOffset };
		localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
	}

	function loadDraft() {
		try {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (!raw) return;
			const draft = JSON.parse(raw);
			if (draft.songId === songId) {
				notes = draft.notes ?? [];
				difficulty = draft.difficulty ?? 'normal';
				scrollOffset = draft.scrollOffset ?? 0;
			}
		} catch { /* ignore */ }
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

		localStorage.removeItem(DRAFT_KEY);
		const chart = await res.json();
		goto(`/play?chart=${chart.id}`);
	}

	// --- Export / Import ---
	function exportJSON() {
		const data = { songId, difficulty, bpm, notes };
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${songTitle || 'chart'}-${difficulty}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function importJSON() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				const data = JSON.parse(text);
				if (!Array.isArray(data.notes)) {
					error = 'Invalid chart JSON: missing notes array';
					return;
				}
				pushUndo();
				notes = data.notes;
				if (data.difficulty) difficulty = data.difficulty;
				sortNotes();
			} catch {
				error = 'Failed to parse JSON file';
			}
		};
		input.click();
	}

	// --- Draw loop ---
	function drawLoop() {
		if (!canvas) { animFrameId = requestAnimationFrame(drawLoop); return; }
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

		// Waveform
		if (waveformData) {
			const waveW = LANE_WIDTH * 3;
			ctx.save();
			ctx.globalAlpha = 0.15;
			ctx.fillStyle = '#4488ff';
			for (let px = 0; px < h - HEADER_H; px++) {
				const t = scrollOffset + px / PX_PER_SEC;
				const idx = Math.floor(t * PX_PER_SEC);
				if (idx < 0 || idx >= waveformData.length) continue;
				const amp = waveformData[idx];
				const barW = amp * waveW * 0.5;
				const cy = HEADER_H + px;
				ctx.fillRect(laneStartX + waveW / 2 - barW, cy, barW * 2, 1);
			}
			ctx.restore();
		}

		// Selection highlight
		const selLo = Math.min(selectionStartTime, selectionEndTime);
		const selHi = Math.max(selectionStartTime, selectionEndTime);
		if (selHi - selLo > 0.01) {
			const sy1 = Math.max(HEADER_H, timeToY(selLo));
			const sy2 = Math.min(h, timeToY(selHi));
			if (sy2 > sy1) {
				ctx.fillStyle = '#ffffff10';
				ctx.fillRect(laneStartX, sy1, LANE_WIDTH * 3, sy2 - sy1);
				ctx.strokeStyle = '#ffffff30';
				ctx.lineWidth = 1;
				ctx.strokeRect(laneStartX, sy1, LANE_WIDTH * 3, sy2 - sy1);
			}
		}

		// Lane borders
		for (let i = 0; i <= 3; i++) {
			ctx.strokeStyle = '#222';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(laneStartX + i * LANE_WIDTH, HEADER_H);
			ctx.lineTo(laneStartX + i * LANE_WIDTH, h);
			ctx.stroke();
		}

		// Beat grid with subdivisions
		const beatInterval = 60 / bpm;
		const subDiv = subdivision / 4;
		const gridSize = beatInterval / subDiv;
		const startGrid = Math.floor(scrollOffset / gridSize);
		const endGrid = startGrid + Math.ceil((h - HEADER_H) / PX_PER_SEC / gridSize) + 2;

		for (let g = startGrid; g < endGrid; g++) {
			const t = g * gridSize;
			const y = timeToY(t);
			if (y < HEADER_H || y > h) continue;

			const beatNum = g / subDiv;
			const isMeasure = Math.abs(beatNum - Math.round(beatNum)) < 0.001 && Math.round(beatNum) % 4 === 0;
			const isBeat = Math.abs(beatNum - Math.round(beatNum)) < 0.001;

			if (isMeasure) {
				ctx.strokeStyle = '#444';
				ctx.lineWidth = 1.5;
			} else if (isBeat) {
				ctx.strokeStyle = '#2a2a2a';
				ctx.lineWidth = 1;
			} else {
				ctx.strokeStyle = '#181818';
				ctx.lineWidth = 0.5;
			}

			ctx.beginPath();
			ctx.moveTo(laneStartX, y);
			ctx.lineTo(laneStartX + LANE_WIDTH * 3, y);
			ctx.stroke();

			if (isMeasure) {
				ctx.fillStyle = '#555';
				ctx.font = '11px monospace';
				ctx.textAlign = 'right';
				ctx.textBaseline = 'middle';
				ctx.fillText(`${t.toFixed(1)}s`, laneStartX - 8, y);
			}
		}

		// Lane header labels
		ctx.fillStyle = '#111';
		ctx.fillRect(0, 0, w, HEADER_H);
		ctx.strokeStyle = '#222';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, HEADER_H);
		ctx.lineTo(w, HEADER_H);
		ctx.stroke();

		const labels = ['A', 'S', 'D'];
		for (let i = 0; i < 3; i++) {
			ctx.fillStyle = LANE_COLORS[i];
			ctx.font = 'bold 16px monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(labels[i], laneStartX + i * LANE_WIDTH + LANE_WIDTH / 2, HEADER_H / 2);
		}

		// Notes
		for (const note of notes) {
			const y = timeToY(note.t);

			if (note.duration && note.duration > 0) {
				// Hold note: colored bar
				const endY = timeToY(note.t + note.duration);
				const topY = Math.min(y, endY);
				const botY = Math.max(y, endY);
				if (botY < HEADER_H - 20 || topY > h + 20) continue;

				const cx = laneStartX + note.lane * LANE_WIDTH + LANE_WIDTH / 2;
				const barW = LANE_WIDTH * 0.5;

				// Hold bar body
				ctx.fillStyle = LANE_COLORS_DIM[note.lane];
				ctx.fillRect(cx - barW / 2, topY, barW, botY - topY);

				// Hold bar border
				ctx.strokeStyle = LANE_COLORS[note.lane];
				ctx.lineWidth = 2;
				ctx.strokeRect(cx - barW / 2, topY, barW, botY - topY);

				// Head circle
				ctx.beginPath();
				ctx.arc(cx, y, 12, 0, Math.PI * 2);
				ctx.fillStyle = LANE_COLORS[note.lane];
				ctx.fill();
				ctx.strokeStyle = '#fff';
				ctx.lineWidth = 2;
				ctx.stroke();
			} else {
				// Tap note
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
		}

		// Drag preview for hold note
		if (isDragging && Math.abs(dragCurrentY - dragStartY) > HOLD_THRESHOLD_PX) {
			const startY = timeToY(dragStartTime);
			const topY = Math.min(startY, dragCurrentY);
			const botY = Math.max(startY, dragCurrentY);
			const cx = laneStartX + dragLane * LANE_WIDTH + LANE_WIDTH / 2;
			const barW = LANE_WIDTH * 0.5;

			ctx.save();
			ctx.globalAlpha = 0.5;
			ctx.fillStyle = LANE_COLORS_DIM[dragLane];
			ctx.fillRect(cx - barW / 2, topY, barW, botY - topY);
			ctx.strokeStyle = LANE_COLORS[dragLane];
			ctx.lineWidth = 2;
			ctx.strokeRect(cx - barW / 2, topY, barW, botY - topY);
			ctx.beginPath();
			ctx.arc(cx, startY, 12, 0, Math.PI * 2);
			ctx.fillStyle = LANE_COLORS[dragLane];
			ctx.fill();
			ctx.restore();
		}

		// Playhead
		if (playing) {
			const pTime = currentPlayheadTime();
			const playY = timeToY(pTime);

			// Auto-scroll to keep playhead visible
			if (playY > h * 0.8) {
				scrollOffset = pTime - (h * 0.3 - HEADER_H) / PX_PER_SEC;
			}

			if (playY >= HEADER_H && playY <= h) {
				ctx.strokeStyle = '#ffdd00';
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(laneStartX - 20, playY);
				ctx.lineTo(laneStartX + LANE_WIDTH * 3 + 20, playY);
				ctx.stroke();

				// Playhead triangle
				ctx.fillStyle = '#ffdd00';
				ctx.beginPath();
				ctx.moveTo(laneStartX - 20, playY - 6);
				ctx.lineTo(laneStartX - 20, playY + 6);
				ctx.lineTo(laneStartX - 10, playY);
				ctx.closePath();
				ctx.fill();
			}

			// Click sound on notes
			for (let i = 0; i < notes.length; i++) {
				if (i <= lastClickedNoteIndex) continue;
				if (notes[i].t <= pTime) {
					playClick();
					lastClickedNoteIndex = i;
				} else {
					break;
				}
			}
		}

		animFrameId = requestAnimationFrame(drawLoop);
	}

	// --- Lifecycle ---
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
			songDuration = song.durationMs / 1000;
			audioUrl = song.audioUrl;
		} else {
			error = 'Song not found';
			loading = false;
			return;
		}

		loadDraft();
		loading = false;
		animFrameId = requestAnimationFrame(drawLoop);

		if (audioUrl) {
			await initAudio(audioUrl);
		}
	});

	onDestroy(() => {
		if (animFrameId) cancelAnimationFrame(animFrameId);
		stopPlayback();
		if (audioContext) audioContext.close();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="editor-page">
	{#if loading}
		<p class="hint">Loading...</p>
	{:else if !$session.data}
		<h1 class="hint">LOGIN REQUIRED</h1>
		<a href="/auth" class="btn">LOGIN</a>
	{:else}
		<!-- Toolbar -->
		<div class="toolbar">
			<div class="toolbar-left">
				<div class="song-info">
					<span class="song-title">{songTitle}</span>
					<span class="song-meta">{songArtist} &mdash; {bpm} BPM</span>
				</div>
			</div>

			<div class="toolbar-center">
				<div class="tool-group">
					<span class="tool-label">Grid</span>
					<button
						class="tool-btn"
						class:active={subdivision === 4}
						onclick={() => subdivision = 4}
					>1/4</button>
					<button
						class="tool-btn"
						class:active={subdivision === 8}
						onclick={() => subdivision = 8}
					>1/8</button>
					<button
						class="tool-btn"
						class:active={subdivision === 16}
						onclick={() => subdivision = 16}
					>1/16</button>
				</div>

				<div class="tool-group">
					<span class="tool-label">Speed</span>
					<button
						class="tool-btn"
						class:active={playbackSpeed === 0.5}
						onclick={() => playbackSpeed = 0.5}
					>0.5x</button>
					<button
						class="tool-btn"
						class:active={playbackSpeed === 1.0}
						onclick={() => playbackSpeed = 1.0}
					>1.0x</button>
				</div>

				<button class="tool-btn play-btn" onclick={togglePlayback}>
					{playing ? '⏸ PAUSE' : '▶ PLAY'}
				</button>

				<div class="tool-group">
					<button
						class="tool-btn"
						onclick={undo}
						disabled={undoStack.length === 0}
						title="Undo (Ctrl+Z)"
					>↩ Undo</button>
					<button
						class="tool-btn"
						onclick={redo}
						disabled={redoStack.length === 0}
						title="Redo (Ctrl+Shift+Z)"
					>↪ Redo</button>
				</div>
			</div>

			<div class="toolbar-right">
				<span class="note-count">{notes.length} notes</span>

				<select bind:value={difficulty}>
					<option value="easy">Easy</option>
					<option value="normal">Normal</option>
					<option value="hard">Hard</option>
				</select>

				<button class="tool-btn" onclick={saveDraft} title="Save draft to localStorage">
					Save Draft
				</button>
				<button class="publish-btn" onclick={publishChart} disabled={saving}>
					{saving ? 'SAVING...' : 'PUBLISH'}
				</button>
				<button class="tool-btn" onclick={exportJSON} title="Export chart as JSON">
					Export
				</button>
				<button class="tool-btn" onclick={importJSON} title="Import chart from JSON">
					Import
				</button>
			</div>
		</div>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<div class="editor-body">
			<!-- Instructions panel -->
			<div class="instructions">
				<h3 class="instructions-title">Keyboard Shortcuts</h3>
				<div class="shortcut"><kbd>Space</kbd> Play / Pause</div>
				<div class="shortcut"><kbd>Ctrl+Z</kbd> Undo</div>
				<div class="shortcut"><kbd>Ctrl+Shift+Z</kbd> Redo</div>
				<div class="shortcut"><kbd>Ctrl+C</kbd> Copy selection</div>
				<div class="shortcut"><kbd>Ctrl+V</kbd> Paste at scroll</div>
				<div class="shortcut"><kbd>Delete</kbd> Remove selected</div>
				<div class="shortcut"><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> Quick place note</div>

				<h3 class="instructions-title">Mouse</h3>
				<div class="shortcut">Click lane: place/remove tap note</div>
				<div class="shortcut">Drag in lane: create hold note</div>
				<div class="shortcut">Drag outside lanes: select range</div>
				<div class="shortcut">Scroll: navigate timeline</div>

				<h3 class="instructions-title">Legend</h3>
				<div class="legend-row">
					<span class="legend-dot" style="background:#ff4466"></span> Lane A (1)
				</div>
				<div class="legend-row">
					<span class="legend-dot" style="background:#44ff66"></span> Lane S (2)
				</div>
				<div class="legend-row">
					<span class="legend-dot" style="background:#4488ff"></span> Lane D (3)
				</div>
			</div>

			<!-- Canvas -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<canvas
				bind:this={canvas}
				class="editor-canvas"
				onmousedown={handleMouseDown}
				onmousemove={handleMouseMove}
				onmouseup={handleMouseUp}
				onwheel={handleWheel}
			></canvas>
		</div>
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
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		user-select: none;
	}

	/* --- Toolbar --- */
	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 16px;
		border-bottom: 1px solid #222;
		flex-shrink: 0;
		gap: 12px;
		flex-wrap: wrap;
		background: #0d0d14;
	}

	.toolbar-left,
	.toolbar-center,
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.toolbar-center {
		flex-wrap: wrap;
		justify-content: center;
	}

	.song-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.song-title {
		font-size: 14px;
		font-weight: bold;
		color: #eee;
	}

	.song-meta {
		font-size: 11px;
		color: #666;
	}

	.tool-group {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 8px;
		border-right: 1px solid #222;
	}

	.tool-group:last-child {
		border-right: none;
	}

	.tool-label {
		font-size: 10px;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-right: 4px;
	}

	.note-count {
		font-size: 12px;
		color: #666;
		padding: 0 8px;
	}

	select {
		background: #111;
		border: 1px solid #333;
		color: #fff;
		font-family: monospace;
		padding: 5px 8px;
		font-size: 12px;
		border-radius: 3px;
	}

	.tool-btn {
		font-family: monospace;
		font-size: 11px;
		padding: 5px 10px;
		background: transparent;
		border: 1px solid #333;
		color: #888;
		cursor: pointer;
		border-radius: 3px;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.tool-btn:hover {
		background: #ffffff10;
		color: #ccc;
		border-color: #555;
	}

	.tool-btn.active {
		background: #4488ff20;
		border-color: #4488ff;
		color: #4488ff;
	}

	.tool-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.play-btn {
		border-color: #ffdd00;
		color: #ffdd00;
		font-size: 12px;
		padding: 5px 14px;
	}

	.play-btn:hover {
		background: #ffdd0020;
	}

	.publish-btn {
		font-family: monospace;
		font-size: 11px;
		padding: 5px 12px;
		background: transparent;
		border: 1px solid #44ff66;
		color: #44ff66;
		cursor: pointer;
		border-radius: 3px;
		transition: all 0.15s;
	}

	.publish-btn:hover {
		background: #44ff6620;
	}

	.publish-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.error {
		color: #ff4444;
		font-size: 12px;
		padding: 4px 16px;
		margin: 0;
		background: #ff444410;
		border-bottom: 1px solid #ff444430;
	}

	/* --- Editor body --- */
	.editor-body {
		flex: 1;
		display: flex;
		overflow: hidden;
	}

	.instructions {
		width: 200px;
		padding: 16px;
		border-right: 1px solid #1a1a1a;
		flex-shrink: 0;
		overflow-y: auto;
		background: #0c0c12;
	}

	.instructions-title {
		font-size: 11px;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin: 16px 0 8px;
		padding-bottom: 4px;
		border-bottom: 1px solid #1a1a1a;
	}

	.instructions-title:first-child {
		margin-top: 0;
	}

	.shortcut {
		font-size: 11px;
		color: #555;
		margin: 0 0 6px;
		line-height: 1.5;
	}

	kbd {
		display: inline-block;
		background: #1a1a22;
		border: 1px solid #333;
		border-radius: 3px;
		padding: 1px 5px;
		font-family: monospace;
		font-size: 10px;
		color: #999;
	}

	.legend-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		color: #555;
		margin: 0 0 4px;
	}

	.legend-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.editor-canvas {
		flex: 1;
		display: block;
		cursor: crosshair;
	}

	/* --- Misc --- */
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
		color: #444;
		font-size: 12px;
		text-decoration: none;
		padding: 8px 16px;
		flex-shrink: 0;
		border-top: 1px solid #1a1a1a;
	}

	.back-link:hover {
		color: #888;
	}
</style>
