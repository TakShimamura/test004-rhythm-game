import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { chartComments, charts, user } from '$lib/server/db/schema.js';
import { auth } from '$lib/server/auth.js';
import { eq, asc } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	const chartId = params.id;

	const [chart] = await db
		.select({ id: charts.id })
		.from(charts)
		.where(eq(charts.id, chartId))
		.limit(1);

	if (!chart) throw error(404, 'Chart not found');

	const rows = await db
		.select({
			id: chartComments.id,
			text: chartComments.text,
			timestamp: chartComments.timestamp,
			createdAt: chartComments.createdAt,
			userName: user.name,
			userId: chartComments.userId,
		})
		.from(chartComments)
		.innerJoin(user, eq(user.id, chartComments.userId))
		.where(eq(chartComments.chartId, chartId))
		.orderBy(asc(chartComments.createdAt));

	return json(rows);
};

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Not authenticated');

	const chartId = params.id;
	const body = await request.json();
	const { text: commentText, timestamp } = body;

	if (!commentText || typeof commentText !== 'string' || commentText.trim().length === 0) {
		throw error(400, 'Comment text is required');
	}

	const [chart] = await db
		.select({ id: charts.id })
		.from(charts)
		.where(eq(charts.id, chartId))
		.limit(1);

	if (!chart) throw error(404, 'Chart not found');

	const [comment] = await db
		.insert(chartComments)
		.values({
			userId: session.user.id,
			chartId,
			text: commentText.trim(),
			timestamp: typeof timestamp === 'number' ? timestamp : null,
		})
		.returning();

	return json({ ...comment, userName: session.user.name }, { status: 201 });
};
