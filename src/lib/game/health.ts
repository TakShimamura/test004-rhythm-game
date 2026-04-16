import type { JudgmentGrade } from './types.js';

export type HealthBar = {
	health: number;
	applyHit: (grade: JudgmentGrade) => void;
	isDead: () => boolean;
	getHealth: () => number;
};

/**
 * Create a health bar tracker.
 *
 * @param difficultyStars - Star rating of the chart (1-10). Higher = faster drain on miss.
 */
export function createHealthBar(difficultyStars: number = 5): HealthBar {
	let health = 0.5;

	// Difficulty scaling: harder charts drain more on miss
	// At stars=1 drain is 6%, at stars=10 drain is 15%
	const missPenalty = 0.06 + (Math.min(10, difficultyStars) - 1) * 0.01;

	return {
		get health() {
			return health;
		},

		applyHit(grade: JudgmentGrade) {
			switch (grade) {
				case 'perfect':
					health = Math.min(1, health + 0.05);
					break;
				case 'good':
					health = Math.min(1, health + 0.02);
					break;
				case 'miss':
					health = Math.max(0, health - missPenalty);
					break;
			}
		},

		isDead() {
			return health <= 0;
		},

		getHealth() {
			return health;
		},
	};
}
