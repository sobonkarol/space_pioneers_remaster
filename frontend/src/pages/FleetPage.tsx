import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { DispatchInfo, FleetEstimate, FleetMovement, Mission, Resources, UnionView } from '../api/types';
import { ErrorBox, Loading, Panel, SuccessBox, errorText, useAction, useLoad } from '../components/common';
import { FleetTable } from '../components/FleetTable';
import { nameOf, t } from '../i18n';
import { dateTime, duration, fmt, parseAmount } from '../lib/format';
import { useGame, useServerNow } from '../state/game';
import { useSession } from '../state/session';

const MISSIONS: Mission[] = ['ATTACK', 'TRANSPORT', 'DEPLOY', 'ESPIONAGE', 'COLONIZE', 'RECYCLE', 'HOLD', 'EXPEDITION'];
const SPEEDS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];

export function FleetPage() {
  const { planetId, profile, config } = useSession();
  const { refresh, overview } = useGame();
  const pid = planetId ?? profile?.homePlanetId;
  const [params] = useSearchParams();
  const dispatch = useLoad(() => api.get<DispatchInfo>(`/planets/${pid}/fleet-dispatch`), [pid]);
  const movements = useLoad(() => api.get<FleetMovement[]>('/fleets'), []);
  const unions = useLoad(() => api.get<UnionView[]>('/unions'), []);
  const action = useAction();
  const now = useServerNow();

  const [selected, setSelected] = useState<Record<string, string>>({});
  const [target, setTarget] = useState(params.get('target') ?? '');
  const [targetMoon, setTargetMoon] = useState(params.get('moon') === '1');
  const [mission, setMission] = useState<Mission>((params.get('mission') as Mission) ?? 'TRANSPORT');
  const [speed, setSpeed] = useState(100);
  const [holdHours, setHoldHours] = useState(1);
  const [unionId, setUnionId] = useState<number | ''>('');
  const [cargo, setCargo] = useState<Record<keyof Resources, string>>({ metal: '', crystal: '', tritium: '' });
  const [estimate, setEstimate] = useState<FleetEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [invite, setInvite] = useState<Record<number, string>>({});

  // wstepny wybor statkow z galaktyki (np. sondy do szpiegowania)
  useEffect(() => {
    const preset = params.get('ships');
    if (preset && dispatch.data) {
      const next: Record<string, string> = {};
      for (const part of preset.split(',')) {
        const [k, v] = part.split(':');
        const available = dispatch.data.ships[k] ?? 0;
        if (available > 0) next[k] = String(Math.min(available, Number(v) || 1));
      }
      setSelected(next);
    }
  }, [params, dispatch.data]);

  const ships = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(selected)) {
      const n = parseAmount(v);
      if (n > 0) out[k] = n;
    }
    return out;
  }, [selected]);

  const cargoValue: Resources = {
    metal: parseAmount(cargo.metal),
    crystal: parseAmount(cargo.crystal),
    tritium: parseAmount(cargo.tritium),
  };

  useEffect(() => {
    setEstimate(null);
    setEstimateError(null);
    if (Object.keys(ships).length === 0 || !/^\d+:\d+:\d+$/.test(target.trim())) return;
    const id = window.setTimeout(async () => {
      try {
        setEstimate(await api.post<FleetEstimate>('/fleets/estimate', { planetId: pid, ships, target: target.trim(), speedPercent: speed }));
      } catch (e) {
        setEstimateError(errorText(e));
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [ships, target, speed, pid]);

  if (dispatch.loading && !dispatch.data) return <Loading />;
  const info = dispatch.data;
  const deepSpace = (config?.universe.positions ?? 15) + 1;

  const reloadAll = async () => {
    await Promise.all([dispatch.reload(), movements.reload(), unions.reload(), refresh()]);
  };

  const send = async () => {
    const ok = await action.run(
      () =>
        api.post('/fleets', {
          planetId: pid,
          ships,
          target: target.trim(),
          mission,
          speedPercent: speed,
          cargo: cargoValue,
          targetMoon,
          unionId: mission === 'ATTACK' && unionId !== '' ? unionId : null,
          holdHours: mission === 'HOLD' || mission === 'EXPEDITION' ? holdHours : null,
        }),
      t('fleet.sent'),
    );
    if (ok) {
      setSelected({});
      setCargo({ metal: '', crystal: '', tritium: '' });
      await reloadAll();
    }
  };

  const recall = async (id: number) => {
    await action.run(() => api.post(`/fleets/${id}/recall`));
    await reloadAll();
  };

  const createUnion = async (id: number) => {
    await action.run(() => api.post(`/fleets/${id}/union`, { name: '' }));
    await reloadAll();
  };

  const fillCargo = () => {
    if (!info || !estimate) return;
    let free = estimate.capacity;
    const res = { ...info.resources, tritium: Math.max(0, info.resources.tritium - estimate.fuel) };
    const take = (k: keyof Resources) => {
      const v = Math.min(free, Math.floor(res[k]));
      free -= v;
      return v;
    };
    const m = take('metal');
    const c = take('crystal');
    const tr = take('tritium');
    setCargo({ metal: String(m), crystal: String(c), tritium: String(tr) });
  };

  const shipKeys = info ? Object.keys(info.ships) : [];
  const cargoTotal = cargoValue.metal + cargoValue.crystal + cargoValue.tritium;
  const hold = mission === 'HOLD' || mission === 'EXPEDITION' ? (holdHours * 3600) / (config?.universe.fleetSpeed ?? 1) : 0;
  const arrival = estimate ? new Date(now + estimate.durationSeconds * 1000) : null;
  const returning = estimate ? new Date(now + (estimate.durationSeconds * 2 + hold) * 1000) : null;
  const matchingUnions = (unions.data ?? []).filter((u) => u.target === target.trim() && u.targetMoon === targetMoon);
  const canCarry = mission !== 'ESPIONAGE' && mission !== 'RECYCLE' && mission !== 'EXPEDITION';
  const moonAllowed = mission !== 'COLONIZE' && mission !== 'RECYCLE' && mission !== 'EXPEDITION';

  return (
    <div className="fleet-page">
      <ErrorBox error={dispatch.error ?? action.error} />
      <SuccessBox message={action.message} />
      <Panel title={t('fleet.movements')}>
        <FleetTable fleets={movements.data ?? []} onRecall={recall} onUnion={createUnion} onEvent={() => void reloadAll()} busy={action.busy} />
      </Panel>

      {(unions.data ?? []).length > 0 && (
        <Panel title={t('fleet.unions')}>
          <table className="data-table">
            <tbody>
              {(unions.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.name}</b> — [{u.target}]{u.targetMoon ? ` (${t('galaxy.moon')})` : ''} · {u.ownerName}
                    <div className="muted small">
                      {t('fleet.unionArrival')}: {dateTime(u.arriveAt)} · {t('fleet.unionFleets', { n: u.fleets })}
                      {u.invited.length > 0 && <> · {t('fleet.unionInvited', { names: u.invited.join(', ') })}</>}
                    </div>
                  </td>
                  <td className="right">
                    {u.own ? (
                      <span className="inline-form">
                        <input
                          value={invite[u.id] ?? ''}
                          placeholder={t('fleet.invitePlaceholder')}
                          onChange={(e) => setInvite((x) => ({ ...x, [u.id]: e.target.value }))}
                          aria-label={t('fleet.invite')}
                        />
                        <button
                          type="button"
                          className="btn small"
                          disabled={action.busy || !(invite[u.id] ?? '').trim()}
                          onClick={async () => {
                            await action.run(() => api.post(`/unions/${u.id}/invite`, { username: invite[u.id] }));
                            setInvite((x) => ({ ...x, [u.id]: '' }));
                            await unions.reload();
                          }}
                        >
                          {t('fleet.invite')}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => {
                          setTarget(u.target);
                          setTargetMoon(u.targetMoon);
                          setMission('ATTACK');
                          setUnionId(u.id);
                        }}
                      >
                        {t('fleet.next')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {info && (
        <Panel
          title={`${t('fleet.selectShips')} — ${t('fleet.slots', { used: info.slotsUsed, max: info.slotsMax })} · ${t('fleet.expeditions', {
            used: info.expeditionsUsed,
            max: info.expeditionsMax,
          })}`}
        >
          {shipKeys.length === 0 ? (
            <p className="muted">{t('fleet.noShips')}</p>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('common.name')}</th>
                    <th>{t('common.available')}</th>
                    <th>{t('shipyard.speed')}</th>
                    <th>{t('common.count')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shipKeys.map((k) => (
                    <tr key={k} data-key={k}>
                      <td>{nameOf(k)}</td>
                      <td>{fmt(info.ships[k])}</td>
                      <td>{fmt(info.speeds[k])}</td>
                      <td>
                        <input className="amount-input" inputMode="numeric" value={selected[k] ?? ''}
                          onChange={(e) => setSelected((s) => ({ ...s, [k]: e.target.value }))} aria-label={nameOf(k)} />
                        <button type="button" className="link-button small"
                          onClick={() => setSelected((s) => ({ ...s, [k]: String(info.ships[k]) }))}>
                          {t('common.max')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="button-row">
                <button type="button" className="link-button" onClick={() => setSelected(Object.fromEntries(shipKeys.map((k) => [k, String(info.ships[k])])))}>
                  {t('fleet.all')}
                </button>
                <button type="button" className="link-button" onClick={() => setSelected({})}>
                  {t('fleet.none')}
                </button>
              </div>
            </>
          )}
        </Panel>
      )}
      {info && Object.keys(ships).length > 0 && (
        <Panel title={t('fleet.target')}>
          <table className="data-table form-table">
            <tbody>
              <tr>
                <th>{t('fleet.target')}</th>
                <td>
                  <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="1:100:8" aria-label={t('fleet.target')} />
                  {moonAllowed && (
                    <select value={targetMoon ? 'moon' : 'planet'} onChange={(e) => setTargetMoon(e.target.value === 'moon')} aria-label={t('fleet.targetType')}>
                      <option value="planet">{t('fleet.planet')}</option>
                      <option value="moon">{t('fleet.moon')}</option>
                    </select>
                  )}
                  {mission === 'EXPEDITION' && <div className="muted small">{t('fleet.expeditionHint', { pos: deepSpace })}</div>}
                </td>
              </tr>
              <tr>
                <th>{t('fleet.mission')}</th>
                <td>
                  <select value={mission} onChange={(e) => setMission(e.target.value as Mission)} aria-label={t('fleet.mission')}>
                    {MISSIONS.map((m) => (
                      <option key={m} value={m}>
                        {t(`mission.${m}`)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
              {mission === 'ATTACK' && matchingUnions.length > 0 && (
                <tr>
                  <th>{t('fleet.union')}</th>
                  <td>
                    <select value={unionId} onChange={(e) => setUnionId(e.target.value === '' ? '' : Number(e.target.value))} aria-label={t('fleet.union')}>
                      <option value="">{t('fleet.unionNone')}</option>
                      {matchingUnions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({dateTime(u.arriveAt)})
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              )}
              {(mission === 'HOLD' || mission === 'EXPEDITION') && (
                <tr>
                  <th>{t('fleet.holdHours')}</th>
                  <td>
                    <select value={holdHours} onChange={(e) => setHoldHours(Number(e.target.value))} aria-label={t('fleet.holdHours')}>
                      {Array.from({ length: mission === 'HOLD' ? 32 : 8 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              )}
              <tr>
                <th>{t('fleet.speed')}</th>
                <td>
                  <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label={t('fleet.speed')}>
                    {SPEEDS.map((s) => (
                      <option key={s} value={s}>
                        {s}%
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
              {canCarry && (
                <tr>
                  <th>{t('fleet.cargo')}</th>
                  <td className="cargo-inputs">
                    {(['metal', 'crystal', 'tritium'] as const).map((k) => (
                      <label key={k}>
                        {t(`res.${k}`)}
                        <input className="amount-input" inputMode="numeric" value={cargo[k]}
                          onChange={(e) => setCargo((c) => ({ ...c, [k]: e.target.value }))} />
                      </label>
                    ))}
                    <button type="button" className="link-button small" onClick={fillCargo} disabled={!estimate}>
                      {t('fleet.maxCargo')}
                    </button>
                  </td>
                </tr>
              )}
              {estimate && (
                <>
                  <tr>
                    <th>{t('fleet.distance')}</th>
                    <td>{fmt(estimate.distance)}</td>
                  </tr>
                  <tr>
                    <th>{t('fleet.flightTime')}</th>
                    <td>{duration(estimate.durationSeconds)}</td>
                  </tr>
                  <tr>
                    <th>{t('fleet.arrival')}</th>
                    <td>{arrival && dateTime(arrival)}</td>
                  </tr>
                  <tr>
                    <th>{t('fleet.return')}</th>
                    <td>{returning && dateTime(returning)}</td>
                  </tr>
                  <tr>
                    <th>{t('fleet.fuel')}</th>
                    <td className={info.resources.tritium < estimate.fuel + cargoValue.tritium ? 'negative' : ''}>{fmt(estimate.fuel)}</td>
                  </tr>
                  <tr>
                    <th>{t('fleet.capacity')}</th>
                    <td className={cargoTotal > estimate.capacity ? 'negative' : ''}>
                      {fmt(cargoTotal)} / {fmt(estimate.capacity)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <ErrorBox error={estimateError} />
          <button type="button" className="btn primary" disabled={action.busy || !estimate} onClick={send}>
            {t('fleet.send')}
          </button>
        </Panel>
      )}
      {overview?.planet.moon && info && <JumpGatePanel moonId={overview.planet.id} ships={info.ships} onDone={reloadAll} />}
    </div>
  );
}

function JumpGatePanel({ moonId, ships, onDone }: { moonId: number; ships: Record<string, number>; onDone: () => Promise<void> }) {
  const { overview } = useGame();
  const action = useAction();
  const [to, setTo] = useState<number | ''>('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const moons = (overview?.planets ?? []).filter((p) => p.moon && p.id !== moonId);
  if (moons.length === 0) return null;
  const selection: Record<string, number> = {};
  for (const [k, v] of Object.entries(amounts)) {
    const n = parseAmount(v);
    if (n > 0) selection[k] = n;
  }
  return (
    <Panel title={t('jump.title')}>
      <ErrorBox error={action.error} />
      <SuccessBox message={action.message} />
      <div className="inline-form">
        <label>
          {t('jump.target')}
          <select value={to} onChange={(e) => setTo(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">—</option>
            {moons.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} [{m.coordinates}]
              </option>
            ))}
          </select>
        </label>
        {Object.keys(ships).map((k) => (
          <label key={k}>
            {nameOf(k)} ({fmt(ships[k])})
            <input className="amount-input" value={amounts[k] ?? ''} onChange={(e) => setAmounts((a) => ({ ...a, [k]: e.target.value }))} />
          </label>
        ))}
        <button
          type="button"
          className="btn"
          disabled={action.busy || to === '' || Object.keys(selection).length === 0}
          onClick={async () => {
            const ok = await action.run(() => api.post(`/planets/${moonId}/jump`, { toMoonId: to, ships: selection }), t('jump.done'));
            if (ok) {
              setAmounts({});
              await onDone();
            }
          }}
        >
          {t('jump.go')}
        </button>
      </div>
    </Panel>
  );
}
