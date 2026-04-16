import type { Chart, Lane, Note } from '$lib/game/types.js';

export type TutorialPrompt = {
	startTime: number;
	endTime: number;
	text: string;
};

// 80 BPM => 0.75s per beat
const BPM = 80;
const BEAT = 60 / BPM; // 0.75s

function beat(n: number): number {
	return Math.round(n * BEAT * 1000) / 1000;
}

// Phase 1 (0-8s): Only lane 1 (S key), 4 notes every 2 beats
const phase1Notes: Note[] = [
	{ t: beat(2), lane: 1 },
	{ t: beat(4), lane: 1 },
	{ t: beat(6), lane: 1 },
	{ t: beat(8), lane: 1 },
];

// Phase 2 (10-18s): Alternating A and S, 8 notes
const phase2Start = 10;
const phase2Notes: Note[] = [
	{ t: phase2Start + beat(0), lane: 0 },
	{ t: phase2Start + beat(1), lane: 1 },
	{ t: phase2Start + beat(2), lane: 0 },
	{ t: phase2Start + beat(3), lane: 1 },
	{ t: phase2Start + beat(4), lane: 0 },
	{ t: phase2Start + beat(5), lane: 1 },
	{ t: phase2Start + beat(6), lane: 0 },
	{ t: phase2Start + beat(7), lane: 1 },
];

// Phase 3 (20-28s): All 3 lanes, simple pattern
const phase3Start = 20;
const phase3Notes: Note[] = [
	{ t: phase3Start + beat(0), lane: 0 },
	{ t: phase3Start + beat(1), lane: 1 },
	{ t: phase3Start + beat(2), lane: 2 },
	{ t: phase3Start + beat(3), lane: 1 },
	{ t: phase3Start + beat(4), lane: 0 },
	{ t: phase3Start + beat(5), lane: 2 },
	{ t: phase3Start + beat(6), lane: 1 },
	{ t: phase3Start + beat(7), lane: 0 },
	{ t: phase3Start + beat(8), lane: 2 },
	{ t: phase3Start + beat(9), lane: 1 },
];

// Phase 4 (30-38s): Introduce a hold note
const phase4Start = 30;
const phase4Notes: Note[] = [
	{ t: phase4Start + beat(0), lane: 1 },
	{ t: phase4Start + beat(2), lane: 1, duration: BEAT * 2 },
	{ t: phase4Start + beat(6), lane: 0, duration: BEAT * 2 },
];

// Phase 5 (40-48s): Mixed pattern with all note types
const phase5Start = 40;
const phase5Notes: Note[] = [
	{ t: phase5Start + beat(0), lane: 0 },
	{ t: phase5Start + beat(1), lane: 1 },
	{ t: phase5Start + beat(2), lane: 2 },
	{ t: phase5Start + beat(3), lane: 0 },
	{ t: phase5Start + beat(4), lane: 1, duration: BEAT * 1.5 },
	{ t: phase5Start + beat(6), lane: 2 },
	{ t: phase5Start + beat(7), lane: 0 },
	{ t: phase5Start + beat(8), lane: 1 },
	{ t: phase5Start + beat(9), lane: 2, duration: BEAT },
];

export const TUTORIAL_CHART: Chart = {
	id: '00000000-0000-4000-a000-tutorial00001',
	songId: '00000000-0000-4000-a000-tutorial00000',
	difficulty: 'easy',
	bpm: BPM,
	offsetMs: 0,
	notes: [
		...phase1Notes,
		...phase2Notes,
		...phase3Notes,
		...phase4Notes,
		...phase5Notes,
	],
	style: 'chill',
};

export const TUTORIAL_PROMPTS: TutorialPrompt[] = [
	{ startTime: 0, endTime: 8, text: 'Press S when the note reaches the circle' },
	{ startTime: 10, endTime: 18, text: 'Now try A and S' },
	{ startTime: 20, endTime: 28, text: 'Great! Use A, S, and D' },
	{ startTime: 30, endTime: 38, text: 'Hold the key for long notes' },
	{ startTime: 40, endTime: 48, text: "You're ready! Go play!" },
];

/** Phase boundaries for miss-tracking */
export const TUTORIAL_PHASES = [
	{ start: 0, end: 8, noteStart: 0, noteEnd: phase1Notes.length },
	{ start: 10, end: 18, noteStart: phase1Notes.length, noteEnd: phase1Notes.length + phase2Notes.length },
	{ start: 20, end: 28, noteStart: phase1Notes.length + phase2Notes.length, noteEnd: phase1Notes.length + phase2Notes.length + phase3Notes.length },
	{ start: 30, end: 38, noteStart: phase1Notes.length + phase2Notes.length + phase3Notes.length, noteEnd: phase1Notes.length + phase2Notes.length + phase3Notes.length + phase4Notes.length },
	{ start: 40, end: 48, noteStart: phase1Notes.length + phase2Notes.length + phase3Notes.length + phase4Notes.length, noteEnd: phase1Notes.length + phase2Notes.length + phase3Notes.length + phase4Notes.length + phase5Notes.length },
];
