#!/usr/bin/env node
/**
 * Generator grafik 3D Space Pioneers Remaster: modele budowane w three.js (render.html + *3d.js),
 * renderowane w Chromium (WebGL) z oswietleniem filmowym i poswiata, zapisywane do public/assets/art/.
 *
 * Uzycie: CHROME_PATH=/sciezka/do/chromium node scripts/art3d/render.mjs [--only=ships,buildings] [--keys=a,b] [--sheet]
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const OUT = join(root, 'public', 'assets', 'art');
const args = process.argv.slice(2);
const opt = (name) => (args.find((a) => a.startsWith(`--${name}=`)) ?? '').slice(name.length + 3).split(',').filter(Boolean);
const only = opt('only');
const keys = opt('keys');
const outDir = opt('out')[0] ?? OUT;

/** Grupy: plik modulu, folder wyjsciowy, prefiks klucza manifestu. */
const GROUPS = [
  { group: 'ships', module: 'ships3d.js', folder: 'ships', kind: 'ship' },
  { group: 'defense', module: 'defense3d.js', folder: 'defense', kind: 'defense' },
  { group: 'buildings', module: 'buildings3d.js', folder: 'buildings', kind: 'building' },
  { group: 'research', module: 'research3d.js', folder: 'research', kind: 'research' },
];

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html' };

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('[przegladarka]', m.text()); });
page.on('pageerror', (e) => console.error('[przegladarka]', e.message));
await page.route('http://art.local/**', (route) => {
  const path = new URL(route.request().url()).pathname;
  const file = path.startsWith('/three/') ? join(root, 'node_modules', 'three', path.slice(7)) : join(here, path.slice(1));
  if (!existsSync(file)) return route.fulfill({ status: 404, body: 'brak' });
  return route.fulfill({ status: 200, contentType: TYPES[extname(file)] ?? 'application/octet-stream', body: readFileSync(file) });
});
await page.goto('http://art.local/render.html');
await page.waitForFunction(() => window.artReady === true, null, { timeout: 60000 });

const manifestPath = join(OUT, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
let count = 0;
for (const g of GROUPS) {
  if (only.length && !only.includes(g.group)) continue;
  if (!existsSync(join(here, g.module))) continue;
  const list = await page.evaluate((m) => window.listItems(m), g.module);
  for (const key of list) {
    if (keys.length && !keys.includes(key)) continue;
    const t0 = Date.now();
    const dataUrl = await page.evaluate(([m, k]) => window.renderItem(m, k), [g.module, key]);
    const file = join(outDir, g.folder, `${key}.jpg`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    if (outDir === OUT) manifest[`${g.kind}/${key}`] = `${g.folder}/${key}.jpg`;
    count++;
    console.log(`${g.kind}/${key} (${Date.now() - t0} ms)`);
  }
}
if (outDir === OUT) writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
await browser.close();
console.log(`Wyrenderowano ${count} grafik.`);
