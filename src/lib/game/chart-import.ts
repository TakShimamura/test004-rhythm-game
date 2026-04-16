import type { Note, Lane } from './types.js';

// ---------------------------------------------------------------------------
// osu! mania format parser
// ---------------------------------------------------------------------------

export function parseOsuFile(content: string): { bpm: number; notes: Note[]; title?: string; artist?: string } {
	const lines = content.split(/\r?\n/);

	let title: string | undefined;
	let artist: string | undefined;
	let bpm = 120;
	let circleSize = 4; // number of keys (columns)
	const notes: Note[] = [];

	let section = '';

	for (const raw of lines) {
		const line = raw.trim();

		// Section headers
		if (line.startsWith('[') && line.endsWith(']')) {
			section = line.slice(1, -1);
			continue;
		}

		// Metadata
		if (section === 'Metadata') {
			if (line.startsWith('Title:')) title = line.slice(6).trim();
			if (line.startsWith('Artist:')) artist = line.slice(7).trim();
		}

		// Difficulty section for column count
		if (section === 'Difficulty') {
			if (line.startsWith('CircleSize:')) {
				circleSize = Math.max(1, parseInt(line.slice(11).trim(), 10) || 4);
			}
		}

		// Timing points (first uninherited point gives BPM)
		if (section === 'TimingPoints' && line.includes(',')) {
			const parts = line.split(',');
			if (parts.length >= 2) {
				const msPerBeat = parseFloat(parts[1]);
				// Uninherited points have positive msPerBeat (or flag in column 7 = 1)
				const uninherited = parts.length >= 7 ? parts[6]?.trim() === '1' : msPerBeat > 0;
				if (uninherited && msPerBeat > 0 && bpm === 120) {
					bpm = Math.round(60000 / msPerBeat);
				}
			}
		}

		// Hit objects
		if (section === 'HitObjects' && line.includes(',')) {
			const parts = line.split(',');
			if (parts.length < 4) continue;

			const x = parseInt(parts[0], 10);
			const timeMs = parseInt(parts[2], 10);
			const type = parseInt(parts[3], 10);

			// Map x position to column: osu!mania uses x = column * (512 / circleSize)
			const column = Math.floor((x * circleSize) / 512);
			const lane = mapColumnToLane(column, circleSize);
			const t = timeMs / 1000;

			// Type bit 7 (128) = hold note in mania
			if (type & 128) {
				// Hold note: endTime is in the extras after the last colon
				// Format: x,y,time,type,hitSound,endTime:...
				const extras = parts.slice(5).join(',');
				const endTimeStr = extras.split(':')[0];
				const endTimeMs = parseInt(endTimeStr, 10);
				if (!isNaN(endTimeMs) && endTimeMs > timeMs) {
					const duration = (endTimeMs - timeMs) / 1000;
					notes.push({ t, lane, duration });
				} else {
					notes.push({ t, lane });
				}
			} else {
				notes.push({ t, lane });
			}
		}
	}

	// Clamp BPM to sane range
	if (bpm < 40 || bpm > 300) bpm = 120;

	notes.sort((a, b) => a.t - b.t);
	return { bpm, notes, title, artist };
}

/** Map an osu!mania column index (0-based) to our 3-lane system */
function mapColumnToLane(column: number, totalColumns: number): Lane {
	if (totalColumns <= 3) {
		// Direct mapping, clamped
		return Math.min(2, Math.max(0, column)) as Lane;
	}
	// Map proportionally: divide columns into 3 zones
	const ratio = column / totalColumns;
	if (ratio < 0.333) return 0;
	if (ratio < 0.667) return 1;
	return 2;
}

// ---------------------------------------------------------------------------
// StepMania (.sm) format parser
// ---------------------------------------------------------------------------

export function parseSmFile(content: string): { bpm: number; notes: Note[]; title?: string; artist?: string } {
	let title: string | undefined;
	let artist: string | undefined;
	let bpm = 120;
	const notes: Note[] = [];

	// Parse header tags
	const titleMatch = content.match(/#TITLE:(.*?);/);
	if (titleMatch) title = titleMatch[1].trim();

	const artistMatch = content.match(/#ARTIST:(.*?);/);
	if (artistMatch) artist = artistMatch[1].trim();

	// Parse BPMs tag - take the first BPM value
	const bpmsMatch = content.match(/#BPMS:(.*?);/s);
	if (bpmsMatch) {
		const bpmEntries = bpmsMatch[1].split(',');
		for (const entry of bpmEntries) {
			const [, bpmVal] = entry.split('=').map(s => s.trim());
			const parsed = parseFloat(bpmVal);
			if (!isNaN(parsed) && parsed > 0) {
				bpm = Math.round(parsed);
				break; // Use first BPM
			}
		}
	}

	// Parse offset
	let offsetSec = 0;
	const offsetMatch = content.match(/#OFFSET:(.*?);/);
	if (offsetMatch) {
		offsetSec = parseFloat(offsetMatch[1].trim()) || 0;
	}

	// Find NOTES sections
	const notesRegex = /#NOTES:\s*(.*?);/gs;
	let notesMatch: RegExpExecArray | null;
	let bestNoteData: string | null = null;

	while ((notesMatch = notesRegex.exec(content)) !== null) {
		const block = notesMatch[1];
		// The notes section has metadata lines separated by colons, then measure data
		// Format: dance-type : description : difficulty-name : rating : groove-data : note-data
		const colonParts = block.split(':');
		if (colonParts.length >= 6) {
			bestNoteData = colonParts.slice(5).join(':').trim();
			break; // Take first chart found
		}
	}

	if (bestNoteData) {
		parseSmNoteData(bestNoteData, bpm, offsetSec, notes);
	}

	if (bpm < 40 || bpm > 300) bpm = 120;

	notes.sort((a, b) => a.t - b.t);
	return { bpm, notes, title, artist };
}

/**
 * Parse StepMania note data into our Note format.
 * SM format: measures separated by commas, each measure has rows of 4 characters (LDUR).
 * Characters: 0=none, 1=tap, 2=hold start, 3=hold end, 4=roll, M=mine
 */
function parseSmNoteData(data: string, bpm: number, offsetSec: number, notes: Note[]): void {
	const measures = data.split(',').map(m => m.trim()).filter(m => m.length > 0);
	const beatDuration = 60 / bpm;

	// Track active holds: panel index -> start time
	const activeHolds = new Map<number, number>();

	for (let measureIdx = 0; measureIdx < measures.length; measureIdx++) {
		const rows = measures[measureIdx].split(/\r?\n/).map(r => r.trim()).filter(r => r.length >= 4);
		if (rows.length === 0) continue;

		const rowsPerBeat = rows.length / 4; // 4 beats per measure

		for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
			const row = rows[rowIdx];
			const beatInSong = measureIdx * 4 + rowIdx / rowsPerBeat;
			const t = Math.round((beatInSong * beatDuration - offsetSec) * 1000) / 1000;

			if (t < 0) continue;

			for (let panel = 0; panel < 4 && panel < row.length; panel++) {
				const ch = row[panel];
				const lane = smPanelToLane(panel);

				if (ch === '1' || ch === '4') {
					// Tap note or roll start (treat rolls as taps)
					notes.push({ t, lane });
				} else if (ch === '2') {
					// Hold start
					activeHolds.set(panel, t);
				} else if (ch === '3') {
					// Hold end
					const startT = activeHolds.get(panel);
					if (startT !== undefined) {
						const duration = Math.round((t - startT) * 1000) / 1000;
						if (duration > 0) {
							notes.push({ t: startT, lane, duration });
						} else {
							notes.push({ t: startT, lane });
						}
						activeHolds.delete(panel);
					}
				}
				// 0 = empty, M = mine (skip)
			}
		}
	}
}

/** Map StepMania 4-panel (Left=0, Down=1, Up=2, Right=3) to 3 lanes */
function smPanelToLane(panel: number): Lane {
	// Left + Down -> lane 0, Up -> lane 1 (center), Right -> lane 2
	switch (panel) {
		case 0: return 0; // Left
		case 1: return 0; // Down (share with left)
		case 2: return 1; // Up (center)
		case 3: return 2; // Right
		default: return 1;
	}
}

// ---------------------------------------------------------------------------
// Our JSON chart format import/export
// ---------------------------------------------------------------------------

export function exportChartJson(chart: {
	notes: Note[];
	bpm: number;
	difficulty: string;
	songId?: string;
}): string {
	return JSON.stringify({
		version: 1,
		format: 'rhythm-game-chart',
		bpm: chart.bpm,
		difficulty: chart.difficulty,
		songId: chart.songId,
		noteCount: chart.notes.length,
		notes: chart.notes,
	}, null, 2);
}

export function importChartJson(json: string): { notes: Note[]; bpm: number; difficulty?: string } {
	const data = JSON.parse(json);

	if (!data || typeof data !== 'object') {
		throw new Error('Invalid chart JSON: not an object');
	}

	const notes: Note[] = [];
	const rawNotes = Array.isArray(data.notes) ? data.notes : [];

	for (const n of rawNotes) {
		if (typeof n.t !== 'number' || ![0, 1, 2].includes(n.lane)) continue;
		const note: Note = { t: n.t, lane: n.lane as Lane };
		if (typeof n.duration === 'number' && n.duration > 0) note.duration = n.duration;
		if (typeof n.instrument === 'string') note.instrument = n.instrument;
		if (typeof n.freq === 'number') note.freq = n.freq;
		notes.push(note);
	}

	const bpm = typeof data.bpm === 'number' && data.bpm > 0 ? data.bpm : 120;
	const difficulty = typeof data.difficulty === 'string' ? data.difficulty : undefined;

	return { notes, bpm, difficulty };
}

// ---------------------------------------------------------------------------
// Auto-detect format
// ---------------------------------------------------------------------------

export function detectFormat(filename: string, content: string): 'osu' | 'sm' | 'json' | 'unknown' {
	const ext = filename.split('.').pop()?.toLowerCase();
	if (ext === 'osu') return 'osu';
	if (ext === 'sm') return 'sm';
	if (ext === 'json') return 'json';

	// Content-based detection
	if (content.includes('osu file format v')) return 'osu';
	if (content.includes('#NOTES:') || content.includes('#BPMS:')) return 'sm';
	try {
		JSON.parse(content);
		return 'json';
	} catch {
		// not json
	}
	return 'unknown';
}

export function parseChartFile(
	filename: string,
	content: string,
): { bpm: number; notes: Note[]; title?: string; artist?: string; difficulty?: string } {
	const format = detectFormat(filename, content);
	switch (format) {
		case 'osu':
			return parseOsuFile(content);
		case 'sm':
			return parseSmFile(content);
		case 'json': {
			const result = importChartJson(content);
			return { ...result };
		}
		default:
			throw new Error(`Unsupported chart format: ${filename}`);
	}
}
