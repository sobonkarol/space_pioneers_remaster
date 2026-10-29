/**
 * Manifest licencjonowanych grafik oryginalnej gry.
 *
 * Plik `public/assets/original/manifest.json` mapuje klucze grafik na sciezki plikow, np.:
 * {
 *   "logo": "layout/logo.gif",
 *   "background": "layout/background.jpg",
 *   "building/metal_mine": "buildings/metal_mine.gif",
 *   "planet/normal/3": "planets/normal03.jpg"
 * }
 * Gdy klucza nie ma w manifescie, interfejs pokazuje wyraznie oznaczona grafike zastepcza.
 * Manifest mozna wygenerowac z katalogu narzedziem `tools/build-asset-manifest.mjs`.
 */

export type AssetKind = 'building' | 'research' | 'ship' | 'defense' | 'planet' | 'resource' | 'layout';

let manifest: Record<string, string> = {};
let loaded = false;

export async function loadAssetManifest(): Promise<void> {
  try {
    const res = await fetch('/assets/original/manifest.json', { cache: 'no-cache' });
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      manifest = Object.fromEntries(
        Object.entries(data).filter((e): e is [string, string] => typeof e[1] === 'string' && !e[0].startsWith('_')),
      );
    }
  } catch {
    manifest = {};
  }
  loaded = true;
  const background = assetUrl('background');
  if (background) {
    document.body.style.backgroundImage = `url("${background}")`;
    document.body.style.backgroundSize = 'cover';
  }
}

export function assetsLoaded(): boolean {
  return loaded;
}

export function hasOriginalAssets(): boolean {
  return Object.keys(manifest).length > 0;
}

/** Sciezka do oryginalnej grafiki albo null. */
export function assetUrl(key: string): string | null {
  const path = manifest[key];
  return path ? `/assets/original/${path}` : null;
}

export function itemAssetKey(kind: AssetKind, key: string): string {
  return `${kind}/${key}`;
}

export function planetAssetKey(planetType: string | undefined, variant: number): string[] {
  const type = planetType ?? 'normal';
  return [`planet/${type}/${variant}`, `planet/${type}`, 'planet/default'];
}

export function firstAsset(keys: string[]): string | null {
  for (const k of keys) {
    const url = assetUrl(k);
    if (url) return url;
  }
  return null;
}
