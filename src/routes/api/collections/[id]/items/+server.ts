import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { chartCollections, collectionItems, charts } from '$lib/server/db/schema.js';
import { auth } from '$lib/server/auth.js';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const collectionId = params.id;
	const { chartId } = await request.json();

	if (!chartId || typeof chartId !== 'string') {
		throw error(400, 'chartId is required');
	}

	// Verify collection ownership
	const [collection] = await db
		.select({ id: chartCollections.id, userId: chartCollections.userId })
		.from(chartCollections)
		.where(eq(chartCollections.id, collectionId))
		.limit(1);

	if (!collection) throw error(404, 'Collection not found');
	if (collection.userId !== session.user.id) throw error(403, 'Not your collection');

	// Verify chart exists
	const [chart] = await db
		.select({ id: charts.id })
		.from(charts)
		.where(eq(charts.id, chartId))
		.limit(1);

	if (!chart) throw error(404, 'Chart not found');

	// Check not already in collection
	const [existing] = await db
		.select({ id: collectionItems.id })
		.from(collectionItems)
		.where(
			and(
				eq(collectionItems.collectionId, collectionId),
				eq(collectionItems.chartId, chartId),
			),
		)
		.limit(1);

	if (existing) throw error(409, 'Chart already in collection');

	const [item] = await db
		.insert(collectionItems)
		.values({ collectionId, chartId })
		.returning();

	return json(item, { status: 201 });
};
