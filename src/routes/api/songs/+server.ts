import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { songs, charts } from '$lib/server/db/schema.js';
import { auth } from '$lib/server/auth.js';
import { eq, sql } from 'drizzle-orm';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async () => {
	const rows = await db
		.select({
			id: songs.id,
			title: songs.title,
			artist: songs.artist,
			bpm: songs.bpm,
			durationMs: songs.durationMs,
			chartCount: sql<number>`count(${charts.id})::int`,
		})
		.from(songs)
		.leftJoin(charts, eq(charts.songId, songs.id))
		.groupBy(songs.id)
		.orderBy(songs.title);

	return json(rows);
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const formData = await request.formData();
	const title = formData.get('title') as string;
	const artist = formData.get('artist') as string;
	const bpm = parseInt(formData.get('bpm') as string, 10);
	const audioFile = formData.get('audio') as File;

	if (!title || !artist || !bpm || !audioFile) {
		throw error(400, 'Missing required fields: title, artist, bpm, audio');
	}

	if (!audioFile.type.startsWith('audio/')) {
		throw error(400, 'File must be an audio file');
	}

	const uploadDir = join(process.cwd(), 'static', 'uploads');
	await mkdir(uploadDir, { recursive: true });

	const ext = audioFile.name.split('.').pop() ?? 'mp3';
	const filename = `${crypto.randomUUID()}.${ext}`;
	const filepath = join(uploadDir, filename);
	const buffer = Buffer.from(await audioFile.arrayBuffer());
	await writeFile(filepath, buffer);

	const audioCtx = await getAudioDuration(buffer);

	const [song] = await db
		.insert(songs)
		.values({
			title,
			artist,
			audioUrl: `/uploads/${filename}`,
			bpm,
			durationMs: Math.round(audioCtx * 1000),
			uploadedBy: session.user.id,
		})
		.returning();

	return json(song, { status: 201 });
};

async function getAudioDuration(_buffer: Buffer): Promise<number> {
	return 120;
}
