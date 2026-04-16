/**
 * Audio mixer with separate volume channels using Web Audio GainNode chain.
 * source -> channel gain -> master gain -> destination
 */

export type MixerChannel = 'music' | 'sfx' | 'ui' | 'master';

export type AudioMixer = {
	musicGain: GainNode;
	sfxGain: GainNode;
	uiGain: GainNode;
	masterGain: GainNode;
	setVolume(channel: MixerChannel, value: number): void;
	getVolume(channel: MixerChannel): number;
};

const CHANNEL_DEFAULTS: Record<MixerChannel, number> = {
	music: 0.7,
	sfx: 0.8,
	ui: 0.5,
	master: 1.0,
};

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

export function createAudioMixer(ctx: AudioContext): AudioMixer {
	const masterGain = ctx.createGain();
	masterGain.gain.value = CHANNEL_DEFAULTS.master;
	masterGain.connect(ctx.destination);

	const musicGain = ctx.createGain();
	musicGain.gain.value = CHANNEL_DEFAULTS.music;
	musicGain.connect(masterGain);

	const sfxGain = ctx.createGain();
	sfxGain.gain.value = CHANNEL_DEFAULTS.sfx;
	sfxGain.connect(masterGain);

	const uiGain = ctx.createGain();
	uiGain.gain.value = CHANNEL_DEFAULTS.ui;
	uiGain.connect(masterGain);

	const gainNodes: Record<MixerChannel, GainNode> = {
		music: musicGain,
		sfx: sfxGain,
		ui: uiGain,
		master: masterGain,
	};

	function setVolume(channel: MixerChannel, value: number): void {
		const clamped = clamp01(value);
		const node = gainNodes[channel];
		node.gain.setValueAtTime(clamped, ctx.currentTime);
	}

	function getVolume(channel: MixerChannel): number {
		return gainNodes[channel].gain.value;
	}

	return {
		musicGain,
		sfxGain,
		uiGain,
		masterGain,
		setVolume,
		getVolume,
	};
}
