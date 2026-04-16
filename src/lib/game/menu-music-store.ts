import { createMenuMusic, type MenuMusic } from './menu-music.js';

/**
 * Singleton menu music instance that persists across page navigations.
 * Start on menu pages, stop/fadeOut before entering gameplay.
 */
let instance: MenuMusic | null = null;

function getInstance(): MenuMusic {
	if (!instance) {
		instance = createMenuMusic();
	}
	return instance;
}

export const menuMusic = {
	start() {
		getInstance().start();
	},
	stop() {
		getInstance().stop();
	},
	fadeOut(durationSec?: number) {
		getInstance().fadeOut(durationSec);
	},
	async fadeOutAndStop(durationSec = 0.5): Promise<void> {
		await getInstance().fadeOutAndStop(durationSec);
	},
};
