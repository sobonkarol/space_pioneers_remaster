#!/usr/bin/env node
/**
 * Generator oryginalnej oprawy graficznej Space Pioneers Remaster.
 * Rysuje grafiki jako SVG (kod w tym katalogu), rasteryzuje je przez Chromium do PNG/JPG
 * w frontend/public/assets/art/ i zapisuje manifest.json.
 *
 * Uzycie: CHROME_PATH=/sciezka/do/chromium node scripts/art/generate.mjs [--only=buildings,ships] [--sheet]
 * (bez CHROME_PATH probuje uzyc pakietu @sparticuz/chromium, jesli jest zainstalowany)
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildings } from './buildings.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'public', 'assets', 'art');
const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const sheet = args.includes('--sheet');

/** Lista grafik: [klucz manifestu, sciezka pliku, funkcja SVG, szerokosc, wysokosc, format] */
async function catalog() {
  const items = [];
  const add = (group, list, folder, kind, size, format = 'png') => {
    if (only.length && !only.includes(group)) return;
    for (const [key, fn] of Object.entries(list)) {
      items.push({ key: `${kind}/${key}`, file: `${folder}/${key}.${format}`, fn, w: size, h: size, format });
    }
  };
  add('buildings', buildings, 'buildings', 'building', 240);
  const optional = async (group, module, exportName, folder, kind, size) => {
    const path = join(here, module);
    if (!existsSync(path)) return;
    const mod = await import(path);
    add(group, mod[exportName], folder, kind, size);
  };
  await optional('research', 'research.mjs', 'research', 'research', 'research', 240);
  await optional('ships', 'ships.mjs', 'ships', 'ships', 'ship', 240);
  await optional('defense', 'defense.mjs', 'defense', 'defense', 'defense', 240);
  if (existsSync(join(here, 'planets.mjs')) && (!only.length || only.includes('planets'))) {
    const { planets } = await import(join(here, 'planets.mjs'));
    for (const p of planets()) items.push(p);
  }
  if (existsSync(join(here, 'ui.mjs')) && (!only.length || only.includes('ui'))) {
    const { ui } = await import(join(here, 'ui.mjs'));
    for (const p of ui()) items.push(p);
  }
  return items;
}

async function launch() {
  let executablePath = process.env.CHROME_PATH;
  let launchArgs = [];
  if (!executablePath) {
    const mod = await import('@sparticuz/chromium');
    const c = mod.default ?? mod;
    executablePath = await c.executablePath();
    launchArgs = c.args;
  }
  return chromium.launch({ executablePath, args: launchArgs, headless: true });
}

const items = await catalog();
const browser = await launch();
const page = await browser.newPage();
mkdirSync(OUT, { recursive: true });
const manifestPath = join(OUT, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const rendered = [];

for (const item of items) {
  const markup = item.fn();
  const file = join(OUT, item.file);
  mkdirSync(dirname(file), { recursive: true });
  await page.setViewportSize({ width: item.w, height: item.h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await page.screenshot({
    path: file,
    type: item.format === 'jpg' ? 'jpeg' : 'png',
    quality: item.format === 'jpg' ? 86 : undefined,
    omitBackground: item.format !== 'jpg',
    clip: { x: 0, y: 0, width: item.w, height: item.h },
  });
  manifest[item.key] = item.file;
  rendered.push(item);
  process.stdout.write('.');
}
console.log(`\nWygenerowano ${rendered.length} grafik.`);
manifest._comment = 'Oryginalna oprawa Space Pioneers Remaster - generowana przez frontend/scripts/art/generate.mjs';
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => (a === '_comment' ? -1 : b === '_comment' ? 1 : a.localeCompare(b))));
writeFileSync(manifestPath, JSON.stringify(sorted, null, 2) + '\n');

if (sheet) {
  const cells = rendered
    .filter((i) => i.w <= 400)
    .map((i) => `<figure><img src="data:image/png;base64,${readFileSync(join(OUT, i.file)).toString('base64')}" width="120" height="120"><figcaption>${i.key}</figcaption></figure>`)
    .join('');
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.setContent(`<html><body style="margin:8px;background:#05080f;color:#ccc;font:10px Verdana;display:flex;flex-wrap:wrap;gap:6px">${cells}<style>figure{margin:0;text-align:center;width:120px}</style></body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: process.env.SHEET_PATH ?? join(here, 'sheet.png'), fullPage: true });
  console.log('Arkusz podgladu zapisany.');
}
await browser.close();
