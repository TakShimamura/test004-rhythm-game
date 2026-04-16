<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client.js';
	import { parseChartFile, detectFormat } from '$lib/game/chart-import.js';
	import { validateChart, type ValidationWarning } from '$lib/game/chart-validator.js';
	import type { Note } from '$lib/game/types.js';

	const session = authClient.useSession();

	// Parsed chart state
	let parsedNotes: Note[] = $state([]);
	let parsedBpm = $state(0);
	let parsedTitle = $state('');
	let parsedArtist = $state('');
	let parsedDifficulty = $state('');
	let warnings: ValidationWarning[] = $state([]);
	let parseError = $state('');
	let parsed = $state(false);

	// Song selection
	let songs: Array<{ id: string; title: string; artist: string; bpm: number }> = $state([]);
	let selectedSongId = $state('');
	let publishing = $state(false);
	let publishError = $state('');
	let difficulty = $state<'easy' | 'normal' | 'hard'>('normal');

	onMount(async () => {
		try {
			const res = await fetch('/api/songs');
			if (res.ok) songs = await res.json();
		} catch {
			// Songs list is optional for import
		}
	});

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		parseError = '';
		parsed = false;

		const reader = new FileReader();
		reader.onload = () => {
			try {
				const content = reader.result as string;
				const result = parseChartFile(file.name, content);
				parsedNotes = result.notes;
				parsedBpm = result.bpm;
				parsedTitle = result.title ?? '';
				parsedArtist = result.artist ?? '';
				parsedDifficulty = result.difficulty ?? '';
				warnings = validateChart(result.notes, result.bpm);
				parsed = true;
			} catch (err) {
				parseError = err instanceof Error ? err.message : 'Failed to parse file';
			}
		};
		reader.readAsText(file);
	}

	function chartDuration(): string {
		if (parsedNotes.length === 0) return '0s';
		const last = parsedNotes[parsedNotes.length - 1];
		const dur = last.t + (last.duration ?? 0);
		return `${dur.toFixed(1)}s`;
	}

	function editInEditor() {
		// Save to localStorage so the editor can load it
		localStorage.setItem('imported-chart', JSON.stringify({
			notes: parsedNotes,
			bpm: parsedBpm,
			difficulty,
		}));
		goto('/editor/new');
	}

	async function publish() {
		if (!selectedSongId) {
			publishError = 'Please select a song first';
			return;
		}
		publishing = true;
		publishError = '';

		try {
			const res = await fetch('/api/charts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					songId: selectedSongId,
					difficulty,
					notes: parsedNotes,
				}),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				publishError = data.message ?? 'Publish failed';
				return;
			}

			const chart = await res.json();
			goto(`/editor/${chart.id}`);
		} finally {
			publishing = false;
		}
	}

	function warningColor(w: ValidationWarning): string {
		if (w.type === 'no_notes' || w.type === 'impossible_pattern') return '#ff4444';
		return '#ffaa22';
	}

	let hasErrors = $derived(warnings.some(w => w.type === 'no_notes' || w.type === 'impossible_pattern'));
</script>

<div class="import-page">
	{#if !$session.data}
		<h1>LOGIN REQUIRED</h1>
		<p class="hint">You must be logged in to import charts.</p>
		<a href="/auth" class="btn">LOGIN / SIGN UP</a>
	{:else}
		<h1>IMPORT CHART</h1>
		<p class="hint">Upload an .osu, .sm, or .json chart file</p>

		<div class="upload-area">
			<input
				type="file"
				accept=".osu,.sm,.json"
				onchange={handleFileChange}
			/>
		</div>

		{#if parseError}
			<p class="error">{parseError}</p>
		{/if}

		{#if parsed}
			<div class="preview">
				<h2>CHART PREVIEW</h2>

				{#if parsedTitle}
					<div class="meta-row">
						<span class="label">Title</span>
						<span class="value">{parsedTitle}</span>
					</div>
				{/if}
				{#if parsedArtist}
					<div class="meta-row">
						<span class="label">Artist</span>
						<span class="value">{parsedArtist}</span>
					</div>
				{/if}
				<div class="meta-row">
					<span class="label">BPM</span>
					<span class="value">{parsedBpm}</span>
				</div>
				<div class="meta-row">
					<span class="label">Notes</span>
					<span class="value">{parsedNotes.length}</span>
				</div>
				<div class="meta-row">
					<span class="label">Duration</span>
					<span class="value">{chartDuration()}</span>
				</div>

				{#if warnings.length > 0}
					<div class="warnings">
						<h3>VALIDATION</h3>
						{#each warnings as w}
							<div class="warning" style="border-color: {warningColor(w)}">
								<span class="warning-type" style="color: {warningColor(w)}">{w.type.replace(/_/g, ' ').toUpperCase()}</span>
								<span class="warning-msg">{w.message}</span>
							</div>
						{/each}
					</div>
				{/if}

				<div class="controls">
					<label>
						<span>Difficulty</span>
						<select bind:value={difficulty}>
							<option value="easy">Easy</option>
							<option value="normal">Normal</option>
							<option value="hard">Hard</option>
						</select>
					</label>
				</div>

				<div class="actions">
					<button class="btn edit-btn" onclick={editInEditor}>
						EDIT IN EDITOR
					</button>

					<div class="publish-section">
						<label>
							<span>Link to Song</span>
							<select bind:value={selectedSongId}>
								<option value="">-- Select a song --</option>
								{#each songs as song}
									<option value={song.id}>{song.title} — {song.artist}</option>
								{/each}
							</select>
						</label>
						{#if publishError}
							<p class="error">{publishError}</p>
						{/if}
						<button
							class="btn publish-btn"
							onclick={publish}
							disabled={publishing || !selectedSongId || hasErrors}
						>
							{publishing ? 'PUBLISHING...' : 'PUBLISH'}
						</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}

	<a href="/songs" class="back-link">&larr; Back to Songs</a>
</div>

<style>
	.import-page {
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
		font-size: 20px;
		letter-spacing: 4px;
		margin: 0 0 12px;
		color: #44ff66;
	}

	h3 {
		font-size: 14px;
		letter-spacing: 2px;
		margin: 12px 0 8px;
		color: #888;
	}

	.hint {
		color: #555;
		font-size: 14px;
		margin: 0;
	}

	.upload-area {
		padding: 24px;
		border: 2px dashed #333;
		border-radius: 4px;
	}

	.upload-area input[type="file"] {
		font-family: monospace;
		font-size: 13px;
		color: #888;
	}

	.preview {
		width: 400px;
		max-width: 100%;
	}

	.meta-row {
		display: flex;
		justify-content: space-between;
		padding: 6px 0;
		border-bottom: 1px solid #1a1a2a;
	}

	.meta-row .label {
		color: #666;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.meta-row .value {
		color: #ddd;
		font-size: 14px;
	}

	.warnings {
		margin-top: 12px;
	}

	.warning {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 12px;
		margin: 6px 0;
		border-left: 3px solid #ffaa22;
		background: #111;
	}

	.warning-type {
		font-size: 11px;
		font-weight: bold;
		letter-spacing: 1px;
	}

	.warning-msg {
		font-size: 13px;
		color: #aaa;
	}

	.controls {
		margin-top: 16px;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.controls label span {
		font-size: 12px;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	select {
		background: #111;
		border: 1px solid #333;
		color: #fff;
		padding: 8px 12px;
		font-family: monospace;
		font-size: 14px;
	}

	select:focus {
		outline: none;
		border-color: #4488ff;
	}

	.actions {
		margin-top: 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.btn {
		font-family: monospace;
		font-size: 14px;
		padding: 12px 24px;
		background: transparent;
		cursor: pointer;
		letter-spacing: 2px;
		text-decoration: none;
		text-align: center;
		display: block;
	}

	.edit-btn {
		border: 2px solid #4488ff;
		color: #4488ff;
	}

	.edit-btn:hover { background: #4488ff20; }

	.publish-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.publish-section label {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.publish-section label span {
		font-size: 12px;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.publish-btn {
		border: 2px solid #44ff66;
		color: #44ff66;
	}

	.publish-btn:hover { background: #44ff6620; }
	.publish-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.error {
		color: #ff4444;
		font-size: 13px;
		margin: 0;
	}

	.back-link {
		font-family: monospace;
		color: #555;
		font-size: 14px;
		text-decoration: none;
		margin-top: 24px;
	}

	.back-link:hover { color: #888; }
</style>
