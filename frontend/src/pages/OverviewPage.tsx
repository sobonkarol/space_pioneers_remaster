import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { PlanetImage } from '../components/AssetImage';
import { ActivityPanel } from '../components/ActivityPanel';
import { ErrorBox, InfoBox, Loading, Panel, useAction } from '../components/common';
import { FleetTable } from '../components/FleetTable';
import { t } from '../i18n';
import { fmt } from '../lib/format';
import { useGame } from '../state/game';
import { useSession } from '../state/session';

export function OverviewPage() {
  const { overview, refresh } = useGame();
  const { profile, setPlanetId } = useSession();
  const action = useAction();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  // po wejsciu na przeglad zawsze swiezy stan (budowy zlecone na innych stronach)
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!overview) return <Loading />;
  const o = overview;

  const rename = async () => {
    const ok = await action.run(() => api.put(`/planets/${o.planet.id}/name`, { name: newName }));
    if (ok) {
      setRenaming(false);
      await refresh();
    }
  };

  const abandon = async () => {
    if (!window.confirm(t('overview.abandonConfirm'))) return;
    const ok = await action.run(() => api.del(`/planets/${o.planet.id}`));
    if (ok && profile) setPlanetId(profile.homePlanetId);
  };

  const recall = async (id: number) => {
    await action.run(() => api.post(`/fleets/${id}/recall`));
    await refresh();
  };

  return (
    <div className="overview-page">
      {o.vacation && <InfoBox>{t('overview.vacationActive')}</InfoBox>}
      {o.canChooseBranch && (
        <InfoBox>
          <Link to="/settings">{t('overview.branchAvailable')}</Link>
        </InfoBox>
      )}
      {o.unreadMessages > 0 && (
        <InfoBox>
          <Link to="/messages">{t('overview.unread', { n: o.unreadMessages })}</Link>
        </InfoBox>
      )}
      <ErrorBox error={action.error} />

      <ActivityPanel overview={o} onRefresh={refresh} />

      <Panel title={t('overview.events')}>
        <FleetTable fleets={o.fleets} onRecall={recall} onEvent={refresh} busy={action.busy} />
      </Panel>

      <Panel
        title={
          <>
            {t('overview.planet')} „{o.planet.name}” [{o.planet.coordinates}] ({o.playerName})
          </>
        }
      >
        <div className="overview-grid">
          <div className="overview-planet">
            <PlanetImage planetType={o.planet.planetType} variant={o.planet.imageVariant} name={o.planet.name} />
            {renaming ? (
              <div className="rename-box">
                <input value={newName} maxLength={20} onChange={(e) => setNewName(e.target.value)} autoFocus />
                <button type="button" className="btn small" onClick={rename} disabled={action.busy}>
                  {t('common.save')}
                </button>
                <button type="button" className="btn small" onClick={() => setRenaming(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <div className="planet-actions">
                <button type="button" className="link-button" onClick={() => { setNewName(o.planet.name); setRenaming(true); }}>
                  {t('overview.rename')}
                </button>
                {!o.planet.homeworld && (
                  <button type="button" className="link-button danger" onClick={abandon}>
                    {t('overview.abandon')}
                  </button>
                )}
              </div>
            )}
          </div>
          <table className="data-table info-table">
            <tbody>
              <tr>
                <th>{t('overview.diameter')}</th>
                <td>
                  {o.fieldsUsed} / {o.fieldsMax}
                </td>
              </tr>
              <tr>
                <th>{t('overview.temperature')}</th>
                <td>
                  {o.temperatureMin}°C … {o.temperatureMax}°C
                </td>
              </tr>
              <tr>
                <th>{t('overview.position')}</th>
                <td>
                  <Link to={`/galaxy?coords=${o.planet.coordinates}`}>[{o.planet.coordinates}]</Link>
                </td>
              </tr>
              <tr>
                <th>{t('overview.points')}</th>
                <td>
                  {fmt(o.points)} ({t('overview.rankOf', { rank: o.rank || '-', total: o.playerCount })})
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
