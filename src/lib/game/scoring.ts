import type { GameConfig, JudgmentGrade, ScoreState } from './types.js';

const SCORE_MAP: Record<JudgmentGrade, number> = {
	perfect: 300,
	good: 100,
	miss: 0,
};

export function judge(deltaMs: number, config: GameConfig): JudgmentGrade {
	const abs = Math.abs(deltaMs);
	if (abs <= config.perfectWindowMs) return 'perfect';
	if (abs <= config.goodWindowMs) return 'good';
	return 'miss';
}

export function applyJudgment(state: ScoreState, grade: JudgmentGrade): ScoreState {
	const combo = grade === 'miss' ? 0 : state.combo + 1;
	return {
		score: state.score + SCORE_MAP[grade],
		combo,
		maxCombo: Math.max(state.maxCombo, combo),
		perfects: state.perfects + (grade === 'perfect' ? 1 : 0),
		goods: state.goods + (grade === 'good' ? 1 : 0),
		misses: state.misses + (grade === 'miss' ? 1 : 0),
	};
}

/**
 * Judge a hold note based on what fraction of its duration the player held.
 * Returns the grade and applies combo/score like a regular note.
 */
export function judgeHold(heldRatio: number): JudgmentGrade {
	if (heldRatio >= 0.9) return 'perfect';
	if (heldRatio >= 0.6) return 'good';
	return 'miss';
}

export function accuracy(state: ScoreState): number {
	const total = state.perfects + state.goods + state.misses;
	if (total === 0) return 1;
	return (state.perfects + state.goods * 0.5) / total;
}
