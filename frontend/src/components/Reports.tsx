import type { CombatReport, EspionageReport, Resources } from '../api/types';
import { nameOf, t } from '../i18n';
import { fmt } from '../lib/format';

function UnitTable({ title, units, losses }: { title: string; units: Record<string, number>; losses?: Record<string, number> }) {
  const keys = Object.keys(units);
  return (
    <table className="data-table report-units">
      <thead>
        <tr>
          <th colSpan={2}>{title}</th>
        </tr>
      </thead>
      <tbody>
        {keys.length === 0 ? (
          <tr>
            <td colSpan={2} className="muted">
              {t('report.destroyed')}
            </td>
          </tr>
        ) : (
          keys.map((k) => (
            <tr key={k}>
              <td>{nameOf(k)}</td>
              <td className="right">
                {fmt(units[k])}
                {losses?.[k] ? <span className="negative"> (-{fmt(losses[k])})</span> : null}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function ResLine({ r }: { r: Resources }) {
  return (
    <span>
      {fmt(r.metal)} {t('res.metal')}, {fmt(r.crystal)} {t('res.crystal')}, {fmt(r.tritium)} {t('res.tritium')}
    </span>
  );
}

function sumUnits(list: Record<string, number>[]): number {
  return list.reduce((s, m) => s + Object.values(m).reduce((a, b) => a + b, 0), 0);
}

function SideTables({ sides, units, losses }: {
  sides: CombatReport['attackers'];
  units: Record<string, number>[];
  losses?: Record<string, number>[];
}) {
  return (
    <>
      {sides.map((s, i) => (
        <UnitTable key={`${s.playerId}-${i}`} title={`${s.playerName} [${s.coordinates}]`} units={units[i] ?? {}} losses={losses?.[i]} />
      ))}
    </>
  );
}

export function CombatReportView({ report }: { report: CombatReport }) {
  const sideTech = (s: CombatReport['attackers'][number]) => t('report.tech', { w: s.weapons * 10, s: s.shielding * 10, a: s.armour * 10 });
  const lost = (r: Resources) => fmt(r.metal + r.crystal + r.tritium);
  return (
    <div className="combat-report">
      <h3>
        {report.planetName} [{report.coordinates}]
      </h3>
      <div className="report-sides">
        <div>
          <b>{t('report.attacker')}:</b>
          {report.attackers.map((s) => (
            <div key={`a${s.playerId}${s.coordinates}`}>
              {s.playerName} [{s.coordinates}] <span className="muted small">{sideTech(s)}</span>
            </div>
          ))}
        </div>
        <div>
          <b>{t('report.defender')}:</b>
          {report.defenders.map((s) => (
            <div key={`d${s.playerId}${s.coordinates}`}>
              {s.playerName} [{s.coordinates}] <span className="muted small">{sideTech(s)}</span>
            </div>
          ))}
        </div>
      </div>
      <h4>{t('report.before')}</h4>
      <div className="report-grid">
        <div>
          <SideTables sides={report.attackers} units={report.attackerStart} />
        </div>
        <div>
          <SideTables sides={report.defenders} units={report.defenderStart} />
        </div>
      </div>
      {report.rounds.map((r) => (
        <div key={r.number} className="report-round">
          <h4>{t('report.round', { n: r.number })}</h4>
          <p className="small">
            {t('report.shots', { side: t('report.attacker'), shots: fmt(r.attackerShots), damage: fmt(r.attackerDamage + r.absorbedByDefender), absorbed: fmt(r.absorbedByDefender) })}
            <br />
            {t('report.shots', { side: t('report.defender'), shots: fmt(r.defenderShots), damage: fmt(r.defenderDamage + r.absorbedByAttacker), absorbed: fmt(r.absorbedByAttacker) })}
          </p>
          {(sumUnits(r.attackerUnits) > 0 || sumUnits(r.defenderUnits) > 0) && (
            <div className="report-grid">
              <div>
                <SideTables sides={report.attackers} units={r.attackerUnits} />
              </div>
              <div>
                <SideTables sides={report.defenders} units={r.defenderUnits} />
              </div>
            </div>
          )}
        </div>
      ))}
      <div className="report-summary">
        <p>
          <b>{t(`report.outcome.${report.outcome}`)}</b>
        </p>
        <p>
          {t('report.losses')} — {t('report.attacker')}: {lost(report.attackerLostValue)}, {t('report.defender')}: {lost(report.defenderLostValue)}
        </p>
        <p>
          {t('report.loot')}: <ResLine r={report.loot} />
        </p>
        <p>
          {t('report.debris')}: {fmt(report.debris.metal)} {t('res.metal')}, {fmt(report.debris.crystal)} {t('res.crystal')}
        </p>
        {Object.keys(report.defenseRebuilt).length > 0 && (
          <p>
            {t('report.rebuilt')}:{' '}
            {Object.entries(report.defenseRebuilt)
              .map(([k, v]) => `${nameOf(k)} ${fmt(v)}`)
              .join(', ')}
          </p>
        )}
        {report.moonChancePercent > 0 && <p>{t('report.moonChance', { p: report.moonChancePercent })}</p>}
        {report.moonCreated && <p className="positive"><b>{t('report.moonCreated')}</b></p>}
      </div>
    </div>
  );
}

function KeyValueTable({ title, values }: { title: string; values?: Record<string, number> }) {
  return (
    <table className="data-table report-units">
      <thead>
        <tr>
          <th colSpan={2}>{title}</th>
        </tr>
      </thead>
      <tbody>
        {values === undefined || values === null ? (
          <tr>
            <td colSpan={2} className="muted">
              {t('report.hidden')}
            </td>
          </tr>
        ) : Object.keys(values).length === 0 ? (
          <tr>
            <td colSpan={2} className="muted">
              {t('common.none')}
            </td>
          </tr>
        ) : (
          Object.entries(values).map(([k, v]) => (
            <tr key={k}>
              <td>{nameOf(k)}</td>
              <td className="right">{fmt(v)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export function EspionageReportView({ report }: { report: EspionageReport }) {
  return (
    <div className="espionage-report">
      <h3>
        {report.moon ? `${t('galaxy.moon')} ` : ''}{report.planetName} [{report.coordinates}] — {report.ownerName}
      </h3>
      <p>
        {t('report.resources')}: <ResLine r={report.resources} />
      </p>
      <div className="report-grid">
        <KeyValueTable title={t('report.fleet')} values={report.fleet} />
        <KeyValueTable title={t('report.defense')} values={report.defense} />
        <KeyValueTable title={t('report.buildings')} values={report.buildings} />
        <KeyValueTable title={t('report.research')} values={report.research} />
      </div>
      <p className="muted small">{t('report.counter', { p: report.counterEspionageChancePercent })}</p>
      {report.probesDestroyed && <p className="negative">{t('report.probesLost')}</p>}
    </div>
  );
}
