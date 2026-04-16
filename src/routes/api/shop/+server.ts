import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { shopItems, userInventory } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });

	const items = await db.select().from(shopItems);

	let ownedItemIds: Set<string> = new Set();
	if (session) {
		const owned = await db
			.select({ itemId: userInventory.itemId })
			.from(userInventory)
			.where(eq(userInventory.userId, session.user.id));
		ownedItemIds = new Set(owned.map((o) => o.itemId));
	}

	const result = items.map((item) => ({
		...item,
		owned: ownedItemIds.has(item.itemId),
	}));

	return json(result);
};
