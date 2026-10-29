import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api/client';
import type { Overview, Resources } from '../api/types';
import { useSession } from './session';

/**
 * Stan biezacej planety (przeglad) odswiezany cyklicznie, wspoldzielony przez pasek surowcow,
 * menu (licznik wiadomosci) i strony. Zawiera tez przesuniecie zegara serwera.
 */
interface GameValue {
  overview: Overview | null;
  error: string | null;
  refresh: () => Promise<void>;
  serverOffsetMs: number;
  /** Zasoby przeliczone lokalnie na biezaca sekunde (tylko do wyswietlania). */
  liveResources: (now: number) => Resources | null;
}

const GameContextReact = createContext<GameValue | null>(null);
const REFRESH_MS = 30_000;

export function GameProvider({ children }: { children: ReactNode }) {
  const { planetId, setPlanetId, profile } = useSession();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const fetchedAt = useRef(0);

  const effectivePlanet = planetId ?? profile?.homePlanetId ?? null;

  const refresh = useCallback(async () => {
    if (!effectivePlanet) return;
    try {
      const o = await api.get<Overview>(`/planets/${effectivePlanet}/overview`);
      fetchedAt.current = Date.now();
      setServerOffsetMs(new Date(o.serverTime).getTime() - fetchedAt.current);
      setOverview(o);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404 && profile) {
        // planeta zostala porzucona albo nie nalezy do gracza - wracamy na macierzysta
        setPlanetId(profile.homePlanetId);
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [effectivePlanet, profile, setPlanetId]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const liveResources = useCallback(
    (now: number): Resources | null => {
      if (!overview) return null;
      const elapsedH = Math.max(0, now - fetchedAt.current) / 3_600_000;
      const r = overview.resources;
      const grow = (amount: number, perHour: number, cap: number) => {
        if (overview.vacation) return amount;
        if (perHour >= 0) return amount >= cap ? amount : Math.min(cap, amount + perHour * elapsedH);
        return Math.max(0, amount + perHour * elapsedH);
      };
      return {
        metal: grow(r.amount.metal, r.perHour.metal, r.capacity.metal),
        crystal: grow(r.amount.crystal, r.perHour.crystal, r.capacity.crystal),
        tritium: grow(r.amount.tritium, r.perHour.tritium, r.capacity.tritium),
      };
    },
    [overview],
  );

  const value = useMemo(
    () => ({ overview, error, refresh, serverOffsetMs, liveResources }),
    [overview, error, refresh, serverOffsetMs, liveResources],
  );
  return <GameContextReact.Provider value={value}>{children}</GameContextReact.Provider>;
}

export function useGame(): GameValue {
  const ctx = useContext(GameContextReact);
  if (!ctx) throw new Error('useGame poza GameProvider');
  return ctx;
}

/** Biezacy czas (ms) aktualizowany co sekunde, skorygowany o przesuniecie zegara serwera. */
export function useServerNow(): number {
  const { serverOffsetMs } = useGame();
  const [now, setNow] = useState(() => Date.now() + serverOffsetMs);
  useEffect(() => {
    setNow(Date.now() + serverOffsetMs);
    const id = window.setInterval(() => setNow(Date.now() + serverOffsetMs), 1000);
    return () => window.clearInterval(id);
  }, [serverOffsetMs]);
  return now;
}
