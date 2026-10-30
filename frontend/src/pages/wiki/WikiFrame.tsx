import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useLoad } from '../../components/common';
import { nameOf } from '../../i18n';
import { firstAsset } from '../../lib/assets';
import { fmt } from '../../lib/format';
import { useSession } from '../../state/session';
import type { WikiConfig } from './wikiMath';

/** Encyklopedia gry w stylu klasycznych wiki (osobna karta, czytanie bez logowania). */
export const WIKI_BASE = '/wiki';
export const WIKI_NAME = 'Kosmopedia';
export const WIKI_NAME_GEN = 'Kosmopedii';

export const wikiPath = (slug = '') => (slug ? `${WIKI_BASE}/${slug}` : WIKI_BASE);

/** Konfiguracja z sesji, a dla gosci pobrana osobno (endpoint publiczny). */
export function useWikiConfig(): WikiConfig | null {
  const { config } = useSession();
  const own = useLoad(() => (config ? Promise.resolve(null) : api.get<WikiConfig>('/config')), [Boolean(config)]);
  return (config as unknown as WikiConfig | null) ?? own.data ?? null;
}

/** Spis stron do nawigacji i wyszukiwarki: [slug, tytul, grupa]. */
export interface NavEntry {
  slug: string;
  title: string;
  group: string;
}

export const NAV_GROUPS = ['Poradniki', 'Zasady gry', 'Katalog', 'Narzędzia'];

/** Link do strony wiki (artykul albo obiekt gry). */
export function W({ to, children }: { to: string; children?: ReactNode }) {
  return <Link to={wikiPath(to)}>{children ?? nameOf(to)}</Link>;
}

export function Cost({ cost }: { cost: { metal: number; crystal: number; tritium: number } }) {
  const parts: ReactNode[] = [];
  if (cost.metal) parts.push(<span key="m">Metal: <b>{fmt(cost.metal)}</b></span>);
  if (cost.crystal) parts.push(<span key="c">Kryształ: <b>{fmt(cost.crystal)}</b></span>);
  if (cost.tritium) parts.push(<span key="t">Tryt: <b>{fmt(cost.tritium)}</b></span>);
  return <span className="wiki-cost">{parts.length ? parts : '—'}</span>;
}

export function Requirements({ req }: { req: { buildings: Record<string, number>; research: Record<string, number> } }) {
  const items = [...Object.entries(req.buildings ?? {}), ...Object.entries(req.research ?? {})];
  if (items.length === 0) return <span className="muted">brak</span>;
  return (
    <span>
      {items.map(([k, l], i) => (
        <span key={k}>
          {i > 0 && ', '}
          <W to={k} /> ({l})
        </span>
      ))}
    </span>
  );
}

function Search({ entries }: { entries: NavEntry[] }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
  const hits = useMemo(() => {
    const n = norm(q.trim());
    if (n.length < 2) return [];
    return entries.filter((e) => norm(e.title).includes(n)).slice(0, 10);
  }, [q, entries]);
  return (
    <div className="wiki-portlet">
      <h3>Szukaj</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (hits[0]) {
            navigate(wikiPath(hits[0].slug));
            setQ('');
          }
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="np. krążownik" aria-label="Szukaj w wiki" />
      </form>
      {hits.length > 0 && (
        <ul className="wiki-hits">
          {hits.map((h) => (
            <li key={h.slug}>
              <Link to={wikiPath(h.slug)} onClick={() => setQ('')}>
                {h.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WikiFrame({ title, entries, children, source }: {
  title: string;
  entries: NavEntry[];
  children: ReactNode;
  source?: boolean;
}) {
  const { profile } = useSession();
  const logo = firstAsset(['logo']);
  const articles = entries.filter((e) => e.group !== 'Obiekty');
  return (
    <div className="wiki-page">
      <aside className="wiki-side">
        <Link to={WIKI_BASE} className="wiki-logo">
          {logo ? <img src={logo} alt="Space Pioneers Remaster" /> : <b>Space Pioneers</b>}
          <span>{WIKI_NAME}</span>
        </Link>
        <Search entries={entries} />
        {NAV_GROUPS.map((g) => (
          <div key={g} className="wiki-portlet">
            <h3>{g}</h3>
            <ul>
              {articles
                .filter((e) => e.group === g)
                .map((e) => (
                  <li key={e.slug}>
                    <Link to={wikiPath(e.slug)}>{e.title}</Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
        <div className="wiki-portlet">
          <h3>Gra</h3>
          <ul>
            <li>{profile ? <a href="/overview">Wróć do gry</a> : <a href="/">Zaloguj się</a>}</li>
            <li>
              <a href="/forum-gry">Forum gry</a>
            </li>
          </ul>
        </div>
      </aside>
      <div className="wiki-body">
        <div className="wiki-tabs">
          <span className="active">Artykuł</span>
          {source && <span title="Liczby na tej stronie są wyliczane na żywo z danych serwera">Dane: serwer gry</span>}
        </div>
        <article className="wiki-content">
          <h1>{title}</h1>
          <div className="wiki-sub">Z {WIKI_NAME_GEN}, encyklopedii Space Pioneers Remaster</div>
          {children}
        </article>
        <footer className="wiki-footer">
          {WIKI_NAME} · Space Pioneers Remaster · tabele liczone na bieżąco z ustawień serwera
        </footer>
      </div>
    </div>
  );
}

/** Spis tresci z sekcji artykulu. */
export function Toc({ sections }: { sections: { id: string; title: string }[] }) {
  if (sections.length < 3) return null;
  return (
    <div className="wiki-toc">
      <b>Spis treści</b>
      <ol>
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`}>{s.title}</a>
          </li>
        ))}
      </ol>
    </div>
  );
}
