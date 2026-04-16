import type { Lane, GameConfig } from './types.js';

export type LaneKeyEvent = {
	lane: Lane;
	time: number;
};

export type InputHandler = {
	start: () => void;
	stop: () => void;
	poll: () => LaneKeyEvent[];
	lanePressed: (lane: Lane) => boolean;
};

export function createInputHandler(config: GameConfig): InputHandler {
	const queue: LaneKeyEvent[] = [];
	const pressed = new Set<Lane>();

	function onKeyDown(e: KeyboardEvent) {
		const idx = config.laneKeys.indexOf(e.key.toLowerCase());
		if (idx === -1) return;
		if (e.repeat) return;
		const lane = idx as Lane;
		pressed.add(lane);
		queue.push({ lane, time: performance.now() / 1000 });
	}

	function onKeyUp(e: KeyboardEvent) {
		const idx = config.laneKeys.indexOf(e.key.toLowerCase());
		if (idx === -1) return;
		pressed.delete(idx as Lane);
	}

	return {
		start() {
			window.addEventListener('keydown', onKeyDown);
			window.addEventListener('keyup', onKeyUp);
		},
		stop() {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			pressed.clear();
			queue.length = 0;
		},
		poll() {
			return queue.splice(0);
		},
		lanePressed(lane: Lane) {
			return pressed.has(lane);
		},
	};
}
