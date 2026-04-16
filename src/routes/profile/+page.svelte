<script lang="ts">
	import { authClient } from '$lib/auth-client.js';
	import { ACHIEVEMENT_DEFS, xpForNextLevel } from '$lib/game/progression.js';
	import { drawLineChart } from '$lib/game/chart-renderer.js';
	import type { LineDataPoint } from '$lib/game/chart-renderer.js';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';

	const session = authClient.useSession();

	type Profile = {
		userId: string;
		xp: number;
		level: number;
		totalPlays: number;
		totalPlayTimeMs: number;
		balance: number;
	};

	type Achievement = { type: string; unlockedAt: string };

	type ReplayEntry = {
		replayId: string;
		createdAt: string;
		score: number;
		accuracy: number;
		maxCombo: number;
		songTitle: string;
		songArtist: string;
		chartDifficulty: string;
		chartId: string;
	};

	type HistoryEntry = {
		id: string;
		score: number;
		maxCombo: number;
		accuracy: number;
		playedAt: string;
		chartDifficulty: string;
		songTitle: string;
		songArtist: string;
	};

	let profile: Profile | null = $state(null);
	let userAchievements: Achievement[] = $state([]);
	let history: HistoryEntry[] = $state([]);
	let recentReplays: ReplayEntry[] = $state([]);
	let loading = $state(true);
	let viewingOther = $state(false);
	let otherUserName = $state('');
	let otherUserImage: string | null = $state(null);
	let isFollowing = $state(false);
	let followLoading = $state(false);
	let viewedUserId = $state('');
	let miniChartCanvas: HTMLCanvasElement | undefined = $state(undefined);
	let loginStreak = $state(0);

	onMount(async () => {
		const targetUserId = page.url.searchParams.get('user');

		if (targetUserId && targetUserId !== $session.data?.user.id) {
			// Viewing another user's profile
			viewingOther = true;
			viewedUserId = targetUserId;

			const profileRes = await fetch(`/api/profile/${targetUserId}`);
			if (profileRes.ok) {
				const data = await profileRes.json();
				profile = data.profile;
				userAchievements = data.achievements;
				otherUserName = data.user.name;
				otherUserImage = data.user.image;
			}

			// Check follow status
			if ($session.data) {
				await checkFollowStatus(targetUserId);
			}

			loading = false;
			return;
		}

		// Viewing own profile
		if (!$session.data) { loading = false; return; }

		viewedUserId = $session.data.user.id;

		const [profileRes, historyRes, replaysRes] = await Promise.all([
			fetch('/api/profile'),
			fetch('/api/profile/history'),
			fetch('/api/profile/replays'),
		]);

		if (profileRes.ok) {
			const data = await profileRes.json();
			profile = data.profile;
			userAchievements = data.achievements;
		}

		if (historyRes.ok) {
			history = await historyRes.json();
		}

		if (replaysRes.ok) {
			recentReplays = await replaysRes.json();
		}

		// Fetch login streak
		try {
			const streakRes = await fetch('/api/streak/check', { method: 'POST' });
			if (streakRes.ok) {
				const streakData = await streakRes.json();
				loginStreak = streakData.currentStreak;
			}
		} catch { /* ignore */ }

		loading = false;

		await tick();
		renderMiniChart();
	});

	function renderMiniChart(): void {
		if (!miniChartCanvas || history.length === 0) return;
		const ctx = miniChartCanvas.getContext('2d');
		if (!ctx) return;
		const last10 = history.slice(0, 10).reverse();
		const data: LineDataPoint[] = last10.map((h) => ({
			label: '',
			value: h.accuracy * 100,
		}));
		drawLineChart(ctx, data, {
			width: 200,
			height: 80,
			color: '#4488ff',
			showFill: true,
			showDots: true,
			yMin: 0,
			yMax: 100,
		});
	}

	async function checkFollowStatus(targetId: string): Promise<void> {
		const res = await fetch(`/api/follows?userId=${targetId}`);
		if (res.ok) {
			const data = await res.json();
			isFollowing = data.following;
		}
	}

	async function toggleFollow(): Promise<void> {
		if (!$session.data || !viewedUserId) return;
		followLoading = true;

		const method = isFollowing ? 'DELETE' : 'POST';
		const res = await fetch('/api/follows', {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ followingId: viewedUserId }),
		});

		if (res.ok) {
			isFollowing = !isFollowing;
		}
		followLoading = false;
	}

	function xpProgress(xp: number, level: number): number {
		const prevThreshold = (level - 1) * (level - 1) * 100;
		const nextThreshold = xpForNextLevel(level);
		const current = xp - prevThreshold;
		const needed = nextThreshold - prevThreshold;
		return needed > 0 ? Math.min(current / needed, 1) : 1;
	}

	function formatTime(ms: number): string {
		const hours = Math.floor(ms / 3_600_000);
		const mins = Math.floor((ms % 3_600_000) / 60_000);
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}

	function grade(accuracy: number): string {
		if (accuracy >= 0.98) return 'SS';
		if (accuracy >= 0.95) return 'S';
		if (accuracy >= 0.9) return 'A';
		if (accuracy >= 0.8) return 'B';
		if (accuracy >= 0.7) return 'C';
		return 'D';
	}

	function gradeColor(g: string): string {
		switch (g) {
			case 'SS': return '#ffdd00';
			case 'S': return '#44ff66';
			case 'A': return '#4488ff';
			case 'B': return '#aa88ff';
			case 'C': return '#ff8844';
			default: return '#888';
		}
	}

	function avgAccuracy(): number {
		if (history.length === 0) return 0;
		return history.reduce((sum, h) => sum + h.accuracy, 0) / history.length;
	}

	function bestCombo(): number {
		if (history.length === 0) return 0;
		return Math.max(...history.map((h) => h.maxCombo));
	}

	const displayName = $derived(viewingOther ? otherUserName : ($session.data?.user.name ?? ''));
	const unlockedSet = $derived(new Set(userAchievements.map((a) => a.type)));
</script>

{#if !viewingOther && !$session.data}
	<div class="profile-page">
		<div class="center-msg">
			<p>You must be logged in to view your profile.</p>
			<a href="/auth" class="login-link">LOGIN / SIGN UP</a>
		</div>
	</div>
{:else if loading}
	<div class="profile-page">
		<div class="center-msg"><p>Loading...</p></div>
	</div>
{:else if profile}
	<div class="profile-page" style="position: relative;">
		<Tooltip key="profile-hint" text="Track your progress and achievements" position="top" />
		<a href="/" class="back-link">&larr; BACK</a>

		<div class="profile-header">
			<h1 class="player-name">{displayName}</h1>
			<div class="level-badge">LV. {profile.level}</div>
			{#if viewingOther && $session.data}
				<button
					class="follow-btn"
					class:following={isFollowing}
					onclick={toggleFollow}
					disabled={followLoading}
				>
					{isFollowing ? 'UNFOLLOW' : 'FOLLOW'}
				</button>
			{/if}
		</div>

		<!-- XP Bar -->
		<div class="xp-section">
			<div class="xp-label">
				<span>XP: {profile.xp}</span>
				<span>Next: {xpForNextLevel(profile.level)}</span>
			</div>
			<div class="xp-bar">
				<div class="xp-fill" style="width: {xpProgress(profile.xp, profile.level) * 100}%"></div>
			</div>
		</div>

		<!-- Stats Grid -->
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-value">{profile.totalPlays}</div>
				<div class="stat-label">Total Plays</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{formatTime(profile.totalPlayTimeMs)}</div>
				<div class="stat-label">Play Time</div>
			</div>
			{#if !viewingOther}
				<div class="stat-card">
					<div class="stat-value">{(avgAccuracy() * 100).toFixed(1)}%</div>
					<div class="stat-label">Avg Accuracy</div>
				</div>
				<div class="stat-card">
					<div class="stat-value">{bestCombo()}</div>
					<div class="stat-label">Best Combo</div>
				</div>
			{/if}
		</div>

		<!-- Economy info -->
		{#if !viewingOther}
			<div class="economy-row">
				<div class="economy-card">
					<span class="economy-icon coin-color">&#9733;</span>
					<div class="economy-info">
						<span class="economy-value">{profile.balance ?? 0}</span>
						<span class="economy-label">COINS</span>
					</div>
				</div>
				<div class="economy-card">
					<span class="economy-icon streak-color">&#128293;</span>
					<div class="economy-info">
						<span class="economy-value">{loginStreak}</span>
						<span class="economy-label">DAY STREAK</span>
					</div>
				</div>
				<a href="/shop" class="shop-link">SHOP &rarr;</a>
			</div>
		{/if}

		<!-- Stats link + mini chart -->
		{#if !viewingOther}
			<div class="stats-link-section">
				<div class="stats-link-row">
					<a href="/stats" class="detailed-stats-link">VIEW DETAILED STATS &rarr;</a>
				</div>
				{#if history.length > 0}
					<div class="mini-chart-wrapper">
						<span class="mini-chart-label">Accuracy (last 10)</span>
						<canvas bind:this={miniChartCanvas} width="200" height="80"></canvas>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Achievements -->
		<h2 class="section-title">ACHIEVEMENTS</h2>
		<div class="achievements-grid">
			{#each ACHIEVEMENT_DEFS as def}
				{@const unlocked = unlockedSet.has(def.id)}
				<div class="achievement" class:locked={!unlocked}>
					<span class="achievement-icon">{def.icon}</span>
					<div class="achievement-info">
						<div class="achievement-name">{def.name}</div>
						<div class="achievement-desc">{def.description}</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Play History (own profile only) -->
		{#if !viewingOther}
			<h2 class="section-title">RECENT PLAYS</h2>
			{#if history.length === 0}
				<p class="no-data">No plays yet. Go play some songs!</p>
			{:else}
				<div class="history-list">
					{#each history as entry}
						{@const g = grade(entry.accuracy)}
						<div class="history-item">
							<div class="history-song">
								<span class="song-title">{entry.songTitle}</span>
								<span class="song-artist">{entry.songArtist}</span>
							</div>
							<div class="history-difficulty">{entry.chartDifficulty.toUpperCase()}</div>
							<div class="history-score">{entry.score.toLocaleString()}</div>
							<div class="history-accuracy">{(entry.accuracy * 100).toFixed(1)}%</div>
							<div class="history-grade" style="color: {gradeColor(g)}">{g}</div>
							<div class="history-date">{new Date(entry.playedAt).toLocaleDateString()}</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Replays -->
			<h2 class="section-title">SAVED REPLAYS</h2>
			{#if recentReplays.length === 0}
				<p class="no-data">No saved replays yet.</p>
			{:else}
				<div class="history-list">
					{#each recentReplays as replay}
						{@const g = grade(replay.accuracy)}
						<div class="history-item">
							<div class="history-song">
								<span class="song-title">{replay.songTitle}</span>
								<span class="song-artist">{replay.songArtist}</span>
							</div>
							<div class="history-difficulty">{replay.chartDifficulty.toUpperCase()}</div>
							<div class="history-score">{replay.score.toLocaleString()}</div>
							<div class="history-accuracy">{(replay.accuracy * 100).toFixed(1)}%</div>
							<div class="history-grade" style="color: {gradeColor(g)}">{g}</div>
							<a href="/replay/{replay.replayId}" class="replay-watch-link">WATCH</a>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
{:else if viewingOther}
	<div class="profile-page">
		<div class="center-msg"><p>Player not found.</p></div>
	</div>
{/if}

<style>
	.profile-page {
		min-height: 100vh;
		background: #0a0a0f;
		color: #fff;
		font-family: monospace;
		padding: 40px 24px;
		max-width: 800px;
		margin: 0 auto;
	}

	.center-msg {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 80vh;
		gap: 16px;
		color: #888;
	}

	.login-link {
		color: #4488ff;
		text-decoration: none;
		letter-spacing: 2px;
		border: 1px solid #4488ff;
		padding: 8px 20px;
	}

	.login-link:hover {
		background: #4488ff20;
	}

	.back-link {
		color: #555;
		text-decoration: none;
		font-size: 13px;
		letter-spacing: 2px;
	}

	.back-link:hover {
		color: #aaa;
	}

	.profile-header {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-top: 24px;
	}

	.player-name {
		font-size: 28px;
		letter-spacing: 3px;
		margin: 0;
		text-shadow: 0 0 10px rgba(68, 136, 255, 0.3);
	}

	.level-badge {
		background: #4488ff20;
		border: 1px solid #4488ff;
		color: #4488ff;
		padding: 4px 12px;
		font-size: 14px;
		letter-spacing: 2px;
	}

	.follow-btn {
		font-family: monospace;
		font-size: 12px;
		padding: 6px 16px;
		background: transparent;
		border: 1px solid #4488ff;
		color: #4488ff;
		cursor: pointer;
		letter-spacing: 1px;
		transition: background 0.2s;
	}

	.follow-btn:hover {
		background: #4488ff20;
	}

	.follow-btn.following {
		border-color: #ff4466;
		color: #ff4466;
	}

	.follow-btn.following:hover {
		background: #ff446620;
	}

	.follow-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* XP Bar */
	.xp-section {
		margin-top: 24px;
	}

	.xp-label {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: #888;
		margin-bottom: 6px;
	}

	.xp-bar {
		height: 8px;
		background: #1a1a2e;
		border: 1px solid #333;
		border-radius: 4px;
		overflow: hidden;
	}

	.xp-fill {
		height: 100%;
		background: linear-gradient(90deg, #4488ff, #44ff66);
		transition: width 0.5s ease;
		border-radius: 4px;
	}

	/* Stats */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
		margin-top: 28px;
	}

	.stat-card {
		background: #111118;
		border: 1px solid #222;
		padding: 16px 12px;
		text-align: center;
	}

	.stat-value {
		font-size: 22px;
		color: #4488ff;
		margin-bottom: 4px;
	}

	.stat-label {
		font-size: 11px;
		color: #666;
		letter-spacing: 1px;
		text-transform: uppercase;
	}

	/* Economy row */
	.economy-row {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-top: 24px;
	}

	.economy-card {
		display: flex;
		align-items: center;
		gap: 10px;
		background: #111118;
		border: 1px solid #222;
		padding: 12px 16px;
	}

	.economy-icon {
		font-size: 24px;
	}

	.coin-color {
		color: #ffdd00;
		text-shadow: 0 0 8px rgba(255, 221, 0, 0.4);
	}

	.streak-color {
		color: #ff8844;
	}

	.economy-info {
		display: flex;
		flex-direction: column;
	}

	.economy-value {
		font-size: 20px;
		color: #fff;
		font-weight: bold;
	}

	.economy-label {
		font-size: 10px;
		color: #666;
		letter-spacing: 1px;
	}

	.shop-link {
		font-family: monospace;
		font-size: 14px;
		color: #4488ff;
		text-decoration: none;
		border: 1px solid #4488ff44;
		padding: 12px 20px;
		letter-spacing: 2px;
		transition: background 0.2s, border-color 0.2s;
	}

	.shop-link:hover {
		background: #4488ff20;
		border-color: #4488ff;
	}

	/* Stats link section */
	.stats-link-section {
		margin-top: 28px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}

	.stats-link-row {
		display: flex;
		align-items: center;
	}

	.detailed-stats-link {
		color: #4488ff;
		text-decoration: none;
		font-size: 13px;
		letter-spacing: 2px;
		border: 1px solid #4488ff44;
		padding: 8px 16px;
		transition: background 0.2s, border-color 0.2s;
	}

	.detailed-stats-link:hover {
		background: #4488ff20;
		border-color: #4488ff;
	}

	.mini-chart-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.mini-chart-label {
		font-size: 10px;
		color: #555;
		letter-spacing: 1px;
	}

	/* Achievements */
	.section-title {
		font-size: 16px;
		letter-spacing: 3px;
		color: #555;
		margin-top: 36px;
		margin-bottom: 16px;
		border-bottom: 1px solid #222;
		padding-bottom: 8px;
	}

	.achievements-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
	}

	.achievement {
		display: flex;
		align-items: center;
		gap: 12px;
		background: #111118;
		border: 1px solid #333;
		padding: 12px;
		transition: border-color 0.2s;
	}

	.achievement:not(.locked) {
		border-color: #44ff6644;
	}

	.achievement.locked {
		opacity: 0.35;
		filter: grayscale(1);
	}

	.achievement-icon {
		font-size: 24px;
		flex-shrink: 0;
	}

	.achievement-name {
		font-size: 13px;
		color: #ddd;
	}

	.achievement-desc {
		font-size: 11px;
		color: #666;
		margin-top: 2px;
	}

	/* History */
	.no-data {
		color: #555;
		font-size: 13px;
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.history-item {
		display: grid;
		grid-template-columns: 2fr 0.8fr 1fr 0.8fr 0.5fr 1fr;
		align-items: center;
		gap: 8px;
		background: #111118;
		border: 1px solid #1a1a2e;
		padding: 10px 14px;
		font-size: 13px;
	}

	.history-song {
		display: flex;
		flex-direction: column;
	}

	.song-title {
		color: #ddd;
	}

	.song-artist {
		font-size: 11px;
		color: #555;
	}

	.history-difficulty {
		color: #aa88ff;
		font-size: 11px;
		letter-spacing: 1px;
	}

	.history-score {
		color: #4488ff;
		text-align: right;
	}

	.history-accuracy {
		color: #aaa;
		text-align: right;
	}

	.history-grade {
		font-weight: bold;
		text-align: center;
		font-size: 16px;
	}

	.history-date {
		color: #555;
		font-size: 11px;
		text-align: right;
	}

	.replay-watch-link {
		color: #ff8844;
		text-decoration: none;
		font-size: 12px;
		letter-spacing: 1px;
		text-align: right;
		transition: color 0.2s;
	}

	.replay-watch-link:hover {
		color: #ffaa66;
		text-decoration: underline;
	}

	@media (max-width: 768px) {
		.profile-page {
			padding: 24px 16px;
		}

		.profile-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}

		.player-name {
			font-size: 22px;
		}

		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.achievements-grid {
			grid-template-columns: 1fr;
		}

		.history-item {
			grid-template-columns: 1fr 1fr;
			gap: 4px;
			font-size: 12px;
		}

		.history-song {
			grid-column: 1 / -1;
		}
	}
</style>
