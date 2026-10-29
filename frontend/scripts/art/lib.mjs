// Wspolne narzedzia do generowania grafik SVG (oryginalna oprawa Space Pioneers Remaster).

/** Deterministyczny generator liczb losowych (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(text) {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

let uid = 0;
/** Unikalne id w obrebie dokumentu. */
export function id(prefix = 'g') {
  uid += 1;
  return `${prefix}${uid}`;
}

export function resetIds() {
  uid = 0;
}

export function svg(w, h, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs.join('')}</defs>${body}</svg>`;
}

export function linear(gid, stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1 } = {}) {
  const s = stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('');
  return `<linearGradient id="${gid}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${s}</linearGradient>`;
}

export function radial(gid, stops, { cx = 0.5, cy = 0.5, r = 0.5, fx, fy } = {}) {
  const s = stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('');
  const f = fx !== undefined ? ` fx="${fx}" fy="${fy}"` : '';
  return `<radialGradient id="${gid}" cx="${cx}" cy="${cy}" r="${r}"${f}>${s}</radialGradient>`;
}

export function glowFilter(fid, std = 3) {
  return `<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${std}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

export function blurFilter(fid, std = 4) {
  return `<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${std}"/></filter>`;
}

/** Szum (tekstura) nakladany na wypelnienie: ziarnistosc metalu, skaly, terenu. */
export function grainFilter(fid, { freq = 0.9, octaves = 2, seed = 1, strength = 0.18 } = {}) {
  return `<filter id="${fid}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${strength} 0" result="a"/>
    <feComposite in="a" in2="SourceGraphic" operator="in" result="ai"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="ai"/></feMerge>
  </filter>`;
}

export function stars(r, w, h, count, { maxR = 1.2, minOp = 0.3 } = {}) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = (r() * w).toFixed(1);
    const y = (r() * h).toFixed(1);
    const rad = (0.3 + r() * maxR).toFixed(2);
    const op = (minOp + r() * (1 - minOp)).toFixed(2);
    const tint = r() < 0.15 ? '#ffd9a0' : r() < 0.3 ? '#bcd8ff' : '#ffffff';
    out += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${tint}" opacity="${op}"/>`;
  }
  return out;
}

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (f >= 0) {
    r += (255 - r) * f;
    g += (255 - g) * f;
    b += (255 - b) * f;
  } else {
    r *= 1 + f;
    g *= 1 + f;
    b *= 1 + f;
  }
  const c = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Bryla prostopadloscienna w rzucie 2.5D: przod, bok (prawy) i dach. */
export function block(defs, x, y, w, h, depth, color, { light = 0.25, top = true } = {}) {
  const front = id('f');
  defs.push(linear(front, [[0, shade(color, light)], [1, shade(color, -0.25)]]));
  const d = depth;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${front})"/>`;
  s += `<polygon points="${x + w},${y} ${x + w + d},${y - d * 0.6} ${x + w + d},${y + h - d * 0.6} ${x + w},${y + h}" fill="${shade(color, -0.45)}"/>`;
  if (top) {
    s += `<polygon points="${x},${y} ${x + d},${y - d * 0.6} ${x + w + d},${y - d * 0.6} ${x + w},${y}" fill="${shade(color, 0.45)}"/>`;
  }
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${shade(color, -0.6)}" stroke-width="0.8" opacity="0.6"/>`;
  return s;
}

/** Walec pionowy (zbiornik, silos). */
export function cylinder(defs, cx, y, rx, h, color, { capColor } = {}) {
  const g = id('c');
  defs.push(linear(g, [[0, shade(color, -0.45)], [0.35, shade(color, 0.35)], [0.6, color], [1, shade(color, -0.55)]], { x2: 1, y2: 0 }));
  const ry = rx * 0.32;
  return `<rect x="${cx - rx}" y="${y}" width="${rx * 2}" height="${h}" fill="url(#${g})"/>
    <ellipse cx="${cx}" cy="${y + h}" rx="${rx}" ry="${ry}" fill="url(#${g})"/>
    <ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}" fill="${capColor ?? shade(color, 0.35)}" stroke="${shade(color, -0.4)}" stroke-width="0.8"/>`;
}

/** Kopula (polelipsa) z refleksem. */
export function dome(defs, cx, cy, rx, ry, color, { opacity = 1 } = {}) {
  const g = id('d');
  defs.push(radial(g, [[0, shade(color, 0.7)], [0.45, color], [1, shade(color, -0.55)]], { cx: 0.35, cy: 0.3, r: 0.8 }));
  return `<path d="M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy} Z" fill="url(#${g})" opacity="${opacity}"/>`;
}

/** Swiatelko z poswiata. */
export function lamp(defs, x, y, r, color) {
  const g = id('l');
  defs.push(radial(g, [[0, '#ffffff'], [0.25, color], [1, color, 0]]));
  return `<circle cx="${x}" cy="${y}" r="${r * 3}" fill="url(#${g})"/><circle cx="${x}" cy="${y}" r="${r * 0.6}" fill="#fff"/>`;
}

/** Sceneria planety dla budynkow i obrony: niebo, gwiazdy, ksiezyc, grunt. */
export function groundScene(defs, size, seed, palette) {
  const r = rng(seed);
  const sky = id('sky');
  const grd = id('grd');
  const grain = id('gr');
  const horizonY = size * 0.66;
  defs.push(linear(sky, [[0, palette.skyTop], [0.75, palette.skyBottom], [1, palette.horizon]]));
  defs.push(linear(grd, [[0, palette.groundTop], [1, palette.groundBottom]]));
  defs.push(grainFilter(grain, { freq: 0.8, octaves: 3, seed: seed % 97, strength: 0.35 }));
  const moon = id('moon');
  defs.push(radial(moon, [[0, palette.moon ?? '#c9d6e8'], [0.7, shade(palette.moon ?? '#c9d6e8', -0.5)], [1, '#000', 0]], { cx: 0.35, cy: 0.35 }));
  const mx = size * (0.12 + r() * 0.2);
  const my = size * (0.1 + r() * 0.12);
  const mr = size * (0.07 + r() * 0.05);
  let s = `<rect width="${size}" height="${size}" fill="url(#${sky})"/>`;
  s += stars(r, size, horizonY, 45, { maxR: 0.9 });
  s += `<circle cx="${mx}" cy="${my}" r="${mr}" fill="url(#${moon})" opacity="0.85"/>`;
  // odlegle wzgorza
  let hills = `M 0 ${horizonY}`;
  for (let x = 0; x <= size; x += size / 8) {
    hills += ` L ${x.toFixed(1)} ${(horizonY - 4 - r() * size * 0.06).toFixed(1)}`;
  }
  hills += ` L ${size} ${horizonY} Z`;
  s += `<path d="${hills}" fill="${shade(palette.groundTop, -0.35)}" opacity="0.9"/>`;
  s += `<rect x="0" y="${horizonY}" width="${size}" height="${size - horizonY}" fill="url(#${grd})" filter="url(#${grain})"/>`;
  return { svg: s, horizonY };
}

export function shadowEllipse(defs, cx, cy, rx, ry) {
  const g = id('sh');
  defs.push(radial(g, [[0, '#000', 0.55], [1, '#000', 0]]));
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${g})"/>`;
}

/** Ramka kafla: winieta + delikatna metalowa obwodka. */
export function frame(defs, size) {
  const v = id('vig');
  defs.push(radial(v, [[0.6, '#000', 0], [1, '#000', 0.55]], { r: 0.75 }));
  return `<rect width="${size}" height="${size}" fill="url(#${v})"/><rect x="1" y="1" width="${size - 2}" height="${size - 2}" fill="none" stroke="#7ea4cc" stroke-opacity="0.35" stroke-width="2"/>`;
}

export const PALETTES = {
  rocky: { skyTop: '#05070f', skyBottom: '#13233d', horizon: '#3a5470', groundTop: '#4a4a52', groundBottom: '#1d1d22', moon: '#d8c6a8' },
  ice: { skyTop: '#04091a', skyBottom: '#123a5c', horizon: '#5d9cc8', groundTop: '#8aa8c4', groundBottom: '#2c3e52', moon: '#e9f2ff' },
  desert: { skyTop: '#0c0610', skyBottom: '#3a1f2c', horizon: '#b0613a', groundTop: '#8a5a36', groundBottom: '#2e1a10', moon: '#ffd2a0' },
  green: { skyTop: '#030b10', skyBottom: '#0f3438', horizon: '#3f8a7a', groundTop: '#3c5e3a', groundBottom: '#12200f', moon: '#cfe8d0' },
  moon: { skyTop: '#000000', skyBottom: '#05080f', horizon: '#1a2230', groundTop: '#7a7c82', groundBottom: '#2a2b30', moon: '#5a8ad0' },
  violet: { skyTop: '#07040f', skyBottom: '#241338', horizon: '#6a3f8c', groundTop: '#4b3a5a', groundBottom: '#17101f', moon: '#e6d2ff' },
};
