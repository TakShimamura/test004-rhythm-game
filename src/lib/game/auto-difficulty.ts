/**
 * Suggests a difficulty star range based on recent play history.
 *
 * Analyzes the last 10 plays:
 * - If average accuracy > 90% at current difficulty -> suggest harder (+1 star)
 * - If average accuracy < 60% -> suggest easier (-1 star)
 * - Otherwise, stay at current level
 *
 * @returns suggested star rating (clamped 1-10)
 */
export function suggestDifficulty(
	recentScores: { accuracy: number; stars: number }[],
): number {
	if (recentScores.length === 0) return 5;

	// Take at most the last 10 plays
	const recent = recentScores.slice(-10);

	const avgAccuracy =
		recent.reduce((sum, s) => sum + s.accuracy, 0) / recent.length;
	const avgStars =
		recent.reduce((sum, s) => sum + s.stars, 0) / recent.length;

	let suggested = avgStars;

	if (avgAccuracy > 0.9) {
		// Player is crushing it -- suggest harder
		suggested = avgStars + 1;
	} else if (avgAccuracy < 0.6) {
		// Player is struggling -- suggest easier
		suggested = avgStars - 1;
	}

	// Clamp to 1-10
	return Math.round(Math.max(1, Math.min(10, suggested)) * 10) / 10;
}
