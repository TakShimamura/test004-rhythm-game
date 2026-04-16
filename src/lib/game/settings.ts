import type { GameConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

const STORAGE_KEY = 'rhythm-game-settings';

export type UserSettings = {
	laneKeys: [string, string, string];
	audioOffsetMs: number;
	scrollSpeedPx: number;
};

const DEFAULTS: UserSettings = {
	laneKeys: DEFAULT_CONFIG.laneKeys,
	audioOffsetMs: DEFAULT_CONFIG.audioOffsetMs,
	scrollSpeedPx: DEFAULT_CONFIG.scrollSpeedPx,
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
