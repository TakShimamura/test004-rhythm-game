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

export function generateMetronomeTrack(ctx: AudioContext, bpm: number, durationSec: number): AudioBuffer {
	const sampleRate = ctx.sampleRate;
	const totalSamples = Math.ceil(durationSec * sampleRate);
	const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
	const data = buffer.getChannelData(0);

	const beatInterval = 60 / bpm;
	const clickDuration = 0.02;
	const clickSamples = Math.ceil(clickDuration * sampleRate);

	for (let beatTime = 0; beatTime < durationSec; beatTime += beatInterval) {
		const startSample = Math.floor(beatTime * sampleRate);
		for (let i = 0; i < clickSamples && startSample + i < totalSamples; i++) {
			const t = i / sampleRate;
			const envelope = 1 - t / clickDuration;
			data[startSample + i] = Math.sin(2 * Math.PI * 1000 * t) * envelope * 0.3;
		}
	}

	return buffer;
}
