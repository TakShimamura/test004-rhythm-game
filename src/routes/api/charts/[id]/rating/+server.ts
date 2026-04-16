import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { chartRatings, charts } from '$lib/server/db/schema.js';
import { eq, and, avg, count } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ request, params }) => {
	const chartId = params.id;

	// Verify chart exists
	const [chart] = await db
		.select({ id: charts.id })
		.from(charts)
		.where(eq(charts.id, chartId))
		.limit(1);

	if (!chart) throw error(404, 'Chart not found');

	// Get average + count
	const [stats] = await db
		.select({
			average: avg(chartRatings.rating),
			total: count(chartRatings.id),
		})
		.from(chartRatings)
		.where(eq(chartRatings.chartId, chartId));

	// Get user's own rating if logged in
	let userRating: number | null = null;
	const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);

	if (session) {
		const [own] = await db
			.select({ rating: chartRatings.rating })
			.from(chartRatings)
			.where(
				and(
					eq(chartRatings.userId, session.user.id),
					eq(chartRatings.chartId, chartId),
				),
			)
			.limit(1);

		if (own) userRating = own.rating;
	}

	return json({
		average: stats.average ? parseFloat(String(stats.average)) : null,
		count: stats.total,
		userRating,
	});
};
