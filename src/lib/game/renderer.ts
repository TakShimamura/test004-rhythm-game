import type { Chart, GameConfig, Lane, ScoreState, JudgmentGrade } from './types.js';

const LANE_COLORS = ['#ff4466', '#44ff66', '#4488ff'] as const;

type Particle = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
	color: string;
	size: number;
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

	function spawnParticles(lane: Lane, grade: JudgmentGrade) {
		if (grade === 'miss') return;
		const cx = highwayLeft + lane * laneWidth + laneWidth / 2;
		const hitZoneY = h * HIT_ZONE_Y_RATIO;
		const count = grade === 'perfect' ? 12 : 6;
		const color = LANE_COLORS[lane];
		for (let i = 0; i < count; i++) {
			const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
			const speed = 80 + Math.random() * 160;
			particles.push({
				x: cx,
				y: hitZoneY,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: 0.4 + Math.random() * 0.2,
				maxLife: 0.4 + Math.random() * 0.2,
				color,
				size: 3 + Math.random() * 3,
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
	}

	const HIT_ZONE_Y_RATIO = 0.85;

	function draw(
		currentTime: number,
		score: ScoreState,
		lanePressed: (lane: Lane) => boolean,
		hitNotes: Set<number>,
		flashes: JudgmentFlash[],
	) {
		const hitZoneY = h * HIT_ZONE_Y_RATIO;

		ctx.clearRect(0, 0, w, h);

		// background
		ctx.fillStyle = '#0a0a0f';
		ctx.fillRect(0, 0, w, h);

		// lane separators
		for (let i = 0; i <= 3; i++) {
			const x = highwayLeft + i * laneWidth;
			ctx.strokeStyle = '#222';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, h);
			ctx.stroke();
		}

		// hit zone line
		ctx.strokeStyle = '#555';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(highwayLeft, hitZoneY);
		ctx.lineTo(highwayLeft + laneWidth * 3, hitZoneY);
		ctx.stroke();

		// lane press glow
		for (let lane = 0; lane < 3; lane++) {
			if (lanePressed(lane as Lane)) {
				const x = highwayLeft + lane * laneWidth;
				ctx.fillStyle = LANE_COLORS[lane] + '20';
				ctx.fillRect(x, 0, laneWidth, h);
			}
		}

		// hit zone receptors
		const receptorSize = laneWidth * 0.6;
		for (let lane = 0; lane < 3; lane++) {
			const cx = highwayLeft + lane * laneWidth + laneWidth / 2;
			const pressed = lanePressed(lane as Lane);
			ctx.beginPath();
			ctx.arc(cx, hitZoneY, receptorSize / 2, 0, Math.PI * 2);
			ctx.strokeStyle = pressed ? LANE_COLORS[lane] : '#444';
			ctx.lineWidth = pressed ? 3 : 2;
			ctx.stroke();

			ctx.fillStyle = pressed ? LANE_COLORS[lane] + '60' : '#222';
			ctx.fill();

			ctx.fillStyle = '#666';
			ctx.font = '14px monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(config.laneKeys[lane].toUpperCase(), cx, hitZoneY);
		}

		// notes
		for (let i = 0; i < chart.notes.length; i++) {
			if (hitNotes.has(i)) continue;
			const note = chart.notes[i];
			const dt = note.t - currentTime;
			const y = hitZoneY - dt * config.scrollSpeedPx;

			if (y < -40 || y > h + 40) continue;

			const cx = highwayLeft + note.lane * laneWidth + laneWidth / 2;
			const noteSize = laneWidth * 0.5;

			ctx.beginPath();
			ctx.arc(cx, y, noteSize / 2, 0, Math.PI * 2);
			ctx.fillStyle = LANE_COLORS[note.lane];
			ctx.fill();
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 2;
			ctx.stroke();
		}

		// judgment flashes
		const now = performance.now() / 1000;
		for (const flash of flashes) {
			const age = now - flash.time;
			if (age > 0.5) continue;
			const alpha = 1 - age / 0.5;
			const cx = highwayLeft + flash.lane * laneWidth + laneWidth / 2;
			const flashY = hitZoneY - 40 - age * 60;

			ctx.globalAlpha = alpha;
			ctx.fillStyle = flash.grade === 'perfect' ? '#ffdd00' : flash.grade === 'good' ? '#88ff88' : '#ff4444';
			ctx.font = 'bold 18px monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(flash.grade.toUpperCase(), cx, flashY);
			ctx.globalAlpha = 1;
		}

		// particles
		const dt = 1 / 60;
		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i];
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.life -= dt;
			if (p.life <= 0) {
				particles.splice(i, 1);
				continue;
			}
			const alpha = p.life / p.maxLife;
			ctx.globalAlpha = alpha;
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;

		// HUD
		ctx.fillStyle = '#fff';
		ctx.font = 'bold 24px monospace';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillText(`${score.score}`, 20, 20);

		ctx.font = '16px monospace';
		ctx.fillStyle = score.combo >= 10 ? '#ffdd00' : '#aaa';
		ctx.fillText(`${score.combo}x combo`, 20, 50);

		// progress bar
		const lastNoteTime = chart.notes[chart.notes.length - 1]?.t ?? 0;
		const progress = lastNoteTime > 0 ? Math.min(1, currentTime / lastNoteTime) : 0;
		const barW = w - 40;
		ctx.fillStyle = '#222';
		ctx.fillRect(20, h - 20, barW, 6);
		ctx.fillStyle = '#4488ff';
		ctx.fillRect(20, h - 20, barW * progress, 6);
	}

	return { resize, draw, spawnParticles };
}
