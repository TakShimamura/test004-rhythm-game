import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { charts, songs } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	const [row] = await db
		.select({
			id: charts.id,
			songId: charts.songId,
			difficulty: charts.difficulty,
			notes: charts.notes,
			songTitle: songs.title,
			songArtist: songs.artist,
			bpm: songs.bpm,
			audioUrl: songs.audioUrl,
		})
		.from(charts)
		.innerJoin(songs, eq(songs.id, charts.songId))
		.where(eq(charts.id, params.id));

	if (!row) throw error(404, 'Chart not found');

	return json(row);
};
