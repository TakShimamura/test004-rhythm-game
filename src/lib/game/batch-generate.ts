import type { Note, MusicStyle, Difficulty } from './types.js';
import { generateMusicSchedule } from './audio.js';
import { generateChartFromMusic } from './chart-from-music.js';

/**
 * Generate easy, normal, and hard charts from a single audio buffer.
 * Uses the music schedule pipeline (generateMusicSchedule + generateChartFromMusic)
 * so every note corresponds to an actual musical event.
 */
export function batchGenerateCharts(
	audioBuffer: AudioBuffer,
	bpm: number,
	style?: MusicStyle,
): { easy: Note[]; normal: Note[]; hard: Note[] } {
	const durationSec = audioBuffer.duration;
	const schedule = generateMusicSchedule(bpm, durationSec, style);

	const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
	const results = {} as Record<Difficulty, Note[]>;

	for (const diff of difficulties) {
		results[diff] = generateChartFromMusic(schedule, diff, bpm);
	}

	return {
		easy: results.easy,
		normal: results.normal,
		hard: results.hard,
	};
}
