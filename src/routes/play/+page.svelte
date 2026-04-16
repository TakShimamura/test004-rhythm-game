<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { createEngine, type Engine } from '$lib/game/engine.js';
	import { DEMO_CHART } from '$lib/chart/demo.js';
	import { accuracy } from '$lib/game/scoring.js';
	import { loadSettings, settingsToConfig } from '$lib/game/settings.js';
	import { authClient } from '$lib/auth-client.js';
	import type { Chart, GameState, ScoreState } from '$lib/game/types.js';

	let canvas: HTMLCanvasElement;
	let engine: Engine | null = $state(null);
	let gameState: GameState = $state('waiting');
	let score: ScoreState = $state({ score: 0, combo: 0, maxCombo: 0, perfects: 0, goods: 0, misses: 0 });
	let laneKeys: [string, string, string] = $state(['a', 's', 'd']);
	let chartTitle = $state('Demo Chart');
	let chartBpm = $state(120);
	let loading = $state(true);
	let activeChartId = $state('');
	let scoreSubmitted = $state(false);
	let leaderboard: { playerName: string; score: number; accuracy: number }[] = $state([]);

	const session = authClient.useSession();

	async function loadChart(): Promise<Chart> {
		const chartId = page.url.searchParams.get('chart');
		if (!chartId) return DEMO_CHART;

		const res = await fetch(`/api/charts/${chartId}`);
		if (!res.ok) return DEMO_CHART;

		const data = await res.json();
		chartTitle = `${data.songTitle} — ${data.songArtist}`;
		chartBpm = data.bpm;

		return {
			id: data.id,
			songId: data.songId,
			difficulty: data.difficulty,
			bpm: data.bpm,
			offsetMs: 0,
			notes: data.notes,
		};
	}

	async function submitScore(chartId: string, s: ScoreState) {
		if (!$session.data || scoreSubmitted) return;
		scoreSubmitted = true;
		await fetch('/api/scores', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chartId,
				score: s.score,
				maxCombo: s.maxCombo,
				accuracy: accuracy(s),
			}),
		});
		await loadLeaderboard(chartId);
	}

	async function loadLeaderboard(chartId: string) {
		const res = await fetch(`/api/charts/${chartId}/leaderboard`);
		if (res.ok) leaderboard = await res.json();
	}

	onMount(() => {
		loadChart().then((chart) => {
			chartBpm = chart.bpm;
			activeChartId = chart.id;
			loading = false;

			const settings = loadSettings();
			const config = settingsToConfig(settings);
			laneKeys = settings.laneKeys;
			engine = createEngine(canvas, chart, config, {
				onStateChange(s) {
					gameState = s;
					if (s === 'results') {
						submitScore(chart.id, score);
					}
				},
				onScoreChange(s) {
					score = s;
				},
			});
		});

		return () => engine?.destroy();
	});

	function handleStart() {
		engine?.start();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && gameState === 'playing') {
			engine?.pause();
		} else if (e.key === 'Escape' && gameState === 'paused') {
			engine?.resume();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="game-container">
	<canvas bind:this={canvas} class="game-canvas"></canvas>

	{#if loading}
		<div class="overlay">
			<p class="subtitle">Loading chart...</p>
		</div>
	{:else if gameState === 'waiting'}
		<div class="overlay">
			<h1>RHYTHM GAME</h1>
			<p class="subtitle">{chartTitle} — {chartBpm} BPM</p>
			<div class="keys-hint">
				<span class="key key-a">{laneKeys[0].toUpperCase()}</span>
				<span class="key key-s">{laneKeys[1].toUpperCase()}</span>
				<span class="key key-d">{laneKeys[2].toUpperCase()}</span>
			</div>
			<button class="start-btn" onclick={handleStart}>
				PRESS TO START
			</button>
			<p class="hint">Hit the notes as they reach the circles</p>
		</div>
	{/if}

	{#if gameState === 'paused'}
		<div class="overlay">
			<h2>PAUSED</h2>
			<p class="hint">Press ESC to resume</p>
		</div>
	{/if}

	{#if gameState === 'results'}
		<div class="overlay results">
			<h1>RESULTS</h1>
			<div class="results-grid">
				<div class="result-item">
					<span class="result-label">Score</span>
					<span class="result-value">{score.score}</span>
				</div>
				<div class="result-item">
					<span class="result-label">Max Combo</span>
					<span class="result-value">{score.maxCombo}x</span>
				</div>
				<div class="result-item">
					<span class="result-label">Accuracy</span>
					<span class="result-value">{(accuracy(score) * 100).toFixed(1)}%</span>
				</div>
				<div class="result-item">
					<span class="result-label perfect">Perfect</span>
					<span class="result-value">{score.perfects}</span>
				</div>
				<div class="result-item">
					<span class="result-label good">Good</span>
					<span class="result-value">{score.goods}</span>
				</div>
				<div class="result-item">
					<span class="result-label miss">Miss</span>
					<span class="result-value">{score.misses}</span>
				</div>
			</div>
			{#if !$session.data}
				<p class="hint"><a href="/auth" class="auth-hint">Sign in</a> to save scores</p>
			{:else if scoreSubmitted}
				<p class="hint score-saved">Score saved!</p>
			{/if}

			{#if leaderboard.length > 0}
				<div class="leaderboard">
					<h3>LEADERBOARD</h3>
					<div class="lb-list">
						{#each leaderboard.slice(0, 5) as entry, i}
							<div class="lb-row">
								<span class="lb-rank">#{i + 1}</span>
								<span class="lb-name">{entry.playerName}</span>
								<span class="lb-score">{entry.score}</span>
								<span class="lb-acc">{(entry.accuracy * 100).toFixed(1)}%</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<a href="/play" class="start-btn">PLAY AGAIN</a>
			<a href="/" class="back-link">Back to Home</a>
		</div>
	{/if}
</div>

<style>
	.game-container {
		position: relative;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		background: #0a0a0f;
	}

	.game-canvas {
		width: 100%;
		height: 100%;
		display: block;
	}

	.overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: rgba(10, 10, 15, 0.9);
		color: #fff;
		gap: 16px;
	}

	h1 {
		font-family: monospace;
		font-size: 48px;
		letter-spacing: 8px;
		margin: 0;
	}

	h2 {
		font-family: monospace;
		font-size: 36px;
		letter-spacing: 4px;
		margin: 0;
	}

	.subtitle {
		font-family: monospace;
		color: #888;
		font-size: 16px;
	}

	.keys-hint {
		display: flex;
		gap: 12px;
		margin: 16px 0;
	}

	.key {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border: 2px solid #444;
		border-radius: 8px;
		font-family: monospace;
		font-size: 20px;
		font-weight: bold;
	}

	.key-a { border-color: #ff4466; color: #ff4466; }
	.key-s { border-color: #44ff66; color: #44ff66; }
	.key-d { border-color: #4488ff; color: #4488ff; }

	.start-btn {
		font-family: monospace;
		font-size: 18px;
		padding: 12px 32px;
		background: transparent;
		border: 2px solid #4488ff;
		color: #4488ff;
		cursor: pointer;
		letter-spacing: 2px;
		text-decoration: none;
		transition: background 0.2s;
	}

	.start-btn:hover {
		background: #4488ff20;
	}

	.hint {
		font-family: monospace;
		color: #555;
		font-size: 14px;
	}

	.results-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px 32px;
		margin: 16px 0;
	}

	.result-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.result-label {
		font-family: monospace;
		color: #888;
		font-size: 14px;
	}

	.result-label.perfect { color: #ffdd00; }
	.result-label.good { color: #88ff88; }
	.result-label.miss { color: #ff4444; }

	.result-value {
		font-family: monospace;
		font-size: 24px;
		font-weight: bold;
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

	.auth-hint {
		color: #4488ff;
		text-decoration: none;
	}

	.auth-hint:hover { text-decoration: underline; }

	.score-saved {
		color: #44ff66 !important;
	}

	.leaderboard {
		width: 320px;
		margin-top: 8px;
	}

	.leaderboard h3 {
		font-family: monospace;
		font-size: 14px;
		letter-spacing: 2px;
		color: #888;
		text-align: center;
		margin: 0 0 8px;
	}

	.lb-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.lb-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: monospace;
		font-size: 13px;
	}

	.lb-rank { color: #ffdd00; width: 24px; }
	.lb-name { color: #ccc; flex: 1; }
	.lb-score { color: #fff; font-weight: bold; }
	.lb-acc { color: #888; width: 55px; text-align: right; }
</style>
