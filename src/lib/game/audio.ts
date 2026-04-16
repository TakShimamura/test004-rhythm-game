import type { MusicStyle } from './types.js';

export type GameAudio = {
	ctx: AudioContext;
	start: () => void;
	stop: () => void;
	currentTime: () => number;
	startTime: number;
};

export function createGameAudio(): GameAudio {
	const ctx = new AudioContext();
	let startTime = 0;

	return {
		ctx,
		get startTime() {
			return startTime;
		},
		start() {
			if (ctx.state === 'suspended') ctx.resume();
			startTime = ctx.currentTime;
		},
		stop() {
			ctx.suspend();
		},
		currentTime() {
			return ctx.currentTime - startTime;
		},
	};
}

export function playHitSound(ctx: AudioContext, grade: 'perfect' | 'good') {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.frequency.value = grade === 'perfect' ? 880 : 440;
	gain.gain.value = 0.15;
	gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
	osc.start(ctx.currentTime);
	osc.stop(ctx.currentTime + 0.1);
}

// ---------------------------------------------------------------------------
// Synthesized instrument helpers — all write directly into a Float32Array
// ---------------------------------------------------------------------------

type SynthParams = { sampleRate: number; data: Float32Array };

function addSineAt(p: SynthParams, startSec: number, freq: number, dur: number, vol: number) {
	const start = Math.floor(startSec * p.sampleRate);
	const len = Math.ceil(dur * p.sampleRate);
	for (let i = 0; i < len && start + i < p.data.length; i++) {
		const t = i / p.sampleRate;
		const env = 1 - t / dur;
		p.data[start + i] += Math.sin(2 * Math.PI * freq * t) * env * vol;
	}
}

function addBassDrum(p: SynthParams, time: number, vol = 0.35) {
	const start = Math.floor(time * p.sampleRate);
	const dur = 0.15;
	const len = Math.ceil(dur * p.sampleRate);
	for (let i = 0; i < len && start + i < p.data.length; i++) {
		const t = i / p.sampleRate;
		// pitch sweep from 150 Hz down to 40 Hz
		const freq = 40 + 110 * Math.exp(-t * 30);
		const env = Math.exp(-t * 20);
		p.data[start + i] += Math.sin(2 * Math.PI * freq * t) * env * vol;
	}
}

function addSnare(p: SynthParams, time: number, vol = 0.2) {
	const start = Math.floor(time * p.sampleRate);
	const dur = 0.1;
	const len = Math.ceil(dur * p.sampleRate);
	for (let i = 0; i < len && start + i < p.data.length; i++) {
		const t = i / p.sampleRate;
		const env = Math.exp(-t * 25);
		// noise + a tonal body at 200 Hz
		const noise = (Math.random() * 2 - 1) * 0.7;
		const body = Math.sin(2 * Math.PI * 200 * t) * 0.3;
		p.data[start + i] += (noise + body) * env * vol;
	}
}

function addHihat(p: SynthParams, time: number, vol = 0.12) {
	const start = Math.floor(time * p.sampleRate);
	const dur = 0.04;
	const len = Math.ceil(dur * p.sampleRate);
	for (let i = 0; i < len && start + i < p.data.length; i++) {
		const t = i / p.sampleRate;
		const env = Math.exp(-t * 80);
		p.data[start + i] += (Math.random() * 2 - 1) * env * vol;
	}
}

function addOpenHihat(p: SynthParams, time: number, vol = 0.1) {
	const start = Math.floor(time * p.sampleRate);
	const dur = 0.15;
	const len = Math.ceil(dur * p.sampleRate);
	for (let i = 0; i < len && start + i < p.data.length; i++) {
		const t = i / p.sampleRate;
		const env = Math.exp(-t * 15);
		p.data[start + i] += (Math.random() * 2 - 1) * env * vol;
	}
}

function addBassSynth(p: SynthParams, time: number, freq: number, dur: number, vol = 0.18) {
	const start = Math.floor(time * p.sampleRate);
	const len = Math.ceil(dur * p.sampleRate);
	for (let i = 0; i < len && start + i < p.data.length; i++) {
		const t = i / p.sampleRate;
		// sawtooth approximation (3 harmonics)
		let wave = 0;
		for (let h = 1; h <= 3; h++) {
			wave += Math.sin(2 * Math.PI * freq * h * t) / h;
		}
		// ADSR-ish envelope
		const attack = Math.min(t / 0.01, 1);
		const release = t > dur - 0.05 ? (dur - t) / 0.05 : 1;
		const env = attack * Math.max(release, 0);
		p.data[start + i] += wave * env * vol;
	}
}

function addLeadSynth(p: SynthParams, time: number, freq: number, dur: number, vol = 0.1) {
	const start = Math.floor(time * p.sampleRate);
	const len = Math.ceil(dur * p.sampleRate);
	for (let i = 0; i < len && start + i < p.data.length; i++) {
		const t = i / p.sampleRate;
		// square wave with vibrato
		const vibrato = Math.sin(2 * Math.PI * 5 * t) * 3;
		const phase = 2 * Math.PI * (freq + vibrato) * t;
		const wave = Math.sin(phase) > 0 ? 1 : -1;
		// envelope
		const attack = Math.min(t / 0.02, 1);
		const release = t > dur - 0.05 ? (dur - t) / 0.05 : 1;
		const env = attack * Math.max(release, 0) * 0.3; // softer square
		p.data[start + i] += wave * env * vol;
	}
}

// ---------------------------------------------------------------------------
// Style pattern generators
// ---------------------------------------------------------------------------

// Musical note frequencies
const NOTES = {
	C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, Bb2: 116.54,
	C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, Bb3: 233.08,
	C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, Bb4: 466.16,
	C5: 523.25, D5: 587.33, E5: 659.25,
} as const;

type StyleGenerator = (p: SynthParams, bpm: number, durationSec: number) => void;

const generateElectro: StyleGenerator = (p, bpm, durationSec) => {
	const beat = 60 / bpm;
	const eighth = beat / 2;

	for (let t = 0; t < durationSec; t += beat * 4) {
		// 4-bar drum pattern
		for (let b = 0; b < 4 && t + b * beat < durationSec; b++) {
			const bt = t + b * beat;
			// kick on every beat (4-on-the-floor)
			addBassDrum(p, bt, 0.35);
			// snare on 2 and 4
			if (b === 1 || b === 3) addSnare(p, bt, 0.2);
			// hi-hats on every eighth
			addHihat(p, bt, 0.1);
			addHihat(p, bt + eighth, 0.07);
		}
	}

	// bass line — electro pattern
	const bassNotes = [NOTES.C2, NOTES.C2, NOTES.Bb2, NOTES.G2, NOTES.C2, NOTES.E2, NOTES.G2, NOTES.Bb2];
	let bassIdx = 0;
	for (let t = 0; t < durationSec; t += beat) {
		const freq = bassNotes[bassIdx % bassNotes.length];
		addBassSynth(p, t, freq, beat * 0.8, 0.15);
		bassIdx++;
	}

	// lead melody — simple arpeggiated phrase every 4 bars
	const leadPhrase = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.Bb4, NOTES.G4, NOTES.E4, NOTES.C4, NOTES.D4];
	let leadIdx = 0;
	for (let t = beat * 4; t < durationSec; t += beat) {
		if (leadIdx % 16 < 8) {
			addLeadSynth(p, t, leadPhrase[leadIdx % leadPhrase.length], beat * 0.6, 0.08);
		}
		leadIdx++;
	}
};

const generateDnb: StyleGenerator = (p, bpm, durationSec) => {
	const beat = 60 / bpm;
	const sixteenth = beat / 4;

	for (let t = 0; t < durationSec; t += beat * 4) {
		for (let b = 0; b < 4 && t + b * beat < durationSec; b++) {
			const bt = t + b * beat;
			// DnB classic two-step kick pattern
			if (b === 0) addBassDrum(p, bt, 0.4);
			if (b === 2) addBassDrum(p, bt + sixteenth * 2, 0.35);
			// snare on 2 and 4
			if (b === 1 || b === 3) addSnare(p, bt, 0.25);
			// rapid hi-hats
			for (let s = 0; s < 4; s++) {
				const ht = bt + s * sixteenth;
				if (ht < durationSec) {
					addHihat(p, ht, s % 2 === 0 ? 0.1 : 0.06);
				}
			}
			// open hat for texture on off-beats
			if (b % 2 === 1) addOpenHihat(p, bt + sixteenth * 3, 0.06);
		}
	}

	// rolling bass line
	const bassNotes = [NOTES.C2, NOTES.D2, NOTES.E2, NOTES.G2];
	let bassIdx = 0;
	for (let t = 0; t < durationSec; t += beat * 0.5) {
		addBassSynth(p, t, bassNotes[bassIdx % bassNotes.length], beat * 0.4, 0.16);
		bassIdx++;
	}

	// staccato lead stabs
	const leadNotes = [NOTES.C5, NOTES.Bb4, NOTES.G4, NOTES.E4];
	let li = 0;
	for (let t = beat * 2; t < durationSec; t += beat * 2) {
		addLeadSynth(p, t, leadNotes[li % leadNotes.length], beat * 0.3, 0.07);
		li++;
	}
};

const generateChill: StyleGenerator = (p, bpm, durationSec) => {
	const beat = 60 / bpm;

	for (let t = 0; t < durationSec; t += beat * 4) {
		for (let b = 0; b < 4 && t + b * beat < durationSec; b++) {
			const bt = t + b * beat;
			// soft kick on 1 and 3
			if (b === 0 || b === 2) addBassDrum(p, bt, 0.2);
			// gentle snare / rim on 2 and 4
			if (b === 1 || b === 3) addSnare(p, bt, 0.1);
			// soft hi-hats
			addHihat(p, bt, 0.05);
			addHihat(p, bt + beat / 2, 0.03);
		}
	}

	// warm bass pad
	const chords = [
		[NOTES.C2, NOTES.E2, NOTES.G2],
		[NOTES.A2, NOTES.C3, NOTES.E3],
		[NOTES.F2, NOTES.A2, NOTES.C3],
		[NOTES.G2, NOTES.Bb2, NOTES.D3],
	];
	let ci = 0;
	for (let t = 0; t < durationSec; t += beat * 4) {
		const chord = chords[ci % chords.length];
		for (const note of chord) {
			addBassSynth(p, t, note, beat * 3.5, 0.08);
		}
		ci++;
	}

	// gentle lead melody
	const melody = [NOTES.E4, NOTES.G4, NOTES.A4, NOTES.G4, NOTES.E4, NOTES.D4, NOTES.C4, NOTES.D4];
	let mi = 0;
	for (let t = beat * 2; t < durationSec; t += beat * 2) {
		if (mi % 8 < 6) {
			addLeadSynth(p, t, melody[mi % melody.length], beat * 1.5, 0.05);
		}
		mi++;
	}

	// ambient sine pad for warmth
	for (let t = 0; t < durationSec; t += beat * 8) {
		addSineAt(p, t, NOTES.C4, beat * 7, 0.03);
		addSineAt(p, t, NOTES.G3, beat * 7, 0.02);
	}
};

const STYLE_GENERATORS: Record<MusicStyle, StyleGenerator> = {
	electro: generateElectro,
	dnb: generateDnb,
	chill: generateChill,
};

// Default metronome fallback (for charts with no style)
function generateDefaultBacking(p: SynthParams, bpm: number, durationSec: number) {
	const beat = 60 / bpm;
	const eighth = beat / 2;

	for (let t = 0; t < durationSec; t += beat) {
		addBassDrum(p, t, 0.25);
		addHihat(p, t, 0.08);
		addHihat(p, t + eighth, 0.05);
	}

	// add a simple bass to make it more musical than a raw metronome
	const bassNotes = [NOTES.C2, NOTES.G2, NOTES.A2, NOTES.F2];
	let bi = 0;
	for (let t = 0; t < durationSec; t += beat * 2) {
		addBassSynth(p, t, bassNotes[bi % bassNotes.length], beat * 1.5, 0.1);
		bi++;
	}
}

// ---------------------------------------------------------------------------
// Public API — drop-in replacement for old generateMetronomeTrack
// ---------------------------------------------------------------------------

export function generateBackingTrack(
	ctx: AudioContext,
	bpm: number,
	durationSec: number,
	style?: MusicStyle,
): AudioBuffer {
	const sampleRate = ctx.sampleRate;
	const totalSamples = Math.ceil(durationSec * sampleRate);
	const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
	const data = buffer.getChannelData(0);

	const params: SynthParams = { sampleRate, data };

	if (style && STYLE_GENERATORS[style]) {
		STYLE_GENERATORS[style](params, bpm, durationSec);
	} else {
		generateDefaultBacking(params, bpm, durationSec);
	}

	// soft-clip to prevent distortion
	for (let i = 0; i < totalSamples; i++) {
		data[i] = Math.tanh(data[i]);
	}

	return buffer;
}

/** @deprecated Use generateBackingTrack instead */
export function generateMetronomeTrack(
	ctx: AudioContext,
	bpm: number,
	durationSec: number,
): AudioBuffer {
	return generateBackingTrack(ctx, bpm, durationSec);
}
