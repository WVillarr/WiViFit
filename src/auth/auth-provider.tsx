import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { setSyncRemote, SupabaseRemote } from '@/sync';
import { supabase, supabaseConfigured } from '@/supabase/client';

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  signIn(email: string, password: string): Promise<{ error: Error | null }>;
  signUp(email: string, password: string): Promise<{ error: Error | null }>;
  signOut(): Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function asError(error: { message: string } | null): Error | null {
  return error ? new Error(error.message) : null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error('[auth] session load failed', error);
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setSyncRemote(session && supabase ? new SupabaseRemote(supabase) : null);
    return () => setSyncRemote(null);
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: supabaseConfigured,
      loading,
      session,
      async signIn(email, password) {
        if (!supabase) return { error: new Error('Supabase no está configurado') };
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return { error: asError(error) };
      },
      async signUp(email, password) {
        if (!supabase) return { error: new Error('Supabase no está configurado') };
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        return { error: asError(error) };
      },
      async signOut() {
        if (!supabase) return { error: null };
        const { error } = await supabase.auth.signOut();
        return { error: asError(error) };
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
