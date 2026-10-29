import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { DispatchInfo, FleetMovement, GalaxyView } from '../api/types';
import { PlanetImage } from '../components/AssetImage';
import { ErrorBox, Loading, Panel, SuccessBox, errorText, useAction } from '../components/common';
import { FleetTable } from '../components/FleetTable';
import { nameOf, t } from '../i18n';
import { fmt } from '../lib/format';
import { useGame } from '../state/game';
import { useSession } from '../state/session';

export function GalaxyPage() {
  const { overview } = useGame();
  const { config, planetId } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const home = (params.get('coords') ?? overview?.planet.coordinates ?? '1:1:1').split(':').map(Number);
  const [galaxy, setGalaxy] = useState(home[0] || 1);
  const [system, setSystem] = useState(home[1] || 1);
  const [view, setView] = useState<GalaxyView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missileTarget, setMissileTarget] = useState<string | null>(null);
  const [phalanx, setPhalanx] = useState<{ coords: string; fleets: FleetMovement[] } | null>(null);
  const [dispatch, setDispatch] = useState<DispatchInfo | null>(null);
  const action = useAction();
  const maxG = config?.universe.galaxies ?? 1;
  const maxS = config?.universe.systems ?? 1;
  const deepSpace = (config?.universe.positions ?? 15) + 1;

  const [initialized, setInitialized] = useState(Boolean(params.get('coords') || overview));
  // przeglad planety moze dojsc po pierwszym renderze - wtedy ustawiamy uklad macierzysty
  useEffect(() => {
    if (!initialized && overview) {
      const [g, s] = overview.planet.coordinates.split(':').map(Number);
      setGalaxy(g);
      setSystem(s);
      setInitialized(true);
    }
  }, [initialized, overview]);

  useEffect(() => {
    if (!planetId) return;
    api.get<DispatchInfo>(`/planets/${planetId}/fleet-dispatch`).then(setDispatch).catch(() => setDispatch(null));
  }, [planetId]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<GalaxyView>(`/galaxy/${galaxy}/${system}`)
      .then((v) => {
        if (!cancelled) {
          setView(v);
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [galaxy, system]);

  const clamp = (v: number, max: number) => Math.min(max, Math.max(1, v));
  const fleet = (coords: string, mission: string, ships?: string, moon = false) =>
    navigate(`/fleet?target=${coords}&mission=${mission}${ships ? `&ships=${ships}` : ''}${moon ? '&moon=1' : ''}`);
  const onMoon = overview?.planet.moon ?? false;
  const hasMissiles = (dispatch?.missiles ?? 0) > 0 && !onMoon;

  const scan = async (coords: string) => {
    let fleets: FleetMovement[] = [];
    const ok = await action.run(async () => {
      fleets = await api.post<FleetMovement[]>(`/planets/${planetId}/phalanx`, { target: coords });
    });
    if (ok) setPhalanx({ coords, fleets });
  };

  return (
    <div className="galaxy-page">
      <ErrorBox error={action.error} />
      {missileTarget && dispatch && (
        <MissilePanel planetId={planetId!} target={missileTarget} available={dispatch.missiles} range={dispatch.missileRange}
          onClose={() => setMissileTarget(null)} />
      )}
      {phalanx && (
        <Panel title={`${t('phalanx.title')} — ${t('phalanx.result', { coords: phalanx.coords })}`}>
          <FleetTable fleets={phalanx.fleets} />
          <button type="button" className="btn small" onClick={() => setPhalanx(null)}>
            {t('common.close')}
          </button>
        </Panel>
      )}
      <Panel title={t('menu.galaxy')}>
        <div className="galaxy-nav">
          <span className="nav-group">
            {t('menu.galaxy')}
            <button type="button" className="btn small" onClick={() => setGalaxy((g) => clamp(g - 1, maxG))}>«</button>
            <input className="coord-input" value={galaxy} onChange={(e) => setGalaxy(clamp(Number(e.target.value) || 1, maxG))} aria-label={t('menu.galaxy')} />
            <button type="button" className="btn small" onClick={() => setGalaxy((g) => clamp(g + 1, maxG))}>»</button>
          </span>
          <span className="nav-group">
            {t('galaxy.system')}
            <button type="button" className="btn small" onClick={() => setSystem((s) => clamp(s - 1, maxS))}>«</button>
            <input className="coord-input" value={system} onChange={(e) => setSystem(clamp(Number(e.target.value) || 1, maxS))} aria-label={t('galaxy.system')} />
            <button type="button" className="btn small" onClick={() => setSystem((s) => clamp(s + 1, maxS))}>»</button>
          </span>
          {hasMissiles && <span className="muted small">{t('missile.range', { n: fmt(dispatch?.missiles ?? 0), range: dispatch?.missileRange ?? 0 })}</span>}
        </div>
        <ErrorBox error={error} />
        {!view ? (
          <Loading />
        ) : (
          <table className="data-table galaxy-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('galaxy.planet')}</th>
                <th>{t('common.name')}</th>
                <th>{t('galaxy.moon')}</th>
                <th>{t('galaxy.debris')}</th>
                <th>{t('common.player')}</th>
                <th>{t('common.alliance')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => {
                const coords = `${view.galaxy}:${view.system}:${r.position}`;
                return (
                  <tr key={r.position} className={r.own ? 'own-row' : r.planetId ? '' : 'empty-row'}>
                    <td>{r.position}</td>
                    <td className="galaxy-planet">
                      {r.planetId && <PlanetImage planetType={r.planetType} variant={r.imageVariant} size={30} />}
                    </td>
                    <td>{r.planetName ?? <span className="muted">{t('galaxy.empty')}</span>}</td>
                    <td className="galaxy-planet">
                      {r.moonId && (
                        <span title={r.moonName ?? ''} className="moon-cell">
                          <PlanetImage planetType="moon" variant={r.moonImageVariant} size={20} />
                          {!r.own && (
                            <span className="moon-actions">
                              <button type="button" className="link-button small" onClick={() => fleet(coords, 'ESPIONAGE', 'espionage_probe:1', true)}>
                                {t('galaxy.spy')}
                              </button>
                              <button type="button" className="link-button small" onClick={() => fleet(coords, 'ATTACK', undefined, true)}>
                                {t('galaxy.attack')}
                              </button>
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td>
                      {r.debris && (
                        <span className="debris" title={`${t('res.metal')}: ${fmt(r.debris.metal)}\n${t('res.crystal')}: ${fmt(r.debris.crystal)}`}>
                          {fmt(r.debris.metal)} / {fmt(r.debris.crystal)}
                        </span>
                      )}
                    </td>
                    <td>
                      {r.ownerName && (
                        <>
                          <span className={`owner ${r.flags.map((f) => `flag-${f === 'I' ? 'II' : f}`).join(' ')}`}>{r.ownerName}</span>
                          {r.flags.length > 0 && <span className="flags"> ({r.flags.join(' ')})</span>}
                          {r.ownerRank && <span className="muted small"> #{r.ownerRank}</span>}
                        </>
                      )}
                    </td>
                    <td>{r.allianceTag && <Link to={`/alliance/${r.allianceId}`}>[{r.allianceTag}]</Link>}</td>
                    <td className="galaxy-actions">
                      {r.planetId && !r.own && (
                        <>
                          <button type="button" className="link-button small" onClick={() => fleet(coords, 'ESPIONAGE', 'espionage_probe:1')}>
                            {t('galaxy.spy')}
                          </button>
                          <button type="button" className="link-button small" onClick={() => fleet(coords, 'ATTACK')}>
                            {t('galaxy.attack')}
                          </button>
                          <button type="button" className="link-button small" onClick={() => fleet(coords, 'TRANSPORT')}>
                            {t('galaxy.transport')}
                          </button>
                          <button type="button" className="link-button small" onClick={() => fleet(coords, 'HOLD')}>
                            {t('galaxy.hold')}
                          </button>
                          {hasMissiles && (
                            <button type="button" className="link-button small" onClick={() => setMissileTarget(coords)}>
                              {t('galaxy.missiles')}
                            </button>
                          )}
                          {onMoon && (
                            <button type="button" className="link-button small" onClick={() => void scan(coords)}>
                              {t('galaxy.phalanx')}
                            </button>
                          )}
                          <Link className="link-button small" to={`/messages?to=${encodeURIComponent(r.ownerName ?? '')}`}>
                            {t('galaxy.message')}
                          </Link>
                        </>
                      )}
                      {r.planetId && r.own && (
                        <button type="button" className="link-button small" onClick={() => fleet(coords, 'TRANSPORT')}>
                          {t('galaxy.transport')}
                        </button>
                      )}
                      {!r.planetId && (
                        <button type="button" className="link-button small" onClick={() => fleet(coords, 'COLONIZE', 'colony_ship:1')}>
                          {t('galaxy.colonize')}
                        </button>
                      )}
                      {r.debris && (
                        <button type="button" className="link-button small" onClick={() => fleet(coords, 'RECYCLE', 'recycler:99999')}>
                          {t('galaxy.recycle')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="empty-row">
                <td>{deepSpace}</td>
                <td colSpan={6} className="muted">
                  {t('galaxy.expedition')}
                </td>
                <td className="galaxy-actions">
                  <button type="button" className="link-button small" onClick={() => fleet(`${view.galaxy}:${view.system}:${deepSpace}`, 'EXPEDITION')}>
                    {t('mission.EXPEDITION')}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        )}
        <p className="muted small">{t('galaxy.legend')}</p>
      </Panel>
    </div>
  );
}

function MissilePanel({ planetId, target, available, range, onClose }: {
  planetId: number;
  target: string;
  available: number;
  range: number;
  onClose: () => void;
}) {
  const { config } = useSession();
  const { refresh } = useGame();
  const action = useAction();
  const [count, setCount] = useState(String(available));
  const [primary, setPrimary] = useState('');
  return (
    <Panel title={`${t('missile.title')} [${target}]`}>
      <ErrorBox error={action.error} />
      <SuccessBox message={action.message} />
      <p className="muted small">{t('missile.range', { n: fmt(available), range })}</p>
      <div className="inline-form">
        <label>
          {t('missile.count')}
          <input className="amount-input" value={count} onChange={(e) => setCount(e.target.value)} />
        </label>
        <label>
          {t('missile.primary')}
          <select value={primary} onChange={(e) => setPrimary(e.target.value)}>
            <option value="">{t('missile.any')}</option>
            {(config?.defenses ?? []).map((d) => (
              <option key={d.key} value={d.key}>
                {nameOf(d.key)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn primary"
          disabled={action.busy}
          onClick={async () => {
            const ok = await action.run(
              () => api.post(`/planets/${planetId}/missiles`, { target, count: Number(count) || 0, primaryTarget: primary || null }),
              t('missile.sent'),
            );
            if (ok) await refresh();
          }}
        >
          {t('missile.launch')}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Panel>
  );
}
