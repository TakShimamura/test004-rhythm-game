<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { authClient } from '$lib/auth-client.js';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { createAudioPreview } from '$lib/game/audio-preview.js';
	import { getDifficultyColor } from '$lib/game/difficulty-calc.js';

	type SongChart = { id: string; difficulty: string; stars?: number };
	type Song = {
		id: string;
		title: string;
		artist: string;
		bpm: number;
		durationMs: number;
		audioUrl: string;
		style?: string;
		charts: SongChart[];
	};

	type ChartRating = { average: number | null; count: number };

	let songs: Song[] = $state([]);
	let loading = $state(true);
	let search = $state('');
	let ratings: Record<string, ChartRating> = $state({});
	let commentCounts: Record<string, number> = $state({});
	let previewingSongId: string | null = $state(null);
	const session = authClient.useSession();

	const preview = createAudioPreview();

	function handleSongHover(song: Song) {
		if (song.audioUrl === '__metronome__') return;
		previewingSongId = song.id;
		preview.play(
			song.audioUrl,
			song.bpm,
			song.style as 'electro' | 'dnb' | 'chill' | undefined,
		);
	}

	function handleSongLeave() {
		preview.stop();
		previewingSongId = null;
	}

	onDestroy(() => {
		preview.stop();
	});

	onMount(async () => {
		const listRes = await fetch('/api/songs');
		if (!listRes.ok) { loading = false; return; }
		const songList = await listRes.json();

		const detailed = await Promise.all(
			songList.map(async (s: { id: string }) => {
				const res = await fetch(`/api/songs/${s.id}`);
				return res.ok ? res.json() : null;
			}),
		);
		songs = detailed.filter(Boolean);

		// Fetch ratings for all charts
		const allCharts = songs.flatMap((s) => s.charts);
		const ratingResults = await Promise.all(
			allCharts.map(async (c) => {
				const res = await fetch(`/api/charts/${c.id}/rating`);
				if (!res.ok) return null;
				const data = await res.json();
				return { id: c.id, ...data };
			}),
		);
		for (const r of ratingResults) {
			if (r) ratings[r.id] = { average: r.average, count: r.count };
		}

		// Fetch comment counts for all charts
		const commentResults = await Promise.all(
			allCharts.map(async (c) => {
				const res = await fetch(`/api/charts/${c.id}/comments`);
				if (!res.ok) return null;
				const data = await res.json();
				return { id: c.id, count: Array.isArray(data) ? data.length : 0 };
			}),
		);
		for (const r of commentResults) {
			if (r) commentCounts[r.id] = r.count;
		}

		loading = false;
	});


	let filtered = $derived(
		search
			? songs.filter(
					(s) =>
						s.title.toLowerCase().includes(search.toLowerCase()) ||
						s.artist.toLowerCase().includes(search.toLowerCase()),
				)
			: songs,
	);

	function formatDuration(ms: number) {
		const s = Math.floor(ms / 1000);
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}

	/** Approximate star rating from difficulty label */
	function approxStars(difficulty: string, stars?: number): number {
		if (stars !== undefined) return stars;
		switch (difficulty.toLowerCase()) {
			case 'easy': return 3;
			case 'normal': return 5.5;
			case 'hard': return 8;
			default: return 5;
		}
	}
</script>

<div class="songs-page" style="position: relative;">
	<Tooltip key="songs-hint" text="Pick a song and difficulty to play!" position="top" />
	<h1>SONGS</h1>

	<div class="controls">
		<input type="text" placeholder="Search songs..." bind:value={search} class="search" />
		{#if $session.data}
			<a href="/songs/upload" class="upload-btn">UPLOAD SONG</a>
		{/if}
	</div>

	{#if loading}
		<p class="hint">Loading songs...</p>
	{:else if filtered.length === 0}
		<p class="hint">No songs found</p>
	{:else}
		<div class="song-list">
			{#each filtered as song}
				<div
					class="song-card"
					onmouseenter={() => handleSongHover(song)}
					onmouseleave={() => handleSongLeave()}
					role="listitem"
				>
					<div class="song-info">
						<a href="/stats/song/{song.id}" class="song-title-link">{song.title}</a>
						<span class="song-artist">{song.artist}</span>
						{#if previewingSongId === song.id}
							<span class="preview-badge">PREVIEW</span>
						{/if}
					</div>
					<div class="song-meta">
						<span class="bpm">{song.bpm} BPM</span>
						<span class="duration">{formatDuration(song.durationMs)}</span>
					</div>
					<div class="chart-links">
						{#each song.charts as chart}
							{@const stars = approxStars(chart.difficulty, chart.stars)}
							<a href="/play?chart={chart.id}" class="chart-link">
								{chart.difficulty}
								<span class="difficulty-stars" style="color: {getDifficultyColor(stars)}">&#9733; {stars.toFixed(1)}</span>
								{#if ratings[chart.id]?.average !== undefined && ratings[chart.id]?.average !== null}
									<span class="chart-rating" title="{ratings[chart.id].average?.toFixed(1)} ({ratings[chart.id].count} ratings)">
										{ratings[chart.id].average?.toFixed(1)} &#9733;
									</span>
								{/if}
								{#if commentCounts[chart.id] > 0}
									<span class="comment-count" title="{commentCounts[chart.id]} comments">
										{commentCounts[chart.id]}
									</span>
								{/if}
							</a>
						{/each}
						{#if $session.data}
							<a href="/editor/new?songId={song.id}" class="chart-link editor-link">+ chart</a>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<a href="/" class="back-link">&larr; Back to Home</a>
</div>

<style>
	.songs-page {
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

	.controls {
		display: flex;
		gap: 12px;
		align-items: center;
		width: 100%;
		max-width: 500px;
	}

	.search {
		flex: 1;
		background: #111;
		border: 1px solid #333;
		color: #fff;
		padding: 10px 14px;
		font-family: monospace;
		font-size: 14px;
	}

	.search:focus {
		outline: none;
		border-color: #4488ff;
	}

	.upload-btn {
		font-family: monospace;
		font-size: 13px;
		padding: 10px 16px;
		background: transparent;
		border: 1px solid #44ff66;
		color: #44ff66;
		text-decoration: none;
		letter-spacing: 1px;
		white-space: nowrap;
	}

	.upload-btn:hover { background: #44ff6620; }

	.song-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
		max-width: 500px;
	}

	.song-card {
		display: flex;
		flex-direction: column;
		padding: 14px 16px;
		background: #111;
		border: 1px solid #222;
		color: #fff;
	}

	.song-card :global(.song-info + .song-meta) {
		margin-top: 4px;
	}

	.chart-links {
		display: flex;
		gap: 6px;
		margin-top: 8px;
	}

	.chart-link {
		font-family: monospace;
		font-size: 12px;
		padding: 4px 10px;
		background: #1a1a1a;
		border: 1px solid #333;
		color: #4488ff;
		text-decoration: none;
		text-transform: uppercase;
	}

	.chart-link:hover {
		border-color: #4488ff;
		background: #4488ff20;
	}

	.editor-link {
		color: #44ff66;
		border-color: #44ff6640;
	}

	.editor-link:hover {
		border-color: #44ff66;
		background: #44ff6620;
	}

	.song-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.song-title-link {
		font-size: 15px;
		font-weight: bold;
		color: #ddd;
		text-decoration: none;
		transition: color 0.2s;
	}

	.song-title-link:hover {
		color: #4488ff;
	}

	.song-artist {
		font-size: 12px;
		color: #888;
	}

	.song-meta {
		display: flex;
		gap: 12px;
		font-size: 12px;
		color: #666;
	}

	.hint {
		color: #555;
		font-size: 14px;
	}

	.back-link {
		font-family: monospace;
		color: #555;
		font-size: 14px;
		text-decoration: none;
	}

	.back-link:hover { color: #888; }

	.difficulty-stars {
		font-size: 10px;
		margin-left: 4px;
		font-weight: bold;
	}

	.chart-rating {
		color: #ffdd00;
		font-size: 10px;
		margin-left: 4px;
	}

	.comment-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 9px;
		min-width: 16px;
		height: 14px;
		padding: 0 3px;
		margin-left: 3px;
		background: #4488ff25;
		border: 1px solid #4488ff55;
		color: #4488ff;
		border-radius: 7px;
	}

	.preview-badge {
		display: inline-block;
		font-size: 9px;
		letter-spacing: 2px;
		color: #44ff66;
		background: #44ff6618;
		border: 1px solid #44ff6644;
		padding: 1px 6px;
		margin-left: 6px;
		animation: previewPulse 1s ease-in-out infinite;
	}

	@keyframes previewPulse {
		0%, 100% { opacity: 0.7; }
		50% { opacity: 1; }
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		h1 {
			font-size: 28px;
		}

		.controls {
			max-width: 100%;
		}

		.song-list {
			max-width: 100%;
		}

		.song-card {
			padding: 12px;
		}

		.chart-links {
			flex-wrap: wrap;
		}
	}
</style>
