import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ErrorBox, Loading, Panel, errorText } from '../components/common';
import { t } from '../i18n';
import { fmt } from '../lib/format';

type Kind = 'players' | 'alliances' | 'planets';

interface Hit {
  kind: 'player' | 'alliance' | 'planet' | 'moon';
  id: number;
  name: string;
  tag?: string;
  playerName?: string;
  allianceId?: number;
  allianceTag?: string;
  coordinates?: string;
  points: number;
  rank: number;
  members: number;
}

/** Wyszukiwarka graczy, sojuszy i planet. */
export function SearchPage() {
  const [kind, setKind] = useState<Kind>('players');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setHits(await api.get<Hit[]>(`/search?kind=${kind}&q=${encodeURIComponent(query)}`));
    } catch (err) {
      setError(errorText(err));
      setHits(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="search-page">
      <Panel title={t('menu.search')}>
        <form onSubmit={search} className="inline-form">
          <select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setHits(null); }} aria-label={t('search.kind')}>
            <option value="players">{t('search.players')}</option>
            <option value="alliances">{t('search.alliances')}</option>
            <option value="planets">{t('search.planets')}</option>
          </select>
          <input value={query} onChange={(e) => setQuery(e.target.value)} minLength={2} maxLength={30} required
            placeholder={t('search.placeholder')} aria-label={t('search.placeholder')} />
          <button type="submit" className="btn primary" disabled={busy}>{t('admin.search')}</button>
        </form>
        <ErrorBox error={error} />
        {busy && <Loading />}
        {hits && hits.length === 0 && <p className="muted">{t('search.none')}</p>}
        {hits && hits.length > 0 && (
          <table className="data-table search-results">
            <thead>
              <tr>
                <th>{kind === 'alliances' ? t('common.alliance') : kind === 'planets' ? t('galaxy.planet') : t('common.player')}</th>
                <th>{kind === 'alliances' ? t('search.members') : t('common.alliance')}</th>
                <th>{t('common.points')}</th>
                <th>{kind === 'alliances' ? '' : t('common.coordinates')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {hits.map((h) => (
                <tr key={`${h.kind}-${h.id}`}>
                  <td>
                    {h.kind === 'alliance' ? `[${h.tag}] ${h.name}` : h.name}
                    {(h.kind === 'planet' || h.kind === 'moon') && <span className="muted small"> — {h.playerName}{h.kind === 'moon' ? ` (${t('galaxy.moon')})` : ''}</span>}
                    {h.rank > 0 && <span className="muted small"> #{h.rank}</span>}
                  </td>
                  <td>
                    {h.kind === 'alliance' ? fmt(h.members) : h.allianceId ? <Link to={`/alliance/${h.allianceId}`}>[{h.allianceTag}]</Link> : '-'}
                  </td>
                  <td>{fmt(h.points)}</td>
                  <td>{h.coordinates && <Link to={`/galaxy?coords=${h.coordinates}`}>[{h.coordinates}]</Link>}</td>
                  <td className="galaxy-actions">
                    {h.kind === 'alliance' ? (
                      <Link className="link-button small" to={`/alliance/${h.id}`}>{t('search.view')}</Link>
                    ) : (
                      h.playerName && (
                        <>
                          <Link className="link-button small" to={`/messages?to=${encodeURIComponent(h.playerName)}`}>{t('galaxy.message')}</Link>
                          <Link className="link-button small" to={`/buddies?add=${encodeURIComponent(h.playerName)}`}>{t('search.buddy')}</Link>
                        </>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
