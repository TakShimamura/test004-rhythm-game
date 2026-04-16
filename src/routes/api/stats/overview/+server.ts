import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { scores, charts, songs } from '$lib/server/db/schema.js';
import { eq, desc, countDistinct, count, avg, max } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

function getGrade(accuracy: number): string {
	if (accuracy >= 0.95) return 'S';
	if (accuracy >= 0.85) return 'A';
	if (accuracy >= 0.70) return 'B';
	if (accuracy >= 0.50) return 'C';
	return 'D';
}

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const userId = session.user.id;

	// Basic aggregate stats
	const [aggregates] = await db
		.select({
			totalPlays: count(scores.id),
			totalSongs: countDistinct(charts.songId),
			avgAccuracy: avg(scores.accuracy),
			bestCombo: max(scores.maxCombo),
		})
		.from(scores)
		.innerJoin(charts, eq(charts.id, scores.chartId))
		.where(eq(scores.userId, userId));

	// Accuracy over time (last 30 plays)
	const recentPlays = await db
		.select({
			accuracy: scores.accuracy,
			playedAt: scores.playedAt,
		})
		.from(scores)
		.where(eq(scores.userId, userId))
		.orderBy(desc(scores.playedAt))
		.limit(30);

	const accuracyOverTime = recentPlays
		.reverse()
		.map((r) => ({
			date: r.playedAt.toISOString().slice(0, 10),
			accuracy: r.accuracy,
		}));

	// Most played songs (top 5)
	const mostPlayed = await db
		.select({
			songId: charts.songId,
			songTitle: songs.title,
			songArtist: songs.artist,
			playCount: count(scores.id),
		})
		.from(scores)
		.innerJoin(charts, eq(charts.id, scores.chartId))
		.innerJoin(songs, eq(songs.id, charts.songId))
		.where(eq(scores.userId, userId))
		.groupBy(charts.songId, songs.title, songs.artist)
		.orderBy(desc(count(scores.id)))
		.limit(5);

	// Grade distribution — fetch all accuracies and count in JS
	const allAccuracies = await db
		.select({ accuracy: scores.accuracy })
		.from(scores)
		.where(eq(scores.userId, userId));

	const gradeDistribution: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
	for (const row of allAccuracies) {
		const g = getGrade(row.accuracy);
		gradeDistribution[g]++;
	}

	return json({
		totalPlays: aggregates?.totalPlays ?? 0,
		totalSongs: aggregates?.totalSongs ?? 0,
		avgAccuracy: aggregates?.avgAccuracy ? Number(aggregates.avgAccuracy) : 0,
		bestCombo: aggregates?.bestCombo ?? 0,
		accuracyOverTime,
		mostPlayed,
		gradeDistribution,
	});
};
