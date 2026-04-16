import type { Lane, Note } from './types.js';

const MIRROR_MAP: Record<Lane, Lane> = { 0: 2, 1: 1, 2: 0 };

/**
 * Flip note lanes for mirror mode: 0↔2, 1 stays.
 * Returns a new array — does not mutate the original.
 */
export function applyMirror(notes: readonly Note[]): Note[] {
	return notes.map((n) => ({
		...n,
		lane: MIRROR_MAP[n.lane],
	}));
}
