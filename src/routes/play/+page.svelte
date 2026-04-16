<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { createEngine, type Engine } from '$lib/game/engine.js';
	import { menuMusic } from '$lib/game/menu-music-store.js';
	import { DEMO_CHART, ALL_CHARTS } from '$lib/chart/songs.js';
	import { accuracy } from '$lib/game/scoring.js';
	import { loadSettings, saveSettings, settingsToConfig } from '$lib/game/settings.js';
	import { authClient } from '$lib/auth-client.js';
	import { generateStatsCard, downloadStatsCard } from '$lib/game/stats-card.js';
	import type { Chart, GameState, GameModeConfig, ScoreState } from '$lib/game/types.js';

	let canvas: HTMLCanvasElement;
	let shareCanvas: HTMLCanvasElement | undefined = $state(undefined);
	let showShareCard = $state(false);
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
	let displayScore = $state(0);
	let animatingScore = $state(false);
	let lastDeltaMs: number | null = $state(null);

	// Replay state
	let replaySaved = $state(false);
	let replayId: string | null = $state(null);
	let replayLinkCopied = $state(false);
	let savingReplay = $state(false);
	let lastScoreId: string | null = null;

	// Mode config state
	let speedMultiplier = $state(1.0);
	let mirrorEnabled = $state(false);
	let noFailEnabled = $state(false);
	let practiceEnabled = $state(false);

	// Mobile detection
	let isMobile = $state(false);
	let touchZonePressed: [boolean, boolean, boolean] = $state([false, false, false]);
	const TOUCH_LANE_COLORS = ['#ff4466', '#44ff66', '#4488ff'];
	const TOUCH_LANE_LABELS = ['A', 'S', 'D'];

	const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.5, 2.0];

	const session = authClient.useSession();

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

	async function loadChart(): Promise<Chart> {
		const chartId = page.url.searchParams.get('chart');
		if (!chartId) return DEMO_CHART;

		// Check built-in charts first (they carry style metadata)
		const builtIn = ALL_CHARTS.find((c) => c.id === chartId);
		if (builtIn) return builtIn;

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

		const res = await fetch('/api/scores', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chartId,
				score: s.score,
				maxCombo: s.maxCombo,
				accuracy: accuracy(s),
			}),
		});

		if (res.ok) {
			const data = await res.json();
			// Store the scoreId for potential replay save later
			lastScoreId = data.id;
		}

		await loadLeaderboard(chartId);
	}

	async function handleSaveReplay() {
		if (!$session.data || !engine || savingReplay || replaySaved) return;

		savingReplay = true;
		const rd = engine.getReplayData();

		// Submit a new score entry with replay events attached
		const res = await fetch('/api/scores', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chartId: activeChartId,
				score: score.score,
				maxCombo: score.maxCombo,
				accuracy: accuracy(score),
				replayEvents: rd.events,
			}),
		});

		if (res.ok) {
			const data = await res.json();
			if (data.replayId) {
				replayId = data.replayId;
				replaySaved = true;
			}
		}
		savingReplay = false;
	}

	function handleCopyReplayLink() {
		if (!replayId) return;
		const url = `${window.location.origin}/replay/${replayId}`;
		navigator.clipboard.writeText(url);
		replayLinkCopied = true;
		setTimeout(() => { replayLinkCopied = false; }, 2000);
	}

	async function loadLeaderboard(chartId: string) {
		const res = await fetch(`/api/charts/${chartId}/leaderboard`);
		if (res.ok) leaderboard = await res.json();
	}

	function buildModeConfig(): GameModeConfig {
		return {
			mode: practiceEnabled ? 'practice' : noFailEnabled ? 'nofail' : mirrorEnabled ? 'mirror' : 'normal',
			speedMultiplier,
			mirror: mirrorEnabled,
			noFail: noFailEnabled,
			practice: practiceEnabled,
		};
	}

	let loadedChart: Chart | null = null;

	function initEngine(chart: Chart) {
		engine?.destroy();
		score = { score: 0, combo: 0, maxCombo: 0, perfects: 0, goods: 0, misses: 0 };
		displayScore = 0;
		scoreSubmitted = false;
		replaySaved = false;
		replayId = null;
		replayLinkCopied = false;
		gameState = 'waiting';

		const settings = loadSettings();
		const config = settingsToConfig(settings);
		laneKeys = settings.laneKeys;
		const mc = buildModeConfig();

		engine = createEngine(canvas, chart, config, {
			onStateChange(s) {
				gameState = s;
				if (s === 'results') {
					submitScore(chart.id, score);
				}
			},
			onScoreChange(s) {
				score = s;
				lastDeltaMs = engine?.getLastDeltaMs() ?? null;
			},
		}, mc);
	}

	onMount(() => {
		// Ensure menu music is stopped when entering the play page
		menuMusic.fadeOutAndStop(0.5);

		isMobile = 'ontouchstart' in window || window.innerWidth < 768;

		const settings = loadSettings();
		speedMultiplier = settings.defaultSpeedMultiplier;
		mirrorEnabled = settings.defaultMirror;

		// Update touch lane labels from settings
		if (settings.laneKeys) {
			TOUCH_LANE_LABELS[0] = settings.laneKeys[0].toUpperCase();
			TOUCH_LANE_LABELS[1] = settings.laneKeys[1].toUpperCase();
			TOUCH_LANE_LABELS[2] = settings.laneKeys[2].toUpperCase();
		}

		// Track touch zone press state for visual feedback
		function updateTouchZones(e: TouchEvent) {
			const pressed: [boolean, boolean, boolean] = [false, false, false];
			const screenW = window.innerWidth;
			const third = screenW / 3;
			for (let i = 0; i < e.touches.length; i++) {
				const x = e.touches[i].clientX;
				if (x < third) pressed[0] = true;
				else if (x < third * 2) pressed[1] = true;
				else pressed[2] = true;
			}
			touchZonePressed = pressed;
		}

		function clearTouchZones() {
			touchZonePressed = [false, false, false];
		}

		if (isMobile) {
			window.addEventListener('touchstart', updateTouchZones, { passive: true });
			window.addEventListener('touchmove', updateTouchZones, { passive: true });
			window.addEventListener('touchend', updateTouchZones, { passive: true });
			window.addEventListener('touchcancel', clearTouchZones, { passive: true });
		}

		loadChart().then((chart) => {
			chartBpm = chart.bpm;
			activeChartId = chart.id;
			loading = false;
			loadedChart = chart;
			initEngine(chart);
		});

		return () => {
			engine?.destroy();
			if (isMobile) {
				window.removeEventListener('touchstart', updateTouchZones);
				window.removeEventListener('touchmove', updateTouchZones);
				window.removeEventListener('touchend', updateTouchZones);
				window.removeEventListener('touchcancel', clearTouchZones);
			}
		};
	});

	function handleStart() {
		// Crossfade menu music out before gameplay starts
		menuMusic.fadeOutAndStop(0.5);

		// Re-init engine with latest mode config before starting
		if (loadedChart) {
			initEngine(loadedChart);
		}
		// Use a microtask to let the engine initialize
		queueMicrotask(() => engine?.start());

		// Persist speed/mirror preferences
		const settings = loadSettings();
		settings.defaultSpeedMultiplier = speedMultiplier;
		settings.defaultMirror = mirrorEnabled;
		saveSettings(settings);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && gameState === 'playing') {
			engine?.pause();
		} else if (e.key === 'Escape' && gameState === 'paused') {
			engine?.resume();
		}
		// Practice mode: R to restart
		if (e.key === 'r' && practiceEnabled && (gameState === 'playing' || gameState === 'paused')) {
			engine?.restart();
		}
	}

	function handleShare(): void {
		showShareCard = true;
		// Wait for canvas to bind, then render
		requestAnimationFrame(() => {
			if (!shareCanvas) return;
			const acc = accuracy(score);
			const grade = getGrade(acc);
			generateStatsCard(shareCanvas, {
				playerName: $session.data?.user.name ?? 'Player',
				level: 1,
				grade: grade.letter,
				score: score.score,
				accuracy: acc,
				maxCombo: score.maxCombo,
				songTitle: chartTitle,
				difficulty: 'normal',
			});
		});
	}

	function handleDownloadCard(): void {
		if (shareCanvas) {
			downloadStatsCard(shareCanvas);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="game-container">
	<canvas bind:this={canvas} class="game-canvas"></canvas>

	{#if loading}
		<div class="overlay fade-in">
			<div class="spinner"></div>
			<p class="subtitle">Loading chart...</p>
		</div>
	{:else if gameState === 'waiting'}
		<div class="overlay fade-in">
			<h1 class="title-glow">RHYTHM GAME</h1>
			<p class="subtitle">{chartTitle} — {chartBpm} BPM</p>
			{#if isMobile}
				<p class="mobile-hint">TAP THE ZONES</p>
			{:else}
				<div class="keys-hint">
					<span class="key key-a pulse-key">{laneKeys[0].toUpperCase()}</span>
					<span class="key key-s pulse-key" style="animation-delay: 0.15s">{laneKeys[1].toUpperCase()}</span>
					<span class="key key-d pulse-key" style="animation-delay: 0.3s">{laneKeys[2].toUpperCase()}</span>
				</div>
			{/if}

			<div class="mode-options">
				<div class="speed-selector">
					<span class="mode-label">SPEED</span>
					<div class="speed-buttons">
						{#each SPEED_OPTIONS as spd}
							<button
								class="speed-btn"
								class:active={speedMultiplier === spd}
								onclick={() => { speedMultiplier = spd; }}
							>
								{spd}x
							</button>
						{/each}
					</div>
				</div>
				<div class="toggle-row">
					<button
						class="toggle-btn"
						class:active={mirrorEnabled}
						onclick={() => { mirrorEnabled = !mirrorEnabled; }}
					>
						MIRROR
					</button>
					<button
						class="toggle-btn"
						class:active={noFailEnabled}
						onclick={() => { noFailEnabled = !noFailEnabled; }}
					>
						NO FAIL
					</button>
					<button
						class="toggle-btn"
						class:active={practiceEnabled}
						onclick={() => { practiceEnabled = !practiceEnabled; }}
					>
						PRACTICE
					</button>
				</div>
			</div>

			<button class="start-btn glow-btn" onclick={handleStart}>
				PRESS TO START
			</button>
			<p class="hint">Hit the notes as they reach the circles</p>
			{#if practiceEnabled}
				<p class="hint">Practice: press R to restart</p>
			{/if}
		</div>
	{/if}

	{#if gameState === 'playing'}
		<div class="mode-hud">
			{#if noFailEnabled}
				<span class="hud-tag nofail-tag">NO FAIL</span>
			{/if}
			{#if mirrorEnabled}
				<span class="hud-tag mirror-tag">MIRROR</span>
			{/if}
			{#if speedMultiplier !== 1.0}
				<span class="hud-tag speed-tag">{speedMultiplier}x</span>
			{/if}
			{#if practiceEnabled}
				<span class="hud-tag practice-tag">PRACTICE</span>
				{#if lastDeltaMs !== null}
					<span class="hud-delta" class:early={lastDeltaMs < 0} class:late={lastDeltaMs > 0}>
						{lastDeltaMs > 0 ? '+' : ''}{lastDeltaMs.toFixed(1)}ms
					</span>
				{/if}
				<span class="hud-hint">R = restart</span>
			{/if}
		</div>
	{/if}

	{#if gameState === 'paused'}
		<div class="overlay fade-in">
			<h2 class="title-glow">PAUSED</h2>
			<p class="hint">Press ESC to resume</p>
			{#if practiceEnabled}
				<p class="hint">Press R to restart</p>
			{/if}
		</div>
	{/if}

	{#if gameState === 'results'}
		{@const acc = accuracy(score)}
		{@const grade = getGrade(acc)}
		{@const isFullCombo = score.misses === 0 && (score.perfects + score.goods) > 0}
		<div class="overlay results scale-in">
			{#if isFullCombo}
				<div class="full-combo-banner">FULL COMBO!</div>
			{/if}
			<div class="grade-display" style="--grade-color: {grade.color}">
				<span class="grade-letter">{grade.letter}</span>
			</div>
			<h1 class="title-glow">RESULTS</h1>
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

			<div class="results-actions">
				<a href="/play" class="start-btn glow-btn">PLAY AGAIN</a>
				<button class="share-btn" onclick={handleShare}>SHARE</button>
				{#if $session.data}
					{#if replaySaved}
						<span class="replay-saved-msg">Replay saved!</span>
						<button class="replay-link-btn" onclick={handleCopyReplayLink}>
							{replayLinkCopied ? 'COPIED!' : 'COPY LINK'}
						</button>
					{:else}
						<button
							class="save-replay-btn"
							onclick={handleSaveReplay}
							disabled={savingReplay}
						>
							{savingReplay ? 'SAVING...' : 'SAVE REPLAY'}
						</button>
					{/if}
				{/if}
			</div>

			{#if showShareCard}
				<div class="share-card-container">
					<canvas bind:this={shareCanvas} width="480" height="320"></canvas>
					<button class="download-btn" onclick={handleDownloadCard}>DOWNLOAD IMAGE</button>
				</div>
			{/if}

			<a href="/" class="back-link">Back to Home</a>
		</div>
	{/if}

	{#if isMobile && (gameState === 'playing' || gameState === 'waiting')}
		<div class="touch-zones">
			{#each [0, 1, 2] as lane}
				<div
					class="touch-zone"
					class:pressed={touchZonePressed[lane]}
					style="--zone-color: {TOUCH_LANE_COLORS[lane]}"
				>
					<span class="touch-zone-label">{TOUCH_LANE_LABELS[lane]}</span>
				</div>
			{/each}
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
		from {
			opacity: 0;
			transform: scale(0.9);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes titleGlow {
		0%, 100% {
			text-shadow:
				0 0 10px rgba(68, 136, 255, 0.3),
				0 0 30px rgba(68, 136, 255, 0.1);
		}
		50% {
			text-shadow:
				0 0 20px rgba(68, 136, 255, 0.6),
				0 0 50px rgba(68, 136, 255, 0.2),
				0 0 80px rgba(68, 136, 255, 0.1);
		}
	}

	.title-glow {
		animation: titleGlow 2.5s ease-in-out infinite;
	}

	@keyframes pulseKey {
		0%, 100% {
			transform: scale(1);
			box-shadow: 0 0 0 0 transparent;
		}
		50% {
			transform: scale(1.08);
		}
	}

	.pulse-key {
		animation: pulseKey 1.5s ease-in-out infinite;
	}

	@keyframes glowBtnPulse {
		0%, 100% {
			box-shadow: 0 0 8px rgba(68, 136, 255, 0.2);
		}
		50% {
			box-shadow: 0 0 20px rgba(68, 136, 255, 0.4), 0 0 40px rgba(68, 136, 255, 0.1);
		}
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

	.key-a { border-color: #ff4466; color: #ff4466; box-shadow: 0 0 10px rgba(255, 68, 102, 0.2); }
	.key-s { border-color: #44ff66; color: #44ff66; box-shadow: 0 0 10px rgba(68, 255, 102, 0.2); }
	.key-d { border-color: #4488ff; color: #4488ff; box-shadow: 0 0 10px rgba(68, 136, 255, 0.2); }

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

	.hint {
		font-family: monospace;
		color: #555;
		font-size: 14px;
	}

	/* Grade display */
	.grade-display {
		position: relative;
		margin-bottom: 8px;
	}

	.grade-letter {
		font-family: monospace;
		font-size: 96px;
		font-weight: bold;
		color: var(--grade-color);
		text-shadow:
			0 0 20px var(--grade-color),
			0 0 40px var(--grade-color),
			0 0 80px var(--grade-color);
		animation: gradeAppear 0.8s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes gradeAppear {
		from {
			opacity: 0;
			transform: scale(2);
			filter: blur(10px);
		}
		to {
			opacity: 1;
			transform: scale(1);
			filter: blur(0);
		}
	}

	.score-animated {
		color: #fff;
		transition: color 0.1s;
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

	.results-actions {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.share-btn {
		font-family: monospace;
		font-size: 14px;
		padding: 12px 24px;
		background: transparent;
		border: 2px solid #aa88ff;
		color: #aa88ff;
		cursor: pointer;
		letter-spacing: 2px;
		transition: background 0.2s;
	}

	.share-btn:hover {
		background: #aa88ff20;
	}

	.save-replay-btn {
		font-family: monospace;
		font-size: 14px;
		padding: 12px 24px;
		background: transparent;
		border: 2px solid #ff8844;
		color: #ff8844;
		cursor: pointer;
		letter-spacing: 2px;
		transition: background 0.2s;
	}

	.save-replay-btn:hover {
		background: #ff884420;
	}

	.save-replay-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.replay-saved-msg {
		font-family: monospace;
		font-size: 13px;
		color: #44ff66;
		letter-spacing: 1px;
	}

	.replay-link-btn {
		font-family: monospace;
		font-size: 12px;
		padding: 8px 16px;
		background: transparent;
		border: 1px solid #44ff66;
		color: #44ff66;
		cursor: pointer;
		letter-spacing: 1px;
		transition: background 0.2s;
	}

	.replay-link-btn:hover {
		background: #44ff6620;
	}

	.share-card-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}

	.share-card-container canvas {
		border: 1px solid #333;
	}

	.download-btn {
		font-family: monospace;
		font-size: 12px;
		padding: 8px 16px;
		background: transparent;
		border: 1px solid #44ff66;
		color: #44ff66;
		cursor: pointer;
		letter-spacing: 1px;
		transition: background 0.2s;
	}

	.download-btn:hover {
		background: #44ff6620;
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

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(68, 136, 255, 0.2);
		border-top-color: #4488ff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Mode selection UI */
	.mode-options {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		margin: 8px 0;
	}

	.mode-label {
		font-family: monospace;
		font-size: 12px;
		color: #888;
		letter-spacing: 2px;
	}

	.speed-selector {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
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

	.toggle-row {
		display: flex;
		gap: 8px;
	}

	.toggle-btn {
		font-family: monospace;
		font-size: 12px;
		padding: 6px 14px;
		background: transparent;
		border: 1px solid #333;
		color: #666;
		cursor: pointer;
		letter-spacing: 1px;
		transition: all 0.15s;
	}

	.toggle-btn:hover {
		border-color: #666;
		color: #aaa;
	}

	.toggle-btn.active {
		border-color: #ffdd00;
		color: #ffdd00;
		background: rgba(255, 221, 0, 0.1);
		box-shadow: 0 0 8px rgba(255, 221, 0, 0.15);
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

	.nofail-tag {
		color: #ff8844;
		background: rgba(255, 136, 68, 0.15);
		border: 1px solid rgba(255, 136, 68, 0.3);
	}

	.mirror-tag {
		color: #cc44ff;
		background: rgba(204, 68, 255, 0.15);
		border: 1px solid rgba(204, 68, 255, 0.3);
	}

	.speed-tag {
		color: #44ddff;
		background: rgba(68, 221, 255, 0.15);
		border: 1px solid rgba(68, 221, 255, 0.3);
	}

	.practice-tag {
		color: #ffdd00;
		background: rgba(255, 221, 0, 0.15);
		border: 1px solid rgba(255, 221, 0, 0.3);
	}

	.hud-delta {
		font-family: monospace;
		font-size: 13px;
		font-weight: bold;
	}

	.hud-delta.early { color: #44aaff; }
	.hud-delta.late { color: #ff8844; }

	.hud-hint {
		font-family: monospace;
		font-size: 10px;
		color: #555;
	}

	/* Full combo banner */
	.full-combo-banner {
		font-family: monospace;
		font-size: 32px;
		font-weight: bold;
		letter-spacing: 6px;
		color: #ffdd00;
		text-shadow:
			0 0 10px rgba(255, 221, 0, 0.8),
			0 0 30px rgba(255, 221, 0, 0.4),
			0 0 60px rgba(255, 221, 0, 0.2);
		animation: fullComboAnim 1.5s ease-in-out infinite;
	}

	@keyframes fullComboAnim {
		0%, 100% {
			transform: scale(1);
			text-shadow:
				0 0 10px rgba(255, 221, 0, 0.8),
				0 0 30px rgba(255, 221, 0, 0.4);
		}
		50% {
			transform: scale(1.1);
			text-shadow:
				0 0 20px rgba(255, 221, 0, 1),
				0 0 50px rgba(255, 221, 0, 0.6),
				0 0 80px rgba(255, 221, 0, 0.3);
		}
	}

	/* Mobile touch zones */
	.mobile-hint {
		font-family: monospace;
		font-size: 18px;
		color: #888;
		letter-spacing: 4px;
		margin: 16px 0;
		animation: pulseKey 1.5s ease-in-out infinite;
	}

	.touch-zones {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 120px;
		display: flex;
		z-index: 20;
		pointer-events: none;
	}

	.touch-zone {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--zone-color) 15%, transparent);
		border-top: 2px solid color-mix(in srgb, var(--zone-color) 40%, transparent);
		transition: background 0.08s;
	}

	.touch-zone:not(:last-child) {
		border-right: 1px solid rgba(255, 255, 255, 0.08);
	}

	.touch-zone.pressed {
		background: color-mix(in srgb, var(--zone-color) 40%, transparent);
	}

	.touch-zone-label {
		font-family: monospace;
		font-size: 28px;
		font-weight: bold;
		color: var(--zone-color);
		opacity: 0.6;
		text-shadow: 0 0 10px var(--zone-color);
	}

	.touch-zone.pressed .touch-zone-label {
		opacity: 1;
		text-shadow: 0 0 20px var(--zone-color), 0 0 40px var(--zone-color);
	}

	/* Mobile responsive for play page */
	@media (max-width: 768px) {
		h1 {
			font-size: 28px;
			letter-spacing: 4px;
		}

		h2 {
			font-size: 24px;
		}

		.subtitle {
			font-size: 13px;
		}

		.results-grid {
			grid-template-columns: 1fr 1fr;
			gap: 8px 16px;
		}

		.leaderboard {
			width: 90vw;
			max-width: 320px;
		}

		.mode-options {
			width: 90vw;
		}

		.speed-buttons {
			flex-wrap: wrap;
			justify-content: center;
		}

		.toggle-row {
			flex-wrap: wrap;
			justify-content: center;
		}
	}
</style>
