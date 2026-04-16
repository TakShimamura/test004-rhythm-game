<script lang="ts">
	import { onMount } from 'svelte';
	import { loadSettings, saveSettings, type UserSettings } from '$lib/game/settings.js';

	let settings: UserSettings = $state({
		laneKeys: ['a', 's', 'd'],
		audioOffsetMs: 0,
		scrollSpeedPx: 600,
	});

	let listeningLane: number | null = $state(null);
	let saved = $state(false);

	onMount(() => {
		settings = loadSettings();
	});

	function startListening(lane: number) {
		listeningLane = lane;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (listeningLane === null) return;
		e.preventDefault();
		const key = e.key.toLowerCase();
		if (key === 'escape') {
			listeningLane = null;
			return;
		}
		settings.laneKeys[listeningLane] = key;
		listeningLane = null;
	}

	function handleSave() {
		saveSettings(settings);
		saved = true;
		setTimeout(() => saved = false, 1500);
	}

	function handleReset() {
		settings = {
			laneKeys: ['a', 's', 'd'],
			audioOffsetMs: 0,
			scrollSpeedPx: 600,
		};
		saveSettings(settings);
		saved = true;
		setTimeout(() => saved = false, 1500);
	}

	const laneColors = ['#ff4466', '#44ff66', '#4488ff'];
	const laneNames = ['Left', 'Center', 'Right'];
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="settings-page">
	<h1>SETTINGS</h1>

	<section>
		<h2>KEY BINDINGS</h2>
		<div class="key-bindings">
			{#each [0, 1, 2] as lane}
				<div class="key-row">
					<span class="lane-label" style="color: {laneColors[lane]}">{laneNames[lane]}</span>
					<button
						class="key-btn"
						class:listening={listeningLane === lane}
						style="border-color: {laneColors[lane]}"
						onclick={() => startListening(lane)}
					>
						{#if listeningLane === lane}
							Press a key...
						{:else}
							{settings.laneKeys[lane].toUpperCase()}
						{/if}
					</button>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<h2>AUDIO OFFSET</h2>
		<p class="desc">Adjust if notes feel early or late. Negative = notes arrive earlier.</p>
		<div class="slider-row">
			<input
				type="range"
				min="-100"
				max="100"
				step="5"
				bind:value={settings.audioOffsetMs}
			/>
			<span class="value">{settings.audioOffsetMs}ms</span>
		</div>
	</section>

	<section>
		<h2>SCROLL SPEED</h2>
		<p class="desc">How fast notes fall. Higher = faster, less reaction time.</p>
		<div class="slider-row">
			<input
				type="range"
				min="300"
				max="1200"
				step="50"
				bind:value={settings.scrollSpeedPx}
			/>
			<span class="value">{settings.scrollSpeedPx}px/s</span>
		</div>
	</section>

	<div class="actions">
		<button class="save-btn" onclick={handleSave}>
			{saved ? 'SAVED!' : 'SAVE'}
		</button>
		<button class="reset-btn" onclick={handleReset}>
			RESET DEFAULTS
		</button>
	</div>

	<a href="/" class="back-link">&larr; Back to Home</a>
</div>

<style>
	.settings-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 100vh;
		background: #0a0a0f;
		color: #fff;
		padding: 48px 24px;
		gap: 32px;
		font-family: monospace;
	}

	h1 {
		font-size: 36px;
		letter-spacing: 6px;
		margin: 0;
	}

	h2 {
		font-size: 16px;
		letter-spacing: 3px;
		color: #888;
		margin: 0 0 12px;
	}

	section {
		width: 100%;
		max-width: 400px;
	}

	.desc {
		color: #555;
		font-size: 12px;
		margin: 0 0 8px;
	}

	.key-bindings {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.key-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.lane-label {
		font-size: 14px;
		font-weight: bold;
	}

	.key-btn {
		background: transparent;
		border: 2px solid #444;
		color: #fff;
		font-family: monospace;
		font-size: 16px;
		padding: 8px 24px;
		min-width: 120px;
		cursor: pointer;
		text-align: center;
	}

	.key-btn.listening {
		border-color: #ffdd00;
		color: #ffdd00;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	input[type="range"] {
		flex: 1;
		accent-color: #4488ff;
	}

	.value {
		font-size: 14px;
		color: #4488ff;
		min-width: 70px;
		text-align: right;
	}

	.actions {
		display: flex;
		gap: 12px;
	}

	.save-btn {
		font-family: monospace;
		font-size: 16px;
		padding: 10px 32px;
		background: transparent;
		border: 2px solid #44ff66;
		color: #44ff66;
		cursor: pointer;
		letter-spacing: 2px;
	}

	.save-btn:hover { background: #44ff6620; }

	.reset-btn {
		font-family: monospace;
		font-size: 16px;
		padding: 10px 32px;
		background: transparent;
		border: 2px solid #555;
		color: #888;
		cursor: pointer;
		letter-spacing: 2px;
	}

	.reset-btn:hover { background: #ffffff10; }

	.back-link {
		font-family: monospace;
		color: #555;
		font-size: 14px;
		text-decoration: none;
	}

	.back-link:hover { color: #888; }
</style>
