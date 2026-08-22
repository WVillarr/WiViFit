import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';

const SESSION_KEY = 'wivifit.supabase.session';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type AuthUser = {
  id: string;
  email?: string;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: AuthUser;
};

const listeners = new Set<() => void>();

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function requireConfig(): { url: string; key: string } {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return { url: supabaseUrl, key: supabaseAnonKey };
}

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const { url, key } = requireConfig();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body?.msg ??
      body?.error_description ??
      body?.message ??
      `Supabase respondió ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

async function saveSession(session: AuthSession | null): Promise<void> {
  if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
  listeners.forEach((listener) => listener());
}

async function readStoredSession(): Promise<AuthSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

async function refreshSession(session: AuthSession): Promise<AuthSession> {
  const next = await request<AuthSession>('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  const normalized = {
    ...next,
    expires_at: next.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
  };
  await saveSession(normalized);
  return normalized;
}

export async function getSession(): Promise<AuthSession | null> {
  if (!isSupabaseConfigured()) return null;
  const session = await readStoredSession();
  if (!session) return null;
  if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000) + 60) {
    try {
      return await refreshSession(session);
    } catch {
      await saveSession(null);
      return null;
    }
  }
  return session;
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const session = await request<AuthSession>('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const normalized = {
    ...session,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
  };
  await saveSession(normalized);
  return normalized;
}

export async function signUp(email: string, password: string): Promise<AuthSession | null> {
  const session = await request<AuthSession>('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (session.access_token) {
    const normalized = {
      ...session,
      expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    };
    await saveSession(normalized);
    return normalized;
  }
  return null;
}

export async function signOut(): Promise<void> {
  const session = await getSession();
  if (session && isSupabaseConfigured()) {
    await request('/auth/v1/logout', { method: 'POST' }, session.access_token).catch(() => {});
  }
  await saveSession(null);
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuthSession(): { session: AuthSession | null; loading: boolean } {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getSession()
        .then((next) => {
          if (!cancelled) {
            setSession(next);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    return subscribeAuth(load);
  }, []);

  return { session, loading };
}
