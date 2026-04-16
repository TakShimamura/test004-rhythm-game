<script lang="ts">
	import { onMount } from 'svelte';
	import { createEngine, type Engine } from '$lib/game/engine.js';
	import { menuMusic } from '$lib/game/menu-music-store.js';
	import { DEMO_CHART } from '$lib/chart/songs.js';
	import { createAutoplay, type Autoplay, type InputSimulator } from '$lib/game/autoplay.js';
	import { loadSettings, settingsToConfig } from '$lib/game/settings.js';
	import type { GameState, Lane, ScoreState } from '$lib/game/types.js';

	let canvas: HTMLCanvasElement;
	let engine: Engine | null = $state(null);
	let autoplay: Autoplay | null = $state(null);
	let gameState: GameState = $state('waiting');
	let score: ScoreState = $state({ score: 0, combo: 0, maxCombo: 0, perfects: 0, goods: 0, misses: 0 });

	function createKeySimulator(): InputSimulator {
		const settings = loadSettings();
		const keys = settings.laneKeys;

		return {
			simulateKeyDown(lane: Lane) {
				const key = keys[lane];
				window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
			},
			simulateKeyUp(lane: Lane) {
				const key = keys[lane];
				window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
			},
		};
	}

	function initEngine() {
		engine?.destroy();
		autoplay?.stop();

		score = { score: 0, combo: 0, maxCombo: 0, perfects: 0, goods: 0, misses: 0 };
		gameState = 'waiting';

		const settings = loadSettings();
		const config = settingsToConfig(settings);

		engine = createEngine(canvas, DEMO_CHART, config, {
			onStateChange(s) {
				gameState = s;
			},
			onScoreChange(s) {
				score = s;
			},
		});

		const simulator = createKeySimulator();
		autoplay = createAutoplay(DEMO_CHART, simulator);
	}

	onMount(() => {
		menuMusic.fadeOutAndStop(0.5);
		initEngine();

		return () => {
			engine?.destroy();
			autoplay?.stop();
		};
	});

	function handleStart() {
		initEngine();
		queueMicrotask(() => {
			engine?.start();
			// Start autoplay with slight delay to match audio start
			autoplay?.start(0);
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && gameState === 'playing') {
			engine?.pause();
			autoplay?.stop();
		} else if (e.key === 'Escape' && gameState === 'paused') {
			engine?.resume();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="game-container">
	<canvas bind:this={canvas} class="game-canvas"></canvas>

	{#if gameState === 'playing'}
		<div class="autoplay-badge">AUTOPLAY</div>
	{/if}

	{#if gameState === 'waiting'}
		<div class="overlay fade-in">
			<h1 class="title-glow">DEMO</h1>
			<p class="subtitle">Watch the game play itself</p>
			<button class="start-btn glow-btn" onclick={handleStart}>
				WATCH DEMO
			</button>
			<a href="/play" class="try-btn">Try it yourself!</a>
			<a href="/" class="back-link">Back to Home</a>
		</div>
	{/if}

	{#if gameState === 'paused'}
		<div class="overlay fade-in">
			<h2 class="title-glow">PAUSED</h2>
			<p class="hint">Press ESC to resume</p>
		</div>
	{/if}

	{#if gameState === 'results'}
		<div class="overlay scale-in">
			<h1 class="title-glow">DEMO COMPLETE</h1>
			<div class="results-summary">
				<span class="result-stat">Score: {score.score.toLocaleString()}</span>
				<span class="result-stat">Combo: {score.maxCombo}x</span>
			</div>
			<a href="/play" class="start-btn glow-btn">Try it yourself!</a>
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
		background: rgba(5, 5, 16, 0.92);
		color: #fff;
		gap: 16px;
		backdrop-filter: blur(8px);
	}

	.fade-in {
		animation: fadeIn 0.4s ease-out;
	}

	.scale-in {
		animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes scaleIn {
		from { opacity: 0; transform: scale(0.9); }
		to { opacity: 1; transform: scale(1); }
	}

	@keyframes titleGlow {
		0%, 100% {
			text-shadow: 0 0 10px rgba(68, 136, 255, 0.3), 0 0 30px rgba(68, 136, 255, 0.1);
		}
		50% {
			text-shadow: 0 0 20px rgba(68, 136, 255, 0.6), 0 0 50px rgba(68, 136, 255, 0.2);
		}
	}

	.title-glow {
		animation: titleGlow 2.5s ease-in-out infinite;
	}

	@keyframes glowBtnPulse {
		0%, 100% { box-shadow: 0 0 8px rgba(68, 136, 255, 0.2); }
		50% { box-shadow: 0 0 20px rgba(68, 136, 255, 0.4), 0 0 40px rgba(68, 136, 255, 0.1); }
	}

	.glow-btn {
		animation: glowBtnPulse 2s ease-in-out infinite;
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

	.hint {
		font-family: monospace;
		color: #555;
		font-size: 14px;
	}

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

	.try-btn {
		font-family: monospace;
		font-size: 16px;
		padding: 10px 24px;
		background: transparent;
		border: 2px solid #44ff66;
		color: #44ff66;
		cursor: pointer;
		letter-spacing: 2px;
		text-decoration: none;
		transition: background 0.2s;
	}

	.try-btn:hover {
		background: #44ff6620;
		box-shadow: 0 0 20px rgba(68, 255, 102, 0.3);
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

	/* Autoplay badge */
	.autoplay-badge {
		position: absolute;
		top: 12px;
		right: 12px;
		font-family: monospace;
		font-size: 14px;
		padding: 4px 14px;
		letter-spacing: 3px;
		color: #ffdd00;
		background: rgba(255, 221, 0, 0.12);
		border: 1px solid rgba(255, 221, 0, 0.4);
		border-radius: 3px;
		pointer-events: none;
		z-index: 10;
		animation: badgePulse 2s ease-in-out infinite;
	}

	@keyframes badgePulse {
		0%, 100% { box-shadow: 0 0 6px rgba(255, 221, 0, 0.2); }
		50% { box-shadow: 0 0 16px rgba(255, 221, 0, 0.4); }
	}

	.results-summary {
		display: flex;
		gap: 24px;
	}

	.result-stat {
		font-family: monospace;
		font-size: 16px;
		color: #aaa;
	}

	@media (max-width: 768px) {
		h1 { font-size: 28px; letter-spacing: 4px; }
		h2 { font-size: 24px; }
		.results-summary { flex-direction: column; gap: 8px; align-items: center; }
	}
</style>
