import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { chartCollections, collectionItems, charts, songs, user } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	const collectionId = params.id;

	const [collection] = await db
		.select({
			id: chartCollections.id,
			name: chartCollections.name,
			description: chartCollections.description,
			isPublic: chartCollections.isPublic,
			createdAt: chartCollections.createdAt,
			userId: chartCollections.userId,
			ownerName: user.name,
		})
		.from(chartCollections)
		.innerJoin(user, eq(user.id, chartCollections.userId))
		.where(eq(chartCollections.id, collectionId))
		.limit(1);

	if (!collection) throw error(404, 'Collection not found');

	const items = await db
		.select({
			chartId: collectionItems.chartId,
			addedAt: collectionItems.addedAt,
			difficulty: charts.difficulty,
			songId: songs.id,
			songTitle: songs.title,
			songArtist: songs.artist,
			bpm: songs.bpm,
		})
		.from(collectionItems)
		.innerJoin(charts, eq(charts.id, collectionItems.chartId))
		.innerJoin(songs, eq(songs.id, charts.songId))
		.where(eq(collectionItems.collectionId, collectionId));

	return json({ ...collection, items });
};
