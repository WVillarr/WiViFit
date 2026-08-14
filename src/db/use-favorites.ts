import { desc, eq, inArray } from 'drizzle-orm';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useCatalogDb } from './catalog-client';
import { exercises, ExerciseListItem } from './catalog-schema';
import { favorites, recentlyViewed } from './user-schema';
import { UserDb, useUserDb } from './user-client';

/** Recently viewed keeps this many rows; older ones are pruned on insert. */
const RECENT_LIMIT = 20;
/** Shown on Home — a short shelf, not a full history. */
const HOME_ROW_LIMIT = 10;

/**
 * Home and the detail screen each call useFavorites()/useRecentlyViewed()
 * independently, so a toggle on one screen has to reach the other — without
 * this, a favorite added on the detail screen never shows up in Home's shelf
 * for the rest of the session (worse with `enableFreeze(true)` in
 * _layout.tsx keeping Home mounted the whole time). A module-level revision
 * counter is the whole store: every write bumps it, every hook instance
 * subscribes via useSyncExternalStore and reloads when it changes. Anything
 * more than this is a state library for two booleans.
 */
let revision = 0;
const listeners = new Set<() => void>();
function bump() {
  revision++;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function useRevision() {
  return useSyncExternalStore(subscribe, () => revision);
}

const LIST_COLUMNS = {
  id: exercises.id,
  name: exercises.name,
  nameEs: exercises.nameEs,
  target: exercises.target,
};

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
  const storeRevision = useRevision();

  const reload = useCallback(() => {
    if (!userDb) return;
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

  // storeRevision isn't read in the body — it's here purely so a bump() from
  // any instance (this one or another screen's) re-runs the query.
  useEffect(reload, [reload, storeRevision]);

  const toggle = useCallback(
    (exerciseId: string) => {
      if (!userDb) return;
      const isFavorite = ids.has(exerciseId);
      const query = isFavorite
        ? userDb.delete(favorites).where(eq(favorites.exerciseId, exerciseId))
        : userDb.insert(favorites).values({ exerciseId, createdAt: new Date().toISOString() });
      query.then(bump).catch((err) => console.error('[favorites] toggle failed', err));
    },
    [ids, userDb],
  );

  return { ids, items, isFavorite: (id: string) => ids.has(id), toggle };
}

/** Returns the shelf to show on Home. recordView (below) is the writer. */
export function useRecentlyViewed() {
  const userDb = useUserDb();
  const catalogDb = useCatalogDb();
  const [items, setItems] = useState<ExerciseListItem[]>([]);
  const storeRevision = useRevision();

  useEffect(() => {
    if (!userDb) return;
    userDb
      .select({ exerciseId: recentlyViewed.exerciseId })
      .from(recentlyViewed)
      .orderBy(desc(recentlyViewed.viewedAt))
      .limit(HOME_ROW_LIMIT)
      .then(async (rows) => setItems(await hydrate(catalogDb, rows.map((r) => r.exerciseId))))
      .catch((err) => console.error('[recentlyViewed] load failed', err));
    // storeRevision isn't read above — see the comment on useFavorites' reload.
  }, [userDb, catalogDb, storeRevision]);

  return items;
}

/**
 * Upserts the view and prunes down to RECENT_LIMIT. Call once per detail
 * screen visit — not from a render path, since every call writes. A no-op
 * while `userDb` is still opening; the caller re-runs this on every render
 * anyway (see exercise/[id].tsx), so the write lands once it resolves.
 */
export function recordView(userDb: UserDb | null, exerciseId: string) {
  if (!userDb) return;
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
    .then(bump)
    .catch((err) => console.error('[recentlyViewed] record failed', err));
}
