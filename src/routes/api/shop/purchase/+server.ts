import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { shopItems, userInventory, playerProfiles, currencyTransactions } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const { itemId } = await request.json();
	if (!itemId || typeof itemId !== 'string') {
		throw error(400, 'Missing itemId');
	}

	const userId = session.user.id;

	// Find the shop item
	const [item] = await db
		.select()
		.from(shopItems)
		.where(eq(shopItems.itemId, itemId))
		.limit(1);

	if (!item) throw error(404, 'Item not found');

	// Check if already owned
	const [alreadyOwned] = await db
		.select()
		.from(userInventory)
		.where(and(eq(userInventory.userId, userId), eq(userInventory.itemId, itemId)))
		.limit(1);

	if (alreadyOwned) throw error(409, 'Item already owned');

	// Check balance
	const [profile] = await db
		.select()
		.from(playerProfiles)
		.where(eq(playerProfiles.userId, userId))
		.limit(1);

	const balance = profile?.balance ?? 0;
	if (balance < item.price) throw error(400, 'Insufficient balance');

	// Deduct balance
	await db
		.update(playerProfiles)
		.set({
			balance: balance - item.price,
			updatedAt: new Date(),
		})
		.where(eq(playerProfiles.userId, userId));

	// Insert transaction
	await db.insert(currencyTransactions).values({
		userId,
		amount: -item.price,
		reason: 'purchase',
	});

	// Insert inventory
	await db.insert(userInventory).values({
		userId,
		itemId,
	});

	return json({ balance: balance - item.price });
};
