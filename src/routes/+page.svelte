<script lang="ts">
	import { authClient } from '$lib/auth-client.js';
	import { onMount } from 'svelte';

	const session = authClient.useSession();

	type DailyChallenge = {
		date: string;
		chartId: string;
		difficulty: string;
		songTitle: string;
		songArtist: string;
		bpm: number;
	};

	type DailyScore = {
		playerName: string;
		score: number;
		accuracy: number;
	};

	let daily: DailyChallenge | null = $state(null);
	let dailyTop: DailyScore[] = $state([]);

	onMount(async () => {
		const [challengeRes, lbRes] = await Promise.all([
			fetch('/api/daily-challenge'),
			fetch('/api/daily-challenge/leaderboard'),
		]);

		if (challengeRes.ok) {
			daily = await challengeRes.json();
		}
		if (lbRes.ok) {
			const all = await lbRes.json();
			dailyTop = all.slice(0, 3);
		}
	});
</script>

<div class="home">
	<div class="bg-grid"></div>
	<div class="content">
		<h1 class="title-glow">RHYTHM GAME</h1>
		<p class="subtitle">A keyboard rhythm game</p>
		<div class="keys-hint">
			<span class="key key-a">A</span>
			<span class="key key-s">S</span>
			<span class="key key-d">D</span>
		</div>
		<a href="/play" class="play-btn">PLAY DEMO</a>

		{#if daily}
			<div class="daily-widget">
				<div class="daily-header">DAILY CHALLENGE</div>
				<div class="daily-song">{daily.songTitle}</div>
				<div class="daily-meta">
					<span>{daily.difficulty.toUpperCase()}</span>
					<span>{daily.bpm} BPM</span>
				</div>
				<a href="/play?chart={daily.chartId}&daily=true" class="daily-btn">PLAY DAILY</a>
				{#if dailyTop.length > 0}
					<div class="daily-top">
						{#each dailyTop as entry, i}
							<div class="daily-top-row">
								<span class="daily-rank">#{i + 1}</span>
								<span class="daily-name">{entry.playerName}</span>
								<span class="daily-score">{entry.score.toLocaleString()}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<div class="nav-links">
			<a href="/songs" class="nav-link">SONGS</a>
			<a href="/leaderboard" class="nav-link">LEADERBOARD</a>
			<a href="/feed" class="nav-link">FEED</a>
			<a href="/profile" class="nav-link">PROFILE</a>
			<a href="/settings" class="nav-link">SETTINGS</a>
			{#if $session.data}
				<span class="user-info">Signed in as {$session.data.user.name}</span>
				<button class="nav-link" onclick={() => authClient.signOut().then(() => location.reload())}>LOGOUT</button>
			{:else}
				<a href="/auth" class="nav-link">LOGIN / SIGN UP</a>
			{/if}
		</div>
	</div>
</div>

<style>
	.home {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		overflow: hidden;
		color: #fff;
	}

	/* Animated gradient background */
	.home::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			135deg,
			#050510 0%,
			#0a0a2a 25%,
			#0a0518 50%,
			#0a1020 75%,
			#050510 100%
		);
		background-size: 400% 400%;
		animation: gradientShift 15s ease infinite;
		z-index: 0;
	}

	@keyframes gradientShift {
		0%, 100% { background-position: 0% 50%; }
		25% { background-position: 100% 0%; }
		50% { background-position: 100% 100%; }
		75% { background-position: 0% 100%; }
	}

	/* Subtle moving grid overlay */
	.bg-grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(68, 136, 255, 0.03) 1px, transparent 1px),
			linear-gradient(90deg, rgba(68, 136, 255, 0.03) 1px, transparent 1px);
		background-size: 60px 60px;
		animation: gridScroll 20s linear infinite;
		z-index: 1;
	}

	@keyframes gridScroll {
		from { transform: translateY(0); }
		to { transform: translateY(60px); }
	}

	.content {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	@keyframes titleGlow {
		0%, 100% {
			text-shadow:
				0 0 10px rgba(68, 136, 255, 0.3),
				0 0 30px rgba(68, 136, 255, 0.1);
		}
		50% {
			text-shadow:
				0 0 20px rgba(68, 136, 255, 0.6),
				0 0 50px rgba(68, 136, 255, 0.2),
				0 0 80px rgba(68, 136, 255, 0.1);
		}
	}

	.title-glow {
		animation: titleGlow 2.5s ease-in-out infinite;
	}

	h1 {
		font-family: monospace;
		font-size: 56px;
		letter-spacing: 10px;
		margin: 0;
	}

	.subtitle {
		font-family: monospace;
		color: #666;
		font-size: 16px;
	}

	.keys-hint {
		display: flex;
		gap: 12px;
		margin: 16px 0;
	}

	@keyframes keyPulse {
		0%, 100% {
			transform: scale(1);
			box-shadow: 0 0 8px var(--key-glow);
		}
		50% {
			transform: scale(1.06);
			box-shadow: 0 0 20px var(--key-glow);
		}
	}

	.key {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border: 2px solid #444;
		border-radius: 8px;
		font-family: monospace;
		font-size: 22px;
		font-weight: bold;
		animation: keyPulse 2s ease-in-out infinite;
		transition: transform 0.15s, box-shadow 0.15s;
	}

	.key:hover {
		transform: scale(1.15) !important;
	}

	.key-a {
		border-color: #ff4466;
		color: #ff4466;
		--key-glow: rgba(255, 68, 102, 0.25);
		animation-delay: 0s;
	}
	.key-s {
		border-color: #44ff66;
		color: #44ff66;
		--key-glow: rgba(68, 255, 102, 0.25);
		animation-delay: 0.3s;
	}
	.key-d {
		border-color: #4488ff;
		color: #4488ff;
		--key-glow: rgba(68, 136, 255, 0.25);
		animation-delay: 0.6s;
	}

	@keyframes btnGlow {
		0%, 100% {
			box-shadow: 0 0 8px rgba(68, 136, 255, 0.2);
		}
		50% {
			box-shadow: 0 0 24px rgba(68, 136, 255, 0.4), 0 0 48px rgba(68, 136, 255, 0.1);
		}
	}

	.play-btn {
		font-family: monospace;
		font-size: 20px;
		padding: 14px 40px;
		background: transparent;
		border: 2px solid #4488ff;
		color: #4488ff;
		cursor: pointer;
		letter-spacing: 3px;
		text-decoration: none;
		transition: background 0.2s, box-shadow 0.2s, transform 0.15s;
		animation: btnGlow 2.5s ease-in-out infinite;
	}

	.play-btn:hover {
		background: #4488ff20;
		box-shadow: 0 0 30px rgba(68, 136, 255, 0.4), 0 0 60px rgba(68, 136, 255, 0.15);
		transform: scale(1.04);
	}

	.nav-links {
		display: flex;
		gap: 16px;
		align-items: center;
		margin-top: 8px;
	}

	.nav-link {
		font-family: monospace;
		color: #555;
		font-size: 14px;
		text-decoration: none;
		letter-spacing: 2px;
		background: none;
		border: none;
		cursor: pointer;
		transition: color 0.2s, text-shadow 0.2s;
	}

	.nav-link:hover {
		color: #aaa;
		text-shadow: 0 0 10px rgba(170, 170, 170, 0.3);
	}

	.user-info {
		font-family: monospace;
		color: #44ff66;
		font-size: 13px;
		text-shadow: 0 0 8px rgba(68, 255, 102, 0.2);
	}

	/* Daily Challenge Widget */
	.daily-widget {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
		padding: 16px 24px;
		background: #111118;
		border: 1px solid #ffdd0044;
		max-width: 300px;
		width: 100%;
	}

	.daily-header {
		font-size: 11px;
		letter-spacing: 3px;
		color: #ffdd00;
	}

	.daily-song {
		font-size: 16px;
		color: #ddd;
	}

	.daily-meta {
		display: flex;
		gap: 12px;
		font-size: 11px;
		color: #666;
	}

	.daily-btn {
		font-family: monospace;
		font-size: 14px;
		padding: 8px 24px;
		background: transparent;
		border: 1px solid #ffdd00;
		color: #ffdd00;
		text-decoration: none;
		letter-spacing: 2px;
		transition: background 0.2s;
	}

	.daily-btn:hover {
		background: #ffdd0020;
	}

	.daily-top {
		width: 100%;
		margin-top: 4px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.daily-top-row {
		display: grid;
		grid-template-columns: 30px 1fr auto;
		font-size: 11px;
		padding: 3px 0;
		color: #888;
	}

	.daily-rank { color: #ffdd00; }
	.daily-name { color: #aaa; }
	.daily-score { color: #4488ff; }

	/* Mobile responsive */
	@media (max-width: 768px) {
		h1 {
			font-size: 32px;
			letter-spacing: 4px;
		}

		.subtitle {
			font-size: 13px;
		}

		.keys-hint {
			gap: 8px;
		}

		.key {
			width: 44px;
			height: 44px;
			font-size: 18px;
		}

		.nav-links {
			flex-direction: column;
			gap: 10px;
			align-items: center;
		}

		.play-btn {
			font-size: 16px;
			padding: 12px 28px;
		}

		.daily-widget {
			max-width: 90vw;
			padding: 12px 16px;
		}

		.content {
			padding: 0 16px;
		}
	}
</style>
