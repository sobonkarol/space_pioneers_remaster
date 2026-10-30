/**
 * Test E2E zaawansowanych mechanik przez przegladarke: znajomi, obrona sojusznicza (HOLD),
 * ksiezyc w galaktyce i na liscie planet, zabudowa ksiezyca, falanga, ekspedycje.
 *
 * Wymaga serwera w szybkiej galaktyce (jak gameplay.e2e.mjs). Ksiezyc powstaje w grze dopiero
 * z pola szczatkow >= 100 000 surowcow, wiec test tworzy go bezposrednio w bazie (zmienna E2E_PSQL,
 * domyslnie "psql -h localhost -U postgres spacepioneers"). Samo powstawanie ksiezyca z walki
 * sprawdzaja testy backendu (AdvancedFlowTest).
 */
import { execSync } from 'node:child_process';
import { BASE, SHOTS, apiGet, buildShips, check, finish, homeId, launch, newPlayer, sleep, upgrade } from './lib.mjs';

const PSQL = process.env.E2E_PSQL ?? 'psql -h localhost -U postgres spacepioneers';
const sql = (q) => execSync(`${PSQL} -At -c ${JSON.stringify(q)}`).toString().trim();

const browser = await launch();
const stamp = Date.now().toString(36);

try {
  console.log('1. Znajomi przez interfejs');
  const a = await newPlayer(browser, `Pilot${stamp}`);
  const b = await newPlayer(browser, `Kumpel${stamp}`);
  await a.goto(`${BASE}/buddies`);
  await a.fill('.inline-form input >> nth=0', `Kumpel${stamp}`);
  await a.fill('.inline-form input >> nth=1', 'Bronimy się razem');
  await a.click('button:has-text("Wyślij zaproszenie")');
  await a.waitForSelector('text=Zaproszenie wysłane.');
  check(true, 'zaproszenie wysłane');
  await b.goto(`${BASE}/buddies`);
  await b.waitForSelector('text=Bronimy się razem');
  await b.click('button:has-text("Przyjmij")');
  await b.waitForSelector(`td:has-text("Pilot${stamp}")`);
  await b.screenshot({ path: `${SHOTS}/a01-buddies.png`, fullPage: true });
  const buddies = await apiGet(a, '/buddies');
  check(buddies.length === 1 && buddies[0].status === 'ACCEPTED', 'znajomość zaakceptowana');

  console.log('2. Ekspedycja bez astrofizyki - reguła z serwera w interfejsie');
  // tylko wymagania lekkiego mysliwca - pelna rozbudowe gospodarki sprawdza scenariusz gameplay
  await upgrade(a, 'robotics_factory');
  await upgrade(a, 'robotics_factory');
  await upgrade(a, 'shipyard');
  await upgrade(a, 'research_lab');
  await upgrade(a, 'energy_tech', '/research');
  await upgrade(a, 'combustion_drive', '/research');
  await buildShips(a, 'light_fighter', 1);
  check(true, 'zbudowano myśliwiec');

  const bCoords = (await apiGet(b, `/planets/${await homeId(b)}/overview`)).planet.coordinates;
  const [g, s] = bCoords.split(':');
  await a.goto(`${BASE}/galaxy?coords=${bCoords}`);
  await a.waitForSelector('.galaxy-table');
  await a.click('button:has-text("Ekspedycja")');
  await a.waitForSelector('tr[data-key="light_fighter"]');
  check(a.url().includes('mission=EXPEDITION') && a.url().includes(`${g}:${s}:16`), 'galaktyka kieruje ekspedycję na pozycję 16');
  await a.fill('tr[data-key="light_fighter"] input.amount-input', '1');
  await a.waitForSelector('text=Odległość', { timeout: 10000 });
  await a.click('button:has-text("Wyślij flotę")');
  await a.waitForSelector('text=Ekspedycje wymagają astrofizyki.');
  check(true, 'serwer odrzuca ekspedycję bez astrofizyki, komunikat widoczny');

  console.log('3. Obrona sojusznicza (HOLD) u znajomego');
  await a.goto(`${BASE}/galaxy?coords=${bCoords}`);
  await a.waitForSelector(`tr:has-text("Kumpel${stamp}")`);
  await a.click(`tr:has-text("Kumpel${stamp}") button:has-text("Obrona")`);
  await a.waitForSelector('tr[data-key="light_fighter"]');
  await a.fill('tr[data-key="light_fighter"] input.amount-input', '1');
  await a.waitForSelector('text=Odległość', { timeout: 10000 });
  await a.selectOption('select[aria-label="Czas pobytu (godziny)"]', '2');
  await a.screenshot({ path: `${SHOTS}/a02-hold-form.png`, fullPage: true });
  await a.click('button:has-text("Wyślij flotę")');
  await a.waitForSelector('text=Flota wysłana.');
  check(true, `flota wysłana do obrony [${bCoords}]`);
  let holding = null;
  for (let i = 0; i < 120 && !holding; i++) {
    const fleets = await apiGet(a, '/fleets');
    holding = fleets.find((f) => f.mission === 'HOLD' && f.status === 'HOLDING');
    if (!holding) await sleep(300);
  }
  check(holding !== null, 'flota stacjonuje u znajomego');
  await a.goto(`${BASE}/fleet`);
  await a.waitForSelector('text=stacjonuje');
  await a.screenshot({ path: `${SHOTS}/a03-holding.png`, fullPage: true });
  await b.goto(`${BASE}/overview`);
  await b.waitForSelector('.fleet-row', { timeout: 10000 });
  await b.screenshot({ path: `${SHOTS}/a04-ally-overview.png` });
  check(true, 'obrońca widzi sojuszniczą flotę w przeglądzie');
  await a.goto(`${BASE}/fleet`);
  await a.click('.fleet-row button:has-text("Zawróć")');
  for (let i = 0; i < 20; i++) {
    const fleets = await apiGet(a, '/fleets');
    if (fleets.every((f) => f.status === 'RETURNING')) break;
    await sleep(500);
  }
  check((await apiGet(a, '/fleets')).every((f) => f.status === 'RETURNING'), 'stacjonującą flotę można zawrócić');

  console.log('4. Księżyc: galaktyka, lista planet, zabudowa, falanga');
  const bId = (await apiGet(b, '/me')).id;
  const moonId = Number(sql("select nextval('planet_seq')"));
  const [mg, ms, mp] = bCoords.split(':').map(Number);
  const data = {
    id: moonId, moon: true, name: 'Księżyc', units: {}, fields: 20, galaxy: mg, system: ms, ownerId: bId, position: mp,
    // fabryka robotow 9 skraca budowe bazy ksiezycowej z ~45 s do ~4 s (pola powiekszone, zeby bylo miejsce)
    buildings: { robotics_factory: 9 }, createdAt: new Date().toISOString(), homeworld: false,
    resources: { metal: 200000, crystal: 200000, tritium: 100000 }, buildQueue: [], lastUpdate: new Date().toISOString(),
    planetType: 'moon', imageVariant: 3, shipyardQueue: [], temperatureMax: 20, temperatureMin: -20, productionPercent: {},
  };
  sql(`insert into planets(id, owner_id, galaxy, system, position, is_moon, data) values (${moonId}, ${bId}, ${mg}, ${ms}, ${mp}, true, '${JSON.stringify(data).replace(/'/g, "''")}'::jsonb)`);
  await a.goto(`${BASE}/galaxy?coords=${bCoords}`);
  await a.waitForSelector('.moon-cell', { timeout: 10000 });
  await a.screenshot({ path: `${SHOTS}/a05-galaxy-moon.png`, fullPage: true });
  check(true, 'księżyc widoczny w galaktyce');

  await b.goto(`${BASE}/overview`);
  await b.reload();
  await b.waitForSelector('.planet-select');
  const options = await b.locator('.planet-select option').allTextContents();
  check(options.some((o) => o.includes('Księżyc')), 'księżyc na liście planet gracza');
  await b.selectOption('.planet-select', String(moonId));
  await b.goto(`${BASE}/buildings`);
  await b.waitForSelector('tr[data-key="lunar_base"]');
  check((await b.locator('tr[data-key="metal_mine"]').count()) === 0, 'na księżycu nie ma kopalń, jest baza księżycowa');
  await b.screenshot({ path: `${SHOTS}/a06-moon-buildings.png`, fullPage: true });
  await upgrade(b, 'lunar_base', '/buildings', 120000, moonId);
  const moonBuildings = await apiGet(b, `/planets/${moonId}/buildings`);
  check(moonBuildings.find((o) => o.key === 'lunar_base').level === 1, 'baza księżycowa zbudowana na księżycu');
  await b.goto(`${BASE}/galaxy?coords=${bCoords}`);
  await b.waitForSelector('.galaxy-table');
  const phalanxButton = b.locator('button:has-text("Falanga")').first();
  check((await phalanxButton.count()) > 0, 'akcja falangi dostępna z księżyca');
  await phalanxButton.click();
  await b.waitForSelector('text=Ten księżyc nie ma falangi czujnikowej.');
  check(true, 'falanga bez budynku odrzucona z czytelnym komunikatem');

  finish();
  if (!process.exitCode) console.log('E2E ADVANCED OK');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
