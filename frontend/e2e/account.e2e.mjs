/**
 * Test E2E konta i administracji: potwierdzenie e-mail, reset hasla, zmiana adresu, usuwanie konta,
 * panel administratora (blokada, pregierz, zdjecie blokady, ogloszenie, dziennik).
 *
 * Wymaga serwera uruchomionego z MAIL_DEV_OUTBOX=true (linki z e-maili czytane z /api/dev/outbox).
 * Uprawnienia administratora nadawane sa w bazie (E2E_PSQL), bo administratorem zostaje tylko pierwszy gracz serwera.
 */
import { execSync } from 'node:child_process';
import { BASE, SHOTS, apiGet, check, errors, finish, launch, newPlayer, sleep } from './lib.mjs';

const PSQL = process.env.E2E_PSQL ?? 'psql -h localhost -U postgres spacepioneers';
const sql = (q) => execSync(`${PSQL} -At -c ${JSON.stringify(q)}`).toString().trim();

const browser = await launch();
const stamp = Date.now().toString(36);

async function outboxLink(page, email, path) {
  for (let i = 0; i < 20; i++) {
    const box = await page.evaluate(async () => (await fetch('/api/dev/outbox')).json());
    const mail = box.find((m) => m.to === email && m.text.includes(path));
    if (mail) return mail.text.match(/https?:\/\/\S+/)[0];
    await sleep(300);
  }
  throw new Error(`Brak e-maila ${path} do ${email}`);
}

const relative = (url) => url.replace(/^https?:\/\/[^/]+/, '');

async function loginUi(page, login, password) {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('.auth-box');
  await page.fill('input[autocomplete=username]', login);
  await page.fill('input[type=password]', password);
  await page.click('form button[type=submit]');
}

try {
  console.log('1. Potwierdzenie adresu e-mail');
  const name = `Konto${stamp}`;
  const email = `${name.toLowerCase()}@example.com`;
  const p = await newPlayer(browser, name);
  await p.waitForSelector('.verify-notice');
  check(true, 'baner o niepotwierdzonym adresie');
  const verify = await outboxLink(p, email, '/verify');
  await p.goto(`${BASE}${relative(verify)}`);
  await p.waitForSelector('text=Adres e-mail został potwierdzony.');
  await p.screenshot({ path: `${SHOTS}/c01-verified.png` });
  await p.click('text=Powrót do gry');
  await p.waitForSelector('.overview-page');
  check((await p.locator('.verify-notice').count()) === 0, 'po potwierdzeniu baner znika');

  console.log('2. Reset hasła');
  await p.click('button:has-text("Wyloguj")');
  await p.waitForSelector('.auth-box');
  await p.click('button:has-text("Nie pamiętasz hasła?")');
  await p.fill('.auth-form input[type=email]', email);
  await p.click('button:has-text("Wyślij link")');
  await p.waitForSelector('text=Jeśli konto o tym adresie istnieje');
  const reset = await outboxLink(p, email, '/reset-password');
  await p.goto(`${BASE}${relative(reset)}`);
  await p.fill('input[autocomplete=new-password] >> nth=0', 'nowehaslo123');
  await p.fill('input[autocomplete=new-password] >> nth=1', 'nowehaslo123');
  await p.screenshot({ path: `${SHOTS}/c02-reset.png` });
  await p.click('button:has-text("Zapisz")');
  await p.waitForSelector('text=Hasło zostało zmienione.');
  await loginUi(p, name, 'haslo12345');
  await p.waitForSelector('text=Nieprawidłowy login lub hasło.');
  check(true, 'stare hasło odrzucone');
  await loginUi(p, name, 'nowehaslo123');
  await p.waitForSelector('.overview-page');
  check(true, 'logowanie nowym hasłem');

  console.log('3. Zmiana adresu i usunięcie konta');
  await p.goto(`${BASE}/settings`);
  const newEmail = `nowy${stamp}@example.com`;
  await p.fill('input[autocomplete=email]', newEmail);
  await p.fill('form:has(input[autocomplete=email]) input[type=password]', 'nowehaslo123');
  await p.click('form:has(input[autocomplete=email]) button[type=submit]');
  await p.waitForSelector('text=Adres zmieniony');
  await p.waitForSelector('.verify-notice');
  check((await apiGet(p, '/me')).email === newEmail, 'adres zmieniony, wymaga potwierdzenia');
  await outboxLink(p, newEmail, '/verify');
  check(true, 'link potwierdzający wysłany na nowy adres');
  p.once('dialog', (d) => d.accept());
  await p.fill('form:has(button:has-text("Usuń konto")) input[type=password]', 'nowehaslo123');
  await p.click('button:has-text("Usuń konto")');
  await p.waitForSelector('text=Anuluj usunięcie');
  await p.screenshot({ path: `${SHOTS}/c03-deletion.png`, fullPage: true });
  check(Boolean((await apiGet(p, '/me')).deletionAt), 'usunięcie zaplanowane, widoczne ostrzeżenie');
  await p.click('button:has-text("Anuluj usunięcie")');
  await p.waitForSelector('text=Usunięcie anulowane.');
  check(!(await apiGet(p, '/me')).deletionAt, 'usunięcie anulowane');

  console.log('4. Panel administratora');
  const adminName = `Admin${stamp}`;
  const a = await newPlayer(browser, adminName);
  sql(`update players set data = jsonb_set(data, '{admin}', 'true') where username = '${adminName}'`);
  await a.reload();
  await a.waitForSelector('a:has-text("Administracja")');
  await a.click('a:has-text("Administracja")');
  await a.waitForSelector('.admin-stats');
  await a.fill('input[aria-label="nazwa lub e-mail"]', name);
  await a.click('button:has-text("Szukaj")');
  await a.waitForSelector(`tr[data-player="${name}"]`);
  await a.click(`tr[data-player="${name}"] button.link-button`);
  await a.waitForSelector(`text=Gracz: ${name}`);
  await a.selectOption('select[aria-label="Czas blokady"]', '72');
  await a.fill('input[aria-label="Powód"]', 'Test blokady E2E');
  await a.click('button:has-text("Zablokuj")');
  await a.waitForSelector('text=Gracz zablokowany.');
  await a.screenshot({ path: `${SHOTS}/c04-admin.png`, fullPage: true });
  check(true, 'gracz zablokowany z panelu');

  await p.goto(`${BASE}/overview`);
  await p.waitForSelector('.auth-box', { timeout: 10000 });
  check(true, 'sesja zablokowanego gracza wygasła');
  await loginUi(p, name, 'nowehaslo123');
  await p.waitForSelector('text=Konto jest zablokowane');
  await p.screenshot({ path: `${SHOTS}/c05-banned-login.png` });
  check(true, 'logowanie odrzucone z podaniem powodu');
  await p.click('a:has-text("Pręgierz")');
  await p.waitForSelector('text=Test blokady E2E');
  check(true, 'blokada na publicznym pręgierzu');

  await a.click('button:has-text("Zdejmij blokadę")');
  await a.waitForSelector('text=Blokada zdjęta.');
  await loginUi(p, name, 'nowehaslo123');
  await p.waitForSelector('.overview-page');
  check(true, 'po zdjęciu blokady logowanie działa');

  await a.fill('.compose-form input >> nth=0', `Ogłoszenie ${stamp}`);
  await a.fill('.compose-form textarea', 'Treść ogłoszenia testowego.');
  await a.click('button:has-text("Wyślij ogłoszenie")');
  await a.waitForSelector('text=Ogłoszenie wysłane.');
  const msgs = await apiGet(p, '/messages?type=SYSTEM');
  check(msgs.some((m) => m.subject === `Ogłoszenie ${stamp}`), 'ogłoszenie dotarło do gracza');
  await a.reload();
  await a.waitForSelector('text=Dziennik administracji');
  // panel pojawia sie przed danymi - czekamy, az wczytaja sie wpisy (na wolnym CI to chwila)
  const logPanel = a.locator('.panel:has-text("Dziennik administracji")');
  let logText = '';
  for (let i = 0; i < 40; i++) {
    logText = (await logPanel.textContent()) ?? '';
    if (logText.includes('Blokada') && logText.includes('Zdjęcie blokady') && logText.includes('Ogłoszenie')) break;
    await sleep(250);
  }
  check(logText.includes('Blokada') && logText.includes('Zdjęcie blokady') && logText.includes('Ogłoszenie'), 'dziennik zawiera działania');
  await a.screenshot({ path: `${SHOTS}/c06-admin-log.png`, fullPage: true });

  void errors;
  finish();
  if (!process.exitCode) console.log('E2E ACCOUNT OK');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
