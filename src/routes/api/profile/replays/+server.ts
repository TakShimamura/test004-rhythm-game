import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { replays, charts, songs, scores } from '$lib/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const rows = await db
		.select({
			replayId: replays.id,
			createdAt: replays.createdAt,
			score: scores.score,
			accuracy: scores.accuracy,
			maxCombo: scores.maxCombo,
			songTitle: songs.title,
			songArtist: songs.artist,
			chartDifficulty: charts.difficulty,
			chartId: replays.chartId,
		})
		.from(replays)
		.innerJoin(scores, eq(scores.id, replays.scoreId))
		.innerJoin(charts, eq(charts.id, replays.chartId))
		.innerJoin(songs, eq(songs.id, charts.songId))
		.where(eq(replays.userId, session.user.id))
		.orderBy(desc(replays.createdAt))
		.limit(10);

	return json(rows);
};
