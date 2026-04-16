import type { Chart, GameConfig, Lane, ScoreState, ReplayData } from './types.js';
import { DEFAULT_CONFIG, emptyScore } from './types.js';
import { applyJudgment, judge, judgeHold } from './scoring.js';

export type GhostState = {
	score: ScoreState;
	hitNotes: Set<number>;
	lanesPressed: Set<Lane>;
};

/**
 * Creates a ghost overlay that simulates a recorded replay's input against a chart.
 * Returns a function that, given the current time, returns the ghost's state.
 */
export function createGhostOverlay(
	chart: Chart,
	replayData: ReplayData,
	config: GameConfig = DEFAULT_CONFIG,
): (currentTime: number) => GhostState {
	let score = emptyScore();
	const hitNotes = new Set<number>();
	const lanesPressed = new Set<Lane>();
	const activeHolds = new Map<number, { startTime: number }>();
	let eventCursor = 0;

	const notes = chart.notes;
	const events = replayData.events;
	const offsetSec = config.audioOffsetMs / 1000;

	return function getGhostState(currentTime: number): GhostState {
		// Process replay events up to currentTime
		const newDownEvents: { lane: Lane; time: number }[] = [];

		while (eventCursor < events.length && events[eventCursor].t <= currentTime) {
			const ev = events[eventCursor];
			if (ev.type === 'down') {
				lanesPressed.add(ev.lane);
				newDownEvents.push({ lane: ev.lane, time: ev.t });
			} else {
				lanesPressed.delete(ev.lane);
			}
			eventCursor++;
		}

		// Score tap notes
		for (const event of newDownEvents) {
			let bestIdx = -1;
			let bestDelta = Infinity;

			for (let i = 0; i < notes.length; i++) {
				if (hitNotes.has(i) || activeHolds.has(i)) continue;
				const note = notes[i];
				if (note.lane !== event.lane) continue;
				const delta = (event.time - note.t - offsetSec) * 1000;
				if (Math.abs(delta) < Math.abs(bestDelta)) {
					bestDelta = delta;
					bestIdx = i;
				}
			}

			if (bestIdx >= 0 && Math.abs(bestDelta) <= config.goodWindowMs) {
				const note = notes[bestIdx];
				if (note.duration && note.duration > 0) {
					activeHolds.set(bestIdx, { startTime: currentTime });
				} else {
					const grade = judge(bestDelta, config);
					hitNotes.add(bestIdx);
					score = applyJudgment(score, grade);
				}
			}
		}

		// Process hold notes
		for (const [noteIdx, hold] of activeHolds) {
			const note = notes[noteIdx];
			const duration = note.duration!;
			const elapsed = currentTime - hold.startTime;
			const isLaneHeld = lanesPressed.has(note.lane);
			const holdComplete = elapsed >= duration;

			if (!isLaneHeld || holdComplete) {
				const heldRatio = Math.min(elapsed / duration, 1);
				const grade = judgeHold(heldRatio);
				activeHolds.delete(noteIdx);
				hitNotes.add(noteIdx);
				score = applyJudgment(score, grade);
			}
		}

		// Check missed notes
		for (let i = 0; i < notes.length; i++) {
			if (hitNotes.has(i) || activeHolds.has(i)) continue;
			const note = notes[i];
			const delta = (currentTime - note.t - offsetSec) * 1000;
			if (delta > config.goodWindowMs) {
				hitNotes.add(i);
				score = applyJudgment(score, 'miss');
			}
		}

		return {
			score: { ...score },
			hitNotes: new Set(hitNotes),
			lanesPressed: new Set(lanesPressed),
		};
	};
}
