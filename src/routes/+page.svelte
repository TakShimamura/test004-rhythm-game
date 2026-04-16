<script lang="ts">
	import { authClient } from '$lib/auth-client.js';

	const session = authClient.useSession();
</script>

<div class="home">
	<h1>RHYTHM GAME</h1>
	<p class="subtitle">A keyboard rhythm game</p>
	<div class="keys-hint">
		<span class="key key-a">A</span>
		<span class="key key-s">S</span>
		<span class="key key-d">D</span>
	</div>
	<a href="/play" class="play-btn">PLAY DEMO</a>
	<div class="nav-links">
		<a href="/songs" class="nav-link">SONGS</a>
		<a href="/settings" class="nav-link">SETTINGS</a>
		{#if $session.data}
			<span class="user-info">Signed in as {$session.data.user.name}</span>
			<button class="nav-link" onclick={() => authClient.signOut().then(() => location.reload())}>LOGOUT</button>
		{:else}
			<a href="/auth" class="nav-link">LOGIN / SIGN UP</a>
		{/if}
	</div>
</div>

<style>
	.home {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		background: #0a0a0f;
		color: #fff;
		gap: 16px;
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
	}

	.key-a { border-color: #ff4466; color: #ff4466; }
	.key-s { border-color: #44ff66; color: #44ff66; }
	.key-d { border-color: #4488ff; color: #4488ff; }

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
		transition: background 0.2s;
	}

	.play-btn:hover {
		background: #4488ff20;
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
	}

	.nav-link:hover {
		color: #888;
	}

	.user-info {
		font-family: monospace;
		color: #44ff66;
		font-size: 13px;
	}
</style>
