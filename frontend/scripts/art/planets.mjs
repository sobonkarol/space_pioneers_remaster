import { id, linear, radial, resetIds, rng, shade, stars, svg } from './lib.mjs';

const S = 300;
const C = S / 2;
const R = 120;

/** Palety typow planet: kolory tabeli przejscia szumu (od nizin do szczytow). */
const TYPES = {
  hot: { colors: ['#3a0a02', '#8a2a0a', '#d4561a', '#ffb050', '#fff0a0'], atmo: '#ff8040', freq: 0.012 },
  dry: { colors: ['#4a2a12', '#8a5a2e', '#c99a5e', '#e8cf9a', '#f6ead0'], atmo: '#ffc890', freq: 0.016 },
  normal: { colors: ['#0b2a5a', '#1f5aa0', '#2f8a4a', '#6a9a3a', '#e8eef0'], atmo: '#7ac8ff', freq: 0.014 },
  water: { colors: ['#04163a', '#0a3a7a', '#1d6ab8', '#4aa0e0', '#e0f4ff'], atmo: '#8ad8ff', freq: 0.01 },
  ice: { colors: ['#4a6a8a', '#8aa8c8', '#c8dcf0', '#e8f2fc', '#ffffff'], atmo: '#d0eaff', freq: 0.018 },
  moon: { colors: ['#2a2a2e', '#4a4a50', '#6e6e74', '#9a9aa0', '#cfcfd4'], atmo: '#9aa0aa', freq: 0.03 },
};

function table(values) {
  return values.map((v) => v.toFixed(3)).join(' ');
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function planet(type, variant) {
  resetIds();
  const def = TYPES[type];
  const r = rng(variant * 977 + type.length * 31);
  const defs = [];
  const tex = id('tx');
  const clip = id('cl');
  // przesuniecie palety miedzy wariantami
  const colors = def.colors.map((c) => shade(c, (r() - 0.5) * 0.25));
  const rgb = colors.map(hexToRgb);
  const freq = def.freq * (0.8 + r() * 0.5);
  const bands = type === 'hot' || type === 'dry' ? r() < 0.4 : false;
  defs.push(`<filter id="${tex}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${bands ? `${freq * 0.4} ${freq * 3}` : freq}" numOctaves="6" seed="${variant * 13 + 3}" result="n"/>
    <feColorMatrix in="n" type="luminanceToAlpha" result="l"/>
    <feColorMatrix in="n" type="matrix" values="0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 0 1" result="g"/>
    <feComponentTransfer in="g" result="c">
      <feFuncR type="table" tableValues="${table(rgb.map((x) => x[0]))}"/>
      <feFuncG type="table" tableValues="${table(rgb.map((x) => x[1]))}"/>
      <feFuncB type="table" tableValues="${table(rgb.map((x) => x[2]))}"/>
    </feComponentTransfer>
    <feComposite in="c" in2="SourceGraphic" operator="in"/>
  </filter>`);
  defs.push(`<clipPath id="${clip}"><circle cx="${C}" cy="${C}" r="${R}"/></clipPath>`);
  const shadeId = id('sh');
  defs.push(radial(shadeId, [[0, '#ffffff', 0.25], [0.45, '#000000', 0], [0.8, '#000000', 0.55], [1, '#000000', 0.9]], { cx: 0.35, cy: 0.32, r: 0.75 }));
  const atmo = id('at');
  defs.push(radial(atmo, [[0.78, def.atmo, 0], [0.84, def.atmo, 0.55], [1, def.atmo, 0]], { r: 0.5 }));
  const cloud = id('cd');
  defs.push(`<filter id="${cloud}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${0.02 + r() * 0.01} ${0.05 + r() * 0.02}" numOctaves="4" seed="${variant * 7 + 1}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 3 -1.6"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter>`);

  let s = '';
  const hasRing = type !== 'moon' && r() < 0.3;
  const ringTilt = -20 + r() * 40;
  const ringId = id('rg');
  defs.push(linear(ringId, [[0, shade(colors[3], 0.2), 0.1], [0.3, shade(colors[3], 0.3), 0.7], [0.5, shade(colors[2], 0.1), 0.4], [0.7, shade(colors[3], 0.4), 0.75], [1, shade(colors[3], 0.2), 0.1]], { x2: 1, y2: 0 }));
  if (hasRing) {
    s += `<g transform="rotate(${ringTilt} ${C} ${C})"><path d="M ${C - R * 1.22} ${C} A ${R * 1.22} ${R * 0.3} 0 0 1 ${C + R * 1.22} ${C}" fill="none" stroke="url(#${ringId})" stroke-width="14"/></g>`;
  }
  s += `<circle cx="${C}" cy="${C}" r="${R * 1.12}" fill="url(#${atmo})"/>`;
  s += `<g clip-path="url(#${clip})"><rect x="${C - R}" y="${C - R}" width="${R * 2}" height="${R * 2}" fill="#fff" filter="url(#${tex})"/>`;
  if (type === 'moon') {
    for (let i = 0; i < 18; i++) {
      const cx = C - R + r() * R * 2;
      const cy = C - R + r() * R * 2;
      const cr = 4 + r() * 16;
      s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${cr.toFixed(1)}" fill="#000" opacity="0.18"/><circle cx="${(cx - cr * 0.15).toFixed(1)}" cy="${(cy - cr * 0.15).toFixed(1)}" r="${(cr * 0.85).toFixed(1)}" fill="none" stroke="#fff" stroke-opacity="0.15" stroke-width="1.5"/>`;
    }
  }
  if (type === 'normal' || type === 'water' || (type === 'ice' && r() < 0.5)) {
    s += `<rect x="${C - R}" y="${C - R}" width="${R * 2}" height="${R * 2}" fill="#fff" filter="url(#${cloud})" opacity="0.75"/>`;
  }
  s += `<circle cx="${C}" cy="${C}" r="${R}" fill="url(#${shadeId})"/></g>`;
  if (hasRing) {
    s += `<g transform="rotate(${ringTilt} ${C} ${C})"><path d="M ${C - R * 1.22} ${C} A ${R * 1.22} ${R * 0.3} 0 0 0 ${C + R * 1.22} ${C}" fill="none" stroke="url(#${ringId})" stroke-width="14"/></g>`;
  }
  return svg(S, S, defs, s);
}

function background() {
  resetIds();
  const W = 1920;
  const H = 1080;
  const defs = [];
  const r = rng(4242);
  const neb = id('nb');
  defs.push(`<filter id="${neb}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.0016 0.0028" numOctaves="6" seed="17" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.35  0 0 0 0 0.75  0 0 0 2.4 -1.25"/>
  </filter>`);
  const neb2 = id('nb');
  defs.push(`<filter id="${neb2}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.0022 0.0016" numOctaves="5" seed="91" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.18  0 0 0 0 0.6  0 0 0 2.2 -1.3"/>
  </filter>`);
  const base = id('bs');
  defs.push(radial(base, [[0, '#0d1a33'], [0.6, '#060b18'], [1, '#020408']], { cx: 0.6, cy: 0.2, r: 0.9 }));
  let s = `<rect width="${W}" height="${H}" fill="url(#${base})"/>`;
  s += `<rect width="${W}" height="${H}" fill="#fff" filter="url(#${neb})" opacity="0.8"/>`;
  s += `<rect width="${W}" height="${H}" fill="#fff" filter="url(#${neb2})" opacity="0.55"/>`;
  s += stars(r, W, H, 1400, { maxR: 1.1, minOp: 0.2 });
  const bright = id('bt');
  defs.push(radial(bright, [[0, '#ffffff'], [0.15, '#cfe4ff', 0.6], [1, '#cfe4ff', 0]]));
  for (let i = 0; i < 25; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = 4 + r() * 8;
    s += `<circle cx="${x}" cy="${y}" r="${rad}" fill="url(#${bright})"/>`;
  }
  // odlegla planeta w rogu
  const pl = id('pl');
  defs.push(radial(pl, [[0, '#3a6aa8'], [0.6, '#0e2448'], [1, '#02060e']], { cx: 0.7, cy: 0.25 }));
  s += `<circle cx="${W * 0.9}" cy="${H * 1.15}" r="${H * 0.55}" fill="url(#${pl})"/>`;
  const rim = id('rm');
  defs.push(radial(rim, [[0.9, '#7ac8ff', 0], [0.97, '#7ac8ff', 0.35], [1, '#7ac8ff', 0]]));
  s += `<circle cx="${W * 0.9}" cy="${H * 1.15}" r="${H * 0.57}" fill="url(#${rim})"/>`;
  return svg(W, H, defs, s);
}

export function planets() {
  const items = [];
  for (const type of Object.keys(TYPES)) {
    const variants = type === 'moon' ? 5 : 10;
    for (let v = 1; v <= variants; v++) {
      items.push({ key: `planet/${type}/${v}`, file: `planets/${type}/${v}.png`, fn: () => planet(type, v), w: S, h: S, format: 'png' });
    }
  }
  items.push({ key: 'planet/default', file: 'planets/default.png', fn: () => planet('normal', 3), w: S, h: S, format: 'png' });
  items.push({ key: 'background', file: 'layout/background.jpg', fn: background, w: 1920, h: 1080, format: 'jpg' });
  return items;
}
