import type { ScoreState } from './types.js';

// ── XP calculations ──

export function calculateXP(score: number, accuracy: number, maxCombo: number): number {
	return Math.floor(score / 10 + accuracy * 50 + maxCombo * 2);
}

export function xpToLevel(totalXP: number): number {
	return Math.floor(Math.sqrt(totalXP / 100)) + 1;
}

export function xpForNextLevel(level: number): number {
	// XP needed to reach `level + 1`
	return level * level * 100;
}

// ── Achievement definitions ──

export type AchievementDef = {
	id: string;
	name: string;
	description: string;
	icon: string;
};

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
	{ id: 'first_play', name: 'First Steps', description: 'Play your first song', icon: '🎵' },
	{ id: 'first_perfect', name: 'Precision', description: 'Get a Perfect judgment', icon: '✨' },
	{ id: 'combo_50', name: 'On Fire', description: 'Reach 50 combo', icon: '🔥' },
	{ id: 'combo_100', name: 'Unstoppable', description: 'Reach 100 combo', icon: '💥' },
	{ id: 's_rank', name: 'S Rank', description: 'Get an S rank (95%+ accuracy)', icon: '🏅' },
	{ id: 'all_perfect', name: 'Flawless', description: 'Full combo with all Perfects', icon: '💎' },
	{ id: 'play_10', name: 'Regular', description: 'Play 10 songs', icon: '🎮' },
	{ id: 'play_50', name: 'Dedicated', description: 'Play 50 songs', icon: '🏆' },
	{ id: 'level_5', name: 'Rising Star', description: 'Reach level 5', icon: '⭐' },
	{ id: 'level_10', name: 'Veteran', description: 'Reach level 10', icon: '🌟' },
];

export type ProfileSnapshot = {
	totalPlays: number;
	level: number;
};

/**
 * Returns achievement type IDs that the player has newly unlocked this play.
 * `alreadyUnlocked` is the set of achievement types the player already has.
 */
export function checkAchievements(
	profile: ProfileSnapshot,
	scoreState: ScoreState,
	accuracy: number,
	alreadyUnlocked: Set<string>,
): string[] {
	const newlyUnlocked: string[] = [];

	function tryUnlock(type: string, condition: boolean) {
		if (condition && !alreadyUnlocked.has(type)) {
			newlyUnlocked.push(type);
		}
	}

	// Play count achievements (profile.totalPlays already includes this play)
	tryUnlock('first_play', profile.totalPlays >= 1);
	tryUnlock('play_10', profile.totalPlays >= 10);
	tryUnlock('play_50', profile.totalPlays >= 50);

	// Score-based achievements
	tryUnlock('first_perfect', scoreState.perfects > 0);
	tryUnlock('combo_50', scoreState.maxCombo >= 50);
	tryUnlock('combo_100', scoreState.maxCombo >= 100);
	tryUnlock('s_rank', accuracy >= 0.95);

	const totalNotes = scoreState.perfects + scoreState.goods + scoreState.misses;
	tryUnlock('all_perfect', totalNotes > 0 && scoreState.perfects === totalNotes && scoreState.maxCombo === totalNotes);

	// Level achievements
	tryUnlock('level_5', profile.level >= 5);
	tryUnlock('level_10', profile.level >= 10);

	return newlyUnlocked;
}
