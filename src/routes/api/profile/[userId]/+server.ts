import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { playerProfiles, achievements, user } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	const { userId } = params;

	const [profile] = await db
		.select()
		.from(playerProfiles)
		.where(eq(playerProfiles.userId, userId))
		.limit(1);

	if (!profile) throw error(404, 'Profile not found');

	const [userData] = await db
		.select({ name: user.name, image: user.image })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	const userAchievements = await db
		.select({ type: achievements.type, unlockedAt: achievements.unlockedAt })
		.from(achievements)
		.where(eq(achievements.userId, userId));

	return json({
		profile,
		user: userData ?? { name: 'Unknown', image: null },
		achievements: userAchievements,
	});
};
