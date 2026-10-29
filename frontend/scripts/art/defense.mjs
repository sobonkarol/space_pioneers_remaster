import {
  PALETTES, block, dome, frame, glowFilter, groundScene, hash, id, lamp, linear, radial, resetIds, rng, shade,
  shadowEllipse, svg,
} from './lib.mjs';

const S = 240;

function tile(key, palette, draw) {
  resetIds();
  const defs = [];
  const scene = groundScene(defs, S, hash(key), PALETTES[palette]);
  const body = draw(defs, { y0: scene.horizonY, r: rng(hash(key) + 3) });
  return svg(S, S, defs, scene.svg + body + frame(defs, S));
}

function metal(defs, color) {
  const g = id('m');
  defs.push(linear(g, [[0, shade(color, 0.5)], [0.5, color], [1, shade(color, -0.55)]]));
  return `url(#${g})`;
}

function beam(defs, x1, y1, x2, y2, color, width) {
  const f = id('bf');
  defs.push(glowFilter(f, 3));
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" filter="url(#${f})"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffffff" stroke-width="${width * 0.35}" stroke-linecap="round"/>`;
}

/** Wiezyczka: podstawa, obrotnica, lufa skierowana w gore w prawo. */
function turret(defs, cx, base, size, color, barrels, barrelColor = '#c8d0da') {
  let s = shadowEllipse(defs, cx, base + 4, size * 1.3, size * 0.3);
  s += block(defs, cx - size, base - size * 0.5, size * 2, size * 0.5, size * 0.3, shade(color, -0.2));
  s += dome(defs, cx, base - size * 0.5, size * 0.85, size * 0.7, color);
  const angle = -32;
  s += `<g transform="rotate(${angle} ${cx} ${base - size * 0.75})">`;
  barrels.forEach((off, i) => {
    s += `<rect x="${cx}" y="${base - size * 0.75 + off - size * 0.08}" width="${size * 1.9}" height="${size * 0.16}" fill="${metal(defs, barrelColor)}" stroke="#2a313c" stroke-width="0.6"/>`;
    if (i === 0) s += `<rect x="${cx + size * 1.7}" y="${base - size * 0.75 + off - size * 0.12}" width="${size * 0.25}" height="${size * 0.24}" fill="#3a424e"/>`;
  });
  s += `</g>`;
  return s;
}

export const defense = {
  rocket_launcher: () =>
    tile('rocket_launcher', 'rocky', (defs, { y0 }) => {
      let s = shadowEllipse(defs, 120, y0 + 50, 90, 12);
      s += block(defs, 50, y0 + 18, 120, 28, 16, '#5a6250');
      s += `<g transform="rotate(-28 110 ${y0 + 10})">`;
      s += `<rect x="70" y="${y0 - 22}" width="90" height="44" rx="3" fill="${metal(defs, '#6e7a5e')}" stroke="#23281d"/>`;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          s += `<circle cx="${160}" cy="${y0 - 14 + i * 14}" r="5" fill="#1a1d16"/>`;
          if (j === 0) s += `<path d="M 160 ${y0 - 18 + i * 14} L 172 ${y0 - 14 + i * 14} L 160 ${y0 - 10 + i * 14} Z" fill="#c0302a"/>`;
        }
      }
      s += `</g>`;
      // wystrzelona rakieta
      s += `<path d="M 150 ${y0 - 90} L 200 ${y0 - 130}" stroke="#ffcf73" stroke-width="2" stroke-dasharray="2 4" opacity="0.7"/>`;
      s += `<g transform="rotate(-38 205 ${y0 - 134})"><rect x="200" y="${y0 - 137}" width="16" height="6" rx="3" fill="#d0d6de"/><path d="M 216 ${y0 - 137} L 222 ${y0 - 134} L 216 ${y0 - 131} Z" fill="#c0302a"/></g>`;
      s += lamp(defs, 196, y0 - 128, 3, '#ff9a40');
      return s;
    }),

  light_laser: () =>
    tile('light_laser', 'desert', (defs, { y0 }) => {
      let s = turret(defs, 100, y0 + 44, 34, '#7a8494', [0]);
      s += beam(defs, 150, y0 - 4, 238, y0 - 70, '#ff4030', 4);
      s += lamp(defs, 152, y0 - 6, 3, '#ff4030');
      return s;
    }),

  heavy_laser: () =>
    tile('heavy_laser', 'desert', (defs, { y0 }) => {
      let s = turret(defs, 95, y0 + 46, 46, '#6a7484', [-8, 8]);
      s += beam(defs, 160, y0 - 22, 238, y0 - 80, '#ff3a20', 6);
      s += beam(defs, 168, y0 - 6, 238, y0 - 58, '#ff3a20', 4);
      return s;
    }),

  ion_cannon: () =>
    tile('ion_cannon', 'ice', (defs, { y0 }) => {
      let s = shadowEllipse(defs, 115, y0 + 48, 90, 14);
      s += block(defs, 55, y0 + 10, 110, 36, 18, '#4a5468');
      s += dome(defs, 110, y0 + 10, 55, 50, '#7a8aa8');
      const glow = id('ig');
      defs.push(glowFilter(glow, 4));
      s += `<g transform="rotate(-25 110 ${y0 - 15})">`;
      s += `<rect x="110" y="${y0 - 26}" width="95" height="22" rx="4" fill="${metal(defs, '#8a9ab8')}" stroke="#20283a"/>`;
      for (let i = 0; i < 4; i++) {
        s += `<ellipse cx="${135 + i * 18}" cy="${y0 - 15}" rx="4" ry="15" fill="none" stroke="#59c8ff" stroke-width="2.5" filter="url(#${glow})"/>`;
      }
      s += `</g>`;
      const orb = id('io');
      defs.push(radial(orb, [[0, '#ffffff'], [0.4, '#7ad8ff'], [1, '#2060ff', 0]]));
      s += `<circle cx="215" cy="${y0 - 70}" r="20" fill="url(#${orb})"/>`;
      return s;
    }),

  gauss_cannon: () =>
    tile('gauss_cannon', 'rocky', (defs, { y0 }) => {
      let s = shadowEllipse(defs, 110, y0 + 48, 95, 14);
      s += block(defs, 40, y0 + 6, 120, 40, 20, '#4e5260');
      s += `<g transform="rotate(-30 90 ${y0})">`;
      s += `<rect x="70" y="${y0 - 26}" width="160" height="10" fill="${metal(defs, '#a6aebc')}" stroke="#20262f"/>`;
      s += `<rect x="70" y="${y0 + 4}" width="160" height="10" fill="${metal(defs, '#a6aebc')}" stroke="#20262f"/>`;
      for (let i = 0; i < 7; i++) {
        s += `<rect x="${85 + i * 20}" y="${y0 - 30}" width="8" height="48" fill="#3a3f4c" stroke="#7a8494"/>`;
      }
      s += `<rect x="60" y="${y0 - 36}" width="34" height="58" rx="4" fill="${metal(defs, '#6a7080')}"/>`;
      s += `</g>`;
      s += lamp(defs, 214, y0 - 104, 3, '#c0e0ff');
      return s;
    }),

  plasma_turret: () =>
    tile('plasma_turret', 'violet', (defs, { y0 }) => {
      let s = shadowEllipse(defs, 120, y0 + 48, 90, 14);
      s += `<polygon points="60,${y0 + 46} 85,${y0 - 30} 155,${y0 - 30} 180,${y0 + 46}" fill="${metal(defs, '#5a4a6e')}" stroke="#1a1024"/>`;
      for (const x of [90, 120, 150]) s += `<rect x="${x - 3}" y="${y0 - 20}" width="6" height="60" fill="#c07aff" opacity="0.6"/>`;
      const glow = id('pg');
      defs.push(glowFilter(glow, 8));
      const orb = id('po');
      defs.push(radial(orb, [[0, '#ffffff'], [0.3, '#f0c0ff'], [0.6, '#b050ff', 0.9], [1, '#6020c0', 0]]));
      s += `<circle cx="120" cy="${y0 - 66}" r="42" fill="url(#${orb})" filter="url(#${glow})"/>`;
      s += `<path d="M 88 ${y0 - 30} L 100 ${y0 - 52} M 152 ${y0 - 30} L 140 ${y0 - 52}" stroke="#c8b0e0" stroke-width="5"/>`;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        s += `<path d="M ${120 + Math.cos(a) * 30} ${y0 - 66 + Math.sin(a) * 30} Q ${120 + Math.cos(a + 0.4) * 55} ${y0 - 66 + Math.sin(a + 0.4) * 55} ${120 + Math.cos(a + 0.2) * 70} ${y0 - 66 + Math.sin(a + 0.2) * 70}" stroke="#e8c8ff" stroke-width="1.5" fill="none" opacity="0.7"/>`;
      }
      return s;
    }),

  small_shield_dome: () =>
    tile('small_shield_dome', 'green', (defs, { y0 }) => {
      let s = '';
      s += block(defs, 70, y0 + 16, 50, 30, 14, '#6a7484');
      s += block(defs, 130, y0 + 22, 40, 24, 12, '#6a7484');
      const sh = id('sh');
      defs.push(radial(sh, [[0, '#7affd8', 0.05], [0.8, '#59e8ff', 0.25], [1, '#bff8ff', 0.8]], { cy: 1, r: 1 }));
      s += `<path d="M 25 ${y0 + 46} A 95 90 0 0 1 215 ${y0 + 46} Z" fill="url(#${sh})" stroke="#bff8ff" stroke-width="2" stroke-opacity="0.8"/>`;
      for (let i = 1; i < 6; i++) {
        s += `<path d="M ${25 + i * 31.6} ${y0 + 46} Q 120 ${y0 - 70 + i * 4} ${215 - i * 6} ${y0 + 46}" fill="none" stroke="#bff8ff" stroke-opacity="0.15"/>`;
      }
      s += `<path d="M 55 ${y0} Q 80 ${y0 - 50} 120 ${y0 - 55}" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="3"/>`;
      return s;
    }),

  large_shield_dome: () =>
    tile('large_shield_dome', 'green', (defs, { y0, r }) => {
      let s = '';
      for (let i = 0; i < 6; i++) s += block(defs, 20 + i * 34, y0 + 20 - (i % 2) * 10, 26, 26 + (i % 2) * 10, 10, '#5a6474');
      const sh = id('sh');
      defs.push(radial(sh, [[0, '#7aa8ff', 0.05], [0.8, '#5a8aff', 0.3], [1, '#c8d8ff', 0.85]], { cy: 1, r: 1 }));
      s += `<path d="M 4 ${y0 + 46} A 116 150 0 0 1 236 ${y0 + 46} Z" fill="url(#${sh})" stroke="#d8e4ff" stroke-width="2.5"/>`;
      // heksagonalna struktura pola
      for (let i = 0; i < 40; i++) {
        const x = 20 + r() * 200;
        const y = y0 - 100 + r() * 140;
        s += `<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="#d8e4ff" stroke-opacity="${0.08 + r() * 0.15}"/>`;
      }
      s += `<path d="M 30 ${y0 - 10} Q 60 ${y0 - 120} 130 ${y0 - 145}" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="4"/>`;
      return s;
    }),

  anti_ballistic_missile: () =>
    tile('anti_ballistic_missile', 'ice', (defs, { y0 }) => {
      let s = shadowEllipse(defs, 120, y0 + 50, 80, 12);
      s += block(defs, 70, y0 + 22, 100, 24, 14, '#5a6474');
      const g = id('ab');
      defs.push(linear(g, [[0, '#f4f6fa'], [0.5, '#b0b8c4'], [1, '#6a727e']], { x2: 1, y2: 0 }));
      for (const x of [95, 145]) {
        s += `<rect x="${x - 7}" y="${y0 - 50}" width="14" height="72" fill="url(#${g})"/>`;
        s += `<path d="M ${x - 7} ${y0 - 50} L ${x} ${y0 - 70} L ${x + 7} ${y0 - 50} Z" fill="#3a7ac0"/>`;
      }
      // przechwycenie
      const glow = id('ag');
      defs.push(glowFilter(glow, 5));
      s += `<path d="M 120 ${y0 - 80} Q 160 ${y0 - 140} 200 ${y0 - 150}" stroke="#bfe0ff" stroke-width="2" stroke-dasharray="3 4" fill="none"/>`;
      s += `<circle cx="200" cy="${y0 - 150}" r="16" fill="#ffd27a" filter="url(#${glow})" opacity="0.9"/>`;
      s += `<circle cx="200" cy="${y0 - 150}" r="7" fill="#ffffff"/>`;
      return s;
    }),

  interplanetary_missile: () =>
    tile('interplanetary_missile', 'desert', (defs, { y0 }) => {
      let s = '';
      const g = id('ip');
      defs.push(linear(g, [[0, '#f4f6fa'], [0.5, '#a8b0bc'], [1, '#4a525e']]));
      const flame = id('fl');
      defs.push(linear(flame, [[0, '#ffffff'], [0.3, '#ffd27a'], [1, '#ff5020', 0]], { x2: 1, y2: 0 }));
      s += `<g transform="rotate(-35 120 120)">`;
      s += `<path d="M 20 112 L 60 116 L 60 124 L 20 128 Z" fill="url(#${flame})" transform="rotate(180 40 120)"/>`;
      s += `<rect x="60" y="108" width="120" height="24" rx="4" fill="url(#${g})"/>`;
      s += `<path d="M 180 108 Q 214 120 180 132 Z" fill="#c0302a"/>`;
      s += `<path d="M 66 108 L 54 92 L 82 108 Z M 66 132 L 54 148 L 82 132 Z" fill="#7a8494"/>`;
      s += `<rect x="120" y="108" width="6" height="24" fill="#c0302a"/>`;
      s += `<path d="M 60 120 L 0 120" stroke="#ffd27a" stroke-width="10" stroke-linecap="round" opacity="0.7"/>`;
      s += `</g>`;
      return s;
    }),
};
