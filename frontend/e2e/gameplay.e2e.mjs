/**
 * Test end-to-end rozgrywki przez przegladarke (Chromium + playwright-core).
 *
 * Wymaga uruchomionego serwera (backend z wbudowanym frontendem) w szybkiej galaktyce:
 *   UNIVERSE_SPEED=2000 UNIVERSE_GALAXIES=1 UNIVERSE_SYSTEMS=3 UNIVERSE_NEWBIE_POINTS=0 RANKING_INTERVAL_MS=5000
 *   FRONTEND_DIR=../frontend/dist java -jar backend/target/space-pioneers-backend-*.jar
 * Uruchomienie:
 *   CHROME_PATH=/sciezka/do/chromium E2E_BASE_URL=http://localhost:8080 node e2e/gameplay.e2e.mjs
 * Zrzuty ekranu trafiaja do katalogu E2E_SHOTS (domyslnie ./e2e-shots).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const SHOTS = process.env.E2E_SHOTS ?? 'e2e-shots';
mkdirSync(SHOTS, { recursive: true });

let executablePath = process.env.CHROME_PATH;
let launchArgs = [];
if (!executablePath) {
  const mod = await import('@sparticuz/chromium');
  const c = mod.default ?? mod;
  executablePath = await c.executablePath();
  launchArgs = c.args;
}

const browser = await chromium.launch({ executablePath, args: launchArgs, headless: true });
const errors = [];
const stamp = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(cond, msg) {
  if (!cond) throw new Error(`ASERCJA: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function newPlayer(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('status of 4')) errors.push(`${name}: ${m.text()}`);
  });
  await page.goto(`${BASE}/`);
  await page.waitForSelector('.auth-box');
  await page.click('.auth-tabs button:nth-child(2)');
  await page.fill('input[autocomplete=username]', name);
  await page.fill('input[type=email]', `${name.toLowerCase()}@example.com`);
  await page.fill('input[type=password]', 'haslo12345');
  await page.click('form button[type=submit]');
  await page.waitForSelector('.overview-page', { timeout: 15000 });
  return page;
}

/** Wywolanie API z tokenem zalogowanego gracza (do odczytu stanu w asercjach). */
async function apiGet(page, path) {
  return page.evaluate(async (p) => {
    const r = await fetch(`/api${p}`, { headers: { Authorization: `Bearer ${localStorage.getItem('sp.token')}` } });
    return r.json();
  }, path);
}

async function homeId(page) {
  return (await apiGet(page, '/me')).homePlanetId;
}

/** Rozbudowa przez interfejs: czeka na surowce, klika przycisk w wierszu i czeka na koniec budowy. */
async function upgrade(page, key, path = '/buildings', timeoutMs = 120000) {
  const isResearch = path === '/research';
  const planet = await homeId(page);
  const listPath = isResearch ? `/planets/${planet}/research` : `/planets/${planet}/buildings`;
  const before = (await apiGet(page, listPath)).find((o) => o.key === key).level;
  const deadline = Date.now() + timeoutMs;
  await page.goto(`${BASE}${path}`);
  while (Date.now() < deadline) {
    await page.waitForSelector(`tr[data-key="${key}"]`);
    const button = page.locator(`tr[data-key="${key}"] td.item-action button.btn`);
    if ((await button.count()) > 0 && (await button.isEnabled())) {
      await button.click();
      break;
    }
    await sleep(1000);
    await page.reload();
  }
  while (Date.now() < deadline) {
    const level = (await apiGet(page, listPath)).find((o) => o.key === key).level;
    if (level > before) return level;
    await sleep(700);
  }
  throw new Error(`Nie udalo sie rozbudowac ${key}`);
}

try {
  console.log('1. Rejestracja dwóch graczy');
  const a = await newPlayer(`Atak${stamp}`);
  const d = await newPlayer(`Obrona${stamp}`);
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
  await a.goto(`${BASE}/shipyard`);
  let ordered = false;
  for (let i = 0; i < 240 && !ordered; i++) {
    await a.waitForSelector('tr[data-key="light_fighter"]');
    const max = await a.locator('tr[data-key="light_fighter"] .order-box .link-button').textContent().catch(() => null);
    const n = max ? Number(max.replace(/\D/g, '')) : 0;
    if (n >= 2) {
      await a.fill('tr[data-key="light_fighter"] input.amount-input', '2');
      await a.click('tr[data-key="light_fighter"] .order-box button.btn');
      ordered = true;
    } else {
      await sleep(1000);
      await a.reload();
    }
  }
  check(ordered, 'zamówiono 2 lekkie myśliwce');
  const aPlanet = await homeId(a);
  for (let i = 0; i < 60; i++) {
    const o = await apiGet(a, `/planets/${aPlanet}/overview`);
    if (o.shipyardQueue.length === 0) break;
    await sleep(700);
  }
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
    else await sleep(1000);
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
  await a.waitForTimeout(1000);
  const view = await apiGet(a, `/alliances/${allianceId}`);
  check(view.memberCount === 2, 'obrońca przyjęty do sojuszu');
  await a.screenshot({ path: `${SHOTS}/06-alliance.png`, fullPage: true });

  console.log('7. Galaktyka i ranking');
  await a.goto(`${BASE}/galaxy`);
  await a.waitForSelector(`text=Obrona${stamp}`, { timeout: 10000 }).catch(() => null);
  await a.screenshot({ path: `${SHOTS}/07-galaxy.png`, fullPage: true });
  await sleep(6000);
  await a.goto(`${BASE}/ranking`);
  await a.waitForSelector('.ranking-table');
  await a.screenshot({ path: `${SHOTS}/08-ranking.png`, fullPage: true });
  const ranking = await apiGet(a, '/ranking?type=players&category=total&page=1');
  check(ranking.rows.some((r) => r.name === `Atak${stamp}` && r.points > 0), 'atakujący w rankingu z punktami');

  console.log(errors.length ? `Błędy przeglądarki:\n${errors.join('\n')}` : 'Brak błędów JS w przeglądarce.');
  if (errors.length) process.exitCode = 1;
  else console.log('E2E OK');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
