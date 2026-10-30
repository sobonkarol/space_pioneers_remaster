/**
 * Test E2E wiki gry (Kosmopedia): otwarcie z menu w nowej karcie, artykuly, strony obiektow z tabelami
 * liczonymi z danych serwera, wyszukiwarka, kalkulator lotow i dostep bez logowania.
 */
import { BASE, SHOTS, check, errors, finish, launch, newPlayer } from './lib.mjs';

const browser = await launch();
const stamp = Date.now().toString(36);

try {
  console.log('1. Gracz otwiera wiki z menu gry');
  const p = await newPlayer(browser, `Czytelnik${stamp}`);
  const [wiki] = await Promise.all([p.context().waitForEvent('page'), p.click('a:has-text("Wiki gry")')]);
  wiki.on('pageerror', (e) => errors.push(`wiki: ${e.message}`));
  await wiki.waitForSelector('.wiki-content h1');
  check((await wiki.textContent('h1')) === 'Strona główna', 'wiki otwiera się w nowej karcie na stronie głównej');
  check(await wiki.isVisible('a:has-text("Wróć do gry")'), 'zalogowany gracz ma link powrotu do gry');

  console.log('2. Strona budynku z tabelą poziomów');
  await wiki.click('.wiki-portlet a:has-text("Budynki")');
  await wiki.click('.wiki-table a:has-text("Kopalnia metalu")');
  await wiki.waitForSelector('.wiki-infobox');
  const row2 = await wiki.textContent('.wiki-table tbody tr:nth-child(2)');
  check(row2.includes('90') && row2.includes('22'), 'koszt 2. poziomu kopalni metalu: 90 metalu, 22 kryształu');
  await wiki.fill('.wiki-controls input >> nth=0', '10');
  check((await wiki.textContent('.wiki-table tbody tr:first-child')).includes('10s'), 'fabryka robotów skraca czas w tabeli');
  await wiki.screenshot({ path: `${SHOTS}/w01-building.png`, fullPage: true });

  console.log('3. Wyszukiwarka i strona statku');
  await wiki.fill('.wiki-portlet input', 'krąż');
  await wiki.click('.wiki-hits a:has-text("Krążownik")');
  await wiki.waitForSelector('h1:has-text("Krążownik")');
  check((await wiki.textContent('.wiki-infobox')).includes('2.700'), 'struktura krążownika = (20000+7000)/10');
  check((await wiki.textContent('.wiki-content')).includes('Lekki myśliwiec (6)'), 'szybkie działa krążownika na stronie');

  console.log('4. Artykuł i kalkulator lotów');
  await wiki.goto(`${BASE}/wiki/walka`);
  await wiki.waitForSelector('.wiki-toc');
  check(await wiki.isVisible('h2#po-walce'), 'artykuł o walce ma sekcje i spis treści');
  await wiki.goto(`${BASE}/wiki/kalkulator-lotow`);
  await wiki.waitForSelector('.wiki-result');
  const res = await wiki.textContent('.wiki-result');
  check(res.includes('3.080') && res.includes('14m 39s'), 'kalkulator: 1:1:1 → 1:5:8 transporterem = 3080, 14m 39s');
  await wiki.screenshot({ path: `${SHOTS}/w02-calc.png`, fullPage: true });

  console.log('5. Gość bez logowania');
  const guest = await (await browser.newContext()).newPage();
  guest.on('pageerror', (e) => errors.push(`gość: ${e.message}`));
  await guest.goto(`${BASE}/wiki/szybkie-dziala`);
  await guest.waitForSelector('.wiki-matrix');
  check(await guest.isVisible('a:has-text("Zaloguj się")'), 'gość czyta wiki bez logowania');
  await guest.goto(`${BASE}/help`);
  await guest.waitForSelector('.auth-box');
  check(true, 'stara podstrona Pomocy nie istnieje dla gościa (ekran logowania)');

  finish();
  if (!process.exitCode) console.log('E2E WIKI OK');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
