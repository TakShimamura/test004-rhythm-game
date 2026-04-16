import type { Chart, Difficulty, MusicStyle, Note } from '$lib/game/types.js';
import { generateMusicSchedule } from '$lib/game/audio.js';
import { generateChartFromMusic } from '$lib/game/chart-from-music.js';

// ---------------------------------------------------------------------------
// Music-synced chart generation: charts are derived FROM the music schedule
// ---------------------------------------------------------------------------

function generateSyncedChart(
	bpm: number,
	durationSec: number,
	difficulty: Difficulty,
	style?: MusicStyle,
): Note[] {
	const schedule = generateMusicSchedule(bpm, durationSec, style);
	return generateChartFromMusic(schedule, difficulty, bpm);
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
// 1. First Steps — easy, 100 BPM, no style (default metronome-like backing)
// ---------------------------------------------------------------------------

export const FIRST_STEPS_CHART: Chart = {
	id: CHART_IDS.firstSteps,
	songId: SONG_IDS.firstSteps,
	difficulty: 'easy',
	bpm: 100,
	offsetMs: 0,
	notes: generateSyncedChart(100, 30, 'easy'),
};

// ---------------------------------------------------------------------------
// 2. Demo Beat — normal, 120 BPM (default backing)
// ---------------------------------------------------------------------------

export const DEMO_CHART: Chart = {
	id: CHART_IDS.demoBeat,
	songId: SONG_IDS.demoBeat,
	difficulty: 'normal',
	bpm: 120,
	offsetMs: 0,
	notes: generateSyncedChart(120, 30, 'normal'),
};

// ---------------------------------------------------------------------------
// 3. Electric Rush — normal, 140 BPM, electro style
// ---------------------------------------------------------------------------

export const ELECTRIC_RUSH_CHART: Chart = {
	id: CHART_IDS.electricRush,
	songId: SONG_IDS.electricRush,
	difficulty: 'normal',
	bpm: 140,
	offsetMs: 0,
	notes: generateSyncedChart(140, 35, 'normal', 'electro'),
	style: 'electro',
};

// ---------------------------------------------------------------------------
// 4. Drum & Bass Fury — hard, 170 BPM, dnb style
// ---------------------------------------------------------------------------

export const DNB_FURY_CHART: Chart = {
	id: CHART_IDS.dnbFury,
	songId: SONG_IDS.dnbFury,
	difficulty: 'hard',
	bpm: 170,
	offsetMs: 0,
	notes: generateSyncedChart(170, 40, 'hard', 'dnb'),
	style: 'dnb',
};

// ---------------------------------------------------------------------------
// 5. Midnight Chill — easy, 90 BPM, chill style
// ---------------------------------------------------------------------------

export const MIDNIGHT_CHILL_CHART: Chart = {
	id: CHART_IDS.midnightChill,
	songId: SONG_IDS.midnightChill,
	difficulty: 'easy',
	bpm: 90,
	offsetMs: 0,
	notes: generateSyncedChart(90, 35, 'easy', 'chill'),
	style: 'chill',
};

// ---------------------------------------------------------------------------
// 6. Neon Nights — normal, 128 BPM, electro
// ---------------------------------------------------------------------------

export const NEON_NIGHTS_CHART: Chart = {
	id: CHART_IDS.neonNights,
	songId: SONG_IDS.neonNights,
	difficulty: 'normal',
	bpm: 128,
	offsetMs: 0,
	notes: generateSyncedChart(128, 45, 'normal', 'electro'),
	style: 'electro',
};

// ---------------------------------------------------------------------------
// 7. Breakbeat Madness — hard, 160 BPM, dnb
// ---------------------------------------------------------------------------

export const BREAKBEAT_CHART: Chart = {
	id: CHART_IDS.breakbeat,
	songId: SONG_IDS.breakbeat,
	difficulty: 'hard',
	bpm: 160,
	offsetMs: 0,
	notes: generateSyncedChart(160, 40, 'hard', 'dnb'),
	style: 'dnb',
};

// ---------------------------------------------------------------------------
// 8. Sunset Waves — easy, 85 BPM, chill
// ---------------------------------------------------------------------------

export const SUNSET_WAVES_CHART: Chart = {
	id: CHART_IDS.sunsetWaves,
	songId: SONG_IDS.sunsetWaves,
	difficulty: 'easy',
	bpm: 85,
	offsetMs: 0,
	notes: generateSyncedChart(85, 50, 'easy', 'chill'),
	style: 'chill',
};

// ---------------------------------------------------------------------------
// 9. Cyber Punk 2099 — hard, 150 BPM, electro
// ---------------------------------------------------------------------------

export const CYBER_PUNK_CHART: Chart = {
	id: CHART_IDS.cyberPunk,
	songId: SONG_IDS.cyberPunk,
	difficulty: 'hard',
	bpm: 150,
	offsetMs: 0,
	notes: generateSyncedChart(150, 45, 'hard', 'electro'),
	style: 'electro',
};

// ---------------------------------------------------------------------------
// 10. Liquid Dreams — normal, 130 BPM, chill
// ---------------------------------------------------------------------------

export const LIQUID_DREAMS_CHART: Chart = {
	id: CHART_IDS.liquidDreams,
	songId: SONG_IDS.liquidDreams,
	difficulty: 'normal',
	bpm: 130,
	offsetMs: 0,
	notes: generateSyncedChart(130, 45, 'normal', 'chill'),
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
