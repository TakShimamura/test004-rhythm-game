/**
 * Generates a shareable stats card image on a canvas element.
 */

export type StatsCardData = {
	playerName: string;
	level: number;
	grade: string;
	score: number;
	accuracy: number;
	maxCombo: number;
	songTitle: string;
	difficulty: string;
};

const GRADE_COLORS: Record<string, string> = {
	S: '#ffdd00',
	A: '#44ff66',
	B: '#4488ff',
	C: '#ff8844',
	D: '#ff4444',
};

export function generateStatsCard(
	canvas: HTMLCanvasElement,
	stats: StatsCardData,
): void {
	const w = 480;
	const h = 320;
	canvas.width = w;
	canvas.height = h;

	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	// Background
	ctx.fillStyle = '#0a0a0f';
	ctx.fillRect(0, 0, w, h);

	// Border
	ctx.strokeStyle = '#222';
	ctx.lineWidth = 2;
	ctx.strokeRect(1, 1, w - 2, h - 2);

	// Accent line at top
	ctx.fillStyle = '#4488ff';
	ctx.fillRect(0, 0, w, 3);

	// Title
	ctx.fillStyle = '#4488ff';
	ctx.font = 'bold 16px monospace';
	ctx.textAlign = 'center';
	ctx.fillText('RHYTHM GAME', w / 2, 28);

	// Player info
	ctx.fillStyle = '#aaa';
	ctx.font = '12px monospace';
	ctx.fillText(`${stats.playerName}  LV.${stats.level}`, w / 2, 50);

	// Grade with glow
	const gradeColor = GRADE_COLORS[stats.grade] ?? '#888';
	ctx.save();
	ctx.shadowColor = gradeColor;
	ctx.shadowBlur = 30;
	ctx.fillStyle = gradeColor;
	ctx.font = 'bold 72px monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(stats.grade, w / 2, 120);
	ctx.restore();

	// Stats row
	const statsY = 180;
	const cols = [w * 0.2, w * 0.5, w * 0.8];
	const labels = ['SCORE', 'ACCURACY', 'MAX COMBO'];
	const values = [
		stats.score.toLocaleString(),
		(stats.accuracy * 100).toFixed(1) + '%',
		stats.maxCombo.toString() + 'x',
	];

	ctx.textBaseline = 'alphabetic';
	for (let i = 0; i < 3; i++) {
		ctx.fillStyle = '#666';
		ctx.font = '10px monospace';
		ctx.textAlign = 'center';
		ctx.fillText(labels[i], cols[i], statsY);

		ctx.fillStyle = '#fff';
		ctx.font = 'bold 18px monospace';
		ctx.fillText(values[i], cols[i], statsY + 22);
	}

	// Song info
	ctx.fillStyle = '#888';
	ctx.font = '13px monospace';
	ctx.textAlign = 'center';
	ctx.fillText(stats.songTitle, w / 2, 240);

	ctx.fillStyle = '#aa88ff';
	ctx.font = '11px monospace';
	ctx.fillText(stats.difficulty.toUpperCase(), w / 2, 258);

	// Watermark
	ctx.fillStyle = '#1a1a2e';
	ctx.font = '10px monospace';
	ctx.fillText('RHYTHM GAME', w / 2, h - 12);
}

export function downloadStatsCard(canvas: HTMLCanvasElement, filename = 'rhythm-game-stats.png'): void {
	canvas.toBlob((blob) => {
		if (!blob) return;
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}, 'image/png');
}
