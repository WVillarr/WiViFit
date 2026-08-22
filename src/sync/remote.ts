import { isNull } from 'drizzle-orm';
import type { SQLiteBindValue } from 'expo-sqlite';

import { getSession, isSupabaseConfigured } from '@/auth';
import type { UserDb } from '@/db/user-client';
import { outbox, type OutboxRow } from '@/db/user-schema';

const REMOTE_TABLES = [
  'routines',
  'routine_days',
  'routine_exercises',
  'workout_sessions',
  'session_sets',
  'personal_records',
] as const;

const LOCAL_COLUMNS: Record<(typeof REMOTE_TABLES)[number], string[]> = {
  routines: [
    'id',
    'name',
    'split_type',
    'days_per_week',
    'is_active',
    'source',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  routine_days: ['id', 'routine_id', 'day_index', 'name', 'budget_minutes', 'deleted_at'],
  routine_exercises: [
    'id',
    'routine_day_id',
    'exercise_id',
    'order_index',
    'target_sets',
    'rep_range_min',
    'rep_range_max',
    'target_duration_seconds',
    'target_distance_meters',
    'rest_seconds',
    'deleted_at',
  ],
  workout_sessions: [
    'id',
    'routine_day_id',
    'started_at',
    'ended_at',
    'total_volume_kg',
    'deleted_at',
  ],
  session_sets: [
    'id',
    'session_id',
    'exercise_id',
    'set_index',
    'weight_kg',
    'reps',
    'duration_seconds',
    'distance_meters',
    'is_warmup',
    'completed_at',
    'deleted_at',
  ],
  personal_records: [
    'id',
    'exercise_id',
    'type',
    'value',
    'context_weight_kg',
    'achieved_at',
    'session_set_id',
  ],
};

export type RemoteChange = {
  tableName: (typeof REMOTE_TABLES)[number];
  row: Record<string, unknown>;
};

export interface SyncRemote {
  push(row: OutboxRow): Promise<void>;
  pull?: () => Promise<RemoteChange[]>;
}

function snakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toSnakeRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [snakeCase(key), entry]));
}

function remoteTimestamp(payload: Record<string, unknown>, fallback: string): string {
  const value = payload.updatedAt ?? payload.createdAt ?? payload.deletedAt;
  return typeof value === 'string' ? value : fallback;
}

class SupabaseRemote implements SyncRemote {
  private async authorized(path: string, init: RequestInit = {}): Promise<Response> {
    const session = await getSession();
    if (!session) throw new Error('No hay una sesión de Supabase activa.');
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase no está configurado.');
    return fetch(`${url}${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  }

  async push(row: OutboxRow): Promise<void> {
    if (!REMOTE_TABLES.includes(row.tableName as (typeof REMOTE_TABLES)[number])) {
      throw new Error(`Tabla no permitida para sync: ${row.tableName}`);
    }
    const tableName = row.tableName as (typeof REMOTE_TABLES)[number];
    const session = await getSession();
    if (!session) throw new Error('No hay una sesión de Supabase activa.');
    const payload = JSON.parse(row.payloadJson) as Record<string, unknown>;
    const body = toSnakeRecord(payload);
    const updatedAt = remoteTimestamp(payload, row.createdAt);

    if (row.operation === 'insert') {
      body.user_id = session.user.id;
      body.updated_at = updatedAt;
      const response = await this.authorized(`/rest/v1/${tableName}`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(body),
      });
      if (!response.ok)
        throw new Error(`Supabase insert ${tableName} respondió ${response.status}`);
      return;
    }

    body.updated_at = updatedAt;
    const response = await this.authorized(
      `/rest/v1/${tableName}?id=eq.${encodeURIComponent(row.rowId)}&user_id=eq.${encodeURIComponent(session.user.id)}&updated_at=lt.${encodeURIComponent(updatedAt)}`,
      { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) },
    );
    if (!response.ok) throw new Error(`Supabase update ${tableName} respondió ${response.status}`);
  }

  async pull(): Promise<RemoteChange[]> {
    const session = await getSession();
    if (!session || !isSupabaseConfigured()) return [];
    const changes: RemoteChange[] = [];
    for (const tableName of REMOTE_TABLES) {
      const response = await this.authorized(
        `/rest/v1/${tableName}?select=*&user_id=eq.${encodeURIComponent(session.user.id)}`,
      );
      if (!response.ok) throw new Error(`Supabase pull ${tableName} respondió ${response.status}`);
      const rows = (await response.json()) as Record<string, unknown>[];
      rows.forEach((row) => changes.push({ tableName, row }));
    }
    return changes;
  }
}

let configuredRemote: SyncRemote | null = null;

export function createSupabaseRemote(): SyncRemote {
  return new SupabaseRemote();
}

export function setSyncRemote(remote: SyncRemote | null): void {
  configuredRemote = remote;
}

export function getSyncRemote(): SyncRemote | null {
  return configuredRemote;
}

/** Apply only rows that are not currently waiting in the local outbox. */
export async function applyRemoteChanges(userDb: UserDb, changes: RemoteChange[]): Promise<void> {
  const pending = await userDb.select().from(outbox).where(isNull(outbox.syncedAt));
  const pendingKeys = new Set(pending.map((row) => `${row.tableName}:${row.rowId}`));
  const client = userDb.$client;

  for (const change of changes) {
    const columns = LOCAL_COLUMNS[change.tableName];
    if (!columns || pendingKeys.has(`${change.tableName}:${String(change.row.id)}`)) continue;

    const values: SQLiteBindValue[] = columns.map((column) => {
      const value = change.row[column];
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? value
        : null;
    });
    const placeholders = columns.map(() => '?').join(', ');
    await client.runAsync(
      `INSERT OR REPLACE INTO ${change.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
      values,
    );
  }
}
