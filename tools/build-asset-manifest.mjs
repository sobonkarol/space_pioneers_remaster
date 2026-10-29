#!/usr/bin/env node
/**
 * Generuje frontend/public/assets/original/manifest.json na podstawie plikow w tym katalogu.
 *
 * Konwencja nazw (rozszerzenie dowolne: gif, png, jpg, webp):
 *   layout/logo.*                      -> "logo"
 *   layout/background.*                -> "background"
 *   resources/<metal|crystal|tritium|energy>.*   -> "resource/<klucz>"
 *   buildings/<klucz_budynku>.*        -> "building/<klucz>"
 *   research/<klucz_badania>.*         -> "research/<klucz>"
 *   ships/<klucz_statku>.*             -> "ship/<klucz>"
 *   defense/<klucz_obrony>.*           -> "defense/<klucz>"
 *   planets/<typ>/<wariant>.*          -> "planet/<typ>/<wariant>"   (typ: hot, dry, normal, water, ice)
 *   planets/default.*                  -> "planet/default"
 * Uzycie: node tools/build-asset-manifest.mjs
 */
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'public', 'assets', 'original');
const IMAGE = new Set(['.gif', '.png', '.jpg', '.jpeg', '.webp', '.svg']);
const FOLDER_KIND = { buildings: 'building', research: 'research', ships: 'ship', defense: 'defense', resources: 'resource' };

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const manifest = {};
for (const file of walk(root)) {
  if (!IMAGE.has(extname(file).toLowerCase())) continue;
  const rel = relative(root, file).split('\\').join('/');
  const parts = rel.split('/');
  const stem = basename(file, extname(file));
  let key = null;
  if (parts[0] === 'layout' && parts.length === 2) key = stem;
  else if (FOLDER_KIND[parts[0]] && parts.length === 2) key = `${FOLDER_KIND[parts[0]]}/${stem}`;
  else if (parts[0] === 'planets' && parts.length === 3) key = `planet/${parts[1]}/${Number(stem) || stem}`;
  else if (parts[0] === 'planets' && parts.length === 2) key = `planet/${stem}`;
  if (key) manifest[key] = rel;
  else console.warn(`Pominieto (nieznana konwencja): ${rel}`);
}
const out = { _comment: 'Wygenerowano przez tools/build-asset-manifest.mjs', ...Object.fromEntries(Object.entries(manifest).sort()) };
writeFileSync(join(root, 'manifest.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`Zapisano ${Object.keys(manifest).length} wpisow do manifest.json`);
