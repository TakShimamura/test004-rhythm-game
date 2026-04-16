import type { Instrument, Lane, MusicEvent, MusicStyle } from './types.js';

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

/**
 * Play a musical hit sound that matches the instrument the note represents.
 * Falls back to generic tones when no instrument info is available.
 */
export function playHitSound(
	ctx: AudioContext,
	grade: 'perfect' | 'good',
	instrument?: Instrument,
	freq?: number,
) {
	// If instrument info is available, play a musical hit
	if (instrument) {
		playMusicalHit(ctx, instrument, freq, grade === 'perfect' ? 1.0 : 0.7);
		return;
	}

	// Legacy fallback: generic beep
	const now = ctx.currentTime;
	if (grade === 'perfect') {
		const osc1 = ctx.createOscillator();
		const osc2 = ctx.createOscillator();
		const gain = ctx.createGain();
		osc1.connect(gain);
		osc2.connect(gain);
		gain.connect(ctx.destination);
		osc1.frequency.value = 880;
		osc2.frequency.value = 1320;
		gain.gain.value = 0.12;
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
		osc1.start(now);
		osc2.start(now);
		osc1.stop(now + 0.12);
		osc2.stop(now + 0.12);
	} else {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.frequency.value = 440;
		gain.gain.value = 0.1;
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
		osc.start(now);
		osc.stop(now + 0.08);
	}
}

/**
 * Play a short musical sound that matches the instrument in the backing track.
 * This is what makes hitting notes feel like "playing the music."
 */
export function playMusicalHit(
	ctx: AudioContext,
	instrument: Instrument,
	freq?: number,
	intensity = 1.0,
) {
	const now = ctx.currentTime;
	const vol = 0.15 * intensity;

	switch (instrument) {
		case 'kick': {
			// Punchy low sine burst — same character as the backing kick
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.frequency.setValueAtTime(150, now);
			osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
			gain.gain.setValueAtTime(vol * 2.5, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
			osc.start(now);
			osc.stop(now + 0.15);
			break;
		}
		case 'snare': {
			// Noise burst + tonal body — snare character
			const bufferSize = Math.ceil(ctx.sampleRate * 0.1);
			const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
			const data = noiseBuffer.getChannelData(0);
			for (let i = 0; i < bufferSize; i++) {
				const t = i / ctx.sampleRate;
				const env = Math.exp(-t * 25);
				data[i] = (Math.random() * 2 - 1) * env;
			}
			const noiseSource = ctx.createBufferSource();
			noiseSource.buffer = noiseBuffer;
			const gain = ctx.createGain();
			noiseSource.connect(gain);
			gain.connect(ctx.destination);
			gain.gain.value = vol * 1.5;
			noiseSource.start(now);
			noiseSource.stop(now + 0.1);
			// Tonal body
			const osc = ctx.createOscillator();
			const oscGain = ctx.createGain();
			osc.connect(oscGain);
			oscGain.connect(ctx.destination);
			osc.frequency.value = 200;
			oscGain.gain.setValueAtTime(vol * 0.8, now);
			oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
			osc.start(now);
			osc.stop(now + 0.08);
			break;
		}
		case 'hihat': {
			// Tiny metallic click
			const bufferSize = Math.ceil(ctx.sampleRate * 0.04);
			const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
			const data = noiseBuffer.getChannelData(0);
			for (let i = 0; i < bufferSize; i++) {
				const t = i / ctx.sampleRate;
				const env = Math.exp(-t * 80);
				data[i] = (Math.random() * 2 - 1) * env;
			}
			const src = ctx.createBufferSource();
			src.buffer = noiseBuffer;
			// Highpass to make it tinny
			const hp = ctx.createBiquadFilter();
			hp.type = 'highpass';
			hp.frequency.value = 7000;
			const gain = ctx.createGain();
			src.connect(hp);
			hp.connect(gain);
			gain.connect(ctx.destination);
			gain.gain.value = vol;
			src.start(now);
			src.stop(now + 0.04);
			break;
		}
		case 'bass': {
			// Short bass synth note at the correct frequency
			const f = freq ?? 65;
			const osc = ctx.createOscillator();
			const osc2 = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.connect(gain);
			osc2.connect(gain);
			gain.connect(ctx.destination);
			osc.frequency.value = f;
			osc2.frequency.value = f * 2; // octave overtone
			osc.type = 'sawtooth';
			gain.gain.setValueAtTime(vol * 1.5, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
			osc.start(now);
			osc2.start(now);
			osc.stop(now + 0.2);
			osc2.stop(now + 0.2);
			break;
		}
		case 'lead': {
			// Quick synth stab at the correct pitch
			const f = freq ?? 440;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.type = 'square';
			osc.frequency.value = f;
			// Add slight vibrato for character
			const lfo = ctx.createOscillator();
			const lfoGain = ctx.createGain();
			lfo.connect(lfoGain);
			lfoGain.connect(osc.frequency);
			lfo.frequency.value = 5;
			lfoGain.gain.value = 3;
			lfo.start(now);
			lfo.stop(now + 0.15);
			gain.gain.setValueAtTime(vol, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
			osc.start(now);
			osc.stop(now + 0.15);
			break;
		}
		case 'arp': {
			// Quick bright stab
			const f = freq ?? 523;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.type = 'sawtooth';
			osc.frequency.value = f;
			gain.gain.setValueAtTime(vol * 0.8, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
			osc.start(now);
			osc.stop(now + 0.1);
			break;
		}
		case 'pad': {
			// Soft sustained chord stab
			const f = freq ?? 261;
			const osc1 = ctx.createOscillator();
			const osc2 = ctx.createOscillator();
			const gain = ctx.createGain();
			osc1.connect(gain);
			osc2.connect(gain);
			gain.connect(ctx.destination);
			osc1.frequency.value = f;
			osc2.frequency.value = f * 1.003; // slight detune
			gain.gain.setValueAtTime(0.001, now);
			gain.gain.linearRampToValueAtTime(vol * 0.5, now + 0.05);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
			osc1.start(now);
			osc2.start(now);
			osc1.stop(now + 0.3);
			osc2.stop(now + 0.3);
			break;
		}
	}
}

export function playMissSound(_ctx: AudioContext) {
	// On miss, play nothing — the absence of the instrument IS the feedback.
	// The backing track keeps playing but the player hears the "hole" they left.
}

// ---------------------------------------------------------------------------
// Audio ducking: briefly reduce a frequency band on miss
// ---------------------------------------------------------------------------

export type DuckingController = {
	/** Call when a note on the given lane is missed */
	duckLane: (lane: Lane) => void;
	/** Connect audio source to this node (input of the ducking chain) */
	input: AudioNode;
	/** Connect this node to destination/analyser (output of the ducking chain) */
	output: AudioNode;
	/** Clean up */
	destroy: () => void;
};

export function createDuckingController(ctx: AudioContext): DuckingController {
	const lowFilter = ctx.createBiquadFilter();
	lowFilter.type = 'lowshelf';
	lowFilter.frequency.value = 200;
	lowFilter.gain.value = 0;

	const midFilter = ctx.createBiquadFilter();
	midFilter.type = 'peaking';
	midFilter.frequency.value = 1000;
	midFilter.Q.value = 1;
	midFilter.gain.value = 0;

	const highFilter = ctx.createBiquadFilter();
	highFilter.type = 'highshelf';
	highFilter.frequency.value = 3000;
	highFilter.gain.value = 0;

	// Chain: lowFilter -> midFilter -> highFilter
	lowFilter.connect(midFilter);
	midFilter.connect(highFilter);

	function duckLane(lane: Lane) {
		const now = ctx.currentTime;
		const duckAmount = -12; // dB
		const duckDuration = 0.2;

		let filter: BiquadFilterNode;
		if (lane === 0) filter = lowFilter;
		else if (lane === 1) filter = midFilter;
		else filter = highFilter;

		filter.gain.cancelScheduledValues(now);
		filter.gain.setValueAtTime(duckAmount, now);
		filter.gain.linearRampToValueAtTime(0, now + duckDuration);
	}

	return {
		duckLane,
		input: lowFilter,
		output: highFilter,
		destroy() {
			lowFilter.disconnect();
			midFilter.disconnect();
			highFilter.disconnect();
		},
	};
}

export function playComboMilestone(ctx: AudioContext, combo: number) {
	// Rising chime: 3 quick ascending tones
	const now = ctx.currentTime;
	const baseFreq = combo >= 100 ? 660 : combo >= 50 ? 550 : 440;
	const intervals = [0, 0.06, 0.12];
	const freqs = [baseFreq, baseFreq * 1.25, baseFreq * 1.5]; // major intervals

	for (let i = 0; i < 3; i++) {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.frequency.value = freqs[i];
		gain.gain.setValueAtTime(0.001, now + intervals[i]);
		gain.gain.exponentialRampToValueAtTime(0.12, now + intervals[i] + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.001, now + intervals[i] + 0.15);
		osc.start(now + intervals[i]);
		osc.stop(now + intervals[i] + 0.15);
	}
}

export function playFullComboSound(ctx: AudioContext) {
	// Triumphant major triad held for 0.5s
	const now = ctx.currentTime;
	const triad = [523.25, 659.25, 783.99]; // C5, E5, G5

	for (const freq of triad) {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.frequency.value = freq;
		gain.gain.setValueAtTime(0.001, now);
		gain.gain.exponentialRampToValueAtTime(0.1, now + 0.05);
		gain.gain.setValueAtTime(0.1, now + 0.35);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
		osc.start(now);
		osc.stop(now + 0.5);
	}
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

/** Pad synth: slow-attack sustained chord built from multiple detuned sines. */
function addPadSynth(p: SynthParams, time: number, freqs: number[], dur: number, vol = 0.06) {
	const start = Math.floor(time * p.sampleRate);
	const len = Math.ceil(dur * p.sampleRate);
	for (let i = 0; i < len && start + i < p.data.length; i++) {
		const t = i / p.sampleRate;
		// slow attack (0.3s), sustain, slow release (0.5s)
		const attack = Math.min(t / 0.3, 1);
		const release = t > dur - 0.5 ? (dur - t) / 0.5 : 1;
		const env = attack * Math.max(release, 0);
		let wave = 0;
		for (const freq of freqs) {
			// slightly detune each voice for richness
			wave += Math.sin(2 * Math.PI * freq * t);
			wave += Math.sin(2 * Math.PI * (freq * 1.003) * t) * 0.7;
			wave += Math.sin(2 * Math.PI * (freq * 0.997) * t) * 0.7;
		}
		p.data[start + i] += wave * env * vol / Math.max(freqs.length * 2.4, 1);
	}
}

/** Arp synth: fast repeating arpeggiated notes (classic trance arp). */
function addArpSynth(
	p: SynthParams,
	time: number,
	freqs: number[],
	dur: number,
	rate: number,
	vol = 0.08,
) {
	const start = Math.floor(time * p.sampleRate);
	const len = Math.ceil(dur * p.sampleRate);
	const noteLen = 1 / rate; // seconds per arp step
	for (let i = 0; i < len && start + i < p.data.length; i++) {
		const t = i / p.sampleRate;
		const stepIdx = Math.floor(t / noteLen);
		const freq = freqs[stepIdx % freqs.length];
		const localT = t - stepIdx * noteLen;
		// sharp attack, quick decay per step
		const env = Math.exp(-localT * 12) * 0.8 + 0.2 * Math.max(1 - localT / noteLen, 0);
		// thin sawtooth
		const phase = (freq * t) % 1;
		const wave = (phase * 2 - 1) * 0.6 + Math.sin(2 * Math.PI * freq * t) * 0.4;
		// global envelope
		const globalAttack = Math.min(t / 0.05, 1);
		const globalRelease = t > dur - 0.1 ? (dur - t) / 0.1 : 1;
		p.data[start + i] += wave * env * globalAttack * Math.max(globalRelease, 0) * vol;
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

// ---------------------------------------------------------------------------
// Music schedule generators — build MusicEvent[] describing every instrument hit
// ---------------------------------------------------------------------------

type ScheduleGenerator = (bpm: number, durationSec: number) => MusicEvent[];

const generateElectroSchedule: ScheduleGenerator = (bpm, durationSec) => {
	const events: MusicEvent[] = [];
	const beat = 60 / bpm;
	const eighth = beat / 2;
	const sixteenth = beat / 4;
	let barCount = 0;

	for (let t = 0; t < durationSec; t += beat * 4) {
		const isFillBar = (barCount + 1) % 8 === 0;
		for (let b = 0; b < 4 && t + b * beat < durationSec; b++) {
			const bt = t + b * beat;
			events.push({ t: bt, instrument: 'kick', volume: 0.35 });
			if (b === 1 || b === 3) events.push({ t: bt, instrument: 'snare', volume: 0.2 });
			events.push({ t: bt, instrument: 'hihat', volume: 0.1 });
			events.push({ t: bt + eighth, instrument: 'hihat', volume: 0.07 });

			if (isFillBar && b >= 2) {
				for (let s = 0; s < 4; s++) {
					events.push({ t: bt + s * sixteenth, instrument: 'snare', volume: 0.12 + s * 0.03 });
				}
			}
		}
		barCount++;
	}

	const bassNotes = [NOTES.C2, NOTES.C2, NOTES.Bb2, NOTES.G2, NOTES.C2, NOTES.E2, NOTES.G2, NOTES.Bb2];
	let bassIdx = 0;
	for (let t = 0; t < durationSec; t += beat) {
		const freq = bassNotes[bassIdx % bassNotes.length];
		events.push({ t, instrument: 'bass', freq, duration: beat * 0.8, volume: 0.15 });
		bassIdx++;
	}

	const leadPhrase = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.Bb4, NOTES.G4, NOTES.E4, NOTES.C4, NOTES.D4];
	let leadIdx = 0;
	for (let t = beat * 4; t < durationSec; t += beat) {
		if (leadIdx % 16 < 8) {
			events.push({ t, instrument: 'lead', freq: leadPhrase[leadIdx % leadPhrase.length], duration: beat * 0.6, volume: 0.08 });
		}
		leadIdx++;
	}

	const arpNotes = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5, NOTES.G4, NOTES.E4];
	for (let t = beat * 8; t < durationSec; t += beat * 16) {
		events.push({ t, instrument: 'arp', freq: arpNotes[0], duration: beat * 8, volume: 0.06 });
	}

	return events;
};

const generateDnbSchedule: ScheduleGenerator = (bpm, durationSec) => {
	const events: MusicEvent[] = [];
	const beat = 60 / bpm;
	const sixteenth = beat / 4;
	let barCount = 0;

	for (let t = 0; t < durationSec; t += beat * 4) {
		const isBreakbar = barCount % 4 >= 2;
		for (let b = 0; b < 4 && t + b * beat < durationSec; b++) {
			const bt = t + b * beat;
			if (isBreakbar) {
				if (b === 0) events.push({ t: bt, instrument: 'kick', volume: 0.4 });
				if (b === 1) events.push({ t: bt + sixteenth * 3, instrument: 'kick', volume: 0.3 });
				if (b === 3) events.push({ t: bt + sixteenth, instrument: 'kick', volume: 0.35 });
				if (b === 1 || b === 3) events.push({ t: bt, instrument: 'snare', volume: 0.25 });
				if (b === 2) events.push({ t: bt + sixteenth * 2, instrument: 'snare', volume: 0.2 });
			} else {
				if (b === 0) events.push({ t: bt, instrument: 'kick', volume: 0.4 });
				if (b === 2) events.push({ t: bt + sixteenth * 2, instrument: 'kick', volume: 0.35 });
				if (b === 1 || b === 3) events.push({ t: bt, instrument: 'snare', volume: 0.25 });
			}
			for (let s = 0; s < 4; s++) {
				const ht = bt + s * sixteenth;
				if (ht < durationSec) {
					events.push({ t: ht, instrument: 'hihat', volume: s % 2 === 0 ? 0.1 : 0.06 });
				}
			}
		}
		barCount++;
	}

	const bassNotes = [NOTES.C2, NOTES.D2, NOTES.E2, NOTES.G2, NOTES.F2, NOTES.D2];
	let bassIdx = 0;
	for (let t = 0; t < durationSec; t += beat * 0.5) {
		const freq = bassNotes[bassIdx % bassNotes.length];
		events.push({ t, instrument: 'bass', freq, duration: beat * 0.4, volume: 0.2 });
		bassIdx++;
	}

	const leadNotes = [NOTES.C5, NOTES.Bb4, NOTES.G4, NOTES.E4];
	let li = 0;
	for (let t = beat * 2; t < durationSec; t += beat * 2) {
		events.push({ t, instrument: 'lead', freq: leadNotes[li % leadNotes.length], duration: beat * 0.3, volume: 0.07 });
		li++;
	}

	return events;
};

const generateChillSchedule: ScheduleGenerator = (bpm, durationSec) => {
	const events: MusicEvent[] = [];
	const beat = 60 / bpm;

	for (let t = 0; t < durationSec; t += beat * 4) {
		for (let b = 0; b < 4 && t + b * beat < durationSec; b++) {
			const bt = t + b * beat;
			if (b === 0 || b === 2) events.push({ t: bt, instrument: 'kick', volume: 0.2 });
			if (b === 1 || b === 3) events.push({ t: bt, instrument: 'snare', volume: 0.1 });
			events.push({ t: bt, instrument: 'hihat', volume: 0.05 });
			events.push({ t: bt + beat / 2, instrument: 'hihat', volume: 0.03 });
		}
	}

	const padChords = [
		[NOTES.C3, NOTES.E3, NOTES.G3],
		[NOTES.A2, NOTES.C3, NOTES.E3],
		[NOTES.F2, NOTES.A2, NOTES.C3],
		[NOTES.G2, NOTES.Bb2, NOTES.D3],
	];
	let pi = 0;
	for (let t = 0; t < durationSec; t += beat * 8) {
		events.push({ t, instrument: 'pad', freq: padChords[pi % padChords.length][0], duration: beat * 7.5, volume: 0.05 });
		pi++;
	}

	const bassLine = [
		NOTES.C2, NOTES.E2, NOTES.G2, NOTES.E2,
		NOTES.A2, NOTES.C3, NOTES.A2, NOTES.G2,
		NOTES.F2, NOTES.A2, NOTES.C3, NOTES.A2,
		NOTES.G2, NOTES.Bb2, NOTES.D3, NOTES.Bb2,
	];
	let bi = 0;
	for (let t = 0; t < durationSec; t += beat) {
		events.push({ t, instrument: 'bass', freq: bassLine[bi % bassLine.length], duration: beat * 0.9, volume: 0.1 });
		bi++;
	}

	const melody = [NOTES.E4, NOTES.G4, NOTES.A4, NOTES.G4, NOTES.E4, NOTES.D4, NOTES.C4, NOTES.D4];
	let mi = 0;
	for (let t = beat * 2; t < durationSec; t += beat * 2) {
		if (mi % 8 < 6) {
			events.push({ t, instrument: 'lead', freq: melody[mi % melody.length], duration: beat * 1.5, volume: 0.05 });
		}
		mi++;
	}

	return events;
};

const generateDefaultSchedule: ScheduleGenerator = (bpm, durationSec) => {
	const events: MusicEvent[] = [];
	const beat = 60 / bpm;
	const eighth = beat / 2;

	for (let t = 0; t < durationSec; t += beat) {
		events.push({ t, instrument: 'kick', volume: 0.25 });
		events.push({ t, instrument: 'hihat', volume: 0.08 });
		events.push({ t: t + eighth, instrument: 'hihat', volume: 0.05 });
	}

	const bassNotes = [NOTES.C2, NOTES.G2, NOTES.A2, NOTES.F2];
	let bi = 0;
	for (let t = 0; t < durationSec; t += beat * 2) {
		events.push({ t, instrument: 'bass', freq: bassNotes[bi % bassNotes.length], duration: beat * 1.5, volume: 0.1 });
		bi++;
	}

	return events;
};

const SCHEDULE_GENERATORS: Record<MusicStyle, ScheduleGenerator> = {
	electro: generateElectroSchedule,
	dnb: generateDnbSchedule,
	chill: generateChillSchedule,
};

/**
 * Generate a schedule of all music events for a given style.
 * This is the single source of truth that both the audio renderer and the
 * chart generator consume.
 */
export function generateMusicSchedule(
	bpm: number,
	durationSec: number,
	style?: MusicStyle,
): MusicEvent[] {
	const gen = style ? SCHEDULE_GENERATORS[style] : undefined;
	const events = gen ? gen(bpm, durationSec) : generateDefaultSchedule(bpm, durationSec);
	// Sort by time for deterministic processing
	return events.sort((a, b) => a.t - b.t);
}

// ---------------------------------------------------------------------------
// Render a MusicEvent[] schedule to an AudioBuffer
// ---------------------------------------------------------------------------

function renderScheduleToBuffer(p: SynthParams, schedule: MusicEvent[], bpm: number, style?: MusicStyle) {
	const beat = 60 / bpm;

	for (const ev of schedule) {
		switch (ev.instrument) {
			case 'kick':
				addBassDrum(p, ev.t, ev.volume ?? 0.35);
				break;
			case 'snare':
				addSnare(p, ev.t, ev.volume ?? 0.2);
				break;
			case 'hihat':
				addHihat(p, ev.t, ev.volume ?? 0.1);
				break;
			case 'bass':
				addBassSynth(p, ev.t, ev.freq ?? NOTES.C2, ev.duration ?? beat * 0.8, ev.volume ?? 0.15);
				// DnB sub-bass layer
				if (style === 'dnb' && ev.freq) {
					addSineAt(p, ev.t, ev.freq * 0.5, (ev.duration ?? beat * 0.4) * 0.875, 0.08);
				}
				break;
			case 'lead':
				addLeadSynth(p, ev.t, ev.freq ?? NOTES.C4, ev.duration ?? beat * 0.6, ev.volume ?? 0.08);
				break;
			case 'arp': {
				// For arp events, reconstruct the arpeggio pattern
				const arpNotes = style === 'electro'
					? [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5, NOTES.G4, NOTES.E4]
					: [ev.freq ?? NOTES.C4];
				addArpSynth(p, ev.t, arpNotes, ev.duration ?? beat * 8, bpm / 15, ev.volume ?? 0.06);
				break;
			}
			case 'pad': {
				// Reconstruct pad chords from the chill style
				const padChords = [
					[NOTES.C3, NOTES.E3, NOTES.G3],
					[NOTES.A2, NOTES.C3, NOTES.E3],
					[NOTES.F2, NOTES.A2, NOTES.C3],
					[NOTES.G2, NOTES.Bb2, NOTES.D3],
				];
				// Find closest chord root
				const freq = ev.freq ?? NOTES.C3;
				const chord = padChords.find(c => Math.abs(c[0] - freq) < 1) ?? padChords[0];
				addPadSynth(p, ev.t, chord, ev.duration ?? beat * 7.5, ev.volume ?? 0.05);
				// Add ambient sine layers for chill
				if (style === 'chill') {
					addSineAt(p, ev.t, NOTES.C4, (ev.duration ?? beat * 7) * 0.93, 0.03);
					addSineAt(p, ev.t, NOTES.G3, (ev.duration ?? beat * 7) * 0.93, 0.02);
				}
				break;
			}
		}
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

	// Use schedule-based rendering for consistent audio
	const schedule = generateMusicSchedule(bpm, durationSec, style);
	renderScheduleToBuffer(params, schedule, bpm, style);

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
