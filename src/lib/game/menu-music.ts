export type MenuMusic = {
	start(): void;
	stop(): void;
	fadeOut(durationSec?: number): void;
	fadeOutAndStop(durationSec?: number): Promise<void>;
};

/**
 * Creates ambient background music for the main menu.
 * Soft pad chords cycling Am - F - C - G at very low volume.
 */
export function createMenuMusic(): MenuMusic {
	let ctx: AudioContext | null = null;
	let masterGain: GainNode | null = null;
	let oscillators: OscillatorNode[] = [];
	let running = false;
	let stopTimeout: ReturnType<typeof setTimeout> | null = null;

	// Chord progression: Am - F - C - G (frequencies for pad voices)
	const CHORDS = [
		[220.00, 261.63, 329.63],  // Am: A3, C4, E4
		[174.61, 220.00, 261.63],  // F:  F3, A3, C4
		[130.81, 164.81, 196.00],  // C:  C3, E3, G3
		[196.00, 246.94, 293.66],  // G:  G3, B3, D4
	];

	const CHORD_DURATION = 4; // seconds per chord
	const VOLUME = 0.05;

	function start() {
		if (running) return;

		ctx = new AudioContext();
		if (ctx.state === 'suspended') ctx.resume();

		masterGain = ctx.createGain();
		masterGain.connect(ctx.destination);

		// Fade in over 2 seconds
		masterGain.gain.setValueAtTime(0, ctx.currentTime);
		masterGain.gain.linearRampToValueAtTime(VOLUME, ctx.currentTime + 2);

		// Schedule chord progression looping
		const totalCycleDuration = CHORDS.length * CHORD_DURATION;
		const lookahead = 120; // schedule 2 minutes of chords

		for (let t = 0; t < lookahead; t += CHORD_DURATION) {
			const chordIdx = Math.floor(t / CHORD_DURATION) % CHORDS.length;
			const chord = CHORDS[chordIdx];
			const startTime = ctx.currentTime + t;

			for (const freq of chord) {
				// Main voice
				const osc = ctx.createOscillator();
				osc.type = 'sine';
				osc.frequency.value = freq;

				const voiceGain = ctx.createGain();
				voiceGain.connect(masterGain);

				// Slow attack (0.5s), sustain, slow release (0.5s)
				voiceGain.gain.setValueAtTime(0, startTime);
				voiceGain.gain.linearRampToValueAtTime(0.3, startTime + 0.5);
				voiceGain.gain.setValueAtTime(0.3, startTime + CHORD_DURATION - 0.5);
				voiceGain.gain.linearRampToValueAtTime(0, startTime + CHORD_DURATION);

				osc.connect(voiceGain);
				osc.start(startTime);
				osc.stop(startTime + CHORD_DURATION + 0.1);
				oscillators.push(osc);

				// Detuned voice for richness
				const osc2 = ctx.createOscillator();
				osc2.type = 'sine';
				osc2.frequency.value = freq * 1.003;

				const voiceGain2 = ctx.createGain();
				voiceGain2.connect(masterGain);
				voiceGain2.gain.setValueAtTime(0, startTime);
				voiceGain2.gain.linearRampToValueAtTime(0.15, startTime + 0.5);
				voiceGain2.gain.setValueAtTime(0.15, startTime + CHORD_DURATION - 0.5);
				voiceGain2.gain.linearRampToValueAtTime(0, startTime + CHORD_DURATION);

				osc2.connect(voiceGain2);
				osc2.start(startTime);
				osc2.stop(startTime + CHORD_DURATION + 0.1);
				oscillators.push(osc2);
			}
		}

		running = true;
	}

	function stop() {
		if (!running || !ctx) return;
		if (stopTimeout) {
			clearTimeout(stopTimeout);
			stopTimeout = null;
		}

		for (const osc of oscillators) {
			try { osc.stop(); } catch { /* already stopped */ }
		}
		oscillators = [];

		try { ctx.close(); } catch { /* already closed */ }
		ctx = null;
		masterGain = null;
		running = false;
	}

	function fadeOut(durationSec = 1) {
		if (!running || !ctx || !masterGain) return;
		masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
		masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationSec);
	}

	async function fadeOutAndStop(durationSec = 1): Promise<void> {
		if (!running) return;
		fadeOut(durationSec);
		return new Promise((resolve) => {
			stopTimeout = setTimeout(() => {
				stop();
				resolve();
			}, durationSec * 1000 + 50);
		});
	}

	return { start, stop, fadeOut, fadeOutAndStop };
}
