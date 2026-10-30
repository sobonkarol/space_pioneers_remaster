import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Loading } from '../../components/common';
import { describe, nameOf } from '../../i18n';
import { firstAsset } from '../../lib/assets';
import { duration, fmt } from '../../lib/format';
import { ARTICLES, articleBySlug } from './WikiArticles';
import { Cost, Requirements, Toc, useWikiConfig, W, WIKI_NAME, WIKI_NAME_GEN, WikiFrame, wikiPath, type NavEntry } from './WikiFrame';
import { BuildingArticle, ResearchArticle, UnitArticle } from './WikiItems';
import { baseHull, distance, flightSeconds, fuel, unitSpeed, type WikiConfig, type WikiUnit } from './wikiMath';

const TOOLS: { slug: string; title: string; group: string }[] = [
  { slug: 'budynki', title: 'Budynki', group: 'Katalog' },
  { slug: 'technologie', title: 'Technologie', group: 'Katalog' },
  { slug: 'statki', title: 'Statki', group: 'Katalog' },
  { slug: 'obrona', title: 'Obrona i rakiety', group: 'Katalog' },
  { slug: 'drzewo', title: 'Drzewo technologii', group: 'Narzędzia' },
  { slug: 'szybkie-dziala', title: 'Szybkie działa', group: 'Narzędzia' },
  { slug: 'kalkulator-lotow', title: 'Kalkulator lotów', group: 'Narzędzia' },
];

function navEntries(cfg: WikiConfig | null): NavEntry[] {
  const out: NavEntry[] = ARTICLES.map((a) => ({ slug: a.slug, title: a.title, group: a.group }));
  out.push(...TOOLS);
  if (cfg) {
    for (const x of [...cfg.buildings, ...cfg.research, ...cfg.ships, ...cfg.defenses, ...cfg.missiles]) {
      out.push({ slug: x.key, title: nameOf(x.key), group: 'Obiekty' });
    }
  }
  return out;
}

/** Jedna trasa dla calej wiki: /wiki i /wiki/:slug. */
export function WikiPage() {
  const { slug = '' } = useParams();
  const cfg = useWikiConfig();
  const entries = useMemo(() => navEntries(cfg), [cfg]);
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [slug, hash, cfg]);

  const { title, body, source } = resolve(slug, cfg);
  useEffect(() => {
    document.title = `${title} – ${WIKI_NAME}`;
  }, [title]);

  return (
    <WikiFrame title={title} entries={entries} source={source}>
      {body}
    </WikiFrame>
  );
}

function resolve(slug: string, cfg: WikiConfig | null): { title: string; body: ReactNode; source?: boolean } {
  if (!slug) return { title: 'Strona główna', body: <Home cfg={cfg} /> };
  const article = articleBySlug(slug);
  if (article) {
    if (!cfg) return { title: article.title, body: <Loading /> };
    return {
      title: article.title,
      source: true,
      body: (
        <>
          <p className="wiki-lead">{article.lead(cfg)}</p>
          <Toc sections={article.sections} />
          {article.sections.map((s) => (
            <section key={s.id}>
              <h2 id={s.id}>{s.title}</h2>
              {s.body(cfg)}
            </section>
          ))}
        </>
      ),
    };
  }
  const tool = TOOLS.find((t) => t.slug === slug);
  if (tool) {
    if (!cfg) return { title: tool.title, body: <Loading /> };
    const bodies: Record<string, ReactNode> = {
      budynki: <BuildingList cfg={cfg} />,
      technologie: <ResearchList cfg={cfg} />,
      statki: <UnitList units={cfg.ships} />,
      obrona: <UnitList units={[...cfg.defenses, ...cfg.missiles]} />,
      drzewo: <TechTree cfg={cfg} />,
      'szybkie-dziala': <RapidFire cfg={cfg} />,
      'kalkulator-lotow': <FlightCalc cfg={cfg} />,
    };
    return { title: tool.title, body: bodies[slug], source: true };
  }
  if (!cfg) return { title: nameOf(slug), body: <Loading /> };
  const b = cfg.buildings.find((x) => x.key === slug);
  if (b) return { title: nameOf(slug), body: <BuildingArticle key={slug} b={b} cfg={cfg} />, source: true };
  const r = cfg.research.find((x) => x.key === slug);
  if (r) return { title: nameOf(slug), body: <ResearchArticle key={slug} r={r} cfg={cfg} />, source: true };
  const u = [...cfg.ships, ...cfg.defenses, ...cfg.missiles].find((x) => x.key === slug);
  if (u) return { title: nameOf(slug), body: <UnitArticle key={slug} u={u} cfg={cfg} />, source: true };
  return {
    title: 'Nie ma takiej strony',
    body: (
      <p>
        Strona „{slug}” nie istnieje. Wróć na <Link to={wikiPath()}>stronę główną</Link> albo użyj wyszukiwarki.
      </p>
    ),
  };
}

function Home({ cfg }: { cfg: WikiConfig | null }) {
  return (
    <>
      <div className="wiki-welcome">
        Witaj w <b>{WIKI_NAME_GEN}</b>, encyklopedii Space Pioneers Remaster. Znajdziesz tu zasady gry, dokładne wzory i tabele kosztów,
        czasów i produkcji dla każdego budynku, badania, statku i budowli obronnej. Liczby są wyliczane na bieżąco z ustawień serwera
        {cfg ? <> <b>{cfg.universeName}</b></> : null}, więc zawsze zgadzają się z grą.
      </div>
      <div className="wiki-columns">
        <div className="wiki-box">
          <h2>Dla początkujących</h2>
          <ul>
            <li><W to="pierwsze-kroki">Pierwsze kroki</W>: co budować na starcie</li>
            <li><W to="surowce">Surowce i energia</W></li>
            <li><W to="planety">Planety i kolonie</W></li>
            <li><W to="ochrona">Ochrona, urlop i nieaktywni</W></li>
          </ul>
          <h2>Zasady gry</h2>
          <ul>
            {ARTICLES.filter((a) => a.group === 'Zasady gry' && !['surowce', 'planety', 'ochrona'].includes(a.slug)).map((a) => (
              <li key={a.slug}><W to={a.slug}>{a.title}</W></li>
            ))}
          </ul>
        </div>
        <div className="wiki-box">
          <h2>Katalog</h2>
          {cfg ? (
            <>
              <p><W to="budynki">Budynki</W> ({cfg.buildings.length}) · <W to="technologie">Technologie</W> ({cfg.research.length})</p>
              <p><W to="statki">Statki</W> ({cfg.ships.length}) · <W to="obrona">Obrona i rakiety</W> ({cfg.defenses.length + cfg.missiles.length})</p>
              <div className="wiki-gallery">
                {[...cfg.ships].slice(0, 8).map((u) => <Thumb key={u.key} k={u.key} kind="ship" />)}
              </div>
            </>
          ) : (
            <Loading />
          )}
          <h2>Narzędzia</h2>
          <ul>
            <li><W to="drzewo">Drzewo technologii</W>: wszystkie wymagania w jednej tabeli</li>
            <li><W to="szybkie-dziala">Szybkie działa</W>: kto jest skuteczny przeciw komu</li>
            <li><W to="kalkulator-lotow">Kalkulator lotów</W>: czas, paliwo, ładowność</li>
            <li><a href="/simulator">Symulator walki</a> (w grze)</li>
          </ul>
        </div>
      </div>
      {cfg && (
        <div className="wiki-box">
          <h2>Ustawienia tego serwera</h2>
          <table className="wiki-table narrow">
            <tbody>
              <tr><th>Uniwersum</th><td>{cfg.universeName}: {cfg.universe.galaxies} galaktyk × {cfg.universe.systems} układów × {cfg.universe.positions} pozycji</td></tr>
              <tr><th>Prędkość ekonomii / badań / flot</th><td>×{cfg.universe.economySpeed} / ×{cfg.universe.researchSpeed} / ×{cfg.universe.fleetSpeed}</td></tr>
              <tr><th>Pole zniszczeń</th><td>{Math.round(cfg.universe.debrisRatio * 100)}% statków</td></tr>
              <tr><th>Odbudowa obrony</th><td>{Math.round(cfg.universe.defenseRebuildRate * 100)}%</td></tr>
              <tr><th>Maks. rabunek</th><td>{Math.round(cfg.universe.lootRatio * 100)}%</td></tr>
              <tr><th>Rundy walki</th><td>{cfg.universe.maxCombatRounds}</td></tr>
              <tr><th>Ochrona początkujących</th><td>poniżej {fmt(cfg.universe.newbieProtectionPoints)} pkt, przewaga ×{cfg.universe.newbieRatio}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Thumb({ k, kind }: { k: string; kind: string }) {
  const img = firstAsset([`${kind}/${k}`]);
  return (
    <Link to={wikiPath(k)} className="wiki-thumb" title={nameOf(k)}>
      {img && <img src={img} alt={nameOf(k)} />}
      <span>{nameOf(k)}</span>
    </Link>
  );
}

function BuildingList({ cfg }: { cfg: WikiConfig }) {
  const groups: [string, string][] = [['resource', 'Surowce i energia'], ['facility', 'Zabudowa'], ['storage', 'Magazyny'], ['moon', 'Księżyc']];
  return (
    <>
      <p className="wiki-lead">Wszystkie budynki. Kliknij nazwę, żeby zobaczyć pełną tabelę poziomów.</p>
      {groups.map(([cat, title]) => (
        <section key={cat}>
          <h2 id={cat}>{title}</h2>
          <ItemTable kind="building" rows={cfg.buildings.filter((b) => b.category === cat).map((b) => ({
            key: b.key, cost: b.baseCost, req: b.requirements, extra: `×${String(b.costFactor).replace('.', ',')}`,
          }))} extraTitle="Wzrost kosztu" />
        </section>
      ))}
    </>
  );
}

function ResearchList({ cfg }: { cfg: WikiConfig }) {
  return (
    <>
      <p className="wiki-lead">Wszystkie technologie. Badania są wspólne dla wszystkich planet gracza.</p>
      <ItemTable kind="research" rows={cfg.research.map((r) => ({
        key: r.key, cost: r.baseCost, req: r.requirements, extra: `×${String(r.costFactor).replace('.', ',')}`,
      }))} extraTitle="Wzrost kosztu" />
    </>
  );
}

function ItemTable({ kind, rows, extraTitle }: {
  kind: string;
  rows: { key: string; cost: WikiUnit['cost']; req: WikiUnit['requirements']; extra: string }[];
  extraTitle: string;
}) {
  return (
    <table className="wiki-table">
      <thead>
        <tr>
          <th />
          <th>Nazwa</th>
          <th>Koszt poz. 1</th>
          <th>{extraTitle}</th>
          <th>Wymagania</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const img = firstAsset([`${kind}/${r.key}`]);
          return (
            <tr key={r.key}>
              <td className="wiki-icon">{img && <Link to={wikiPath(r.key)}><img src={img} alt="" /></Link>}</td>
              <td>
                <W to={r.key} />
                <div className="muted small">{describe(r.key)}</div>
              </td>
              <td><Cost cost={r.cost} /></td>
              <td>{r.extra}</td>
              <td><Requirements req={r.req} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function UnitList({ units }: { units: WikiUnit[] }) {
  const kind = (u: WikiUnit) => (u.type === 'SHIP' ? 'ship' : 'defense');
  return (
    <>
      <p className="wiki-lead">
        Wartości bazowe, bez technologii. Każdy poziom technologii uzbrojenia, osłon i pancerza dodaje 10%.
      </p>
      <table className="wiki-table">
        <thead>
          <tr>
            <th />
            <th>Nazwa</th>
            <th>Koszt</th>
            <th>Atak</th>
            <th>Osłona</th>
            <th>Struktura</th>
            {units.some((u) => u.type === 'SHIP') && (
              <>
                <th>Ładowność</th>
                <th>Prędkość</th>
                <th>Paliwo</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {units.map((u) => {
            const img = firstAsset([`${kind(u)}/${u.key}`]);
            const ship = units.some((x) => x.type === 'SHIP');
            return (
              <tr key={u.key}>
                <td className="wiki-icon">{img && <Link to={wikiPath(u.key)}><img src={img} alt="" /></Link>}</td>
                <td><W to={u.key} /></td>
                <td><Cost cost={u.cost} /></td>
                <td>{u.type === 'MISSILE' && !u.attack ? '—' : fmt(u.attack)}</td>
                <td>{u.type === 'MISSILE' ? '—' : fmt(u.shield)}</td>
                <td>{u.type === 'MISSILE' ? '—' : fmt(baseHull(u))}</td>
                {ship && (
                  <>
                    <td>{fmt(u.cargo)}</td>
                    <td>{u.stationary || !u.speed ? '—' : fmt(u.speed)}</td>
                    <td>{u.stationary || !u.speed ? '—' : fmt(u.fuel)}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function TechTree({ cfg }: { cfg: WikiConfig }) {
  const groups: [string, { key: string; requirements: WikiUnit['requirements'] }[]][] = [
    ['Budynki', cfg.buildings],
    ['Technologie', cfg.research],
    ['Statki', cfg.ships],
    ['Obrona i rakiety', [...cfg.defenses, ...cfg.missiles]],
  ];
  return (
    <>
      <p className="wiki-lead">Co trzeba mieć, żeby zbudować lub zbadać każdy obiekt. Poziomy podano w nawiasach.</p>
      {groups.map(([title, list]) => (
        <section key={title}>
          <h2 id={title}>{title}</h2>
          <table className="wiki-table">
            <tbody>
              {list.map((x) => (
                <tr key={x.key}>
                  <td style={{ width: '35%' }}><W to={x.key} /></td>
                  <td><Requirements req={x.requirements} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}

function RapidFire({ cfg }: { cfg: WikiConfig }) {
  const units = [...cfg.ships, ...cfg.defenses];
  const shooters = units.filter((u) => Object.values(u.rapidFire ?? {}).some((v) => v > 1));
  const targets = units.filter((t) => shooters.some((s) => (s.rapidFire ?? {})[t.key] > 1));
  return (
    <>
      <p className="wiki-lead">
        Wiersz: kto strzela, kolumna: w kogo. Liczba N oznacza średnio N strzałów zamiast jednego (szansa na kolejny strzał (N−1)/N).
        Puste pole oznacza brak szybkiego działa.
      </p>
      <div className="wiki-scroll">
        <table className="wiki-table wiki-matrix">
          <thead>
            <tr>
              <th />
              {targets.map((t) => (
                <th key={t.key} title={nameOf(t.key)}>
                  <Link to={wikiPath(t.key)}>{nameOf(t.key)}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shooters.map((s) => (
              <tr key={s.key}>
                <th><W to={s.key} /></th>
                {targets.map((t) => {
                  const v = (s.rapidFire ?? {})[t.key];
                  return <td key={t.key} className={v > 1 ? 'hit' : ''}>{v > 1 ? v : ''}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="wiki-note">Jednostki bez żadnego szybkiego działa nie występują w wierszach.</p>
    </>
  );
}

function FlightCalc({ cfg }: { cfg: WikiConfig }) {
  const flying = cfg.ships.filter((u) => !u.stationary && u.speed > 0);
  const [from, setFrom] = useState('1:1:1');
  const [to, setTo] = useState('1:5:8');
  const [percent, setPercent] = useState(100);
  const [counts, setCounts] = useState<Record<string, string>>({ small_cargo: '1' });
  const [drives, setDrives] = useState<Record<string, number>>({ combustion_drive: 0, impulse_drive: 0, hyperspace_drive: 0 });
  const [warrior, setWarrior] = useState(false);
  const [trader, setTrader] = useState(false);

  const parse = (s: string): [number, number, number] | null => {
    const m = s.trim().match(/^(\d+):(\d+):(\d+)$/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const a = parse(from);
  const b = parse(to);
  const chosen = flying.map((u) => ({ u, n: Math.max(0, Math.floor(Number(counts[u.key]) || 0)) })).filter((x) => x.n > 0);
  const speed = chosen.length ? Math.min(...chosen.map((x) => unitSpeed(x.u, drives[x.u.drive ?? ''] ?? 0, warrior))) : 0;
  const dist = a && b ? distance(a, b) : 0;
  const secs = speed > 0 && dist > 0 ? flightSeconds(dist, speed, percent, cfg.universe.fleetSpeed) : 0;
  const tritium = speed > 0 && dist > 0 ? fuel(chosen.map((x) => ({ fuel: x.u.fuel, count: x.n })), dist, percent) : 0;
  const cargo = Math.floor(chosen.reduce((s, x) => s + x.n * x.u.cargo, 0) * (trader ? 1.2 : 1));

  return (
    <>
      <p className="wiki-lead">Policz czas lotu, zużycie trytu i ładowność floty. Wzory są takie same jak w grze.</p>
      <div className="wiki-calc">
        <div className="wiki-box">
          <h2>Trasa</h2>
          <label className="wiki-num">Start <input value={from} onChange={(e) => setFrom(e.target.value)} size={10} /></label>
          <label className="wiki-num">Cel <input value={to} onChange={(e) => setTo(e.target.value)} size={10} /></label>
          <label className="wiki-num">
            Prędkość{' '}
            <select value={percent} onChange={(e) => setPercent(Number(e.target.value))}>
              {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map((p) => <option key={p} value={p}>{p}%</option>)}
            </select>
          </label>
          <h2>Napędy</h2>
          {Object.keys(drives).map((d) => (
            <label key={d} className="wiki-num">
              {nameOf(d)}{' '}
              <input type="number" min={0} max={30} value={drives[d]}
                onChange={(e) => setDrives({ ...drives, [d]: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
          ))}
          <label className="wiki-num"><input type="checkbox" checked={warrior} onChange={(e) => setWarrior(e.target.checked)} /> wojownik (+10% prędkości)</label>
          <label className="wiki-num"><input type="checkbox" checked={trader} onChange={(e) => setTrader(e.target.checked)} /> handlarz (+20% ładowności)</label>
        </div>
        <div className="wiki-box">
          <h2>Flota</h2>
          <table className="wiki-table">
            <tbody>
              {flying.map((u) => (
                <tr key={u.key}>
                  <td><W to={u.key} /></td>
                  <td>
                    <input className="wiki-count" value={counts[u.key] ?? ''} placeholder="0"
                      onChange={(e) => setCounts({ ...counts, [u.key]: e.target.value })} />
                  </td>
                  <td className="muted small">{fmt(unitSpeed(u, drives[u.drive ?? ''] ?? 0, warrior))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <table className="wiki-table narrow wiki-result">
        <tbody>
          <tr><th>Odległość</th><td>{a && b ? fmt(dist) : 'podaj współrzędne w formacie g:u:p'}</td></tr>
          <tr><th>Prędkość floty</th><td>{speed ? fmt(speed) : 'wybierz statki'}</td></tr>
          <tr><th>Czas lotu (w jedną stronę)</th><td><b>{secs ? duration(secs) : '—'}</b></td></tr>
          <tr><th>Czas lotu tam i z powrotem</th><td>{secs ? duration(secs * 2) : '—'}</td></tr>
          <tr><th>Tryt</th><td><b>{tritium ? fmt(tritium) : '—'}</b></td></tr>
          <tr><th>Ładowność</th><td>{fmt(cargo)}</td></tr>
        </tbody>
      </table>
    </>
  );
}
