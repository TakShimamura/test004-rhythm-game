// ── Earn rates ──

export const EARN_RATES = {
	play_complete: (score: number) => 10 + Math.floor(score / 1000),
	daily_bonus: 50,
	streak_bonus: (streak: number) => Math.min(streak * 10, 100),
} as const;

// ── Helpers ──

export function calculateEarnings(score: number, streak: number): number {
	const playCoins = EARN_RATES.play_complete(score);
	// streak_bonus is only awarded via the streak/check endpoint, not per-play
	return playCoins;
}
