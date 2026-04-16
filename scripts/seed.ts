import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { songs, charts } from '../src/lib/server/db/schema.js';

// ---------------------------------------------------------------------------
// Deterministic IDs (mirrored from src/lib/chart/songs.ts)
// ---------------------------------------------------------------------------

const SONG_IDS = {
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

const CHART_IDS = {
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
// Note generation (duplicated here to avoid $lib alias in scripts context)
// ---------------------------------------------------------------------------

type Lane = 0 | 1 | 2;
type Note = { t: number; lane: Lane; duration?: number };
type NotePattern = { lanes: Lane[]; hold?: number };

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
		const lanes: Lane[] = Array.isArray(raw) && (raw.length === 0 || typeof raw[0] === 'number')
			? raw as Lane[]
			: (raw as NotePattern).lanes;
		const hold = Array.isArray(raw) && (raw.length === 0 || typeof raw[0] === 'number')
			? undefined
			: (raw as NotePattern).hold;

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
// Song + chart definitions
// ---------------------------------------------------------------------------

type SongDef = {
	id: string;
	title: string;
	artist: string;
	bpm: number;
	durationMs: number;
};

type ChartDef = {
	id: string;
	songId: string;
	difficulty: string;
	notes: Note[];
};

const allSongs: SongDef[] = [
	{ id: SONG_IDS.firstSteps, title: 'First Steps', artist: 'Built-in', bpm: 100, durationMs: 30000 },
	{ id: SONG_IDS.demoBeat, title: 'Demo Beat', artist: 'Built-in', bpm: 120, durationMs: 30000 },
	{ id: SONG_IDS.electricRush, title: 'Electric Rush', artist: 'Built-in', bpm: 140, durationMs: 35000 },
	{ id: SONG_IDS.dnbFury, title: 'Drum & Bass Fury', artist: 'Built-in', bpm: 170, durationMs: 40000 },
	{ id: SONG_IDS.midnightChill, title: 'Midnight Chill', artist: 'Built-in', bpm: 90, durationMs: 35000 },
	{ id: SONG_IDS.neonNights, title: 'Neon Nights', artist: 'Built-in', bpm: 128, durationMs: 45000 },
	{ id: SONG_IDS.breakbeat, title: 'Breakbeat Madness', artist: 'Built-in', bpm: 160, durationMs: 40000 },
	{ id: SONG_IDS.sunsetWaves, title: 'Sunset Waves', artist: 'Built-in', bpm: 85, durationMs: 50000 },
	{ id: SONG_IDS.cyberPunk, title: 'Cyber Punk 2099', artist: 'Built-in', bpm: 150, durationMs: 45000 },
	{ id: SONG_IDS.liquidDreams, title: 'Liquid Dreams', artist: 'Built-in', bpm: 130, durationMs: 45000 },
];

const allCharts: ChartDef[] = [
	{
		id: CHART_IDS.firstSteps,
		songId: SONG_IDS.firstSteps,
		difficulty: 'easy',
		notes: generateNotes(100, 30, [[1], [1], [0], [1], [2], [1], [0], [1]], { skipEveryOther: 999 }),
	},
	{
		id: CHART_IDS.demoBeat,
		songId: SONG_IDS.demoBeat,
		difficulty: 'normal',
		notes: generateNotes(120, 30, [[0], [1], [2], [1], [0, 2], [1], [0], [2]], { skipEveryOther: 8 }),
	},
	{
		id: CHART_IDS.electricRush,
		songId: SONG_IDS.electricRush,
		difficulty: 'normal',
		notes: generateNotes(140, 35, [
			[0], [2], [1], [0, 2], [1], [0], [2], [1],
			[0, 1], [2], [0], [1, 2], [0], [2], [1], [0],
		], { skipEveryOther: 4 }),
	},
	{
		id: CHART_IDS.dnbFury,
		songId: SONG_IDS.dnbFury,
		difficulty: 'hard',
		notes: generateNotes(170, 40, [
			[0], [1], [2], [0, 1], [2], [1], [0, 2], [1],
			[0], [2], [1, 2], [0], [1], [0, 1, 2], [0], [2],
			[1], [0], [2], [1], [0, 2], [1], [2], [0],
		]),
	},
	{
		id: CHART_IDS.midnightChill,
		songId: SONG_IDS.midnightChill,
		difficulty: 'easy',
		notes: generateNotes(90, 35, [[1], [0], [2], [1], [0], [1], [2], [1]], { skipEveryOther: 999 }),
	},
	{
		id: CHART_IDS.neonNights,
		songId: SONG_IDS.neonNights,
		difficulty: 'normal',
		notes: generateNotes(128, 45, [
			[1], [0], [2], [1],
			{ lanes: [0], hold: 1.5 }, [2], [1], [0],
			[1], { lanes: [2], hold: 1.0 }, [0], [1],
			{ lanes: [0], hold: 2.0 }, [1], [2], [1],
			[2], { lanes: [1], hold: 1.5 }, [0], [2],
			[0, 2], [1], { lanes: [0], hold: 1.0 }, [2],
			[1], [0], { lanes: [2], hold: 2.0 }, [1],
			[1], [], [0], [],
			{ lanes: [1], hold: 3.0 }, [], [2], [0],
			{ lanes: [0], hold: 2.5 }, [1], { lanes: [2], hold: 2.0 }, [1],
		]),
	},
	{
		id: CHART_IDS.breakbeat,
		songId: SONG_IDS.breakbeat,
		difficulty: 'hard',
		notes: generateNotes(160, 40, [
			[0], [1], [2], [0, 1], [2], [1], [0], [2],
			[0, 2], [1], [0], [1, 2], [0], [2], [1, 0], [2],
			{ lanes: [0], hold: 0.8 }, [1], [2], [1],
			[2], [0], { lanes: [1], hold: 0.5 }, [2],
			{ lanes: [0], hold: 1.0 }, [2], [1], [2],
			[0, 1], [2], { lanes: [2], hold: 0.7 }, [0],
			[1], { lanes: [0], hold: 1.5 }, [2], [1],
			[0, 1, 2], [0], [2], [1], [0, 2], [1], [0], [1, 2],
		]),
	},
	{
		id: CHART_IDS.sunsetWaves,
		songId: SONG_IDS.sunsetWaves,
		difficulty: 'easy',
		notes: generateNotes(85, 50, [
			{ lanes: [1], hold: 3.0 }, [], [], [],
			{ lanes: [0], hold: 2.5 }, [], [2], [],
			{ lanes: [2], hold: 3.0 }, [], [], [],
			{ lanes: [1], hold: 2.0 }, [], [0], [],
			[0], [], { lanes: [1], hold: 2.5 }, [],
			[2], [], { lanes: [0], hold: 2.0 }, [],
			{ lanes: [0], hold: 2.0 }, [2], [], [1],
			{ lanes: [2], hold: 2.5 }, [0], [], [1],
			[], [], [1], [],
			{ lanes: [1], hold: 3.0 }, [], { lanes: [0], hold: 2.0 }, [],
		], { skipEveryOther: 999 }),
	},
	{
		id: CHART_IDS.cyberPunk,
		songId: SONG_IDS.cyberPunk,
		difficulty: 'hard',
		notes: generateNotes(150, 45, [
			[0], [1], [2], [0, 2],
			[1], [0], [2], [1, 2],
			{ lanes: [0], hold: 1.5 }, [1], [2], [1],
			[2], [1], { lanes: [2], hold: 1.5 }, [0],
			[0, 1], [2], { lanes: [1], hold: 1.0 }, [0, 2],
			[1], { lanes: [0], hold: 0.8 }, [2], [1],
			[0, 2], [1], [0], { lanes: [2], hold: 1.2 },
			[0, 1], [2], [0], [1, 2],
			{ lanes: [0], hold: 2.0 }, [1], [2], [1],
			[0, 1, 2], [1], { lanes: [0], hold: 0.5 }, [2],
			[1], [0, 2], { lanes: [1], hold: 1.0 }, [0],
			[], [1], [], [0],
			{ lanes: [1], hold: 2.0 }, [0, 2], [1], { lanes: [0, 2], hold: 1.5 },
		]),
	},
	{
		id: CHART_IDS.liquidDreams,
		songId: SONG_IDS.liquidDreams,
		difficulty: 'normal',
		notes: generateNotes(130, 45, [
			[1], [0], [2], [1],
			[0], [2], [1], [0],
			{ lanes: [1], hold: 1.5 }, [0], [2], [0],
			[1], { lanes: [2], hold: 1.5 }, [0], [1],
			[0], [1], { lanes: [2], hold: 1.0 }, [1],
			{ lanes: [0], hold: 2.0 }, [1], [2], [1],
			[0, 2], [1], [0], [2],
			[1], [0, 2], { lanes: [1], hold: 1.5 }, [0],
			{ lanes: [0], hold: 2.5 }, [], [2], [],
			{ lanes: [1], hold: 2.0 }, [], [0], [2],
			[1], [0], [2], [1], [0], [2], [1], [0],
		]),
	},
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function seed() {
	console.log(`Seeding ${allSongs.length} songs and ${allCharts.length} charts...`);

	for (const song of allSongs) {
		const [inserted] = await db
			.insert(songs)
			.values({
				id: song.id,
				title: song.title,
				artist: song.artist,
				audioUrl: '__synth__',
				bpm: song.bpm,
				durationMs: song.durationMs,
			})
			.onConflictDoNothing()
			.returning();

		if (inserted) {
			console.log(`  + Song: ${song.title}`);
		} else {
			console.log(`  = Song already exists: ${song.title}`);
		}
	}

	for (const chart of allCharts) {
		const [inserted] = await db
			.insert(charts)
			.values({
				id: chart.id,
				songId: chart.songId,
				difficulty: chart.difficulty,
				notes: chart.notes,
			})
			.onConflictDoNothing()
			.returning();

		if (inserted) {
			console.log(`  + Chart: ${chart.difficulty} (chart ${chart.id.slice(-2)})`);
		} else {
			console.log(`  = Chart already exists: ${chart.difficulty} (chart ${chart.id.slice(-2)})`);
		}
	}

	console.log('Seed complete.');
	await client.end();
}

seed().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
