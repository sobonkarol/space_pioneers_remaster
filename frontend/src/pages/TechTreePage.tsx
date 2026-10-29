import { api } from '../api/client';
import type { Requirements, UpgradeOption } from '../api/types';
import { ItemImage } from '../components/AssetImage';
import { ErrorBox, Loading, Panel, useLoad } from '../components/common';
import { nameOf, t } from '../i18n';
import { useSession } from '../state/session';

/** Drzewo technologii: wymagania kazdego obiektu z zaznaczeniem spelnionych (na biezacej planecie). */
export function TechTreePage() {
  const { config, planetId, profile } = useSession();
  const pid = planetId ?? profile?.homePlanetId;
  const levels = useLoad(async () => {
    const [b, r] = await Promise.all([
      api.get<UpgradeOption[]>(`/planets/${pid}/buildings`),
      api.get<UpgradeOption[]>(`/planets/${pid}/research`),
    ]);
    const map: Record<string, number> = {};
    for (const o of [...b, ...r]) map[o.key] = o.level;
    return map;
  }, [pid]);

  if (!config || (levels.loading && !levels.data)) return <Loading />;
  const have = levels.data ?? {};

  const reqList = (req: Requirements) => {
    const entries = [...Object.entries(req.buildings), ...Object.entries(req.research)];
    if (entries.length === 0) return <span className="muted">{t('techtree.noRequirements')}</span>;
    return entries.map(([k, lvl], i) => (
      <span key={k} className={(have[k] ?? 0) >= lvl ? 'req-met' : 'req-missing'}>
        {nameOf(k)} ({lvl}){i < entries.length - 1 ? ', ' : ''}
      </span>
    ));
  };

  const section = (title: string, kind: 'building' | 'research' | 'ship' | 'defense', items: { key: string; requirements: Requirements }[]) => (
    <Panel title={title}>
      <table className="data-table techtree-table">
        <tbody>
          {items.map((i) => (
            <tr key={i.key}>
              <td className="item-image-cell">
                <ItemImage kind={kind} itemKey={i.key} size={40} />
              </td>
              <td>
                <b>{nameOf(i.key)}</b>
                {have[i.key] ? <span className="muted small"> ({t('common.level')} {have[i.key]})</span> : null}
              </td>
              <td>{reqList(i.requirements)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );

  return (
    <div className="techtree-page">
      <ErrorBox error={levels.error} />
      {section(t('menu.buildings'), 'building', config.buildings)}
      {section(t('menu.research'), 'research', config.research)}
      {section(t('menu.shipyard'), 'ship', config.ships)}
      {section(t('menu.defense'), 'defense', [...config.defenses, ...(config.missiles ?? [])])}
    </div>
  );
}
