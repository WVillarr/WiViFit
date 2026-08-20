import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';

import { useUserDb } from '@/db/user-client';

import { syncNow } from './sync-now';

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
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    if (!userDb || !enabled) return;

    syncNow(userDb).catch((err) => console.error('[sync] initial sync failed', err));

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = Boolean(state.isConnected && state.isInternetReachable !== false);
      const justReconnected = wasConnected.current === false && isConnected;
      wasConnected.current = isConnected;
      if (justReconnected) {
        syncNow(userDb).catch((err) => console.error('[sync] sync on reconnect failed', err));
      }
    });

    const interval = setInterval(() => {
      syncNow(userDb).catch((err) => console.error('[sync] periodic sync failed', err));
    }, FALLBACK_POLL_MS);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [enabled, userDb]);
}
