import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { follows, scores, user, charts, songs } from '$lib/server/db/schema.js';
import { eq, desc, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	// Get list of users the current user follows
	const following = await db
		.select({ followingId: follows.followingId })
		.from(follows)
		.where(eq(follows.followerId, session.user.id));

	const followingIds = following.map((f) => f.followingId);

	if (followingIds.length === 0) {
		return json([]);
	}

	const feed = await db
		.select({
			scoreId: scores.id,
			playerName: user.name,
			playerImage: user.image,
			playerId: user.id,
			songTitle: songs.title,
			songArtist: songs.artist,
			difficulty: charts.difficulty,
			score: scores.score,
			accuracy: scores.accuracy,
			maxCombo: scores.maxCombo,
			playedAt: scores.playedAt,
		})
		.from(scores)
		.innerJoin(user, eq(user.id, scores.userId))
		.innerJoin(charts, eq(charts.id, scores.chartId))
		.innerJoin(songs, eq(songs.id, charts.songId))
		.where(inArray(scores.userId, followingIds))
		.orderBy(desc(scores.playedAt))
		.limit(30);

	return json(feed);
};
