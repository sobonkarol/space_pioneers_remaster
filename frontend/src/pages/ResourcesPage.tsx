import { api } from '../api/client';
import type { ResourcesView } from '../api/types';
import { ErrorBox, Loading, Panel, useAction, useLoad } from '../components/common';
import { nameOf, t } from '../i18n';
import { fmt } from '../lib/format';
import { useGame } from '../state/game';
import { useSession } from '../state/session';

const PERCENTS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

export function ResourcesPage() {
  const { planetId, profile } = useSession();
  const { refresh } = useGame();
  const pid = planetId ?? profile?.homePlanetId;
  const view = useLoad(() => api.get<ResourcesView>(`/planets/${pid}/resources`), [pid]);
  const action = useAction();

  if (view.loading && !view.data) return <Loading />;
  const v = view.data;
  if (!v) return <ErrorBox error={view.error} />;

  const setPercent = async (source: string, percent: number) => {
    const ok = await action.run(async () => {
      view.setData(await api.put<ResourcesView>(`/planets/${pid}/production`, { source, percent }));
    });
    if (ok) await refresh();
  };

  const cell = (n: number) => <td className={`right ${n < 0 ? 'negative' : n > 0 ? 'positive' : ''}`}>{fmt(n)}</td>;

  return (
    <div className="resources-page">
      <ErrorBox error={view.error ?? action.error} />
      <Panel title={`${t('res.production')} — ${v.planet.name} [${v.planet.coordinates}]`}>
        <p>
          {t('res.efficiency')}: <b className={v.efficiency < 1 ? 'negative' : ''}>{Math.round(v.efficiency * 100)}%</b>
        </p>
        <table className="data-table production-table">
          <thead>
            <tr>
              <th />
              <th className="right">{t('res.metal')}</th>
              <th className="right">{t('res.crystal')}</th>
              <th className="right">{t('res.tritium')}</th>
              <th className="right">{t('res.energy')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {v.lines.map((l) => (
              <tr key={l.source}>
                <td>
                  {nameOf(l.source)}
                  {l.source !== 'base' && <span className="muted small"> ({l.source === 'solar_satellite' ? fmt(l.level) : `${t('common.level')} ${l.level}`})</span>}
                </td>
                {cell(l.perHour.metal)}
                {cell(l.perHour.crystal)}
                {cell(l.perHour.tritium)}
                {cell(l.energy ?? 0)}
                <td>
                  {l.percent !== undefined && l.percent !== null && (
                    <select value={l.percent} disabled={action.busy} onChange={(e) => setPercent(l.source, Number(e.target.value))} aria-label={nameOf(l.source)}>
                      {PERCENTS.map((p) => (
                        <option key={p} value={p}>
                          {p}%
                        </option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
            <tr className="sum-row">
              <td>{t('res.capacity')}</td>
              <td className="right">{fmt(v.capacity.metal)}</td>
              <td className="right">{fmt(v.capacity.crystal)}</td>
              <td className="right">{fmt(v.capacity.tritium)}</td>
              <td />
              <td />
            </tr>
            <tr className="sum-row">
              <td>
                {t('res.total')} ({t('res.perHour')})
              </td>
              {cell(v.perHour.metal)}
              {cell(v.perHour.crystal)}
              {cell(v.perHour.tritium)}
              {cell(v.energyProduced - v.energyUsed)}
              <td />
            </tr>
            <tr>
              <td>{t('res.perDay')}</td>
              {cell(v.perHour.metal * 24)}
              {cell(v.perHour.crystal * 24)}
              {cell(v.perHour.tritium * 24)}
              <td />
              <td />
            </tr>
            <tr>
              <td>{t('res.perWeek')}</td>
              {cell(v.perHour.metal * 168)}
              {cell(v.perHour.crystal * 168)}
              {cell(v.perHour.tritium * 168)}
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
