import { useState } from 'react';
import { api } from '../api/client';
import type { UnitOption } from '../api/types';
import { ItemImage } from '../components/AssetImage';
import { Cost, Countdown, ErrorBox, Loading, MissingRequirements, Panel, SuccessBox, useAction, useLoad } from '../components/common';
import { describe, nameOf, t } from '../i18n';
import { duration, fmt, parseAmount } from '../lib/format';
import { useGame } from '../state/game';
import { useSession } from '../state/session';

export function ShipyardPage({ type }: { type: 'SHIP' | 'DEFENSE' }) {
  const { planetId, profile } = useSession();
  const { overview, refresh } = useGame();
  const pid = planetId ?? profile?.homePlanetId;
  const { data, error, loading, reload } = useLoad(
    () => api.get<UnitOption[]>(`/planets/${pid}/shipyard?type=${type}`),
    [pid, type],
  );
  const action = useAction();
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  if (loading && !data) return <Loading />;
  const have = overview?.resources.amount ?? null;
  const queue = overview?.shipyardQueue ?? [];
  const after = async () => {
    await Promise.all([reload(), refresh()]);
  };

  const order = async (unit: string) => {
    const count = parseAmount(amounts[unit] ?? '');
    if (count <= 0) return;
    const ok = await action.run(() => api.post(`/planets/${pid}/shipyard`, { unit, count }), `${nameOf(unit)}: ${fmt(count)}`);
    if (ok) setAmounts((a) => ({ ...a, [unit]: '' }));
    await after();
  };

  const kind = type === 'SHIP' ? 'ship' : 'defense';

  return (
    <div className="shipyard-page">
      <ErrorBox error={error ?? action.error} />
      <SuccessBox message={action.message} />
      {queue.length > 0 && (
        <Panel title={t('shipyard.queue')}>
          <table className="data-table">
            <tbody>
              {queue.map((q, i) => (
                <tr key={q.id}>
                  <td>
                    <b>{nameOf(q.unit)}</b> — {fmt(q.done)} / {fmt(q.count)}
                  </td>
                  <td>{i === 0 ? <Countdown until={q.finishAt} onDone={after} /> : <span className="muted">{t('build.waiting')}</span>}</td>
                  <td className="muted">
                    {duration(q.secondsPerUnit)} {t('shipyard.perUnit')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      <Panel title={type === 'SHIP' ? t('menu.shipyard') : t('menu.defense')}>
        <table className="data-table item-table">
          <tbody>
            {(data ?? []).map((u) => {
              const locked = u.missing.length > 0;
              return (
                <tr key={u.key} className={`item-row ${locked ? 'locked' : ''}`} data-key={u.key}>
                  <td className="item-image-cell">
                    <ItemImage kind={kind} itemKey={u.key} size={100} />
                  </td>
                  <td className="item-info">
                    <div className="item-title">
                      <b>{nameOf(u.key)}</b>
                      <span className="item-level"> ({t('common.available')}: {fmt(u.available)})</span>
                      {u.branch !== 'NONE' && <span className="branch-tag">{t(`settings.branch.${u.branch}`)}</span>}
                    </div>
                    <div className="item-desc">{describe(u.key)}</div>
                    <div className="unit-stats muted small">
                      {t('shipyard.attack')} {fmt(u.attack)} · {t('shipyard.shield')} {fmt(u.shield)} · {t('shipyard.hull')} {fmt(u.hull)}
                      {type === 'SHIP' && u.cargo > 0 && <> · {t('shipyard.cargo')} {fmt(u.cargo)}</>}
                      {type === 'SHIP' && u.speed > 0 && <> · {t('shipyard.speed')} {fmt(u.speed)}</>}
                    </div>
                    {!locked && (
                      <>
                        <div className="item-cost">
                          {t('common.cost')}: <Cost cost={u.cost} have={have} />
                        </div>
                        <div className="item-time">
                          {t('common.time')}: {duration(u.secondsPerUnit)} {t('shipyard.perUnit')}
                        </div>
                      </>
                    )}
                    <MissingRequirements missing={u.missing} />
                  </td>
                  <td className="item-action">
                    {!locked &&
                      (u.blocker ? (
                        <span className="blocker">{t(`blocker.${u.blocker}`)}</span>
                      ) : (
                        <div className="order-box">
                          <input
                            className="amount-input"
                            inputMode="numeric"
                            value={amounts[u.key] ?? ''}
                            placeholder="0"
                            onChange={(e) => setAmounts((a) => ({ ...a, [u.key]: e.target.value }))}
                            aria-label={`${t('common.count')} ${nameOf(u.key)}`}
                          />
                          <button
                            type="button"
                            className="link-button small"
                            onClick={() => setAmounts((a) => ({ ...a, [u.key]: String(u.maxBuildable) }))}
                          >
                            {t('common.max')} ({fmt(u.maxBuildable)})
                          </button>
                          <button
                            type="button"
                            className="btn primary"
                            disabled={action.busy || parseAmount(amounts[u.key] ?? '') <= 0}
                            onClick={() => order(u.key)}
                          >
                            {t('shipyard.order')}
                          </button>
                        </div>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
