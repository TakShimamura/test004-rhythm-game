<script lang="ts">
	import { authClient } from '$lib/auth-client.js';
	import { goto } from '$app/navigation';

	let mode: 'login' | 'signup' = $state('login');
	let email = $state('');
	let password = $state('');
	let name = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit() {
		error = '';
		loading = true;
		try {
			if (mode === 'signup') {
				const result = await authClient.signUp.email({ email, password, name });
				if (result.error) {
					error = result.error.message ?? 'Signup failed';
					return;
				}
			} else {
				const result = await authClient.signIn.email({ email, password });
				if (result.error) {
					error = result.error.message ?? 'Login failed';
					return;
				}
			}
			goto('/');
		} finally {
			loading = false;
		}
	}

	function toggleMode() {
		mode = mode === 'login' ? 'signup' : 'login';
		error = '';
	}
</script>

<div class="auth-page">
	<h1>{mode === 'login' ? 'LOGIN' : 'SIGN UP'}</h1>

	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
		{#if mode === 'signup'}
			<label>
				<span>Name</span>
				<input type="text" bind:value={name} required />
			</label>
		{/if}
		<label>
			<span>Email</span>
			<input type="email" bind:value={email} required />
		</label>
		<label>
			<span>Password</span>
			<input type="password" bind:value={password} required minlength="8" />
		</label>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<button type="submit" disabled={loading}>
			{loading ? '...' : mode === 'login' ? 'LOGIN' : 'SIGN UP'}
		</button>
	</form>

	<button class="toggle" onclick={toggleMode}>
		{mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Login'}
	</button>

	<a href="/" class="back-link">&larr; Back to Home</a>
</div>

<style>
	.auth-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: #0a0a0f;
		color: #fff;
		gap: 20px;
		font-family: monospace;
	}

	h1 {
		font-size: 36px;
		letter-spacing: 6px;
		margin: 0;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 300px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	label span {
		font-size: 12px;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	input {
		background: #111;
		border: 1px solid #333;
		color: #fff;
		padding: 10px 12px;
		font-family: monospace;
		font-size: 14px;
	}

	input:focus {
		outline: none;
		border-color: #4488ff;
	}

	button[type="submit"] {
		font-family: monospace;
		font-size: 16px;
		padding: 10px;
		background: transparent;
		border: 2px solid #4488ff;
		color: #4488ff;
		cursor: pointer;
		letter-spacing: 2px;
		margin-top: 8px;
	}

	button[type="submit"]:hover { background: #4488ff20; }
	button[type="submit"]:disabled { opacity: 0.5; cursor: not-allowed; }

	.error {
		color: #ff4444;
		font-size: 13px;
		margin: 0;
	}

	.toggle {
		background: none;
		border: none;
		color: #666;
		cursor: pointer;
		font-family: monospace;
		font-size: 13px;
	}

	.toggle:hover { color: #aaa; }

	.back-link {
		font-family: monospace;
		color: #555;
		font-size: 14px;
		text-decoration: none;
	}

	.back-link:hover { color: #888; }
</style>
