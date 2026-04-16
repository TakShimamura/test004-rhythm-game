<script lang="ts">
	import { onMount } from 'svelte';
	import { authClient } from '$lib/auth-client.js';

	const session = authClient.useSession();

	type LeaderboardEntry = {
		userId: string;
		xp: number;
		level: number;
		totalPlays: number;
		playerName: string;
		playerImage: string | null;
	};

	let entries: LeaderboardEntry[] = $state([]);
	let loading = $state(true);

	onMount(async () => {
		const res = await fetch('/api/leaderboard');
		if (res.ok) {
			entries = await res.json();
		}
		loading = false;
	});
</script>

<div class="lb-page">
	<a href="/" class="back-link">&larr; BACK</a>
	<h1>GLOBAL LEADERBOARD</h1>
	<p class="subtitle">TOP 50 PLAYERS BY XP</p>

	{#if loading}
		<p class="hint">Loading...</p>
	{:else if entries.length === 0}
		<p class="hint">No players yet</p>
	{:else}
		<div class="lb-list">
			{#each entries as entry, i}
				{@const isMe = $session.data?.user.id === entry.userId}
				<a
					href="/profile?user={entry.userId}"
					class="lb-row"
					class:is-me={isMe}
				>
					<span class="rank" class:gold={i === 0} class:silver={i === 1} class:bronze={i === 2}>
						#{i + 1}
					</span>
					<span class="name">{entry.playerName}</span>
					<span class="level">LV.{entry.level}</span>
					<span class="xp">{entry.xp.toLocaleString()} XP</span>
					<span class="plays">{entry.totalPlays} plays</span>
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.lb-page {
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
		margin: 24px 0 4px;
	}

	.subtitle {
		color: #555;
		font-size: 12px;
		letter-spacing: 2px;
		margin: 0 0 24px;
	}

	.hint { color: #555; font-size: 14px; }

	.lb-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.lb-row {
		display: grid;
		grid-template-columns: 50px 2fr 0.8fr 1.2fr 1fr;
		align-items: center;
		gap: 8px;
		padding: 12px 14px;
		background: #111118;
		border: 1px solid #1a1a2e;
		text-decoration: none;
		color: #fff;
		font-size: 13px;
		transition: border-color 0.2s;
	}

	.lb-row:hover {
		border-color: #4488ff44;
	}

	.lb-row.is-me {
		border-color: #44ff6644;
		background: #44ff6608;
	}

	.rank {
		font-weight: bold;
		color: #666;
	}

	.rank.gold { color: #ffdd00; }
	.rank.silver { color: #c0c0c0; }
	.rank.bronze { color: #cd7f32; }

	.name { color: #ddd; }
	.level { color: #4488ff; font-size: 12px; }
	.xp { color: #ffdd00; text-align: right; }
	.plays { color: #666; text-align: right; font-size: 12px; }

	@media (max-width: 500px) {
		.lb-row {
			grid-template-columns: 40px 1fr 1fr;
		}
		.level, .plays { display: none; }
	}
</style>
