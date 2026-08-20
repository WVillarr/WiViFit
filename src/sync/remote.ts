import type { OutboxRow } from '@/db';

export type RemoteChange = {
  tableName: string;
  row: Record<string, unknown>;
};

/**
 * The one seam between the outbox and whatever's on the other end of it.
 * `drain.ts` only depends on this interface, not on Supabase directly — so
 * the outbox is buildable and testable before a Supabase project exists.
 *
 * `SupabaseRemote` is the production implementation. Until a Supabase
 * project is configured, `noRemoteConfigured` makes every drain attempt a
 * deliberate, visible no-op instead of a silent one.
 */
export interface SyncRemote {
  push(row: OutboxRow): Promise<void>;
  pull?(since: string | null): Promise<RemoteChange[]>;
}

let configuredRemote: SyncRemote | null = null;

export function setSyncRemote(remote: SyncRemote | null): void {
  configuredRemote = remote;
}

export function getSyncRemote(): SyncRemote | null {
  return configuredRemote;
}
