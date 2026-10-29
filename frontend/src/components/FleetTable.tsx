import type { FleetMovement } from '../api/types';
import { nameOf, t } from '../i18n';
import { dateTime, fmt } from '../lib/format';
import { Countdown } from './common';

interface Props {
  fleets: FleetMovement[];
  onRecall?: (id: number) => void;
  onUnion?: (id: number) => void;
  onEvent?: () => void;
  busy?: boolean;
}

function shipsText(ships: Record<string, number>): string {
  return Object.entries(ships)
    .map(([k, v]) => `${nameOf(k)}: ${fmt(v)}`)
    .join(', ');
}

/** Tabela ruchow flot z odliczaniem do przylotu/powrotu. */
function eventTime(f: FleetMovement): string | undefined {
  if (f.status === 'OUTBOUND') return f.arriveAt;
  if (f.status === 'HOLDING') return f.holdUntil;
  return f.returnAt;
}

function statusLabel(f: FleetMovement): string {
  if (f.status === 'OUTBOUND') return t('fleet.outbound');
  if (f.status === 'HOLDING') return t('fleet.holding');
  return t('fleet.returning');
}

export function FleetTable({ fleets, onRecall, onUnion, onEvent, busy }: Props) {
  if (fleets.length === 0) return <p className="muted">{t('overview.noEvents')}</p>;
  return (
    <table className="data-table fleet-table">
      <tbody>
        {fleets.map((f) => {
          const at = eventTime(f);
          const cls = !f.own ? (f.mission === 'ATTACK' || f.mission === 'MISSILE' ? 'hostile' : f.mission === 'HOLD' ? 'allied' : 'foreign') : f.status === 'RETURNING' ? 'returning' : 'own';
          return (
            <tr key={`${f.id}-${f.status}`} className={`fleet-row ${cls}`}>
              <td className="fleet-time">
                <Countdown until={at} onDone={onEvent} />
                <div className="muted small">{dateTime(at)}</div>
              </td>
              <td>
                <b>{t(`mission.${f.mission}`)}</b>{' '}
                {f.own ? (
                  <span className="muted">({statusLabel(f)})</span>
                ) : (
                  <span className={f.mission === 'HOLD' ? 'allied-label' : 'hostile-label'}>
                    {f.mission === 'HOLD' ? t('fleet.allied') : t('fleet.hostile')}: {f.ownerName}
                    {f.status === 'HOLDING' ? ` (${t('fleet.holding')})` : ''}
                  </span>
                )}
                <div>
                  [{f.origin}] → [{f.target}]{f.targetMoon ? ` (${t('galaxy.moon')})` : ''}
                  {f.unionId ? <span className="branch-tag">{t('fleet.union')}</span> : null}
                </div>
                {f.own && <div className="muted small" title={shipsText(f.ships)}>{shipsText(f.ships)}</div>}
                {f.own && f.cargo && f.cargo.metal + f.cargo.crystal + f.cargo.tritium > 0 && (
                  <div className="muted small">
                    {t('fleet.cargo')}: {fmt(f.cargo.metal)} / {fmt(f.cargo.crystal)} / {fmt(f.cargo.tritium)}
                  </div>
                )}
              </td>
              <td className="fleet-actions">
                {f.own && f.status !== 'RETURNING' && f.mission !== 'MISSILE' && onRecall && (
                  <button type="button" className="btn small" disabled={busy} onClick={() => onRecall(f.id)}>
                    {t('fleet.recall')}
                  </button>
                )}
                {f.own && f.status === 'OUTBOUND' && f.mission === 'ATTACK' && !f.unionId && onUnion && (
                  <button type="button" className="link-button small" disabled={busy} onClick={() => onUnion(f.id)}>
                    {t('fleet.createUnion')}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
