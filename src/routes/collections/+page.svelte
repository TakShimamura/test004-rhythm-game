<script lang="ts">
	import { onMount } from 'svelte';
	import { authClient } from '$lib/auth-client.js';

	type Collection = {
		id: string;
		name: string;
		description: string | null;
		isPublic: boolean;
		createdAt: string;
		itemCount: number;
	};

	const session = authClient.useSession();
	let collections: Collection[] = $state([]);
	let loading = $state(true);

	let showForm = $state(false);
	let newName = $state('');
	let newDesc = $state('');
	let newPublic = $state(true);
	let creating = $state(false);

	onMount(async () => {
		if (!$session.data) { loading = false; return; }
		const res = await fetch('/api/collections');
		if (res.ok) collections = await res.json();
		loading = false;
	});

	async function createCollection() {
		if (!newName.trim()) return;
		creating = true;

		const res = await fetch('/api/collections', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: newName.trim(),
				description: newDesc.trim() || undefined,
				isPublic: newPublic,
			}),
		});

		if (res.ok) {
			const col = await res.json();
			collections = [...collections, { ...col, itemCount: 0 }];
			newName = '';
			newDesc = '';
			newPublic = true;
			showForm = false;
		}

		creating = false;
	}
</script>

<div class="collections-page">
	<h1>COLLECTIONS</h1>

	{#if !$session.data}
		<p class="hint">Log in to create and manage collections.</p>
	{:else if loading}
		<p class="hint">Loading...</p>
	{:else}
		<button class="create-btn" onclick={() => (showForm = !showForm)}>
			{showForm ? 'CANCEL' : '+ NEW COLLECTION'}
		</button>

		{#if showForm}
			<form class="create-form" onsubmit={(e) => { e.preventDefault(); createCollection(); }}>
				<input
					type="text"
					placeholder="Collection name"
					bind:value={newName}
					class="form-input"
				/>
				<input
					type="text"
					placeholder="Description (optional)"
					bind:value={newDesc}
					class="form-input"
				/>
				<label class="public-toggle">
					<input type="checkbox" bind:checked={newPublic} />
					Public
				</label>
				<button type="submit" class="submit-btn" disabled={creating || !newName.trim()}>
					CREATE
				</button>
			</form>
		{/if}

		{#if collections.length === 0}
			<p class="hint">No collections yet. Create one to organize your favorite charts.</p>
		{:else}
			<div class="collection-list">
				{#each collections as col}
					<a href="/collections/{col.id}" class="collection-card">
						<div class="col-header">
							<span class="col-name">{col.name}</span>
							<span class="col-badge" class:private={!col.isPublic}>
								{col.isPublic ? 'PUBLIC' : 'PRIVATE'}
							</span>
						</div>
						{#if col.description}
							<p class="col-desc">{col.description}</p>
						{/if}
						<span class="col-count">{col.itemCount} chart{col.itemCount !== 1 ? 's' : ''}</span>
					</a>
				{/each}
			</div>
		{/if}
	{/if}

	<a href="/" class="back-link">&larr; Back to Home</a>
</div>

<style>
	.collections-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 100vh;
		background: #0a0a0f;
		color: #fff;
		padding: 48px 24px;
		gap: 20px;
		font-family: monospace;
	}

	h1 {
		font-size: 32px;
		letter-spacing: 6px;
		margin: 0;
	}

	.create-btn {
		font-family: monospace;
		font-size: 13px;
		padding: 8px 20px;
		background: transparent;
		border: 1px solid #44ff66;
		color: #44ff66;
		cursor: pointer;
		letter-spacing: 1px;
	}

	.create-btn:hover { background: #44ff6620; }

	.create-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
		max-width: 400px;
	}

	.form-input {
		background: #111;
		border: 1px solid #333;
		color: #fff;
		padding: 8px 12px;
		font-family: monospace;
		font-size: 13px;
	}

	.form-input:focus { outline: none; border-color: #4488ff; }

	.public-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		color: #888;
		font-size: 12px;
		cursor: pointer;
	}

	.submit-btn {
		font-family: monospace;
		font-size: 12px;
		padding: 8px 16px;
		background: transparent;
		border: 1px solid #4488ff;
		color: #4488ff;
		cursor: pointer;
		letter-spacing: 1px;
	}

	.submit-btn:hover:not(:disabled) { background: #4488ff20; }
	.submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.collection-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
		max-width: 400px;
	}

	.collection-card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px;
		background: #111;
		border: 1px solid #222;
		text-decoration: none;
		color: #fff;
		transition: border-color 0.2s;
	}

	.collection-card:hover { border-color: #4488ff; }

	.col-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.col-name {
		font-size: 15px;
		font-weight: bold;
	}

	.col-badge {
		font-size: 9px;
		letter-spacing: 1px;
		padding: 2px 6px;
		border: 1px solid #44ff6640;
		color: #44ff66;
	}

	.col-badge.private {
		border-color: #ff446640;
		color: #ff4466;
	}

	.col-desc {
		font-size: 12px;
		color: #777;
		margin: 0;
	}

	.col-count {
		font-size: 11px;
		color: #555;
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
		h1 { font-size: 24px; }
		.collection-list, .create-form { max-width: 100%; }
	}
</style>
