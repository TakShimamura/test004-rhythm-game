import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { scores, playerProfiles, achievements, replays } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { calculateXP, xpToLevel, checkAchievements } from '$lib/game/progression.js';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const body = await request.json();
	const { chartId, score, maxCombo, accuracy, playTimeMs, scoreState, replayEvents } = body;

	if (!chartId || typeof score !== 'number' || typeof maxCombo !== 'number' || typeof accuracy !== 'number') {
		throw error(400, 'Invalid score data');
	}

	const userId = session.user.id;

	// Insert the score
	const [row] = await db
		.insert(scores)
		.values({ userId, chartId, score, maxCombo, accuracy })
		.returning();

	// Insert replay if events provided
	let replayId: string | null = null;
	if (Array.isArray(replayEvents) && replayEvents.length > 0) {
		const [replayRow] = await db
			.insert(replays)
			.values({ userId, scoreId: row.id, chartId, events: replayEvents })
			.returning({ id: replays.id });
		replayId = replayRow.id;
	}

	// Calculate XP gained
	const xpGained = calculateXP(score, accuracy, maxCombo);

	// Upsert player profile
	const [existing] = await db
		.select()
		.from(playerProfiles)
		.where(eq(playerProfiles.userId, userId))
		.limit(1);

	let newXP: number;
	let newTotalPlays: number;
	let newPlayTime: number;

	if (existing) {
		newXP = existing.xp + xpGained;
		newTotalPlays = existing.totalPlays + 1;
		newPlayTime = existing.totalPlayTimeMs + (typeof playTimeMs === 'number' ? playTimeMs : 0);

		await db
			.update(playerProfiles)
			.set({
				xp: newXP,
				level: xpToLevel(newXP),
				totalPlays: newTotalPlays,
				totalPlayTimeMs: newPlayTime,
				updatedAt: new Date(),
			})
			.where(eq(playerProfiles.userId, userId));
	} else {
		newXP = xpGained;
		newTotalPlays = 1;
		newPlayTime = typeof playTimeMs === 'number' ? playTimeMs : 0;

		await db.insert(playerProfiles).values({
			userId,
			xp: newXP,
			level: xpToLevel(newXP),
			totalPlays: newTotalPlays,
			totalPlayTimeMs: newPlayTime,
		});
	}

	const newLevel = xpToLevel(newXP);

	// Check achievements
	const existingAchievements = await db
		.select({ type: achievements.type })
		.from(achievements)
		.where(eq(achievements.userId, userId));

	const alreadyUnlocked = new Set(existingAchievements.map((a) => a.type));

	const profile = { totalPlays: newTotalPlays, level: newLevel };
	const state = scoreState ?? { perfects: 0, goods: 0, misses: 0, maxCombo, score, combo: 0 };
	const newAchievements = checkAchievements(profile, state, accuracy, alreadyUnlocked);

	if (newAchievements.length > 0) {
		await db
			.insert(achievements)
			.values(newAchievements.map((type) => ({ userId, type })));
	}

	return json(
		{
			...row,
			xpGained,
			newLevel,
			newAchievements,
			replayId,
		},
		{ status: 201 },
	);
};
