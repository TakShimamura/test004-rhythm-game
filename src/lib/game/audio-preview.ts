import type { MusicStyle } from './types.js';
import { generateBackingTrack } from './audio.js';

export type AudioPreview = {
	play(audioUrl: string, bpm?: number, style?: MusicStyle): Promise<void>;
	stop(): void;
	isPlaying(): boolean;
};

export function createAudioPreview(): AudioPreview {
	let ctx: AudioContext | null = null;
	let currentSource: AudioBufferSourceNode | null = null;
	let currentGain: GainNode | null = null;
	let playing = false;

	function getCtx(): AudioContext {
		if (!ctx || ctx.state === 'closed') {
			ctx = new AudioContext();
		}
		if (ctx.state === 'suspended') ctx.resume();
		return ctx;
	}

	function stop() {
		if (currentSource) {
			try {
				if (currentGain) {
					const ac = currentGain.context as AudioContext;
					currentGain.gain.setValueAtTime(currentGain.gain.value, ac.currentTime);
					currentGain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.3);
					const src = currentSource;
					setTimeout(() => {
						try { src.stop(); } catch { /* already stopped */ }
					}, 350);
				} else {
					currentSource.stop();
				}
			} catch { /* already stopped */ }
		}
		currentSource = null;
		currentGain = null;
		playing = false;
	}

	async function play(audioUrl: string, bpm?: number, style?: MusicStyle): Promise<void> {
		// Stop any current preview
		stop();

		const ac = getCtx();
		const gain = ac.createGain();
		gain.connect(ac.destination);
		currentGain = gain;

		let buffer: AudioBuffer;

		if (audioUrl === '__synth__' && bpm) {
			// Generate a synth preview
			buffer = generateBackingTrack(ac, bpm, 10, style);
		} else if (audioUrl === '__metronome__') {
			// Skip metronome-only songs
			return;
		} else {
			// Fetch and decode real audio
			try {
				const response = await fetch(audioUrl);
				const arrayBuffer = await response.arrayBuffer();
				buffer = await ac.decodeAudioData(arrayBuffer);
			} catch {
				return;
			}
		}

		const source = ac.createBufferSource();
		source.buffer = buffer;
		source.connect(gain);
		currentSource = source;

		// Calculate start offset: 25% into the song
		const startOffset = audioUrl === '__synth__' ? 0 : buffer.duration * 0.25;
		const previewDuration = 10;

		// Fade in
		gain.gain.setValueAtTime(0, ac.currentTime);
		gain.gain.linearRampToValueAtTime(0.5, ac.currentTime + 0.3);
		// Fade out near the end
		gain.gain.setValueAtTime(0.5, ac.currentTime + previewDuration - 0.3);
		gain.gain.linearRampToValueAtTime(0, ac.currentTime + previewDuration);

		source.start(0, startOffset, previewDuration);
		playing = true;

		source.onended = () => {
			if (currentSource === source) {
				playing = false;
				currentSource = null;
				currentGain = null;
			}
		};
	}

	return {
		play,
		stop,
		isPlaying() {
			return playing;
		},
	};
}
