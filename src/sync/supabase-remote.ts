import type { SupabaseClient } from '@supabase/supabase-js';

import type { OutboxRow } from '@/db';

import type { RemoteChange, SyncRemote } from './remote';

const SYNC_TABLES = [
  'routines',
  'routine_days',
  'routine_exercises',
  'workout_sessions',
  'session_sets',
  'personal_records',
] as const;

function isSyncTable(value: string): value is (typeof SYNC_TABLES)[number] {
  return (SYNC_TABLES as readonly string[]).includes(value);
}

function snakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function toRemoteRow(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [snakeCase(key), item]));
}

function toLocalRow(value: Record<string, unknown>): Record<string, unknown> {
  const row = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [snakeToCamel(key), item]),
  );
  delete row.userId;
  return row;
}

function errorMessage(error: { message?: string } | null, fallback: string): string {
  return error?.message ? `${fallback}: ${error.message}` : fallback;
}

/**
 * Supabase transport for the local outbox. The server remains the conflict
 * arbiter: a newer remote `updated_at` wins, otherwise the local mutation is
 * accepted. RLS still scopes every request to the authenticated user.
 */
export class SupabaseRemote implements SyncRemote {
  constructor(private readonly client: SupabaseClient) {}

  private async userId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) throw new Error(errorMessage(error, 'No authenticated Supabase user'));
    return data.user.id;
  }

  async push(row: OutboxRow): Promise<void> {
    if (!isSyncTable(row.tableName)) return;

    const userId = await this.userId();
    const input = JSON.parse(row.payloadJson) as Record<string, unknown>;
    const payload: Record<string, unknown> = { ...toRemoteRow(input), user_id: userId };
    payload.updated_at ??= new Date().toISOString();

    const { data: current, error: readError } = await this.client
      .from(row.tableName)
      .select('id, updated_at')
      .eq('id', row.rowId)
      .maybeSingle();
    if (readError) throw new Error(errorMessage(readError, `Could not read ${row.tableName}`));

    if (current?.updated_at && String(current.updated_at) >= String(payload.updated_at)) return;

    if (row.operation === 'insert') {
      const { error } = await this.client.from(row.tableName).upsert(payload, { onConflict: 'id' });
      if (error) throw new Error(errorMessage(error, `Could not insert ${row.tableName}`));
      return;
    }

    const updatePayload =
      row.operation === 'delete'
        ? {
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_id: userId,
          }
        : payload;
    const { error } = await this.client
      .from(row.tableName)
      .update(updatePayload)
      .eq('id', row.rowId);
    if (error) throw new Error(errorMessage(error, `Could not update ${row.tableName}`));
  }

  async pull(since: string | null): Promise<RemoteChange[]> {
    const userId = await this.userId();
    const changes: RemoteChange[] = [];

    for (const tableName of SYNC_TABLES) {
      let query = this.client
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: true });
      if (since) query = query.gt('updated_at', since);

      const { data, error } = await query;
      if (error) throw new Error(errorMessage(error, `Could not pull ${tableName}`));
      for (const row of data ?? []) {
        changes.push({ tableName, row: toLocalRow(row as Record<string, unknown>) });
      }
    }

    return changes;
  }
}
