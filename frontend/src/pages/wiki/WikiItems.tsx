import { useState, type ReactNode } from 'react';
import { describe, nameOf } from '../../i18n';
import { firstAsset } from '../../lib/assets';
import { duration, fmt } from '../../lib/format';
import { Cost, Requirements, W } from './WikiFrame';
import {
  baseHull, buildingSeconds, costForLevel, cumulativeCost, driveBonus, fleetSlots, growthAt, marketFee, maxExpeditions,
  maxPlanets, missileRange, phalanxRange, pointsFor, researchSeconds, storageForLevel, tritiumFactor, unitSeconds,
  unitSpeed, SILO_SLOTS_PER_LEVEL, type WikiBuilding, type WikiConfig, type WikiResearch, type WikiUnit,
} from './wikiMath';

const KIND_ASSET: Record<string, string> = { building: 'building', research: 'research', SHIP: 'ship', DEFENSE: 'defense', MISSILE: 'defense' };
const LOCATION = { PLANET: 'planeta', MOON: 'księżyc', ANY: 'planeta i księżyc' };
const BRANCH: Record<string, string> = { TRADER: 'tylko handlarz', WARRIOR: 'tylko wojownik' };
const CATEGORY: Record<string, string> = { resource: 'Surowce i energia', facility: 'Zabudowa', storage: 'Magazyny', moon: 'Księżyc' };
const RES_NAME: Record<string, string> = { metal: 'metal', crystal: 'kryształ', tritium: 'tryt', METAL: 'metal', CRYSTAL: 'kryształ', TRITIUM: 'tryt' };

function Num({ label, value, onChange, max = 30 }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <label className="wiki-num">
      {label}{' '}
      <input type="number" min={0} max={max} value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))} />
    </label>
  );
}

function Infobox({ assetKind, k, rows }: { assetKind: string; k: string; rows: [string, ReactNode][] }) {
  const img = firstAsset([`${assetKind}/${k}`]);
  return (
    <table className="wiki-infobox">
      <tbody>
        <tr>
          <th colSpan={2} className="wiki-infobox-title">{nameOf(k)}</th>
        </tr>
        {img && (
          <tr>
            <td colSpan={2} className="wiki-infobox-img">
              <img src={img} alt={nameOf(k)} />
            </td>
          </tr>
        )}
        {rows.map(([a, b]) => (
          <tr key={a}>
            <th>{a}</th>
            <td>{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Co dany budynek daje na poziomie L (kolumna tabeli). */
function buildingEffect(b: WikiBuilding, l: number, cfg: WikiConfig, p: { temp: number; energy: number }): ReactNode {
  const speed = cfg.universe.economySpeed;
  if (b.production) {
    let v = growthAt(b.production, l) * speed;
    if (b.production.temperatureDependent) v *= tritiumFactor(p.temp);
    return `+${fmt(v)} / h`;
  }
  if (b.energyProduction) {
    const e = growthAt(b.energyProduction, l, p.energy);
    const t = b.tritiumUse ? ` (−${fmt(growthAt(b.tritiumUse, l) * speed)} trytu/h)` : '';
    return `+${fmt(e)} energii${t}`;
  }
  if (b.storage) return `${fmt(storageForLevel(l))} pojemności`;
  switch (b.key) {
    case 'robotics_factory':
      return `czas budowy ÷ ${l + 1}`;
    case 'nanite_factory':
      return `czas budowy i stoczni ÷ ${fmt(Math.pow(2, l))}`;
    case 'shipyard':
      return `czas produkcji ÷ ${l + 1}`;
    case 'research_lab':
      return `czas badań ÷ ${l + 1}`;
    case 'trade_center':
      return `prowizja rynku ${(marketFee(l) * 100).toFixed(1).replace('.', ',')}%`;
    case 'war_academy':
      return `atak floty +${10 + l}%`;
    case 'missile_silo':
      return `${l * SILO_SLOTS_PER_LEVEL} miejsc na rakiety`;
    case 'sensor_phalanx':
      return `zasięg ${phalanxRange(l)} ukł.`;
    default:
      return b.fieldsBonus ? `+${b.fieldsBonus * l} pól` : '—';
  }
}

function energyUseCol(b: WikiBuilding, l: number) {
  return b.energyUse ? `−${fmt(growthAt(b.energyUse, l))}` : null;
}

export function BuildingArticle({ b, cfg }: { b: WikiBuilding; cfg: WikiConfig }) {
  const [robotics, setRobotics] = useState(0);
  const [nanite, setNanite] = useState(0);
  const [temp, setTemp] = useState(40);
  const [energy, setEnergy] = useState(0);
  const max = b.maxLevel ?? 60;
  const levels = Array.from({ length: Math.min(max, 40) }, (_, i) => i + 1);
  const users = [...cfg.buildings, ...cfg.research, ...cfg.ships, ...cfg.defenses, ...cfg.missiles].filter(
    (x) => (x.requirements.buildings ?? {})[b.key] !== undefined,
  );
  return (
    <>
      <Infobox assetKind="building" k={b.key} rows={[
        ['Rodzaj', CATEGORY[b.category] ?? b.category],
        ['Gdzie', LOCATION[b.location ?? 'PLANET']],
        ['Koszt poz. 1', <Cost cost={b.baseCost} />],
        ['Wzrost kosztu', `×${String(b.costFactor).replace('.', ',')} na poziom`],
        ['Maks. poziom', b.maxLevel ? String(b.maxLevel) : 'brak limitu'],
        ...(BRANCH[b.branch] ? [['Specjalizacja', BRANCH[b.branch]] as [string, ReactNode]] : []),
        ['Wymagania', <Requirements req={b.requirements} />],
      ]} />
      <p className="wiki-lead">{describe(b.key)}</p>
      <BuildingNotes b={b} cfg={cfg} />
      {users.length > 0 && (
        <p>
          <b>Odblokowuje:</b>{' '}
          {users.map((u, i) => (
            <span key={u.key}>
              {i > 0 && ', '}
              <W to={u.key} /> (poz. {u.requirements.buildings[b.key]})
            </span>
          ))}
        </p>
      )}
      <h2 id="poziomy">Koszty i czasy poziomów</h2>
      <div className="wiki-controls">
        Czas liczony dla: <Num label="Fabryka robotów" value={robotics} onChange={setRobotics} />
        <Num label="Fabryka nanitów" value={nanite} onChange={setNanite} max={15} />
        {b.production?.temperatureDependent && <Num label="Temp. maks. planety (°C)" value={temp} onChange={setTemp} max={300} />}
        {b.energyProduction?.techBonusKey && <Num label="Technologia energetyczna" value={energy} onChange={setEnergy} />}
      </div>
      <table className="wiki-table">
        <thead>
          <tr>
            <th>Poz.</th>
            <th>Metal</th>
            <th>Kryształ</th>
            <th>Tryt</th>
            <th>Czas budowy</th>
            <th>Efekt</th>
            {b.energyUse && <th>Energia</th>}
            <th>Punkty (łącznie)</th>
          </tr>
        </thead>
        <tbody>
          {levels.map((l) => {
            const c = costForLevel(b.baseCost, b.costFactor, l);
            return (
              <tr key={l}>
                <td className="c">{l}</td>
                <td>{fmt(c.metal)}</td>
                <td>{fmt(c.crystal)}</td>
                <td>{fmt(c.tritium)}</td>
                <td>{duration(buildingSeconds(c, robotics, nanite, cfg.universe.economySpeed))}</td>
                <td>{buildingEffect(b, l, cfg, { temp, energy })}</td>
                {b.energyUse && <td>{energyUseCol(b, l)}</td>}
                <td>{fmt(pointsFor(cumulativeCost(b.baseCost, b.costFactor, l)))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="wiki-note">
        Rozbiórka poziomu kosztuje połowę jego ceny i trwa połowę czasu budowy. Każdy poziom zajmuje jedno pole planety.
      </p>
    </>
  );
}

function BuildingNotes({ b, cfg }: { b: WikiBuilding; cfg: WikiConfig }) {
  const speed = cfg.universe.economySpeed;
  if (b.production) {
    return (
      <p>
        Wydobycie na godzinę: <code>{b.production.base} · L · {String(b.production.growth).replace('.', ',')}<sup>L</sup></code>
        {speed !== 1 && <> × prędkość ekonomii ({speed})</>}
        {b.production.temperatureDependent && <> × współczynnik temperatury <code>1,44 − 0,004 · Tmax</code> (min. 0,1)</>}.
        Kopalnia zużywa energię <code>{b.energyUse?.base} · L · {String(b.energyUse?.growth).replace('.', ',')}<sup>L</sup></code>. Gdy
        energii brakuje, wszystkie kopalnie pracują proporcjonalnie słabiej. Zobacz <W to="surowce">Surowce i energia</W>.
      </p>
    );
  }
  if (b.energyProduction) {
    return (
      <p>
        Energia: <code>{b.energyProduction.base} · L · {String(b.energyProduction.growth).replace('.', ',')}<sup>L</sup></code>
        {b.energyProduction.techBonusKey && (
          <>, a każdy poziom <W to={b.energyProduction.techBonusKey}>technologii energetycznej</W> podnosi podstawę potęgi o{' '}
            {String(b.energyProduction.techBonusPerLevel).replace('.', ',')}</>
        )}
        .{b.tritiumUse && <> Elektrownia spala tryt: <code>{b.tritiumUse.base} · L · {String(b.tritiumUse.growth).replace('.', ',')}<sup>L</sup></code> na godzinę.</>}
      </p>
    );
  }
  if (b.storage) {
    return (
      <p>
        Pojemność: <code>10 000 · 1,8<sup>L</sup></code> ({RES_NAME[b.storage.resource]}). Bez magazynu planeta mieści 10 000. Po zapełnieniu
        wydobycie tego surowca staje, ale dostawy flotą i łupy mogą przekroczyć limit.
      </p>
    );
  }
  return null;
}

function researchEffect(r: WikiResearch, l: number): string {
  switch (r.key) {
    case 'weapons_tech':
      return `atak +${l * 10}%`;
    case 'shielding_tech':
      return `osłony +${l * 10}%`;
    case 'armour_tech':
      return `struktura +${l * 10}%`;
    case 'combustion_drive':
    case 'impulse_drive':
    case 'hyperspace_drive':
      return `prędkość +${Math.round(driveBonus(r.key) * l * 100)}%${r.key === 'impulse_drive' ? `, rakiety ${missileRange(l)} ukł.` : ''}`;
    case 'computer_tech':
      return `${fleetSlots(l)} flot naraz`;
    case 'astrophysics':
      return `${maxPlanets(l)} planet, ${maxExpeditions(l)} ekspedycji`;
    case 'energy_tech':
      return `elektr. fuzyjna: podstawa ${(1.05 + 0.01 * l).toFixed(2).replace('.', ',')}`;
    default:
      return '—';
  }
}

export function ResearchArticle({ r, cfg }: { r: WikiResearch; cfg: WikiConfig }) {
  const [lab, setLab] = useState(1);
  const max = r.maxLevel ?? 40;
  const levels = Array.from({ length: Math.min(max, 25) }, (_, i) => i + 1);
  const users = [...cfg.buildings, ...cfg.research, ...cfg.ships, ...cfg.defenses, ...cfg.missiles].filter(
    (x) => (x.requirements.research ?? {})[r.key] !== undefined,
  );
  const drives = [...cfg.ships].filter((u) => u.drive === r.key);
  return (
    <>
      <Infobox assetKind="research" k={r.key} rows={[
        ['Koszt poz. 1', <Cost cost={r.baseCost} />],
        ['Wzrost kosztu', `×${String(r.costFactor).replace('.', ',')} na poziom`],
        ['Wymagania', <Requirements req={r.requirements} />],
      ]} />
      <p className="wiki-lead">{describe(r.key)}</p>
      <ResearchNotes r={r} />
      {drives.length > 0 && (
        <p>
          <b>Statki z tym napędem:</b>{' '}
          {drives.map((u, i) => (
            <span key={u.key}>
              {i > 0 && ', '}
              <W to={u.key} />
            </span>
          ))}
        </p>
      )}
      {users.length > 0 && (
        <p>
          <b>Odblokowuje:</b>{' '}
          {users.map((u, i) => (
            <span key={u.key}>
              {i > 0 && ', '}
              <W to={u.key} /> (poz. {u.requirements.research[r.key]})
            </span>
          ))}
        </p>
      )}
      <h2 id="poziomy">Koszty i czasy poziomów</h2>
      <div className="wiki-controls">
        Czas liczony dla: <Num label="Laboratorium badawcze" value={lab} onChange={setLab} />
      </div>
      <table className="wiki-table">
        <thead>
          <tr>
            <th>Poz.</th>
            <th>Metal</th>
            <th>Kryształ</th>
            <th>Tryt</th>
            <th>Czas badania</th>
            <th>Efekt</th>
            <th>Punkty (łącznie)</th>
          </tr>
        </thead>
        <tbody>
          {levels.map((l) => {
            const c = costForLevel(r.baseCost, r.costFactor, l);
            return (
              <tr key={l}>
                <td className="c">{l}</td>
                <td>{fmt(c.metal)}</td>
                <td>{fmt(c.crystal)}</td>
                <td>{fmt(c.tritium)}</td>
                <td>{duration(researchSeconds(c, lab, cfg.universe.researchSpeed))}</td>
                <td>{researchEffect(r, l)}</td>
                <td>{fmt(pointsFor(cumulativeCost(r.baseCost, r.costFactor, l)))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="wiki-note">
        Badania są wspólne dla całego imperium. Naraz trwa jedno badanie, a w trakcie badania nie można rozbudowywać laboratorium,
        w którym jest prowadzone.
      </p>
    </>
  );
}

function ResearchNotes({ r }: { r: WikiResearch }) {
  switch (r.key) {
    case 'weapons_tech':
    case 'shielding_tech':
    case 'armour_tech':
      return <p>Bonus działa na wszystkie statki, obronę i (w przypadku uzbrojenia) rakiety międzyplanetarne. Zobacz <W to="walka">Walka</W>.</p>;
    case 'computer_tech':
      return <p>Liczba flot, które mogą być jednocześnie w powietrzu, to <code>1 + poziom</code>. Rakiety nie zajmują slotów.</p>;
    case 'astrophysics':
      return (
        <p>
          Liczba planet (z macierzystą) to <code>1 + ⌈poziom / 2⌉</code>, najwyżej 9. Jednocześnie można prowadzić{' '}
          <code>⌊√poziom⌋</code> <W to="ekspedycje">ekspedycji</W>.
        </p>
      );
    case 'espionage_tech':
      return <p>Przewaga technologii działa kwadratowo, w obie strony. Szczegóły w artykule <W to="szpiegostwo">Szpiegostwo</W>.</p>;
    case 'hyperspace_tech':
      return <p>Poziom 7 jest potrzebny do budowy <W to="jump_gate">teleportera</W> na księżycu.</p>;
    default:
      return null;
  }
}

export function UnitArticle({ u, cfg }: { u: WikiUnit; cfg: WikiConfig }) {
  const [shipyard, setShipyard] = useState(1);
  const [nanite, setNanite] = useState(0);
  const all = [...cfg.ships, ...cfg.defenses];
  const from = all.filter((x) => (x.rapidFire ?? {})[u.key] > 1);
  const against = Object.entries(u.rapidFire ?? {}).filter(([, v]) => v > 1);
  const flies = u.type === 'SHIP' && !u.stationary && u.speed > 0;
  const kind = u.type === 'SHIP' ? 'Statek' : u.type === 'DEFENSE' ? 'Obrona' : 'Rakieta';
  const rows: [string, ReactNode][] = [
    ['Rodzaj', kind],
    ['Koszt', <Cost cost={u.cost} />],
    ['Wymagania', <Requirements req={u.requirements} />],
  ];
  if (u.type !== 'MISSILE') {
    rows.push(['Atak', fmt(u.attack)], ['Osłona', fmt(u.shield)], ['Struktura', fmt(baseHull(u))]);
  } else {
    rows.push(['Miejsca w silosie', String(u.missileSlots ?? 1)]);
    if (u.attack) rows.push(['Siła rażenia', fmt(u.attack)]);
  }
  if (flies) {
    rows.push(['Ładowność', fmt(u.cargo)], ['Prędkość bazowa', fmt(u.speed)], ['Napęd', u.drive ? <W to={u.drive} /> : '—'],
      ['Zużycie paliwa', fmt(u.fuel)]);
  }
  if (u.maxCount) rows.push(['Limit', `${u.maxCount} na planetę`]);
  if (BRANCH[u.branch]) rows.push(['Specjalizacja', BRANCH[u.branch]]);
  rows.push(['Punkty', fmt(pointsFor(u.cost))]);
  const sec = unitSeconds(u.cost, shipyard, nanite, cfg.universe.economySpeed);
  return (
    <>
      <Infobox assetKind={KIND_ASSET[u.type]} k={u.key} rows={rows} />
      <p className="wiki-lead">{describe(u.key)}</p>
      <UnitNotes u={u} />
      <h2 id="produkcja">Produkcja</h2>
      <div className="wiki-controls">
        <Num label="Stocznia" value={shipyard} onChange={setShipyard} />
        <Num label="Fabryka nanitów" value={nanite} onChange={setNanite} max={15} />
        <span>
          → jedna sztuka: <b>{duration(sec)}</b>, 10 sztuk: <b>{duration(sec * 10)}</b>, 100 sztuk: <b>{duration(sec * 100)}</b>
        </span>
      </div>
      {u.type !== 'MISSILE' && (
        <>
          <h2 id="szybkie-dziala">Szybkie działa</h2>
          {against.length === 0 && from.length === 0 && <p>Ta jednostka nie ma szybkich dział i nikt nie ma ich przeciw niej.</p>}
          {against.length > 0 && (
            <p>
              <b>Strzela szybko w:</b>{' '}
              {against.map(([k, v], i) => (
                <span key={k}>
                  {i > 0 && ', '}
                  <W to={k} /> ({v})
                </span>
              ))}
            </p>
          )}
          {from.length > 0 && (
            <p>
              <b>Szybkie działa przeciw niej mają:</b>{' '}
              {from.map((x, i) => (
                <span key={x.key}>
                  {i > 0 && ', '}
                  <W to={x.key} /> ({x.rapidFire[u.key]})
                </span>
              ))}
            </p>
          )}
          <p className="wiki-note">
            Wartość N oznacza, że po strzale w taki cel jednostka strzela ponownie z szansą (N−1)/N, czyli średnio N strzałów zamiast
            jednego. Zobacz <W to="walka">Walka</W>.
          </p>
        </>
      )}
      {flies && (
        <>
          <h2 id="predkosc">Prędkość wg poziomu napędu</h2>
          <table className="wiki-table narrow">
            <thead>
              <tr>
                <th>{u.drive ? nameOf(u.drive) : 'Napęd'}</th>
                {[0, 2, 4, 6, 8, 10, 12, 15].map((l) => (
                  <th key={l}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Prędkość</td>
                {[0, 2, 4, 6, 8, 10, 12, 15].map((l) => (
                  <td key={l}>{fmt(unitSpeed(u, l))}</td>
                ))}
              </tr>
              <tr>
                <td>Wojownik</td>
                {[0, 2, 4, 6, 8, 10, 12, 15].map((l) => (
                  <td key={l}>{fmt(unitSpeed(u, l, true))}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="wiki-note">
            Policz czas lotu i paliwo w <W to="kalkulator-lotow">kalkulatorze lotów</W>.
          </p>
        </>
      )}
    </>
  );
}

function UnitNotes({ u }: { u: WikiUnit }) {
  switch (u.key) {
    case 'espionage_probe':
      return <p>Tylko sondy mogą lecieć na misję szpiegowską. Więcej sond i wyższa technologia dają pełniejszy raport. Zobacz <W to="szpiegostwo">Szpiegostwo</W>.</p>;
    case 'colony_ship':
      return <p>Zakłada kolonię na wolnej pozycji i zostaje zużyty. Limit planet zależy od <W to="astrophysics">astrofizyki</W>. Zobacz <W to="planety">Planety i kolonie</W>.</p>;
    case 'recycler':
      return <p>Jedyny statek, który zbiera <W to="walka">pole zniszczeń</W> (misja Recykling). Inne statki we flocie lecą jako eskorta.</p>;
    case 'solar_satellite':
      return (
        <p>
          Nie lata. Daje <code>⌊(Tmax + 140) / 6⌋</code> energii (min. 1), więc najlepiej sprawdza się na gorących planetach blisko gwiazdy.
          W walce jest zwykłym celem, a zniszczone satelity tworzą pole zniszczeń.
        </p>
      );
    case 'interplanetary_missile':
      return <p>Wystrzeliwana z silosu na planety w zasięgu <code>5 · napęd impulsowy − 1</code> układów. Niszczy wyłącznie obronę. Zobacz <W to="rakiety">Rakiety</W>.</p>;
    case 'anti_ballistic_missile':
      return <p>Każda rakieta przechwytująca niszczy jedną nadlatującą rakietę międzyplanetarną. Zobacz <W to="rakiety">Rakiety</W>.</p>;
    case 'small_shield_dome':
    case 'large_shield_dome':
      return <p>Można mieć tylko jedną taką kopułę na planecie. Jak każda obrona, po walce ma szansę na odbudowę.</p>;
    default:
      return u.type === 'DEFENSE' ? <p>Obrona nie lata i broni tylko swojej planety. Po walce każda zniszczona sztuka ma szansę na odbudowę.</p> : null;
  }
}
