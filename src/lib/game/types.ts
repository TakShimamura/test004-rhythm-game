export type Lane = 0 | 1 | 2;

export type Note = {
	t: number;
	lane: Lane;
};

export type Difficulty = 'easy' | 'normal' | 'hard';

export type MusicStyle = 'electro' | 'dnb' | 'chill';

export type Chart = {
	id: string;
	songId: string;
	difficulty: Difficulty;
	bpm: number;
	offsetMs: number;
	notes: Note[];
	style?: MusicStyle;
};

export type JudgmentGrade = 'perfect' | 'good' | 'miss';

export type Judgment = {
	grade: JudgmentGrade;
	noteIndex: number;
	lane: Lane;
	deltaMs: number;
};

export type GameConfig = {
	perfectWindowMs: number;
	goodWindowMs: number;
	laneKeys: [string, string, string];
	audioOffsetMs: number;
	scrollSpeedPx: number;
};

export const DEFAULT_CONFIG: GameConfig = {
	perfectWindowMs: 35,
	goodWindowMs: 80,
	laneKeys: ['a', 's', 'd'],
	audioOffsetMs: 0,
	scrollSpeedPx: 600,
};

export type ScoreState = {
	score: number;
	combo: number;
	maxCombo: number;
	perfects: number;
	goods: number;
	misses: number;
};

export function emptyScore(): ScoreState {
	return { score: 0, combo: 0, maxCombo: 0, perfects: 0, goods: 0, misses: 0 };
}

export type GameState = 'waiting' | 'playing' | 'paused' | 'results';
