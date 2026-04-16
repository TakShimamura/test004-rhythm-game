<script lang="ts">
	import { onMount } from 'svelte';
	import { authClient } from '$lib/auth-client.js';

	type SongChart = { id: string; difficulty: string };
	type Song = {
		id: string;
		title: string;
		artist: string;
		bpm: number;
		durationMs: number;
		audioUrl: string;
		charts: SongChart[];
	};

	type ChartRating = { average: number | null; count: number };

	let songs: Song[] = $state([]);
	let loading = $state(true);
	let search = $state('');
	let ratings: Record<string, ChartRating> = $state({});
	const session = authClient.useSession();

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
</script>

<div class="songs-page">
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
				<div class="song-card">
					<div class="song-info">
						<span class="song-title">{song.title}</span>
						<span class="song-artist">{song.artist}</span>
					</div>
					<div class="song-meta">
						<span class="bpm">{song.bpm} BPM</span>
						<span class="duration">{formatDuration(song.durationMs)}</span>
					</div>
					<div class="chart-links">
						{#each song.charts as chart}
							<a href="/play?chart={chart.id}" class="chart-link">
								{chart.difficulty}
								{#if ratings[chart.id]?.average !== undefined && ratings[chart.id]?.average !== null}
									<span class="chart-rating" title="{ratings[chart.id].average?.toFixed(1)} ({ratings[chart.id].count} ratings)">
										{ratings[chart.id].average?.toFixed(1)} &#9733;
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

	.song-title {
		font-size: 15px;
		font-weight: bold;
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

	.chart-rating {
		color: #ffdd00;
		font-size: 10px;
		margin-left: 4px;
	}
</style>
