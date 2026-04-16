<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { authClient } from '$lib/auth-client.js';

	type Comment = {
		id: string;
		text: string;
		timestamp: number | null;
		createdAt: string;
		userName: string;
		userId: string;
	};

	type DifficultyVotes = { easy: number; normal: number; hard: number };

	let chartId = $derived($page.params.id);
	let chart: {
		id: string;
		songId: string;
		difficulty: string;
		songTitle: string;
		songArtist: string;
		bpm: number;
		audioUrl: string;
	} | null = $state(null);
	let comments: Comment[] = $state([]);
	let diffVotes: DifficultyVotes = $state({ easy: 0, normal: 0, hard: 0 });
	let rating: { average: number | null; count: number; userRating: number | null } = $state({ average: null, count: 0, userRating: null });
	let loading = $state(true);

	let commentText = $state('');
	let commentTimestamp = $state('');
	let submitting = $state(false);

	const session = authClient.useSession();

	onMount(async () => {
		const [chartRes, commentsRes, votesRes, ratingRes] = await Promise.all([
			fetch(`/api/charts/${chartId}`),
			fetch(`/api/charts/${chartId}/comments`),
			fetch(`/api/charts/${chartId}/difficulty-votes`),
			fetch(`/api/charts/${chartId}/rating`),
		]);

		if (chartRes.ok) chart = await chartRes.json();
		if (commentsRes.ok) comments = await commentsRes.json();
		if (votesRes.ok) diffVotes = await votesRes.json();
		if (ratingRes.ok) rating = await ratingRes.json();

		loading = false;
	});

	async function submitComment() {
		if (!commentText.trim()) return;
		submitting = true;

		const body: { text: string; timestamp?: number } = { text: commentText.trim() };
		const ts = parseFloat(commentTimestamp);
		if (!isNaN(ts) && ts >= 0) body.timestamp = ts;

		const res = await fetch(`/api/charts/${chartId}/comments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

		if (res.ok) {
			const newComment = await res.json();
			comments = [...comments, newComment];
			commentText = '';
			commentTimestamp = '';
		}

		submitting = false;
	}

	async function voteDifficulty(vote: 'easy' | 'normal' | 'hard') {
		const res = await fetch(`/api/charts/${chartId}/vote-difficulty`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ vote }),
		});

		if (res.ok) {
			const votesRes = await fetch(`/api/charts/${chartId}/difficulty-votes`);
			if (votesRes.ok) diffVotes = await votesRes.json();
		}
	}

	function formatTimestamp(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${String(s).padStart(2, '0')}`;
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

<div class="chart-page">
	{#if loading}
		<p class="hint">Loading chart...</p>
	{:else if !chart}
		<p class="hint">Chart not found</p>
	{:else}
		<div class="chart-header">
			<h1>{chart.songTitle}</h1>
			<p class="artist">{chart.songArtist}</p>
			<div class="meta-row">
				<span class="difficulty-badge">{chart.difficulty.toUpperCase()}</span>
				<span class="bpm">{chart.bpm} BPM</span>
				{#if rating.average !== null}
					<span class="rating">{rating.average.toFixed(1)} &#9733; ({rating.count})</span>
				{/if}
			</div>
			<a href="/play?chart={chart.id}" class="play-btn">PLAY</a>
		</div>

		<div class="section">
			<h2>DIFFICULTY VOTE</h2>
			<p class="section-hint">How difficult is this chart?</p>
			<div class="vote-buttons">
				{#each (['easy', 'normal', 'hard'] as const) as level}
					<button
						class="vote-btn vote-{level}"
						disabled={!$session.data}
						onclick={() => voteDifficulty(level)}
					>
						{level.toUpperCase()}
						<span class="vote-count">{diffVotes[level]}</span>
					</button>
				{/each}
			</div>
		</div>

		<div class="section">
			<h2>COMMENTS ({comments.length})</h2>

			{#if $session.data}
				<form class="comment-form" onsubmit={(e) => { e.preventDefault(); submitComment(); }}>
					<input
						type="text"
						placeholder="Write a comment..."
						bind:value={commentText}
						class="comment-input"
					/>
					<input
						type="text"
						placeholder="Time (sec)"
						bind:value={commentTimestamp}
						class="timestamp-input"
					/>
					<button type="submit" class="submit-btn" disabled={submitting || !commentText.trim()}>
						POST
					</button>
				</form>
			{:else}
				<p class="hint">Log in to comment</p>
			{/if}

			<div class="comments-list">
				{#each comments as comment}
					<div class="comment">
						<div class="comment-header">
							<span class="comment-user">{comment.userName}</span>
							{#if comment.timestamp !== null}
								<span class="comment-ts">{formatTimestamp(comment.timestamp)}</span>
							{/if}
							<span class="comment-time">{timeAgo(comment.createdAt)}</span>
						</div>
						<p class="comment-text">{comment.text}</p>
					</div>
				{/each}
				{#if comments.length === 0}
					<p class="hint">No comments yet</p>
				{/if}
			</div>
		</div>
	{/if}

	<a href="/songs" class="back-link">&larr; Back to Songs</a>
</div>

<style>
	.chart-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 100vh;
		background: #0a0a0f;
		color: #fff;
		padding: 48px 24px;
		gap: 32px;
		font-family: monospace;
	}

	.chart-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	h1 {
		font-size: 28px;
		letter-spacing: 3px;
		margin: 0;
	}

	h2 {
		font-size: 14px;
		letter-spacing: 3px;
		color: #888;
		margin: 0 0 12px;
	}

	.artist {
		color: #888;
		font-size: 14px;
		margin: 0;
	}

	.meta-row {
		display: flex;
		gap: 12px;
		align-items: center;
		font-size: 13px;
	}

	.difficulty-badge {
		padding: 2px 10px;
		border: 1px solid #4488ff;
		color: #4488ff;
		font-size: 11px;
		letter-spacing: 2px;
	}

	.bpm { color: #666; }

	.rating {
		color: #ffdd00;
	}

	.play-btn {
		margin-top: 8px;
		font-family: monospace;
		font-size: 18px;
		padding: 12px 36px;
		background: transparent;
		border: 2px solid #44ff66;
		color: #44ff66;
		text-decoration: none;
		letter-spacing: 3px;
		transition: background 0.2s;
	}

	.play-btn:hover {
		background: #44ff6620;
	}

	.section {
		width: 100%;
		max-width: 500px;
	}

	.section-hint {
		color: #555;
		font-size: 12px;
		margin: 0 0 8px;
	}

	.vote-buttons {
		display: flex;
		gap: 8px;
	}

	.vote-btn {
		flex: 1;
		font-family: monospace;
		font-size: 12px;
		padding: 8px;
		background: #111;
		border: 1px solid #333;
		color: #aaa;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		transition: border-color 0.2s, background 0.2s;
	}

	.vote-btn:hover:not(:disabled) {
		background: #1a1a1a;
	}

	.vote-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.vote-easy:hover:not(:disabled) { border-color: #44ff66; color: #44ff66; }
	.vote-normal:hover:not(:disabled) { border-color: #ffdd00; color: #ffdd00; }
	.vote-hard:hover:not(:disabled) { border-color: #ff4466; color: #ff4466; }

	.vote-count {
		font-size: 16px;
		font-weight: bold;
	}

	.comment-form {
		display: flex;
		gap: 6px;
		margin-bottom: 16px;
	}

	.comment-input {
		flex: 1;
		background: #111;
		border: 1px solid #333;
		color: #fff;
		padding: 8px 10px;
		font-family: monospace;
		font-size: 13px;
	}

	.comment-input:focus { outline: none; border-color: #4488ff; }

	.timestamp-input {
		width: 80px;
		background: #111;
		border: 1px solid #333;
		color: #fff;
		padding: 8px 10px;
		font-family: monospace;
		font-size: 13px;
	}

	.timestamp-input:focus { outline: none; border-color: #4488ff; }

	.submit-btn {
		font-family: monospace;
		font-size: 12px;
		padding: 8px 14px;
		background: transparent;
		border: 1px solid #4488ff;
		color: #4488ff;
		cursor: pointer;
		letter-spacing: 1px;
	}

	.submit-btn:hover:not(:disabled) { background: #4488ff20; }
	.submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.comments-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.comment {
		background: #111;
		border: 1px solid #1a1a1a;
		padding: 10px 12px;
	}

	.comment-header {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 11px;
		margin-bottom: 4px;
	}

	.comment-user {
		color: #4488ff;
		font-weight: bold;
	}

	.comment-ts {
		color: #ffdd00;
		background: #ffdd0015;
		padding: 1px 6px;
		font-size: 10px;
	}

	.comment-time {
		color: #555;
		margin-left: auto;
	}

	.comment-text {
		color: #ccc;
		font-size: 13px;
		margin: 0;
		line-height: 1.4;
	}

	.hint {
		color: #555;
		font-size: 13px;
	}

	.back-link {
		font-family: monospace;
		color: #555;
		font-size: 14px;
		text-decoration: none;
	}

	.back-link:hover { color: #888; }

	@media (max-width: 768px) {
		h1 { font-size: 22px; }
		.section { max-width: 100%; }
		.comment-form { flex-wrap: wrap; }
		.comment-input { min-width: 0; }
	}
</style>
