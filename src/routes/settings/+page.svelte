<script lang="ts">
	import { onMount } from 'svelte';
	import { loadSettings, saveSettings, type UserSettings } from '$lib/game/settings.js';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import type { NoteSkin, HighwayTheme, HitEffect, ComboColor } from '$lib/game/types.js';

	let settings: UserSettings = $state({
		laneKeys: ['a', 's', 'd'],
		audioOffsetMs: 0,
		scrollSpeedPx: 600,
		defaultSpeedMultiplier: 1.0,
		defaultMirror: false,
		noteSkin: 'classic' as NoteSkin,
		colorblindMode: false,
		noteScale: 1.0,
		highwayTheme: 'default' as HighwayTheme,
		hitEffect: 'sparkle' as HitEffect,
		comboColor: 'default' as ComboColor,
		masterVolume: 1.0,
		musicVolume: 0.7,
		sfxVolume: 0.8,
		uiVolume: 0.5,
	});

	const NOTE_SKINS: { value: NoteSkin; label: string; desc: string }[] = [
		{ value: 'classic', label: 'Classic', desc: 'Circles, diamonds, and squares with gradient fills' },
		{ value: 'neon', label: 'Neon', desc: 'Hollow outlines with bright glow, no fill' },
		{ value: 'minimal', label: 'Minimal', desc: 'Simple small dots, very clean' },
	];
	const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.5, 2.0];

	const HIGHWAY_THEMES: { value: HighwayTheme; label: string; desc: string }[] = [
		{ value: 'default', label: 'Default', desc: 'Dark gradient with grid lines and starfield' },
		{ value: 'space', label: 'Space', desc: 'Deep black with nebula clouds and planet silhouette' },
		{ value: 'ocean', label: 'Ocean', desc: 'Dark blue with wave lines, bubbles, and bioluminescence' },
		{ value: 'cyberpunk', label: 'Cyberpunk', desc: 'Pink/cyan hex grid, glitch lines, neon skyline' },
		{ value: 'forest', label: 'Forest', desc: 'Dark green with floating leaves and firefly lights' },
	];

	const HIT_EFFECTS: { value: HitEffect; label: string; desc: string }[] = [
		{ value: 'sparkle', label: 'Sparkle', desc: 'Classic radial burst with trails on perfects' },
		{ value: 'splash', label: 'Splash', desc: 'Wave-like arc pattern with blue tones and gravity' },
		{ value: 'lightning', label: 'Lightning', desc: 'Fast bright lines radiating outward, quick decay' },
		{ value: 'pixel', label: 'Pixel', desc: 'Grid-explosion of small square particles' },
	];

	const COMBO_COLORS: { value: ComboColor; label: string; desc: string }[] = [
		{ value: 'default', label: 'Default', desc: 'Yellow fire glow at 10+ combo' },
		{ value: 'rainbow', label: 'Rainbow', desc: 'Cycles through hues based on combo count' },
		{ value: 'fire', label: 'Fire', desc: 'Orange to red to white as combo grows' },
		{ value: 'ice', label: 'Ice', desc: 'Light blue to cyan to white as combo grows' },
	];

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
			defaultSpeedMultiplier: 1.0,
			defaultMirror: false,
			noteSkin: 'classic',
			colorblindMode: false,
			noteScale: 1.0,
			highwayTheme: 'default',
			hitEffect: 'sparkle',
			comboColor: 'default',
			masterVolume: 1.0,
			musicVolume: 0.7,
			sfxVolume: 0.8,
			uiVolume: 0.5,
		};
		saveSettings(settings);
		saved = true;
		setTimeout(() => saved = false, 1500);
	}

	const laneColors = ['#ff4466', '#44ff66', '#4488ff'];
	const laneNames = ['Left', 'Center', 'Right'];
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="settings-page" style="position: relative;">
	<Tooltip key="settings-hint" text="Customize your controls and visuals" position="top" />
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
		<h2>VOLUME</h2>
		<p class="desc">Adjust volume levels for each audio channel.</p>
		<div class="volume-group">
			<div class="slider-row">
				<span class="vol-label">Master</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					bind:value={settings.masterVolume}
				/>
				<span class="value">{Math.round(settings.masterVolume * 100)}%</span>
			</div>
			<div class="slider-row">
				<span class="vol-label">Music</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					bind:value={settings.musicVolume}
				/>
				<span class="value">{Math.round(settings.musicVolume * 100)}%</span>
			</div>
			<div class="slider-row">
				<span class="vol-label">SFX</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					bind:value={settings.sfxVolume}
				/>
				<span class="value">{Math.round(settings.sfxVolume * 100)}%</span>
			</div>
			<div class="slider-row">
				<span class="vol-label">UI</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					bind:value={settings.uiVolume}
				/>
				<span class="value">{Math.round(settings.uiVolume * 100)}%</span>
			</div>
		</div>
	</section>

	<section>
		<h2>CALIBRATION</h2>
		<p class="desc">Auto-detect your audio latency by tapping along with a metronome.</p>
		<a href="/calibrate" class="calibrate-link">RUN CALIBRATION</a>
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

	<section>
		<h2>NOTE SKIN</h2>
		<p class="desc">Change how notes look on the highway.</p>
		<div class="skin-options">
			{#each NOTE_SKINS as skin}
				<button
					class="skin-btn"
					class:active={settings.noteSkin === skin.value}
					onclick={() => { settings.noteSkin = skin.value; }}
				>
					<span class="skin-label">{skin.label}</span>
					<span class="skin-desc">{skin.desc}</span>
				</button>
			{/each}
		</div>
	</section>

	<section>
		<h2>DEFAULT SPEED MULTIPLIER</h2>
		<p class="desc">Pre-selected speed when starting a song.</p>
		<div class="speed-buttons">
			{#each SPEED_OPTIONS as spd}
				<button
					class="spd-btn"
					class:active={settings.defaultSpeedMultiplier === spd}
					onclick={() => { settings.defaultSpeedMultiplier = spd; }}
				>
					{spd}x
				</button>
			{/each}
		</div>
	</section>

	<section>
		<h2>DEFAULT MIRROR MODE</h2>
		<p class="desc">Flip lanes by default when starting a song.</p>
		<button
			class="mirror-toggle"
			class:active={settings.defaultMirror}
			onclick={() => { settings.defaultMirror = !settings.defaultMirror; }}
		>
			{settings.defaultMirror ? 'ON' : 'OFF'}
		</button>
	</section>

	<section>
		<h2>COLORBLIND MODE</h2>
		<p class="desc">Adds distinct patterns inside notes and uses a colorblind-safe color palette.</p>
		<button
			class="mirror-toggle"
			class:active={settings.colorblindMode}
			onclick={() => { settings.colorblindMode = !settings.colorblindMode; }}
		>
			{settings.colorblindMode ? 'ON' : 'OFF'}
		</button>
	</section>

	<section>
		<h2>NOTE SIZE</h2>
		<p class="desc">Scale note size up or down. Larger notes are easier to see.</p>
		<div class="slider-row">
			<input
				type="range"
				min="0.5"
				max="2.0"
				step="0.1"
				bind:value={settings.noteScale}
			/>
			<span class="value">{settings.noteScale.toFixed(1)}x</span>
		</div>
	</section>

	<section>
		<h2>HIGHWAY THEME</h2>
		<p class="desc">Change the background visuals and atmosphere.</p>
		<div class="skin-options">
			{#each HIGHWAY_THEMES as ht}
				<button
					class="skin-btn"
					class:active={settings.highwayTheme === ht.value}
					onclick={() => { settings.highwayTheme = ht.value; }}
				>
					<span class="skin-label">{ht.label}</span>
					<span class="skin-desc">{ht.desc}</span>
				</button>
			{/each}
		</div>
	</section>

	<section>
		<h2>HIT EFFECT</h2>
		<p class="desc">Particle style when you hit a note.</p>
		<div class="skin-options">
			{#each HIT_EFFECTS as he}
				<button
					class="skin-btn"
					class:active={settings.hitEffect === he.value}
					onclick={() => { settings.hitEffect = he.value; }}
				>
					<span class="skin-label">{he.label}</span>
					<span class="skin-desc">{he.desc}</span>
				</button>
			{/each}
		</div>
	</section>

	<section>
		<h2>COMBO COLOR</h2>
		<p class="desc">Color scheme for combo counter and streak fire.</p>
		<div class="skin-options">
			{#each COMBO_COLORS as cc}
				<button
					class="skin-btn"
					class:active={settings.comboColor === cc.value}
					onclick={() => { settings.comboColor = cc.value; }}
				>
					<span class="skin-label">{cc.label}</span>
					<span class="skin-desc">{cc.desc}</span>
				</button>
			{/each}
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

	/* Volume sliders */
	.volume-group {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.vol-label {
		font-size: 13px;
		color: #aaa;
		min-width: 56px;
	}

	/* Calibration link */
	.calibrate-link {
		display: inline-block;
		font-family: monospace;
		font-size: 14px;
		padding: 8px 24px;
		background: transparent;
		border: 2px solid #4488ff;
		color: #4488ff;
		cursor: pointer;
		letter-spacing: 2px;
		text-decoration: none;
		transition: all 0.15s;
	}

	.calibrate-link:hover {
		background: rgba(68, 136, 255, 0.15);
		box-shadow: 0 0 12px rgba(68, 136, 255, 0.25);
	}

	/* Note skin selector */
	.skin-options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.skin-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: 10px 14px;
		background: transparent;
		border: 1px solid #333;
		color: #888;
		cursor: pointer;
		text-align: left;
		font-family: monospace;
		transition: all 0.15s;
	}

	.skin-btn:hover {
		border-color: #4488ff;
		color: #aaa;
	}

	.skin-btn.active {
		border-color: #4488ff;
		color: #4488ff;
		background: rgba(68, 136, 255, 0.1);
		box-shadow: 0 0 8px rgba(68, 136, 255, 0.15);
	}

	.skin-label {
		font-size: 14px;
		font-weight: bold;
	}

	.skin-desc {
		font-size: 11px;
		color: #666;
	}

	.skin-btn.active .skin-desc {
		color: #88aacc;
	}

	/* Speed buttons */
	.speed-buttons {
		display: flex;
		gap: 6px;
	}

	.spd-btn {
		font-family: monospace;
		font-size: 14px;
		padding: 6px 14px;
		background: transparent;
		border: 1px solid #333;
		color: #888;
		cursor: pointer;
		transition: all 0.15s;
	}

	.spd-btn:hover {
		border-color: #4488ff;
		color: #4488ff;
	}

	.spd-btn.active {
		border-color: #4488ff;
		color: #4488ff;
		background: rgba(68, 136, 255, 0.15);
		box-shadow: 0 0 8px rgba(68, 136, 255, 0.2);
	}

	/* Mirror toggle */
	.mirror-toggle {
		font-family: monospace;
		font-size: 14px;
		padding: 8px 24px;
		background: transparent;
		border: 1px solid #333;
		color: #888;
		cursor: pointer;
		transition: all 0.15s;
		letter-spacing: 2px;
	}

	.mirror-toggle:hover {
		border-color: #666;
		color: #aaa;
	}

	.mirror-toggle.active {
		border-color: #ffdd00;
		color: #ffdd00;
		background: rgba(255, 221, 0, 0.1);
		box-shadow: 0 0 8px rgba(255, 221, 0, 0.15);
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.settings-page {
			padding: 24px 16px;
		}

		h1 {
			font-size: 28px;
		}

		section {
			max-width: 100%;
		}

		.speed-buttons {
			flex-wrap: wrap;
		}

		.actions {
			flex-direction: column;
			width: 100%;
			max-width: 400px;
		}

		.save-btn, .reset-btn {
			width: 100%;
			text-align: center;
		}
	}
</style>
