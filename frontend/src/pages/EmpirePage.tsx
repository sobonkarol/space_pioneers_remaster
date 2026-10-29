import { api } from '../api/client';
import type { EmpirePlanet } from '../api/types';
import { PlanetImage } from '../components/AssetImage';
import { ErrorBox, Loading, Panel, useLoad } from '../components/common';
import { nameOf, t } from '../i18n';
import { fmt } from '../lib/format';
import { useSession } from '../state/session';

/** Zestawienie wszystkich planet: surowce, produkcja, poziomy budynkow i jednostki. */
export function EmpirePage() {
  const { config, setPlanetId } = useSession();
  const data = useLoad(() => api.get<EmpirePlanet[]>('/empire'), []);
  if (data.loading && !data.data) return <Loading />;
  const planets = data.data ?? [];
  const rowsFor = (keys: string[], value: (p: EmpirePlanet, k: string) => number) =>
    keys
      .filter((k) => planets.some((p) => value(p, k) > 0))
      .map((k) => (
        <tr key={k}>
          <th>{nameOf(k)}</th>
          {planets.map((p) => (
            <td key={p.planet.id} className="right">
              {value(p, k) > 0 ? fmt(value(p, k)) : '-'}
            </td>
          ))}
          <td className="right sum-cell">{fmt(planets.reduce((s, p) => s + value(p, k), 0))}</td>
        </tr>
      ));
  const sum = (f: (p: EmpirePlanet) => number) => fmt(planets.reduce((s, p) => s + f(p), 0));

  return (
    <div className="empire-page">
      <ErrorBox error={data.error} />
      <Panel title={t('empire.title')}>
        <div className="table-scroll">
          <table className="data-table empire-table">
            <thead>
              <tr>
                <th />
                {planets.map((p) => (
                  <th key={p.planet.id}>
                    <button type="button" className="link-button" onClick={() => setPlanetId(p.planet.id)}>
                      <PlanetImage planetType={p.planet.planetType} variant={p.planet.imageVariant} size={40} />
                      <div>{p.planet.name}</div>
                      <div className="muted small">[{p.planet.coordinates}]</div>
                    </button>
                  </th>
                ))}
                <th>{t('res.total')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{t('overview.diameter')}</th>
                {planets.map((p) => (
                  <td key={p.planet.id} className="right">
                    {p.fieldsUsed} / {p.fieldsMax}
                  </td>
                ))}
                <td />
              </tr>
              {(['metal', 'crystal', 'tritium'] as const).map((k) => (
                <tr key={k}>
                  <th>{t(`res.${k}`)}</th>
                  {planets.map((p) => (
                    <td key={p.planet.id} className="right">
                      {fmt(p.resources[k])}
                      <div className="muted small">+{fmt(p.perHour[k])}/h</div>
                    </td>
                  ))}
                  <td className="right sum-cell">
                    {sum((p) => p.resources[k])}
                    <div className="muted small">+{sum((p) => p.perHour[k])}/h</div>
                  </td>
                </tr>
              ))}
              <tr>
                <th>{t('res.energy')}</th>
                {planets.map((p) => (
                  <td key={p.planet.id} className={`right ${p.energyBalance < 0 ? 'negative' : ''}`}>
                    {fmt(p.energyBalance)}
                  </td>
                ))}
                <td />
              </tr>
              <tr className="section-row">
                <th colSpan={planets.length + 2}>{t('menu.buildings')}</th>
              </tr>
              {rowsFor((config?.buildings ?? []).map((b) => b.key), (p, k) => p.buildings[k] ?? 0)}
              <tr className="section-row">
                <th colSpan={planets.length + 2}>{t('menu.shipyard')}</th>
              </tr>
              {rowsFor((config?.ships ?? []).map((b) => b.key), (p, k) => p.units[k] ?? 0)}
              <tr className="section-row">
                <th colSpan={planets.length + 2}>{t('menu.defense')}</th>
              </tr>
              {rowsFor((config?.defenses ?? []).map((b) => b.key), (p, k) => p.units[k] ?? 0)}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
