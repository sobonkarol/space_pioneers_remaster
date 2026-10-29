import type { FleetMovement } from '../api/types';
import { nameOf, t } from '../i18n';
import { dateTime, fmt } from '../lib/format';
import { Countdown } from './common';

interface Props {
  fleets: FleetMovement[];
  onRecall?: (id: number) => void;
  onEvent?: () => void;
  busy?: boolean;
}

function shipsText(ships: Record<string, number>): string {
  return Object.entries(ships)
    .map(([k, v]) => `${nameOf(k)}: ${fmt(v)}`)
    .join(', ');
}

/** Tabela ruchow flot z odliczaniem do przylotu/powrotu. */
export function FleetTable({ fleets, onRecall, onEvent, busy }: Props) {
  if (fleets.length === 0) return <p className="muted">{t('overview.noEvents')}</p>;
  return (
    <table className="data-table fleet-table">
      <tbody>
        {fleets.map((f) => {
          const at = f.status === 'OUTBOUND' ? f.arriveAt : f.returnAt;
          const cls = !f.own ? (f.mission === 'ATTACK' ? 'hostile' : 'foreign') : f.status === 'RETURNING' ? 'returning' : 'own';
          return (
            <tr key={`${f.id}-${f.status}`} className={`fleet-row ${cls}`}>
              <td className="fleet-time">
                <Countdown until={at} onDone={onEvent} />
                <div className="muted small">{dateTime(at)}</div>
              </td>
              <td>
                <b>{t(`mission.${f.mission}`)}</b>{' '}
                {f.own ? (
                  <span className="muted">({f.status === 'OUTBOUND' ? t('fleet.outbound') : t('fleet.returning')})</span>
                ) : (
                  <span className="hostile-label">{t('fleet.hostile')}: {f.ownerName}</span>
                )}
                <div>
                  [{f.origin}] → [{f.target}]
                </div>
                {f.own && <div className="muted small" title={shipsText(f.ships)}>{shipsText(f.ships)}</div>}
                {f.own && f.cargo && f.cargo.metal + f.cargo.crystal + f.cargo.tritium > 0 && (
                  <div className="muted small">
                    {t('fleet.cargo')}: {fmt(f.cargo.metal)} / {fmt(f.cargo.crystal)} / {fmt(f.cargo.tritium)}
                  </div>
                )}
              </td>
              <td className="fleet-actions">
                {f.own && f.status === 'OUTBOUND' && onRecall && (
                  <button type="button" className="btn small" disabled={busy} onClick={() => onRecall(f.id)}>
                    {t('fleet.recall')}
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
