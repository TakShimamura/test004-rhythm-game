import type { GameConfig, GameModeConfig, NoteSkin, HighwayTheme, HitEffect, ComboColor } from './types.js';
import { DEFAULT_CONFIG, DEFAULT_MODE_CONFIG } from './types.js';

const STORAGE_KEY = 'rhythm-game-settings';

export type UserSettings = {
	laneKeys: [string, string, string];
	audioOffsetMs: number;
	scrollSpeedPx: number;
	defaultSpeedMultiplier: number;
	defaultMirror: boolean;
	noteSkin: NoteSkin;
	colorblindMode: boolean;
	noteScale: number;
	highwayTheme: HighwayTheme;
	hitEffect: HitEffect;
	comboColor: ComboColor;
};

const DEFAULTS: UserSettings = {
	laneKeys: DEFAULT_CONFIG.laneKeys,
	audioOffsetMs: DEFAULT_CONFIG.audioOffsetMs,
	scrollSpeedPx: DEFAULT_CONFIG.scrollSpeedPx,
	defaultSpeedMultiplier: DEFAULT_MODE_CONFIG.speedMultiplier,
	defaultMirror: DEFAULT_MODE_CONFIG.mirror,
	noteSkin: DEFAULT_CONFIG.noteSkin,
	colorblindMode: DEFAULT_CONFIG.colorblindMode,
	noteScale: DEFAULT_CONFIG.noteScale,
	highwayTheme: DEFAULT_CONFIG.highwayTheme,
	hitEffect: DEFAULT_CONFIG.hitEffect,
	comboColor: DEFAULT_CONFIG.comboColor,
};

export function loadSettings(): UserSettings {
	if (typeof localStorage === 'undefined') return { ...DEFAULTS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };
		const parsed = JSON.parse(raw);
		const validSkins: NoteSkin[] = ['classic', 'neon', 'minimal'];
		const validThemes: HighwayTheme[] = ['default', 'space', 'ocean', 'cyberpunk', 'forest'];
		const validEffects: HitEffect[] = ['sparkle', 'splash', 'lightning', 'pixel'];
		const validComboColors: ComboColor[] = ['default', 'rainbow', 'fire', 'ice'];
		return {
			laneKeys: Array.isArray(parsed.laneKeys) && parsed.laneKeys.length === 3
				? parsed.laneKeys
				: DEFAULTS.laneKeys,
			audioOffsetMs: typeof parsed.audioOffsetMs === 'number'
				? parsed.audioOffsetMs
				: DEFAULTS.audioOffsetMs,
			scrollSpeedPx: typeof parsed.scrollSpeedPx === 'number'
				? parsed.scrollSpeedPx
				: DEFAULTS.scrollSpeedPx,
			defaultSpeedMultiplier: typeof parsed.defaultSpeedMultiplier === 'number'
				? parsed.defaultSpeedMultiplier
				: DEFAULTS.defaultSpeedMultiplier,
			defaultMirror: typeof parsed.defaultMirror === 'boolean'
				? parsed.defaultMirror
				: DEFAULTS.defaultMirror,
			noteSkin: validSkins.includes(parsed.noteSkin)
				? parsed.noteSkin
				: DEFAULTS.noteSkin,
			colorblindMode: typeof parsed.colorblindMode === 'boolean'
				? parsed.colorblindMode
				: DEFAULTS.colorblindMode,
			noteScale: typeof parsed.noteScale === 'number' && parsed.noteScale >= 0.5 && parsed.noteScale <= 2.0
				? parsed.noteScale
				: DEFAULTS.noteScale,
			highwayTheme: validThemes.includes(parsed.highwayTheme)
				? parsed.highwayTheme
				: DEFAULTS.highwayTheme,
			hitEffect: validEffects.includes(parsed.hitEffect)
				? parsed.hitEffect
				: DEFAULTS.hitEffect,
			comboColor: validComboColors.includes(parsed.comboColor)
				? parsed.comboColor
				: DEFAULTS.comboColor,
		};
	} catch {
		return { ...DEFAULTS };
	}
}

export function saveSettings(settings: UserSettings): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function settingsToConfig(settings: UserSettings): GameConfig {
	return {
		...DEFAULT_CONFIG,
		laneKeys: settings.laneKeys,
		audioOffsetMs: settings.audioOffsetMs,
		scrollSpeedPx: settings.scrollSpeedPx,
		noteSkin: settings.noteSkin,
		colorblindMode: settings.colorblindMode,
		noteScale: settings.noteScale,
		highwayTheme: settings.highwayTheme,
		hitEffect: settings.hitEffect,
		comboColor: settings.comboColor,
	};
}

export function settingsToModeConfig(settings: UserSettings): GameModeConfig {
	return {
		...DEFAULT_MODE_CONFIG,
		speedMultiplier: settings.defaultSpeedMultiplier,
		mirror: settings.defaultMirror,
	};
}
