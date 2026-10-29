import { api } from '../api/client';
import type { UpgradeOption } from '../api/types';
import { Countdown, ErrorBox, InfoBox, Loading, Panel, useAction, useLoad } from '../components/common';
import { nameOf, t } from '../i18n';
import { useGame } from '../state/game';
import { useSession } from '../state/session';
import { UpgradeRow } from './BuildingsPage';

export function ResearchPage() {
  const { planetId, profile } = useSession();
  const { overview, refresh } = useGame();
  const pid = planetId ?? profile?.homePlanetId;
  const { data, error, loading, reload } = useLoad(() => api.get<UpgradeOption[]>(`/planets/${pid}/research`), [pid]);
  const action = useAction();

  if (loading && !data) return <Loading />;
  const have = overview?.resources.amount ?? null;
  const running = overview?.research;
  const noLab = (data ?? []).every((o) => o.blocker === 'no_lab' || o.missing.length > 0) && (data ?? []).some((o) => o.blocker === 'no_lab');

  const after = async () => {
    await Promise.all([reload(), refresh()]);
  };

  return (
    <div className="research-page">
      <ErrorBox error={error ?? action.error} />
      {noLab && <InfoBox>{t('research.noLab')}</InfoBox>}
      {running && (
        <Panel title={t('research.running')}>
          <p>
            <b>{nameOf(running.research)}</b> ({t('common.level')} {running.level}) —{' '}
            <Countdown until={running.end} onDone={after} />{' '}
            <button
              type="button"
              className="btn small"
              disabled={action.busy}
              onClick={async () => {
                await action.run(() => api.del('/research'));
                await after();
              }}
            >
              {t('research.cancel')}
            </button>
          </p>
        </Panel>
      )}
      <Panel title={t('menu.research')}>
        <table className="data-table item-table">
          <tbody>
            {(data ?? []).map((o) => (
              <UpgradeRow
                key={o.key}
                option={o}
                kind="research"
                have={have}
                busy={action.busy}
                actionLabel={t('research.start', { level: o.nextLevel })}
                onAction={async () => {
                  await action.run(() => api.post(`/planets/${pid}/research/${o.key}`));
                  await after();
                }}
              />
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
