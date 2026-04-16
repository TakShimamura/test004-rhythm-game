<script lang="ts">
	import { onMount } from 'svelte';
	import { createEngine, type Engine } from '$lib/game/engine.js';
	import { menuMusic } from '$lib/game/menu-music-store.js';
	import { accuracy } from '$lib/game/scoring.js';
	import { loadSettings, settingsToConfig } from '$lib/game/settings.js';
	import type { Chart, GameState, GameModeConfig, ScoreState } from '$lib/game/types.js';

	let canvas: HTMLCanvasElement;
	let engine: Engine | null = $state(null);
	let gameState: GameState = $state('waiting');
	let score: ScoreState = $state({ score: 0, combo: 0, maxCombo: 0, perfects: 0, goods: 0, misses: 0 });
	let laneKeys: [string, string, string] = $state(['a', 's', 'd']);
	let displayScore = $state(0);
	let animatingScore = $state(false);

	const ENDLESS_BPM = 130;

	/** Minimal "chart" shell for endless mode — the engine fills notes dynamically. */
	const endlessChart: Chart = {
		id: 'endless',
		songId: 'endless',
		difficulty: 'normal',
		bpm: ENDLESS_BPM,
		offsetMs: 0,
		notes: [],
		style: 'electro',
	};

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

	onMount(() => {
		menuMusic.fadeOutAndStop(0.5);

		const settings = loadSettings();
		const config = settingsToConfig(settings);
		laneKeys = settings.laneKeys;

		const modeConfig: GameModeConfig = {
			mode: 'endless',
			speedMultiplier: settings.defaultSpeedMultiplier,
			mirror: settings.defaultMirror,
			noFail: true, // endless always has no-fail
			practice: false,
		};

		engine = createEngine(canvas, endlessChart, config, {
			onStateChange(s) {
				gameState = s;
			},
			onScoreChange(s) {
				score = s;
			},
		}, modeConfig);

		return () => engine?.destroy();
	});

	function handleStart() {
		engine?.start();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && gameState === 'playing') {
			// In endless, ESC ends the run (goes to results)
			engine?.pause();
		} else if (e.key === 'Escape' && gameState === 'paused') {
			engine?.resume();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="game-container">
	<canvas bind:this={canvas} class="game-canvas"></canvas>

	{#if gameState === 'waiting'}
		<div class="overlay fade-in">
			<h1 class="title-glow">ENDLESS MODE</h1>
			<p class="subtitle">{ENDLESS_BPM} BPM — Infinite notes, increasing difficulty</p>
			<div class="keys-hint">
				<span class="key key-a pulse-key">{laneKeys[0].toUpperCase()}</span>
				<span class="key key-s pulse-key" style="animation-delay: 0.15s">{laneKeys[1].toUpperCase()}</span>
				<span class="key key-d pulse-key" style="animation-delay: 0.3s">{laneKeys[2].toUpperCase()}</span>
			</div>
			<button class="start-btn glow-btn" onclick={handleStart}>
				PRESS TO START
			</button>
			<p class="hint">Press ESC to end your run</p>
		</div>
	{/if}

	{#if gameState === 'playing'}
		<div class="mode-hud">
			<span class="hud-tag endless-tag">ENDLESS</span>
		</div>
	{/if}

	{#if gameState === 'paused'}
		<div class="overlay fade-in">
			<h2 class="title-glow">PAUSED</h2>
			<p class="hint">Press ESC to resume</p>
		</div>
	{/if}

	{#if gameState === 'results'}
		{@const acc = accuracy(score)}
		{@const grade = getGrade(acc)}
		<div class="overlay results scale-in">
			<div class="grade-display" style="--grade-color: {grade.color}">
				<span class="grade-letter">{grade.letter}</span>
			</div>
			<h1 class="title-glow">ENDLESS RESULTS</h1>
			<div class="results-grid">
				<div class="result-item">
					<span class="result-label">Score</span>
					<span class="result-value score-animated">{displayScore}</span>
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
			<a href="/play/endless" class="start-btn glow-btn">PLAY AGAIN</a>
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

	.fade-in { animation: fadeIn 0.4s ease-out; }
	.scale-in { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); }

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
			text-shadow: 0 0 20px rgba(68, 136, 255, 0.6), 0 0 50px rgba(68, 136, 255, 0.2), 0 0 80px rgba(68, 136, 255, 0.1);
		}
	}

	.title-glow { animation: titleGlow 2.5s ease-in-out infinite; }

	@keyframes pulseKey {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.08); }
	}

	.pulse-key { animation: pulseKey 1.5s ease-in-out infinite; }

	@keyframes glowBtnPulse {
		0%, 100% { box-shadow: 0 0 8px rgba(68, 136, 255, 0.2); }
		50% { box-shadow: 0 0 20px rgba(68, 136, 255, 0.4), 0 0 40px rgba(68, 136, 255, 0.1); }
	}

	.glow-btn { animation: glowBtnPulse 2s ease-in-out infinite; }

	h1 { font-family: monospace; font-size: 48px; letter-spacing: 8px; margin: 0; }
	h2 { font-family: monospace; font-size: 36px; letter-spacing: 4px; margin: 0; }

	.subtitle { font-family: monospace; color: #888; font-size: 16px; }

	.keys-hint { display: flex; gap: 12px; margin: 16px 0; }

	.key {
		display: flex; align-items: center; justify-content: center;
		width: 48px; height: 48px; border: 2px solid #444; border-radius: 8px;
		font-family: monospace; font-size: 20px; font-weight: bold;
	}

	.key-a { border-color: #ff4466; color: #ff4466; box-shadow: 0 0 10px rgba(255, 68, 102, 0.2); }
	.key-s { border-color: #44ff66; color: #44ff66; box-shadow: 0 0 10px rgba(68, 255, 102, 0.2); }
	.key-d { border-color: #4488ff; color: #4488ff; box-shadow: 0 0 10px rgba(68, 136, 255, 0.2); }

	.start-btn {
		font-family: monospace; font-size: 18px; padding: 12px 32px;
		background: transparent; border: 2px solid #4488ff; color: #4488ff;
		cursor: pointer; letter-spacing: 2px; text-decoration: none;
		transition: background 0.2s, box-shadow 0.2s;
	}

	.start-btn:hover {
		background: #4488ff20;
		box-shadow: 0 0 30px rgba(68, 136, 255, 0.3);
	}

	.hint { font-family: monospace; color: #555; font-size: 14px; }

	.grade-display { position: relative; margin-bottom: 8px; }

	.grade-letter {
		font-family: monospace; font-size: 96px; font-weight: bold;
		color: var(--grade-color);
		text-shadow: 0 0 20px var(--grade-color), 0 0 40px var(--grade-color), 0 0 80px var(--grade-color);
		animation: gradeAppear 0.8s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes gradeAppear {
		from { opacity: 0; transform: scale(2); filter: blur(10px); }
		to { opacity: 1; transform: scale(1); filter: blur(0); }
	}

	.score-animated { color: #fff; transition: color 0.1s; }

	.results-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; margin: 16px 0; }
	.result-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
	.result-label { font-family: monospace; color: #888; font-size: 14px; }
	.result-label.perfect { color: #ffdd00; }
	.result-label.good { color: #88ff88; }
	.result-label.miss { color: #ff4444; }
	.result-value { font-family: monospace; font-size: 24px; font-weight: bold; }

	.back-link { font-family: monospace; color: #555; font-size: 14px; text-decoration: none; }
	.back-link:hover { color: #888; }

	/* Mode HUD */
	.mode-hud {
		position: absolute; top: 8px; right: 8px;
		display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
		pointer-events: none; z-index: 10;
	}

	.hud-tag {
		font-family: monospace; font-size: 11px; padding: 2px 8px;
		letter-spacing: 1px; border-radius: 3px;
	}

	.endless-tag {
		color: #ff44dd;
		background: rgba(255, 68, 221, 0.15);
		border: 1px solid rgba(255, 68, 221, 0.3);
	}
</style>
