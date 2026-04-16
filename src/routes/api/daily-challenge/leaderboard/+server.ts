import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { dailyChallenges, scores, user } from '$lib/server/db/schema.js';
import { eq, desc, and, gte, lt } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

function todayString(): string {
	return new Date().toISOString().slice(0, 10);
}

export const GET: RequestHandler = async () => {
	const today = todayString();

	const [challenge] = await db
		.select()
		.from(dailyChallenges)
		.where(eq(dailyChallenges.date, today))
		.limit(1);

	if (!challenge) {
		return json([]);
	}

	const todayStart = new Date(`${today}T00:00:00.000Z`);
	const tomorrowStart = new Date(todayStart);
	tomorrowStart.setDate(tomorrowStart.getDate() + 1);

	const rows = await db
		.select({
			userId: scores.userId,
			playerName: user.name,
			playerImage: user.image,
			score: scores.score,
			accuracy: scores.accuracy,
			maxCombo: scores.maxCombo,
			playedAt: scores.playedAt,
		})
		.from(scores)
		.innerJoin(user, eq(user.id, scores.userId))
		.where(
			and(
				eq(scores.chartId, challenge.chartId),
				gte(scores.playedAt, todayStart),
				lt(scores.playedAt, tomorrowStart),
			),
		)
		.orderBy(desc(scores.score))
		.limit(50);

	return json(rows);
};
