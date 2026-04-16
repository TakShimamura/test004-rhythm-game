import type { Chart, Lane, MusicStyle, Note } from '$lib/game/types.js';

// ---------------------------------------------------------------------------
// Note generation helpers
// ---------------------------------------------------------------------------

type NotePattern = {
	lanes: Lane[];
	/** Optional hold duration in seconds for all notes in this step. */
	hold?: number;
};

function generateNotes(
	bpm: number,
	durationSec: number,
	patterns: (Lane[] | NotePattern)[],
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
		const raw = patterns[patternIdx % patterns.length];
		const isPlainArray = Array.isArray(raw) && (raw.length === 0 || typeof raw[0] === 'number');
		const lanes: Lane[] = isPlainArray ? raw as Lane[] : (raw as NotePattern).lanes;
		const hold = isPlainArray ? undefined : (raw as NotePattern).hold;

		for (const lane of lanes) {
			const note: Note = { t: Math.round(t * 1000) / 1000, lane };
			if (hold && hold > 0) note.duration = hold;
			notes.push(note);
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
	neonNights:    '00000000-0000-4000-a000-000000000050',
	breakbeat:     '00000000-0000-4000-a000-000000000060',
	sunsetWaves:   '00000000-0000-4000-a000-000000000070',
	cyberPunk:     '00000000-0000-4000-a000-000000000080',
	liquidDreams:  '00000000-0000-4000-a000-000000000090',
} as const;

export const CHART_IDS = {
	firstSteps:    '00000000-0000-4000-a000-000000000011',
	demoBeat:      '00000000-0000-4000-a000-000000000002',
	electricRush:  '00000000-0000-4000-a000-000000000021',
	dnbFury:       '00000000-0000-4000-a000-000000000031',
	midnightChill: '00000000-0000-4000-a000-000000000041',
	neonNights:    '00000000-0000-4000-a000-000000000051',
	breakbeat:     '00000000-0000-4000-a000-000000000061',
	sunsetWaves:   '00000000-0000-4000-a000-000000000071',
	cyberPunk:     '00000000-0000-4000-a000-000000000081',
	liquidDreams:  '00000000-0000-4000-a000-000000000091',
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
// 6. Neon Nights — normal, 128 BPM, electro, 45 sec, hold notes mixed with taps
// ---------------------------------------------------------------------------

const neonNightsPatterns: (Lane[] | NotePattern)[] = [
	// Intro: gentle taps
	[1], [0], [2], [1],
	// Build: introduce holds
	{ lanes: [0], hold: 1.5 }, [2], [1], [0],
	[1], { lanes: [2], hold: 1.0 }, [0], [1],
	// Chorus: hold one lane while tapping another
	{ lanes: [0], hold: 2.0 }, [1], [2], [1],
	[2], { lanes: [1], hold: 1.5 }, [0], [2],
	// Intense: dense taps + holds
	[0, 2], [1], { lanes: [0], hold: 1.0 }, [2],
	[1], [0], { lanes: [2], hold: 2.0 }, [1],
	// Breakdown: breathing room
	[1], [], [0], [],
	{ lanes: [1], hold: 3.0 }, [], [2], [0],
	// Outro: big holds
	{ lanes: [0], hold: 2.5 }, [1], { lanes: [2], hold: 2.0 }, [1],
];

export const NEON_NIGHTS_CHART: Chart = {
	id: CHART_IDS.neonNights,
	songId: SONG_IDS.neonNights,
	difficulty: 'normal',
	bpm: 128,
	offsetMs: 0,
	notes: generateNotes(128, 45, neonNightsPatterns),
	style: 'electro',
};

// ---------------------------------------------------------------------------
// 7. Breakbeat Madness — hard, 160 BPM, dnb, 40 sec, fast taps + strategic holds
// ---------------------------------------------------------------------------

const breakbeatPatterns: (Lane[] | NotePattern)[] = [
	// Fast tap intro
	[0], [1], [2], [0, 1], [2], [1], [0], [2],
	// Speed up with doubles
	[0, 2], [1], [0], [1, 2], [0], [2], [1, 0], [2],
	// Strategic holds amidst chaos
	{ lanes: [0], hold: 0.8 }, [1], [2], [1],
	[2], [0], { lanes: [1], hold: 0.5 }, [2],
	// Intense section: hold + tap combos
	{ lanes: [0], hold: 1.0 }, [2], [1], [2],
	[0, 1], [2], { lanes: [2], hold: 0.7 }, [0],
	// Breakdown
	[1], { lanes: [0], hold: 1.5 }, [2], [1],
	// Final burst
	[0, 1, 2], [0], [2], [1], [0, 2], [1], [0], [1, 2],
];

export const BREAKBEAT_CHART: Chart = {
	id: CHART_IDS.breakbeat,
	songId: SONG_IDS.breakbeat,
	difficulty: 'hard',
	bpm: 160,
	offsetMs: 0,
	notes: generateNotes(160, 40, breakbeatPatterns),
	style: 'dnb',
};

// ---------------------------------------------------------------------------
// 8. Sunset Waves — easy, 85 BPM, chill, 50 sec, long flowing holds
// ---------------------------------------------------------------------------

const sunsetWavesPatterns: (Lane[] | NotePattern)[] = [
	// Calm opening with long holds
	{ lanes: [1], hold: 3.0 }, [], [], [],
	{ lanes: [0], hold: 2.5 }, [], [2], [],
	{ lanes: [2], hold: 3.0 }, [], [], [],
	{ lanes: [1], hold: 2.0 }, [], [0], [],
	// Gentle taps between holds
	[0], [], { lanes: [1], hold: 2.5 }, [],
	[2], [], { lanes: [0], hold: 2.0 }, [],
	// Flowing section: overlapping feel
	{ lanes: [0], hold: 2.0 }, [2], [], [1],
	{ lanes: [2], hold: 2.5 }, [0], [], [1],
	// Rest
	[], [], [1], [],
	// Grand finale hold
	{ lanes: [1], hold: 3.0 }, [], { lanes: [0], hold: 2.0 }, [],
];

export const SUNSET_WAVES_CHART: Chart = {
	id: CHART_IDS.sunsetWaves,
	songId: SONG_IDS.sunsetWaves,
	difficulty: 'easy',
	bpm: 85,
	offsetMs: 0,
	notes: generateNotes(85, 50, sunsetWavesPatterns, { skipEveryOther: 999 }),
	style: 'chill',
};

// ---------------------------------------------------------------------------
// 9. Cyber Punk 2099 — hard, 150 BPM, electro, 45 sec, complex hold+tap combos
// ---------------------------------------------------------------------------

const cyberPunkPatterns: (Lane[] | NotePattern)[] = [
	// Aggressive opening
	[0], [1], [2], [0, 2],
	[1], [0], [2], [1, 2],
	// Hold + simultaneous tap (hold lane 0, tap 1 and 2)
	{ lanes: [0], hold: 1.5 }, [1], [2], [1],
	[2], [1], { lanes: [2], hold: 1.5 }, [0],
	// Complex doubles with holds
	[0, 1], [2], { lanes: [1], hold: 1.0 }, [0, 2],
	[1], { lanes: [0], hold: 0.8 }, [2], [1],
	// Intense section
	[0, 2], [1], [0], { lanes: [2], hold: 1.2 },
	[0, 1], [2], [0], [1, 2],
	{ lanes: [0], hold: 2.0 }, [1], [2], [1],
	// Triples and holds
	[0, 1, 2], [1], { lanes: [0], hold: 0.5 }, [2],
	[1], [0, 2], { lanes: [1], hold: 1.0 }, [0],
	// Brief rest then finale
	[], [1], [], [0],
	{ lanes: [1], hold: 2.0 }, [0, 2], [1], { lanes: [0, 2], hold: 1.5 },
];

export const CYBER_PUNK_CHART: Chart = {
	id: CHART_IDS.cyberPunk,
	songId: SONG_IDS.cyberPunk,
	difficulty: 'hard',
	bpm: 150,
	offsetMs: 0,
	notes: generateNotes(150, 45, cyberPunkPatterns),
	style: 'electro',
};

// ---------------------------------------------------------------------------
// 10. Liquid Dreams — normal, 130 BPM, chill, 45 sec, nice mix
// ---------------------------------------------------------------------------

const liquidDreamsPatterns: (Lane[] | NotePattern)[] = [
	// Smooth intro
	[1], [0], [2], [1],
	[0], [2], [1], [0],
	// Introduce holds gently
	{ lanes: [1], hold: 1.5 }, [0], [2], [0],
	[1], { lanes: [2], hold: 1.5 }, [0], [1],
	// Medium density mix
	[0], [1], { lanes: [2], hold: 1.0 }, [1],
	{ lanes: [0], hold: 2.0 }, [1], [2], [1],
	// Build up
	[0, 2], [1], [0], [2],
	[1], [0, 2], { lanes: [1], hold: 1.5 }, [0],
	// Chill section with long holds
	{ lanes: [0], hold: 2.5 }, [], [2], [],
	{ lanes: [1], hold: 2.0 }, [], [0], [2],
	// Closing taps
	[1], [0], [2], [1], [0], [2], [1], [0],
];

export const LIQUID_DREAMS_CHART: Chart = {
	id: CHART_IDS.liquidDreams,
	songId: SONG_IDS.liquidDreams,
	difficulty: 'normal',
	bpm: 130,
	offsetMs: 0,
	notes: generateNotes(130, 45, liquidDreamsPatterns),
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
	NEON_NIGHTS_CHART,
	BREAKBEAT_CHART,
	SUNSET_WAVES_CHART,
	CYBER_PUNK_CHART,
	LIQUID_DREAMS_CHART,
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
	{ id: SONG_IDS.neonNights, title: 'Neon Nights', artist: 'Built-in', bpm: 128, durationMs: 45000, style: 'electro' },
	{ id: SONG_IDS.breakbeat, title: 'Breakbeat Madness', artist: 'Built-in', bpm: 160, durationMs: 40000, style: 'dnb' },
	{ id: SONG_IDS.sunsetWaves, title: 'Sunset Waves', artist: 'Built-in', bpm: 85, durationMs: 50000, style: 'chill' },
	{ id: SONG_IDS.cyberPunk, title: 'Cyber Punk 2099', artist: 'Built-in', bpm: 150, durationMs: 45000, style: 'electro' },
	{ id: SONG_IDS.liquidDreams, title: 'Liquid Dreams', artist: 'Built-in', bpm: 130, durationMs: 45000, style: 'chill' },
];
