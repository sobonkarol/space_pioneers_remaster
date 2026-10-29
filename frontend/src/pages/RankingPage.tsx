import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { RankingPage as RankingData } from '../api/types';
import { ErrorBox, Loading, Panel, useLoad } from '../components/common';
import { t } from '../i18n';
import { fmt } from '../lib/format';
import { useSession } from '../state/session';

const CATEGORIES = ['total', 'buildings', 'research', 'fleet', 'defense'];

export function RankingPage() {
  const { profile } = useSession();
  const [type, setType] = useState<'players' | 'alliances'>('players');
  const [category, setCategory] = useState('total');
  const [page, setPage] = useState<number | null>(null);
  const data = useLoad(
    () => api.get<RankingData>(`/ranking?type=${type}&category=${category}${page ? `&page=${page}` : ''}`),
    [type, category, page],
  );
  const r = data.data;
  const pages = r ? Math.max(1, Math.ceil(r.total / r.pageSize)) : 1;

  return (
    <div className="ranking-page">
      <ErrorBox error={data.error} />
      <Panel title={t('menu.ranking')}>
        <div className="tabs">
          {(['players', 'alliances'] as const).map((ty) => (
            <button key={ty} type="button" className={type === ty ? 'active' : ''} onClick={() => { setType(ty); setPage(null); }}>
              {t(`ranking.${ty}`)}
            </button>
          ))}
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(null); }} aria-label={t('ranking.total')}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`ranking.${c}`)}
              </option>
            ))}
          </select>
          <select value={r?.page ?? 1} onChange={(e) => setPage(Number(e.target.value))} aria-label={t('ranking.page')}>
            {Array.from({ length: pages }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i * (r?.pageSize ?? 100) + 1}-{(i + 1) * (r?.pageSize ?? 100)}
              </option>
            ))}
          </select>
        </div>
        {!r ? (
          <Loading />
        ) : (
          <table className="data-table ranking-table">
            <thead>
              <tr>
                <th>{t('common.rank')}</th>
                <th>{type === 'players' ? t('common.player') : t('alliance.name')}</th>
                <th>{t('common.alliance')}</th>
                {type === 'alliances' && <th>{t('alliance.members')}</th>}
                <th className="right">{t('common.points')}</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.id} className={type === 'players' && row.id === profile?.id ? 'own-row' : type === 'alliances' && row.id === profile?.allianceId ? 'own-row' : ''}>
                  <td>{row.rank}</td>
                  <td>
                    {type === 'players' ? (
                      <>
                        {row.name}{' '}
                        {row.id !== profile?.id && (
                          <Link to={`/messages?to=${encodeURIComponent(row.name)}`} className="small" title={t('galaxy.message')}>
                            ✉
                          </Link>
                        )}
                      </>
                    ) : (
                      <Link to={`/alliance/${row.id}`}>{row.name}</Link>
                    )}
                  </td>
                  <td>{row.allianceTag && <Link to={`/alliance/${row.allianceId}`}>[{row.allianceTag}]</Link>}</td>
                  {type === 'alliances' && <td>{row.members}</td>}
                  <td className="right">{fmt(row.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted small">{t('ranking.updated')}</p>
      </Panel>
    </div>
  );
}
