import { glowFilter, id, linear, radial, resetIds, shade, svg } from './lib.mjs';

/** Logo: planeta z orbita i napis SPACE PIONEERS w metalicznej stylizacji. */
function logo() {
  resetIds();
  const W = 620;
  const H = 150;
  const defs = [];
  const metalText = id('mt');
  defs.push(linear(metalText, [[0, '#ffffff'], [0.42, '#c4d8ee'], [0.5, '#5d82ad'], [0.58, '#8fb0d4'], [1, '#e8f2ff']]));
  const orange = id('or');
  defs.push(linear(orange, [[0, '#ffe0a0'], [0.5, '#f0a030'], [1, '#a85a10']]));
  const planet = id('pl');
  defs.push(radial(planet, [[0, '#bfe4ff'], [0.35, '#4a8ad0'], [0.8, '#103a6e'], [1, '#04101e']], { cx: 0.35, cy: 0.3 }));
  const glow = id('gl');
  defs.push(glowFilter(glow, 5));
  const shadow = id('sd');
  defs.push(`<filter id="${shadow}" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.8"/></filter>`);
  let s = '';
  // planeta z pierscieniem
  s += `<g transform="translate(70 75)">`;
  s += `<path d="M -62 0 A 62 16 0 0 1 62 0" fill="none" stroke="url(#${orange})" stroke-width="5" transform="rotate(-18)" opacity="0.75"/>`;
  s += `<circle cx="0" cy="0" r="40" fill="url(#${planet})" filter="url(#${glow})"/>`;
  s += `<path d="M -62 0 A 62 16 0 0 0 62 0" fill="none" stroke="url(#${orange})" stroke-width="5" transform="rotate(-18)"/>`;
  s += `<circle cx="44" cy="-46" r="5" fill="#fff6d0" filter="url(#${glow})"/>`;
  s += `</g>`;
  s += `<text x="150" y="78" font-family="'Trebuchet MS', 'DejaVu Sans', Verdana, sans-serif" font-size="58" font-weight="bold" letter-spacing="6" fill="url(#${metalText})" stroke="#0c1a2c" stroke-width="1.5" filter="url(#${shadow})">SPACE</text>`;
  s += `<text x="152" y="128" font-family="'Trebuchet MS', 'DejaVu Sans', Verdana, sans-serif" font-size="40" font-weight="bold" letter-spacing="9" fill="url(#${orange})" stroke="#2a1404" stroke-width="1" filter="url(#${shadow})">PIONEERS</text>`;
  s += `<rect x="150" y="88" width="440" height="3" fill="url(#${orange})" opacity="0.8"/>`;
  return { markup: svg(W, H, defs, s), w: W, h: H };
}

function resourceIcon(kind) {
  resetIds();
  const S = 64;
  const defs = [];
  const glow = id('gl');
  defs.push(glowFilter(glow, 2));
  let s = '';
  if (kind === 'metal') {
    const g = id('m');
    defs.push(linear(g, [[0, '#f4f7fb'], [0.5, '#9aa4b2'], [1, '#4a5260']]));
    const ingot = (x, y) => `<polygon points="${x},${y + 14} ${x + 8},${y} ${x + 36},${y} ${x + 44},${y + 14}" fill="url(#${g})" stroke="#2a313c"/><polygon points="${x + 8},${y} ${x + 36},${y} ${x + 32},${y + 5} ${x + 12},${y + 5}" fill="#ffffff" opacity="0.5"/>`;
    s += ingot(10, 38) + ingot(4, 22) + ingot(18, 22) + ingot(10, 6);
  } else if (kind === 'crystal') {
    const g = id('c');
    defs.push(linear(g, [[0, '#e8f8ff'], [0.4, '#6fc4ff'], [1, '#1d4f9a']], { x2: 1, y2: 1 }));
    s += `<polygon points="32,4 52,22 32,60 12,22" fill="url(#${g})" stroke="#bfe8ff" stroke-width="1.5" filter="url(#${glow})"/>`;
    s += `<polygon points="32,4 40,22 32,60 24,22" fill="#ffffff" opacity="0.3"/><line x1="12" y1="22" x2="52" y2="22" stroke="#e8f8ff" stroke-width="1.2"/>`;
  } else if (kind === 'tritium') {
    const g = id('t');
    defs.push(linear(g, [[0, '#c8ffe0'], [0.5, '#30d080'], [1, '#0a6a3a']]));
    s += `<path d="M 32 4 C 32 4 12 30 12 42 A 20 20 0 0 0 52 42 C 52 30 32 4 32 4 Z" fill="url(#${g})" stroke="#c8ffe0" stroke-width="1.5" filter="url(#${glow})"/>`;
    s += `<ellipse cx="24" cy="38" rx="4" ry="8" fill="#ffffff" opacity="0.5"/>`;
    s += `<text x="32" y="50" font-family="Verdana" font-size="14" font-weight="bold" text-anchor="middle" fill="#04301a">T</text>`;
  } else {
    const g = id('e');
    defs.push(linear(g, [[0, '#fffbe0'], [0.5, '#ffd040'], [1, '#c07a10']]));
    s += `<polygon points="38,2 12,36 30,36 22,62 52,24 34,24 44,2" fill="url(#${g})" stroke="#fff6c8" stroke-width="1.5" filter="url(#${glow})"/>`;
  }
  return svg(S, S, defs, s);
}

export function ui() {
  const l = logo();
  const items = [{ key: 'logo', file: 'layout/logo.png', fn: () => l.markup, w: l.w, h: l.h, format: 'png' }];
  for (const k of ['metal', 'crystal', 'tritium', 'energy']) {
    items.push({ key: `resource/${k}`, file: `resources/${k}.png`, fn: () => resourceIcon(k), w: 64, h: 64, format: 'png' });
  }
  return items;
}

export { shade };
