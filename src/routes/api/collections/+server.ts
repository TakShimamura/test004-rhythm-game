import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { chartCollections, collectionItems } from '$lib/server/db/schema.js';
import { auth } from '$lib/server/auth.js';
import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const rows = await db
		.select({
			id: chartCollections.id,
			name: chartCollections.name,
			description: chartCollections.description,
			isPublic: chartCollections.isPublic,
			createdAt: chartCollections.createdAt,
			itemCount: sql<number>`count(${collectionItems.id})::int`,
		})
		.from(chartCollections)
		.leftJoin(collectionItems, eq(collectionItems.collectionId, chartCollections.id))
		.where(eq(chartCollections.userId, session.user.id))
		.groupBy(chartCollections.id)
		.orderBy(chartCollections.createdAt);

	return json(rows);
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const { name, description, isPublic } = await request.json();

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		throw error(400, 'Collection name is required');
	}

	const [collection] = await db
		.insert(chartCollections)
		.values({
			userId: session.user.id,
			name: name.trim(),
			description: description?.trim() || null,
			isPublic: isPublic !== false,
		})
		.returning();

	return json(collection, { status: 201 });
};
