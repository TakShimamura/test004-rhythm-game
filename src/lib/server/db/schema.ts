import { pgTable, uuid, text, integer, real, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { user } from './auth.schema.js';

export { user };

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

export * from './auth.schema.js';
