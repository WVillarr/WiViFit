import { desc, eq, inArray } from 'drizzle-orm';
import { useCallback, useEffect, useState } from 'react';

import { useCatalogDb } from './catalog-client';
import { exercises, ExerciseListItem } from './catalog-schema';
import { favorites, recentlyViewed } from './user-schema';
import { useUserDb } from './user-client';

/** Recently viewed keeps this many rows; older ones are pruned on insert. */
const RECENT_LIMIT = 20;
/** Shown on Home — a short shelf, not a full history. */
const HOME_ROW_LIMIT = 10;

const LIST_COLUMNS = { id: exercises.id, name: exercises.name, target: exercises.target };

/**
 * user.db only knows exercise ids; the name/target shown in a row lives in
 * catalog.db. Two small queries and a JS join keep that boundary intact
 * without reaching for `ATTACH DATABASE`, which Fase 2's heavier
 * cross-database queries (a PR against a catalog exercise) will justify.
 */
async function hydrate(
  catalogDb: ReturnType<typeof useCatalogDb>,
  orderedIds: string[],
): Promise<ExerciseListItem[]> {
  if (orderedIds.length === 0) return [];
  const rows = await catalogDb
    .select(LIST_COLUMNS)
    .from(exercises)
    .where(inArray(exercises.id, orderedIds));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return orderedIds.map((id) => byId.get(id)).filter((r): r is ExerciseListItem => r != null);
}

export function useFavorites() {
  const userDb = useUserDb();
  const catalogDb = useCatalogDb();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<ExerciseListItem[]>([]);

  const reload = useCallback(() => {
    userDb
      .select({ exerciseId: favorites.exerciseId })
      .from(favorites)
      .orderBy(desc(favorites.createdAt))
      .then(async (rows) => {
        const orderedIds = rows.map((r) => r.exerciseId);
        setIds(new Set(orderedIds));
        setItems(await hydrate(catalogDb, orderedIds));
      })
      .catch((err) => console.error('[favorites] load failed', err));
  }, [userDb, catalogDb]);

  useEffect(reload, [reload]);

  const toggle = useCallback(
    (exerciseId: string) => {
      const isFavorite = ids.has(exerciseId);
      const query = isFavorite
        ? userDb.delete(favorites).where(eq(favorites.exerciseId, exerciseId))
        : userDb.insert(favorites).values({ exerciseId, createdAt: new Date().toISOString() });
      query.then(reload).catch((err) => console.error('[favorites] toggle failed', err));
    },
    [ids, userDb, reload],
  );

  return { ids, items, isFavorite: (id: string) => ids.has(id), toggle };
}

/** Records a view and returns the shelf to show on Home. Fire-and-forget writer. */
export function useRecentlyViewed() {
  const userDb = useUserDb();
  const catalogDb = useCatalogDb();
  const [items, setItems] = useState<ExerciseListItem[]>([]);

  useEffect(() => {
    userDb
      .select({ exerciseId: recentlyViewed.exerciseId })
      .from(recentlyViewed)
      .orderBy(desc(recentlyViewed.viewedAt))
      .limit(HOME_ROW_LIMIT)
      .then(async (rows) => setItems(await hydrate(catalogDb, rows.map((r) => r.exerciseId))))
      .catch((err) => console.error('[recentlyViewed] load failed', err));
  }, [userDb, catalogDb]);

  return items;
}

/**
 * Upserts the view and prunes down to RECENT_LIMIT. Call once per detail
 * screen visit — not from a render path, since every call writes.
 */
export function recordView(userDb: ReturnType<typeof useUserDb>, exerciseId: string) {
  userDb
    .insert(recentlyViewed)
    .values({ exerciseId, viewedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: recentlyViewed.exerciseId,
      set: { viewedAt: new Date().toISOString() },
    })
    .then(() =>
      userDb
        .select({ exerciseId: recentlyViewed.exerciseId })
        .from(recentlyViewed)
        .orderBy(desc(recentlyViewed.viewedAt)),
    )
    .then((rows) => {
      const stale = rows.slice(RECENT_LIMIT).map((r) => r.exerciseId);
      if (stale.length === 0) return;
      return userDb.delete(recentlyViewed).where(inArray(recentlyViewed.exerciseId, stale));
    })
    .catch((err) => console.error('[recentlyViewed] record failed', err));
}
