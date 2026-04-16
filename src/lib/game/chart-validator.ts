import type { Note } from './types.js';

export type ValidationWarning = {
	type: 'impossible_pattern' | 'too_dense' | 'empty_section' | 'too_short' | 'no_notes';
	message: string;
	time?: number;
};

/**
 * Validate a chart for playability issues.
 * Returns an array of warnings (empty = chart is valid).
 */
export function validateChart(notes: Note[], bpm: number): ValidationWarning[] {
	const warnings: ValidationWarning[] = [];

	// No notes at all
	if (notes.length === 0) {
		warnings.push({ type: 'no_notes', message: 'Chart has no notes' });
		return warnings;
	}

	// Too few notes
	if (notes.length < 10) {
		warnings.push({
			type: 'too_short',
			message: `Chart only has ${notes.length} notes (minimum recommended: 10)`,
		});
	}

	// Sort by time for analysis
	const sorted = [...notes].sort((a, b) => a.t - b.t);

	// Check total duration
	const firstT = sorted[0].t;
	const lastT = sorted[sorted.length - 1].t;
	const duration = lastT - firstT;
	if (duration < 5 && notes.length >= 2) {
		warnings.push({
			type: 'too_short',
			message: `Chart content spans only ${duration.toFixed(1)}s (minimum recommended: 5s)`,
			time: firstT,
		});
	}

	// Check for impossible patterns: 3+ simultaneous notes, notes closer than 30ms
	for (let i = 0; i < sorted.length; i++) {
		// Count simultaneous notes (within 10ms)
		let simultaneous = 1;
		let j = i + 1;
		while (j < sorted.length && sorted[j].t - sorted[i].t < 0.01) {
			simultaneous++;
			j++;
		}
		if (simultaneous >= 3) {
			warnings.push({
				type: 'impossible_pattern',
				message: `${simultaneous} simultaneous notes at ${sorted[i].t.toFixed(2)}s (max 2 supported)`,
				time: sorted[i].t,
			});
		}

		// Check for notes too close together (same lane, <30ms apart)
		if (i + 1 < sorted.length) {
			const gap = sorted[i + 1].t - sorted[i].t;
			if (gap > 0 && gap < 0.03 && sorted[i].lane === sorted[i + 1].lane) {
				warnings.push({
					type: 'impossible_pattern',
					message: `Notes on lane ${sorted[i].lane} only ${Math.round(gap * 1000)}ms apart at ${sorted[i].t.toFixed(2)}s`,
					time: sorted[i].t,
				});
			}
		}
	}

	// Check for too-dense sections (>16 notes per second sustained over 2+ seconds)
	const windowSec = 1;
	const densityThreshold = 16;
	let denseStart: number | null = null;

	for (let t = firstT; t <= lastT; t += 0.5) {
		const count = sorted.filter(n => n.t >= t && n.t < t + windowSec).length;
		if (count > densityThreshold) {
			if (denseStart === null) denseStart = t;
		} else {
			if (denseStart !== null && t - denseStart >= 2) {
				warnings.push({
					type: 'too_dense',
					message: `Very dense section from ${denseStart.toFixed(1)}s to ${t.toFixed(1)}s (>16 notes/sec)`,
					time: denseStart,
				});
			}
			denseStart = null;
		}
	}
	// Handle dense section extending to end
	if (denseStart !== null && lastT - denseStart >= 2) {
		warnings.push({
			type: 'too_dense',
			message: `Very dense section from ${denseStart.toFixed(1)}s to end (>16 notes/sec)`,
			time: denseStart,
		});
	}

	// Check for empty sections (>10 seconds with no notes)
	for (let i = 1; i < sorted.length; i++) {
		const gap = sorted[i].t - sorted[i - 1].t;
		if (gap > 10) {
			warnings.push({
				type: 'empty_section',
				message: `${gap.toFixed(1)}s gap with no notes at ${sorted[i - 1].t.toFixed(1)}s`,
				time: sorted[i - 1].t,
			});
		}
	}

	// Deduplicate warnings at the same time and type
	const seen = new Set<string>();
	return warnings.filter(w => {
		const key = `${w.type}:${w.time?.toFixed(1) ?? 'none'}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
