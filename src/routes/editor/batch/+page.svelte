<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client.js';
	import { batchGenerateCharts } from '$lib/game/batch-generate.js';
	import { validateChart, type ValidationWarning } from '$lib/game/chart-validator.js';
	import type { Note, MusicStyle, Difficulty } from '$lib/game/types.js';

	const session = authClient.useSession();

	// Song list
	let songs: Array<{ id: string; title: string; artist: string; bpm: number; audioUrl?: string }> = $state([]);
	let selectedSongId = $state('');
	let selectedSong = $derived(songs.find(s => s.id === selectedSongId));

	// Upload state
	let uploadedFile: File | null = $state(null);
	let uploadBpm = $state(120);

	// Generation state
	type GenPhase = 'idle' | 'loading' | 'generating' | 'done';
	let phase = $state<GenPhase>('idle');
	let error = $state('');
	let style = $state<MusicStyle | ''>('');

	// Results
	let results: Record<Difficulty, { notes: Note[]; warnings: ValidationWarning[] }> = $state({
		easy: { notes: [], warnings: [] },
		normal: { notes: [], warnings: [] },
		hard: { notes: [], warnings: [] },
	});
	let publishStatus: Record<Difficulty, 'idle' | 'publishing' | 'done' | 'error'> = $state({
		easy: 'idle',
		normal: 'idle',
		hard: 'idle',
	});

	onMount(async () => {
		// Pre-select song from URL param if provided
		const urlSongId = page.url.searchParams.get('songId');

		try {
			const res = await fetch('/api/songs');
			if (res.ok) {
				const data = await res.json();
				songs = data;
			}
		} catch {
			// continue
		}

		if (urlSongId) selectedSongId = urlSongId;
	});

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		uploadedFile = input.files?.[0] ?? null;
	}

	async function loadAudioBuffer(): Promise<AudioBuffer> {
		let arrayBuffer: ArrayBuffer;

		if (uploadedFile) {
			arrayBuffer = await uploadedFile.arrayBuffer();
		} else if (selectedSong) {
			// Fetch the song's audio URL
			const songRes = await fetch(`/api/songs/${selectedSongId}`);
			const songData = await songRes.json();
			const audioRes = await fetch(songData.audioUrl);
			arrayBuffer = await audioRes.arrayBuffer();
		} else {
			throw new Error('No audio source selected');
		}

		const audioCtx = new AudioContext();
		return audioCtx.decodeAudioData(arrayBuffer);
	}

	async function generateAll() {
		error = '';
		phase = 'loading';

		try {
			const audioBuffer = await loadAudioBuffer();
			phase = 'generating';

			const bpm = selectedSong?.bpm ?? uploadBpm;
			const musicStyle = style || undefined;
			const charts = batchGenerateCharts(audioBuffer, bpm, musicStyle);

			const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
			for (const diff of difficulties) {
				const notes = charts[diff];
				results[diff] = {
					notes,
					warnings: validateChart(notes, bpm),
				};
			}

			phase = 'done';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Generation failed';
			phase = 'idle';
		}
	}

	async function publishChart(diff: Difficulty) {
		const songId = selectedSongId;
		if (!songId) {
			error = 'Please select a song to publish to';
			return;
		}

		publishStatus[diff] = 'publishing';

		try {
			const res = await fetch('/api/charts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					songId,
					difficulty: diff,
					notes: results[diff].notes,
				}),
			});

			if (!res.ok) {
				publishStatus[diff] = 'error';
				return;
			}

			publishStatus[diff] = 'done';
		} catch {
			publishStatus[diff] = 'error';
		}
	}

	function difficultyStars(diff: Difficulty): string {
		switch (diff) {
			case 'easy': return '\u2605';
			case 'normal': return '\u2605\u2605';
			case 'hard': return '\u2605\u2605\u2605';
		}
	}

	function warningColor(w: ValidationWarning): string {
		if (w.type === 'no_notes' || w.type === 'impossible_pattern') return '#ff4444';
		return '#ffaa22';
	}

	let canGenerate = $derived(!!selectedSongId || !!uploadedFile);
</script>

<div class="batch-page">
	{#if !$session.data}
		<h1>LOGIN REQUIRED</h1>
		<p class="hint">You must be logged in to generate charts.</p>
		<a href="/auth" class="btn-link">LOGIN / SIGN UP</a>
	{:else}
		<h1>BATCH GENERATE</h1>
		<p class="hint">Generate Easy, Normal, and Hard charts from one audio source</p>

		<div class="source-section">
			<h2>AUDIO SOURCE</h2>

			<label>
				<span>Select existing song</span>
				<select bind:value={selectedSongId}>
					<option value="">-- Choose a song --</option>
					{#each songs as song}
						<option value={song.id}>{song.title} — {song.artist} ({song.bpm} BPM)</option>
					{/each}
				</select>
			</label>

			<div class="divider">OR</div>

			<label>
				<span>Upload audio file</span>
				<input type="file" accept="audio/*" onchange={handleFileChange} />
			</label>

			{#if uploadedFile && !selectedSongId}
				<label>
					<span>BPM</span>
					<input type="number" bind:value={uploadBpm} min="40" max="300" />
				</label>
			{/if}

			<label>
				<span>Style (optional)</span>
				<select bind:value={style}>
					<option value="">Default</option>
					<option value="electro">Electro</option>
					<option value="dnb">Drum & Bass</option>
					<option value="chill">Chill</option>
				</select>
			</label>

			<button
				class="generate-btn"
				onclick={generateAll}
				disabled={!canGenerate || phase === 'loading' || phase === 'generating'}
			>
				{#if phase === 'loading'}
					LOADING AUDIO...
				{:else if phase === 'generating'}
					GENERATING...
				{:else}
					GENERATE ALL
				{/if}
			</button>

			{#if error}
				<p class="error">{error}</p>
			{/if}
		</div>

		{#if phase === 'done'}
			<div class="results">
				{#each (['easy', 'normal', 'hard'] as const) as diff}
					{@const r = results[diff]}
					<div class="diff-card">
						<div class="diff-header">
							<h3>{diff.toUpperCase()}</h3>
							<span class="stars">{difficultyStars(diff)}</span>
						</div>

						<div class="diff-stats">
							<span>{r.notes.length} notes</span>
							{#if r.notes.length > 0}
								<span>{(r.notes[r.notes.length - 1].t).toFixed(1)}s</span>
							{/if}
						</div>

						{#if r.warnings.length > 0}
							<div class="warnings">
								{#each r.warnings as w}
									<div class="warning" style="border-color: {warningColor(w)}">
										<span class="warning-type" style="color: {warningColor(w)}">{w.type.replace(/_/g, ' ').toUpperCase()}</span>
										<span class="warning-msg">{w.message}</span>
									</div>
								{/each}
							</div>
						{/if}

						<button
							class="publish-btn"
							onclick={() => publishChart(diff)}
							disabled={publishStatus[diff] !== 'idle' || !selectedSongId}
						>
							{#if publishStatus[diff] === 'publishing'}
								PUBLISHING...
							{:else if publishStatus[diff] === 'done'}
								PUBLISHED
							{:else if publishStatus[diff] === 'error'}
								FAILED — RETRY
							{:else}
								PUBLISH {diff.toUpperCase()}
							{/if}
						</button>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	<a href="/songs" class="back-link">&larr; Back to Songs</a>
</div>

<style>
	.batch-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 100vh;
		background: #0a0a0f;
		color: #fff;
		padding: 48px 24px;
		gap: 24px;
		font-family: monospace;
	}

	h1 {
		font-size: 36px;
		letter-spacing: 6px;
		margin: 0;
	}

	h2 {
		font-size: 18px;
		letter-spacing: 3px;
		margin: 0 0 16px;
		color: #888;
	}

	h3 {
		font-size: 18px;
		letter-spacing: 2px;
		margin: 0;
	}

	.hint {
		color: #555;
		font-size: 14px;
		margin: 0;
	}

	.source-section {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: 380px;
		max-width: 100%;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	label span {
		font-size: 12px;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	select, input[type="number"] {
		background: #111;
		border: 1px solid #333;
		color: #fff;
		padding: 8px 12px;
		font-family: monospace;
		font-size: 14px;
	}

	select:focus, input:focus {
		outline: none;
		border-color: #4488ff;
	}

	input[type="file"] {
		font-family: monospace;
		font-size: 13px;
		color: #888;
	}

	.divider {
		text-align: center;
		color: #444;
		font-size: 12px;
		letter-spacing: 4px;
		padding: 4px 0;
	}

	.generate-btn {
		font-family: monospace;
		font-size: 16px;
		padding: 14px;
		background: transparent;
		border: 2px solid #ffaa22;
		color: #ffaa22;
		cursor: pointer;
		letter-spacing: 2px;
		margin-top: 8px;
	}

	.generate-btn:hover { background: #ffaa2220; }
	.generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.results {
		display: flex;
		gap: 20px;
		flex-wrap: wrap;
		justify-content: center;
		width: 100%;
		max-width: 900px;
	}

	.diff-card {
		flex: 1;
		min-width: 240px;
		max-width: 280px;
		background: #111;
		border: 1px solid #222;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.diff-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.stars {
		color: #ffaa22;
		font-size: 16px;
	}

	.diff-stats {
		display: flex;
		justify-content: space-between;
		color: #888;
		font-size: 13px;
	}

	.warnings {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.warning {
		padding: 6px 10px;
		border-left: 3px solid #ffaa22;
		background: #0a0a0f;
	}

	.warning-type {
		font-size: 10px;
		font-weight: bold;
		letter-spacing: 1px;
		display: block;
	}

	.warning-msg {
		font-size: 12px;
		color: #888;
	}

	.publish-btn {
		font-family: monospace;
		font-size: 13px;
		padding: 10px;
		background: transparent;
		border: 2px solid #44ff66;
		color: #44ff66;
		cursor: pointer;
		letter-spacing: 2px;
	}

	.publish-btn:hover { background: #44ff6620; }
	.publish-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.error {
		color: #ff4444;
		font-size: 13px;
		margin: 0;
	}

	.btn-link {
		font-family: monospace;
		font-size: 16px;
		padding: 10px 32px;
		background: transparent;
		border: 2px solid #4488ff;
		color: #4488ff;
		text-decoration: none;
		letter-spacing: 2px;
	}

	.btn-link:hover { background: #4488ff20; }

	.back-link {
		font-family: monospace;
		color: #555;
		font-size: 14px;
		text-decoration: none;
		margin-top: 24px;
	}

	.back-link:hover { color: #888; }
</style>
