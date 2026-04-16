import type { Note } from './types.js';

/**
 * Calculate a difficulty star rating (1.0 to 10.0) for a chart.
 *
 * Factors:
 * - Note density (notes per second)
 * - BPM (faster = harder)
 * - Pattern complexity: doubles/triples, lane switches, hold ratio
 * - Speed: notes with very short gaps between them
 */
export function calculateDifficultyStars(notes: Note[], bpm: number): number {
	if (notes.length === 0) return 1.0;

	const sorted = [...notes].sort((a, b) => a.t - b.t);
	const duration = sorted[sorted.length - 1].t - sorted[0].t;
	if (duration <= 0) return 1.0;

	// --- Note density (notes per second) ---
	const nps = notes.length / duration;
	// 1 nps = easy, 8+ nps = extreme
	const densityScore = Math.min(1, nps / 8);

	// --- BPM factor ---
	// 80 bpm = easy baseline, 200+ = very hard
	const bpmScore = Math.min(1, Math.max(0, (bpm - 80) / 160));

	// --- Pattern complexity ---
	let doubles = 0;
	let triples = 0;
	let laneSwitches = 0;
	let holdNotes = 0;

	// Group notes by timestamp (within 20ms tolerance for doubles/triples)
	const TIME_TOLERANCE = 0.02;
	let groupStart = 0;

	for (let i = 0; i < sorted.length; i++) {
		if (sorted[i].duration && sorted[i].duration! > 0) {
			holdNotes++;
		}

		// Count lane switches (consecutive notes on different lanes)
		if (i > 0 && sorted[i].lane !== sorted[i - 1].lane) {
			laneSwitches++;
		}

		// Detect doubles/triples
		const isLastOrGap =
			i === sorted.length - 1 ||
			sorted[i + 1].t - sorted[i].t > TIME_TOLERANCE;

		if (isLastOrGap) {
			const groupSize = i - groupStart + 1;
			if (groupSize === 2) doubles++;
			if (groupSize >= 3) triples++;
			groupStart = i + 1;
		}
	}

	const switchRatio = laneSwitches / Math.max(1, notes.length - 1);
	const holdRatio = holdNotes / notes.length;
	const doubleRatio = (doubles * 2) / notes.length;
	const tripleRatio = (triples * 3) / notes.length;

	// Complexity: weighted sum of pattern factors (0..1)
	const complexityScore = Math.min(
		1,
		switchRatio * 0.3 + holdRatio * 0.25 + doubleRatio * 0.25 + tripleRatio * 0.2,
	);

	// --- Speed: fraction of notes with very short gaps (< 150ms) ---
	let shortGaps = 0;
	for (let i = 1; i < sorted.length; i++) {
		const gap = sorted[i].t - sorted[i - 1].t;
		if (gap > 0 && gap < 0.15) {
			shortGaps++;
		}
	}
	const speedScore = Math.min(1, shortGaps / Math.max(1, sorted.length - 1));

	// --- Combine with weights ---
	const raw =
		densityScore * 0.35 +
		bpmScore * 0.2 +
		complexityScore * 0.25 +
		speedScore * 0.2;

	// Map 0..1 to 1..10
	const stars = 1 + raw * 9;
	return Math.round(stars * 10) / 10; // one decimal
}

export function getDifficultyLabel(stars: number): string {
	if (stars <= 2) return 'Beginner';
	if (stars <= 4) return 'Easy';
	if (stars <= 6) return 'Normal';
	if (stars <= 8) return 'Hard';
	return 'Expert';
}

/**
 * Returns a CSS color for the given star rating.
 * Gradient: green (1) -> yellow (5) -> red (8) -> purple (10)
 */
export function getDifficultyColor(stars: number): string {
	const clamped = Math.max(1, Math.min(10, stars));

	if (clamped <= 5) {
		// green (120) -> yellow (60)
		const t = (clamped - 1) / 4;
		const hue = 120 - t * 60;
		return `hsl(${hue}, 80%, 50%)`;
	} else if (clamped <= 8) {
		// yellow (60) -> red (0)
		const t = (clamped - 5) / 3;
		const hue = 60 - t * 60;
		return `hsl(${hue}, 85%, 50%)`;
	} else {
		// red (0) -> purple (280)
		const t = (clamped - 8) / 2;
		const hue = 360 - t * 80; // 360 -> 280
		return `hsl(${hue}, 80%, 55%)`;
	}
}
