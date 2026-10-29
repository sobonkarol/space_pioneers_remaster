import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client';
import type { Resources, UnitDef } from '../api/types';
import { ErrorBox, Panel, useAction } from '../components/common';
import { nameOf, t } from '../i18n';
import { fmt } from '../lib/format';
import { useSession } from '../state/session';

export interface SimSide {
  units: Record<string, number>;
  weapons: number;
  shielding: number;
  armour: number;
  attackBonusPercent: number;
}

interface SimResult {
  runs: number;
  attackerWins: number;
  defenderWins: number;
  draws: number;
  averageRounds: number;
  attackerSurvivors: Record<string, number>;
  defenderSurvivors: Record<string, number>;
  attackerLoss: Resources;
  defenderLoss: Resources;
  debris: Resources;
  moonChancePercent: number;
  recyclersNeeded: number;
}

/** Stan przekazywany z raportu szpiegowskiego: obrona i flota celu. */
export interface SimulatorPrefill {
  defender: SimSide;
  target?: string;
}

const empty = (): SimSide => ({ units: {}, weapons: 0, shielding: 0, armour: 0, attackBonusPercent: 0 });

function SideForm({ title, side, onChange, units, onOwn }: {
  title: string;
  side: SimSide;
  onChange: (s: SimSide) => void;
  units: UnitDef[];
  onOwn?: () => void;
}) {
  const tech = (key: 'weapons' | 'shielding' | 'armour' | 'attackBonusPercent', label: string, max: number) => (
    <label key={key}>
      {label}
      <input className="amount-input" inputMode="numeric" value={side[key]} aria-label={`${title} ${label}`}
        onChange={(e) => onChange({ ...side, [key]: Math.max(0, Math.min(max, Number(e.target.value.replace(/\D/g, '')) || 0)) })} />
    </label>
  );
  return (
    <Panel title={title}>
      <div className="sim-tech">
        {tech('weapons', nameOf('weapons_tech'), 50)}
        {tech('shielding', nameOf('shielding_tech'), 50)}
        {tech('armour', nameOf('armour_tech'), 50)}
        {tech('attackBonusPercent', t('sim.bonus'), 50)}
        {onOwn && (
          <button type="button" className="link-button small" onClick={onOwn}>{t('sim.own')}</button>
        )}
      </div>
      <table className="data-table">
        <tbody>
          {units.map((u) => (
            <tr key={u.key} data-key={u.key}>
              <td>{nameOf(u.key)}</td>
              <td className="right">
                <input className="amount-input" inputMode="numeric" value={side.units[u.key] ?? ''} aria-label={`${title} ${nameOf(u.key)}`}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/\D/g, '')) || 0;
                    const next = { ...side.units };
                    if (v > 0) next[u.key] = v;
                    else delete next[u.key];
                    onChange({ ...side, units: next });
                  }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="link-button small" onClick={() => onChange({ ...side, units: {} })}>{t('sim.clear')}</button>
    </Panel>
  );
}

function Survivors({ start, after }: { start: Record<string, number>; after: Record<string, number> }) {
  const keys = Object.keys(start);
  if (keys.length === 0) return <p className="muted">{t('common.none')}</p>;
  return (
    <table className="data-table">
      <tbody>
        {keys.map((k) => (
          <tr key={k}>
            <td>{nameOf(k)}</td>
            <td className="right">{fmt(start[k])}</td>
            <td className="right">→ {(after[k] ?? 0).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Symulator walki - te same zasady co bitwa w grze, powtorzone wielokrotnie. */
export function SimulatorPage() {
  const { config } = useSession();
  const location = useLocation();
  const prefill = location.state as SimulatorPrefill | null;
  const [attacker, setAttacker] = useState<SimSide>(empty);
  const [defender, setDefender] = useState<SimSide>(() => prefill?.defender ?? empty());
  const [runs, setRuns] = useState(20);
  const [result, setResult] = useState<SimResult | null>(null);
  const action = useAction();
  const ships = config?.ships ?? [];
  const defenses = [...ships, ...(config?.defenses ?? [])];

  const own = async () => {
    const s = await api.get<SimSide>('/simulator/own');
    setAttacker((a) => ({ ...a, weapons: s.weapons, shielding: s.shielding, armour: s.armour, attackBonusPercent: s.attackBonusPercent }));
  };

  const run = async () => {
    let r: SimResult | null = null;
    const ok = await action.run(async () => {
      r = await api.post<SimResult>('/simulator', { attacker, defender, runs });
    });
    if (ok) setResult(r);
  };

  const loss = (r: Resources) => `${fmt(r.metal)} / ${fmt(r.crystal)} / ${fmt(r.tritium)}`;

  return (
    <div className="simulator-page">
      {prefill?.target && <p className="muted">{t('sim.fromReport', { coords: prefill.target })}</p>}
      <div className="sim-sides">
        <SideForm title={t('sim.attacker')} side={attacker} onChange={setAttacker} units={ships} onOwn={() => void own()} />
        <SideForm title={t('sim.defender')} side={defender} onChange={setDefender} units={defenses} />
      </div>
      <Panel title={t('sim.title')}>
        <div className="inline-form">
          <label>
            {t('sim.runs')}
            <select value={runs} onChange={(e) => setRuns(Number(e.target.value))} aria-label={t('sim.runs')}>
              {[1, 5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button type="button" className="btn primary" disabled={action.busy} onClick={run}>{t('sim.run')}</button>
        </div>
        <ErrorBox error={action.error} />
        {result && (
          <div className="sim-result">
            <p>
              {t('sim.outcome', {
                a: Math.round((result.attackerWins / result.runs) * 100),
                d: Math.round((result.defenderWins / result.runs) * 100),
                r: Math.round((result.draws / result.runs) * 100),
                rounds: result.averageRounds.toLocaleString('pl-PL', { maximumFractionDigits: 1 }),
              })}
            </p>
            <table className="data-table">
              <tbody>
                <tr><td>{t('sim.attackerLoss')}</td><td>{loss(result.attackerLoss)}</td></tr>
                <tr><td>{t('sim.defenderLoss')}</td><td>{loss(result.defenderLoss)}</td></tr>
                <tr><td>{t('sim.debris')}</td><td>{fmt(result.debris.metal)} / {fmt(result.debris.crystal)} ({t('sim.recyclers', { n: fmt(result.recyclersNeeded) })})</td></tr>
                <tr><td>{t('report.moonChance', { p: result.moonChancePercent })}</td><td /></tr>
              </tbody>
            </table>
            <div className="sim-sides">
              <div>
                <h4>{t('sim.attacker')}</h4>
                <Survivors start={attacker.units} after={result.attackerSurvivors} />
              </div>
              <div>
                <h4>{t('sim.defender')}</h4>
                <Survivors start={defender.units} after={result.defenderSurvivors} />
              </div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
