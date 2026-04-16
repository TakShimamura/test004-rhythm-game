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

export function accuracy(state: ScoreState): number {
	const total = state.perfects + state.goods + state.misses;
	if (total === 0) return 1;
	return (state.perfects + state.goods * 0.5) / total;
}
