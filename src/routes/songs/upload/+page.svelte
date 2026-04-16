<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client.js';

	const session = authClient.useSession();

	let title = $state('');
	let artist = $state('');
	let bpm = $state(120);
	let audioFile: File | null = $state(null);
	let error = $state('');
	let uploading = $state(false);

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		audioFile = input.files?.[0] ?? null;
	}

	async function handleSubmit() {
		if (!audioFile) {
			error = 'Please select an audio file';
			return;
		}
		error = '';
		uploading = true;

		try {
			const formData = new FormData();
			formData.append('title', title);
			formData.append('artist', artist);
			formData.append('bpm', String(bpm));
			formData.append('audio', audioFile);

			const res = await fetch('/api/songs', { method: 'POST', body: formData });

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				error = data.message ?? 'Upload failed';
				return;
			}

			const song = await res.json();
			goto(`/editor/new?songId=${song.id}`);
		} finally {
			uploading = false;
		}
	}
</script>

<div class="upload-page">
	{#if !$session.data}
		<h1>LOGIN REQUIRED</h1>
		<p class="hint">You must be logged in to upload songs.</p>
		<a href="/auth" class="btn">LOGIN / SIGN UP</a>
	{:else}
		<h1>UPLOAD SONG</h1>

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			<label>
				<span>Title</span>
				<input type="text" bind:value={title} required />
			</label>
			<label>
				<span>Artist</span>
				<input type="text" bind:value={artist} required />
			</label>
			<label>
				<span>BPM</span>
				<input type="number" bind:value={bpm} min="40" max="300" required />
			</label>
			<label>
				<span>Audio File</span>
				<input type="file" accept="audio/*" onchange={handleFileChange} required />
			</label>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<button type="submit" disabled={uploading}>
				{uploading ? 'UPLOADING...' : 'UPLOAD & CREATE CHART'}
			</button>
		</form>
	{/if}

	<a href="/songs" class="back-link">&larr; Back to Songs</a>
</div>

<style>
	.upload-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: #0a0a0f;
		color: #fff;
		padding: 48px 24px;
		gap: 24px;
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
		gap: 14px;
		width: 320px;
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

	input[type="text"],
	input[type="number"] {
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

	input[type="file"] {
		font-family: monospace;
		font-size: 13px;
		color: #888;
	}

	button[type="submit"] {
		font-family: monospace;
		font-size: 16px;
		padding: 12px;
		background: transparent;
		border: 2px solid #44ff66;
		color: #44ff66;
		cursor: pointer;
		letter-spacing: 2px;
		margin-top: 8px;
	}

	button:hover { background: #44ff6620; }
	button:disabled { opacity: 0.5; cursor: not-allowed; }

	.error {
		color: #ff4444;
		font-size: 13px;
		margin: 0;
	}

	.hint {
		color: #555;
		font-size: 14px;
	}

	.btn {
		font-family: monospace;
		font-size: 16px;
		padding: 10px 32px;
		background: transparent;
		border: 2px solid #4488ff;
		color: #4488ff;
		text-decoration: none;
		letter-spacing: 2px;
	}

	.btn:hover { background: #4488ff20; }

	.back-link {
		font-family: monospace;
		color: #555;
		font-size: 14px;
		text-decoration: none;
	}

	.back-link:hover { color: #888; }
</style>
