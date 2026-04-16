<script lang="ts">
	import { authClient } from '$lib/auth-client.js';
	import { drawLineChart } from '$lib/game/chart-renderer.js';
	import type { LineDataPoint } from '$lib/game/chart-renderer.js';
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';

	const session = authClient.useSession();

	type SongStats = {
		bestScore: number;
		bestAccuracy: number;
		bestCombo: number;
		totalAttempts: number;
		scoreHistory: {
			score: number;
			accuracy: number;
			maxCombo: number;
			playedAt: string;
			difficulty: string;
		}[];
		improvement: number;
	};

	type SongInfo = {
		title: string;
		artist: string;
	};

	let stats: SongStats | null = $state(null);
	let songInfo: SongInfo | null = $state(null);
	let loading = $state(true);
	let scoreCanvas: HTMLCanvasElement | undefined = $state(undefined);
	let accuracyCanvas: HTMLCanvasElement | undefined = $state(undefined);

	function getGrade(accuracy: number): { letter: string; color: string } {
		if (accuracy >= 0.95) return { letter: 'S', color: '#ffdd00' };
		if (accuracy >= 0.85) return { letter: 'A', color: '#44ff66' };
		if (accuracy >= 0.70) return { letter: 'B', color: '#4488ff' };
		if (accuracy >= 0.50) return { letter: 'C', color: '#ff8844' };
		return { letter: 'D', color: '#ff4444' };
	}

	onMount(async () => {
		if (!$session.data) { loading = false; return; }

		const songId = page.params.songId;

		// Fetch song info and stats in parallel
		const [statsRes, songRes] = await Promise.all([
			fetch(`/api/stats/songs/${songId}`),
			fetch(`/api/songs/${songId}`),
		]);

		if (statsRes.ok) {
			stats = await statsRes.json();
		}
		if (songRes.ok) {
			const data = await songRes.json();
			songInfo = { title: data.title, artist: data.artist };
		}

		loading = false;
		await tick();
		renderCharts();
	});

	function renderCharts(): void {
		if (!stats || stats.scoreHistory.length === 0) return;

		// Score improvement chart
		if (scoreCanvas) {
			const ctx = scoreCanvas.getContext('2d');
			if (ctx) {
				const data: LineDataPoint[] = stats.scoreHistory.map((s, i) => ({
					label: String(i + 1),
					value: s.score,
				}));
				drawLineChart(ctx, data, {
					width: 560,
					height: 260,
					color: '#4488ff',
					showFill: true,
					showDots: true,
					yLabel: 'Score',
				});
			}
		}

		// Accuracy improvement chart
		if (accuracyCanvas) {
			const ctx = accuracyCanvas.getContext('2d');
			if (ctx) {
				const data: LineDataPoint[] = stats.scoreHistory.map((s, i) => ({
					label: String(i + 1),
					value: s.accuracy * 100,
				}));
				drawLineChart(ctx, data, {
					width: 560,
					height: 260,
					color: '#44ff66',
					showFill: true,
					showDots: true,
					yMin: 0,
					yMax: 100,
					yLabel: 'Accuracy %',
				});
			}
		}
	}
</script>

{#if !$session.data}
	<div class="song-stats-page">
		<div class="center-msg">
			<p>You must be logged in to view stats.</p>
			<a href="/auth" class="login-link">LOGIN / SIGN UP</a>
		</div>
	</div>
{:else if loading}
	<div class="song-stats-page">
		<div class="center-msg"><p>Loading...</p></div>
	</div>
{:else if stats}
	<div class="song-stats-page">
		<a href="/stats" class="back-link">&larr; ALL STATS</a>

		{#if songInfo}
			<h1 class="song-title">{songInfo.title}</h1>
			<p class="song-artist">{songInfo.artist}</p>
		{:else}
			<h1 class="song-title">SONG STATS</h1>
		{/if}

		{#if stats.totalAttempts === 0}
			<p class="no-data">You haven't played this song yet.</p>
			<a href="/songs" class="nav-link">BROWSE SONGS</a>
		{:else}
			<!-- Best stats -->
			<div class="stat-cards">
				<div class="stat-card">
					<div class="stat-value">{stats.bestScore.toLocaleString()}</div>
					<div class="stat-label">BEST SCORE</div>
				</div>
				<div class="stat-card">
					<div class="stat-value">{(stats.bestAccuracy * 100).toFixed(1)}%</div>
					<div class="stat-label">BEST ACCURACY</div>
				</div>
				<div class="stat-card">
					<div class="stat-value">{stats.bestCombo}x</div>
					<div class="stat-label">BEST COMBO</div>
				</div>
				<div class="stat-card">
					<div class="stat-value">{stats.totalAttempts}</div>
					<div class="stat-label">ATTEMPTS</div>
				</div>
			</div>

			<!-- Improvement indicator -->
			{#if stats.totalAttempts >= 2}
				<div class="improvement" class:positive={stats.improvement > 0} class:negative={stats.improvement < 0}>
					<span class="improvement-label">IMPROVEMENT</span>
					<span class="improvement-value">
						{stats.improvement > 0 ? '+' : ''}{(stats.improvement * 100).toFixed(1)}%
					</span>
					<span class="improvement-hint">first vs last attempt accuracy</span>
				</div>
			{/if}

			<!-- Score history chart -->
			<h2 class="section-title">SCORE HISTORY</h2>
			<div class="chart-container">
				<canvas bind:this={scoreCanvas} width="560" height="260"></canvas>
			</div>
			<p class="chart-hint">Attempt number</p>

			<!-- Accuracy history chart -->
			<h2 class="section-title">ACCURACY HISTORY</h2>
			<div class="chart-container">
				<canvas bind:this={accuracyCanvas} width="560" height="260"></canvas>
			</div>
			<p class="chart-hint">Attempt number</p>

			<!-- Score history list -->
			<h2 class="section-title">ALL ATTEMPTS</h2>
			<div class="attempts-list">
				{#each [...stats.scoreHistory].reverse() as entry, i}
					{@const g = getGrade(entry.accuracy)}
					<div class="attempt-row">
						<span class="attempt-num">#{stats.scoreHistory.length - i}</span>
						<span class="attempt-diff">{entry.difficulty.toUpperCase()}</span>
						<span class="attempt-score">{entry.score.toLocaleString()}</span>
						<span class="attempt-acc">{(entry.accuracy * 100).toFixed(1)}%</span>
						<span class="attempt-grade" style="color: {g.color}">{g.letter}</span>
						<span class="attempt-date">{new Date(entry.playedAt).toLocaleDateString()}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.song-stats-page {
		min-height: 100vh;
		background: #0a0a0f;
		color: #fff;
		font-family: monospace;
		padding: 40px 24px;
		max-width: 800px;
		margin: 0 auto;
	}

	.center-msg {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 80vh;
		gap: 16px;
		color: #888;
	}

	.login-link {
		color: #4488ff;
		text-decoration: none;
		letter-spacing: 2px;
		border: 1px solid #4488ff;
		padding: 8px 20px;
	}

	.login-link:hover { background: #4488ff20; }

	.back-link {
		color: #555;
		text-decoration: none;
		font-size: 13px;
		letter-spacing: 2px;
	}

	.back-link:hover { color: #aaa; }

	.song-title {
		font-size: 24px;
		letter-spacing: 3px;
		margin: 24px 0 4px;
		text-shadow: 0 0 10px rgba(68, 136, 255, 0.3);
	}

	.song-artist {
		color: #888;
		font-size: 14px;
		margin: 0 0 24px;
	}

	.nav-link {
		color: #4488ff;
		text-decoration: none;
		letter-spacing: 2px;
		font-size: 14px;
	}

	.nav-link:hover { text-decoration: underline; }

	/* Stat cards */
	.stat-cards {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
		margin-bottom: 24px;
	}

	.stat-card {
		background: #111118;
		border: 1px solid #222;
		padding: 18px 12px;
		text-align: center;
	}

	.stat-value {
		font-size: 22px;
		color: #4488ff;
		margin-bottom: 6px;
	}

	.stat-label {
		font-size: 10px;
		color: #666;
		letter-spacing: 1px;
	}

	/* Improvement */
	.improvement {
		background: #111118;
		border: 1px solid #222;
		padding: 14px 20px;
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}

	.improvement-label {
		font-size: 10px;
		color: #666;
		letter-spacing: 1px;
	}

	.improvement-value {
		font-size: 20px;
		font-weight: bold;
	}

	.improvement.positive .improvement-value { color: #44ff66; }
	.improvement.negative .improvement-value { color: #ff4444; }

	.improvement-hint {
		font-size: 10px;
		color: #555;
		margin-left: auto;
	}

	/* Section title */
	.section-title {
		font-size: 14px;
		letter-spacing: 3px;
		color: #555;
		margin-top: 32px;
		margin-bottom: 12px;
		border-bottom: 1px solid #222;
		padding-bottom: 8px;
	}

	/* Charts */
	.chart-container {
		background: #111118;
		border: 1px solid #222;
		padding: 16px;
		display: flex;
		justify-content: center;
		overflow-x: auto;
	}

	.chart-hint {
		font-size: 11px;
		color: #555;
		margin-top: 6px;
		text-align: center;
	}

	.no-data {
		color: #555;
		font-size: 14px;
		margin: 24px 0;
	}

	/* Attempts list */
	.attempts-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.attempt-row {
		display: grid;
		grid-template-columns: 40px 70px 1fr 70px 40px 90px;
		align-items: center;
		gap: 8px;
		background: #111118;
		border: 1px solid #1a1a2e;
		padding: 8px 12px;
		font-size: 13px;
	}

	.attempt-num {
		color: #555;
	}

	.attempt-diff {
		color: #aa88ff;
		font-size: 11px;
		letter-spacing: 1px;
	}

	.attempt-score {
		color: #4488ff;
	}

	.attempt-acc {
		color: #aaa;
		text-align: right;
	}

	.attempt-grade {
		font-weight: bold;
		text-align: center;
		font-size: 16px;
	}

	.attempt-date {
		color: #555;
		font-size: 11px;
		text-align: right;
	}

	@media (max-width: 768px) {
		.song-stats-page {
			padding: 24px 16px;
		}

		.song-title {
			font-size: 20px;
		}

		.stat-cards {
			grid-template-columns: repeat(2, 1fr);
		}

		.improvement {
			flex-direction: column;
			align-items: flex-start;
			gap: 4px;
		}

		.improvement-hint {
			margin-left: 0;
		}

		.attempt-row {
			grid-template-columns: 30px 50px 1fr 50px 30px 70px;
			gap: 4px;
			font-size: 12px;
		}
	}
</style>
