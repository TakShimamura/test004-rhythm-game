import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { chartRatings, charts } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const chartId = params.id;
	const { rating } = await request.json();

	if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
		throw error(400, 'Rating must be an integer 1-5');
	}

	// Verify chart exists
	const [chart] = await db
		.select({ id: charts.id })
		.from(charts)
		.where(eq(charts.id, chartId))
		.limit(1);

	if (!chart) throw error(404, 'Chart not found');

	// Upsert rating
	const [existing] = await db
		.select({ id: chartRatings.id })
		.from(chartRatings)
		.where(
			and(
				eq(chartRatings.userId, session.user.id),
				eq(chartRatings.chartId, chartId),
			),
		)
		.limit(1);

	if (existing) {
		await db
			.update(chartRatings)
			.set({ rating })
			.where(eq(chartRatings.id, existing.id));
	} else {
		await db
			.insert(chartRatings)
			.values({ userId: session.user.id, chartId, rating });
	}

	return json({ ok: true });
};
