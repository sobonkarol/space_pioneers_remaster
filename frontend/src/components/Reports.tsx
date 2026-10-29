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

export function CombatReportView({ report }: { report: CombatReport }) {
  const sideTech = (s: CombatReport['attacker']) => t('report.tech', { w: s.weapons * 10, s: s.shielding * 10, a: s.armour * 10 });
  return (
    <div className="combat-report">
      <h3>
        {report.planetName} [{report.coordinates}]
      </h3>
      <div className="report-sides">
        <div>
          <b>{t('report.attacker')}:</b> {report.attacker.playerName} [{report.attacker.coordinates}]
          <div className="muted small">{sideTech(report.attacker)}</div>
        </div>
        <div>
          <b>{t('report.defender')}:</b> {report.defender.playerName} [{report.defender.coordinates}]
          <div className="muted small">{sideTech(report.defender)}</div>
        </div>
      </div>
      <h4>{t('report.before')}</h4>
      <div className="report-grid">
        <UnitTable title={report.attacker.playerName} units={report.attackerStart} />
        <UnitTable title={report.defender.playerName} units={report.defenderStart} />
      </div>
      {report.rounds.map((r) => (
        <div key={r.number} className="report-round">
          <h4>{t('report.round', { n: r.number })}</h4>
          <p className="small">
            {t('report.shots', { side: t('report.attacker'), shots: fmt(r.attackerShots), damage: fmt(r.attackerDamage + r.absorbedByDefender), absorbed: fmt(r.absorbedByDefender) })}
            <br />
            {t('report.shots', { side: t('report.defender'), shots: fmt(r.defenderShots), damage: fmt(r.defenderDamage + r.absorbedByAttacker), absorbed: fmt(r.absorbedByAttacker) })}
          </p>
          <div className="report-grid">
            <UnitTable title={report.attacker.playerName} units={r.attackerUnits} />
            <UnitTable title={report.defender.playerName} units={r.defenderUnits} />
          </div>
        </div>
      ))}
      <div className="report-summary">
        <p>
          <b>{t(`report.outcome.${report.outcome}`)}</b>
        </p>
        <p>
          {t('report.losses')} — {t('report.attacker')}: {fmt(report.attackerLostValue.metal + report.attackerLostValue.crystal + report.attackerLostValue.tritium)},{' '}
          {t('report.defender')}: {fmt(report.defenderLostValue.metal + report.defenderLostValue.crystal + report.defenderLostValue.tritium)}
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
        {report.planetName} [{report.coordinates}] — {report.ownerName}
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
