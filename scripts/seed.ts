import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { songs, charts } from '../src/lib/server/db/schema.js';

const DEMO_SONG_ID = '00000000-0000-4000-a000-000000000001';
const DEMO_CHART_ID = '00000000-0000-4000-a000-000000000002';
const BPM = 120;

function generateDemoNotes(bpm: number, durationSec: number) {
	const notes: { t: number; lane: 0 | 1 | 2 }[] = [];
	const beatInterval = 60 / bpm;
	const patterns: (0 | 1 | 2)[][] = [[0], [1], [2], [1], [0, 2], [1], [0], [2]];

	let beat = 0;
	let patternIdx = 0;
	let t = beatInterval * 2;

	while (t < durationSec) {
		for (const lane of patterns[patternIdx % patterns.length]) {
			notes.push({ t: Math.round(t * 1000) / 1000, lane });
		}
		const skip = beat < 8 ? 2 : 1;
		t += beatInterval * skip;
		beat += skip;
		patternIdx++;
	}
	return notes;
}

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function seed() {
	const [song] = await db
		.insert(songs)
		.values({
			id: DEMO_SONG_ID,
			title: 'Demo Beat',
			artist: 'Built-in',
			audioUrl: '__metronome__',
			bpm: BPM,
			durationMs: 30000,
		})
		.onConflictDoNothing()
		.returning();

	if (song) {
		await db
			.insert(charts)
			.values({
				id: DEMO_CHART_ID,
				songId: song.id,
				difficulty: 'normal',
				notes: generateDemoNotes(BPM, 30),
			})
			.onConflictDoNothing();
		console.log('Seeded demo song + chart');
	} else {
		console.log('Demo song already exists, skipping');
	}

	await client.end();
}

seed().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
