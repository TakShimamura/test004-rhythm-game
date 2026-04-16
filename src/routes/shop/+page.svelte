<script lang="ts">
	import { authClient } from '$lib/auth-client.js';
	import { onMount } from 'svelte';

	const session = authClient.useSession();

	type ShopItem = {
		id: string;
		type: string;
		itemId: string;
		name: string;
		description: string | null;
		price: number;
		owned: boolean;
	};

	let items: ShopItem[] = $state([]);
	let balance = $state(0);
	let loading = $state(true);
	let purchasing = $state<string | null>(null);
	let confirmItem = $state<ShopItem | null>(null);
	let purchaseMessage = $state('');

	const CATEGORIES = ['theme', 'skin', 'effect', 'combo_color'] as const;
	const CATEGORY_LABELS: Record<string, string> = {
		theme: 'THEMES',
		skin: 'SKINS',
		effect: 'EFFECTS',
		combo_color: 'COMBO COLORS',
	};

	onMount(async () => {
		const [shopRes, profileRes] = await Promise.all([
			fetch('/api/shop'),
			$session.data ? fetch('/api/profile') : Promise.resolve(null),
		]);

		if (shopRes.ok) {
			items = await shopRes.json();
		}

		if (profileRes && profileRes.ok) {
			const data = await profileRes.json();
			balance = data.profile?.balance ?? 0;
		}

		loading = false;
	});

	function itemsByCategory(type: string): ShopItem[] {
		return items.filter((i) => i.type === type);
	}

	function openConfirm(item: ShopItem): void {
		confirmItem = item;
	}

	function closeConfirm(): void {
		confirmItem = null;
	}

	async function handlePurchase(): Promise<void> {
		if (!confirmItem) return;
		purchasing = confirmItem.itemId;
		purchaseMessage = '';

		const res = await fetch('/api/shop/purchase', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: confirmItem.itemId }),
		});

		if (res.ok) {
			const data = await res.json();
			balance = data.balance;
			items = items.map((i) =>
				i.itemId === confirmItem!.itemId ? { ...i, owned: true } : i,
			);
			purchaseMessage = `Purchased ${confirmItem.name}!`;
		} else {
			const err = await res.json().catch(() => ({ message: 'Purchase failed' }));
			purchaseMessage = err.message || 'Purchase failed';
		}

		purchasing = null;
		confirmItem = null;
		setTimeout(() => { purchaseMessage = ''; }, 3000);
	}
</script>

<div class="shop-page">
	<a href="/" class="back-link">&larr; BACK</a>

	<div class="shop-header">
		<h1>SHOP</h1>
		<div class="balance-display">
			<span class="coin-icon">&#9733;</span>
			<span class="balance-amount">{balance}</span>
		</div>
	</div>

	{#if purchaseMessage}
		<div class="purchase-toast">{purchaseMessage}</div>
	{/if}

	{#if !$session.data}
		<div class="center-msg">
			<p>You must be logged in to use the shop.</p>
			<a href="/auth" class="login-link">LOGIN / SIGN UP</a>
		</div>
	{:else if loading}
		<div class="center-msg"><p>Loading...</p></div>
	{:else}
		{#each CATEGORIES as cat}
			{@const catItems = itemsByCategory(cat)}
			{#if catItems.length > 0}
				<h2 class="category-title">{CATEGORY_LABELS[cat]}</h2>
				<div class="items-grid">
					{#each catItems as item}
						<div class="shop-card" class:owned={item.owned}>
							<div class="card-header">
								<span class="item-name">{item.name}</span>
								{#if item.owned}
									<span class="owned-badge">OWNED</span>
								{/if}
							</div>
							{#if item.description}
								<p class="item-desc">{item.description}</p>
							{/if}
							<div class="card-footer">
								<span class="item-price">
									<span class="coin-icon-sm">&#9733;</span> {item.price}
								</span>
								{#if item.owned}
									<span class="check-mark">&#10003;</span>
								{:else}
									<button
										class="buy-btn"
										disabled={balance < item.price || purchasing !== null}
										onclick={() => openConfirm(item)}
									>
										BUY
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/each}
	{/if}

	{#if confirmItem}
		<div class="confirm-overlay" onclick={closeConfirm} role="button" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && closeConfirm()}>
			<div class="confirm-dialog" onclick={(e) => e.stopPropagation()} role="dialog">
				<h3>CONFIRM PURCHASE</h3>
				<p>Buy <strong>{confirmItem.name}</strong> for <span class="coin-icon-sm">&#9733;</span> {confirmItem.price}?</p>
				<p class="confirm-balance">Balance after: {balance - confirmItem.price}</p>
				<div class="confirm-actions">
					<button class="confirm-btn" onclick={handlePurchase} disabled={purchasing !== null}>
						{purchasing ? 'BUYING...' : 'CONFIRM'}
					</button>
					<button class="cancel-btn" onclick={closeConfirm}>CANCEL</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.shop-page {
		min-height: 100vh;
		background: #0a0a0f;
		color: #fff;
		font-family: monospace;
		padding: 40px 24px;
		max-width: 900px;
		margin: 0 auto;
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

	.shop-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 24px;
		margin-bottom: 32px;
	}

	h1 {
		font-size: 32px;
		letter-spacing: 6px;
		margin: 0;
		text-shadow: 0 0 10px rgba(68, 136, 255, 0.3);
	}

	.balance-display {
		display: flex;
		align-items: center;
		gap: 8px;
		background: #111118;
		border: 1px solid #ffdd0044;
		padding: 10px 20px;
	}

	.coin-icon {
		font-size: 24px;
		color: #ffdd00;
		text-shadow: 0 0 8px rgba(255, 221, 0, 0.4);
	}

	.coin-icon-sm {
		font-size: 14px;
		color: #ffdd00;
	}

	.balance-amount {
		font-size: 24px;
		color: #ffdd00;
		font-weight: bold;
		letter-spacing: 2px;
	}

	.purchase-toast {
		text-align: center;
		padding: 10px;
		background: rgba(68, 255, 102, 0.1);
		border: 1px solid #44ff6644;
		color: #44ff66;
		font-size: 13px;
		letter-spacing: 1px;
		margin-bottom: 16px;
		animation: fadeIn 0.3s ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(-8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.center-msg {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 40vh;
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

	.category-title {
		font-size: 14px;
		letter-spacing: 3px;
		color: #4488ff;
		margin-top: 28px;
		margin-bottom: 12px;
		border-bottom: 1px solid #222;
		padding-bottom: 8px;
	}

	.items-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 12px;
	}

	.shop-card {
		background: #111118;
		border: 1px solid #222;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		transition: border-color 0.2s;
	}

	.shop-card:hover {
		border-color: #4488ff44;
	}

	.shop-card.owned {
		border-color: #44ff6633;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.item-name {
		font-size: 15px;
		color: #ddd;
		letter-spacing: 1px;
	}

	.owned-badge {
		font-size: 10px;
		color: #44ff66;
		background: rgba(68, 255, 102, 0.12);
		border: 1px solid rgba(68, 255, 102, 0.3);
		padding: 2px 8px;
		letter-spacing: 1px;
	}

	.item-desc {
		font-size: 11px;
		color: #666;
		margin: 0;
	}

	.card-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: auto;
	}

	.item-price {
		font-size: 14px;
		color: #ffdd00;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.check-mark {
		font-size: 20px;
		color: #44ff66;
		text-shadow: 0 0 8px rgba(68, 255, 102, 0.4);
	}

	.buy-btn {
		font-family: monospace;
		font-size: 12px;
		padding: 6px 16px;
		background: transparent;
		border: 1px solid #4488ff;
		color: #4488ff;
		cursor: pointer;
		letter-spacing: 2px;
		transition: background 0.2s;
	}

	.buy-btn:hover:not(:disabled) {
		background: #4488ff20;
	}

	.buy-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* Confirm dialog */
	.confirm-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		backdrop-filter: blur(4px);
	}

	.confirm-dialog {
		background: #111118;
		border: 1px solid #333;
		padding: 32px;
		max-width: 360px;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.confirm-dialog h3 {
		font-size: 16px;
		letter-spacing: 3px;
		color: #fff;
		margin: 0;
	}

	.confirm-dialog p {
		color: #aaa;
		font-size: 14px;
		margin: 0;
	}

	.confirm-balance {
		font-size: 12px;
		color: #666;
	}

	.confirm-actions {
		display: flex;
		gap: 12px;
		justify-content: center;
		margin-top: 8px;
	}

	.confirm-btn {
		font-family: monospace;
		font-size: 14px;
		padding: 8px 24px;
		background: transparent;
		border: 1px solid #44ff66;
		color: #44ff66;
		cursor: pointer;
		letter-spacing: 2px;
		transition: background 0.2s;
	}

	.confirm-btn:hover:not(:disabled) {
		background: #44ff6620;
	}

	.confirm-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.cancel-btn {
		font-family: monospace;
		font-size: 14px;
		padding: 8px 24px;
		background: transparent;
		border: 1px solid #666;
		color: #888;
		cursor: pointer;
		letter-spacing: 2px;
		transition: background 0.2s;
	}

	.cancel-btn:hover {
		background: rgba(136, 136, 136, 0.1);
	}

	@media (max-width: 768px) {
		.shop-page {
			padding: 24px 16px;
		}

		.items-grid {
			grid-template-columns: 1fr 1fr;
		}

		.shop-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 12px;
		}
	}
</style>
