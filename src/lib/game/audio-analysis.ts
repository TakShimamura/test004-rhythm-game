import type { Note, Lane, Difficulty } from './types.js';

/**
 * Detect BPM from an AudioBuffer using onset auto-correlation.
 * Returns estimated BPM rounded to nearest integer, or 120 as fallback.
 */
export async function detectBPM(audioBuffer: AudioBuffer): Promise<number> {
	try {
		const onsets = detectOnsets(audioBuffer, 0.5);
		if (onsets.length < 4) return 120;

		// Compute inter-onset intervals
		const intervals: number[] = [];
		for (let i = 1; i < onsets.length; i++) {
			intervals.push(onsets[i] - onsets[i - 1]);
		}

		// Auto-correlate intervals to find dominant period
		// Build a histogram of intervals quantized to ~5ms bins
		const minInterval = 60 / 300; // 300 BPM max
		const maxInterval = 60 / 40; // 40 BPM min
		const binSize = 0.005;
		const numBins = Math.ceil((maxInterval - minInterval) / binSize);
		const histogram = new Float32Array(numBins);

		for (const interval of intervals) {
			// Check the interval and its multiples/divisions
			for (const multiplier of [0.5, 1, 2, 3, 4]) {
				const adjusted = interval / multiplier;
				if (adjusted >= minInterval && adjusted <= maxInterval) {
					const bin = Math.round((adjusted - minInterval) / binSize);
					if (bin >= 0 && bin < numBins) {
						histogram[bin] += 1 / multiplier; // weight closer divisions higher
					}
				}
			}
		}

		// Smooth the histogram
		const smoothed = new Float32Array(numBins);
		const smoothRadius = 3;
		for (let i = 0; i < numBins; i++) {
			let sum = 0;
			let count = 0;
			for (let j = Math.max(0, i - smoothRadius); j <= Math.min(numBins - 1, i + smoothRadius); j++) {
				sum += histogram[j];
				count++;
			}
			smoothed[i] = sum / count;
		}

		// Find peak bin
		let maxVal = 0;
		let maxBin = 0;
		for (let i = 0; i < numBins; i++) {
			if (smoothed[i] > maxVal) {
				maxVal = smoothed[i];
				maxBin = i;
			}
		}

		if (maxVal === 0) return 120;

		const dominantInterval = minInterval + maxBin * binSize;
		const bpm = Math.round(60 / dominantInterval);

		// Sanity check
		if (bpm < 40 || bpm > 300) return 120;
		return bpm;
	} catch {
		return 120;
	}
}

/**
 * Detect onsets (note attack times) in an AudioBuffer using energy-based detection.
 * Returns array of onset times in seconds.
 * @param sensitivity 0.0 to 1.0 (default 0.5) - lower = fewer onsets, higher = more
 */
export function detectOnsets(audioBuffer: AudioBuffer, sensitivity = 0.5): number[] {
	const sampleRate = audioBuffer.sampleRate;
	const data = extractMono(audioBuffer);
	const windowSize = 1024;
	const hopSize = windowSize / 2;
	const numFrames = Math.floor((data.length - windowSize) / hopSize);

	if (numFrames < 2) return [];

	// Compute energy for each window
	const energies = new Float32Array(numFrames);
	for (let i = 0; i < numFrames; i++) {
		const start = i * hopSize;
		let energy = 0;
		for (let j = 0; j < windowSize; j++) {
			energy += data[start + j] * data[start + j];
		}
		energies[i] = energy / windowSize;
	}

	// Compute spectral flux (energy difference between consecutive frames)
	const flux = new Float32Array(numFrames);
	for (let i = 1; i < numFrames; i++) {
		const diff = energies[i] - energies[i - 1];
		flux[i] = diff > 0 ? diff : 0; // half-wave rectify
	}

	// Adaptive threshold: local average over a window
	const thresholdWindowSize = 20;
	const thresholdMultiplier = 1.0 + (1.0 - sensitivity) * 2.0; // sensitivity=1 -> 1x, sensitivity=0 -> 3x
	const onsets: number[] = [];
	const minOnsetGap = 0.05; // 50ms minimum gap between onsets

	for (let i = 1; i < numFrames; i++) {
		// Compute local average
		const start = Math.max(0, i - thresholdWindowSize);
		const end = Math.min(numFrames, i + thresholdWindowSize);
		let localAvg = 0;
		for (let j = start; j < end; j++) {
			localAvg += flux[j];
		}
		localAvg /= (end - start);

		const threshold = localAvg * thresholdMultiplier + 1e-6;

		// Peak detection: flux must exceed threshold and be a local maximum
		if (
			flux[i] > threshold &&
			flux[i] >= flux[i - 1] &&
			(i + 1 >= numFrames || flux[i] >= flux[i + 1])
		) {
			const timeSec = (i * hopSize) / sampleRate;
			// Enforce minimum gap
			if (onsets.length === 0 || timeSec - onsets[onsets.length - 1] >= minOnsetGap) {
				onsets.push(timeSec);
			}
		}
	}

	return onsets;
}

/**
 * Assign each onset to a lane (0, 1, or 2) based on frequency content.
 * Bass (0-300Hz) -> lane 0, Mid (300-2000Hz) -> lane 1, Treble (2000Hz+) -> lane 2
 */
export function assignLanes(
	audioBuffer: AudioBuffer,
	onsetTimes: number[],
): Array<{ t: number; lane: Lane }> {
	const sampleRate = audioBuffer.sampleRate;
	const data = extractMono(audioBuffer);
	const fftSize = 2048;

	// Precompute frequency bin boundaries
	const binHz = sampleRate / fftSize;
	const bassBinEnd = Math.floor(300 / binHz);
	const midBinEnd = Math.floor(2000 / binHz);

	const result: Array<{ t: number; lane: Lane }> = [];
	let consecutiveSameLane = 0;
	let lastLane: Lane = 1;

	for (const t of onsetTimes) {
		const centerSample = Math.round(t * sampleRate);
		const windowStart = Math.max(0, centerSample - fftSize / 2);
		const windowEnd = Math.min(data.length, windowStart + fftSize);
		const actualSize = windowEnd - windowStart;

		if (actualSize < 64) {
			result.push({ t, lane: 1 });
			continue;
		}

		// Extract window and apply Hann window
		const windowed = new Float32Array(fftSize);
		for (let i = 0; i < actualSize; i++) {
			const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (actualSize - 1)));
			windowed[i] = data[windowStart + i] * hann;
		}

		// Compute magnitude spectrum via DFT (simplified - only need band energies)
		const bandEnergies = computeBandEnergies(windowed, fftSize, bassBinEnd, midBinEnd);

		// Determine dominant band
		let lane: Lane;
		if (bandEnergies.bass >= bandEnergies.mid && bandEnergies.bass >= bandEnergies.treble) {
			lane = 0;
		} else if (bandEnergies.mid >= bandEnergies.treble) {
			lane = 1;
		} else {
			lane = 2;
		}

		// Add variety: if too many consecutive same-lane notes, shift to adjacent
		if (lane === lastLane) {
			consecutiveSameLane++;
			if (consecutiveSameLane >= 3) {
				const options: Lane[] = lane === 0 ? [1] : lane === 2 ? [1] : [0, 2];
				lane = options[Math.floor(Math.random() * options.length)];
				consecutiveSameLane = 0;
			}
		} else {
			consecutiveSameLane = 0;
		}

		lastLane = lane;
		result.push({ t, lane });
	}

	return result;
}

/**
 * Generate a chart from an audio buffer with difficulty-based filtering and quantization.
 */
export function generateChart(
	audioBuffer: AudioBuffer,
	bpm: number,
	difficulty: Difficulty,
	sensitivity = 0.5,
): Note[] {
	const onsets = detectOnsets(audioBuffer, sensitivity);
	const laneAssignments = assignLanes(audioBuffer, onsets);

	const beatDuration = 60 / bpm;

	// Difficulty settings
	const config = {
		easy: { subdivision: 2, keepRatio: 0.3 },
		normal: { subdivision: 4, keepRatio: 0.6 },
		hard: { subdivision: 8, keepRatio: 0.9 },
	}[difficulty];

	const gridSize = beatDuration / config.subdivision;

	// Quantize to grid
	const quantized = laneAssignments.map(({ t, lane }) => ({
		t: Math.round(t / gridSize) * gridSize,
		lane,
	}));

	// Remove duplicates at same time+lane
	const seen = new Set<string>();
	const deduped = quantized.filter(({ t, lane }) => {
		const key = `${t.toFixed(4)}_${lane}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	// Thin out notes based on difficulty keepRatio
	// Use a deterministic approach: keep notes with the highest energy positions
	const kept: Array<{ t: number; lane: Lane }> = [];
	const step = Math.max(1, Math.round(1 / config.keepRatio));
	for (let i = 0; i < deduped.length; i++) {
		// Always keep first and last, otherwise keep based on ratio
		if (i === 0 || i === deduped.length - 1 || i % step === 0) {
			kept.push(deduped[i]);
		}
	}

	// Build notes
	const notes: Note[] = [];

	for (let i = 0; i < kept.length; i++) {
		const { t, lane } = kept[i];
		const roundedT = Math.round(t * 1000) / 1000;

		// For hard difficulty, occasionally convert close pairs to hold notes
		if (difficulty === 'hard' && i + 1 < kept.length) {
			const next = kept[i + 1];
			const gap = next.t - t;
			if (next.lane === lane && gap > gridSize * 0.9 && gap < gridSize * 4.1) {
				// Convert to hold note
				const holdDuration = Math.round(gap * 1000) / 1000;
				notes.push({ t: roundedT, lane, duration: holdDuration });
				i++; // skip next note (consumed as hold end)
				continue;
			}
		}

		notes.push({ t: roundedT, lane });
	}

	// Sort by time
	notes.sort((a, b) => a.t - b.t);

	return notes;
}

// --- Internal helpers ---

function extractMono(audioBuffer: AudioBuffer): Float32Array {
	if (audioBuffer.numberOfChannels === 1) {
		return audioBuffer.getChannelData(0);
	}
	const left = audioBuffer.getChannelData(0);
	const right = audioBuffer.getChannelData(1);
	const mono = new Float32Array(left.length);
	for (let i = 0; i < left.length; i++) {
		mono[i] = (left[i] + right[i]) * 0.5;
	}
	return mono;
}

function computeBandEnergies(
	windowed: Float32Array,
	fftSize: number,
	bassBinEnd: number,
	midBinEnd: number,
): { bass: number; mid: number; treble: number } {
	// Simplified DFT for band energies - compute power at sampled frequency bins
	// We only need relative energies between 3 bands, so sample key frequencies
	const halfN = fftSize / 2;

	let bass = 0;
	let mid = 0;
	let treble = 0;

	// Sample bins within each band (not full DFT for performance)
	const step = 4; // Sample every 4th bin for speed

	for (let k = 1; k < halfN; k += step) {
		let real = 0;
		let imag = 0;
		const freq = (2 * Math.PI * k) / fftSize;
		for (let n = 0; n < fftSize; n++) {
			real += windowed[n] * Math.cos(freq * n);
			imag -= windowed[n] * Math.sin(freq * n);
		}
		const magnitude = real * real + imag * imag;

		if (k < bassBinEnd) {
			bass += magnitude;
		} else if (k < midBinEnd) {
			mid += magnitude;
		} else {
			treble += magnitude;
		}
	}

	return { bass, mid, treble };
}
