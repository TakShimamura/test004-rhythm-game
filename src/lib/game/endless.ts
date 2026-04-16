import type { Lane, Note } from './types.js';

/**
 * Simple seeded PRNG (mulberry32).
 */
function createRng(seed: number) {
	let s = seed | 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

type DifficultyPhase = {
	/** Max time boundary for this phase (seconds since start) */
	maxTime: number;
	/** Interval between notes in beats (e.g. 2 = every other beat) */
	beatInterval: number;
	/** Probability of a double note (0-1) */
	doubleChance: number;
	/** Probability of a triple note (0-1) */
	tripleChance: number;
	/** Probability of a hold note (0-1) */
	holdChance: number;
};

const PHASES: DifficultyPhase[] = [
	{ maxTime: 30, beatInterval: 2, doubleChance: 0, tripleChance: 0, holdChance: 0 },
	{ maxTime: 60, beatInterval: 1, doubleChance: 0, tripleChance: 0, holdChance: 0 },
	{ maxTime: 90, beatInterval: 1, doubleChance: 0.2, tripleChance: 0, holdChance: 0.05 },
	{ maxTime: 120, beatInterval: 1, doubleChance: 0.35, tripleChance: 0, holdChance: 0.1 },
	{ maxTime: Infinity, beatInterval: 0.5, doubleChance: 0.4, tripleChance: 0.1, holdChance: 0.15 },
];

function getPhase(time: number): DifficultyPhase {
	for (const phase of PHASES) {
		if (time < phase.maxTime) return phase;
	}
	return PHASES[PHASES.length - 1];
}

/**
 * Generate a chunk of endless-mode notes.
 * @param startTime  Absolute time offset (seconds) where this chunk starts
 * @param durationSec  Duration of the chunk in seconds
 * @param bpm  Beats per minute for timing
 * @param seed  RNG seed for reproducibility
 * @returns Array of notes for this chunk
 */
export function generateEndlessChunk(
	startTime: number,
	durationSec: number,
	bpm: number,
	seed: number,
): Note[] {
	const rng = createRng(seed + Math.floor(startTime * 1000));
	const beatDuration = 60 / bpm;
	const notes: Note[] = [];
	const endTime = startTime + durationSec;

	let t = startTime;
	while (t < endTime) {
		const phase = getPhase(t);
		const interval = beatDuration * phase.beatInterval;

		// Pick primary lane
		const primaryLane = Math.floor(rng() * 3) as Lane;
		const isHold = rng() < phase.holdChance;
		const holdDuration = isHold ? beatDuration * (1 + Math.floor(rng() * 3)) : undefined;

		notes.push({ t, lane: primaryLane, ...(holdDuration ? { duration: holdDuration } : {}) });

		// Maybe add a double
		if (rng() < phase.doubleChance) {
			const available = ([0, 1, 2] as Lane[]).filter((l) => l !== primaryLane);
			const secondLane = available[Math.floor(rng() * available.length)];
			notes.push({ t, lane: secondLane });
		}

		// Maybe add a triple (only if double was already possible)
		if (rng() < phase.tripleChance) {
			const used = new Set<Lane>([primaryLane]);
			for (const n of notes) {
				if (n.t === t) used.add(n.lane);
			}
			const remaining = ([0, 1, 2] as Lane[]).filter((l) => !used.has(l));
			if (remaining.length > 0) {
				notes.push({ t, lane: remaining[0] });
			}
		}

		t += interval;
	}

	return notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
}

/**
 * Create an endless chart manager that lazily generates chunks as the player progresses.
 */
export function createEndlessManager(bpm: number, seed: number = Date.now()) {
	const CHUNK_DURATION = 30; // seconds per generated chunk
	const LOOK_AHEAD = 30; // generate this far ahead of current time
	let generatedUpTo = 0;
	let allNotes: Note[] = [];

	function ensureGenerated(currentTime: number): void {
		const targetTime = currentTime + LOOK_AHEAD;
		while (generatedUpTo < targetTime) {
			const chunk = generateEndlessChunk(generatedUpTo, CHUNK_DURATION, bpm, seed);
			allNotes = allNotes.concat(chunk);
			generatedUpTo += CHUNK_DURATION;
		}
	}

	// Generate initial chunk
	ensureGenerated(0);

	return {
		get notes() {
			return allNotes;
		},
		get generatedUpTo() {
			return generatedUpTo;
		},
		/** Call each frame to ensure notes are generated ahead of the player. */
		update(currentTime: number) {
			ensureGenerated(currentTime);
		},
		seed,
	};
}
