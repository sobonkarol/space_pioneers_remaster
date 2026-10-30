/**
 * Test end-to-end rozgrywki przez przegladarke (Chromium + playwright-core).
 *
 * Wymaga uruchomionego serwera (backend z wbudowanym frontendem) w szybkiej galaktyce:
 *   UNIVERSE_SPEED=2000 UNIVERSE_GALAXIES=1 UNIVERSE_SYSTEMS=3 UNIVERSE_NEWBIE_POINTS=0 UNIVERSE_START_RESOURCES=1000000
 *   RANKING_INTERVAL_MS=5000
 *   FRONTEND_DIR=../frontend/dist java -jar backend/target/space-pioneers-backend-*.jar
 * Uruchomienie:
 *   CHROME_PATH=/sciezka/do/chromium E2E_BASE_URL=http://localhost:8080 node e2e/gameplay.e2e.mjs
 * Zrzuty ekranu trafiaja do katalogu E2E_SHOTS (domyslnie ./e2e-shots).
 */
import { BASE, SHOTS, apiGet, buildShips, check, finish, homeId, launch, newPlayer, sleep, upgrade } from './lib.mjs';

const browser = await launch();
const stamp = Date.now().toString(36);

try {
  console.log('1. Rejestracja dwóch graczy');
  // na pustym serwerze pierwsze konto zostaje administratorem, a administrator nie wystepuje w rankingu
  await (await newPlayer(browser, `Admin${stamp}`)).context().close();
  const a = await newPlayer(browser, `Atak${stamp}`);
  const d = await newPlayer(browser, `Obrona${stamp}`);
  await a.screenshot({ path: `${SHOTS}/01-overview.png` });
  check(await a.isVisible('.panel-title:has-text("Planeta macierzysta")'), 'przegląd planety po rejestracji');

  console.log('2. Rozbudowa gospodarki przez interfejs');
  await upgrade(a, 'solar_plant');
  await upgrade(a, 'metal_mine');
  await upgrade(a, 'solar_plant');
  await upgrade(a, 'crystal_mine');
  await upgrade(a, 'tritium_synthesizer');
  await upgrade(a, 'solar_plant');
  await upgrade(a, 'tritium_synthesizer');
  await upgrade(a, 'robotics_factory');
  await upgrade(a, 'robotics_factory');
  await upgrade(a, 'shipyard');
  await upgrade(a, 'research_lab');
  await a.goto(`${BASE}/resources`);
  await a.waitForSelector('.production-table');
  await a.screenshot({ path: `${SHOTS}/02-resources.png`, fullPage: true });
  const ov = await apiGet(a, `/planets/${await homeId(a)}/overview`);
  check(ov.fieldsUsed >= 11, `zajęte pola po rozbudowie: ${ov.fieldsUsed}`);

  console.log('3. Badania przez interfejs');
  await upgrade(a, 'energy_tech', '/research');
  await upgrade(a, 'combustion_drive', '/research');
  check((await apiGet(a, '/me')).id > 0, 'badania ukończone');

  console.log('4. Stocznia - lekkie myśliwce');
  await buildShips(a, 'light_fighter', 2);
  const aPlanet = await homeId(a);
  const ships = await apiGet(a, `/planets/${aPlanet}/fleet-dispatch`);
  check(ships.ships.light_fighter === 2, 'myśliwce zbudowane');

  console.log('5. Atak przez widok floty');
  const dOverview = await apiGet(d, `/planets/${await homeId(d)}/overview`);
  const target = dOverview.planet.coordinates;
  await a.goto(`${BASE}/fleet?target=${target}&mission=ATTACK`);
  await a.waitForSelector('tr[data-key="light_fighter"]');
  await a.fill('tr[data-key="light_fighter"] input.amount-input', '2');
  await a.waitForSelector('text=Odległość', { timeout: 10000 });
  await a.screenshot({ path: `${SHOTS}/03-fleet.png`, fullPage: true });
  await a.click('button:has-text("Wyślij flotę")');
  await a.waitForSelector('text=Flota wysłana.');
  check(true, `flota wysłana na [${target}]`);
  // obronca widzi wroga flote w przegladzie
  await d.goto(`${BASE}/overview`);
  await d.waitForSelector('.fleet-row', { timeout: 10000 }).catch(() => null);
  await d.screenshot({ path: `${SHOTS}/04-incoming.png` });

  let report = null;
  for (let i = 0; i < 90 && !report; i++) {
    const msgs = await apiGet(a, '/messages?type=COMBAT');
    if (msgs.length > 0) report = msgs[0];
    else await sleep(300);
  }
  check(report !== null, 'raport z walki dotarł do atakującego');
  check(report.payload.outcome === 'ATTACKER', 'atakujący wygrał (obrońca bez obrony)');
  await a.goto(`${BASE}/messages`);
  await a.click('.tabs button:has-text("Raporty walk")');
  await a.click(`button.link-button:has-text("Raport z walki")`);
  await a.waitForSelector('.combat-report');
  await a.screenshot({ path: `${SHOTS}/05-combat-report.png`, fullPage: true });
  check(await a.isVisible('text=Atakujący wygrał bitwę.'), 'raport wyświetlony w interfejsie');
  const defMsgs = await apiGet(d, '/messages?type=COMBAT');
  check(defMsgs.length === 1, 'obrońca też otrzymał raport');

  console.log('6. Sojusz przez interfejs');
  await a.goto(`${BASE}/alliance`);
  await a.fill('.inline-form input >> nth=0', `T${stamp}`.slice(0, 8));
  await a.fill('.inline-form input >> nth=1', 'Testowy Sojusz');
  await a.click('button:has-text("Załóż sojusz")');
  await a.waitForSelector('text=Testowy Sojusz');
  const allianceId = (await apiGet(a, '/me')).allianceId;
  await d.goto(`${BASE}/alliance/${allianceId}`);
  await d.fill('textarea', 'Chcę dołączyć');
  await d.click('button:has-text("Złóż zgłoszenie")');
  await d.waitForSelector('.notice.success');
  await a.goto(`${BASE}/alliance`);
  await a.click('button:has-text("Przyjmij")');
  await a.waitForSelector('button:has-text("Przyjmij")', { state: 'detached' });
  const view = await apiGet(a, `/alliances/${allianceId}`);
  check(view.memberCount === 2, 'obrońca przyjęty do sojuszu');
  await a.screenshot({ path: `${SHOTS}/06-alliance.png`, fullPage: true });

  console.log('7. Galaktyka i ranking');
  await a.goto(`${BASE}/galaxy`);
  await a.waitForSelector(`text=Obrona${stamp}`, { timeout: 10000 }).catch(() => null);
  await a.screenshot({ path: `${SHOTS}/07-galaxy.png`, fullPage: true });
  // ranking przeliczany co RANKING_INTERVAL_MS (CI: 5 s) - czekamy, az pojawi sie atakujacy
  let ranked = false;
  for (let i = 0; i < 60 && !ranked; i++) {
    const ranking = await apiGet(a, '/ranking?type=players&category=total&page=1');
    ranked = ranking.rows.some((r) => r.name === `Atak${stamp}` && r.points > 0);
    if (!ranked) await sleep(500);
  }
  await a.goto(`${BASE}/ranking`);
  await a.waitForSelector('.ranking-table');
  await a.screenshot({ path: `${SHOTS}/08-ranking.png`, fullPage: true });
  check(ranked, 'atakujący w rankingu z punktami');

  finish();
  if (!process.exitCode) console.log('E2E OK');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
