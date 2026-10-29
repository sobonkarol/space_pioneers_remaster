import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../api/client';
import type { AuthResponse, GameConfig, Profile } from '../api/types';
import { setLanguage } from '../i18n';

interface SessionValue {
  profile: Profile | null;
  config: GameConfig | null;
  ready: boolean;
  planetId: number | null;
  setPlanetId: (id: number) => void;
  login: (login: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);
const PLANET_KEY = 'sp.planet';

function storedPlanet(): number | null {
  try {
    const v = localStorage.getItem(PLANET_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [planetId, setPlanetIdState] = useState<number | null>(storedPlanet());

  const setPlanetId = useCallback((id: number) => {
    setPlanetIdState(id);
    try {
      localStorage.setItem(PLANET_KEY, String(id));
    } catch {
      // ignorujemy
    }
  }, []);

  const applyAuth = useCallback(
    (auth: AuthResponse) => {
      setToken(auth.token);
      setProfile(auth.profile);
      setLanguage('pl'); // gra jest w wersji polskiej
      setPlanetId(auth.profile.homePlanetId);
    },
    [setPlanetId],
  );

  const reloadProfile = useCallback(async () => {
    const p = await api.get<Profile>('/me');
    setProfile(p);
    setLanguage('pl');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setProfile(null);
    });
    const init = async () => {
      try {
        setConfig(await api.get<GameConfig>('/config'));
      } catch {
        // konfiguracja zostanie pobrana ponownie po zalogowaniu
      }
      if (getToken()) {
        try {
          await reloadProfile();
        } catch {
          setToken(null);
        }
      }
      setReady(true);
    };
    void init();
    return () => setUnauthorizedHandler(null);
  }, [reloadProfile]);

  const login = useCallback(
    async (loginName: string, password: string) => {
      applyAuth(await api.post<AuthResponse>('/auth/login', { login: loginName, password }));
      if (!config) setConfig(await api.get<GameConfig>('/config'));
    },
    [applyAuth, config],
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      applyAuth(await api.post<AuthResponse>('/auth/register', { username, email, password }));
      if (!config) setConfig(await api.get<GameConfig>('/config'));
    },
    [applyAuth, config],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // wylogowanie lokalne nastepuje niezaleznie od odpowiedzi
    }
    setToken(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ profile, config, ready, planetId, setPlanetId, login, register, logout, reloadProfile }),
    [profile, config, ready, planetId, setPlanetId, login, register, logout, reloadProfile],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession poza SessionProvider');
  return ctx;
}
