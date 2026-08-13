import type { OutboxRow } from '@/db';

/**
 * The one seam between the outbox and whatever's on the other end of it.
 * `drain.ts` only depends on this interface, not on Supabase directly — so
 * the outbox is buildable and testable before a Supabase project exists.
 *
 * Wire the real implementation in once Fase 2's Supabase project + auth
 * exist (see docs/fase-2-guia.md §6): a `push(row)` that POSTs
 * `JSON.parse(row.payloadJson)` to the matching table, using the session
 * from supabase.auth.getSession(). Until then, `noRemoteConfigured` makes
 * every drain attempt a deliberate, visible no-op instead of a silent one.
 */
export interface SyncRemote {
  push(row: OutboxRow): Promise<void>;
}

let configuredRemote: SyncRemote | null = null;

export function setSyncRemote(remote: SyncRemote): void {
  configuredRemote = remote;
}

export function getSyncRemote(): SyncRemote | null {
  return configuredRemote;
}
