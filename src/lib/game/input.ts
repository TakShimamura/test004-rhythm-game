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
	/** Returns the performance.now()/1000 timestamp when the lane key was pressed, or null if not held. */
	laneHeldSince: (lane: Lane) => number | null;
};

export function createInputHandler(config: GameConfig): InputHandler {
	const queue: LaneKeyEvent[] = [];
	const pressed = new Set<Lane>();
	const heldSince = new Map<Lane, number>();

	function onKeyDown(e: KeyboardEvent) {
		const idx = config.laneKeys.indexOf(e.key.toLowerCase());
		if (idx === -1) return;
		if (e.repeat) return;
		const lane = idx as Lane;
		const now = performance.now() / 1000;
		pressed.add(lane);
		heldSince.set(lane, now);
		queue.push({ lane, time: now });
	}

	function onKeyUp(e: KeyboardEvent) {
		const idx = config.laneKeys.indexOf(e.key.toLowerCase());
		if (idx === -1) return;
		const lane = idx as Lane;
		pressed.delete(lane);
		heldSince.delete(lane);
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
			heldSince.clear();
			queue.length = 0;
		},
		poll() {
			return queue.splice(0);
		},
		lanePressed(lane: Lane) {
			return pressed.has(lane);
		},
		laneHeldSince(lane: Lane) {
			return heldSince.get(lane) ?? null;
		},
	};
}
