import type { Chart, GameConfig, Lane, MusicStyle, NoteSkin, ScoreState, JudgmentGrade, HighwayTheme, HitEffect, ComboColor } from './types.js';

const LANE_COLORS_DEFAULT = ['#ff4466', '#44ff66', '#4488ff'] as const;
const LANE_GLOW_COLORS_DEFAULT = ['rgba(255,68,102,', 'rgba(68,255,102,', 'rgba(68,136,255,'] as const;
const LANE_RGB_DEFAULT = ['255,68,102', '68,255,102', '68,136,255'] as const;

// Colorblind-safe palette
const LANE_COLORS_CB = ['#0077BB', '#EE7733', '#009988'] as const;
const LANE_GLOW_COLORS_CB = ['rgba(0,119,187,', 'rgba(238,119,51,', 'rgba(0,153,136,'] as const;
const LANE_RGB_CB = ['0,119,187', '238,119,51', '0,153,136'] as const;

// ----- Style theme palettes -----
type ThemePalette = { bg1: string; bg2: string; bg3: string; accent: string; gridColor: string; hue: number };
const STYLE_THEMES: Record<MusicStyle, ThemePalette> = {
	electro: { bg1: '#050518', bg2: '#0a0a2a', bg3: '#0a0530', accent: '#6644ff', gridColor: '100,68,255', hue: 260 },
	dnb:     { bg1: '#180505', bg2: '#2a0a0a', bg3: '#300a05', accent: '#ff6644', gridColor: '255,100,68', hue: 15 },
	chill:   { bg1: '#051510', bg2: '#0a2a1a', bg3: '#053020', accent: '#44ff88', gridColor: '68,255,136', hue: 150 },
};
const DEFAULT_THEME: ThemePalette = STYLE_THEMES.electro;

type Particle = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
	color: string;
	size: number;
	trail?: boolean;
};

type Star = {
	x: number;
	y: number;
	speed: number;
	size: number;
	brightness: number;
	layer: number; // 0=far, 1=mid, 2=near
};

type ShootingStar = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
	length: number;
};

type LaneFlash = {
	lane: Lane;
	time: number;
	intensity: number;
};

export type RendererOptions = {
	canvas: HTMLCanvasElement;
	chart: Chart;
	config: GameConfig;
};

export type JudgmentFlash = {
	grade: JudgmentGrade;
	lane: Lane;
	time: number;
};

export type Renderer = {
	resize: () => void;
	draw: (
		currentTime: number,
		score: ScoreState,
		lanePressed: (lane: Lane) => boolean,
		hitNotes: Set<number>,
		flashes: JudgmentFlash[],
	) => void;
	spawnParticles: (lane: Lane, grade: JudgmentGrade) => void;
	/** Burst particles along a hold note bar when released/completed. */
	spawnHoldBurstParticles: (lane: Lane, yStart: number, yEnd: number) => void;
	/** Trigger screen shake on miss */
	triggerShake: () => void;
	/** Trigger full combo celebration */
	triggerFullCombo: () => void;
	/** Connect an AnalyserNode for FFT-based audio visualization */
	setAnalyser: (analyser: AnalyserNode) => void;
};

export function createRenderer({ canvas, chart, config }: RendererOptions): Renderer {
	const ctx = canvas.getContext('2d')!;
	let w = 0;
	let h = 0;
	let laneWidth = 0;
	const particles: Particle[] = [];
	const stars: Star[] = [];
	const shootingStars: ShootingStar[] = [];
	const laneFlashes: LaneFlash[] = [];
	let lastDrawTime = performance.now() / 1000;
	let lastShootingStarTime = 0;

	// Screen shake state
	let shakeIntensity = 0;
	let shakeStartTime = 0;
	const SHAKE_DURATION = 0.2; // 200ms
	const SHAKE_MIN = 4;
	const SHAKE_MAX = 8;

	// Full combo celebration state
	let fullComboActive = false;
	let fullComboStartTime = 0;
	const FULL_COMBO_FLASH_DURATION = 0.4;

	const noteSkin: NoteSkin = config.noteSkin ?? 'classic';
	const highwayTheme: HighwayTheme = config.highwayTheme ?? 'default';
	const hitEffect: HitEffect = config.hitEffect ?? 'sparkle';
	const comboColorMode: ComboColor = config.comboColor ?? 'default';
	const colorblindMode: boolean = config.colorblindMode ?? false;
	const noteScale: number = config.noteScale ?? 1.0;

	// Choose palette based on colorblind mode
	const LANE_COLORS: readonly string[] = colorblindMode ? LANE_COLORS_CB : LANE_COLORS_DEFAULT;
	const LANE_GLOW_COLORS: readonly string[] = colorblindMode ? LANE_GLOW_COLORS_CB : LANE_GLOW_COLORS_DEFAULT;
	const LANE_RGB: readonly string[] = colorblindMode ? LANE_RGB_CB : LANE_RGB_DEFAULT;

	const beatDuration = 60 / chart.bpm;
	const theme = chart.style ? STYLE_THEMES[chart.style] : DEFAULT_THEME;

	// ----- Audio visualizer state -----
	let analyserNode: AnalyserNode | null = null;
	let frequencyData: Uint8Array<ArrayBuffer> | null = null;
	const VISUALIZER_BAR_COUNT = 32;

	function setAnalyser(analyser: AnalyserNode) {
		analyserNode = analyser;
		frequencyData = new Uint8Array(analyser.frequencyBinCount);
	}

	function drawVisualizerBars(beatPulse: number) {
		if (!analyserNode || !frequencyData) return;
		analyserNode.getByteFrequencyData(frequencyData);

		const hitZoneY = h * HIT_ZONE_Y_RATIO;
		const { left, lw } = getHighwayXAtY(hitZoneY);
		const highwayWidth = lw * 3;
		const barWidth = highwayWidth / VISUALIZER_BAR_COUNT;
		const maxBarHeight = h * 0.25;
		// Subtle beat pulse multiplier
		const pulseScale = 1 + beatPulse * 0.15;

		// Map frequency bins to our bar count
		const binStep = Math.floor(frequencyData.length / VISUALIZER_BAR_COUNT);

		ctx.save();
		for (let i = 0; i < VISUALIZER_BAR_COUNT; i++) {
			// Average a few bins per bar for smoother look
			let sum = 0;
			for (let b = 0; b < binStep; b++) {
				sum += frequencyData[i * binStep + b];
			}
			const amplitude = (sum / binStep) / 255;
			const barHeight = amplitude * maxBarHeight * pulseScale;

			if (barHeight < 1) continue;

			const x = left + i * barWidth;
			const y = hitZoneY - barHeight;

			// Pick lane color based on position (spread across 3 lanes)
			const laneIdx = Math.min(2, Math.floor((i / VISUALIZER_BAR_COUNT) * 3));
			const alpha = 0.15 + amplitude * 0.15; // 0.15 to 0.3 range

			ctx.fillStyle = `rgba(${LANE_RGB[laneIdx]}, ${alpha})`;
			ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
		}
		ctx.restore();
	}

	// ----- Highway theme ambient particle state -----
	type AmbientParticle = { x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number; hue: number; type: string };
	const ambientParticles: AmbientParticle[] = [];

	const HIT_ZONE_Y_RATIO = 0.85;

	// ----- Perspective highway helpers -----
	const HIGHWAY_TOP_SCALE = 0.55; // highway is 55% as wide at top vs bottom
	function getHighwayXAtY(y: number): { left: number; right: number; lw: number } {
		const hitZoneY = h * HIT_ZONE_Y_RATIO;
		// t=0 at hit zone (full width), t=1 at top of screen (narrow)
		const t = Math.max(0, Math.min(1, (hitZoneY - y) / hitZoneY));
		const scale = 1 - t * (1 - HIGHWAY_TOP_SCALE);
		const totalW = laneWidth * 3 * scale;
		const center = w / 2;
		return { left: center - totalW / 2, right: center + totalW / 2, lw: totalW / 3 };
	}

	// ----- Stars -----
	function initStars() {
		stars.length = 0;
		const layerSpeeds = [15, 35, 70]; // far, mid, near
		const layerSizes = [0.5, 1.0, 1.8];
		const layerCounts = [60, 40, 20];
		for (let layer = 0; layer < 3; layer++) {
			for (let i = 0; i < layerCounts[layer]; i++) {
				stars.push({
					x: Math.random() * (w || 1920),
					y: Math.random() * (h || 1080),
					speed: layerSpeeds[layer] + Math.random() * layerSpeeds[layer] * 0.5,
					size: layerSizes[layer] + Math.random() * layerSizes[layer] * 0.4,
					brightness: 0.15 + layer * 0.15 + Math.random() * 0.3,
					layer,
				});
			}
		}
	}

	// ----- Particle spawning -----
	function spawnParticlesSparkle(cx: number, hitZoneY: number, lane: Lane, grade: JudgmentGrade) {
		const count = grade === 'perfect' ? 24 : 12;
		const color = LANE_COLORS[lane];
		for (let i = 0; i < count; i++) {
			const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
			const speed = 100 + Math.random() * 250;
			particles.push({
				x: cx, y: hitZoneY,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 60,
				life: 0.5 + Math.random() * 0.4,
				maxLife: 0.5 + Math.random() * 0.4,
				color, size: 2 + Math.random() * 4,
				trail: grade === 'perfect',
			});
		}
	}

	function spawnParticlesSplash(cx: number, hitZoneY: number, lane: Lane, grade: JudgmentGrade) {
		const count = grade === 'perfect' ? 20 : 10;
		for (let i = 0; i < count; i++) {
			// Arc pattern spreading upward like a wave
			const angle = -Math.PI * (0.15 + 0.7 * (i / count));
			const speed = 80 + Math.random() * 200;
			const hue = 190 + Math.random() * 40; // blue-ish
			particles.push({
				x: cx + (Math.random() - 0.5) * 20,
				y: hitZoneY,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: 0.6 + Math.random() * 0.3,
				maxLife: 0.6 + Math.random() * 0.3,
				color: `hsl(${hue}, 80%, ${55 + Math.random() * 20}%)`,
				size: 2.5 + Math.random() * 3,
				trail: false,
			});
		}
	}

	function spawnParticlesLightning(cx: number, hitZoneY: number, _lane: Lane, grade: JudgmentGrade) {
		const count = grade === 'perfect' ? 16 : 8;
		for (let i = 0; i < count; i++) {
			const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
			const speed = 200 + Math.random() * 400; // fast
			const lightness = 70 + Math.random() * 30;
			particles.push({
				x: cx, y: hitZoneY,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: 0.15 + Math.random() * 0.15, // fast decay
				maxLife: 0.15 + Math.random() * 0.15,
				color: `hsl(${50 + Math.random() * 10}, 100%, ${lightness}%)`, // white/yellow
				size: 1.5 + Math.random() * 2,
				trail: true,
			});
		}
	}

	function spawnParticlesPixel(cx: number, hitZoneY: number, lane: Lane, grade: JudgmentGrade) {
		const count = grade === 'perfect' ? 20 : 10;
		const color = LANE_COLORS[lane];
		const gridStep = 8;
		for (let i = 0; i < count; i++) {
			// Grid-explosion: snap positions to grid
			const gx = Math.round((Math.random() - 0.5) * 6) * gridStep;
			const gy = Math.round((Math.random() - 0.5) * 6) * gridStep;
			const speed = 60 + Math.random() * 120;
			const angle = Math.atan2(gy, gx || 0.1);
			particles.push({
				x: cx + gx, y: hitZoneY + gy,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 30,
				life: 0.4 + Math.random() * 0.3,
				maxLife: 0.4 + Math.random() * 0.3,
				color,
				size: gridStep * 0.45, // square-ish small pixels
				trail: false,
			});
		}
	}

	function spawnParticles(lane: Lane, grade: JudgmentGrade) {
		if (grade === 'miss') return;
		const hitZoneY = h * HIT_ZONE_Y_RATIO;
		const { left, lw } = getHighwayXAtY(hitZoneY);
		const cx = left + lane * lw + lw / 2;
		switch (hitEffect) {
			case 'splash': spawnParticlesSplash(cx, hitZoneY, lane, grade); break;
			case 'lightning': spawnParticlesLightning(cx, hitZoneY, lane, grade); break;
			case 'pixel': spawnParticlesPixel(cx, hitZoneY, lane, grade); break;
			default: spawnParticlesSparkle(cx, hitZoneY, lane, grade); break;
		}
		laneFlashes.push({ lane, time: performance.now() / 1000, intensity: grade === 'perfect' ? 1.0 : 0.6 });
	}

	function spawnHoldBurstParticles(lane: Lane, yStart: number, yEnd: number) {
		const { left, lw } = getHighwayXAtY(yStart);
		const cx = left + lane * lw + lw / 2;
		const length = Math.abs(yEnd - yStart);
		const count = Math.max(8, Math.floor(length / 15));
		const color = LANE_COLORS[lane];
		for (let i = 0; i < count; i++) {
			const y = Math.min(yStart, yEnd) + Math.random() * length;
			const angle = Math.random() * Math.PI * 2;
			const speed = 40 + Math.random() * 120;
			particles.push({
				x: cx + (Math.random() - 0.5) * lw * 0.4,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 40,
				life: 0.3 + Math.random() * 0.3,
				maxLife: 0.3 + Math.random() * 0.3,
				color,
				size: 1.5 + Math.random() * 3,
				trail: true,
			});
		}
	}

	function getComboParticleColor(combo: number): string {
		switch (comboColorMode) {
			case 'rainbow': return `hsl(${(combo * 7 + Math.random() * 30) % 360}, 100%, ${60 + Math.random() * 20}%)`;
			case 'fire': {
				const fi = Math.min(1, combo / 100);
				return `hsl(${20 - fi * 15 + Math.random() * 10}, 100%, ${55 + fi * 25 + Math.random() * 10}%)`;
			}
			case 'ice': {
				const ii = Math.min(1, combo / 100);
				return `hsl(${200 - ii * 20 + Math.random() * 15}, 80%, ${60 + ii * 20 + Math.random() * 10}%)`;
			}
			default: return `hsl(${30 + Math.random() * 30}, 100%, ${60 + Math.random() * 20}%)`;
		}
	}

	function spawnComboFireParticles(score: ScoreState) {
		if (score.combo < 10) return;
		const intensity = Math.min(1, (score.combo - 10) / 40);
		const count = 1 + Math.floor(intensity * 3);
		for (let i = 0; i < count; i++) {
			const x = 20 + Math.random() * 100;
			const y = 60;
			particles.push({
				x,
				y,
				vx: (Math.random() - 0.5) * 40,
				vy: -(60 + Math.random() * 100),
				life: 0.4 + Math.random() * 0.4,
				maxLife: 0.4 + Math.random() * 0.4,
				color: getComboParticleColor(score.combo),
				size: 2 + Math.random() * 3,
			});
		}
	}

	// ----- Shake helpers -----
	function triggerShake() {
		shakeIntensity = SHAKE_MIN + Math.random() * (SHAKE_MAX - SHAKE_MIN);
		shakeStartTime = performance.now() / 1000;
	}

	function getShakeOffset(now: number): { sx: number; sy: number } {
		const elapsed = now - shakeStartTime;
		if (elapsed > SHAKE_DURATION || shakeIntensity === 0) return { sx: 0, sy: 0 };
		const decay = 1 - elapsed / SHAKE_DURATION;
		const mag = shakeIntensity * decay;
		return {
			sx: (Math.random() * 2 - 1) * mag,
			sy: (Math.random() * 2 - 1) * mag,
		};
	}

	// ----- Full combo celebration -----
	function triggerFullCombo() {
		fullComboActive = true;
		fullComboStartTime = performance.now() / 1000;
		// Massive particle explosion: 120+ particles in all lane colors
		const hitZoneY = h * HIT_ZONE_Y_RATIO;
		const cx = w / 2;
		for (let i = 0; i < 120; i++) {
			const angle = (Math.PI * 2 * i) / 120 + Math.random() * 0.3;
			const speed = 150 + Math.random() * 400;
			const color = LANE_COLORS[i % 3];
			particles.push({
				x: cx,
				y: hitZoneY * 0.5,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 100,
				life: 0.8 + Math.random() * 0.6,
				maxLife: 0.8 + Math.random() * 0.6,
				color,
				size: 3 + Math.random() * 5,
				trail: true,
			});
		}
		// Gold sparkles
		for (let i = 0; i < 40; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 50 + Math.random() * 200;
			particles.push({
				x: cx + (Math.random() - 0.5) * w * 0.5,
				y: h * 0.4 + (Math.random() - 0.5) * h * 0.3,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 50,
				life: 1.0 + Math.random() * 0.5,
				maxLife: 1.0 + Math.random() * 0.5,
				color: '#ffdd00',
				size: 2 + Math.random() * 4,
				trail: true,
			});
		}
	}

	function drawFullComboFlash(now: number) {
		if (!fullComboActive) return;
		const elapsed = now - fullComboStartTime;
		if (elapsed > FULL_COMBO_FLASH_DURATION) {
			fullComboActive = false;
			return;
		}
		const alpha = 0.4 * (1 - elapsed / FULL_COMBO_FLASH_DURATION);
		ctx.save();
		ctx.fillStyle = `rgba(255, 221, 0, ${alpha})`;
		ctx.fillRect(0, 0, w, h);
		ctx.restore();
	}

	// ----- Streak fire (combo > 50) -----
	function drawStreakFire(dt: number, combo: number, beatPulse: number) {
		if (combo <= 50) return;
		const hitZoneY = h * HIT_ZONE_Y_RATIO;
		const intensity = Math.min(1, (combo - 50) / 50); // 0 at 50, 1 at 100+
		const topH = getHighwayXAtY(0);
		const botH = getHighwayXAtY(hitZoneY);

		// Fire particles trailing up from both sides
		const fireCount = Math.floor(1 + intensity * 4);
		for (let side = 0; side < 2; side++) {
			for (let i = 0; i < fireCount; i++) {
				const baseX = side === 0 ? botH.left : botH.right;
				const yPos = hitZoneY - Math.random() * hitZoneY * 0.6;
				particles.push({
					x: baseX + (Math.random() - 0.5) * 20,
					y: yPos,
					vx: (side === 0 ? -1 : 1) * (10 + Math.random() * 30),
					vy: -(40 + Math.random() * 80 * intensity),
					life: 0.2 + Math.random() * 0.3,
					maxLife: 0.2 + Math.random() * 0.3,
					color: getComboParticleColor(combo),
					size: 1.5 + Math.random() * 3 * intensity,
				});
			}
		}

		// Highway edge glow color based on combo color mode
		const glowAlpha = 0.05 + intensity * 0.15 + beatPulse * 0.05;
		let edgeGlowColor: string;
		switch (comboColorMode) {
			case 'rainbow': edgeGlowColor = `hsla(${(combo * 7) % 360}, 100%, 55%, ${glowAlpha})`; break;
			case 'fire': edgeGlowColor = `rgba(255, 80, 10, ${glowAlpha})`; break;
			case 'ice': edgeGlowColor = `rgba(80, 200, 255, ${glowAlpha})`; break;
			default: edgeGlowColor = `rgba(255, 100, 20, ${glowAlpha})`; break;
		}
		ctx.save();
		const leftGrad = ctx.createLinearGradient(topH.left - 30, 0, topH.left + 40, 0);
		leftGrad.addColorStop(0, 'transparent');
		leftGrad.addColorStop(0.4, edgeGlowColor);
		leftGrad.addColorStop(1, 'transparent');
		ctx.fillStyle = leftGrad;
		ctx.fillRect(topH.left - 30, 0, 70, hitZoneY + 40);
		const rightGrad = ctx.createLinearGradient(topH.right - 40, 0, topH.right + 30, 0);
		rightGrad.addColorStop(0, 'transparent');
		rightGrad.addColorStop(0.6, edgeGlowColor);
		rightGrad.addColorStop(1, 'transparent');
		ctx.fillStyle = rightGrad;
		ctx.fillRect(topH.right - 40, 0, 70, hitZoneY + 40);
		ctx.restore();
	}

	// ----- Note skin drawing helpers -----
	function drawNoteSkinShape(cx: number, cy: number, lane: Lane, radius: number) {
		if (noteSkin === 'classic') {
			drawNoteShape(cx, cy, lane, radius);
		} else if (noteSkin === 'neon') {
			// hollow outline, no fill -- just path
			drawNoteShape(cx, cy, lane, radius);
		} else {
			// minimal: simple small dot
			ctx.beginPath();
			ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
		}
	}

	function applyNoteSkinFill(cx: number, cy: number, lane: Lane, radius: number, proximity: number) {
		const color = LANE_COLORS[lane];
		if (noteSkin === 'classic') {
			const noteGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
			noteGrad.addColorStop(0, '#fff');
			noteGrad.addColorStop(0.3, color);
			noteGrad.addColorStop(1, color + 'aa');
			ctx.fillStyle = noteGrad;
			ctx.fill();
			ctx.strokeStyle = `rgba(255,255,255, ${0.5 + proximity * 0.4})`;
			ctx.lineWidth = 1.5;
			ctx.stroke();
		} else if (noteSkin === 'neon') {
			// No fill, bright glow outline
			ctx.strokeStyle = color;
			ctx.lineWidth = 2.5;
			ctx.shadowColor = color;
			ctx.shadowBlur = 15 + proximity * 10;
			ctx.stroke();
			// Inner faint glow
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 0.8;
			ctx.stroke();
		} else {
			// minimal: solid dot, no glow
			ctx.fillStyle = color;
			ctx.fill();
		}
	}

	// ----- Shooting stars -----
	function maybeSpawnShootingStar(now: number) {
		if (now - lastShootingStarTime < 2 + Math.random() * 5) return;
		lastShootingStarTime = now;
		const fromLeft = Math.random() > 0.5;
		shootingStars.push({
			x: fromLeft ? Math.random() * w * 0.3 : w * 0.7 + Math.random() * w * 0.3,
			y: Math.random() * h * 0.4,
			vx: (fromLeft ? 1 : -1) * (400 + Math.random() * 300),
			vy: 150 + Math.random() * 200,
			life: 0.6 + Math.random() * 0.5,
			maxLife: 0.6 + Math.random() * 0.5,
			length: 40 + Math.random() * 60,
		});
	}

	function resize() {
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		w = rect.width;
		h = rect.height;
		laneWidth = Math.min(120, w / 5);
		if (stars.length === 0) initStars();
	}

	// ----- Draw helpers -----

	// ----- Highway theme helpers -----
	function getThemeLaneSepColor(bp: number): string {
		switch (highwayTheme) {
			case 'space': return `rgba(120, 80, 255, ${0.15 + bp * 0.12})`;
			case 'ocean': return `rgba(40, 140, 220, ${0.12 + bp * 0.1})`;
			case 'cyberpunk': return `rgba(255, 40, 180, ${0.18 + bp * 0.15})`;
			case 'forest': return `rgba(60, 180, 80, ${0.12 + bp * 0.1})`;
			default: return `rgba(${theme.gridColor}, ${0.12 + bp * 0.1})`;
		}
	}

	function getThemeHitZoneGlow(): string {
		switch (highwayTheme) {
			case 'space': return '#8844ff';
			case 'ocean': return '#00ccff';
			case 'cyberpunk': return '#ff00cc';
			case 'forest': return '#44ff88';
			default: return theme.accent;
		}
	}

	function drawBackgroundSpace(currentTime: number, combo: number, beatPulse: number) {
		const comboIntensity = Math.min(1, combo / 50);
		ctx.fillStyle = '#020208';
		ctx.fillRect(0, 0, w, h);
		const nebulaPositions = [
			{ x: w * 0.2, y: h * 0.3, r: w * 0.35, h1: 270, h2: 240 },
			{ x: w * 0.8, y: h * 0.6, r: w * 0.3, h1: 220, h2: 280 },
			{ x: w * 0.5, y: h * 0.15, r: w * 0.25, h1: 300, h2: 260 },
		];
		for (const neb of nebulaPositions) {
			const drift = Math.sin(currentTime * 0.1 + neb.h1) * 20;
			const ng = ctx.createRadialGradient(neb.x + drift, neb.y, 0, neb.x + drift, neb.y, neb.r);
			ng.addColorStop(0, `hsla(${neb.h1}, 60%, 15%, ${0.08 + comboIntensity * 0.06 + beatPulse * 0.04})`);
			ng.addColorStop(0.5, `hsla(${neb.h2}, 50%, 10%, ${0.04 + comboIntensity * 0.03})`);
			ng.addColorStop(1, 'transparent');
			ctx.fillStyle = ng;
			ctx.fillRect(0, 0, w, h);
		}
		const planetX = w * 0.85;
		const planetY = h * 0.18;
		const planetR = Math.min(w, h) * 0.08;
		ctx.save();
		ctx.beginPath();
		ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2);
		ctx.fillStyle = '#0a0a18';
		ctx.fill();
		ctx.beginPath();
		ctx.arc(planetX, planetY, planetR + 2, 0, Math.PI * 2);
		ctx.strokeStyle = `rgba(120, 80, 255, ${0.15 + beatPulse * 0.1})`;
		ctx.lineWidth = 2;
		ctx.stroke();
		ctx.restore();
		if (beatPulse > 0.05) {
			const pr = w * 0.6 * (1 + beatPulse * 0.2);
			const pg = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, pr);
			pg.addColorStop(0, `hsla(270, 70%, 30%, ${beatPulse * 0.06 * (1 + comboIntensity)})`);
			pg.addColorStop(1, 'transparent');
			ctx.fillStyle = pg;
			ctx.fillRect(0, 0, w, h);
		}
	}

	function drawBackgroundOcean(currentTime: number, combo: number, beatPulse: number) {
		const comboIntensity = Math.min(1, combo / 50);
		const grad = ctx.createLinearGradient(0, 0, 0, h);
		grad.addColorStop(0, '#020818');
		grad.addColorStop(0.5, '#041228');
		grad.addColorStop(1, '#061830');
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);
		ctx.save();
		ctx.strokeStyle = `rgba(40, 120, 200, ${0.06 + beatPulse * 0.04})`;
		ctx.lineWidth = 1;
		for (let waveIdx = 0; waveIdx < 5; waveIdx++) {
			const baseY = h * (0.15 + waveIdx * 0.18);
			ctx.beginPath();
			for (let x = 0; x <= w; x += 4) {
				const y = baseY + Math.sin(x * 0.008 + currentTime * (0.5 + waveIdx * 0.2) + waveIdx) * (8 + waveIdx * 3);
				if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
			}
			ctx.stroke();
		}
		ctx.restore();
		for (let i = 0; i < 4; i++) {
			const gx = w * (0.15 + (i * 0.23) + Math.sin(currentTime * 0.3 + i * 2) * 0.05);
			const gy = h * (0.3 + Math.cos(currentTime * 0.2 + i * 1.5) * 0.15);
			const gr = 30 + Math.sin(currentTime * 0.8 + i) * 10;
			const al = 0.04 + comboIntensity * 0.03 + beatPulse * 0.02;
			const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
			gg.addColorStop(0, `rgba(0, 200, 255, ${al})`);
			gg.addColorStop(1, 'transparent');
			ctx.fillStyle = gg;
			ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
		}
		if (ambientParticles.length < 30 && Math.random() < 0.15) {
			ambientParticles.push({ x: Math.random() * w, y: h + 10, vx: (Math.random() - 0.5) * 15, vy: -(20 + Math.random() * 40), size: 2 + Math.random() * 4, life: 4 + Math.random() * 4, maxLife: 4 + Math.random() * 4, hue: 190 + Math.random() * 30, type: 'bubble' });
		}
		if (beatPulse > 0.05) {
			const pg = ctx.createRadialGradient(w / 2, h * 0.6, 0, w / 2, h * 0.6, w * 0.5);
			pg.addColorStop(0, `hsla(200, 70%, 25%, ${beatPulse * 0.06 * (1 + comboIntensity)})`);
			pg.addColorStop(1, 'transparent');
			ctx.fillStyle = pg;
			ctx.fillRect(0, 0, w, h);
		}
	}

	function drawBackgroundCyberpunk(currentTime: number, combo: number, beatPulse: number) {
		const comboIntensity = Math.min(1, combo / 50);
		const grad = ctx.createLinearGradient(0, 0, 0, h);
		grad.addColorStop(0, '#08020e');
		grad.addColorStop(0.5, '#0a0418');
		grad.addColorStop(1, '#060214');
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);
		const hexSize = 50;
		const hexH = hexSize * Math.sqrt(3);
		const hexAlpha = 0.04 + beatPulse * 0.03;
		ctx.save();
		ctx.strokeStyle = `rgba(255, 0, 180, ${hexAlpha})`;
		ctx.lineWidth = 0.5;
		const cols = Math.ceil(w / (hexSize * 1.5)) + 2;
		const rows = Math.ceil(h / hexH) + 2;
		const hexOffY = (currentTime * 20) % hexH;
		for (let row = -1; row < rows; row++) {
			for (let col = -1; col < cols; col++) {
				const cx = col * hexSize * 1.5;
				const cy = row * hexH + (col % 2 === 0 ? 0 : hexH / 2) + hexOffY;
				ctx.beginPath();
				for (let i = 0; i < 6; i++) {
					const angle = (Math.PI / 3) * i + Math.PI / 6;
					const px = cx + hexSize * 0.4 * Math.cos(angle);
					const py = cy + hexSize * 0.4 * Math.sin(angle);
					if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
				}
				ctx.closePath();
				ctx.stroke();
			}
		}
		ctx.restore();
		ctx.save();
		const glitchCount = 2 + Math.floor(beatPulse * 4);
		for (let i = 0; i < glitchCount; i++) {
			const gy = (Math.sin(currentTime * 13.7 + i * 97.3) * 0.5 + 0.5) * h;
			const gAlpha = 0.03 + beatPulse * 0.05 + comboIntensity * 0.02;
			ctx.fillStyle = Math.random() > 0.5 ? `rgba(255, 20, 150, ${gAlpha})` : `rgba(0, 255, 255, ${gAlpha})`;
			ctx.fillRect(0, gy, w, 1 + Math.random() * 2);
		}
		ctx.restore();
		ctx.save();
		const skylineY = h * 0.88;
		ctx.fillStyle = '#0a0212';
		ctx.beginPath();
		ctx.moveTo(0, h);
		const bldgW = [30, 50, 20, 60, 35, 45, 25, 55, 40, 30, 50, 35, 60, 25, 45, 30, 50, 40, 55, 35];
		let bx = 0;
		for (let i = 0; bx < w + 60; i++) {
			const bw = bldgW[i % bldgW.length] * (w / 800);
			const bh = (20 + ((i * 37 + 13) % 60)) * (h / 600);
			ctx.lineTo(bx, skylineY - bh);
			ctx.lineTo(bx + bw, skylineY - bh);
			bx += bw + (Math.sin(i * 1.3) * 3 + 5) * (w / 800);
		}
		ctx.lineTo(w, h);
		ctx.closePath();
		ctx.fill();
		const skyGlow = ctx.createLinearGradient(0, skylineY - 80, 0, skylineY + 10);
		skyGlow.addColorStop(0, 'transparent');
		skyGlow.addColorStop(0.5, `rgba(255, 0, 180, ${0.05 + beatPulse * 0.04})`);
		skyGlow.addColorStop(1, `rgba(0, 255, 255, ${0.03 + beatPulse * 0.03})`);
		ctx.fillStyle = skyGlow;
		ctx.fillRect(0, skylineY - 80, w, 90);
		ctx.restore();
		if (beatPulse > 0.05) {
			const pg = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, w * 0.5);
			pg.addColorStop(0, `hsla(310, 80%, 30%, ${beatPulse * 0.06 * (1 + comboIntensity)})`);
			pg.addColorStop(1, 'transparent');
			ctx.fillStyle = pg;
			ctx.fillRect(0, 0, w, h);
		}
	}

	function drawBackgroundForest(currentTime: number, combo: number, beatPulse: number) {
		const comboIntensity = Math.min(1, combo / 50);
		const grad = ctx.createLinearGradient(0, 0, 0, h);
		grad.addColorStop(0, '#020a04');
		grad.addColorStop(0.5, '#041808');
		grad.addColorStop(1, '#031206');
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);
		const gridAlpha = 0.025 + beatPulse * 0.015;
		ctx.strokeStyle = `rgba(60, 180, 80, ${gridAlpha})`;
		ctx.lineWidth = 1;
		const gridSize = 60;
		const offY = (currentTime * 20) % gridSize;
		for (let y = -gridSize + offY; y < h; y += gridSize) {
			ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
		}
		for (let x = 0; x < w; x += gridSize) {
			ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
		}
		if (ambientParticles.length < 25 && Math.random() < 0.1) {
			const isGold = Math.random() > 0.6;
			ambientParticles.push({ x: Math.random() * w, y: -10, vx: (Math.random() - 0.3) * 20, vy: 15 + Math.random() * 25, size: 2 + Math.random() * 3, life: 5 + Math.random() * 5, maxLife: 5 + Math.random() * 5, hue: isGold ? 45 + Math.random() * 15 : 100 + Math.random() * 40, type: 'leaf' });
		}
		if (ambientParticles.length < 35 && Math.random() < 0.08) {
			ambientParticles.push({ x: Math.random() * w, y: Math.random() * h * 0.7, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, size: 1.5 + Math.random() * 2, life: 2 + Math.random() * 3, maxLife: 2 + Math.random() * 3, hue: 60 + Math.random() * 40, type: 'firefly' });
		}
		if (beatPulse > 0.05) {
			const pg = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, w * 0.5);
			pg.addColorStop(0, `hsla(130, 60%, 25%, ${beatPulse * 0.06 * (1 + comboIntensity)})`);
			pg.addColorStop(1, 'transparent');
			ctx.fillStyle = pg;
			ctx.fillRect(0, 0, w, h);
		}
	}

	let currentTimeForAmbient = 0;
	function updateAndDrawAmbientParticles(dt: number) {
		for (let i = ambientParticles.length - 1; i >= 0; i--) {
			const p = ambientParticles[i];
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.life -= dt;
			if (p.life <= 0 || p.y > h + 20 || p.y < -20 || p.x < -20 || p.x > w + 20) {
				ambientParticles.splice(i, 1);
				continue;
			}
			const fadeAlpha = Math.min(1, p.life * 2) * Math.min(1, (p.maxLife - p.life) * 2);
			if (p.type === 'bubble') {
				p.vx += (Math.random() - 0.5) * 2;
				ctx.save();
				ctx.globalAlpha = fadeAlpha * 0.4;
				ctx.strokeStyle = `hsla(${p.hue}, 70%, 60%, 0.6)`;
				ctx.lineWidth = 0.8;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.stroke();
				ctx.fillStyle = `hsla(${p.hue}, 80%, 80%, 0.3)`;
				ctx.beginPath();
				ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.3, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			} else if (p.type === 'leaf') {
				p.vx += Math.sin(performance.now() / 1000 + p.hue) * 0.3;
				ctx.save();
				ctx.globalAlpha = fadeAlpha * 0.5;
				ctx.fillStyle = `hsl(${p.hue}, 60%, 45%)`;
				ctx.translate(p.x, p.y);
				ctx.rotate(currentTimeForAmbient * 0.5 + p.hue);
				ctx.beginPath();
				ctx.moveTo(0, -p.size);
				ctx.lineTo(p.size * 0.6, 0);
				ctx.lineTo(0, p.size);
				ctx.lineTo(-p.size * 0.6, 0);
				ctx.closePath();
				ctx.fill();
				ctx.restore();
			} else if (p.type === 'firefly') {
				p.vx += (Math.random() - 0.5) * 1;
				p.vy += (Math.random() - 0.5) * 1;
				const blink = Math.sin(performance.now() / 1000 * 3 + p.hue * 10) * 0.5 + 0.5;
				ctx.save();
				ctx.globalAlpha = fadeAlpha * blink * 0.7;
				const fg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
				fg.addColorStop(0, `hsla(${p.hue}, 90%, 70%, 0.8)`);
				fg.addColorStop(0.5, `hsla(${p.hue}, 80%, 50%, 0.2)`);
				fg.addColorStop(1, 'transparent');
				ctx.fillStyle = fg;
				ctx.fillRect(p.x - p.size * 3, p.y - p.size * 3, p.size * 6, p.size * 6);
				ctx.restore();
			}
		}
	}

	function drawBackground(currentTime: number, combo: number, beatPulse: number) {
		currentTimeForAmbient = currentTime;
		switch (highwayTheme) {
			case 'space': drawBackgroundSpace(currentTime, combo, beatPulse); return;
			case 'ocean': drawBackgroundOcean(currentTime, combo, beatPulse); return;
			case 'cyberpunk': drawBackgroundCyberpunk(currentTime, combo, beatPulse); return;
			case 'forest': drawBackgroundForest(currentTime, combo, beatPulse); return;
			default: break;
		}
		// --- default theme (original) ---
		const comboIntensity = Math.min(1, combo / 50);

		// base gradient with theme colors
		const grad = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, Math.max(w, h) * 0.8);
		grad.addColorStop(0, theme.bg2);
		grad.addColorStop(0.5, theme.bg1);
		grad.addColorStop(1, theme.bg3);
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);

		// combo vibrancy overlay
		if (comboIntensity > 0.05) {
			const vibrancy = ctx.createRadialGradient(w / 2, h * 0.6, 0, w / 2, h * 0.6, w * 0.7);
			vibrancy.addColorStop(0, `hsla(${theme.hue}, 80%, 20%, ${comboIntensity * 0.15})`);
			vibrancy.addColorStop(1, `hsla(${theme.hue}, 80%, 5%, 0)`);
			ctx.fillStyle = vibrancy;
			ctx.fillRect(0, 0, w, h);
		}

		// bass pulse: radial breath on every beat
		if (beatPulse > 0.05) {
			const pulseRadius = w * 0.6 * (1 + beatPulse * 0.2);
			const pulseGrad = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, pulseRadius);
			pulseGrad.addColorStop(0, `hsla(${theme.hue}, 70%, 30%, ${beatPulse * 0.08 * (1 + comboIntensity)})`);
			pulseGrad.addColorStop(0.7, `hsla(${theme.hue}, 70%, 15%, ${beatPulse * 0.03})`);
			pulseGrad.addColorStop(1, 'transparent');
			ctx.fillStyle = pulseGrad;
			ctx.fillRect(0, 0, w, h);
		}

		// subtle moving grid with theme color
		const gridAlpha = 0.03 + beatPulse * 0.02;
		ctx.strokeStyle = `rgba(${theme.gridColor}, ${gridAlpha})`;
		ctx.lineWidth = 1;
		const gridSize = 60;
		const offsetY = (currentTime * 30) % gridSize;
		for (let y = -gridSize + offsetY; y < h; y += gridSize) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(w, y);
			ctx.stroke();
		}
		for (let x = 0; x < w; x += gridSize) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, h);
			ctx.stroke();
		}
	}

	function drawStarfield(dt: number, combo: number) {
		const comboIntensity = Math.min(1, combo / 50);
		const layerMultipliers = [1, 1.5, 2.5]; // parallax speed multipliers

		for (const star of stars) {
			const speedMul = layerMultipliers[star.layer];
			star.y += star.speed * speedMul * dt;
			if (star.y > h) {
				star.y = 0;
				star.x = Math.random() * w;
			}
			const flicker = 0.7 + Math.sin(performance.now() / 1000 * star.speed * 0.1) * 0.3;
			ctx.globalAlpha = star.brightness * flicker;

			// streak/trail when combo is high
			if (comboIntensity > 0.2 && star.layer >= 1) {
				const streakLen = star.speed * speedMul * dt * (2 + comboIntensity * 8);
				ctx.strokeStyle = `rgba(180,200,255, ${ctx.globalAlpha * 0.6})`;
				ctx.lineWidth = star.size * 0.6;
				ctx.beginPath();
				ctx.moveTo(star.x, star.y);
				ctx.lineTo(star.x, star.y - streakLen);
				ctx.stroke();
			}

			ctx.fillStyle = star.layer === 2 ? '#ddeeff' : '#aabbff';
			ctx.beginPath();
			ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	function drawShootingStars(dt: number) {
		for (let i = shootingStars.length - 1; i >= 0; i--) {
			const s = shootingStars[i];
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			s.life -= dt;
			if (s.life <= 0) {
				shootingStars.splice(i, 1);
				continue;
			}
			const alpha = s.life / s.maxLife;
			const nx = -s.vx / Math.hypot(s.vx, s.vy);
			const ny = -s.vy / Math.hypot(s.vx, s.vy);

			ctx.save();
			ctx.globalAlpha = alpha;
			const trailGrad = ctx.createLinearGradient(s.x, s.y, s.x + nx * s.length, s.y + ny * s.length);
			trailGrad.addColorStop(0, '#ffffff');
			trailGrad.addColorStop(0.2, `rgba(180,200,255, 0.8)`);
			trailGrad.addColorStop(1, 'transparent');
			ctx.strokeStyle = trailGrad;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(s.x, s.y);
			ctx.lineTo(s.x + nx * s.length, s.y + ny * s.length);
			ctx.stroke();

			// bright head
			ctx.beginPath();
			ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
			ctx.fillStyle = '#fff';
			ctx.shadowColor = '#aaccff';
			ctx.shadowBlur = 10;
			ctx.fill();
			ctx.restore();
		}
	}

	function drawPerspectiveHighway(beatPulse: number) {
		const hitZoneY = h * HIT_ZONE_Y_RATIO;

		// draw tapered highway background
		const topH = getHighwayXAtY(0);
		const botH = getHighwayXAtY(hitZoneY + 40);

		ctx.save();
		ctx.beginPath();
		ctx.moveTo(topH.left, 0);
		ctx.lineTo(botH.left, hitZoneY + 40);
		ctx.lineTo(botH.right, hitZoneY + 40);
		ctx.lineTo(topH.right, 0);
		ctx.closePath();
		ctx.fillStyle = 'rgba(10, 10, 30, 0.35)';
		ctx.fill();
		ctx.restore();

		// lane dividers with glow and pulse
		for (let i = 0; i <= 3; i++) {
			ctx.save();
			ctx.shadowColor = getThemeHitZoneGlow();
			ctx.shadowBlur = 3 + beatPulse * 6;
			ctx.strokeStyle = getThemeLaneSepColor(beatPulse);
			ctx.lineWidth = 1;
			ctx.beginPath();
			// draw line from top to hit zone following perspective
			const steps = 30;
			for (let s = 0; s <= steps; s++) {
				const y = (hitZoneY + 40) * (s / steps);
				const hw = getHighwayXAtY(y);
				const x = hw.left + i * hw.lw;
				if (s === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.stroke();
			ctx.restore();
		}

		// spotlight glow behind hit zone
		const spotGrad = ctx.createRadialGradient(w / 2, hitZoneY, 0, w / 2, hitZoneY, laneWidth * 2.5);
		spotGrad.addColorStop(0, `hsla(${theme.hue}, 60%, 40%, ${0.08 + beatPulse * 0.06})`);
		spotGrad.addColorStop(0.5, `hsla(${theme.hue}, 60%, 20%, ${0.03 + beatPulse * 0.02})`);
		spotGrad.addColorStop(1, 'transparent');
		ctx.fillStyle = spotGrad;
		ctx.fillRect(0, hitZoneY - laneWidth * 2, w, laneWidth * 4);
	}

	function drawLaneFlashEffects(now: number) {
		const hitZoneY = h * HIT_ZONE_Y_RATIO;
		for (let i = laneFlashes.length - 1; i >= 0; i--) {
			const flash = laneFlashes[i];
			const age = now - flash.time;
			if (age > 0.3) {
				laneFlashes.splice(i, 1);
				continue;
			}
			const alpha = flash.intensity * (1 - age / 0.3);
			const { left, lw } = getHighwayXAtY(hitZoneY);
			const x = left + flash.lane * lw;
			const grad = ctx.createLinearGradient(x, hitZoneY - 100, x, hitZoneY + 20);
			grad.addColorStop(0, LANE_GLOW_COLORS[flash.lane] + '0)');
			grad.addColorStop(0.5, LANE_GLOW_COLORS[flash.lane] + `${alpha * 0.4})`);
			grad.addColorStop(1, LANE_GLOW_COLORS[flash.lane] + '0)');
			ctx.fillStyle = grad;
			ctx.fillRect(left, 0, lw * 3, h);
		}
	}

	// ----- Note shape helpers (per lane for accessibility) -----
	function drawNoteShape(cx: number, cy: number, lane: Lane, radius: number) {
		ctx.beginPath();
		if (lane === 0) {
			// circle
			ctx.arc(cx, cy, radius, 0, Math.PI * 2);
		} else if (lane === 1) {
			// diamond
			ctx.moveTo(cx, cy - radius);
			ctx.lineTo(cx + radius, cy);
			ctx.lineTo(cx, cy + radius);
			ctx.lineTo(cx - radius, cy);
			ctx.closePath();
		} else {
			// rounded square
			const s = radius * 0.85;
			const r = s * 0.25;
			ctx.moveTo(cx - s + r, cy - s);
			ctx.arcTo(cx + s, cy - s, cx + s, cy + s, r);
			ctx.arcTo(cx + s, cy + s, cx - s, cy + s, r);
			ctx.arcTo(cx - s, cy + s, cx - s, cy - s, r);
			ctx.arcTo(cx - s, cy - s, cx + s, cy - s, r);
			ctx.closePath();
		}
	}

	// ----- Colorblind pattern overlays -----
	function drawColorblindPattern(cx: number, cy: number, lane: Lane, radius: number) {
		if (!colorblindMode) return;
		ctx.save();
		ctx.strokeStyle = 'rgba(255,255,255,0.6)';
		ctx.lineWidth = 1.2;
		if (lane === 0) {
			// Horizontal lines (3 thin lines inside the circle)
			for (const offset of [-0.35, 0, 0.35]) {
				const y = cy + radius * offset;
				const halfW = Math.sqrt(Math.max(0, radius * radius - (radius * offset) * (radius * offset)));
				ctx.beginPath();
				ctx.moveTo(cx - halfW * 0.8, y);
				ctx.lineTo(cx + halfW * 0.8, y);
				ctx.stroke();
			}
		} else if (lane === 1) {
			// Cross/X pattern inside the diamond
			const r = radius * 0.45;
			ctx.beginPath();
			ctx.moveTo(cx - r, cy - r);
			ctx.lineTo(cx + r, cy + r);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(cx + r, cy - r);
			ctx.lineTo(cx - r, cy + r);
			ctx.stroke();
		} else {
			// Dots pattern (4 small dots inside the square)
			const d = radius * 0.32;
			const dotR = radius * 0.1;
			ctx.fillStyle = 'rgba(255,255,255,0.6)';
			for (const [dx, dy] of [[-d, -d], [d, -d], [-d, d], [d, d]]) {
				ctx.beginPath();
				ctx.arc(cx + dx, cy + dy, dotR, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.restore();
	}

	// Draw colorblind pattern on a hold note bar segment
	function drawColorblindBarPattern(lane: Lane, barCx: number, barTopY: number, barBotY: number, barWidth: number) {
		if (!colorblindMode) return;
		ctx.save();
		ctx.strokeStyle = 'rgba(255,255,255,0.3)';
		ctx.fillStyle = 'rgba(255,255,255,0.3)';
		ctx.lineWidth = 1;
		const segH = barBotY - barTopY;
		if (lane === 0) {
			// Horizontal lines repeating down the bar
			const spacing = 12;
			for (let y = barTopY + spacing / 2; y < barBotY; y += spacing) {
				ctx.beginPath();
				ctx.moveTo(barCx - barWidth * 0.7, y);
				ctx.lineTo(barCx + barWidth * 0.7, y);
				ctx.stroke();
			}
		} else if (lane === 1) {
			// X pattern repeating
			const spacing = 16;
			for (let y = barTopY + spacing / 2; y < barBotY; y += spacing) {
				const r = barWidth * 0.4;
				ctx.beginPath();
				ctx.moveTo(barCx - r, y - r * 0.6);
				ctx.lineTo(barCx + r, y + r * 0.6);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(barCx + r, y - r * 0.6);
				ctx.lineTo(barCx - r, y + r * 0.6);
				ctx.stroke();
			}
		} else {
			// Dots repeating
			const spacing = 14;
			const dotR = 1.5;
			for (let y = barTopY + spacing / 2; y < barBotY; y += spacing) {
				for (const dx of [-barWidth * 0.35, barWidth * 0.35]) {
					ctx.beginPath();
					ctx.arc(barCx + dx, y, dotR, 0, Math.PI * 2);
					ctx.fill();
				}
			}
		}
		ctx.restore();
	}

	// ----- Hold note rendering -----
	function drawHoldNote(
		note: { t: number; lane: Lane; duration: number },
		noteIndex: number,
		currentTime: number,
		hitNotes: Set<number>,
		lanePressed: (lane: Lane) => boolean,
		beatPulse: number,
	) {
		const hitZoneY = h * HIT_ZONE_Y_RATIO;
		const headDt = note.t - currentTime;
		const tailDt = (note.t + note.duration) - currentTime;
		const headY = hitZoneY - headDt * config.scrollSpeedPx;
		const tailY = hitZoneY - tailDt * config.scrollSpeedPx;

		// skip if entirely off-screen
		if (tailY > h + 60 && headY > h + 60) return;
		if (headY < -60 && tailY < -60) return;

		const isHit = hitNotes.has(noteIndex);
		if (isHit) return; // fully completed hold notes disappear

		const lane = note.lane;
		const color = LANE_COLORS[lane];
		const isBeingHeld = lanePressed(lane) && headY >= hitZoneY - 30;

		// draw the bar/beam from tail to head
		const barTopY = Math.max(-20, tailY);
		const barBotY = Math.min(h + 20, headY);

		if (barBotY > barTopY) {
			// bar body - use perspective width at midpoint
			const midY = (barTopY + barBotY) / 2;
			const { left: midLeft, lw: midLw } = getHighwayXAtY(midY);
			const barCx = midLeft + lane * midLw + midLw / 2;
			const barWidth = midLw * 0.35 * noteScale;

			// main beam
			ctx.save();
			ctx.shadowColor = color;
			ctx.shadowBlur = isBeingHeld ? 18 : 8;

			const beamGrad = ctx.createLinearGradient(barCx - barWidth, 0, barCx + barWidth, 0);
			const beamAlpha = isBeingHeld ? 0.85 : 0.55;
			beamGrad.addColorStop(0, `rgba(${LANE_RGB[lane]}, 0.1)`);
			beamGrad.addColorStop(0.15, `rgba(${LANE_RGB[lane]}, ${beamAlpha})`);
			beamGrad.addColorStop(0.5, `rgba(255,255,255, ${beamAlpha * 0.6})`);
			beamGrad.addColorStop(0.85, `rgba(${LANE_RGB[lane]}, ${beamAlpha})`);
			beamGrad.addColorStop(1, `rgba(${LANE_RGB[lane]}, 0.1)`);
			ctx.fillStyle = beamGrad;

			// draw trapezoid following perspective for each segment
			const segments = 12;
			for (let s = 0; s < segments; s++) {
				const segTop = barTopY + (barBotY - barTopY) * (s / segments);
				const segBot = barTopY + (barBotY - barTopY) * ((s + 1) / segments);
				const topHw = getHighwayXAtY(segTop);
				const botHw = getHighwayXAtY(segBot);
				const topCx = topHw.left + lane * topHw.lw + topHw.lw / 2;
				const botCx = botHw.left + lane * botHw.lw + botHw.lw / 2;
				const topW = topHw.lw * 0.35 * noteScale;
				const botW = botHw.lw * 0.35 * noteScale;

				ctx.beginPath();
				ctx.moveTo(topCx - topW, segTop);
				ctx.lineTo(topCx + topW, segTop);
				ctx.lineTo(botCx + botW, segBot);
				ctx.lineTo(botCx - botW, segBot);
				ctx.closePath();
				ctx.fill();
			}

			// glowing edges
			ctx.strokeStyle = `rgba(${LANE_RGB[lane]}, ${0.6 + beatPulse * 0.3})`;
			ctx.lineWidth = 1.5;
			for (const side of [-1, 1] as const) {
				ctx.beginPath();
				for (let s = 0; s <= segments; s++) {
					const segY = barTopY + (barBotY - barTopY) * (s / segments);
					const hw = getHighwayXAtY(segY);
					const cx2 = hw.left + lane * hw.lw + hw.lw / 2;
					const halfW = hw.lw * 0.35 * noteScale;
					const x = cx2 + side * halfW;
					if (s === 0) ctx.moveTo(x, segY);
					else ctx.lineTo(x, segY);
				}
				ctx.stroke();
			}

			ctx.restore();

			// Colorblind pattern overlay on the hold bar
			drawColorblindBarPattern(lane, barCx, barTopY, barBotY, barWidth);
		}

		// draw head note (circle/diamond/square) at the head position
		if (headY > -60 && headY < h + 60) {
			const { left, lw } = getHighwayXAtY(headY);
			const cx = left + lane * lw + lw / 2;
			const baseNoteSize = lw * 0.5 * noteScale;
			const notePulse = 1 + beatPulse * 0.08;
			const noteSize = baseNoteSize * notePulse;
			const proximity = 1 - Math.min(1, Math.abs(headY - hitZoneY) / 300);

			ctx.save();
			ctx.shadowColor = color;
			ctx.shadowBlur = 10 + proximity * 15 + beatPulse * 5;

			const noteGrad = ctx.createRadialGradient(cx, headY, 0, cx, headY, noteSize / 2);
			noteGrad.addColorStop(0, '#fff');
			noteGrad.addColorStop(0.3, color);
			noteGrad.addColorStop(1, color + 'aa');

			drawNoteShape(cx, headY, lane, noteSize / 2);
			ctx.fillStyle = noteGrad;
			ctx.fill();
			ctx.strokeStyle = `rgba(255,255,255, ${0.5 + proximity * 0.4})`;
			ctx.lineWidth = 1.5;
			ctx.stroke();
			ctx.restore();
			drawColorblindPattern(cx, headY, lane, noteSize / 2);
		}
	}

	// ----- Main draw -----
	function draw(
		currentTime: number,
		score: ScoreState,
		lanePressed: (lane: Lane) => boolean,
		hitNotes: Set<number>,
		flashes: JudgmentFlash[],
	) {
		const now = performance.now() / 1000;
		const dt = Math.min(now - lastDrawTime, 0.05);
		lastDrawTime = now;

		const hitZoneY = h * HIT_ZONE_Y_RATIO;

		// beat pulse (0-1 sawtooth synced to BPM)
		const beatPhase = currentTime > 0 ? ((currentTime % beatDuration) / beatDuration) : 0;
		const beatPulse = Math.pow(1 - beatPhase, 3);

		ctx.clearRect(0, 0, w, h);

		// Apply screen shake
		const shake = getShakeOffset(now);
		if (shake.sx !== 0 || shake.sy !== 0) {
			ctx.save();
			ctx.translate(shake.sx, shake.sy);
		}

		// animated background (combo-reactive)
		drawBackground(currentTime, score.combo, beatPulse);

		// FFT audio visualizer bars (behind notes, on top of background)
		drawVisualizerBars(beatPulse);

		// starfield with parallax and streak effects
		drawStarfield(dt, score.combo);

		// ambient particles for themed backgrounds
		updateAndDrawAmbientParticles(dt);

		// shooting stars
		maybeSpawnShootingStar(now);
		drawShootingStars(dt);

		// perspective highway with glowing dividers
		drawPerspectiveHighway(beatPulse);

		// streak fire when combo > 50
		drawStreakFire(dt, score.combo, beatPulse);

		// lane press glow (enhanced, perspective-aware)
		for (let lane = 0; lane < 3; lane++) {
			if (lanePressed(lane as Lane)) {
				const { left, lw } = getHighwayXAtY(hitZoneY);
				const x = left + lane * lw;
				const grad = ctx.createLinearGradient(x, hitZoneY - 200, x, hitZoneY + 30);
				grad.addColorStop(0, LANE_GLOW_COLORS[lane] + '0)');
				grad.addColorStop(0.6, LANE_GLOW_COLORS[lane] + '0.12)');
				grad.addColorStop(1, LANE_GLOW_COLORS[lane] + '0.25)');
				ctx.fillStyle = grad;
				ctx.fillRect(left, 0, lw * 3, h);
			}
		}

		// lane flash effects
		drawLaneFlashEffects(now);

		// hit zone line with glow (perspective)
		ctx.save();
		const hzLeft = getHighwayXAtY(hitZoneY);
		ctx.shadowColor = getThemeHitZoneGlow();
		ctx.shadowBlur = 8 + beatPulse * 6;
		ctx.strokeStyle = `rgba(${theme.gridColor}, ${0.4 + beatPulse * 0.3})`;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(hzLeft.left, hitZoneY);
		ctx.lineTo(hzLeft.right, hitZoneY);
		ctx.stroke();
		ctx.restore();

		// hit zone receptors (glowing rings that pulse, perspective-aware)
		for (let lane = 0; lane < 3; lane++) {
			const { left, lw } = getHighwayXAtY(hitZoneY);
			const cx = left + lane * lw + lw / 2;
			const pressed = lanePressed(lane as Lane);
			const receptorSize = lw * 0.6 * noteScale;
			const pulseRadius = receptorSize / 2 + (pressed ? 4 : beatPulse * 3);

			// check if any hold note is being held in this lane
			const holdingInLane = pressed && chart.notes.some((n, idx) =>
				!hitNotes.has(idx) &&
				n.lane === lane &&
				n.duration !== undefined &&
				n.duration > 0 &&
				n.t <= currentTime &&
				n.t + n.duration >= currentTime
			);

			ctx.save();
			ctx.shadowColor = LANE_COLORS[lane];
			ctx.shadowBlur = pressed ? 20 : 6 + beatPulse * 8;

			// "holding" animation: pulsing ring expansion
			if (holdingInLane) {
				const holdPulse = (Math.sin(now * 12) + 1) / 2;
				const ringRadius = pulseRadius + 6 + holdPulse * 6;
				ctx.beginPath();
				ctx.arc(cx, hitZoneY, ringRadius, 0, Math.PI * 2);
				ctx.strokeStyle = LANE_COLORS[lane] + '60';
				ctx.lineWidth = 2;
				ctx.stroke();

				const ringRadius2 = pulseRadius + 12 + holdPulse * 4;
				ctx.beginPath();
				ctx.arc(cx, hitZoneY, ringRadius2, 0, Math.PI * 2);
				ctx.strokeStyle = LANE_COLORS[lane] + '30';
				ctx.lineWidth = 1;
				ctx.stroke();
			}

			ctx.beginPath();
			ctx.arc(cx, hitZoneY, pulseRadius, 0, Math.PI * 2);
			ctx.strokeStyle = pressed
				? LANE_COLORS[lane]
				: `rgba(${LANE_RGB[lane]}, ${0.4 + beatPulse * 0.3})`;
			ctx.lineWidth = pressed ? 3 : 2;
			ctx.stroke();
			ctx.fillStyle = pressed ? LANE_COLORS[lane] + '50' : `rgba(20,20,35, ${0.6 + beatPulse * 0.2})`;
			ctx.fill();
			ctx.restore();

			if (pressed) {
				ctx.beginPath();
				ctx.arc(cx, hitZoneY, pulseRadius * 0.6, 0, Math.PI * 2);
				ctx.strokeStyle = LANE_COLORS[lane] + '80';
				ctx.lineWidth = 1;
				ctx.stroke();
			}

			ctx.fillStyle = pressed ? '#fff' : '#666';
			ctx.font = '14px monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(config.laneKeys[lane].toUpperCase(), cx, hitZoneY);
		}

		// notes rendering (hold notes first as background, then tap notes on top)
		for (let i = 0; i < chart.notes.length; i++) {
			const note = chart.notes[i];
			if (note.duration !== undefined && note.duration > 0) {
				drawHoldNote(
					note as { t: number; lane: Lane; duration: number },
					i,
					currentTime,
					hitNotes,
					lanePressed,
					beatPulse,
				);
			}
		}

		for (let i = 0; i < chart.notes.length; i++) {
			if (hitNotes.has(i)) continue;
			const note = chart.notes[i];
			// skip hold notes (they draw their own head)
			if (note.duration !== undefined && note.duration > 0) continue;

			const noteDt = note.t - currentTime;
			const y = hitZoneY - noteDt * config.scrollSpeedPx;
			if (y < -60 || y > h + 60) continue;

			const { left, lw } = getHighwayXAtY(y);
			const cx = left + note.lane * lw + lw / 2;
			const baseNoteSize = lw * 0.5 * noteScale;
			const notePulse = 1 + beatPulse * 0.08;
			const noteSize = baseNoteSize * notePulse;
			const proximity = 1 - Math.min(1, Math.abs(y - hitZoneY) / 300);

			// speed trail behind fast-moving notes
			const noteSpeed = config.scrollSpeedPx;
			if (noteSpeed > 400 && y < hitZoneY) {
				const trailLen = Math.min(30, noteSpeed * dt * 4);
				ctx.save();
				const trailGrad = ctx.createLinearGradient(cx, y, cx, y - trailLen);
				trailGrad.addColorStop(0, LANE_GLOW_COLORS[note.lane] + '0.3)');
				trailGrad.addColorStop(1, LANE_GLOW_COLORS[note.lane] + '0)');
				ctx.strokeStyle = trailGrad;
				ctx.lineWidth = noteSize * 0.4;
				ctx.beginPath();
				ctx.moveTo(cx, y);
				ctx.lineTo(cx, y - trailLen);
				ctx.stroke();
				ctx.restore();
			}

			ctx.save();
			ctx.shadowColor = LANE_COLORS[note.lane];
			ctx.shadowBlur = noteSkin === 'minimal' ? 0 : 10 + proximity * 15 + beatPulse * 5;

			drawNoteSkinShape(cx, y, note.lane, noteSize / 2);
			applyNoteSkinFill(cx, y, note.lane, noteSize / 2, proximity);
			ctx.restore();

			// colorblind pattern overlay on tap notes
			drawColorblindPattern(cx, y, note.lane, noteSize / 2);

			// additional halo for nearby notes (skip for minimal)
			if (proximity > 0.3 && noteSkin !== 'minimal') {
				drawNoteShape(cx, y, note.lane, noteSize / 2 + 4 + proximity * 4);
				ctx.strokeStyle = LANE_GLOW_COLORS[note.lane] + `${proximity * 0.2})`;
				ctx.lineWidth = 1;
				ctx.stroke();
			}
		}

		// judgment flashes (enhanced)
		for (const flash of flashes) {
			const age = now - flash.time;
			if (age > 0.6) continue;
			const alpha = 1 - age / 0.6;
			const { left, lw } = getHighwayXAtY(hitZoneY);
			const cx = left + flash.lane * lw + lw / 2;
			const flashY = hitZoneY - 40 - age * 80;
			const scale = 1 + age * 0.3;

			ctx.save();
			ctx.globalAlpha = alpha;

			const flashColor = flash.grade === 'perfect' ? '#ffdd00' : flash.grade === 'good' ? '#88ff88' : '#ff4444';
			ctx.shadowColor = flashColor;
			ctx.shadowBlur = 12;

			ctx.font = `bold ${Math.round(18 * scale)}px monospace`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = flashColor;
			ctx.fillText(flash.grade.toUpperCase(), cx, flashY);
			ctx.restore();
		}

		// particles (enhanced with gravity and trails)
		spawnComboFireParticles(score);
		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i];
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vy += 200 * dt; // gravity
			p.life -= dt;
			if (p.life <= 0) {
				particles.splice(i, 1);
				continue;
			}
			const alpha = p.life / p.maxLife;
			ctx.globalAlpha = alpha;

			if (p.trail) {
				ctx.save();
				ctx.shadowColor = p.color;
				ctx.shadowBlur = 6;
				ctx.strokeStyle = p.color;
				ctx.lineWidth = p.size * alpha * 0.5;
				ctx.beginPath();
				ctx.moveTo(p.x, p.y);
				ctx.lineTo(p.x - p.vx * dt * 3, p.y - p.vy * dt * 3);
				ctx.stroke();
				ctx.restore();
			}

			ctx.fillStyle = p.color;
			if (hitEffect === 'pixel' && !p.trail) {
				// Square pixels for pixel effect
				const s = p.size * alpha;
				ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
			} else {
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.globalAlpha = 1;

		// HUD
		ctx.save();
		ctx.shadowColor = theme.accent;
		ctx.shadowBlur = 8;
		ctx.fillStyle = '#fff';
		ctx.font = 'bold 28px monospace';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillText(`${score.score}`, 20, 20);
		ctx.restore();

		// combo with fire glow when high
		ctx.save();
		ctx.font = 'bold 18px monospace';
		if (score.combo >= 10) {
			const firePhase = Math.sin(now * 8) * 0.3 + 0.7;
			switch (comboColorMode) {
				case 'rainbow': {
					const hue = (score.combo * 7) % 360;
					ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
					ctx.shadowBlur = 10 * firePhase;
					ctx.fillStyle = `hsl(${hue}, 100%, ${60 + beatPulse * 15}%)`;
					break;
				}
				case 'fire': {
					const fireIntensity = Math.min(1, (score.combo - 10) / 90);
					const fHue = 20 - fireIntensity * 15; // orange -> red
					const fLight = 50 + fireIntensity * 30 + beatPulse * 10; // -> white
					ctx.shadowColor = `hsl(${fHue}, 100%, 55%)`;
					ctx.shadowBlur = 10 * firePhase;
					ctx.fillStyle = `hsl(${fHue}, 100%, ${Math.min(90, fLight)}%)`;
					break;
				}
				case 'ice': {
					const iceIntensity = Math.min(1, (score.combo - 10) / 90);
					const iHue = 200 - iceIntensity * 20; // light blue -> cyan
					const iLight = 60 + iceIntensity * 25 + beatPulse * 10; // -> white
					ctx.shadowColor = `hsl(${iHue}, 80%, 65%)`;
					ctx.shadowBlur = 10 * firePhase;
					ctx.fillStyle = `hsl(${iHue}, 80%, ${Math.min(92, iLight)}%)`;
					break;
				}
				default: {
					ctx.shadowColor = '#ff8800';
					ctx.shadowBlur = 10 * firePhase;
					ctx.fillStyle = `hsl(${40 + score.combo * 0.5}, 100%, ${55 + beatPulse * 15}%)`;
					break;
				}
			}
		} else {
			ctx.fillStyle = '#aaa';
		}
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillText(`${score.combo}x combo`, 20, 54);
		ctx.restore();

		// progress bar with gradient
		const lastNoteTime = chart.notes[chart.notes.length - 1]?.t ?? 0;
		const progress = lastNoteTime > 0 ? Math.min(1, currentTime / lastNoteTime) : 0;
		const barW = w - 40;
		const barH = 6;
		const barY = h - 20;

		ctx.fillStyle = 'rgba(255,255,255,0.06)';
		ctx.fillRect(20, barY, barW, barH);

		if (progress > 0) {
			const barGrad = ctx.createLinearGradient(20, 0, 20 + barW * progress, 0);
			barGrad.addColorStop(0, theme.accent);
			barGrad.addColorStop(0.5, '#66aaff');
			barGrad.addColorStop(1, '#88ccff');
			ctx.fillStyle = barGrad;
			ctx.fillRect(20, barY, barW * progress, barH);

			ctx.save();
			ctx.shadowColor = '#88ccff';
			ctx.shadowBlur = 8;
			ctx.beginPath();
			ctx.arc(20 + barW * progress, barY + barH / 2, 3, 0, Math.PI * 2);
			ctx.fillStyle = '#fff';
			ctx.fill();
			ctx.restore();
		}

		// Full combo golden flash overlay
		drawFullComboFlash(now);

		// Restore shake transform
		if (shake.sx !== 0 || shake.sy !== 0) {
			ctx.restore();
		}
	}

	return { resize, draw, spawnParticles, spawnHoldBurstParticles, triggerShake, triggerFullCombo, setAnalyser };
}
