import type { Chart, GameConfig, Lane, ScoreState, JudgmentGrade } from './types.js';

const LANE_COLORS = ['#ff4466', '#44ff66', '#4488ff'] as const;
const LANE_GLOW_COLORS = ['rgba(255,68,102,', 'rgba(68,255,102,', 'rgba(68,136,255,'] as const;

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
};

export function createRenderer({ canvas, chart, config }: RendererOptions): Renderer {
	const ctx = canvas.getContext('2d')!;
	let w = 0;
	let h = 0;
	let laneWidth = 0;
	let highwayLeft = 0;
	const particles: Particle[] = [];
	const stars: Star[] = [];
	const laneFlashes: LaneFlash[] = [];
	let lastDrawTime = performance.now() / 1000;

	const beatDuration = 60 / chart.bpm;

	function initStars() {
		stars.length = 0;
		for (let i = 0; i < 120; i++) {
			stars.push({
				x: Math.random() * (w || 1920),
				y: Math.random() * (h || 1080),
				speed: 15 + Math.random() * 40,
				size: 0.5 + Math.random() * 1.5,
				brightness: 0.2 + Math.random() * 0.6,
			});
		}
	}

	function spawnParticles(lane: Lane, grade: JudgmentGrade) {
		if (grade === 'miss') return;
		const cx = highwayLeft + lane * laneWidth + laneWidth / 2;
		const hitZoneY = h * HIT_ZONE_Y_RATIO;
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
		// add lane flash
		laneFlashes.push({ lane, time: performance.now() / 1000, intensity: grade === 'perfect' ? 1.0 : 0.6 });
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

	function resize() {
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		w = rect.width;
		h = rect.height;
		laneWidth = Math.min(120, w / 5);
		highwayLeft = (w - laneWidth * 3) / 2;
		if (stars.length === 0) initStars();
	}

	const HIT_ZONE_Y_RATIO = 0.85;

	function drawStarfield(dt: number) {
		for (const star of stars) {
			star.y += star.speed * dt;
			if (star.y > h) {
				star.y = 0;
				star.x = Math.random() * w;
			}
			const flicker = 0.7 + Math.sin(performance.now() / 1000 * star.speed * 0.1) * 0.3;
			ctx.globalAlpha = star.brightness * flicker;
			ctx.fillStyle = '#aabbff';
			ctx.beginPath();
			ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	function drawBackground(currentTime: number) {
		// dark gradient base
		const grad = ctx.createLinearGradient(0, 0, 0, h);
		grad.addColorStop(0, '#050510');
		grad.addColorStop(0.5, '#0a0a1a');
		grad.addColorStop(1, '#0a0518');
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);

		// subtle moving grid
		ctx.strokeStyle = 'rgba(68, 136, 255, 0.04)';
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

	function drawLaneFlashEffects(now: number) {
		for (let i = laneFlashes.length - 1; i >= 0; i--) {
			const flash = laneFlashes[i];
			const age = now - flash.time;
			if (age > 0.3) {
				laneFlashes.splice(i, 1);
				continue;
			}
			const alpha = flash.intensity * (1 - age / 0.3);
			const x = highwayLeft + flash.lane * laneWidth;
			const grad = ctx.createLinearGradient(x, h * HIT_ZONE_Y_RATIO - 100, x, h * HIT_ZONE_Y_RATIO + 20);
			grad.addColorStop(0, LANE_GLOW_COLORS[flash.lane] + '0)');
			grad.addColorStop(0.5, LANE_GLOW_COLORS[flash.lane] + `${alpha * 0.4})`);
			grad.addColorStop(1, LANE_GLOW_COLORS[flash.lane] + '0)');
			ctx.fillStyle = grad;
			ctx.fillRect(x, 0, laneWidth, h);
		}
	}

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
		const beatPulse = Math.pow(1 - beatPhase, 3); // sharp attack, slow decay

		ctx.clearRect(0, 0, w, h);

		// animated background
		drawBackground(currentTime);
		drawStarfield(dt);

		// lane separators with glow
		for (let i = 0; i <= 3; i++) {
			const x = highwayLeft + i * laneWidth;
			ctx.strokeStyle = `rgba(68, 136, 255, ${0.08 + beatPulse * 0.05})`;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, h);
			ctx.stroke();
		}

		// lane press glow (enhanced)
		for (let lane = 0; lane < 3; lane++) {
			if (lanePressed(lane as Lane)) {
				const x = highwayLeft + lane * laneWidth;
				const grad = ctx.createLinearGradient(x, hitZoneY - 200, x, hitZoneY + 30);
				grad.addColorStop(0, LANE_GLOW_COLORS[lane] + '0)');
				grad.addColorStop(0.6, LANE_GLOW_COLORS[lane] + '0.12)');
				grad.addColorStop(1, LANE_GLOW_COLORS[lane] + '0.25)');
				ctx.fillStyle = grad;
				ctx.fillRect(x, 0, laneWidth, h);
			}
		}

		// lane flash effects
		drawLaneFlashEffects(now);

		// hit zone line with glow
		ctx.save();
		ctx.shadowColor = '#4488ff';
		ctx.shadowBlur = 8 + beatPulse * 6;
		ctx.strokeStyle = `rgba(68, 136, 255, ${0.4 + beatPulse * 0.3})`;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(highwayLeft, hitZoneY);
		ctx.lineTo(highwayLeft + laneWidth * 3, hitZoneY);
		ctx.stroke();
		ctx.restore();

		// hit zone receptors (glowing rings that pulse)
		const receptorSize = laneWidth * 0.6;
		for (let lane = 0; lane < 3; lane++) {
			const cx = highwayLeft + lane * laneWidth + laneWidth / 2;
			const pressed = lanePressed(lane as Lane);
			const pulseRadius = receptorSize / 2 + (pressed ? 4 : beatPulse * 3);

			ctx.save();

			// outer glow ring
			ctx.shadowColor = LANE_COLORS[lane];
			ctx.shadowBlur = pressed ? 20 : 6 + beatPulse * 8;

			ctx.beginPath();
			ctx.arc(cx, hitZoneY, pulseRadius, 0, Math.PI * 2);
			ctx.strokeStyle = pressed ? LANE_COLORS[lane] : `rgba(${lane === 0 ? '255,68,102' : lane === 1 ? '68,255,102' : '68,136,255'}, ${0.4 + beatPulse * 0.3})`;
			ctx.lineWidth = pressed ? 3 : 2;
			ctx.stroke();

			ctx.fillStyle = pressed ? LANE_COLORS[lane] + '50' : `rgba(20,20,35, ${0.6 + beatPulse * 0.2})`;
			ctx.fill();

			ctx.restore();

			// inner ring
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

		// notes with glow and BPM-synced pulsing
		for (let i = 0; i < chart.notes.length; i++) {
			if (hitNotes.has(i)) continue;
			const note = chart.notes[i];
			const noteDt = note.t - currentTime;
			const y = hitZoneY - noteDt * config.scrollSpeedPx;

			if (y < -60 || y > h + 60) continue;

			const cx = highwayLeft + note.lane * laneWidth + laneWidth / 2;
			const baseNoteSize = laneWidth * 0.5;
			// pulse size with BPM
			const notePulse = 1 + beatPulse * 0.08;
			const noteSize = baseNoteSize * notePulse;

			// proximity glow: notes glow brighter as they approach hit zone
			const proximity = 1 - Math.min(1, Math.abs(y - hitZoneY) / 300);

			ctx.save();

			// outer glow
			ctx.shadowColor = LANE_COLORS[note.lane];
			ctx.shadowBlur = 10 + proximity * 15 + beatPulse * 5;

			// note body
			const noteGrad = ctx.createRadialGradient(cx, y, 0, cx, y, noteSize / 2);
			noteGrad.addColorStop(0, '#fff');
			noteGrad.addColorStop(0.3, LANE_COLORS[note.lane]);
			noteGrad.addColorStop(1, LANE_COLORS[note.lane] + 'aa');

			ctx.beginPath();
			ctx.arc(cx, y, noteSize / 2, 0, Math.PI * 2);
			ctx.fillStyle = noteGrad;
			ctx.fill();

			// white edge highlight
			ctx.strokeStyle = `rgba(255,255,255, ${0.5 + proximity * 0.4})`;
			ctx.lineWidth = 1.5;
			ctx.stroke();

			ctx.restore();

			// additional halo for nearby notes
			if (proximity > 0.3) {
				ctx.beginPath();
				ctx.arc(cx, y, noteSize / 2 + 4 + proximity * 4, 0, Math.PI * 2);
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
			const cx = highwayLeft + flash.lane * laneWidth + laneWidth / 2;
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

			// trail effect
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

		// score with glow
		ctx.shadowColor = '#4488ff';
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

		// bar background
		ctx.fillStyle = 'rgba(255,255,255,0.06)';
		ctx.fillRect(20, barY, barW, barH);

		// bar fill with gradient
		if (progress > 0) {
			const barGrad = ctx.createLinearGradient(20, 0, 20 + barW * progress, 0);
			barGrad.addColorStop(0, '#4488ff');
			barGrad.addColorStop(0.5, '#66aaff');
			barGrad.addColorStop(1, '#88ccff');
			ctx.fillStyle = barGrad;
			ctx.fillRect(20, barY, barW * progress, barH);

			// glow on the leading edge
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

	return { resize, draw, spawnParticles };
}
