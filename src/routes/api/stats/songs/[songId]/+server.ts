import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { scores, charts } from '$lib/server/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const userId = session.user.id;
	const { songId } = params;

	// Get all charts for this song
	const songCharts = await db
		.select({ id: charts.id })
		.from(charts)
		.where(eq(charts.songId, songId));

	if (songCharts.length === 0) {
		throw error(404, 'Song not found');
	}

	// Get all scores for this song's charts by this user
	const allScores = await db
		.select({
			id: scores.id,
			score: scores.score,
			maxCombo: scores.maxCombo,
			accuracy: scores.accuracy,
			playedAt: scores.playedAt,
			chartId: scores.chartId,
			difficulty: charts.difficulty,
		})
		.from(scores)
		.innerJoin(charts, eq(charts.id, scores.chartId))
		.where(
			and(
				eq(scores.userId, userId),
				eq(charts.songId, songId),
			),
		)
		.orderBy(desc(scores.playedAt));

	if (allScores.length === 0) {
		return json({
			bestScore: 0,
			bestAccuracy: 0,
			bestCombo: 0,
			totalAttempts: 0,
			scoreHistory: [],
			improvement: 0,
		});
	}

	const bestScore = Math.max(...allScores.map((s) => s.score));
	const bestAccuracy = Math.max(...allScores.map((s) => s.accuracy));
	const bestCombo = Math.max(...allScores.map((s) => s.maxCombo));
	const totalAttempts = allScores.length;

	// Score history ordered by date (oldest first for charting)
	const scoreHistory = [...allScores].reverse().map((s) => ({
		score: s.score,
		accuracy: s.accuracy,
		maxCombo: s.maxCombo,
		playedAt: s.playedAt.toISOString(),
		difficulty: s.difficulty,
	}));

	// Improvement: first vs last attempt accuracy
	const firstAccuracy = scoreHistory[0].accuracy;
	const lastAccuracy = scoreHistory[scoreHistory.length - 1].accuracy;
	const improvement = lastAccuracy - firstAccuracy;

	return json({
		bestScore,
		bestAccuracy,
		bestCombo,
		totalAttempts,
		scoreHistory,
		improvement,
	});
};
