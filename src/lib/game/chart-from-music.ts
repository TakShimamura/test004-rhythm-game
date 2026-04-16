import type { Difficulty, Instrument, Lane, MusicEvent, Note } from './types.js';

/**
 * Generate a rhythm game chart directly from a music event schedule.
 * This ensures every note in the chart corresponds to an actual instrument
 * event in the backing track — hitting notes feels like playing the music.
 */
export function generateChartFromMusic(
	schedule: MusicEvent[],
	difficulty: Difficulty,
	bpm: number,
): Note[] {
	// 1. Filter events by difficulty
	const filtered = filterByDifficulty(schedule, difficulty);

	// 2. Map instrument events to lanes
	const rawNotes = filtered.map((ev): Note => ({
		t: round3(ev.t),
		lane: instrumentToLane(ev.instrument),
		instrument: ev.instrument,
		freq: ev.freq,
		// Convert sustained bass/lead/pad events to hold notes
		duration: shouldBeHold(ev, difficulty) ? ev.duration : undefined,
	}));

	// 3. Merge events that are too close together (within 30ms)
	const merged = mergeCloseNotes(rawNotes, 0.03);

	// 4. Add a lead-in (skip first few beats so player can prepare)
	const leadInSec = (60 / bpm) * 2;
	const withLeadIn = merged.filter(n => n.t >= leadInSec);

	return withLeadIn;
}

/** Map instruments to lanes — low/rhythm on 0, percussion on 1, melody on 2 */
function instrumentToLane(instrument: Instrument): Lane {
	switch (instrument) {
		case 'kick':
		case 'bass':
			return 0;
		case 'snare':
		case 'hihat':
			return 1;
		case 'lead':
		case 'arp':
		case 'pad':
			return 2;
	}
}

/** Filter music events by difficulty to control note density */
function filterByDifficulty(schedule: MusicEvent[], difficulty: Difficulty): MusicEvent[] {
	switch (difficulty) {
		case 'easy':
			// Only kicks and snares — the fundamental beat
			return schedule.filter(ev =>
				ev.instrument === 'kick' || ev.instrument === 'snare'
			);
		case 'normal':
			// Kicks, snares, bass, and lead — core musical elements
			return schedule.filter(ev =>
				ev.instrument === 'kick' ||
				ev.instrument === 'snare' ||
				ev.instrument === 'bass' ||
				ev.instrument === 'lead'
			);
		case 'hard':
			// Everything including hihats, arps, pads
			return schedule.filter(ev =>
				ev.instrument === 'kick' ||
				ev.instrument === 'snare' ||
				ev.instrument === 'hihat' ||
				ev.instrument === 'bass' ||
				ev.instrument === 'lead' ||
				ev.instrument === 'arp'
			);
	}
}

/** Determine if a music event should become a hold note */
function shouldBeHold(ev: MusicEvent, difficulty: Difficulty): boolean {
	if (!ev.duration || ev.duration < 0.5) return false;

	// Only sustain instruments can be holds
	if (ev.instrument === 'bass' || ev.instrument === 'lead' || ev.instrument === 'pad') {
		// Easy: longer holds only
		if (difficulty === 'easy') return ev.duration >= 1.5;
		// Normal: medium holds
		if (difficulty === 'normal') return ev.duration >= 0.8;
		// Hard: shorter holds too
		return ev.duration >= 0.5;
	}
	return false;
}

/**
 * Merge notes that are too close in time on the same lane.
 * Keeps the first note and drops subsequent ones within the threshold.
 * Also limits simultaneous notes (different lanes at same time) to 2 max.
 */
function mergeCloseNotes(notes: Note[], thresholdSec: number): Note[] {
	if (notes.length === 0) return notes;

	// Sort by time, then by lane
	const sorted = [...notes].sort((a, b) => a.t - b.t || a.lane - b.lane);
	const result: Note[] = [];

	// Track last note time per lane
	const lastTimeByLane: Record<number, number> = { 0: -Infinity, 1: -Infinity, 2: -Infinity };

	for (const note of sorted) {
		const lastTime = lastTimeByLane[note.lane];
		if (note.t - lastTime < thresholdSec) continue;

		// Limit simultaneous notes: count how many notes are at roughly this time
		const simultaneous = result.filter(n => Math.abs(n.t - note.t) < thresholdSec);
		if (simultaneous.length >= 2) continue;

		result.push(note);
		lastTimeByLane[note.lane] = note.t;
	}

	return result;
}

function round3(n: number): number {
	return Math.round(n * 1000) / 1000;
}
