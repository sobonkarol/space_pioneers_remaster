/**
 * Test E2E przegladu: aktualne dzialania (budowa z kolejka, badanie, stocznia, inne planety) z paskami postepu.
 * Surowce, badania i druga planeta przygotowywane sa w bazie (E2E_PSQL), aby nie czekac na rozbudowe.
 */
import { execSync } from 'node:child_process';
import { BASE, SHOTS, apiPost, check, finish, homeId, launch, newPlayer } from './lib.mjs';

const PSQL = process.env.E2E_PSQL ?? 'psql -h localhost -U postgres spacepioneers';
const sql = (q) => execSync(`${PSQL} -At -c ${JSON.stringify(q)}`).toString().trim();
const browser = await launch();

try {
  const name = `Przeglad${Date.now().toString(36)}`;
  const p = await newPlayer(browser, name);
  const id = await homeId(p);
  sql(`update planets set data = jsonb_set(jsonb_set(data, '{resources}', '{"metal":900000,"crystal":900000,"tritium":900000}'), '{buildings}', '{"shipyard":2,"research_lab":1,"robotics_factory":2}') where id = ${id}`);
  sql(`update players set data = jsonb_set(data, '{research}', '{"combustion_drive":1}') where username = '${name}'`);
  const cid = Number(sql("select nextval('planet_seq')"));
  sql(`insert into planets (id, owner_id, galaxy, system, position, data) select ${cid}, owner_id, galaxy, system, 15, data || jsonb_build_object('id', ${cid}, 'position', 15, 'name', 'Kolonia', 'homeworld', false, 'buildQueue', '[]'::jsonb, 'shipyardQueue', '[]'::jsonb) from planets where id = ${id}`);

  // zlecenia przez interfejs na stronie budynkow, reszta przez API
  await p.goto(`${BASE}/buildings`);
  await p.click('tr[data-key="metal_mine"] td.item-action button.btn');
  await p.waitForSelector('text=w kolejce', { timeout: 5000 }).catch(() => null);
  await apiPost(p, `/planets/${id}/buildings/crystal_mine`);
  await apiPost(p, `/planets/${id}/research/energy_tech`);
  await apiPost(p, `/planets/${id}/shipyard`, { unit: 'light_fighter', count: 5 });
  await apiPost(p, `/planets/${cid}/buildings/solar_plant`);

  await p.click('a:has-text("Przegląd")');
  await p.waitForSelector('.activity-panel .progress');
  const text = await p.locator('.activity-panel').textContent();
  await p.screenshot({ path: `${SHOTS}/o01-overview-activity.png`, fullPage: true });
  check(text.includes('Kopalnia metalu (Poziom 1)'), 'bieżąca budowa na przeglądzie');
  check(text.includes('w kolejce: Kopalnia kryształu (Poziom 1)'), 'kolejka budowy na przeglądzie');
  check(text.includes('Technologia energetyczna (Poziom 1)'), 'badanie na przeglądzie');
  check(/Lekki myśliwiec\s*0 \/ 5/.test(text), 'produkcja stoczni na przeglądzie');
  check(text.includes('Pozostałe planety') && text.includes('Kolonia') && text.includes('Elektrownia słoneczna'), 'budowa na innej planecie');
  check((await p.locator('.activity-panel .progress').count()) >= 4, 'paski postępu');

  await p.click('.activity-panel button:has-text("Kolonia")');
  await p.waitForSelector('.panel-title:has-text("Kolonia")');
  check(true, 'przejście na inną planetę z przeglądu');

  finish();
  if (!process.exitCode) console.log('E2E OVERVIEW OK');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
