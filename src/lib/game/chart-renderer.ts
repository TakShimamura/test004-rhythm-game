/**
 * Data visualization chart renderers (line charts, bar charts).
 * NOT related to gameplay chart/note rendering.
 */

export type LineDataPoint = {
	label: string;
	value: number;
};

export type LineChartOptions = {
	width: number;
	height: number;
	color: string;
	showFill: boolean;
	showDots: boolean;
	yMin?: number;
	yMax?: number;
	labelColor?: string;
	gridColor?: string;
	yLabel?: string;
};

export type BarDataPoint = {
	label: string;
	value: number;
	color: string;
};

export type BarChartOptions = {
	width: number;
	height: number;
	labelColor?: string;
	gridColor?: string;
};

const DEFAULT_LABEL_COLOR = '#666';
const DEFAULT_GRID_COLOR = '#222';

export function drawLineChart(
	ctx: CanvasRenderingContext2D,
	data: LineDataPoint[],
	options: LineChartOptions,
): void {
	const {
		width,
		height,
		color,
		showFill,
		showDots,
		labelColor = DEFAULT_LABEL_COLOR,
		gridColor = DEFAULT_GRID_COLOR,
		yLabel,
	} = options;

	if (data.length === 0) return;

	const padding = { top: 20, right: 20, bottom: 36, left: 48 };
	const chartW = width - padding.left - padding.right;
	const chartH = height - padding.top - padding.bottom;

	const values = data.map((d) => d.value);
	const yMin = options.yMin ?? Math.min(...values);
	const yMax = options.yMax ?? Math.max(...values);
	const yRange = yMax - yMin || 1;

	// Clear
	ctx.clearRect(0, 0, width, height);

	// Grid lines
	ctx.strokeStyle = gridColor;
	ctx.lineWidth = 1;
	const gridLines = 4;
	for (let i = 0; i <= gridLines; i++) {
		const y = padding.top + (chartH / gridLines) * i;
		ctx.beginPath();
		ctx.moveTo(padding.left, y);
		ctx.lineTo(width - padding.right, y);
		ctx.stroke();

		// Y-axis labels
		const val = yMax - (yRange / gridLines) * i;
		ctx.fillStyle = labelColor;
		ctx.font = '10px monospace';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		ctx.fillText(val.toFixed(1), padding.left - 6, y);
	}

	// Y-axis label
	if (yLabel) {
		ctx.save();
		ctx.fillStyle = labelColor;
		ctx.font = '10px monospace';
		ctx.textAlign = 'center';
		ctx.translate(12, padding.top + chartH / 2);
		ctx.rotate(-Math.PI / 2);
		ctx.fillText(yLabel, 0, 0);
		ctx.restore();
	}

	// X-axis labels (show a subset)
	const maxXLabels = Math.min(data.length, 8);
	const step = Math.max(1, Math.floor(data.length / maxXLabels));
	ctx.fillStyle = labelColor;
	ctx.font = '10px monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	for (let i = 0; i < data.length; i += step) {
		const x = padding.left + (chartW / Math.max(data.length - 1, 1)) * i;
		ctx.fillText(data[i].label, x, height - padding.bottom + 8);
	}

	// Map data to pixel coords
	const points = data.map((d, i) => ({
		x: padding.left + (chartW / Math.max(data.length - 1, 1)) * i,
		y: padding.top + chartH - ((d.value - yMin) / yRange) * chartH,
	}));

	// Fill area
	if (showFill && points.length > 1) {
		const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
		gradient.addColorStop(0, color + '40');
		gradient.addColorStop(1, color + '00');
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.moveTo(points[0].x, padding.top + chartH);
		for (const p of points) {
			ctx.lineTo(p.x, p.y);
		}
		ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
		ctx.closePath();
		ctx.fill();
	}

	// Line
	if (points.length > 1) {
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x, points[i].y);
		}
		ctx.stroke();
	}

	// Dots
	if (showDots) {
		for (const p of points) {
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = '#0a0a0f';
			ctx.lineWidth = 1;
			ctx.stroke();
		}
	}
}

export function drawBarChart(
	ctx: CanvasRenderingContext2D,
	data: BarDataPoint[],
	options: BarChartOptions,
): void {
	const {
		width,
		height,
		labelColor = DEFAULT_LABEL_COLOR,
		gridColor = DEFAULT_GRID_COLOR,
	} = options;

	if (data.length === 0) return;

	const padding = { top: 20, right: 20, bottom: 36, left: 48 };
	const chartW = width - padding.left - padding.right;
	const chartH = height - padding.top - padding.bottom;

	const maxVal = Math.max(...data.map((d) => d.value), 1);

	// Clear
	ctx.clearRect(0, 0, width, height);

	// Grid lines
	ctx.strokeStyle = gridColor;
	ctx.lineWidth = 1;
	const gridLines = 4;
	for (let i = 0; i <= gridLines; i++) {
		const y = padding.top + (chartH / gridLines) * i;
		ctx.beginPath();
		ctx.moveTo(padding.left, y);
		ctx.lineTo(width - padding.right, y);
		ctx.stroke();

		const val = maxVal - (maxVal / gridLines) * i;
		ctx.fillStyle = labelColor;
		ctx.font = '10px monospace';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		ctx.fillText(Math.round(val).toString(), padding.left - 6, y);
	}

	// Bars
	const barGap = 8;
	const totalGap = barGap * (data.length + 1);
	const barWidth = Math.min(40, (chartW - totalGap) / data.length);

	const totalBarsWidth = data.length * barWidth + (data.length + 1) * barGap;
	const offsetX = padding.left + (chartW - totalBarsWidth) / 2;

	for (let i = 0; i < data.length; i++) {
		const d = data[i];
		const barH = (d.value / maxVal) * chartH;
		const x = offsetX + barGap + i * (barWidth + barGap);
		const y = padding.top + chartH - barH;

		// Bar with gradient
		const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartH);
		gradient.addColorStop(0, d.color);
		gradient.addColorStop(1, d.color + '60');
		ctx.fillStyle = gradient;
		ctx.fillRect(x, y, barWidth, barH);

		// Value on top
		if (d.value > 0) {
			ctx.fillStyle = d.color;
			ctx.font = 'bold 11px monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'bottom';
			ctx.fillText(d.value.toString(), x + barWidth / 2, y - 4);
		}

		// Label
		ctx.fillStyle = labelColor;
		ctx.font = '11px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillText(d.label, x + barWidth / 2, height - padding.bottom + 8);
	}
}
