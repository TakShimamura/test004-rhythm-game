import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { featuredCharts, charts, songs, chartRatings } from '$lib/server/db/schema.js';
import { eq, or, gt, isNull, avg, count, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async () => {
	const now = new Date();

	const rows = await db
		.select({
			featuredId: featuredCharts.id,
			featuredAt: featuredCharts.featuredAt,
			chartId: charts.id,
			difficulty: charts.difficulty,
			songId: songs.id,
			songTitle: songs.title,
			songArtist: songs.artist,
			bpm: songs.bpm,
			avgRating: avg(chartRatings.rating),
			ratingCount: count(chartRatings.id),
		})
		.from(featuredCharts)
		.innerJoin(charts, eq(charts.id, featuredCharts.chartId))
		.innerJoin(songs, eq(songs.id, charts.songId))
		.leftJoin(chartRatings, eq(chartRatings.chartId, charts.id))
		.where(
			or(
				isNull(featuredCharts.expiresAt),
				gt(featuredCharts.expiresAt, now),
			),
		)
		.groupBy(
			featuredCharts.id,
			featuredCharts.featuredAt,
			charts.id,
			charts.difficulty,
			songs.id,
			songs.title,
			songs.artist,
			songs.bpm,
		)
		.orderBy(desc(featuredCharts.featuredAt))
		.limit(6);

	const result = rows.map((r) => ({
		...r,
		avgRating: r.avgRating ? parseFloat(String(r.avgRating)) : null,
		ratingCount: r.ratingCount,
	}));

	return json(result);
};
