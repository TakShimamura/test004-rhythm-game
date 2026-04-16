import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { dailyChallenges, charts, songs } from '$lib/server/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

function todayString(): string {
	return new Date().toISOString().slice(0, 10);
}

export const GET: RequestHandler = async () => {
	const today = todayString();

	// Try to find today's challenge
	let [challenge] = await db
		.select()
		.from(dailyChallenges)
		.where(eq(dailyChallenges.date, today))
		.limit(1);

	// Auto-create if none exists
	if (!challenge) {
		// Pick a random chart
		const [randomChart] = await db
			.select({ id: charts.id })
			.from(charts)
			.orderBy(sql`random()`)
			.limit(1);

		if (!randomChart) throw error(404, 'No charts available for daily challenge');

		[challenge] = await db
			.insert(dailyChallenges)
			.values({ chartId: randomChart.id, date: today })
			.onConflictDoNothing()
			.returning();

		// In case of race condition, re-fetch
		if (!challenge) {
			[challenge] = await db
				.select()
				.from(dailyChallenges)
				.where(eq(dailyChallenges.date, today))
				.limit(1);
		}
	}

	// Get chart + song info
	const [chartInfo] = await db
		.select({
			chartId: charts.id,
			difficulty: charts.difficulty,
			songId: songs.id,
			songTitle: songs.title,
			songArtist: songs.artist,
			bpm: songs.bpm,
			durationMs: songs.durationMs,
		})
		.from(charts)
		.innerJoin(songs, eq(songs.id, charts.songId))
		.where(eq(charts.id, challenge.chartId))
		.limit(1);

	return json({
		date: challenge.date,
		...chartInfo,
	});
};
