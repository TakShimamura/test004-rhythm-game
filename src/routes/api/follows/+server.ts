import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { follows, user } from '$lib/server/db/schema.js';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ request, url }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const targetId = url.searchParams.get('userId');
	if (!targetId) throw error(400, 'Missing userId param');

	const [row] = await db
		.select({ followerId: follows.followerId })
		.from(follows)
		.where(
			and(
				eq(follows.followerId, session.user.id),
				eq(follows.followingId, targetId),
			),
		)
		.limit(1);

	return json({ following: !!row });
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const { followingId } = await request.json();
	if (!followingId || typeof followingId !== 'string') {
		throw error(400, 'Missing followingId');
	}

	if (followingId === session.user.id) {
		throw error(400, 'Cannot follow yourself');
	}

	// Check target user exists
	const [target] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.id, followingId))
		.limit(1);

	if (!target) throw error(404, 'User not found');

	await db
		.insert(follows)
		.values({ followerId: session.user.id, followingId })
		.onConflictDoNothing();

	return json({ ok: true }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const { followingId } = await request.json();
	if (!followingId || typeof followingId !== 'string') {
		throw error(400, 'Missing followingId');
	}

	await db
		.delete(follows)
		.where(
			and(
				eq(follows.followerId, session.user.id),
				eq(follows.followingId, followingId),
			),
		);

	return json({ ok: true });
};
