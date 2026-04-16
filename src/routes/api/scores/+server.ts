import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { scores } from '$lib/server/db/schema.js';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const body = await request.json();
	const { chartId, score, maxCombo, accuracy } = body;

	if (!chartId || typeof score !== 'number' || typeof maxCombo !== 'number' || typeof accuracy !== 'number') {
		throw error(400, 'Invalid score data');
	}

	const [row] = await db
		.insert(scores)
		.values({
			userId: session.user.id,
			chartId,
			score,
			maxCombo,
			accuracy,
		})
		.returning();

	return json(row, { status: 201 });
};
