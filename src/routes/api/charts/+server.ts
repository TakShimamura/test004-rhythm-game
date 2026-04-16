import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { charts } from '$lib/server/db/schema.js';
import { auth } from '$lib/server/auth.js';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const body = await request.json();
	const { songId, difficulty, notes } = body;

	if (!songId || !difficulty || !Array.isArray(notes)) {
		throw error(400, 'Missing required fields: songId, difficulty, notes');
	}

	for (const note of notes) {
		if (typeof note.t !== 'number' || ![0, 1, 2].includes(note.lane)) {
			throw error(400, 'Invalid note format: each note needs t (number) and lane (0|1|2)');
		}
	}

	const [chart] = await db
		.insert(charts)
		.values({
			songId,
			difficulty,
			notes,
			createdBy: session.user.id,
		})
		.returning();

	return json(chart, { status: 201 });
};
