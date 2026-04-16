import type { Chart, Lane, Note } from '$lib/game/types.js';

function generateDemoNotes(bpm: number, durationSec: number): Note[] {
	const notes: Note[] = [];
	const beatInterval = 60 / bpm;

	const patterns: Lane[][] = [
		[0],
		[1],
		[2],
		[1],
		[0, 2],
		[1],
		[0],
		[2],
	];

	let beat = 0;
	let patternIdx = 0;
	let t = beatInterval * 2; // 2 beat lead-in

	while (t < durationSec) {
		const lanes = patterns[patternIdx % patterns.length];
		for (const lane of lanes) {
			notes.push({ t: Math.round(t * 1000) / 1000, lane });
		}

		// every other beat for the first 8 beats, then every beat
		const skip = beat < 8 ? 2 : 1;
		t += beatInterval * skip;
		beat += skip;
		patternIdx++;
	}

	return notes;
}

export const DEMO_CHART: Chart = {
	id: '00000000-0000-4000-a000-000000000002',
	songId: '00000000-0000-4000-a000-000000000001',
	difficulty: 'normal',
	bpm: 120,
	offsetMs: 0,
	notes: generateDemoNotes(120, 30),
};
