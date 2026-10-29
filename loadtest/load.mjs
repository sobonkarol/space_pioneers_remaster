/**
 * Test obciazeniowy API: rejestruje N graczy i przez D sekund kazdy z nich wykonuje typowa sekwencje zapytan
 * (przeglad, budynki, galaktyka, wiadomosci, ranking, rozbudowa, flota). Mierzy przepustowosc i czasy odpowiedzi.
 *
 * Serwer uruchom z podniesionymi limitami (jeden adres IP rejestruje wszystkich graczy):
 *   RATE_LIMIT_AUTH_PER_MINUTE=100000 RATE_LIMIT_API_PER_MINUTE=100000 RATE_LIMIT_API_BURST=100000 java -jar ...
 * Uruchomienie: node loadtest/load.mjs [graczy=100] [sekund=60] [adres=http://localhost:8080] [przerwa_ms=0]
 */
const PLAYERS = Number(process.argv[2] ?? 100);
const SECONDS = Number(process.argv[3] ?? 60);
const BASE = process.argv[4] ?? 'http://localhost:8080';
const THINK_MS = Number(process.argv[5] ?? 0);
const stamp = Date.now().toString(36);

const stats = new Map(); // nazwa -> {n, err, times[]}
function record(name, ms, ok) {
  let s = stats.get(name);
  if (!s) stats.set(name, (s = { n: 0, err: 0, times: [] }));
  s.n++;
  if (!ok) s.err++;
  s.times.push(ms);
}

async function call(name, token, method, path, body) {
  const t0 = performance.now();
  let status = 0;
  let data = null;
  try {
    const r = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    status = r.status;
    const text = await r.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    status = 0;
  }
  // 400 to odrzucenie przez reguly gry (np. brak surowcow) - poprawna odpowiedz serwera
  record(name, performance.now() - t0, status > 0 && status < 500 && status !== 429);
  return { status, data };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function player(i, deadline) {
  const name = `Load${stamp}${i}`.slice(0, 20);
  const reg = await call('register', null, 'POST', '/auth/register', {
    username: name, email: `${name.toLowerCase()}@load.test`, password: 'haslo12345',
  });
  if (reg.status !== 201) return;
  const token = reg.data.token;
  const planet = reg.data.profile.homePlanetId;
  const ov = await call('overview', token, 'GET', `/planets/${planet}/overview`);
  const [g, s] = ov.data.planet.coordinates.split(':');
  const builds = ['solar_plant', 'metal_mine', 'crystal_mine', 'solar_plant', 'metal_mine'];
  let k = 0;
  while (Date.now() < deadline) {
    await call('overview', token, 'GET', `/planets/${planet}/overview`);
    await call('buildings', token, 'GET', `/planets/${planet}/buildings`);
    await call('build', token, 'POST', `/planets/${planet}/buildings/${builds[k++ % builds.length]}`);
    await call('galaxy', token, 'GET', `/galaxy/${g}/${Math.max(1, Number(s) + (k % 3) - 1)}`);
    await call('messages', token, 'GET', '/messages');
    await call('fleet-dispatch', token, 'GET', `/planets/${planet}/fleet-dispatch`);
    await call('research', token, 'GET', `/planets/${planet}/research`);
    if (k % 5 === 0) await call('ranking', token, 'GET', '/ranking?type=players&category=total&page=1');
    if (THINK_MS) await sleep(THINK_MS);
  }
}

function pct(sorted, p) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))] : 0;
}

const started = Date.now();
const deadline = started + SECONDS * 1000;
console.log(`Gracze: ${PLAYERS}, czas: ${SECONDS} s, serwer: ${BASE}, przerwa: ${THINK_MS} ms`);
await Promise.all(Array.from({ length: PLAYERS }, (_, i) => player(i, deadline)));
const elapsed = (Date.now() - started) / 1000;

let total = 0;
let errors = 0;
const all = [];
console.log('\nzapytanie        liczba   błędy   p50 ms   p95 ms   p99 ms   max ms');
for (const [name, s] of [...stats.entries()].sort()) {
  const t = s.times.sort((a, b) => a - b);
  total += s.n;
  errors += s.err;
  all.push(...t);
  console.log(`${name.padEnd(16)} ${String(s.n).padStart(6)} ${String(s.err).padStart(7)} ${pct(t, 50).toFixed(1).padStart(8)} `
    + `${pct(t, 95).toFixed(1).padStart(8)} ${pct(t, 99).toFixed(1).padStart(8)} ${t[t.length - 1].toFixed(1).padStart(8)}`);
}
all.sort((a, b) => a - b);
console.log(`\nRazem: ${total} zapytań w ${elapsed.toFixed(1)} s = ${(total / elapsed).toFixed(0)} zapytań/s, `
  + `błędy: ${errors} (${((errors / Math.max(1, total)) * 100).toFixed(2)}%), p50 ${pct(all, 50).toFixed(1)} ms, `
  + `p95 ${pct(all, 95).toFixed(1)} ms, p99 ${pct(all, 99).toFixed(1)} ms`);
if (errors / Math.max(1, total) > 0.01) process.exitCode = 1;
