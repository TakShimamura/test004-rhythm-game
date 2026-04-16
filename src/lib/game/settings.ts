import type { GameConfig, GameModeConfig } from './types.js';
import { DEFAULT_CONFIG, DEFAULT_MODE_CONFIG } from './types.js';

const STORAGE_KEY = 'rhythm-game-settings';

export type UserSettings = {
	laneKeys: [string, string, string];
	audioOffsetMs: number;
	scrollSpeedPx: number;
	defaultSpeedMultiplier: number;
	defaultMirror: boolean;
};

const DEFAULTS: UserSettings = {
	laneKeys: DEFAULT_CONFIG.laneKeys,
	audioOffsetMs: DEFAULT_CONFIG.audioOffsetMs,
	scrollSpeedPx: DEFAULT_CONFIG.scrollSpeedPx,
	defaultSpeedMultiplier: DEFAULT_MODE_CONFIG.speedMultiplier,
	defaultMirror: DEFAULT_MODE_CONFIG.mirror,
};

export function loadSettings(): UserSettings {
	if (typeof localStorage === 'undefined') return { ...DEFAULTS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };
		const parsed = JSON.parse(raw);
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
	};
}

export function settingsToModeConfig(settings: UserSettings): GameModeConfig {
	return {
		...DEFAULT_MODE_CONFIG,
		speedMultiplier: settings.defaultSpeedMultiplier,
		mirror: settings.defaultMirror,
	};
}
