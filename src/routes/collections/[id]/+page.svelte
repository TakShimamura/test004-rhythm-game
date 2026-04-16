<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { authClient } from '$lib/auth-client.js';

	type CollectionItem = {
		chartId: string;
		addedAt: string;
		difficulty: string;
		songId: string;
		songTitle: string;
		songArtist: string;
		bpm: number;
	};

	type CollectionDetail = {
		id: string;
		name: string;
		description: string | null;
		isPublic: boolean;
		userId: string;
		ownerName: string;
		items: CollectionItem[];
	};

	let collectionId = $derived($page.params.id);
	const session = authClient.useSession();
	let collection: CollectionDetail | null = $state(null);
	let loading = $state(true);
	let addChartId = $state('');
	let adding = $state(false);

	let isOwner = $derived(
		Boolean($session.data && collection && $session.data.user.id === (collection as CollectionDetail).userId),
	);

	onMount(async () => {
		const res = await fetch(`/api/collections/${collectionId}`);
		if (res.ok) collection = await res.json();
		loading = false;
	});

	async function addChart() {
		if (!addChartId.trim() || !collection) return;
		adding = true;

		const res = await fetch(`/api/collections/${collectionId}/items`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chartId: addChartId.trim() }),
		});

		if (res.ok) {
			// Refresh collection
			const refreshRes = await fetch(`/api/collections/${collectionId}`);
			if (refreshRes.ok) collection = await refreshRes.json();
			addChartId = '';
		}

		adding = false;
	}

	async function removeChart(chartId: string) {
		if (!collection) return;

		const res = await fetch(`/api/collections/${collectionId}/items/${chartId}`, {
			method: 'DELETE',
		});

		if (res.ok && collection) {
			collection = {
				...collection,
				items: collection.items.filter((i) => i.chartId !== chartId),
			};
		}
	}
</script>

<div class="detail-page">
	{#if loading}
		<p class="hint">Loading...</p>
	{:else if !collection}
		<p class="hint">Collection not found</p>
	{:else}
		<h1>{collection.name}</h1>
		<div class="meta">
			<span class="owner">by {collection.ownerName}</span>
			<span class="badge" class:private={!collection.isPublic}>
				{collection.isPublic ? 'PUBLIC' : 'PRIVATE'}
			</span>
		</div>
		{#if collection.description}
			<p class="description">{collection.description}</p>
		{/if}

		{#if isOwner}
			<form class="add-form" onsubmit={(e) => { e.preventDefault(); addChart(); }}>
				<input
					type="text"
					placeholder="Chart ID to add"
					bind:value={addChartId}
					class="form-input"
				/>
				<button type="submit" class="add-btn" disabled={adding || !addChartId.trim()}>
					ADD
				</button>
			</form>
		{/if}

		{#if collection.items.length === 0}
			<p class="hint">No charts in this collection yet.</p>
		{:else}
			<div class="items-list">
				{#each collection.items as item}
					<div class="item-card">
						<div class="item-info">
							<span class="item-title">{item.songTitle}</span>
							<span class="item-artist">{item.songArtist}</span>
						</div>
						<div class="item-right">
							<span class="item-diff">{item.difficulty.toUpperCase()}</span>
							<span class="item-bpm">{item.bpm} BPM</span>
							<a href="/play?chart={item.chartId}" class="play-link">PLAY</a>
							<a href="/charts/{item.chartId}" class="detail-link">INFO</a>
							{#if isOwner}
								<button class="remove-btn" onclick={() => removeChart(item.chartId)}>
									&times;
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	<a href="/collections" class="back-link">&larr; Back to Collections</a>
</div>

<style>
	.detail-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 100vh;
		background: #0a0a0f;
		color: #fff;
		padding: 48px 24px;
		gap: 16px;
		font-family: monospace;
	}

	h1 {
		font-size: 28px;
		letter-spacing: 3px;
		margin: 0;
	}

	.meta {
		display: flex;
		gap: 10px;
		align-items: center;
		font-size: 13px;
	}

	.owner { color: #888; }

	.badge {
		font-size: 9px;
		letter-spacing: 1px;
		padding: 2px 6px;
		border: 1px solid #44ff6640;
		color: #44ff66;
	}

	.badge.private {
		border-color: #ff446640;
		color: #ff4466;
	}

	.description {
		color: #777;
		font-size: 13px;
		margin: 0;
		max-width: 500px;
		text-align: center;
	}

	.add-form {
		display: flex;
		gap: 6px;
		width: 100%;
		max-width: 400px;
	}

	.form-input {
		flex: 1;
		background: #111;
		border: 1px solid #333;
		color: #fff;
		padding: 8px 12px;
		font-family: monospace;
		font-size: 13px;
	}

	.form-input:focus { outline: none; border-color: #4488ff; }

	.add-btn {
		font-family: monospace;
		font-size: 12px;
		padding: 8px 14px;
		background: transparent;
		border: 1px solid #44ff66;
		color: #44ff66;
		cursor: pointer;
	}

	.add-btn:hover:not(:disabled) { background: #44ff6620; }
	.add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.items-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
		max-width: 500px;
	}

	.item-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 14px;
		background: #111;
		border: 1px solid #222;
		gap: 12px;
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.item-title {
		font-size: 14px;
		font-weight: bold;
		color: #ddd;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-artist {
		font-size: 11px;
		color: #666;
	}

	.item-right {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-shrink: 0;
	}

	.item-diff {
		font-size: 10px;
		color: #4488ff;
		letter-spacing: 1px;
	}

	.item-bpm {
		font-size: 10px;
		color: #555;
	}

	.play-link, .detail-link {
		font-family: monospace;
		font-size: 10px;
		padding: 3px 8px;
		border: 1px solid #333;
		text-decoration: none;
		color: #4488ff;
		letter-spacing: 1px;
	}

	.play-link:hover, .detail-link:hover {
		border-color: #4488ff;
		background: #4488ff20;
	}

	.detail-link {
		color: #888;
	}

	.detail-link:hover {
		border-color: #888;
		background: #88888820;
	}

	.remove-btn {
		font-family: monospace;
		font-size: 16px;
		background: transparent;
		border: 1px solid #ff446640;
		color: #ff4466;
		cursor: pointer;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.remove-btn:hover {
		background: #ff446620;
		border-color: #ff4466;
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
		margin-top: 16px;
	}

	.back-link:hover { color: #888; }

	@media (max-width: 768px) {
		h1 { font-size: 22px; }
		.items-list, .add-form { max-width: 100%; }
		.item-card { flex-direction: column; align-items: flex-start; }
		.item-right { flex-wrap: wrap; }
	}
</style>
