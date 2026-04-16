<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createEngine, type Engine } from '$lib/game/engine.js';
	import { TUTORIAL_CHART, TUTORIAL_PROMPTS, TUTORIAL_PHASES, type TutorialPrompt } from '$lib/chart/tutorial.js';
	import { loadSettings, settingsToConfig } from '$lib/game/settings.js';
	import type { GameState, ScoreState } from '$lib/game/types.js';

	let canvas: HTMLCanvasElement;
	let engine: Engine | null = $state(null);
	let gameState: GameState = $state('waiting');
	let score: ScoreState = $state({ score: 0, combo: 0, maxCombo: 0, perfects: 0, goods: 0, misses: 0 });
	let currentTime = $state(0);
	let activePrompt: TutorialPrompt | null = $state(null);
	let promptOpacity = $state(0);
	let tutorialComplete = $state(false);
	let phaseFailed = $state(false);
	let failedPhaseIndex = $state(-1);
	let laneKeys: [string, string, string] = $state(['a', 's', 'd']);

	// Track misses per phase
	let phaseMissCounts: number[] = $state([0, 0, 0, 0, 0]);
	let lastMissCount = 0;

	function initEngine() {
		engine?.destroy();
		score = { score: 0, combo: 0, maxCombo: 0, perfects: 0, goods: 0, misses: 0 };
		gameState = 'waiting';
		phaseFailed = false;
		failedPhaseIndex = -1;
		phaseMissCounts = [0, 0, 0, 0, 0];
		lastMissCount = 0;

		const settings = loadSettings();
		const config = settingsToConfig(settings);
		laneKeys = settings.laneKeys;

		engine = createEngine(canvas, TUTORIAL_CHART, config, {
			onStateChange(s) {
				gameState = s;
				if (s === 'results') {
					tutorialComplete = true;
					localStorage.setItem('tutorial-completed', '1');
				}
			},
			onScoreChange(s) {
				score = s;
			},
		}, {
			mode: 'nofail',
			speedMultiplier: 1.0,
			mirror: false,
			noFail: true,
			practice: false,
		});
	}

	function updatePrompt() {
		if (gameState !== 'playing' || !engine) return;

		// Approximate current time from the score progression + tracking via rAF
		// We use a polling approach since engine doesn't expose currentTime directly
		const t = currentTime;

		// Find active prompt
		let found: TutorialPrompt | null = null;
		for (const prompt of TUTORIAL_PROMPTS) {
			if (t >= prompt.startTime && t <= prompt.endTime) {
				found = prompt;
				break;
			}
		}
		activePrompt = found;

		if (found) {
			const fadeIn = Math.min(1, (t - found.startTime) / 0.5);
			const fadeOut = Math.min(1, (found.endTime - t) / 0.5);
			promptOpacity = Math.min(fadeIn, fadeOut);
		} else {
			promptOpacity = 0;
		}

		// Check phase misses
		const newMisses = score.misses - lastMissCount;
		if (newMisses > 0) {
			// Figure out which phase we're in
			for (let i = 0; i < TUTORIAL_PHASES.length; i++) {
				const phase = TUTORIAL_PHASES[i];
				if (t >= phase.start && t <= phase.end + 1) {
					phaseMissCounts[i] += newMisses;
					if (phaseMissCounts[i] > 2 && !phaseFailed) {
						phaseFailed = true;
						failedPhaseIndex = i;
						engine?.pause();
					}
					break;
				}
			}
			lastMissCount = score.misses;
		}
	}

	let trackingRafId = 0;
	let trackingStartTime = 0;
	let trackingStartPerf = 0;

	function startTimeTracking() {
		trackingStartPerf = performance.now();
		trackingStartTime = 0;

		function tick() {
			if (gameState === 'playing') {
				currentTime = (performance.now() - trackingStartPerf) / 1000;
				updatePrompt();
			}
			trackingRafId = requestAnimationFrame(tick);
		}
		trackingRafId = requestAnimationFrame(tick);
	}

	function stopTimeTracking() {
		cancelAnimationFrame(trackingRafId);
	}

	onMount(() => {
		initEngine();

		return () => {
			engine?.destroy();
			stopTimeTracking();
		};
	});

	function handleStart() {
		initEngine();
		queueMicrotask(() => {
			engine?.start();
			startTimeTracking();
		});
	}

	function handleRetry() {
		stopTimeTracking();
		initEngine();
		queueMicrotask(() => {
			engine?.start();
			startTimeTracking();
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && gameState === 'playing') {
			engine?.pause();
		} else if (e.key === 'Escape' && gameState === 'paused' && !phaseFailed) {
			engine?.resume();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="game-container">
	<canvas bind:this={canvas} class="game-canvas"></canvas>

	{#if activePrompt && gameState === 'playing'}
		<div class="tutorial-prompt" style="opacity: {promptOpacity}">
			<p class="prompt-text">{activePrompt.text}</p>
		</div>
	{/if}

	{#if gameState === 'waiting'}
		<div class="overlay fade-in">
			<h1 class="title-glow">TUTORIAL</h1>
			<p class="subtitle">Learn the basics step by step</p>
			<div class="keys-hint">
				<span class="key key-a">{laneKeys[0].toUpperCase()}</span>
				<span class="key key-s">{laneKeys[1].toUpperCase()}</span>
				<span class="key key-d">{laneKeys[2].toUpperCase()}</span>
			</div>
			<button class="start-btn glow-btn" onclick={handleStart}>
				START TUTORIAL
			</button>
			<a href="/" class="back-link">Back to Home</a>
		</div>
	{/if}

	{#if gameState === 'paused' && phaseFailed}
		<div class="overlay fade-in">
			<h2 class="retry-title">Try again!</h2>
			<p class="subtitle">Too many misses in this section</p>
			<button class="start-btn glow-btn" onclick={handleRetry}>
				RETRY
			</button>
			<a href="/" class="back-link">Back to Home</a>
		</div>
	{:else if gameState === 'paused' && !phaseFailed}
		<div class="overlay fade-in">
			<h2 class="title-glow">PAUSED</h2>
			<p class="hint">Press ESC to resume</p>
		</div>
	{/if}

	{#if tutorialComplete || gameState === 'results'}
		<div class="overlay scale-in">
			<h1 class="complete-title">Tutorial Complete!</h1>
			<div class="results-summary">
				<span class="result-stat">Perfects: {score.perfects}</span>
				<span class="result-stat">Goods: {score.goods}</span>
				<span class="result-stat">Misses: {score.misses}</span>
			</div>
			<div class="complete-actions">
				<a href="/play" class="start-btn glow-btn">Play Demo</a>
				<a href="/songs" class="start-btn songs-btn">Browse Songs</a>
			</div>
			<a href="/" class="back-link">Back to Home</a>
		</div>
	{/if}

	{#if gameState === 'playing'}
		<div class="mode-hud">
			<span class="hud-tag tutorial-tag">TUTORIAL</span>
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
		transition: background 0.2s, box-shadow 0.2s;
	}

	.start-btn:hover {
		background: #4488ff20;
		box-shadow: 0 0 30px rgba(68, 136, 255, 0.3);
	}

	.songs-btn {
		border-color: #44ff66;
		color: #44ff66;
	}

	.songs-btn:hover {
		background: #44ff6620;
		box-shadow: 0 0 30px rgba(68, 255, 102, 0.3);
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

	/* Tutorial prompt overlay */
	.tutorial-prompt {
		position: absolute;
		top: 12%;
		left: 50%;
		transform: translateX(-50%);
		pointer-events: none;
		z-index: 10;
		text-align: center;
	}

	.prompt-text {
		font-family: monospace;
		font-size: 28px;
		color: #88bbff;
		letter-spacing: 2px;
		text-shadow:
			0 0 15px rgba(68, 136, 255, 0.6),
			0 0 40px rgba(68, 136, 255, 0.3),
			0 0 80px rgba(68, 136, 255, 0.15);
		margin: 0;
	}

	/* Retry title */
	.retry-title {
		font-family: monospace;
		font-size: 40px;
		color: #ff8844;
		letter-spacing: 4px;
		text-shadow: 0 0 20px rgba(255, 136, 68, 0.5);
	}

	/* Complete title */
	@keyframes completeGlow {
		0%, 100% {
			text-shadow: 0 0 15px rgba(68, 255, 102, 0.4), 0 0 40px rgba(68, 255, 102, 0.15);
		}
		50% {
			text-shadow: 0 0 25px rgba(68, 255, 102, 0.7), 0 0 60px rgba(68, 255, 102, 0.3);
		}
	}

	.complete-title {
		color: #44ff66;
		animation: completeGlow 2s ease-in-out infinite;
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

	.complete-actions {
		display: flex;
		gap: 16px;
		margin-top: 8px;
	}

	/* Mode HUD */
	.mode-hud {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		pointer-events: none;
		z-index: 10;
	}

	.hud-tag {
		font-family: monospace;
		font-size: 11px;
		padding: 2px 8px;
		letter-spacing: 1px;
		border-radius: 3px;
	}

	.tutorial-tag {
		color: #88bbff;
		background: rgba(68, 136, 255, 0.15);
		border: 1px solid rgba(68, 136, 255, 0.3);
	}

	@media (max-width: 768px) {
		h1 { font-size: 28px; letter-spacing: 4px; }
		h2 { font-size: 24px; }
		.prompt-text { font-size: 20px; }
		.complete-actions { flex-direction: column; gap: 10px; }
		.results-summary { flex-direction: column; gap: 8px; align-items: center; }
	}
</style>
