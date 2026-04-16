import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { replays, charts, songs, scores } from '$lib/server/db/schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	const rows = await db
		.select({
			replayId: replays.id,
			events: replays.events,
			createdAt: replays.createdAt,
			scoreId: replays.scoreId,
			chartId: replays.chartId,
			userId: replays.userId,
			playerName: user.name,
			score: scores.score,
			maxCombo: scores.maxCombo,
			accuracy: scores.accuracy,
			songTitle: songs.title,
			songArtist: songs.artist,
			songBpm: songs.bpm,
			chartDifficulty: charts.difficulty,
			chartNotes: charts.notes,
		})
		.from(replays)
		.innerJoin(scores, eq(scores.id, replays.scoreId))
		.innerJoin(charts, eq(charts.id, replays.chartId))
		.innerJoin(songs, eq(songs.id, charts.songId))
		.innerJoin(user, eq(user.id, replays.userId))
		.where(eq(replays.id, id))
		.limit(1);

	if (rows.length === 0) {
		throw error(404, 'Replay not found');
	}

	const row = rows[0];

	return json({
		id: row.replayId,
		events: row.events,
		createdAt: row.createdAt,
		scoreId: row.scoreId,
		chartId: row.chartId,
		playerName: row.playerName,
		score: row.score,
		maxCombo: row.maxCombo,
		accuracy: row.accuracy,
		songTitle: row.songTitle,
		songArtist: row.songArtist,
		songBpm: row.songBpm,
		chartDifficulty: row.chartDifficulty,
		chartNotes: row.chartNotes,
	});
};
