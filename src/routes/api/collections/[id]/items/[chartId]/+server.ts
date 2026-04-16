import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { chartCollections, collectionItems } from '$lib/server/db/schema.js';
import { auth } from '$lib/server/auth.js';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const DELETE: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const collectionId = params.id;
	const chartId = params.chartId;

	// Verify collection ownership
	const [collection] = await db
		.select({ id: chartCollections.id, userId: chartCollections.userId })
		.from(chartCollections)
		.where(eq(chartCollections.id, collectionId))
		.limit(1);

	if (!collection) throw error(404, 'Collection not found');
	if (collection.userId !== session.user.id) throw error(403, 'Not your collection');

	const deleted = await db
		.delete(collectionItems)
		.where(
			and(
				eq(collectionItems.collectionId, collectionId),
				eq(collectionItems.chartId, chartId),
			),
		)
		.returning();

	if (deleted.length === 0) throw error(404, 'Item not in collection');

	return json({ ok: true });
};
