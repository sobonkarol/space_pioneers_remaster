import type { ReactNode } from 'react';
import { fmt } from '../../lib/format';
import { W } from './WikiFrame';
import {
  fieldRange, MAX_BUDDIES, MAX_BUILD_QUEUE, MAX_EXPEDITION_HOURS, MAX_HOLD_HOURS, MOON_MAX_CHANCE, PHALANX_SCAN_COST,
  planetType, satelliteEnergy, storageForLevel, temperatureRange, tritiumFactor, type WikiConfig,
} from './wikiMath';

export interface Section {
  id: string;
  title: string;
  body: (cfg: WikiConfig) => ReactNode;
}

export interface Article {
  slug: string;
  title: string;
  group: 'Poradniki' | 'Zasady gry';
  lead: (cfg: WikiConfig) => ReactNode;
  sections: Section[];
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const num = (v: number) => String(v).replace('.', ',');

export const ARTICLES: Article[] = [
  {
    slug: 'pierwsze-kroki',
    title: 'Pierwsze kroki',
    group: 'Poradniki',
    lead: () => (
      <>
        Poradnik dla nowego gracza: co budować w pierwszych dniach, żeby gospodarka rosła szybko, a planeta nie stała się łatwym łupem.
        Wszystko poniżej to sprawdzona kolejność, a nie jedyna słuszna droga.
      </>
    ),
    sections: [
      {
        id: 'start',
        title: 'Na starcie',
        body: (cfg) => (
          <>
            <p>
              Zaczynasz z planetą macierzystą o 163 polach, 500 metalu i 500 kryształu. Planeta bez żadnej kopalni wytwarza{' '}
              {fmt(30 * cfg.universe.economySpeed)} metalu i {fmt(15 * cfg.universe.economySpeed)} kryształu na godzinę. Przez pierwsze dni
              jesteś pod <W to="ochrona">ochroną początkujących</W>, ale ochrona znika, gdy przekroczysz{' '}
              {fmt(cfg.universe.newbieProtectionPoints)} punktów.
            </p>
            <p>
              Kolejka budowy mieści {MAX_BUILD_QUEUE} pozycji. Koszt pobierany jest od razu przy dodaniu do kolejki, więc kolejkę planuj
              pod surowce, które masz, a nie pod te, które dopiero będą.
            </p>
          </>
        ),
      },
      {
        id: 'kolejnosc',
        title: 'Kolejność budowy',
        body: () => (
          <ol>
            <li>
              <W to="metal_mine" /> 1 → <W to="solar_plant" /> 1 → <W to="metal_mine" /> 2 → <W to="crystal_mine" /> 1. Pilnuj, żeby
              energia nie spadła poniżej zera. Ujemny bilans energii zmniejsza wydobycie wszystkich kopalń jednocześnie.
            </li>
            <li>
              Kopalnie metalu i kryształu do poziomu 4–5, z elektrownią na bieżąco. Metal jest najtańszy w wydobyciu, ale potrzebujesz
              go najwięcej.
            </li>
            <li>
              <W to="tritium_synthesizer" /> 2–3, bo bez trytu nie polecisz flotą. Zimna planeta (daleka pozycja) daje więcej trytu.
            </li>
            <li>
              <W to="robotics_factory" /> 2 (skraca czas budowy) i <W to="shipyard" /> 1–2, potem <W to="research_lab" /> 1.
            </li>
            <li>
              Pierwsze badania: <W to="energy_tech" />, <W to="combustion_drive" /> 2 (odblokowuje <W to="small_cargo">mały transporter</W>) i{' '}
              <W to="computer_tech" /> (więcej flot naraz).
            </li>
            <li>
              Magazyny buduj, zanim się zapełnią. Pełny magazyn zatrzymuje wydobycie danego surowca. Pojemność bez magazynu to{' '}
              {fmt(storageForLevel(0))}, na poziomie 1 to {fmt(storageForLevel(1))}.
            </li>
          </ol>
        ),
      },
      {
        id: 'bezpieczenstwo',
        title: 'Jak nie stracić surowców',
        body: () => (
          <ul>
            <li>
              Silniejszy gracz zabiera w ataku do połowy surowców leżących na planecie. Gdy idziesz spać, wydaj surowce albo wyślij je
              transportem w długi lot (flota w locie jest bezpieczna).
            </li>
            <li>
              Gdy leci na Ciebie wroga flota, na każdej stronie gry pojawia się czerwony pasek z odliczaniem (zob.{' '}
              <W to="floty#alarm">alarm o ataku</W>). Masz wtedy czas, żeby wydać surowce albo odesłać flotę.
            </li>
            <li>
              Trochę obrony (<W to="rocket_launcher" />, <W to="light_laser" />) zniechęca słabszych napastników. Sama obrona nie
              powstrzyma dużej floty, ale sprawia, że atak przestaje się opłacać.
            </li>
            <li>
              Wysyłaj <W to="espionage_probe">sondy</W> do sąsiadów, zanim ich zaatakujesz, i licz bitwę w{' '}
              <a href="/simulator">symulatorze walki</a>.
            </li>
            <li>
              Wyjazd? Włącz <W to="ochrona">tryb urlopowy</W> (minimum 48 h). Przez ten czas nikt Cię nie zaatakuje, ale planety nie
              produkują.
            </li>
          </ul>
        ),
      },
      {
        id: 'dalej',
        title: 'Co dalej',
        body: () => (
          <p>
            Po kilku dniach: kolonie (<W to="planety">Planety i kolonie</W>), <W to="large_cargo">duże transportery</W> do przewozu
            surowców, sojusz (<W to="sojusze">Sojusze</W>) i wybór <W to="specjalizacje">specjalizacji</W>. Kto woli walkę, zaczyna od{' '}
            <W to="light_fighter">lekkich myśliwców</W> i najazdów na nieaktywnych graczy (w galaktyce oznaczonych literą i/I).
          </p>
        ),
      },
    ],
  },
  {
    slug: 'surowce',
    title: 'Surowce i energia',
    group: 'Zasady gry',
    lead: () => (
      <>
        W grze są trzy surowce: <b>metal</b>, <b>kryształ</b> i <b>tryt</b>, oraz <b>energia</b>, której nie da się magazynować.
        Wszystkie ceny w grze podawane są w tych trzech surowcach.
      </>
    ),
    sections: [
      {
        id: 'wydobycie',
        title: 'Wydobycie',
        body: (cfg) => (
          <>
            <p>
              Kopalnia na poziomie L wydobywa na godzinę <code>podstawa · L · 1,1<sup>L</sup></code>: metal 30, kryształ 20, tryt 10.
              Do tego każda planeta (nie księżyc) ma produkcję podstawową 30 metalu i 15 kryształu.
              {cfg.universe.economySpeed !== 1 && <> Wszystko mnożone jest przez prędkość ekonomii serwera ({num(cfg.universe.economySpeed)}).</>}
            </p>
            <p>
              Tryt zależy od temperatury planety: wydobycie mnoży się przez <code>1,44 − 0,004 · Tmax</code> (min. 0,1). Przykład:
              planeta o Tmax 100°C daje ×{num(tritiumFactor(100))}, a planeta o Tmax −100°C daje ×{num(tritiumFactor(-100))}.
            </p>
            <p>
              Każdą kopalnię i elektrownię można w zakładce <i>Surowce</i> ustawić na 0–100% (co 10%). Mniejszy procent oznacza
              proporcjonalnie mniejsze wydobycie i mniejsze zużycie energii.
            </p>
          </>
        ),
      },
      {
        id: 'energia',
        title: 'Energia',
        body: () => (
          <>
            <p>Źródła energii:</p>
            <ul>
              <li>
                <W to="solar_plant" />: <code>20 · L · 1,1<sup>L</sup></code>, bez kosztów utrzymania.
              </li>
              <li>
                <W to="fusion_plant" />: <code>30 · L · (1,05 + 0,01 · techn. energetyczna)<sup>L</sup></code>, spala tryt.
              </li>
              <li>
                <W to="solar_satellite" />: <code>⌊(Tmax + 140) / 6⌋</code> na sztukę (np. przy Tmax 40°C {satelliteEnergy(40)}, przy
                Tmax −60°C {satelliteEnergy(-60)}).
              </li>
            </ul>
            <p>
              Kopalnie zużywają energię: metal i kryształ <code>10 · L · 1,1<sup>L</sup></code>, tryt <code>20 · L · 1,1<sup>L</sup></code>.
              Gdy zużycie przekracza produkcję, wszystkie kopalnie pracują z wydajnością <b>produkcja ÷ zużycie</b>. Przy 80 energii i
              100 zużycia każda kopalnia daje 80% wydobycia.
            </p>
          </>
        ),
      },
      {
        id: 'magazyny',
        title: 'Magazyny',
        body: () => (
          <p>
            Pojemność: <code>10 000 · 1,8<sup>L</sup></code> dla każdego surowca osobno (<W to="metal_storage" />,{' '}
            <W to="crystal_storage" />, <W to="tritium_tank" />). Po zapełnieniu wydobycie danego surowca staje. Nadwyżka z transportu,
            łupów albo ekspedycji nie przepada, ale dopóki stan jest powyżej limitu, kopalnia nic nie dokłada.
          </p>
        ),
      },
      {
        id: 'wartosc',
        title: 'Wartość surowców',
        body: () => (
          <p>
            W handlu przyjmuje się kurs <b>3 : 2 : 1</b> (metal : kryształ : tryt). Taki kurs stosuje rynek handlarzy, zob.{' '}
            <W to="specjalizacje">Specjalizacje</W>. Punkty rankingowe liczą wszystkie trzy surowce po równo.
          </p>
        ),
      },
    ],
  },
  {
    slug: 'planety',
    title: 'Planety i kolonie',
    group: 'Zasady gry',
    lead: (cfg) => (
      <>
        Uniwersum <b>{cfg.universeName}</b> ma {cfg.universe.galaxies} galaktyk po {cfg.universe.systems} układów, a w każdym układzie{' '}
        {cfg.universe.positions} pozycji. Współrzędne zapisuje się jako <code>galaktyka:układ:pozycja</code>, np. <code>1:42:8</code>.
      </>
    ),
    sections: [
      {
        id: 'pozycje',
        title: 'Pozycja a planeta',
        body: (cfg) => (
          <>
            <p>
              Pozycja decyduje o typie planety, liczbie pól (dla kolonii) i temperaturze. Pola ograniczają liczbę poziomów budynków:
              każdy poziom zajmuje jedno pole. Planeta macierzysta ma zawsze 163 pola.
            </p>
            <table className="wiki-table narrow">
              <thead>
                <tr>
                  <th>Pozycja</th>
                  <th>Typ</th>
                  <th>Pola kolonii</th>
                  <th>Tmax (°C)</th>
                  <th>Tryt ×</th>
                  <th>Satelita (energia)</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: cfg.universe.positions }, (_, i) => i + 1).map((p) => {
                  const [f0, f1] = fieldRange(p);
                  const [t0, t1] = temperatureRange(p);
                  const mid = (t0 + t1) / 2;
                  return (
                    <tr key={p}>
                      <td className="c">{p}</td>
                      <td>{planetType(p)}</td>
                      <td>{f0}–{f1}</td>
                      <td>{t0} … {t1}</td>
                      <td>{num(Math.round(tritiumFactor(mid) * 100) / 100)}</td>
                      <td>{satelliteEnergy(mid)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="wiki-note">Tryt i satelity podano dla środka zakresu temperatur. Temperatura minimalna jest o 40°C niższa od maksymalnej.</p>
          </>
        ),
      },
      {
        id: 'kolonizacja',
        title: 'Kolonizacja',
        body: () => (
          <>
            <p>
              Kolonię zakłada <W to="colony_ship" /> wysłany na wolną pozycję misją <i>Kolonizacja</i>. Statek zostaje zużyty, a
              surowce, które wiózł, trafiają na nową planetę. Liczba planet (z macierzystą) wynosi <code>1 + ⌈astrofizyka / 2⌉</code>,
              najwyżej 9:
            </p>
            <table className="wiki-table narrow">
              <thead>
                <tr>
                  <th><W to="astrophysics" /></th>
                  {[0, 1, 3, 5, 7, 9, 11, 13, 15].map((l) => <th key={l}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Planet</td>
                  {[0, 1, 3, 5, 7, 9, 11, 13, 15].map((l) => <td key={l}>{Math.min(9, 1 + Math.floor((l + 1) / 2))}</td>)}
                </tr>
              </tbody>
            </table>
            <p>
              Kolonię można porzucić w zakładce <i>Przegląd</i>, jeśli nie trwa na niej budowa ani produkcja i nie lecą do niej ani z
              niej floty. Planety macierzystej porzucić nie można.
            </p>
          </>
        ),
      },
      {
        id: 'pola',
        title: 'Więcej pól',
        body: () => (
          <p>
            <W to="terraformer" /> dodaje 5 pól za poziom (sam zajmuje jedno, więc netto +4). Na księżycu pola daje{' '}
            <W to="lunar_base" />: +3 za poziom.
          </p>
        ),
      },
    ],
  },
  {
    slug: 'budowa',
    title: 'Budowa, badania i stocznia',
    group: 'Zasady gry',
    lead: () => <>Jak długo trwa budowa, jak działają kolejki i co można anulować.</>,
    sections: [
      {
        id: 'koszty',
        title: 'Koszty poziomów',
        body: () => (
          <p>
            Koszt poziomu L to <code>koszt bazowy · współczynnik<sup>L−1</sup></code>. Współczynnik różni się między budynkami: kopalnie
            mają 1,5–1,6, a większość budynków i badań 2. Pełne tabele są na stronie każdego obiektu w <W to="budynki">katalogu</W>.
          </p>
        ),
      },
      {
        id: 'czasy',
        title: 'Czasy',
        body: (cfg) => (
          <>
            <ul>
              <li>
                Budynki: <code>(metal + kryształ) / (2500 · (1 + fabryka robotów) · 2<sup>fabryka nanitów</sup>)</code> godzin.
              </li>
              <li>
                Badania: <code>(metal + kryształ) / (1000 · (1 + laboratorium))</code> godzin.
              </li>
              <li>
                Statki i obrona (jedna sztuka): <code>(metal + kryształ) / (2500 · (1 + stocznia) · 2<sup>fabryka nanitów</sup>)</code> godzin.
              </li>
            </ul>
            <p>
              Tryt nie wpływa na czas.
              {(cfg.universe.economySpeed !== 1 || cfg.universe.researchSpeed !== 1) && (
                <> Na tym serwerze czasy budowy dzieli się przez {num(cfg.universe.economySpeed)}, a badań przez {num(cfg.universe.researchSpeed)}.</>
              )}{' '}
              Najkrótszy możliwy czas to 1 sekunda.
            </p>
          </>
        ),
      },
      {
        id: 'kolejki',
        title: 'Kolejki',
        body: () => (
          <ul>
            <li>
              Budowa: do {MAX_BUILD_QUEUE} pozycji na planetę. Koszt jest pobierany przy dodaniu do kolejki, a anulowanie zwraca go w
              całości.
            </li>
            <li>
              Rozbiórka: kosztuje połowę ceny poziomu i trwa połowę czasu jego budowy. Zwalnia pole.
            </li>
            <li>
              Badania: jedno naraz dla całego imperium, prowadzone na wybranej planecie. Laboratorium tej planety nie może być w tym czasie
              rozbudowywane.
            </li>
            <li>
              Stocznia: zamówienia realizowane są po kolei, jednostki pojawiają się na planecie pojedynczo. Stoczni ani fabryki nanitów nie
              można rozbudowywać w trakcie produkcji.
            </li>
          </ul>
        ),
      },
    ],
  },
  {
    slug: 'floty',
    title: 'Floty i misje',
    group: 'Zasady gry',
    lead: () => <>Wszystko o wysyłaniu flot: sloty, prędkość, paliwo, misje i zawracanie.</>,
    sections: [
      {
        id: 'sloty',
        title: 'Sloty flot',
        body: () => (
          <p>
            Naraz może latać <code>1 + poziom</code> <W to="computer_tech">technologii komputerowej</W> flot. Liczy się każda flota w powietrzu, także wracająca i
            stacjonująca u sojusznika. Rakiety nie zajmują slotów.
          </p>
        ),
      },
      {
        id: 'odleglosc',
        title: 'Odległość i czas lotu',
        body: (cfg) => (
          <>
            <table className="wiki-table narrow">
              <thead>
                <tr>
                  <th>Cel</th>
                  <th>Odległość</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>inna galaktyka</td><td><code>20 000 · |Δ galaktyk|</code></td></tr>
                <tr><td>inny układ</td><td><code>2 700 + 95 · |Δ układów|</code></td></tr>
                <tr><td>ten sam układ</td><td><code>1 000 + 5 · |Δ pozycji|</code></td></tr>
                <tr><td>planeta ↔ jej księżyc</td><td><code>5</code></td></tr>
              </tbody>
            </table>
            <p>
              Czas lotu w jedną stronę (sekundy): <code>(35 000 / prędkość% · √(10 · odległość / v) + 10)</code>
              {cfg.universe.fleetSpeed !== 1 && <code> / {num(cfg.universe.fleetSpeed)}</code>}, gdzie <i>v</i> to prędkość najwolniejszego
              statku we flocie, a <i>prędkość%</i> to ustawienie 10–100%. Każdy poziom napędu przyspiesza statki o nim: spalinowy +10%,
              impulsowy +20%, nadprzestrzenny +30%. Wojownik ma dodatkowe +10%.
            </p>
          </>
        ),
      },
      {
        id: 'paliwo',
        title: 'Paliwo',
        body: () => (
          <p>
            Tryt na lot w jedną stronę: <code>1 + Σ (liczba · zużycie statku · odległość / 35 000 · (prędkość%/100 + 1)²)</code>. Lot na
            50% prędkości spala więc tylko ok. 56% paliwa potrzebnego na lot z pełną prędkością. Paliwo pobierane jest raz, przy
            starcie, i nie zajmuje ładowni; powrót nic nie kosztuje. Policz to w{' '}
            <W to="kalkulator-lotow">kalkulatorze lotów</W>.
          </p>
        ),
      },
      {
        id: 'misje',
        title: 'Misje',
        body: () => (
          <table className="wiki-table">
            <thead>
              <tr>
                <th>Misja</th>
                <th>Cel</th>
                <th>Opis</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Atak</td><td>obca planeta lub księżyc</td><td>Walka z flotą i obroną celu, potem rabunek. Zob. <W to="walka">Walka</W>.</td></tr>
              <tr><td>Atak sojuszniczy</td><td>jak atak</td><td>Do 8 flot różnych graczy uderza razem. Zob. <W to="sojusze">Sojusze</W>.</td></tr>
              <tr><td>Transport</td><td>dowolna planeta</td><td>Dostarcza ładunek i wraca. Działa też do innych graczy.</td></tr>
              <tr><td>Stacjonowanie</td><td>własna planeta lub księżyc</td><td>Flota zostaje u celu razem z ładunkiem.</td></tr>
              <tr><td>Obrona</td><td>planeta sojusznika lub znajomego</td><td>Flota stoi u celu 1–{MAX_HOLD_HOURS} h i walczy po stronie obrońcy.</td></tr>
              <tr><td>Szpiegostwo</td><td>obca planeta lub księżyc</td><td>Tylko sondy. Zob. <W to="szpiegostwo">Szpiegostwo</W>.</td></tr>
              <tr><td>Kolonizacja</td><td>wolna pozycja</td><td>Wymaga <W to="colony_ship">statku kolonizacyjnego</W>.</td></tr>
              <tr><td>Recykling</td><td>pole zniszczeń</td><td>Wymaga <W to="recycler">recyklerów</W>, zbierają tylko one.</td></tr>
              <tr><td>Ekspedycja</td><td>pozycja 16 układu</td><td>Zob. <W to="ekspedycje">Ekspedycje</W>.</td></tr>
            </tbody>
          </table>
        ),
      },
      {
        id: 'zawracanie',
        title: 'Zawracanie',
        body: () => (
          <p>
            Lecącą flotę można zawrócić w zakładce <i>Flota</i>. Wraca tyle samo czasu, ile już leciała, a paliwo nie jest zwracane. Flotę stacjonującą u sojusznika (misja Obrona) też można odwołać. Rakiet zawrócić się nie da.
          </p>
        ),
      },
      {
        id: 'alarm',
        title: 'Alarm o ataku',
        body: () => (
          <>
            <p>
              Gdy na którąkolwiek Twoją planetę lub księżyc leci obca flota z misją <i>Atak</i> (także atak sojuszniczy) albo
              rakiety międzyplanetarne, na górze <b>każdej strony gry</b> pojawia się czerwony, pulsujący pasek. Pokazuje:
            </p>
            <ul>
              <li>nazwę napastnika i cel (nazwę planety i współrzędne),</li>
              <li>odliczanie do uderzenia i godzinę uderzenia,</li>
              <li>przy kilku atakach trzy najbliższe i liczbę pozostałych.</li>
            </ul>
            <p>
              Nadlatujące <W to="espionage_probe">sondy szpiegowskie</W> dają żółty pasek. Przy <i>Przeglądzie</i> w menu pojawia
              się czerwony licznik ataków, a tytuł karty przeglądarki zmienia się na <b>⚠ ATAK!</b>, więc alarm widać też wtedy,
              gdy gra jest w tle. Po uderzeniu pasek znika sam, a raport z walki trafia do wiadomości.
            </p>
            <p>
              Skład wrogiej floty nie jest widoczny, tak samo jak w ruchach flot na przeglądzie. Co zrobić: wydać surowce na
              budowę albo obronę, odesłać flotę z surowcami na inną planetę (<i>Stacjonowanie</i>) albo na ekspedycję i
              policzyć szanse w <a href="/simulator">symulatorze</a>, jeśli znasz flotę napastnika z wcześniejszego raportu.
              Zawiadomienia e-mailem o ataku nie ma.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: 'walka',
    title: 'Walka',
    group: 'Zasady gry',
    lead: (cfg) => (
      <>
        Bitwa rozstrzyga się automatycznie w chwili przylotu floty i trwa najwyżej <b>{cfg.universe.maxCombatRounds} rund</b>. Raport
        trafia do obu stron.
      </>
    ),
    sections: [
      {
        id: 'runda',
        title: 'Przebieg rundy',
        body: () => (
          <ol>
            <li>Na początku każdej rundy wszystkie jednostki odnawiają osłony do pełna.</li>
            <li>
              Każda jednostka oddaje strzał w losowy cel strony przeciwnej. Strzał najpierw zdejmuje osłonę, a nadwyżka uszkadza strukturę.
            </li>
            <li>
              Strzał słabszy niż 1% osłony celu odbija się bez efektu. Dlatego chmara lekkich myśliwców nic nie zrobi kopule ochronnej.
            </li>
            <li>
              Jednostka, której struktura spadła poniżej 70%, może eksplodować z szansą <code>1 − struktura / struktura maks.</code>
            </li>
            <li>Bitwa kończy się, gdy jedna strona nie ma jednostek albo minie ostatnia runda (remis).</li>
          </ol>
        ),
      },
      {
        id: 'statystyki',
        title: 'Atak, osłona, struktura',
        body: () => (
          <p>
            Struktura jednostki to <code>(metal + kryształ) / 10</code> z jej kosztu. Każdy poziom <W to="weapons_tech">technologii uzbrojenia</W>,{' '}
            <W to="shielding_tech">osłon</W> i <W to="armour_tech">pancerza</W> dodaje 10% odpowiedniej wartości. Wojownik ma +10% ataku, a każdy poziom{' '}
            <W to="war_academy">Akademii wojennej</W> dodaje kolejny 1%.
          </p>
        ),
      },
      {
        id: 'szybkie',
        title: 'Szybkie działa',
        body: () => (
          <p>
            Jednostka z szybkim działem o wartości N przeciw danemu celowi po trafieniu w taki cel strzela ponownie z szansą{' '}
            <code>(N − 1) / N</code>. Średnio oddaje więc N strzałów. Każdy statek ma 5 przeciw sondom i satelitom. Pełna tabela:{' '}
            <W to="szybkie-dziala">Szybkie działa</W>.
          </p>
        ),
      },
      {
        id: 'po-walce',
        title: 'Po walce',
        body: (cfg) => (
          <ul>
            <li>
              <b>Pole zniszczeń:</b> {pct(cfg.universe.debrisRatio)} metalu i kryształu ze zniszczonych <i>statków</i> obu stron (także
              satelitów). Obrona nie tworzy pola. Pole zbierają <W to="recycler">recyklery</W>.
            </li>
            <li>
              <b>Odbudowa obrony:</b> każda zniszczona budowla obronna właściciela planety ma {pct(cfg.universe.defenseRebuildRate)} szans,
              że zostanie odbudowana za darmo.
            </li>
            <li>
              <b>Rabunek:</b> tylko gdy wygra atakujący. Można zabrać do {pct(cfg.universe.lootRatio)} każdego surowca z planety, w granicach
              wolnej ładowności. Najpierw ładowany jest metal (do 1/3 miejsca), potem kryształ (połowa reszty), potem tryt, a wolne miejsce
              dopełniane jest metalem i kryształem.
            </li>
            <li>
              <b>Księżyc:</b> duże pole zniszczeń może dać księżyc. Zob. <W to="ksiezyce">Księżyce</W>.
            </li>
          </ul>
        ),
      },
      {
        id: 'symulator',
        title: 'Symulator',
        body: () => (
          <p>
            W grze jest <a href="/simulator">symulator walki</a> działający według tych samych zasad. Z raportu szpiegowskiego otworzysz go
            przyciskiem <i>Symuluj atak</i>, a jednostki celu zostaną wpisane automatycznie.
          </p>
        ),
      },
    ],
  },
  {
    slug: 'szpiegostwo',
    title: 'Szpiegostwo',
    group: 'Zasady gry',
    lead: () => (
      <>
        <W to="espionage_probe">Sondy szpiegowskie</W> zbierają informacje o obcych planetach. Ile zobaczysz, zależy od liczby sond i od
        różnicy poziomów <W to="espionage_tech">technologii szpiegowskiej</W>.
      </>
    ),
    sections: [
      {
        id: 'raport',
        title: 'Zawartość raportu',
        body: () => (
          <>
            <p>
              Siła szpiegowania = <code>liczba sond + różnica · |różnica|</code>, gdzie różnica to Twój poziom technologii szpiegowskiej
              minus poziom celu. Przewaga działa więc kwadratowo, w obie strony.
            </p>
            <table className="wiki-table narrow">
              <thead>
                <tr><th>Siła</th><th>Widoczne sekcje</th></tr>
              </thead>
              <tbody>
                <tr><td>dowolna (min. 1 sonda)</td><td>surowce</td></tr>
                <tr><td>2</td><td>+ flota</td></tr>
                <tr><td>3</td><td>+ obrona</td></tr>
                <tr><td>5</td><td>+ budynki</td></tr>
                <tr><td>7</td><td>+ badania</td></tr>
              </tbody>
            </table>
            <p>Przykład: przy technologii o 2 poziomy wyższej niż cel 3 sondy dają siłę 7, czyli pełny raport.</p>
          </>
        ),
      },
      {
        id: 'kontrwywiad',
        title: 'Kontrwywiad',
        body: () => (
          <p>
            Jeśli przy celu stoją statki, sondy mogą zostać wykryte i zniszczone w walce. Szansa:{' '}
            <code>statki obrońcy · sondy · 2<sup>(techn. obrońcy − techn. szpiega)</sup> / 400</code>, najwyżej 100%. Gracz szpiegowany zawsze
            dostaje wiadomość, że ktoś się nim interesował.
          </p>
        ),
      },
    ],
  },
  {
    slug: 'ksiezyce',
    title: 'Księżyce',
    group: 'Zasady gry',
    lead: () => <>Księżyc powstaje po dużej bitwie i otwiera dostęp do falangi czujnikowej i teleportera.</>,
    sections: [
      {
        id: 'powstanie',
        title: 'Powstanie',
        body: () => (
          <p>
            Po walce szansa na księżyc to 1% za każde 100 000 surowców w polu zniszczeń z tej bitwy, najwyżej {MOON_MAX_CHANCE}%. Pole
            o wartości 2 000 000 daje maksymalną szansę. Przy planecie, która ma już księżyc, nie powstanie drugi.
          </p>
        ),
      },
      {
        id: 'zabudowa',
        title: 'Zabudowa',
        body: () => (
          <p>
            Księżyc nie wydobywa surowców i ma na start 1 pole. <W to="lunar_base" /> dodaje 3 pola za poziom (sama zajmuje 1). Na księżycu
            można stawiać też <W to="robotics_factory">fabrykę robotów</W>, <W to="shipyard">stocznię</W> i magazyny, a tylko tam{' '}
            <W to="sensor_phalanx">falangę czujnikową</W> i <W to="jump_gate">teleporter</W>. Odległość planeta–księżyc wynosi 5, więc przelot trwa chwilę.
          </p>
        ),
      },
      {
        id: 'falanga',
        title: 'Falanga czujnikowa',
        body: () => (
          <p>
            Skanuje obce planety w zasięgu <code>poziom² − 1</code> układów (w tej samej galaktyce) i pokazuje floty lecące do nich, z nich
            i stacjonujące przy nich. Jeden skan kosztuje {fmt(PHALANX_SCAN_COST)} trytu z księżyca. Skan uruchamiasz z widoku galaktyki,
            gdy wybraną planetą jest księżyc z falangą.
          </p>
        ),
      },
      {
        id: 'teleporter',
        title: 'Teleporter',
        body: () => (
          <p>
            Natychmiast przenosi statki między dwoma Twoimi księżycami, które oba mają teleporter. Po skoku oba teleportery ładują się przez
            godzinę (krócej na szybszych serwerach). Przenieść można tylko statki, które latają.
          </p>
        ),
      },
    ],
  },
  {
    slug: 'rakiety',
    title: 'Rakiety',
    group: 'Zasady gry',
    lead: () => (
      <>
        <W to="interplanetary_missile">Rakiety międzyplanetarne</W> niszczą obronę bez wysyłania floty, a{' '}
        <W to="anti_ballistic_missile">rakiety przechwytujące</W> przed nimi chronią.
      </>
    ),
    sections: [
      {
        id: 'silos',
        title: 'Silos',
        body: () => (
          <p>
            Rakiety przechowuje <W to="missile_silo" />: 10 miejsc na poziom. Rakieta przechwytująca zajmuje 1 miejsce, międzyplanetarna 2.
            Zamówienia w stoczni też zajmują miejsce.
          </p>
        ),
      },
      {
        id: 'atak',
        title: 'Atak rakietowy',
        body: () => (
          <ul>
            <li>
              Zasięg: <code>5 · poziom − 1</code> układów <W to="impulse_drive">napędu impulsowego</W>, w tej samej galaktyce. Tabela
              zasięgów jest na stronie napędu.
            </li>
            <li>Lot trwa <code>30 + 60 · układy</code> sekund (podzielone przez prędkość flot serwera).</li>
            <li>Rakiety przechwytujące celu niszczą nadlatujące rakiety jedna na jedną.</li>
            <li>
              Reszta zadaje obrażenia obronie: najpierw wybranemu celowi głównemu, potem pozostałym budowlom w kolejności katalogu. Siłę
              zwiększa <W to="weapons_tech">technologia uzbrojenia</W> atakującego, a odporność obrony rośnie z{' '}
              <W to="armour_tech">technologią pancerza</W> obrońcy.
            </li>
            <li>Rakiety nie walczą z flotą i nie tworzą pola zniszczeń.</li>
          </ul>
        ),
      },
    ],
  },
  {
    slug: 'ekspedycje',
    title: 'Ekspedycje',
    group: 'Zasady gry',
    lead: (cfg) => (
      <>
        Ekspedycja to lot w nieznane: na pozycję {cfg.universe.positions + 1} dowolnego układu. Flota zostaje tam 1–{MAX_EXPEDITION_HOURS} h, a
        potem wraca z wynikiem.
      </>
    ),
    sections: [
      {
        id: 'limit',
        title: 'Limit',
        body: () => (
          <p>
            Jednocześnie można prowadzić <code>⌊√astrofizyka⌋</code> ekspedycji: 1 od poziomu 1, 2 od poziomu 4, 3 od poziomu 9. Każda
            ekspedycja zajmuje też zwykły slot floty.
          </p>
        ),
      },
      {
        id: 'wyniki',
        title: 'Możliwe wyniki',
        body: (cfg) => (
          <table className="wiki-table">
            <thead>
              <tr><th>Wynik</th><th>Szansa</th><th>Opis</th></tr>
            </thead>
            <tbody>
              <tr><td>Nic</td><td>30%</td><td>Flota wraca z pustymi ładowniami.</td></tr>
              <tr><td>Surowce</td><td>25%</td><td>Metal, kryształ albo tryt, do połowy wartości floty (maks. {fmt(25_000 * Math.max(1, cfg.universe.economySpeed))} jednostek), w granicach ładowności.</td></tr>
              <tr><td>Opóźnienie</td><td>12%</td><td>Powrót trwa 1,5–2,5 raza dłużej.</td></tr>
              <tr><td>Szybszy powrót</td><td>11%</td><td>Powrót trwa o połowę krócej.</td></tr>
              <tr><td>Statki</td><td>10%</td><td>Porzucone transportery i myśliwce dołączają do floty.</td></tr>
              <tr><td>Piraci</td><td>10%</td><td>Walka z flotą myśliwców o sile 15–40% Twojej floty.</td></tr>
              <tr><td>Utrata floty</td><td>2%</td><td>Flota przepada bez śladu.</td></tr>
            </tbody>
          </table>
        ),
      },
    ],
  },
  {
    slug: 'sojusze',
    title: 'Sojusze i współpraca',
    group: 'Zasady gry',
    lead: () => <>Sojusze, traktaty, znajomi, ataki sojusznicze i wzajemna obrona.</>,
    sections: [
      {
        id: 'sojusz',
        title: 'Sojusz',
        body: () => (
          <ul>
            <li>Sojusz ma tag (2–8 znaków) i nazwę (3–40 znaków). Można należeć tylko do jednego.</li>
            <li>
              Rangi: <b>założyciel</b> (wszystko, a do tego nadawanie rang, przekazanie funkcji i rozwiązanie sojuszu), <b>oficer</b>
              (zgłoszenia, usuwanie zwykłych członków, opis sojuszu, wiadomości okólne, traktaty, moderacja forum) i <b>członek</b>.
            </li>
            <li>Założyciel nie może odejść, dopóki nie przekaże funkcji innemu członkowi.</li>
            <li>Sojusz ma wewnętrzne forum i wiadomości okólne, widoczne tylko dla członków.</li>
            <li>Członkowie tego samego sojuszu nie mogą się atakować.</li>
          </ul>
        ),
      },
      {
        id: 'opis',
        title: 'Opis sojuszu w HTML',
        body: () => (
          <>
            <p>
              Założyciel i oficerowie mogą w ustawieniach sojuszu napisać opis do 20 000 znaków, tak jak w dawnych grach:
              z banerem, tabelą funkcji i kolorowymi napisami. Zwykły tekst też działa, nowe linie są zachowane. Edytor ma
              podgląd na żywo i przycisk <i>Wstaw przykładowy opis</i> z gotowym szablonem.
            </p>
            <table className="wiki-table">
              <thead>
                <tr><th>Dozwolone</th><th>Przykład</th></tr>
              </thead>
              <tbody>
                <tr><td>formatowanie</td><td><code>&lt;b&gt; &lt;i&gt; &lt;u&gt; &lt;s&gt; &lt;center&gt; &lt;small&gt; &lt;big&gt;</code></td></tr>
                <tr><td>kolory i czcionki</td><td><code>&lt;font color="#f0b050" size="5" face="Georgia"&gt;</code></td></tr>
                <tr><td>nagłówki, akapity, listy</td><td><code>&lt;h1&gt;…&lt;h6&gt; &lt;p&gt; &lt;ul&gt; &lt;ol&gt; &lt;li&gt; &lt;hr&gt; &lt;br&gt;</code></td></tr>
                <tr><td>tabele</td><td><code>&lt;table border="1" cellpadding="4" bgcolor="#203858"&gt;</code> z <code>tr td th</code></td></tr>
                <tr><td>obrazki (tylko https)</td><td><code>&lt;img src="https://…/baner.gif" width="400"&gt;</code></td></tr>
                <tr><td>linki (nowa karta)</td><td><code>&lt;a href="https://…"&gt;nasze forum&lt;/a&gt;</code></td></tr>
                <tr><td>przewijany napis</td><td><code>&lt;marquee scrollamount="4"&gt;Rekrutacja!&lt;/marquee&gt;</code></td></tr>
                <tr><td>style</td><td><code>style="color: red; text-align: center; border: 1px solid #fff"</code>: kolory, wyrównanie, rozmiary, ramki, odstępy</td></tr>
              </tbody>
            </table>
            <p>
              Przy zapisie gra usuwa wszystko, co mogłoby zaszkodzić innym graczom: skrypty, ramki (<code>iframe</code>),
              formularze, zdarzenia typu <code>onclick</code>, linki <code>javascript:</code>, obrazki spoza https oraz style
              z <code>url()</code> czy <code>position</code>. Obrazki wstawiane z zewnętrznych serwerów pobiera przeglądarka
              każdego oglądającego. Używaj obrazków, do których masz prawa.
            </p>
          </>
        ),
      },
      {
        id: 'traktaty',
        title: 'Traktaty',
        body: () => (
          <p>
            Między sojuszami można zawrzeć <b>pakt obronny</b>, <b>pakt handlowy</b> albo <b>pakt o nieagresji</b>. Każdy aktywny pakt
            (zaakceptowany przez drugą stronę) blokuje ataki między członkami obu sojuszy. <b>Wojnę</b> wypowiada się jednostronnie i działa
            od razu. Z jednym sojuszem może istnieć tylko jeden traktat naraz.
          </p>
        ),
      },
      {
        id: 'znajomi',
        title: 'Znajomi',
        body: () => (
          <p>
            Lista znajomych mieści {MAX_BUDDIES} graczy, a zaproszenie wymaga akceptacji. Znajomych widać jako online, gdy byli aktywni w ciągu
            15 minut. Znajomych, tak jak członków sojuszu, można bronić i zapraszać do ataków.
          </p>
        ),
      },
      {
        id: 'acs',
        title: 'Atak sojuszniczy',
        body: () => (
          <ol>
            <li>Wyślij zwykły atak, a potem w zakładce <i>Flota</i> zamień go w atak sojuszniczy.</li>
            <li>Zaproś członków sojuszu lub znajomych. Dołączyć może do 8 flot łącznie.</li>
            <li>
              Dołączająca flota musi lecieć na ten sam cel. Wszystkie floty dolatują razem, ale dołączenie może opóźnić przylot najwyżej o
              30% czasu lotu dołączanej floty.
            </li>
            <li>Łup dzielony jest między floty proporcjonalnie do ich wolnej ładowności.</li>
          </ol>
        ),
      },
      {
        id: 'obrona',
        title: 'Obrona sojusznicza',
        body: () => (
          <p>
            Misja <i>Obrona</i> wysyła flotę na planetę sojusznika lub znajomego na 1–{MAX_HOLD_HOURS} h. Stacjonująca flota walczy po
            stronie gospodarza w każdym ataku w tym czasie, a jej straty tworzą pole zniszczeń jak zwykle. Flotę można odwołać w każdej
            chwili.
          </p>
        ),
      },
    ],
  },
  {
    slug: 'specjalizacje',
    title: 'Specjalizacje',
    group: 'Zasady gry',
    lead: (cfg) => (
      <>
        Od {fmt(cfg.branchMinPoints)} punktów można wybrać specjalizację: <b>handlarza</b> albo <b>wojownika</b>. Wybór jest
        <b> ostateczny</b>, nie da się go później zmienić. Specjalizację każdego gracza widać w rankingu graczy.
      </>
    ),
    sections: [
      {
        id: 'handlarz',
        title: 'Handlarz',
        body: () => (
          <ul>
            <li>+20% ładowności wszystkich flot.</li>
            <li>
              <W to="trade_center" /> i rynek wymiany surowców po kursie 3 : 2 : 1. Prowizja wynosi 10% i spada o 0,5 punktu procentowego za
              każdy poziom Centrum, do 5% (poziom 10).
            </li>
            <li><W to="freighter" />: statek o ładowności 100 000.</li>
          </ul>
        ),
      },
      {
        id: 'wojownik',
        title: 'Wojownik',
        body: () => (
          <ul>
            <li>+10% ataku i +10% prędkości wszystkich statków.</li>
            <li><W to="war_academy" />: każdy poziom to kolejny +1% ataku (do +20% na poziomie 10).</li>
            <li><W to="destroyer" />: najsilniejszy okręt liniowy w grze.</li>
          </ul>
        ),
      },
    ],
  },
  {
    slug: 'ochrona',
    title: 'Ochrona, urlop i nieaktywni',
    group: 'Zasady gry',
    lead: () => <>Kogo można zaatakować, a kogo nie.</>,
    sections: [
      {
        id: 'poczatkujacy',
        title: 'Ochrona początkujących',
        body: (cfg) => (
          <p>
            Gracz z mniej niż {fmt(cfg.universe.newbieProtectionPoints)} punktami nie może być zaatakowany przez kogoś, kto ma ponad{' '}
            {num(cfg.universe.newbieRatio)}× więcej punktów. Działa to w obie strony: chroniony gracz nie zaatakuje też dużo silniejszego.
            Ochrona nie obejmuje graczy nieaktywnych od 7 dni. Dotyczy ataków, szpiegowania i rakiet.
          </p>
        ),
      },
      {
        id: 'urlop',
        title: 'Tryb urlopowy',
        body: () => (
          <ul>
            <li>Trwa minimum 48 godzin, potem wyłączasz go sam w ustawieniach.</li>
            <li>Nikt nie może Cię zaatakować ani wysłać na Ciebie rakiet.</li>
            <li>Planety nie produkują surowców i nie możesz budować, badać ani wysyłać flot.</li>
            <li>Nie da się go włączyć, gdy Twoje floty są w locie albo zbliżają się do Ciebie obce floty.</li>
          </ul>
        ),
      },
      {
        id: 'legenda',
        title: 'Oznaczenia w galaktyce',
        body: () => (
          <table className="wiki-table narrow">
            <tbody>
              <tr><td className="c"><b>i</b></td><td>nieaktywny od 7 dni (brak ochrony początkujących)</td></tr>
              <tr><td className="c"><b>I</b></td><td>nieaktywny od 28 dni</td></tr>
              <tr><td className="c"><b>v</b></td><td>tryb urlopowy</td></tr>
              <tr><td className="c"><b>b</b></td><td>zablokowany (zob. pręgierz)</td></tr>
              <tr><td className="c"><b>n</b></td><td>słabszy, objęty ochroną</td></tr>
              <tr><td className="c"><b>s</b></td><td>silniejszy, Ty jesteś chroniony</td></tr>
              <tr><td className="c"><b>A</b></td><td>administrator</td></tr>
            </tbody>
          </table>
        ),
      },
    ],
  },
  {
    slug: 'ranking',
    title: 'Punkty i ranking',
    group: 'Zasady gry',
    lead: () => <>Punkty mierzą wszystko, co zbudowałeś i zbadałeś.</>,
    sections: [
      {
        id: 'punkty',
        title: 'Liczenie punktów',
        body: () => (
          <>
          <p>
            1 punkt za każde 1000 surowców (metal + kryształ + tryt) wydanych na budynki, badania, statki i obronę. Zniszczone jednostki
            odejmują punkty, a rozbiórka odejmuje punkty za rozebrany poziom. Ranking ma kategorie: ogólny, budynki, badania, flota,
            obrona, oraz osobny ranking sojuszy (suma punktów członków). Przeliczany jest co 5 minut.
          </p>
          <p>
            Administratorzy nie biorą udziału w rankingu. Ich punkty są liczone, ale nie zajmują miejsc, nie liczą się do liczby
            graczy w rankingu ani do punktów sojuszu. W galaktyce są oznaczeni literą <b>A</b>.
          </p>
          </>
        ),
      },
    ],
  },
  {
    slug: 'konto',
    title: 'Konto i zasady',
    group: 'Zasady gry',
    lead: () => <>Sprawy konta, wiadomości i zasady fair play.</>,
    sections: [
      {
        id: 'konto',
        title: 'Konto',
        body: () => (
          <ul>
            <li>Nazwa gracza: 3–20 znaków. Adres e-mail potwierdzasz linkiem z wiadomości, bo posłuży do odzyskania hasła.</li>
            <li>Reset hasła wysyła link ważny 1 godzinę. Po zmianie hasła wszystkie sesje są wylogowane.</li>
            <li>Usunięcie konta następuje po 7 dniach od zlecenia i do tego czasu można je anulować w ustawieniach.</li>
          </ul>
        ),
      },
      {
        id: 'regulamin',
        title: 'Regulamin i prywatność',
        body: () => (
          <ul>
            <li>
              Zakładając konto, akceptujesz <a href="/regulamin" target="_blank" rel="noopener">regulamin</a> i potwierdzasz
              zapoznanie się z <a href="/prywatnosc" target="_blank" rel="noopener">polityką prywatności</a>. Linki do obu są
              na ekranie logowania i w stopce gry.
            </li>
            <li>
              Po zmianie regulaminu przy najbliższym wejściu do gry pojawi się okno z prośbą o akceptację nowej wersji. Bez niej
              nie da się grać dalej. Możesz się wylogować albo napisać do administratora.
            </li>
            <li>
              <b>Pobierz moje dane</b> (Ustawienia → Twoje dane) zapisuje plik JSON z danymi konta, planet, wiadomości,
              notatek i znajomych. Plik nie zawiera hasła.
            </li>
            <li>Gra nie używa ciasteczek ani narzędzi analitycznych i nie zapisuje adresów IP.</li>
            <li>
              Oprócz ludzi w grze występują gracze sterowani przez komputer. Grają według tych samych zasad, nie mają ułatwień
              i nie są osobno oznaczeni.
            </li>
          </ul>
        ),
      },
      {
        id: 'wiadomosci',
        title: 'Wiadomości i notatki',
        body: () => (
          <p>
            Przeczytane wiadomości są usuwane po 7 dniach, nieprzeczytane po 30. Archiwum mieści 100 wiadomości i nie jest czyszczone.
            Notatek możesz mieć 100.
          </p>
        ),
      },
      {
        id: 'fair-play',
        title: 'Fair play',
        body: () => (
          <ul>
            <li>Jedno konto na osobę. Multikonta i przepychanie surowców między własnymi kontami kończą się blokadą.</li>
            <li>Bez skryptów i botów grających za Ciebie.</li>
            <li>Błędy gry zgłaszaj na <a href="/forum-gry/BUGS">forum</a> zamiast je wykorzystywać.</li>
            <li>Blokady są jawne: każdą widać na pręgierzu razem z powodem.</li>
          </ul>
        ),
      },
    ],
  },
];

export const articleBySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug);
