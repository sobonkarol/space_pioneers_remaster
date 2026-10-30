/** Wspolne narzedzia testow E2E (Chromium + playwright-core). */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
export const SHOTS = process.env.E2E_SHOTS ?? 'e2e-shots';
mkdirSync(SHOTS, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const errors = [];

// Na GitHub Actions pierwszy blad scenariusza trafia do adnotacji (widocznych w PR bez pobierania logow).
let lastError = '';
const originalError = console.error;
console.error = (...args) => {
  if (!lastError) lastError = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ').split('\n')[0];
  originalError(...args);
};
process.on('exit', () => {
  if (process.exitCode && process.env.GITHUB_ACTIONS) {
    const script = (process.argv[1] ?? '').split('/').pop();
    const msg = (lastError || errors.join(' | ') || 'nieznany blad').replace(/\r?\n/g, ' ').slice(0, 500);
    console.log(`::error title=E2E ${script}::${msg}`);
  }
});

export async function launch() {
  let executablePath = process.env.CHROME_PATH;
  let args = [];
  if (!executablePath) {
    const mod = await import('@sparticuz/chromium');
    const c = mod.default ?? mod;
    executablePath = await c.executablePath();
    args = c.args;
  }
  return chromium.launch({ executablePath, args, headless: true });
}

export function check(cond, msg) {
  if (!cond) throw new Error(`ASERCJA: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

export async function newPlayer(browser, name) {
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
  await page.check('.auth-terms input');
  await page.click('form button[type=submit]');
  await page.waitForSelector('.overview-page', { timeout: 15000 });
  return page;
}

async function call(page, method, path, body) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const r = await fetch(`/api${path}`, {
        method,
        headers: { Authorization: `Bearer ${localStorage.getItem('sp.token')}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await r.text();
      return text ? JSON.parse(text) : null;
    },
    { method, path, body },
  );
}

export const apiGet = (page, path) => call(page, 'GET', path);
export const apiPost = (page, path, body) => call(page, 'POST', path, body ?? {});

export async function homeId(page) {
  return (await apiGet(page, '/me')).homePlanetId;
}

/** Rozbudowa przez interfejs: czeka na surowce, klika przycisk w wierszu i czeka na koniec budowy. */
export async function upgrade(page, key, path = '/buildings', timeoutMs = 120000, planetId = null) {
  const isResearch = path === '/research';
  const planet = planetId ?? (await homeId(page));
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
    await sleep(500);
    await page.reload();
  }
  while (Date.now() < deadline) {
    const level = (await apiGet(page, listPath)).find((o) => o.key === key).level;
    if (level > before) return level;
    await sleep(250);
  }
  throw new Error(`Nie udalo sie rozbudowac ${key}`);
}

/** Zamowienie statkow w stoczni przez interfejs i czekanie na ich zbudowanie. */
export async function buildShips(page, key, count) {
  await page.goto(`${BASE}/shipyard`);
  let ordered = false;
  for (let i = 0; i < 240 && !ordered; i++) {
    await page.waitForSelector(`tr[data-key="${key}"]`);
    const max = await page.locator(`tr[data-key="${key}"] .order-box .link-button`).textContent().catch(() => null);
    const n = max ? Number(max.replace(/\D/g, '')) : 0;
    if (n >= count) {
      await page.fill(`tr[data-key="${key}"] input.amount-input`, String(count));
      await page.click(`tr[data-key="${key}"] .order-box button.btn`);
      ordered = true;
    } else {
      await sleep(500);
      await page.reload();
    }
  }
  if (!ordered) throw new Error(`Nie udalo sie zamowic ${key}`);
  const planet = await homeId(page);
  for (let i = 0; i < 360; i++) {
    const d = await apiGet(page, `/planets/${planet}/fleet-dispatch`);
    if ((d.ships[key] ?? 0) >= count) return;
    await sleep(250);
  }
  throw new Error(`Statki ${key} nie zostaly zbudowane`);
}

export function finish() {
  console.log(errors.length ? `Błędy przeglądarki:\n${errors.join('\n')}` : 'Brak błędów JS w przeglądarce.');
  if (errors.length) process.exitCode = 1;
}
