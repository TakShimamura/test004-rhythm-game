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

function touchToLane(touch: Touch): Lane | null {
	const x = touch.clientX;
	const screenW = window.innerWidth;
	const third = screenW / 3;
	if (x < third) return 0;
	if (x < third * 2) return 1;
	return 2;
}

export function createInputHandler(config: GameConfig): InputHandler {
	const queue: LaneKeyEvent[] = [];
	const pressed = new Set<Lane>();
	const heldSince = new Map<Lane, number>();

	// Track which touch IDs are holding which lanes
	const touchLaneMap = new Map<number, Lane>();

	// --- Keyboard handlers ---

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

	// --- Touch handlers ---

	function isTouchHeldByOther(lane: Lane, excludeId: number): boolean {
		for (const [id, l] of touchLaneMap) {
			if (id !== excludeId && l === lane) return true;
		}
		return false;
	}

	function onTouchStart(e: TouchEvent) {
		e.preventDefault();
		for (let i = 0; i < e.changedTouches.length; i++) {
			const touch = e.changedTouches[i];
			const lane = touchToLane(touch);
			if (lane === null) continue;
			const now = performance.now() / 1000;
			touchLaneMap.set(touch.identifier, lane);
			if (!pressed.has(lane)) {
				pressed.add(lane);
				heldSince.set(lane, now);
				queue.push({ lane, time: now });
			}
		}
	}

	function onTouchEnd(e: TouchEvent) {
		e.preventDefault();
		for (let i = 0; i < e.changedTouches.length; i++) {
			const touch = e.changedTouches[i];
			const lane = touchLaneMap.get(touch.identifier);
			touchLaneMap.delete(touch.identifier);
			if (lane === undefined) continue;
			// Only release the lane if no other finger is holding it
			if (!isTouchHeldByOther(lane, touch.identifier)) {
				pressed.delete(lane);
				heldSince.delete(lane);
			}
		}
	}

	function onTouchCancel(e: TouchEvent) {
		onTouchEnd(e);
	}

	return {
		start() {
			window.addEventListener('keydown', onKeyDown);
			window.addEventListener('keyup', onKeyUp);
			window.addEventListener('touchstart', onTouchStart, { passive: false });
			window.addEventListener('touchend', onTouchEnd, { passive: false });
			window.addEventListener('touchcancel', onTouchCancel, { passive: false });
		},
		stop() {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('touchstart', onTouchStart);
			window.removeEventListener('touchend', onTouchEnd);
			window.removeEventListener('touchcancel', onTouchCancel);
			pressed.clear();
			heldSince.clear();
			touchLaneMap.clear();
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
