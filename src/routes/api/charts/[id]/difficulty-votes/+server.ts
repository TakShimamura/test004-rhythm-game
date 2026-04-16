import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { difficultyVotes, charts } from '$lib/server/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	const chartId = params.id;

	const [chart] = await db
		.select({ id: charts.id })
		.from(charts)
		.where(eq(charts.id, chartId))
		.limit(1);

	if (!chart) throw error(404, 'Chart not found');

	const rows = await db
		.select({
			vote: difficultyVotes.vote,
			count: sql<number>`count(*)::int`,
		})
		.from(difficultyVotes)
		.where(eq(difficultyVotes.chartId, chartId))
		.groupBy(difficultyVotes.vote);

	const counts: Record<string, number> = { easy: 0, normal: 0, hard: 0 };
	for (const row of rows) {
		counts[row.vote] = row.count;
	}

	return json(counts);
};
