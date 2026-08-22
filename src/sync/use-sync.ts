import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';

import { isSupabaseConfigured, useAuthSession } from '@/auth';
import { useUserDb } from '@/db/user-client';

import { drain } from './drain';
import { applyRemoteChanges, createSupabaseRemote, getSyncRemote, setSyncRemote } from './remote';

/** Belt-and-suspenders for the reconnect listener — catches a remote that recovered mid-outage. */
const FALLBACK_POLL_MS = 60_000;

/**
 * Drains the outbox whenever the device regains connectivity, plus a slow
 * poll as a fallback for the case where connectivity never toggles (e.g. the
 * remote was down while the device stayed "connected" the whole time).
 * Mount this once, near the root — not per-screen, or every screen with it
 * mounted would drain in parallel and race each other.
 */
export function useSyncOnReconnect(enabled = true): void {
  const userDb = useUserDb();
  const { session } = useAuthSession();
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    setSyncRemote(session && isSupabaseConfigured() ? createSupabaseRemote() : null);
    return () => setSyncRemote(null);
  }, [session]);

  useEffect(() => {
    if (!userDb) return;

    let syncing = false;
    const syncNow = async () => {
      const remote = getSyncRemote();
      if (!remote || syncing) return;
      syncing = true;
      try {
        await drain(userDb);
        if (remote.pull) await applyRemoteChanges(userDb, await remote.pull());
      } finally {
        syncing = false;
      }
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = Boolean(state.isConnected && state.isInternetReachable !== false);
      const justReconnected = wasConnected.current === false && isConnected;
      wasConnected.current = isConnected;
      if (justReconnected) {
        syncNow().catch((err) => console.error('[sync] sync on reconnect failed', err));
      }
    });

    syncNow().catch((err) => console.error('[sync] initial sync failed', err));

    const interval = setInterval(() => {
      syncNow().catch((err) => console.error('[sync] periodic sync failed', err));
    }, FALLBACK_POLL_MS);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [enabled, userDb]);
}
