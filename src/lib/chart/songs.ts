import type { Chart, Lane, MusicStyle, Note } from '$lib/game/types.js';

// ---------------------------------------------------------------------------
// Note generation helpers
// ---------------------------------------------------------------------------

function generateNotes(
	bpm: number,
	durationSec: number,
	patterns: Lane[][],
	opts: { leadInBeats?: number; skipEveryOther?: number } = {},
): Note[] {
	const notes: Note[] = [];
	const beatInterval = 60 / bpm;
	const leadIn = opts.leadInBeats ?? 2;
	const skipThreshold = opts.skipEveryOther ?? 0;

	let beat = 0;
	let patternIdx = 0;
	let t = beatInterval * leadIn;

	while (t < durationSec) {
		const lanes = patterns[patternIdx % patterns.length];
		for (const lane of lanes) {
			notes.push({ t: Math.round(t * 1000) / 1000, lane });
		}

		const skip = beat < skipThreshold ? 2 : 1;
		t += beatInterval * skip;
		beat += skip;
		patternIdx++;
	}

	return notes;
}

// ---------------------------------------------------------------------------
// Deterministic UUIDs for each song/chart
// ---------------------------------------------------------------------------

export const SONG_IDS = {
	firstSteps:    '00000000-0000-4000-a000-000000000010',
	demoBeat:      '00000000-0000-4000-a000-000000000001',
	electricRush:  '00000000-0000-4000-a000-000000000020',
	dnbFury:       '00000000-0000-4000-a000-000000000030',
	midnightChill: '00000000-0000-4000-a000-000000000040',
} as const;

export const CHART_IDS = {
	firstSteps:    '00000000-0000-4000-a000-000000000011',
	demoBeat:      '00000000-0000-4000-a000-000000000002',
	electricRush:  '00000000-0000-4000-a000-000000000021',
	dnbFury:       '00000000-0000-4000-a000-000000000031',
	midnightChill: '00000000-0000-4000-a000-000000000041',
} as const;

// ---------------------------------------------------------------------------
// 1. First Steps — easy, 100 BPM, single-lane, every other beat
// ---------------------------------------------------------------------------

const firstStepsPatterns: Lane[][] = [
	[1], [1], [0], [1], [2], [1], [0], [1],
];

export const FIRST_STEPS_CHART: Chart = {
	id: CHART_IDS.firstSteps,
	songId: SONG_IDS.firstSteps,
	difficulty: 'easy',
	bpm: 100,
	offsetMs: 0,
	notes: generateNotes(100, 30, firstStepsPatterns, { skipEveryOther: 999 }), // always skip = every other beat
};

// ---------------------------------------------------------------------------
// 2. Demo Beat — normal, 120 BPM (original chart)
// ---------------------------------------------------------------------------

const demoBeatPatterns: Lane[][] = [
	[0], [1], [2], [1], [0, 2], [1], [0], [2],
];

export const DEMO_CHART: Chart = {
	id: CHART_IDS.demoBeat,
	songId: SONG_IDS.demoBeat,
	difficulty: 'normal',
	bpm: 120,
	offsetMs: 0,
	notes: generateNotes(120, 30, demoBeatPatterns, { skipEveryOther: 8 }),
};

// ---------------------------------------------------------------------------
// 3. Electric Rush — normal, 140 BPM, electro style
// ---------------------------------------------------------------------------

const electricRushPatterns: Lane[][] = [
	[0], [2], [1], [0, 2], [1], [0], [2], [1],
	[0, 1], [2], [0], [1, 2], [0], [2], [1], [0],
];

export const ELECTRIC_RUSH_CHART: Chart = {
	id: CHART_IDS.electricRush,
	songId: SONG_IDS.electricRush,
	difficulty: 'normal',
	bpm: 140,
	offsetMs: 0,
	notes: generateNotes(140, 35, electricRushPatterns, { skipEveryOther: 4 }),
	style: 'electro',
};

// ---------------------------------------------------------------------------
// 4. Drum & Bass Fury — hard, 170 BPM, dnb style
// ---------------------------------------------------------------------------

const dnbFuryPatterns: Lane[][] = [
	[0], [1], [2], [0, 1], [2], [1], [0, 2], [1],
	[0], [2], [1, 2], [0], [1], [0, 1, 2], [0], [2],
	[1], [0], [2], [1], [0, 2], [1], [2], [0],
];

export const DNB_FURY_CHART: Chart = {
	id: CHART_IDS.dnbFury,
	songId: SONG_IDS.dnbFury,
	difficulty: 'hard',
	bpm: 170,
	offsetMs: 0,
	notes: generateNotes(170, 40, dnbFuryPatterns),
	style: 'dnb',
};

// ---------------------------------------------------------------------------
// 5. Midnight Chill — easy, 90 BPM, chill style
// ---------------------------------------------------------------------------

const chillPatterns: Lane[][] = [
	[1], [0], [2], [1], [0], [1], [2], [1],
];

export const MIDNIGHT_CHILL_CHART: Chart = {
	id: CHART_IDS.midnightChill,
	songId: SONG_IDS.midnightChill,
	difficulty: 'easy',
	bpm: 90,
	offsetMs: 0,
	notes: generateNotes(90, 35, chillPatterns, { skipEveryOther: 999 }),
	style: 'chill',
};

// ---------------------------------------------------------------------------
// All charts for convenience
// ---------------------------------------------------------------------------

export const ALL_CHARTS: Chart[] = [
	FIRST_STEPS_CHART,
	DEMO_CHART,
	ELECTRIC_RUSH_CHART,
	DNB_FURY_CHART,
	MIDNIGHT_CHILL_CHART,
];

export type SongMeta = {
	id: string;
	title: string;
	artist: string;
	bpm: number;
	durationMs: number;
	style?: MusicStyle;
};

export const ALL_SONGS: SongMeta[] = [
	{ id: SONG_IDS.firstSteps, title: 'First Steps', artist: 'Built-in', bpm: 100, durationMs: 30000 },
	{ id: SONG_IDS.demoBeat, title: 'Demo Beat', artist: 'Built-in', bpm: 120, durationMs: 30000 },
	{ id: SONG_IDS.electricRush, title: 'Electric Rush', artist: 'Built-in', bpm: 140, durationMs: 35000, style: 'electro' },
	{ id: SONG_IDS.dnbFury, title: 'Drum & Bass Fury', artist: 'Built-in', bpm: 170, durationMs: 40000, style: 'dnb' },
	{ id: SONG_IDS.midnightChill, title: 'Midnight Chill', artist: 'Built-in', bpm: 90, durationMs: 35000, style: 'chill' },
];
