<script lang="ts">
	import { onMount } from 'svelte';
	import { authClient } from '$lib/auth-client.js';

	const session = authClient.useSession();

	type FeedEntry = {
		scoreId: string;
		playerName: string;
		playerImage: string | null;
		playerId: string;
		songTitle: string;
		songArtist: string;
		difficulty: string;
		score: number;
		accuracy: number;
		maxCombo: number;
		playedAt: string;
	};

	let feed: FeedEntry[] = $state([]);
	let loading = $state(true);

	onMount(async () => {
		if (!$session.data) { loading = false; return; }

		const res = await fetch('/api/follows/feed');
		if (res.ok) {
			feed = await res.json();
		}
		loading = false;
	});

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

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}
</script>

<div class="feed-page">
	<a href="/" class="back-link">&larr; BACK</a>
	<h1>ACTIVITY FEED</h1>

	{#if !$session.data}
		<div class="center-msg">
			<p>You must be logged in to view your feed.</p>
			<a href="/auth" class="login-link">LOGIN / SIGN UP</a>
		</div>
	{:else if loading}
		<p class="hint">Loading...</p>
	{:else if feed.length === 0}
		<div class="empty-state">
			<p>No activity yet.</p>
			<p class="suggestion">Follow players from the <a href="/leaderboard">leaderboard</a> to see their scores here.</p>
		</div>
	{:else}
		<div class="feed-list">
			{#each feed as entry}
				{@const g = grade(entry.accuracy)}
				<div class="feed-item">
					<div class="feed-header">
						<a href="/profile?user={entry.playerId}" class="player-name">{entry.playerName}</a>
						<span class="time-ago">{timeAgo(entry.playedAt)}</span>
					</div>
					<div class="feed-body">
						<div class="song-info">
							<span class="song-title">{entry.songTitle}</span>
							<span class="song-artist">{entry.songArtist}</span>
						</div>
						<span class="difficulty">{entry.difficulty.toUpperCase()}</span>
						<span class="score">{entry.score.toLocaleString()}</span>
						<span class="accuracy">{(entry.accuracy * 100).toFixed(1)}%</span>
						<span class="grade" style="color: {gradeColor(g)}">{g}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.feed-page {
		min-height: 100vh;
		background: #0a0a0f;
		color: #fff;
		font-family: monospace;
		padding: 40px 24px;
		max-width: 700px;
		margin: 0 auto;
	}

	.back-link {
		color: #555;
		text-decoration: none;
		font-size: 13px;
		letter-spacing: 2px;
	}

	.back-link:hover { color: #aaa; }

	h1 {
		font-size: 28px;
		letter-spacing: 4px;
		margin: 24px 0 24px;
	}

	.hint { color: #555; font-size: 14px; }

	.center-msg {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 60vh;
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

	.login-link:hover { background: #4488ff20; }

	.empty-state {
		color: #666;
		font-size: 14px;
		margin-top: 40px;
		text-align: center;
	}

	.suggestion a {
		color: #4488ff;
		text-decoration: none;
	}

	.suggestion a:hover { text-decoration: underline; }

	.feed-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.feed-item {
		background: #111118;
		border: 1px solid #1a1a2e;
		padding: 12px 14px;
	}

	.feed-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.player-name {
		color: #4488ff;
		text-decoration: none;
		font-size: 13px;
		font-weight: bold;
	}

	.player-name:hover { text-decoration: underline; }

	.time-ago {
		color: #555;
		font-size: 11px;
	}

	.feed-body {
		display: grid;
		grid-template-columns: 2fr 0.8fr 1fr 0.8fr 0.5fr;
		align-items: center;
		gap: 8px;
		font-size: 13px;
	}

	.song-info {
		display: flex;
		flex-direction: column;
	}

	.song-title { color: #ddd; }
	.song-artist { font-size: 11px; color: #555; }
	.difficulty { color: #aa88ff; font-size: 11px; letter-spacing: 1px; }
	.score { color: #4488ff; text-align: right; }
	.accuracy { color: #aaa; text-align: right; }
	.grade { font-weight: bold; text-align: center; font-size: 16px; }

	@media (max-width: 500px) {
		.feed-body {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
