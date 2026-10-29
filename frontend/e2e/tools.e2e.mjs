/** Test E2E wyszukiwarki i symulatora walki. */
import { BASE, SHOTS, check, finish, launch, newPlayer } from './lib.mjs';

const browser = await launch();
const stamp = Date.now().toString(36);

try {
  console.log('1. Wyszukiwarka');
  const a = await newPlayer(browser, `Szukacz${stamp}`);
  await newPlayer(browser, `Cel${stamp}`);
  await a.click('a:has-text("Szukaj")');
  await a.fill('input[aria-label="fragment nazwy (min. 2 znaki)"]', `cel${stamp}`);
  await a.click('.search-page button[type=submit]');
  await a.waitForSelector(`.search-results td:has-text("Cel${stamp}")`);
  await a.screenshot({ path: `${SHOTS}/t01-search.png`, fullPage: true });
  check(true, 'gracz znaleziony');
  await a.click(`.search-results tr:has-text("Cel${stamp}") a:has-text("Dodaj do znajomych")`);
  await a.waitForSelector('.buddies-page');
  check((await a.inputValue('.inline-form input >> nth=0')) === `Cel${stamp}`, 'przejście do dodania znajomego z wypełnioną nazwą');

  console.log('2. Symulator walki');
  await a.click('a:has-text("Symulator walki")');
  await a.fill('input[aria-label="Atakujący Krążownik"]', '20');
  await a.fill('input[aria-label="Obrońca Wyrzutnia rakiet"]', '30');
  await a.fill('input[aria-label="Atakujący Technologia uzbrojenia"]', '3').catch(() => null);
  await a.selectOption('select[aria-label="Liczba symulacji"]', '10');
  await a.click('button:has-text("Symuluj")');
  await a.waitForSelector('.sim-result');
  const text = await a.locator('.sim-result').textContent();
  await a.screenshot({ path: `${SHOTS}/t02-simulator.png`, fullPage: true });
  check(/Wygrana atakującego: \d+%/.test(text), 'wynik symulacji z procentami zwycięstw');
  check(text.includes('Krążownik') && text.includes('Wyrzutnia rakiet'), 'ocalałe jednostki obu stron');

  finish();
  if (!process.exitCode) console.log('E2E TOOLS OK');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
