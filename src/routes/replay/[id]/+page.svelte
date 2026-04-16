<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { createReplayEngine, type ReplayEngine } from '$lib/game/replay-engine.js';
	import type { Chart, GameState, ScoreState, ReplayData, ReplayEvent } from '$lib/game/types.js';
	import { DEFAULT_CONFIG } from '$lib/game/types.js';
	import { accuracy } from '$lib/game/scoring.js';

	let canvas: HTMLCanvasElement;
	let engine: ReplayEngine | null = $state(null);
	let gameState: GameState = $state('waiting');
	let score: ScoreState = $state({ score: 0, combo: 0, maxCombo: 0, perfects: 0, goods: 0, misses: 0 });
	let loading = $state(true);
	let errorMsg = $state('');
	let playerName = $state('');
	let songTitle = $state('');
	let songArtist = $state('');
	let chartId = $state('');
	let finalScore = $state(0);
	let finalAccuracy = $state(0);
	let playbackSpeed = $state(1.0);
	let displayScore = $state(0);
	let animatingScore = $state(false);

	const SPEED_OPTIONS = [0.5, 1.0, 2.0];

	function getGrade(acc: number): { letter: string; color: string } {
		if (acc >= 0.95) return { letter: 'S', color: '#ffdd00' };
		if (acc >= 0.85) return { letter: 'A', color: '#44ff66' };
		if (acc >= 0.70) return { letter: 'B', color: '#4488ff' };
		if (acc >= 0.50) return { letter: 'C', color: '#ff8844' };
		return { letter: 'D', color: '#ff4444' };
	}

	function animateScore(target: number) {
		if (animatingScore) return;
		animatingScore = true;
		const start = displayScore;
		const duration = 1200;
		const startTime = performance.now();
		function tick() {
			const elapsed = performance.now() - startTime;
			const progress = Math.min(1, elapsed / duration);
			const eased = 1 - Math.pow(1 - progress, 3);
			displayScore = Math.round(start + (target - start) * eased);
			if (progress < 1) {
				requestAnimationFrame(tick);
			} else {
				displayScore = target;
				animatingScore = false;
			}
		}
		requestAnimationFrame(tick);
	}

	$effect(() => {
		if (gameState === 'results') {
			animateScore(score.score);
		}
	});

	function setSpeed(speed: number) {
		playbackSpeed = speed;
		engine?.setPlaybackSpeed(speed);
	}

	onMount(() => {
		const replayId = page.params.id;

		(async () => { try {
			const res = await fetch(`/api/replays/${replayId}`);
			if (!res.ok) {
				errorMsg = 'Replay not found';
				loading = false;
				return;
			}

			const data = await res.json();
			playerName = data.playerName;
			songTitle = data.songTitle;
			songArtist = data.songArtist;
			chartId = data.chartId;
			finalScore = data.score;
			finalAccuracy = data.accuracy;

			const chart: Chart = {
				id: data.chartId,
				songId: '',
				difficulty: data.chartDifficulty,
				bpm: data.songBpm,
				offsetMs: 0,
				notes: data.chartNotes as Chart['notes'],
			};

			const replayData: ReplayData = {
				chartId: data.chartId,
				events: data.events as ReplayEvent[],
				finalScore: data.score,
				finalAccuracy: data.accuracy,
				recordedAt: data.createdAt,
			};

			engine = createReplayEngine(canvas, chart, DEFAULT_CONFIG, replayData, {
				onStateChange(s) {
					gameState = s;
				},
				onScoreChange(s) {
					score = s;
				},
			});

			loading = false;
		} catch {
			errorMsg = 'Failed to load replay';
			loading = false;
		}
		})();

		return () => {
			engine?.destroy();
		};
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && gameState === 'playing') {
			engine?.pause();
		} else if (e.key === 'Escape' && gameState === 'paused') {
			engine?.resume();
		}
	}

	function handleStart() {
		engine?.start();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="replay-container">
	<canvas bind:this={canvas} class="game-canvas"></canvas>

	<!-- REPLAY badge -->
	{#if gameState === 'playing' || gameState === 'paused'}
		<div class="replay-badge">REPLAY</div>
		<div class="replay-hud">
			<div class="hud-player">{playerName}</div>
			<div class="hud-score">{score.score}</div>
			<div class="hud-combo">{score.combo}x</div>
			<div class="hud-accuracy">{(accuracy(score) * 100).toFixed(1)}%</div>
		</div>
		<div class="speed-controls">
			{#each SPEED_OPTIONS as spd}
				<button
					class="speed-btn"
					class:active={playbackSpeed === spd}
					onclick={() => setSpeed(spd)}
				>
					{spd}x
				</button>
			{/each}
		</div>
	{/if}

	{#if loading}
		<div class="overlay fade-in">
			<div class="spinner"></div>
			<p class="subtitle">Loading replay...</p>
		</div>
	{:else if errorMsg}
		<div class="overlay fade-in">
			<h2 class="title-glow">ERROR</h2>
			<p class="subtitle">{errorMsg}</p>
			<a href="/" class="start-btn glow-btn">BACK TO HOME</a>
		</div>
	{:else if gameState === 'waiting'}
		<div class="overlay fade-in">
			<div class="replay-badge-large">REPLAY</div>
			<h1 class="title-glow">{songTitle}</h1>
			<p class="subtitle">{songArtist}</p>
			<p class="subtitle">Played by {playerName}</p>
			<div class="speed-selector">
				<span class="mode-label">PLAYBACK SPEED</span>
				<div class="speed-buttons">
					{#each SPEED_OPTIONS as spd}
						<button
							class="speed-btn"
							class:active={playbackSpeed === spd}
							onclick={() => setSpeed(spd)}
						>
							{spd}x
						</button>
					{/each}
				</div>
			</div>
			<button class="start-btn glow-btn" onclick={handleStart}>
				WATCH REPLAY
			</button>
		</div>
	{:else if gameState === 'paused'}
		<div class="overlay fade-in">
			<h2 class="title-glow">PAUSED</h2>
			<p class="hint">Press ESC to resume</p>
		</div>
	{:else if gameState === 'results'}
		{@const acc = accuracy(score)}
		{@const grade = getGrade(acc)}
		<div class="overlay results scale-in">
			<div class="replay-badge-large">REPLAY</div>
			<div class="grade-display" style="--grade-color: {grade.color}">
				<span class="grade-letter">{grade.letter}</span>
			</div>
			<h1 class="title-glow">RESULTS</h1>
			<p class="subtitle">Played by {playerName}</p>
			<div class="results-grid">
				<div class="result-item">
					<span class="result-label">Score</span>
					<span class="result-value">{displayScore}</span>
				</div>
				<div class="result-item">
					<span class="result-label">Max Combo</span>
					<span class="result-value">{score.maxCombo}x</span>
				</div>
				<div class="result-item">
					<span class="result-label">Accuracy</span>
					<span class="result-value">{(acc * 100).toFixed(1)}%</span>
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
			<div class="results-actions">
				<a href="/play?chart={chartId}" class="start-btn glow-btn">PLAY THIS CHART</a>
				<a href="/" class="back-link">Back to Home</a>
			</div>
		</div>
	{/if}
</div>

<style>
	.replay-container {
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
		background: rgba(5, 5, 16, 0.92);
		color: #fff;
		gap: 16px;
		backdrop-filter: blur(8px);
	}

	.fade-in { animation: fadeIn 0.4s ease-out; }
	.scale-in { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); }

	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
	@keyframes scaleIn {
		from { opacity: 0; transform: scale(0.9); }
		to { opacity: 1; transform: scale(1); }
	}

	@keyframes titleGlow {
		0%, 100% { text-shadow: 0 0 10px rgba(68, 136, 255, 0.3), 0 0 30px rgba(68, 136, 255, 0.1); }
		50% { text-shadow: 0 0 20px rgba(68, 136, 255, 0.6), 0 0 50px rgba(68, 136, 255, 0.2), 0 0 80px rgba(68, 136, 255, 0.1); }
	}

	.title-glow { animation: titleGlow 2.5s ease-in-out infinite; }

	h1 {
		font-family: monospace;
		font-size: 36px;
		letter-spacing: 6px;
		margin: 0;
	}

	h2 {
		font-family: monospace;
		font-size: 28px;
		letter-spacing: 4px;
		margin: 0;
	}

	.subtitle {
		font-family: monospace;
		color: #888;
		font-size: 16px;
	}

	.hint {
		font-family: monospace;
		color: #555;
		font-size: 14px;
	}

	/* Replay badge */
	.replay-badge {
		position: absolute;
		top: 12px;
		right: 12px;
		font-family: monospace;
		font-size: 14px;
		font-weight: bold;
		letter-spacing: 3px;
		color: #ff8844;
		background: rgba(255, 136, 68, 0.15);
		border: 1px solid rgba(255, 136, 68, 0.4);
		padding: 4px 12px;
		border-radius: 3px;
		z-index: 20;
		pointer-events: none;
	}

	.replay-badge-large {
		font-family: monospace;
		font-size: 18px;
		font-weight: bold;
		letter-spacing: 6px;
		color: #ff8844;
		text-shadow: 0 0 10px rgba(255, 136, 68, 0.4);
	}

	/* Replay HUD */
	.replay-hud {
		position: absolute;
		top: 40px;
		right: 12px;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		font-family: monospace;
		z-index: 20;
		pointer-events: none;
	}

	.hud-player { font-size: 12px; color: #888; letter-spacing: 1px; }
	.hud-score { font-size: 16px; color: #fff; font-weight: bold; }
	.hud-combo { font-size: 13px; color: #ffdd00; }
	.hud-accuracy { font-size: 12px; color: #4488ff; }

	/* Speed controls during playback */
	.speed-controls {
		position: absolute;
		bottom: 16px;
		right: 16px;
		display: flex;
		gap: 6px;
		z-index: 20;
	}

	.speed-selector {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.mode-label {
		font-family: monospace;
		font-size: 12px;
		color: #888;
		letter-spacing: 2px;
	}

	.speed-buttons {
		display: flex;
		gap: 6px;
	}

	.speed-btn {
		font-family: monospace;
		font-size: 14px;
		padding: 6px 12px;
		background: transparent;
		border: 1px solid #333;
		color: #888;
		cursor: pointer;
		transition: all 0.15s;
	}

	.speed-btn:hover {
		border-color: #4488ff;
		color: #4488ff;
	}

	.speed-btn.active {
		border-color: #4488ff;
		color: #4488ff;
		background: rgba(68, 136, 255, 0.15);
		box-shadow: 0 0 8px rgba(68, 136, 255, 0.2);
	}

	@keyframes glowBtnPulse {
		0%, 100% { box-shadow: 0 0 8px rgba(68, 136, 255, 0.2); }
		50% { box-shadow: 0 0 20px rgba(68, 136, 255, 0.4), 0 0 40px rgba(68, 136, 255, 0.1); }
	}

	.glow-btn { animation: glowBtnPulse 2s ease-in-out infinite; }

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
		transition: background 0.2s, box-shadow 0.2s;
	}

	.start-btn:hover {
		background: #4488ff20;
		box-shadow: 0 0 30px rgba(68, 136, 255, 0.3);
	}

	/* Grade display */
	.grade-display { position: relative; margin-bottom: 8px; }

	.grade-letter {
		font-family: monospace;
		font-size: 96px;
		font-weight: bold;
		color: var(--grade-color);
		text-shadow: 0 0 20px var(--grade-color), 0 0 40px var(--grade-color), 0 0 80px var(--grade-color);
		animation: gradeAppear 0.8s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes gradeAppear {
		from { opacity: 0; transform: scale(2); filter: blur(10px); }
		to { opacity: 1; transform: scale(1); filter: blur(0); }
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

	.result-label { font-family: monospace; color: #888; font-size: 14px; }
	.result-label.perfect { color: #ffdd00; }
	.result-label.good { color: #88ff88; }
	.result-label.miss { color: #ff4444; }
	.result-value { font-family: monospace; font-size: 24px; font-weight: bold; }

	.results-actions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		margin-top: 8px;
	}

	.back-link {
		font-family: monospace;
		color: #555;
		font-size: 14px;
		text-decoration: none;
	}

	.back-link:hover { color: #888; }

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(68, 136, 255, 0.2);
		border-top-color: #4488ff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	@media (max-width: 768px) {
		h1 { font-size: 24px; letter-spacing: 3px; }
		h2 { font-size: 20px; }
		.results-grid { gap: 8px 16px; }
	}
</style>
