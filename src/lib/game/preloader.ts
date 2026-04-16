/**
 * Asset preloading for gameplay — fetches chart data and audio before play starts.
 */

export type PreloadProgress = {
	/** 0–1 overall progress */
	progress: number;
	/** Human-readable status label */
	status: string;
};

export type PreloadResult = {
	chartData: unknown;
	audioCached: boolean;
};

/**
 * Preload chart JSON from the API (or cache).
 */
export async function preloadChart(
	chartId: string,
	onProgress?: (p: PreloadProgress) => void,
): Promise<unknown> {
	onProgress?.({ progress: 0, status: 'Loading chart...' });

	const res = await fetch(`/api/charts/${chartId}`);
	if (!res.ok) {
		throw new Error(`Failed to load chart ${chartId}: ${res.status}`);
	}

	const data: unknown = await res.json();
	onProgress?.({ progress: 1, status: 'Chart loaded' });
	return data;
}

/**
 * Preload an audio file into memory via fetch (also warms the service worker cache).
 * Returns true when the audio bytes have been fetched.
 */
export async function preloadSong(
	audioUrl: string,
	onProgress?: (p: PreloadProgress) => void,
): Promise<boolean> {
	onProgress?.({ progress: 0, status: 'Loading audio...' });

	const res = await fetch(audioUrl);
	if (!res.ok) {
		throw new Error(`Failed to preload audio ${audioUrl}: ${res.status}`);
	}

	const reader = res.body?.getReader();
	const contentLength = Number(res.headers.get('Content-Length') || 0);

	if (reader && contentLength > 0) {
		let received = 0;
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			received += value.byteLength;
			onProgress?.({
				progress: Math.min(received / contentLength, 1),
				status: `Audio ${Math.round((received / contentLength) * 100)}%`,
			});
		}
	} else {
		// Fallback: consume without progress tracking
		await res.arrayBuffer();
	}

	onProgress?.({ progress: 1, status: 'Audio loaded' });
	return true;
}

/**
 * Preload both chart and song for gameplay, reporting combined progress.
 */
export async function preloadForGameplay(
	chartId: string,
	audioUrl: string | null,
	onProgress?: (p: PreloadProgress) => void,
): Promise<PreloadResult> {
	let chartProgress = 0;
	let audioProgress = 0;
	const hasAudio = audioUrl !== null && audioUrl.length > 0;

	const reportCombined = () => {
		const total = hasAudio
			? chartProgress * 0.3 + audioProgress * 0.7
			: chartProgress;
		onProgress?.({
			progress: total,
			status: total < 1 ? 'Loading...' : 'Ready!',
		});
	};

	const chartPromise = preloadChart(chartId, (p) => {
		chartProgress = p.progress;
		reportCombined();
	});

	let audioCached = false;

	if (hasAudio) {
		const audioPromise = preloadSong(audioUrl, (p) => {
			audioProgress = p.progress;
			reportCombined();
		});

		const [chartData] = await Promise.all([chartPromise, audioPromise]);
		audioCached = true;
		return { chartData, audioCached };
	}

	const chartData = await chartPromise;
	audioProgress = 1;
	reportCombined();
	return { chartData, audioCached };
}
