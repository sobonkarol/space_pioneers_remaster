import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { GalaxyView } from '../api/types';
import { PlanetImage } from '../components/AssetImage';
import { ErrorBox, Loading, Panel, errorText } from '../components/common';
import { t } from '../i18n';
import { fmt } from '../lib/format';
import { useGame } from '../state/game';
import { useSession } from '../state/session';

export function GalaxyPage() {
  const { overview } = useGame();
  const { config } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const home = (params.get('coords') ?? overview?.planet.coordinates ?? '1:1:1').split(':').map(Number);
  const [galaxy, setGalaxy] = useState(home[0] || 1);
  const [system, setSystem] = useState(home[1] || 1);
  const [view, setView] = useState<GalaxyView | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const maxG = config?.universe.galaxies ?? 1;
  const maxS = config?.universe.systems ?? 1;

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
  const fleet = (coords: string, mission: string, ships?: string) =>
    navigate(`/fleet?target=${coords}&mission=${mission}${ships ? `&ships=${ships}` : ''}`);

  return (
    <div className="galaxy-page">
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
            </tbody>
          </table>
        )}
        <p className="muted small">{t('galaxy.legend')}</p>
      </Panel>
    </div>
  );
}
