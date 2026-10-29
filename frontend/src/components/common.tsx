import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import type { Resources } from '../api/types';
import { nameOf, t } from '../i18n';
import { duration, fmt } from '../lib/format';
import { useServerNow } from '../state/game';

/** Odliczanie do chwili {@code until}; po dojsciu do zera wywoluje onDone (raz). */
export function Countdown({ until, onDone }: { until?: string; onDone?: () => void }) {
  const now = useServerNow();
  const fired = useRef(false);
  const target = until ? new Date(until).getTime() : 0;
  const left = Math.max(0, Math.round((target - now) / 1000));
  useEffect(() => {
    fired.current = false;
  }, [until]);
  useEffect(() => {
    if (until && left === 0 && !fired.current) {
      fired.current = true;
      // drobne opoznienie, aby serwer zdazyl obsluzyc zdarzenie
      const id = window.setTimeout(() => onDone?.(), 1200);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [left, until, onDone]);
  if (!until) return null;
  return <span className="countdown">{left > 0 ? duration(left) : '—'}</span>;
}

/** Koszt; surowce, ktorych brakuje, oznaczone na czerwono. */
export function Cost({ cost, have }: { cost: Resources; have?: Resources | null }) {
  const part = (key: keyof Resources) => {
    if (!cost[key]) return null;
    const missing = have ? have[key] < cost[key] : false;
    return (
      <span key={key} className={`cost-item ${missing ? 'missing' : ''}`}>
        {t(`res.${key}`)}: <b>{fmt(cost[key])}</b>
      </span>
    );
  };
  return <span className="cost">{(['metal', 'crystal', 'tritium'] as const).map(part)}</span>;
}

/** Lista niespelnionych wymagan w formacie backendu "building:klucz:poziom". */
export function MissingRequirements({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;
  return (
    <div className="requirements">
      {t('common.requirements')}:{' '}
      {missing.map((m, i) => {
        const [, key, level] = m.split(':');
        return (
          <span key={m} className="req-missing">
            {nameOf(key)} ({t('common.level').toLowerCase()} {level}){i < missing.length - 1 ? ', ' : ''}
          </span>
        );
      })}
    </div>
  );
}

export function Panel({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {title && <h2 className="panel-title">{title}</h2>}
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return (
    <div className="notice error" role="alert">
      {error}
    </div>
  );
}

export function InfoBox({ children }: { children: ReactNode }) {
  return <div className="notice info">{children}</div>;
}

export function Loading() {
  return <div className="loading">{t('common.loading')}</div>;
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Wczytanie danych strony z mozliwoscia ponowienia. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);
  const reload = useCallback(async () => {
    try {
      const d = await load();
      setData(d);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

/** Wykonanie akcji z blokada przycisku i komunikatem bledu. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const run = useCallback(async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      if (success) setMessage(success);
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, message, run, setError, setMessage };
}

export function SuccessBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="notice success">{message}</div>;
}
