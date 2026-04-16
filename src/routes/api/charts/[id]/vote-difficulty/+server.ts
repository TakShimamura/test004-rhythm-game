import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { difficultyVotes, charts } from '$lib/server/db/schema.js';
import { auth } from '$lib/server/auth.js';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

const VALID_VOTES = ['easy', 'normal', 'hard'] as const;

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const chartId = params.id;
	const { vote } = await request.json();

	if (!VALID_VOTES.includes(vote)) {
		throw error(400, 'Vote must be one of: easy, normal, hard');
	}

	const [chart] = await db
		.select({ id: charts.id })
		.from(charts)
		.where(eq(charts.id, chartId))
		.limit(1);

	if (!chart) throw error(404, 'Chart not found');

	// Upsert
	const [existing] = await db
		.select({ id: difficultyVotes.id })
		.from(difficultyVotes)
		.where(
			and(
				eq(difficultyVotes.userId, session.user.id),
				eq(difficultyVotes.chartId, chartId),
			),
		)
		.limit(1);

	if (existing) {
		await db
			.update(difficultyVotes)
			.set({ vote })
			.where(eq(difficultyVotes.id, existing.id));
	} else {
		await db
			.insert(difficultyVotes)
			.values({ userId: session.user.id, chartId, vote });
	}

	return json({ ok: true });
};
