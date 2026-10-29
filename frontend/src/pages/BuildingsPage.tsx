import { api } from '../api/client';
import type { BuildQueueItem, Overview, UpgradeOption } from '../api/types';
import { ItemImage } from '../components/AssetImage';
import { Cost, Countdown, ErrorBox, Loading, MissingRequirements, Panel, useAction, useLoad } from '../components/common';
import { describe, nameOf, t } from '../i18n';
import { duration, fmt, scale } from '../lib/format';
import { useGame } from '../state/game';
import { useSession } from '../state/session';

const DEMOLISH_FACTOR = 0.5;

export function BuildingsPage() {
  const { planetId, profile, config } = useSession();
  const { overview, refresh } = useGame();
  const pid = planetId ?? profile?.homePlanetId;
  const { data, error, loading, reload } = useLoad(
    () => api.get<UpgradeOption[]>(`/planets/${pid}/buildings`),
    [pid],
  );
  const action = useAction();

  if (loading && !data) return <Loading />;
  const have = overview?.resources.amount ?? null;
  const queue = overview?.buildQueue ?? [];

  const after = async () => {
    await Promise.all([reload(), refresh()]);
  };
  const enqueue = async (key: string) => {
    await action.run(() => api.post(`/planets/${pid}/buildings/${key}`));
    await after();
  };
  const demolish = async (key: string, level: number) => {
    const def = config?.buildings.find((b) => b.key === key);
    if (def) {
      const cost = scale(def.baseCost, Math.pow(def.costFactor, level - 1) * DEMOLISH_FACTOR);
      const text = `${fmt(cost.metal)} / ${fmt(cost.crystal)} / ${fmt(cost.tritium)}`;
      if (!window.confirm(t('build.demolishConfirm', { name: nameOf(key), cost: text }))) return;
    }
    await action.run(() => api.post(`/planets/${pid}/buildings/${key}/demolish`));
    await after();
  };
  const cancel = async (item: BuildQueueItem) => {
    await action.run(() => api.del(`/planets/${pid}/build-queue/${item.id}`));
    await after();
  };

  return (
    <div className="buildings-page">
      <ErrorBox error={error ?? action.error} />
      <BuildQueue queue={queue} overview={overview} onCancel={cancel} onDone={after} busy={action.busy} />
      <Panel title={`${t('menu.buildings')} — ${overview ? t('build.fields', { used: overview.fieldsUsed, max: overview.fieldsMax }) : ''}`}>
        <table className="data-table item-table">
          <tbody>
            {(data ?? []).map((o) => (
              <UpgradeRow key={o.key} option={o} kind="building" have={have} busy={action.busy}
                actionLabel={t('build.upgradeTo', { level: o.nextLevel })}
                onAction={() => enqueue(o.key)}
                secondary={o.level > 0 ? { label: t('build.demolish'), onClick: () => demolish(o.key, o.level) } : undefined}
              />
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function BuildQueue({ queue, overview, onCancel, onDone, busy }: {
  queue: BuildQueueItem[];
  overview: Overview | null;
  onCancel: (i: BuildQueueItem) => void;
  onDone: () => void;
  busy: boolean;
}) {
  if (!overview) return null;
  return (
    <Panel title={t('build.queue')}>
      {queue.length === 0 ? (
        <p className="muted">{t('build.queueEmpty')}</p>
      ) : (
        <table className="data-table">
          <tbody>
            {queue.map((q) => (
              <tr key={q.id}>
                <td>
                  <b>{nameOf(q.building)}</b> — {q.demolish ? `${t('build.demolish')} → ${q.level}` : `${t('common.level')} ${q.level}`}
                </td>
                <td>{q.start ? <Countdown until={q.end} onDone={onDone} /> : <span className="muted">{t('build.waiting')}</span>}</td>
                <td className="right">
                  <button type="button" className="btn small" disabled={busy} onClick={() => onCancel(q)}>
                    {t('common.cancel')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

interface RowProps {
  option: UpgradeOption;
  kind: 'building' | 'research';
  have: { metal: number; crystal: number; tritium: number } | null;
  actionLabel: string;
  onAction: () => void;
  busy: boolean;
  secondary?: { label: string; onClick: () => void };
}

/** Wiersz budynku lub badania: grafika, opis, koszt, czas, przycisk albo powod blokady. */
export function UpgradeRow({ option: o, kind, have, actionLabel, onAction, busy, secondary }: RowProps) {
  const locked = o.missing.length > 0;
  const blocker = o.blocker ? t(`blocker.${o.blocker}`) : null;
  return (
    <tr className={`item-row ${locked ? 'locked' : ''}`} data-key={o.key}>
      <td className="item-image-cell">
        <ItemImage kind={kind} itemKey={o.key} size={100} />
      </td>
      <td className="item-info">
        <div className="item-title">
          <b>{nameOf(o.key)}</b>
          {o.level > 0 && <span className="item-level"> ({t('common.level')} {o.level})</span>}
          {o.branch !== 'NONE' && <span className="branch-tag">{t(`settings.branch.${o.branch}`)}</span>}
        </div>
        <div className="item-desc">{describe(o.key)}</div>
        {!locked && o.blocker !== 'max_level' && (
          <div className="item-cost">
            {t('common.cost')}: <Cost cost={o.cost} have={have} />
            {o.energyDelta !== undefined && o.energyDelta !== null && (
              <span className="cost-item">
                {t('build.energy')}: <b className={o.energyDelta < 0 ? 'negative' : 'positive'}>{o.energyDelta > 0 ? '+' : ''}{fmt(o.energyDelta)}</b>
              </span>
            )}
          </div>
        )}
        {!locked && o.blocker !== 'max_level' && (
          <div className="item-time">
            {t('common.time')}: {duration(o.seconds)}
          </div>
        )}
        <MissingRequirements missing={o.missing} />
      </td>
      <td className="item-action">
        {locked ? null : blocker ? (
          <span className="blocker">{blocker}</span>
        ) : (
          <button type="button" className={`btn ${o.affordable ? 'primary' : ''}`} disabled={busy || !o.affordable} onClick={onAction}>
            {actionLabel}
          </button>
        )}
        {secondary && (
          <button type="button" className="link-button small" disabled={busy} onClick={secondary.onClick}>
            {secondary.label}
          </button>
        )}
      </td>
    </tr>
  );
}
