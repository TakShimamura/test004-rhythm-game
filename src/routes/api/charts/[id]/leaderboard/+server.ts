import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { scores, user } from '$lib/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	const rows = await db
		.select({
			id: scores.id,
			score: scores.score,
			maxCombo: scores.maxCombo,
			accuracy: scores.accuracy,
			playedAt: scores.playedAt,
			playerName: user.name,
		})
		.from(scores)
		.innerJoin(user, eq(user.id, scores.userId))
		.where(eq(scores.chartId, params.id))
		.orderBy(desc(scores.score))
		.limit(50);

	return json(rows);
};
