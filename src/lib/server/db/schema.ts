import { pgTable, uuid, text, integer, real, timestamp, jsonb, bigint, primaryKey, unique, boolean } from 'drizzle-orm/pg-core';
import { user } from './auth.schema.js';

export { user };

export const playerProfiles = pgTable('player_profiles', {
	userId: text('user_id').primaryKey().references(() => user.id),
	xp: integer('xp').default(0).notNull(),
	level: integer('level').default(1).notNull(),
	totalPlays: integer('total_plays').default(0).notNull(),
	totalPlayTimeMs: bigint('total_play_time_ms', { mode: 'number' }).default(0).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const achievements = pgTable('achievements', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id').references(() => user.id).notNull(),
	type: text('type').notNull(),
	unlockedAt: timestamp('unlocked_at', { withTimezone: true }).defaultNow().notNull(),
});

export const songs = pgTable('songs', {
	id: uuid('id').defaultRandom().primaryKey(),
	title: text('title').notNull(),
	artist: text('artist').notNull(),
	audioUrl: text('audio_url').notNull(),
	bpm: integer('bpm').notNull(),
	durationMs: integer('duration_ms').notNull(),
	uploadedBy: text('uploaded_by').references(() => user.id),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const charts = pgTable('charts', {
	id: uuid('id').defaultRandom().primaryKey(),
	songId: uuid('song_id').references(() => songs.id).notNull(),
	difficulty: text('difficulty').notNull(),
	notes: jsonb('notes').notNull(),
	createdBy: text('created_by').references(() => user.id),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const scores = pgTable('scores', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id').references(() => user.id).notNull(),
	chartId: uuid('chart_id').references(() => charts.id).notNull(),
	score: integer('score').notNull(),
	maxCombo: integer('max_combo').notNull(),
	accuracy: real('accuracy').notNull(),
	playedAt: timestamp('played_at', { withTimezone: true }).defaultNow().notNull(),
});

export const follows = pgTable('follows', {
	followerId: text('follower_id').references(() => user.id).notNull(),
	followingId: text('following_id').references(() => user.id).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	primaryKey({ columns: [table.followerId, table.followingId] }),
]);

export const chartRatings = pgTable('chart_ratings', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id').references(() => user.id).notNull(),
	chartId: uuid('chart_id').references(() => charts.id).notNull(),
	rating: integer('rating').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	unique('chart_ratings_user_chart').on(table.userId, table.chartId),
]);

export const dailyChallenges = pgTable('daily_challenges', {
	id: uuid('id').defaultRandom().primaryKey(),
	chartId: uuid('chart_id').references(() => charts.id).notNull(),
	date: text('date').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chartComments = pgTable('chart_comments', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id').references(() => user.id).notNull(),
	chartId: uuid('chart_id').references(() => charts.id).notNull(),
	text: text('text').notNull(),
	timestamp: real('timestamp'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chartCollections = pgTable('chart_collections', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id').references(() => user.id).notNull(),
	name: text('name').notNull(),
	description: text('description'),
	isPublic: boolean('is_public').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const collectionItems = pgTable('collection_items', {
	id: uuid('id').defaultRandom().primaryKey(),
	collectionId: uuid('collection_id').references(() => chartCollections.id).notNull(),
	chartId: uuid('chart_id').references(() => charts.id).notNull(),
	addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
});

export const replays = pgTable('replays', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id').references(() => user.id).notNull(),
	scoreId: uuid('score_id').references(() => scores.id).notNull(),
	chartId: uuid('chart_id').references(() => charts.id).notNull(),
	events: jsonb('events').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const featuredCharts = pgTable('featured_charts', {
	id: uuid('id').defaultRandom().primaryKey(),
	chartId: uuid('chart_id').references(() => charts.id).notNull(),
	featuredAt: timestamp('featured_at', { withTimezone: true }).defaultNow().notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const difficultyVotes = pgTable('difficulty_votes', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id').references(() => user.id).notNull(),
	chartId: uuid('chart_id').references(() => charts.id).notNull(),
	vote: text('vote').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	unique('difficulty_votes_user_chart').on(table.userId, table.chartId),
]);

export * from './auth.schema.js';
