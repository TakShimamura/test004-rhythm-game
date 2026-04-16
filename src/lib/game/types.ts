export type Lane = 0 | 1 | 2;

export type Note = {
	t: number;
	lane: Lane;
	/** Hold note duration in seconds. When present, renders as a long bar. */
	duration?: number;
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

export type GameMode = 'normal' | 'practice' | 'endless' | 'mirror' | 'nofail';

export type GameModeConfig = {
	mode: GameMode;
	speedMultiplier: number; // 0.5 to 2.0
	mirror: boolean; // flip lanes
	noFail: boolean; // can't fail
	practice: boolean; // practice features enabled
};

export const DEFAULT_MODE_CONFIG: GameModeConfig = {
	mode: 'normal',
	speedMultiplier: 1.0,
	mirror: false,
	noFail: false,
	practice: false,
};
