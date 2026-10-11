import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fetchMyProfile } from '@/features/profiles/api';
import { supabase } from '@/services/supabase';
import type { Profile } from '@/types/database';

type AuthState = {
  // Oturum ve profil bilgisi ilk kez yüklenirken true.
  initializing: boolean;
  session: Session | null;
  // Oturum var ama profil henüz oluşturulmamışsa null (ilk kullanım akışı).
  profile: Profile | null;
  profileError: boolean;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: Profile) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileError, setProfileError] = useState(false);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setSessionLoaded(true));

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setProfileLoaded(true);
      return;
    }
    try {
      setProfile(await fetchMyProfile(userId));
      setProfileError(false);
    } catch {
      setProfileError(true);
    } finally {
      setProfileLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    setProfileLoaded(false);
    refreshProfile();
  }, [refreshProfile]);

  const value = useMemo<AuthState>(
    () => ({
      initializing: !sessionLoaded || (Boolean(userId) && !profileLoaded),
      session,
      profile: userId ? profile : null,
      profileError,
      refreshProfile,
      setProfile,
    }),
    [sessionLoaded, userId, profileLoaded, session, profile, profileError, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalı.');
  return context;
}

// Profil oluşturulmuş ekranlarda kullanılır; profil yoksa bu ekranlara
// yönlendirme zaten engellenir.
export function useMe(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error('Profil bulunamadı.');
  return profile;
}
