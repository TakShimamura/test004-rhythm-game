import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { loginStreaks, playerProfiles, currencyTransactions } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { EARN_RATES } from '$lib/game/currency.js';
import type { RequestHandler } from './$types.js';

function todayStr(): string {
	return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
	const d = new Date();
	d.setDate(d.getDate() - 1);
	return d.toISOString().slice(0, 10);
}

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const userId = session.user.id;
	const today = todayStr();
	const yesterday = yesterdayStr();

	const [existing] = await db
		.select()
		.from(loginStreaks)
		.where(eq(loginStreaks.userId, userId))
		.limit(1);

	let currentStreak: number;
	let coinsEarned = 0;
	let bonusType: 'daily' | 'streak' | 'none' = 'none';

	if (!existing) {
		// First login ever
		currentStreak = 1;
		coinsEarned = EARN_RATES.daily_bonus;
		bonusType = 'daily';

		await db.insert(loginStreaks).values({
			userId,
			currentStreak: 1,
			longestStreak: 1,
			lastLoginDate: today,
		});
	} else if (existing.lastLoginDate === today) {
		// Already logged in today
		return json({ currentStreak: existing.currentStreak, coinsEarned: 0, bonusType: 'none' });
	} else if (existing.lastLoginDate === yesterday) {
		// Consecutive day — increment streak
		currentStreak = existing.currentStreak + 1;
		const streakBonus = EARN_RATES.streak_bonus(currentStreak);
		coinsEarned = streakBonus;
		bonusType = 'streak';

		const longestStreak = Math.max(existing.longestStreak, currentStreak);
		await db
			.update(loginStreaks)
			.set({
				currentStreak,
				longestStreak,
				lastLoginDate: today,
				updatedAt: new Date(),
			})
			.where(eq(loginStreaks.userId, userId));
	} else {
		// Streak broken — reset to 1
		currentStreak = 1;
		coinsEarned = EARN_RATES.daily_bonus;
		bonusType = 'daily';

		await db
			.update(loginStreaks)
			.set({
				currentStreak: 1,
				lastLoginDate: today,
				updatedAt: new Date(),
			})
			.where(eq(loginStreaks.userId, userId));
	}

	// Award coins if any earned
	if (coinsEarned > 0) {
		const reason = bonusType === 'streak' ? 'streak_bonus' : 'daily_bonus';

		// Update balance
		const [profile] = await db
			.select()
			.from(playerProfiles)
			.where(eq(playerProfiles.userId, userId))
			.limit(1);

		if (profile) {
			await db
				.update(playerProfiles)
				.set({
					balance: profile.balance + coinsEarned,
					updatedAt: new Date(),
				})
				.where(eq(playerProfiles.userId, userId));
		} else {
			await db.insert(playerProfiles).values({
				userId,
				balance: coinsEarned,
			});
		}

		await db.insert(currencyTransactions).values({
			userId,
			amount: coinsEarned,
			reason,
		});
	}

	return json({ currentStreak, coinsEarned, bonusType });
};
