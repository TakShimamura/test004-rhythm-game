import type { Chart, GameConfig, Lane, MusicStyle, ScoreState, JudgmentGrade } from './types.js';

const LANE_COLORS = ['#ff4466', '#44ff66', '#4488ff'] as const;
const LANE_GLOW_COLORS = ['rgba(255,68,102,', 'rgba(68,255,102,', 'rgba(68,136,255,'] as const;
const LANE_RGB = ['255,68,102', '68,255,102', '68,136,255'] as const;

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

	const beatDuration = 60 / chart.bpm;
	const theme = chart.style ? STYLE_THEMES[chart.style] : DEFAULT_THEME;

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
	function spawnParticles(lane: Lane, grade: JudgmentGrade) {
		if (grade === 'miss') return;
		const hitZoneY = h * HIT_ZONE_Y_RATIO;
		const { left, lw } = getHighwayXAtY(hitZoneY);
		const cx = left + lane * lw + lw / 2;
		const count = grade === 'perfect' ? 24 : 12;
		const color = LANE_COLORS[lane];
		for (let i = 0; i < count; i++) {
			const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
			const speed = 100 + Math.random() * 250;
			particles.push({
				x: cx,
				y: hitZoneY,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 60,
				life: 0.5 + Math.random() * 0.4,
				maxLife: 0.5 + Math.random() * 0.4,
				color,
				size: 2 + Math.random() * 4,
				trail: grade === 'perfect',
			});
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

	function spawnComboFireParticles(score: ScoreState) {
		if (score.combo < 10) return;
		const intensity = Math.min(1, (score.combo - 10) / 40);
		const count = 1 + Math.floor(intensity * 3);
		for (let i = 0; i < count; i++) {
			const x = 20 + Math.random() * 100;
			const y = 60;
			const hue = 30 + Math.random() * 30;
			particles.push({
				x,
				y,
				vx: (Math.random() - 0.5) * 40,
				vy: -(60 + Math.random() * 100),
				life: 0.4 + Math.random() * 0.4,
				maxLife: 0.4 + Math.random() * 0.4,
				color: `hsl(${hue}, 100%, ${60 + Math.random() * 20}%)`,
				size: 2 + Math.random() * 3,
			});
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

	function drawBackground(currentTime: number, combo: number, beatPulse: number) {
		// combo-reactive vibrancy: shift background brightness/saturation with combo
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
			ctx.shadowColor = theme.accent;
			ctx.shadowBlur = 3 + beatPulse * 6;
			ctx.strokeStyle = `rgba(${theme.gridColor}, ${0.12 + beatPulse * 0.1})`;
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
			const barWidth = midLw * 0.35;

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
				const topW = topHw.lw * 0.35;
				const botW = botHw.lw * 0.35;

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
					const halfW = hw.lw * 0.35;
					const x = cx2 + side * halfW;
					if (s === 0) ctx.moveTo(x, segY);
					else ctx.lineTo(x, segY);
				}
				ctx.stroke();
			}

			ctx.restore();
		}

		// draw head note (circle/diamond/square) at the head position
		if (headY > -60 && headY < h + 60) {
			const { left, lw } = getHighwayXAtY(headY);
			const cx = left + lane * lw + lw / 2;
			const baseNoteSize = lw * 0.5;
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

		// animated background (combo-reactive)
		drawBackground(currentTime, score.combo, beatPulse);

		// starfield with parallax and streak effects
		drawStarfield(dt, score.combo);

		// shooting stars
		maybeSpawnShootingStar(now);
		drawShootingStars(dt);

		// perspective highway with glowing dividers
		drawPerspectiveHighway(beatPulse);

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
		ctx.shadowColor = theme.accent;
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
			const receptorSize = lw * 0.6;
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
			const baseNoteSize = lw * 0.5;
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
			ctx.shadowBlur = 10 + proximity * 15 + beatPulse * 5;

			const noteGrad = ctx.createRadialGradient(cx, y, 0, cx, y, noteSize / 2);
			noteGrad.addColorStop(0, '#fff');
			noteGrad.addColorStop(0.3, LANE_COLORS[note.lane]);
			noteGrad.addColorStop(1, LANE_COLORS[note.lane] + 'aa');

			drawNoteShape(cx, y, note.lane, noteSize / 2);
			ctx.fillStyle = noteGrad;
			ctx.fill();

			ctx.strokeStyle = `rgba(255,255,255, ${0.5 + proximity * 0.4})`;
			ctx.lineWidth = 1.5;
			ctx.stroke();
			ctx.restore();

			// additional halo for nearby notes
			if (proximity > 0.3) {
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
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
			ctx.fill();
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
			ctx.shadowColor = '#ff8800';
			ctx.shadowBlur = 10 * firePhase;
			ctx.fillStyle = `hsl(${40 + score.combo * 0.5}, 100%, ${55 + beatPulse * 15}%)`;
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
	}

	return { resize, draw, spawnParticles, spawnHoldBurstParticles };
}
