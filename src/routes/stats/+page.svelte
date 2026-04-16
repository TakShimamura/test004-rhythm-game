<script lang="ts">
	import { authClient } from '$lib/auth-client.js';
	import { drawLineChart, drawBarChart } from '$lib/game/chart-renderer.js';
	import type { LineDataPoint, BarDataPoint } from '$lib/game/chart-renderer.js';
	import { onMount, tick } from 'svelte';

	const session = authClient.useSession();

	type OverviewStats = {
		totalPlays: number;
		totalSongs: number;
		avgAccuracy: number;
		bestCombo: number;
		accuracyOverTime: { date: string; accuracy: number }[];
		mostPlayed: { songId: string; songTitle: string; songArtist: string; playCount: number }[];
		gradeDistribution: Record<string, number>;
	};

	let stats: OverviewStats | null = $state(null);
	let loading = $state(true);

	let accuracyCanvas: HTMLCanvasElement | undefined = $state(undefined);
	let gradeCanvas: HTMLCanvasElement | undefined = $state(undefined);

	onMount(async () => {
		if (!$session.data) { loading = false; return; }

		const res = await fetch('/api/stats/overview');
		if (res.ok) {
			stats = await res.json();
		}
		loading = false;

		await tick();
		renderCharts();
	});

	function renderCharts(): void {
		if (!stats) return;

		// Accuracy trend line chart
		if (accuracyCanvas && stats.accuracyOverTime.length > 0) {
			const ctx = accuracyCanvas.getContext('2d');
			if (ctx) {
				const data: LineDataPoint[] = stats.accuracyOverTime.map((d, i) => ({
					label: String(i + 1),
					value: d.accuracy * 100,
				}));
				drawLineChart(ctx, data, {
					width: 600,
					height: 280,
					color: '#4488ff',
					showFill: true,
					showDots: true,
					yMin: 0,
					yMax: 100,
					yLabel: 'Accuracy %',
				});
			}
		}

		// Grade distribution bar chart
		if (gradeCanvas && stats.gradeDistribution) {
			const ctx = gradeCanvas.getContext('2d');
			if (ctx) {
				const gradeColors: Record<string, string> = {
					S: '#ffdd00',
					A: '#44ff66',
					B: '#4488ff',
					C: '#ff8844',
					D: '#ff4444',
				};
				const data: BarDataPoint[] = ['S', 'A', 'B', 'C', 'D'].map((g) => ({
					label: g,
					value: stats!.gradeDistribution[g] ?? 0,
					color: gradeColors[g],
				}));
				drawBarChart(ctx, data, {
					width: 400,
					height: 240,
				});
			}
		}
	}
</script>

{#if !$session.data}
	<div class="stats-page">
		<div class="center-msg">
			<p>You must be logged in to view stats.</p>
			<a href="/auth" class="login-link">LOGIN / SIGN UP</a>
		</div>
	</div>
{:else if loading}
	<div class="stats-page">
		<div class="center-msg"><p>Loading...</p></div>
	</div>
{:else if stats}
	<div class="stats-page">
		<a href="/" class="back-link">&larr; BACK</a>
		<h1 class="page-title">STATISTICS</h1>

		<!-- Overview cards -->
		<div class="stat-cards">
			<div class="stat-card">
				<div class="stat-value">{stats.totalPlays}</div>
				<div class="stat-label">TOTAL PLAYS</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{(stats.avgAccuracy * 100).toFixed(1)}%</div>
				<div class="stat-label">AVG ACCURACY</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.bestCombo}x</div>
				<div class="stat-label">BEST COMBO</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.totalSongs}</div>
				<div class="stat-label">SONGS CLEARED</div>
			</div>
		</div>

		<!-- Accuracy trend -->
		<h2 class="section-title">ACCURACY TREND</h2>
		{#if stats.accuracyOverTime.length > 0}
			<div class="chart-container">
				<canvas bind:this={accuracyCanvas} width="600" height="280"></canvas>
			</div>
			<p class="chart-hint">Last {stats.accuracyOverTime.length} plays</p>
		{:else}
			<p class="no-data">No plays recorded yet.</p>
		{/if}

		<!-- Grade distribution -->
		<h2 class="section-title">GRADE DISTRIBUTION</h2>
		{#if stats.totalPlays > 0}
			<div class="chart-container small">
				<canvas bind:this={gradeCanvas} width="400" height="240"></canvas>
			</div>
		{:else}
			<p class="no-data">No grades yet.</p>
		{/if}

		<!-- Most played songs -->
		<h2 class="section-title">MOST PLAYED</h2>
		{#if stats.mostPlayed.length > 0}
			<div class="most-played">
				{#each stats.mostPlayed as song, i}
					{@const maxCount = stats.mostPlayed[0].playCount}
					<a href="/stats/song/{song.songId}" class="mp-row">
						<span class="mp-rank">#{i + 1}</span>
						<div class="mp-info">
							<span class="mp-title">{song.songTitle}</span>
							<span class="mp-artist">{song.songArtist}</span>
						</div>
						<div class="mp-bar-container">
							<div class="mp-bar" style="width: {(song.playCount / maxCount) * 100}%"></div>
						</div>
						<span class="mp-count">{song.playCount}</span>
					</a>
				{/each}
			</div>
		{:else}
			<p class="no-data">No plays yet.</p>
		{/if}
	</div>
{/if}

<style>
	.stats-page {
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

	.page-title {
		font-size: 28px;
		letter-spacing: 6px;
		margin: 24px 0 32px;
		text-shadow: 0 0 10px rgba(68, 136, 255, 0.3);
	}

	/* Stat cards */
	.stat-cards {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
		margin-bottom: 36px;
	}

	.stat-card {
		background: #111118;
		border: 1px solid #222;
		padding: 20px 12px;
		text-align: center;
	}

	.stat-value {
		font-size: 24px;
		color: #4488ff;
		margin-bottom: 6px;
	}

	.stat-label {
		font-size: 10px;
		color: #666;
		letter-spacing: 1px;
	}

	/* Section title */
	.section-title {
		font-size: 14px;
		letter-spacing: 3px;
		color: #555;
		margin-top: 36px;
		margin-bottom: 16px;
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

	.chart-container.small {
		max-width: 440px;
	}

	.chart-hint {
		font-size: 11px;
		color: #555;
		margin-top: 6px;
		text-align: center;
	}

	.no-data {
		color: #555;
		font-size: 13px;
	}

	/* Most played */
	.most-played {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.mp-row {
		display: grid;
		grid-template-columns: 30px 1fr 120px 40px;
		align-items: center;
		gap: 12px;
		background: #111118;
		border: 1px solid #1a1a2e;
		padding: 10px 14px;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.2s;
	}

	.mp-row:hover {
		border-color: #4488ff44;
	}

	.mp-rank {
		color: #ffdd00;
		font-size: 13px;
	}

	.mp-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.mp-title {
		font-size: 13px;
		color: #ddd;
	}

	.mp-artist {
		font-size: 11px;
		color: #555;
	}

	.mp-bar-container {
		height: 6px;
		background: #1a1a2e;
		border-radius: 3px;
		overflow: hidden;
	}

	.mp-bar {
		height: 100%;
		background: linear-gradient(90deg, #4488ff, #44ff66);
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.mp-count {
		color: #4488ff;
		font-size: 13px;
		text-align: right;
	}

	@media (max-width: 768px) {
		.stats-page {
			padding: 24px 16px;
		}

		.page-title {
			font-size: 22px;
		}

		.stat-cards {
			grid-template-columns: repeat(2, 1fr);
		}

		.chart-container {
			padding: 8px;
		}

		.mp-row {
			grid-template-columns: 24px 1fr 80px 32px;
			gap: 8px;
			padding: 8px 10px;
		}
	}
</style>
