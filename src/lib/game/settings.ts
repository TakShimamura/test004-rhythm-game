import type { GameConfig, GameModeConfig, NoteSkin } from './types.js';
import { DEFAULT_CONFIG, DEFAULT_MODE_CONFIG } from './types.js';

const STORAGE_KEY = 'rhythm-game-settings';

export type UserSettings = {
	laneKeys: [string, string, string];
	audioOffsetMs: number;
	scrollSpeedPx: number;
	defaultSpeedMultiplier: number;
	defaultMirror: boolean;
	noteSkin: NoteSkin;
};

const DEFAULTS: UserSettings = {
	laneKeys: DEFAULT_CONFIG.laneKeys,
	audioOffsetMs: DEFAULT_CONFIG.audioOffsetMs,
	scrollSpeedPx: DEFAULT_CONFIG.scrollSpeedPx,
	defaultSpeedMultiplier: DEFAULT_MODE_CONFIG.speedMultiplier,
	defaultMirror: DEFAULT_MODE_CONFIG.mirror,
	noteSkin: DEFAULT_CONFIG.noteSkin,
};

export function loadSettings(): UserSettings {
	if (typeof localStorage === 'undefined') return { ...DEFAULTS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };
		const parsed = JSON.parse(raw);
		const validSkins: NoteSkin[] = ['classic', 'neon', 'minimal'];
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
	};
}

export function settingsToModeConfig(settings: UserSettings): GameModeConfig {
	return {
		...DEFAULT_MODE_CONFIG,
		speedMultiplier: settings.defaultSpeedMultiplier,
		mirror: settings.defaultMirror,
	};
}
