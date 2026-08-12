import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * user.db — created on-device, read-write, never replaced by an app update
 * (see openUserDb in user-client.ts for why it's a separate file from
 * catalog.db). First tables in it: everything else (routines, sessions, PRs)
 * still lands in Fase 2.
 *
 * No drizzle-kit migrations yet — with one table and no shipped schema to
 * outgrow, `ensureUserSchema`'s `CREATE TABLE IF NOT EXISTS` is the whole
 * migration story. Once this needs an actual ALTER, that's the signal to add
 * drizzle-kit rather than hand-roll a second one.
 */
export const favorites = sqliteTable('favorites', {
  exerciseId: text('exercise_id').primaryKey(),
  createdAt: text('created_at').notNull(),
});

export const recentlyViewed = sqliteTable('recently_viewed', {
  exerciseId: text('exercise_id').primaryKey(),
  viewedAt: text('viewed_at').notNull(),
});

export type FavoriteRow = typeof favorites.$inferSelect;
export type RecentlyViewedRow = typeof recentlyViewed.$inferSelect;
