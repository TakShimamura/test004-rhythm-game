import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { songs, charts, shopItems } from '../src/lib/server/db/schema.js';

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
// Music-synced chart generation (duplicated here to avoid $lib alias)
// ---------------------------------------------------------------------------

type Lane = 0 | 1 | 2;
type Instrument = 'kick' | 'snare' | 'hihat' | 'bass' | 'lead' | 'arp' | 'pad';
type Difficulty = 'easy' | 'normal' | 'hard';
type MusicStyle = 'electro' | 'dnb' | 'chill';
type Note = { t: number; lane: Lane; duration?: number; instrument?: Instrument; freq?: number };
type MusicEvent = { t: number; instrument: Instrument; freq?: number; duration?: number; volume?: number };

const NOTES = {
	C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, Bb2: 116.54,
	C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, Bb3: 233.08,
	C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, Bb4: 466.16,
	C5: 523.25, D5: 587.33, E5: 659.25,
} as const;

function generateElectroSchedule(bpm: number, durationSec: number): MusicEvent[] {
	const events: MusicEvent[] = [];
	const beat = 60 / bpm;
	const eighth = beat / 2;
	const sixteenth = beat / 4;
	let barCount = 0;
	for (let t = 0; t < durationSec; t += beat * 4) {
		const isFillBar = (barCount + 1) % 8 === 0;
		for (let b = 0; b < 4 && t + b * beat < durationSec; b++) {
			const bt = t + b * beat;
			events.push({ t: bt, instrument: 'kick', volume: 0.35 });
			if (b === 1 || b === 3) events.push({ t: bt, instrument: 'snare', volume: 0.2 });
			events.push({ t: bt, instrument: 'hihat', volume: 0.1 });
			events.push({ t: bt + eighth, instrument: 'hihat', volume: 0.07 });
			if (isFillBar && b >= 2) {
				for (let s = 0; s < 4; s++) events.push({ t: bt + s * sixteenth, instrument: 'snare', volume: 0.12 + s * 0.03 });
			}
		}
		barCount++;
	}
	const bassNotes = [NOTES.C2, NOTES.C2, NOTES.Bb2, NOTES.G2, NOTES.C2, NOTES.E2, NOTES.G2, NOTES.Bb2];
	let bassIdx = 0;
	for (let t = 0; t < durationSec; t += beat) {
		events.push({ t, instrument: 'bass', freq: bassNotes[bassIdx % bassNotes.length], duration: beat * 0.8, volume: 0.15 });
		bassIdx++;
	}
	const leadPhrase = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.Bb4, NOTES.G4, NOTES.E4, NOTES.C4, NOTES.D4];
	let leadIdx = 0;
	for (let t = beat * 4; t < durationSec; t += beat) {
		if (leadIdx % 16 < 8) events.push({ t, instrument: 'lead', freq: leadPhrase[leadIdx % leadPhrase.length], duration: beat * 0.6, volume: 0.08 });
		leadIdx++;
	}
	const arpNotes = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5, NOTES.G4, NOTES.E4];
	for (let t = beat * 8; t < durationSec; t += beat * 16) {
		events.push({ t, instrument: 'arp', freq: arpNotes[0], duration: beat * 8, volume: 0.06 });
	}
	return events;
}

function generateDnbSchedule(bpm: number, durationSec: number): MusicEvent[] {
	const events: MusicEvent[] = [];
	const beat = 60 / bpm;
	const sixteenth = beat / 4;
	let barCount = 0;
	for (let t = 0; t < durationSec; t += beat * 4) {
		const isBreakbar = barCount % 4 >= 2;
		for (let b = 0; b < 4 && t + b * beat < durationSec; b++) {
			const bt = t + b * beat;
			if (isBreakbar) {
				if (b === 0) events.push({ t: bt, instrument: 'kick', volume: 0.4 });
				if (b === 1) events.push({ t: bt + sixteenth * 3, instrument: 'kick', volume: 0.3 });
				if (b === 3) events.push({ t: bt + sixteenth, instrument: 'kick', volume: 0.35 });
				if (b === 1 || b === 3) events.push({ t: bt, instrument: 'snare', volume: 0.25 });
				if (b === 2) events.push({ t: bt + sixteenth * 2, instrument: 'snare', volume: 0.2 });
			} else {
				if (b === 0) events.push({ t: bt, instrument: 'kick', volume: 0.4 });
				if (b === 2) events.push({ t: bt + sixteenth * 2, instrument: 'kick', volume: 0.35 });
				if (b === 1 || b === 3) events.push({ t: bt, instrument: 'snare', volume: 0.25 });
			}
			for (let s = 0; s < 4; s++) {
				const ht = bt + s * sixteenth;
				if (ht < durationSec) events.push({ t: ht, instrument: 'hihat', volume: s % 2 === 0 ? 0.1 : 0.06 });
			}
		}
		barCount++;
	}
	const bassNotes = [NOTES.C2, NOTES.D2, NOTES.E2, NOTES.G2, NOTES.F2, NOTES.D2];
	let bassIdx = 0;
	for (let t = 0; t < durationSec; t += beat * 0.5) {
		events.push({ t, instrument: 'bass', freq: bassNotes[bassIdx % bassNotes.length], duration: beat * 0.4, volume: 0.2 });
		bassIdx++;
	}
	const leadNotes = [NOTES.C5, NOTES.Bb4, NOTES.G4, NOTES.E4];
	let li = 0;
	for (let t = beat * 2; t < durationSec; t += beat * 2) {
		events.push({ t, instrument: 'lead', freq: leadNotes[li % leadNotes.length], duration: beat * 0.3, volume: 0.07 });
		li++;
	}
	return events;
}

function generateChillSchedule(bpm: number, durationSec: number): MusicEvent[] {
	const events: MusicEvent[] = [];
	const beat = 60 / bpm;
	for (let t = 0; t < durationSec; t += beat * 4) {
		for (let b = 0; b < 4 && t + b * beat < durationSec; b++) {
			const bt = t + b * beat;
			if (b === 0 || b === 2) events.push({ t: bt, instrument: 'kick', volume: 0.2 });
			if (b === 1 || b === 3) events.push({ t: bt, instrument: 'snare', volume: 0.1 });
			events.push({ t: bt, instrument: 'hihat', volume: 0.05 });
			events.push({ t: bt + beat / 2, instrument: 'hihat', volume: 0.03 });
		}
	}
	const padChords = [[NOTES.C3, NOTES.E3, NOTES.G3], [NOTES.A2, NOTES.C3, NOTES.E3], [NOTES.F2, NOTES.A2, NOTES.C3], [NOTES.G2, NOTES.Bb2, NOTES.D3]];
	let pi = 0;
	for (let t = 0; t < durationSec; t += beat * 8) {
		events.push({ t, instrument: 'pad', freq: padChords[pi % padChords.length][0], duration: beat * 7.5, volume: 0.05 });
		pi++;
	}
	const bassLine = [NOTES.C2, NOTES.E2, NOTES.G2, NOTES.E2, NOTES.A2, NOTES.C3, NOTES.A2, NOTES.G2, NOTES.F2, NOTES.A2, NOTES.C3, NOTES.A2, NOTES.G2, NOTES.Bb2, NOTES.D3, NOTES.Bb2];
	let bi = 0;
	for (let t = 0; t < durationSec; t += beat) {
		events.push({ t, instrument: 'bass', freq: bassLine[bi % bassLine.length], duration: beat * 0.9, volume: 0.1 });
		bi++;
	}
	const melody = [NOTES.E4, NOTES.G4, NOTES.A4, NOTES.G4, NOTES.E4, NOTES.D4, NOTES.C4, NOTES.D4];
	let mi = 0;
	for (let t = beat * 2; t < durationSec; t += beat * 2) {
		if (mi % 8 < 6) events.push({ t, instrument: 'lead', freq: melody[mi % melody.length], duration: beat * 1.5, volume: 0.05 });
		mi++;
	}
	return events;
}

function generateDefaultSchedule(bpm: number, durationSec: number): MusicEvent[] {
	const events: MusicEvent[] = [];
	const beat = 60 / bpm;
	const eighth = beat / 2;
	for (let t = 0; t < durationSec; t += beat) {
		events.push({ t, instrument: 'kick', volume: 0.25 });
		events.push({ t, instrument: 'hihat', volume: 0.08 });
		events.push({ t: t + eighth, instrument: 'hihat', volume: 0.05 });
	}
	const bassNotes = [NOTES.C2, NOTES.G2, NOTES.A2, NOTES.F2];
	let bi = 0;
	for (let t = 0; t < durationSec; t += beat * 2) {
		events.push({ t, instrument: 'bass', freq: bassNotes[bi % bassNotes.length], duration: beat * 1.5, volume: 0.1 });
		bi++;
	}
	return events;
}

function generateMusicSchedule(bpm: number, durationSec: number, style?: MusicStyle): MusicEvent[] {
	const generators: Record<MusicStyle, (b: number, d: number) => MusicEvent[]> = {
		electro: generateElectroSchedule,
		dnb: generateDnbSchedule,
		chill: generateChillSchedule,
	};
	const gen = style ? generators[style] : undefined;
	const events = gen ? gen(bpm, durationSec) : generateDefaultSchedule(bpm, durationSec);
	return events.sort((a, b) => a.t - b.t);
}

// ---------------------------------------------------------------------------
// Chart generation from music schedule
// ---------------------------------------------------------------------------

function instrumentToLane(instrument: Instrument): Lane {
	switch (instrument) {
		case 'kick': case 'bass': return 0;
		case 'snare': case 'hihat': return 1;
		case 'lead': case 'arp': case 'pad': return 2;
	}
}

function filterByDifficulty(schedule: MusicEvent[], difficulty: Difficulty): MusicEvent[] {
	switch (difficulty) {
		case 'easy': return schedule.filter(ev => ev.instrument === 'kick' || ev.instrument === 'snare');
		case 'normal': return schedule.filter(ev => ev.instrument === 'kick' || ev.instrument === 'snare' || ev.instrument === 'bass' || ev.instrument === 'lead');
		case 'hard': return schedule.filter(ev => ev.instrument === 'kick' || ev.instrument === 'snare' || ev.instrument === 'hihat' || ev.instrument === 'bass' || ev.instrument === 'lead' || ev.instrument === 'arp');
	}
}

function shouldBeHold(ev: MusicEvent, difficulty: Difficulty): boolean {
	if (!ev.duration || ev.duration < 0.5) return false;
	if (ev.instrument === 'bass' || ev.instrument === 'lead' || ev.instrument === 'pad') {
		if (difficulty === 'easy') return ev.duration >= 1.5;
		if (difficulty === 'normal') return ev.duration >= 0.8;
		return ev.duration >= 0.5;
	}
	return false;
}

function round3(n: number): number {
	return Math.round(n * 1000) / 1000;
}

function generateChartFromMusic(schedule: MusicEvent[], difficulty: Difficulty, bpm: number): Note[] {
	const filtered = filterByDifficulty(schedule, difficulty);
	const rawNotes = filtered.map((ev): Note => ({
		t: round3(ev.t),
		lane: instrumentToLane(ev.instrument),
		instrument: ev.instrument,
		freq: ev.freq,
		duration: shouldBeHold(ev, difficulty) ? ev.duration : undefined,
	}));

	// Merge close notes
	const sorted = [...rawNotes].sort((a, b) => a.t - b.t || a.lane - b.lane);
	const result: Note[] = [];
	const lastTimeByLane: Record<number, number> = { 0: -Infinity, 1: -Infinity, 2: -Infinity };
	const threshold = 0.03;
	for (const note of sorted) {
		if (note.t - lastTimeByLane[note.lane] < threshold) continue;
		const simultaneous = result.filter(n => Math.abs(n.t - note.t) < threshold);
		if (simultaneous.length >= 2) continue;
		result.push(note);
		lastTimeByLane[note.lane] = note.t;
	}

	// Lead-in
	const leadInSec = (60 / bpm) * 2;
	return result.filter(n => n.t >= leadInSec);
}

function generateSyncedChart(bpm: number, durationSec: number, difficulty: Difficulty, style?: MusicStyle): Note[] {
	const schedule = generateMusicSchedule(bpm, durationSec, style);
	return generateChartFromMusic(schedule, difficulty, bpm);
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
	{ id: CHART_IDS.firstSteps, songId: SONG_IDS.firstSteps, difficulty: 'easy', notes: generateSyncedChart(100, 30, 'easy') },
	{ id: CHART_IDS.demoBeat, songId: SONG_IDS.demoBeat, difficulty: 'normal', notes: generateSyncedChart(120, 30, 'normal') },
	{ id: CHART_IDS.electricRush, songId: SONG_IDS.electricRush, difficulty: 'normal', notes: generateSyncedChart(140, 35, 'normal', 'electro') },
	{ id: CHART_IDS.dnbFury, songId: SONG_IDS.dnbFury, difficulty: 'hard', notes: generateSyncedChart(170, 40, 'hard', 'dnb') },
	{ id: CHART_IDS.midnightChill, songId: SONG_IDS.midnightChill, difficulty: 'easy', notes: generateSyncedChart(90, 35, 'easy', 'chill') },
	{ id: CHART_IDS.neonNights, songId: SONG_IDS.neonNights, difficulty: 'normal', notes: generateSyncedChart(128, 45, 'normal', 'electro') },
	{ id: CHART_IDS.breakbeat, songId: SONG_IDS.breakbeat, difficulty: 'hard', notes: generateSyncedChart(160, 40, 'hard', 'dnb') },
	{ id: CHART_IDS.sunsetWaves, songId: SONG_IDS.sunsetWaves, difficulty: 'easy', notes: generateSyncedChart(85, 50, 'easy', 'chill') },
	{ id: CHART_IDS.cyberPunk, songId: SONG_IDS.cyberPunk, difficulty: 'hard', notes: generateSyncedChart(150, 45, 'hard', 'electro') },
	{ id: CHART_IDS.liquidDreams, songId: SONG_IDS.liquidDreams, difficulty: 'normal', notes: generateSyncedChart(130, 45, 'normal', 'chill') },
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

	// ── Shop items ──
	const shopItemDefs = [
		// Themes
		{ type: 'theme', itemId: 'space', name: 'Space', description: 'Deep space background with stars', price: 200 },
		{ type: 'theme', itemId: 'ocean', name: 'Ocean', description: 'Deep blue ocean vibes', price: 200 },
		{ type: 'theme', itemId: 'cyberpunk', name: 'Cyberpunk', description: 'Neon-lit city aesthetic', price: 300 },
		{ type: 'theme', itemId: 'forest', name: 'Forest', description: 'Calm forest atmosphere', price: 200 },
		// Skins
		{ type: 'skin', itemId: 'neon', name: 'Neon', description: 'Bright neon note skins', price: 150 },
		{ type: 'skin', itemId: 'minimal', name: 'Minimal', description: 'Clean minimal note style', price: 100 },
		// Effects
		{ type: 'effect', itemId: 'splash', name: 'Splash', description: 'Splash hit effect', price: 150 },
		{ type: 'effect', itemId: 'lightning', name: 'Lightning', description: 'Electric lightning hits', price: 200 },
		{ type: 'effect', itemId: 'pixel', name: 'Pixel', description: 'Retro pixel burst effect', price: 150 },
		// Combo colors
		{ type: 'combo_color', itemId: 'rainbow', name: 'Rainbow', description: 'Rainbow combo counter', price: 100 },
		{ type: 'combo_color', itemId: 'fire', name: 'Fire', description: 'Fiery combo colors', price: 150 },
		{ type: 'combo_color', itemId: 'ice', name: 'Ice', description: 'Cool ice-blue combo', price: 100 },
	];

	console.log(`Seeding ${shopItemDefs.length} shop items...`);
	for (const item of shopItemDefs) {
		const [inserted] = await db
			.insert(shopItems)
			.values(item)
			.onConflictDoNothing()
			.returning();

		if (inserted) {
			console.log(`  + Shop item: ${item.name} (${item.type})`);
		} else {
			console.log(`  = Shop item already exists: ${item.name}`);
		}
	}

	console.log('Seed complete.');
	await client.end();
}

seed().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
