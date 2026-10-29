/**
 * Test E2E funkcji spolecznosciowych: forum sojuszu (watki, odpowiedzi, nowe wpisy, przypinanie, zamykanie,
 * edycja), notatki, archiwum wiadomosci. Sojusz zakladany jest przez API (sam interfejs sojuszu testuje
 * gameplay.e2e.mjs).
 */
import { BASE, SHOTS, apiGet, apiPost, check, finish, launch, newPlayer } from './lib.mjs';

const browser = await launch();
const stamp = Date.now().toString(36);

try {
  console.log('1. Przygotowanie sojuszu');
  const lead = await newPlayer(browser, `Lider${stamp}`);
  const mem = await newPlayer(browser, `Kolega${stamp}`);
  const alliance = await apiPost(lead, '/alliances', { tag: `F${stamp}`.slice(0, 8), name: 'Forum Test' });
  await apiPost(mem, `/alliances/${alliance.id}/apply`, { text: 'hej' });
  const view = await apiGet(lead, `/alliances/${alliance.id}`);
  await apiPost(lead, `/alliances/applications/${view.applications[0].id}`, { accept: true });
  await mem.reload();
  await lead.reload();
  check((await apiGet(mem, '/me')).allianceId === alliance.id, 'obaj gracze w sojuszu');

  console.log('2. Forum sojuszu');
  await mem.click('a:has-text("Forum sojuszu")');
  await mem.click('button:has-text("Nowy wątek")');
  await mem.fill('input[maxlength="100"]', 'Plan na weekend');
  await mem.fill('textarea', 'Proponuję wspólny atak w sobotę.');
  await mem.click('button:has-text("Utwórz wątek")');
  await mem.waitForSelector('a:has-text("Plan na weekend")');
  check(true, 'wątek utworzony');
  await lead.goto(`${BASE}/overview`);
  await lead.waitForSelector('a:has-text("Forum sojuszu") .menu-badge');
  check(true, 'lider widzi licznik nowych wątków w menu');
  await lead.click('a:has-text("Forum sojuszu")');
  await lead.waitForSelector('.forum-new');
  await lead.click('a:has-text("Plan na weekend")');
  await lead.waitForSelector('text=Proponuję wspólny atak w sobotę.');
  await lead.fill('textarea', 'Zgoda, zbiórka o 20:00.');
  await lead.click('.compose-form button[type=submit]');
  await lead.waitForSelector('.forum-post:has-text("Zgoda, zbiórka o 20:00.")');
  await lead.click('button:has-text("Przypnij")');
  await lead.waitForSelector('button:has-text("Odepnij")');
  await lead.click('button:has-text("Zamknij wątek")');
  await lead.waitForSelector('button:has-text("Otwórz wątek")');
  await lead.screenshot({ path: `${SHOTS}/s01-forum-thread.png`, fullPage: true });
  check(true, 'odpowiedź, przypięcie i zamknięcie wątku');

  await mem.goto(`${BASE}/forum`);
  await mem.waitForSelector('.forum-table tr.unread');
  check(await mem.isVisible('text=przypięty'), 'członek widzi nowe wpisy i przypięcie');
  await mem.click('a:has-text("Plan na weekend")');
  await mem.waitForSelector('text=Wątek jest zamknięty - odpowiadać mogą tylko założyciel i oficerowie.');
  check((await mem.locator('button:has-text("Edytuj")').count()) === 0, 'w zamkniętym wątku brak odpowiedzi i edycji');
  await lead.click('button:has-text("Otwórz wątek")');
  await lead.waitForSelector('button:has-text("Zamknij wątek")');
  await mem.reload();
  await mem.click('.forum-post >> nth=0 >> button:has-text("Edytuj")');
  await mem.fill('.forum-post textarea', 'Proponuję wspólny atak w niedzielę.');
  await mem.click('.forum-post button:has-text("Zapisz")');
  await mem.waitForSelector('text=Proponuję wspólny atak w niedzielę.');
  await mem.waitForSelector('text=edytowano');
  check(true, 'autor edytuje własny wpis');

  console.log('3. Notatki');
  await mem.click('a:has-text("Notatki")');
  await mem.click('button:has-text("Nowa notatka")');
  await mem.fill('input[maxlength="100"]', 'Cele rozbudowy');
  await mem.selectOption('select[aria-label="Priorytet"]', '2');
  await mem.fill('textarea', 'Kopalnia metalu 10, laboratorium 5');
  await mem.click('button:has-text("Zapisz")');
  await mem.waitForSelector('text=Notatka zapisana.');
  await mem.click('button.link-button:has-text("Cele rozbudowy")');
  await mem.fill('textarea', 'Kopalnia metalu 12');
  await mem.click('button:has-text("Zapisz")');
  await mem.waitForSelector('text=Kopalnia metalu 12');
  await mem.screenshot({ path: `${SHOTS}/s02-notes.png`, fullPage: true });
  const notes = await apiGet(mem, '/notes');
  check(notes.length === 1 && notes[0].priority === 2 && notes[0].text === 'Kopalnia metalu 12', 'notatka utworzona i zmieniona');

  console.log('4. Archiwum wiadomości');
  await apiPost(lead, '/messages', { to: `Kolega${stamp}`, subject: 'Do zachowania', body: 'Współrzędne celu 1:2:3' });
  await apiPost(lead, '/messages', { to: `Kolega${stamp}`, subject: 'Zwykła', body: 'nic ważnego' });
  await mem.goto(`${BASE}/messages`);
  await mem.click('.tabs button:has-text("Prywatne")');
  await mem.click('button.link-button:has-text("Do zachowania")');
  await mem.click('button:has-text("Do archiwum")');
  await mem.waitForSelector('text=Zapisano w archiwum.');
  mem.once('dialog', (d) => d.accept());
  await mem.click('button:has-text("Usuń wszystkie (poza archiwum)")');
  await mem.waitForSelector('text=Wiadomości usunięte.');
  await mem.click('.tabs button:has-text("Archiwum")');
  await mem.waitForSelector('button.link-button:has-text("Do zachowania")');
  await mem.screenshot({ path: `${SHOTS}/s03-archive.png`, fullPage: true });
  const priv = await apiGet(mem, '/messages?type=PRIVATE');
  check(priv.length === 1 && priv[0].archived, 'po usunięciu prywatnych zostaje tylko wiadomość z archiwum');
  check((await apiGet(mem, '/messages?type=SYSTEM')).length > 0, 'inne foldery nienaruszone');

  finish();
  if (!process.exitCode) console.log('E2E SOCIAL OK');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
