import { useEffect, useMemo, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import type { FleetMovement, Overview } from '../api/types';
import { clockTime, duration } from '../lib/format';
import { useGame, useServerNow } from '../state/game';

const HOSTILE = new Set(['ATTACK', 'MISSILE']);

/** Obce floty lecace na planety gracza: ataki (w tym sojusznicze i rakiety) oraz sondy, najblizsze najpierw. */
export function incomingThreats(overview: Overview | null): { attacks: FleetMovement[]; spies: FleetMovement[] } {
  const foreign = (overview?.fleets ?? []).filter((f) => !f.own && f.status === 'OUTBOUND');
  const byArrival = (a: FleetMovement, b: FleetMovement) => a.arriveAt.localeCompare(b.arriveAt);
  return {
    attacks: foreign.filter((f) => HOSTILE.has(f.mission)).sort(byArrival),
    spies: foreign.filter((f) => f.mission === 'ESPIONAGE').sort(byArrival),
  };
}

function targetName(overview: Overview, f: FleetMovement): string {
  const p = overview.planets.find((x) => x.coordinates === f.target && x.moon === f.targetMoon);
  return p ? `${p.name} [${f.target}]` : `[${f.target}]${f.targetMoon ? ' (księżyc)' : ''}`;
}

/**
 * Alarm na kazdej stronie gry, gdy leci wroga flota: czerwony pasek z odliczaniem, znacznik w tytule karty.
 * Po czasie uderzenia przeglad jest odswiezany, zeby pasek zniknal i pojawil sie raport.
 */
export function AttackAlarm() {
  const { overview, refresh } = useGame();
  const now = useServerNow();
  const { attacks, spies } = useMemo(() => incomingThreats(overview), [overview]);
  const refreshedFor = useRef<string | null>(null);

  const first = attacks[0] ?? spies[0];
  const firstKey = first ? `${first.id}-${first.arriveAt}` : null;
  const arrived = first ? new Date(first.arriveAt).getTime() <= now - 2000 : false;
  useEffect(() => {
    if (arrived && firstKey && refreshedFor.current !== firstKey) {
      refreshedFor.current = firstKey;
      void refresh();
    }
  }, [arrived, firstKey, refresh]);

  // znacznik w tytule karty, widoczny takze gdy gra jest w tle
  useEffect(() => {
    const base = document.title.replace(/^⚠ (ATAK|Sondy)! /, '');
    document.title = attacks.length ? `⚠ ATAK! ${base}` : spies.length ? `⚠ Sondy! ${base}` : base;
    return () => {
      document.title = document.title.replace(/^⚠ (ATAK|Sondy)! /, '');
    };
  }, [attacks.length, spies.length]);

  if (!overview || (!attacks.length && !spies.length)) return null;

  const line = (f: FleetMovement, kind: 'attack' | 'spy') => {
    const at = new Date(f.arriveAt).getTime();
    const left = Math.max(0, Math.round((at - now) / 1000));
    const what =
      kind === 'spy' ? 'Sondy szpiegowskie' : f.mission === 'MISSILE' ? 'Rakiety międzyplanetarne' : f.unionId ? 'Atak sojuszniczy' : 'Wroga flota';
    return (
      <div key={`${f.id}-${f.arriveAt}`} className={`attack-alarm-line ${kind}`}>
        <b>{kind === 'attack' ? '⚠ ATAK!' : '⚠ Szpiegowanie'}</b> {what} gracza <b>{f.ownerName}</b> leci na{' '}
        {targetName(overview, f)}. Uderzenie za <b className="attack-countdown">{left > 0 ? duration(left) : 'chwilę'}</b>{' '}
        <span className="muted">(o {clockTime(new Date(at))})</span>
      </div>
    );
  };

  const shownAttacks = attacks.slice(0, 3);
  return (
    <div className={`attack-alarm ${attacks.length ? 'danger' : 'warning'}`} role="alert">
      {shownAttacks.map((f) => line(f, 'attack'))}
      {attacks.length > shownAttacks.length && (
        <div className="attack-alarm-line">i jeszcze {attacks.length - shownAttacks.length} kolejnych ataków</div>
      )}
      {spies.slice(0, attacks.length ? 1 : 3).map((f) => line(f, 'spy'))}
      <div className="attack-alarm-links">
        <NavLink to="/overview">Ruchy flot</NavLink> · <NavLink to="/fleet">Wyślij flotę</NavLink> ·{' '}
        <NavLink to="/defense">Obrona</NavLink>
      </div>
    </div>
  );
}
