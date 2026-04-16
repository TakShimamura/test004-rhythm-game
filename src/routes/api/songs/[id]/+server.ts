import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { songs, charts } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	const [song] = await db
		.select()
		.from(songs)
		.where(eq(songs.id, params.id));

	if (!song) throw error(404, 'Song not found');

	const songCharts = await db
		.select({
			id: charts.id,
			difficulty: charts.difficulty,
			createdAt: charts.createdAt,
		})
		.from(charts)
		.where(eq(charts.songId, params.id));

	return json({ ...song, charts: songCharts });
};
