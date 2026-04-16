import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { playerProfiles, achievements } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const userId = session.user.id;

	const [profile] = await db
		.select()
		.from(playerProfiles)
		.where(eq(playerProfiles.userId, userId))
		.limit(1);

	const userAchievements = await db
		.select({ type: achievements.type, unlockedAt: achievements.unlockedAt })
		.from(achievements)
		.where(eq(achievements.userId, userId));

	return json({
		profile: profile ?? { userId, xp: 0, level: 1, totalPlays: 0, totalPlayTimeMs: 0 },
		achievements: userAchievements,
	});
};
