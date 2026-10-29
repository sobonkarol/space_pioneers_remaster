import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { DispatchInfo, FleetEstimate, FleetMovement, Mission, Resources } from '../api/types';
import { ErrorBox, Loading, Panel, SuccessBox, errorText, useAction, useLoad } from '../components/common';
import { FleetTable } from '../components/FleetTable';
import { nameOf, t } from '../i18n';
import { dateTime, duration, fmt, parseAmount } from '../lib/format';
import { useGame, useServerNow } from '../state/game';
import { useSession } from '../state/session';

const MISSIONS: Mission[] = ['ATTACK', 'TRANSPORT', 'DEPLOY', 'ESPIONAGE', 'COLONIZE', 'RECYCLE'];
const SPEEDS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];

export function FleetPage() {
  const { planetId, profile } = useSession();
  const { refresh } = useGame();
  const pid = planetId ?? profile?.homePlanetId;
  const [params] = useSearchParams();
  const dispatch = useLoad(() => api.get<DispatchInfo>(`/planets/${pid}/fleet-dispatch`), [pid]);
  const movements = useLoad(() => api.get<FleetMovement[]>('/fleets'), []);
  const action = useAction();
  const now = useServerNow();

  const [selected, setSelected] = useState<Record<string, string>>({});
  const [target, setTarget] = useState(params.get('target') ?? '');
  const [mission, setMission] = useState<Mission>((params.get('mission') as Mission) ?? 'TRANSPORT');
  const [speed, setSpeed] = useState(100);
  const [cargo, setCargo] = useState<Record<keyof Resources, string>>({ metal: '', crystal: '', tritium: '' });
  const [estimate, setEstimate] = useState<FleetEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);

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

  const send = async () => {
    const ok = await action.run(
      () => api.post('/fleets', { planetId: pid, ships, target: target.trim(), mission, speedPercent: speed, cargo: cargoValue }),
      t('fleet.sent'),
    );
    if (ok) {
      setSelected({});
      setCargo({ metal: '', crystal: '', tritium: '' });
      await Promise.all([dispatch.reload(), movements.reload(), refresh()]);
    }
  };

  const recall = async (id: number) => {
    await action.run(() => api.post(`/fleets/${id}/recall`));
    await Promise.all([movements.reload(), refresh()]);
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
  const arrival = estimate ? new Date(now + estimate.durationSeconds * 1000) : null;
  const returning = estimate ? new Date(now + estimate.durationSeconds * 2000) : null;

  return (
    <div className="fleet-page">
      <ErrorBox error={dispatch.error ?? action.error} />
      <SuccessBox message={action.message} />
      <Panel title={t('fleet.movements')}>
        <FleetTable fleets={movements.data ?? []} onRecall={recall} onEvent={() => void movements.reload()} busy={action.busy} />
      </Panel>
      {info && (
        <Panel title={`${t('fleet.selectShips')} — ${t('fleet.slots', { used: info.slotsUsed, max: info.slotsMax })}`}>
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
              {mission !== 'ESPIONAGE' && mission !== 'RECYCLE' && (
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
    </div>
  );
}
