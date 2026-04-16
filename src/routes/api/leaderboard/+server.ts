import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { playerProfiles, user } from '$lib/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async () => {
	const rows = await db
		.select({
			userId: playerProfiles.userId,
			xp: playerProfiles.xp,
			level: playerProfiles.level,
			totalPlays: playerProfiles.totalPlays,
			playerName: user.name,
			playerImage: user.image,
		})
		.from(playerProfiles)
		.innerJoin(user, eq(user.id, playerProfiles.userId))
		.orderBy(desc(playerProfiles.xp))
		.limit(50);

	return json(rows);
};
