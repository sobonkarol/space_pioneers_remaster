/**
 * Test E2E publicznego forum gry: gosc czyta, gracz zaklada zgloszenie bledu, administrator odpowiada,
 * zmienia status i zamyka watek. Uprawnienia administratora nadawane w bazie (E2E_PSQL).
 */
import { execSync } from 'node:child_process';
import { BASE, SHOTS, check, finish, launch, newPlayer, sleep } from './lib.mjs';

const PSQL = process.env.E2E_PSQL ?? 'psql -h localhost -U postgres spacepioneers';
const sql = (q) => execSync(`${PSQL} -At -c ${JSON.stringify(q)}`).toString().trim();
const browser = await launch();
const stamp = Date.now().toString(36);

try {
  console.log('1. Gracz zgłasza błąd przez forum otwierane z menu');
  const p = await newPlayer(browser, `Tester${stamp}`);
  const [forum] = await Promise.all([p.context().waitForEvent('page'), p.click('a:has-text("Forum gry")')]);
  await forum.waitForSelector('.board-table');
  check(true, 'forum otwiera się w nowej karcie');
  await forum.click('a:has-text("Zgłoszenia błędów")');
  await forum.click('button:has-text("Nowy wątek")');
  await forum.fill('.board-form input', `Flota nie wraca ${stamp}`);
  await forum.fill('.board-form textarea', 'Wysłałem transport na 1:2:3 i flota zniknęła.');
  await forum.click('button:has-text("Opublikuj")');
  await forum.waitForSelector('.board-text:has-text("Wysłałem transport na 1:2:3")');
  check(await forum.isVisible('.board-status.st-new'), 'zgłoszenie ma status „nowy”');

  console.log('2. Gość czyta forum bez logowania');
  const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guest = await guestCtx.newPage();
  await guest.goto(`${BASE}/forum-gry`);
  await guest.waitForSelector(`text=Flota nie wraca ${stamp}`);
  await guest.click(`a:has-text("Flota nie wraca ${stamp}")`);
  await guest.waitForSelector('text=Aby odpowiedzieć');
  await guest.screenshot({ path: `${SHOTS}/b01-guest-thread.png`, fullPage: true });
  check(true, 'gość widzi wątek, bez możliwości odpowiedzi');

  console.log('3. Administrator odpowiada i zmienia status');
  const adminName = `Mod${stamp}`;
  const a = await newPlayer(browser, adminName);
  sql(`update players set data = jsonb_set(data, '{admin}', 'true') where username = '${adminName}'`);
  await a.goto(`${BASE}/forum-gry/bugs`);
  await a.waitForSelector(`tr[data-thread="Flota nie wraca ${stamp}"].unread`);
  check(true, 'nieprzeczytany wątek wyróżniony');
  await a.click(`a:has-text("Flota nie wraca ${stamp}")`);
  await a.fill('.board-form textarea', 'Dziękujemy, poprawka w drodze.');
  await a.click('button:has-text("Wyślij odpowiedź")');
  await a.waitForSelector('.board-text:has-text("Dziękujemy, poprawka w drodze.")');
  await a.selectOption('select[aria-label="Status zgłoszenia"]', 'FIXED');
  await a.waitForSelector('.board-toolbar .board-status.st-fixed');
  await a.click('.board-mod button:has-text("Zamknij")');
  await a.waitForSelector('.board-mod button:has-text("Otwórz")');
  await a.screenshot({ path: `${SHOTS}/b02-admin-thread.png`, fullPage: true });
  check(await a.isVisible('.board-admin'), 'wpis administratora wyróżniony');

  await sleep(500);
  await forum.reload();
  await forum.waitForSelector('text=Wątek jest zamknięty.');
  check(await forum.isVisible('.board-status.st-fixed'), 'gracz widzi status „naprawiony” i zamknięty wątek');
  await forum.goto(`${BASE}/forum-gry`);
  await forum.waitForSelector('.board-table');
  await forum.screenshot({ path: `${SHOTS}/b03-index.png`, fullPage: true });

  finish();
  if (!process.exitCode) console.log('E2E BOARD OK');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
