import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { scores, charts, songs } from '$lib/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const rows = await db
		.select({
			id: scores.id,
			score: scores.score,
			maxCombo: scores.maxCombo,
			accuracy: scores.accuracy,
			playedAt: scores.playedAt,
			chartDifficulty: charts.difficulty,
			songTitle: songs.title,
			songArtist: songs.artist,
		})
		.from(scores)
		.innerJoin(charts, eq(charts.id, scores.chartId))
		.innerJoin(songs, eq(songs.id, charts.songId))
		.where(eq(scores.userId, session.user.id))
		.orderBy(desc(scores.playedAt))
		.limit(20);

	return json(rows);
};
