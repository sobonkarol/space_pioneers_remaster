import { Link } from 'react-router-dom';
import type { BuildQueueItem, Overview, ShipyardItem } from '../api/types';
import { nameOf, t } from '../i18n';
import { dateTime, fmt } from '../lib/format';
import { useServerNow } from '../state/game';
import { useSession } from '../state/session';
import { Countdown, Panel } from './common';

/** Pasek postepu od {@code start} do {@code end} (czas serwera). */
export function Progress({ start, end }: { start?: string; end?: string }) {
  const now = useServerNow();
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const pct = e <= s ? 100 : Math.max(0, Math.min(100, ((now - s) / (e - s)) * 100));
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.floor(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
      <span className="progress-label">{Math.floor(pct)}%</span>
    </div>
  );
}

function buildLabel(b: BuildQueueItem) {
  return `${nameOf(b.building)} (${b.demolish ? t('build.demolish') : `${t('common.level')} ${b.level}`})`;
}

function BuildCell({ queue, onDone, link }: { queue: BuildQueueItem[]; onDone: () => void; link?: string }) {
  const current = queue.find((b) => b.start) ?? null;
  const waiting = queue.filter((b) => b !== current);
  if (!current && waiting.length === 0) {
    return link ? <Link to={link}>{t('overview.idle')}</Link> : <span className="muted">{t('overview.idle')}</span>;
  }
  return (
    <>
      {current && (
        <div className="activity-current">
          <b>{buildLabel(current)}</b> — <Countdown until={current.end} onDone={onDone} />
          <span className="muted small"> ({t('activity.done', { date: dateTime(current.end) })})</span>
          <Progress start={current.start} end={current.end} />
        </div>
      )}
      {waiting.length > 0 && (
        <div className="muted small">
          {t('activity.queued')}: {waiting.map(buildLabel).join(', ')}
        </div>
      )}
    </>
  );
}

function ShipyardCell({ queue, onDone, link }: { queue: ShipyardItem[]; onDone: () => void; link?: string }) {
  if (queue.length === 0) {
    return link ? <Link to={link}>{t('overview.idle')}</Link> : <span className="muted">{t('overview.idle')}</span>;
  }
  const [current, ...rest] = queue;
  const unitEnd = current.currentUnitStart
    ? new Date(new Date(current.currentUnitStart).getTime() + current.secondsPerUnit * 1000).toISOString()
    : undefined;
  const last = queue[queue.length - 1];
  return (
    <>
      <div className="activity-current">
        <b>{nameOf(current.unit)}</b> {fmt(current.done)} / {fmt(current.count)}
        {unitEnd && (
          <>
            {' '}— {t('activity.nextUnit')} <Countdown until={unitEnd} onDone={onDone} />
          </>
        )}
        <Progress start={current.currentUnitStart} end={unitEnd} />
      </div>
      {rest.length > 0 && (
        <div className="muted small">
          {t('activity.queued')}: {rest.map((o) => `${nameOf(o.unit)} × ${fmt(o.count - o.done)}`).join(', ')}
        </div>
      )}
      <div className="muted small">
        {t('activity.shipyardAll')} <Countdown until={last.finishAt} /> ({dateTime(last.finishAt)})
      </div>
    </>
  );
}

/** Aktualne dzialania: budowa, badanie i stocznia na biezacej planecie oraz aktywnosc na pozostalych planetach. */
export function ActivityPanel({ overview: o, onRefresh }: { overview: Overview; onRefresh: () => void }) {
  const { setPlanetId } = useSession();
  const researchElsewhere = o.research && o.research.planetId !== o.planet.id;
  return (
    <Panel title={t('activity.title')} className="activity-panel">
      <table className="data-table activity-table">
        <tbody>
          <tr>
            <th>{t('overview.building')}</th>
            <td><BuildCell queue={o.buildQueue} onDone={onRefresh} link="/buildings" /></td>
          </tr>
          <tr>
            <th>{t('overview.research')}</th>
            <td>
              {o.research ? (
                <div className="activity-current">
                  <b>{nameOf(o.research.research)} ({t('common.level')} {o.research.level})</b> —{' '}
                  <Countdown until={o.research.end} onDone={onRefresh} />
                  <span className="muted small"> ({t('activity.done', { date: dateTime(o.research.end) })})</span>
                  {researchElsewhere && o.researchPlanetName && (
                    <span className="muted small"> — {t('activity.onPlanet', { name: o.researchPlanetName })}</span>
                  )}
                  <Progress start={o.research.start} end={o.research.end} />
                </div>
              ) : (
                <Link to="/research">{t('overview.idle')}</Link>
              )}
            </td>
          </tr>
          <tr>
            <th>{t('overview.shipyard')}</th>
            <td><ShipyardCell queue={o.shipyardQueue} onDone={onRefresh} link="/shipyard" /></td>
          </tr>
        </tbody>
      </table>
      {o.otherPlanets.length > 0 && (
        <>
          <h4 className="activity-subtitle">{t('activity.otherPlanets')}</h4>
          <table className="data-table activity-table">
            <tbody>
              {o.otherPlanets.map((a) => (
                <tr key={a.planet.id}>
                  <th>
                    <button type="button" className="link-button" onClick={() => setPlanetId(a.planet.id)}>
                      {a.planet.moon ? `${a.planet.name} (${t('galaxy.moon')})` : a.planet.name}
                    </button>
                    <div className="muted small">[{a.planet.coordinates}]</div>
                  </th>
                  <td>
                    {a.buildQueue.length > 0 && <BuildCell queue={a.buildQueue} onDone={onRefresh} />}
                    {a.shipyardQueue.length > 0 && <ShipyardCell queue={a.shipyardQueue} onDone={onRefresh} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}
