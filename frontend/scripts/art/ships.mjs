import { frame, glowFilter, hash, id, lamp, linear, radial, resetIds, rng, shade, stars, svg } from './lib.mjs';

const S = 240;

/** Tlo kosmiczne z mglawica. */
function spaceScene(defs, seed, tint) {
  const r = rng(seed);
  const bg = id('bg');
  defs.push(linear(bg, [[0, '#03050b'], [1, '#0a1222']]));
  const neb = id('nb');
  defs.push(radial(neb, [[0, tint, 0.45], [0.6, tint, 0.12], [1, tint, 0]]));
  const neb2 = id('nb');
  defs.push(radial(neb2, [[0, '#6a3fa0', 0.3], [1, '#6a3fa0', 0]]));
  let s = `<rect width="${S}" height="${S}" fill="url(#${bg})"/>`;
  s += `<ellipse cx="${60 + r() * 120}" cy="${50 + r() * 140}" rx="${110 + r() * 40}" ry="${60 + r() * 30}" fill="url(#${neb})" transform="rotate(${-30 + r() * 60} 120 120)"/>`;
  s += `<ellipse cx="${r() * S}" cy="${r() * S}" rx="90" ry="50" fill="url(#${neb2})"/>`;
  s += stars(r, S, S, 90, { maxR: 1 });
  return s;
}

function tile(key, tint, draw) {
  resetIds();
  const defs = [];
  const body = draw(defs, rng(hash(key)));
  return svg(S, S, defs, spaceScene(defs, hash(key), tint) + body + frame(defs, S));
}

function hullGradient(defs, color) {
  const g = id('h');
  defs.push(linear(g, [[0, shade(color, 0.6)], [0.35, shade(color, 0.15)], [0.7, shade(color, -0.3)], [1, shade(color, -0.65)]]));
  return `url(#${g})`;
}

function engine(defs, x, y, len, width, color = '#59c8ff') {
  const g = id('e');
  defs.push(linear(g, [[0, color, 0], [0.6, color, 0.7], [1, '#ffffff', 1]], { x1: 0, y1: 0, x2: 1, y2: 0 }));
  const f = id('ef');
  defs.push(glowFilter(f, 3));
  return `<path d="M ${x} ${y - width / 2} L ${x - len} ${y} L ${x} ${y + width / 2} Z" fill="url(#${g})" filter="url(#${f})"/><ellipse cx="${x}" cy="${y}" rx="2.5" ry="${width / 2}" fill="#e8fbff"/>`;
}

function cockpit(defs, x, y, rx, ry) {
  const g = id('ck');
  defs.push(radial(g, [[0, '#e0fbff'], [0.4, '#59c8ff'], [1, '#0a3a6a']], { cx: 0.35, cy: 0.3 }));
  return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#${g})" stroke="#bfe8ff" stroke-width="0.8"/>`;
}

function panelLines(points, color) {
  return points.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="0.55"/>`).join('');
}

function shipShadow(defs) {
  const g = id('ss');
  defs.push(radial(g, [[0, '#7ab8ff', 0.18], [1, '#7ab8ff', 0]]));
  return `<ellipse cx="125" cy="125" rx="105" ry="55" fill="url(#${g})"/>`;
}

export const ships = {
  small_cargo: () =>
    tile('small_cargo', '#2f6aa8', (defs) => {
      const c = '#8a97a8';
      let s = shipShadow(defs);
      s += engine(defs, 62, 112, 45, 16) + engine(defs, 62, 136, 40, 12);
      s += `<path d="M 62 100 L 150 96 L 196 112 L 200 122 L 186 140 L 62 148 Z" fill="${hullGradient(defs, c)}" stroke="#2a313c"/>`;
      s += `<rect x="80" y="112" width="34" height="24" rx="3" fill="${hullGradient(defs, '#c79a3a')}" stroke="#4a3610"/>`;
      s += `<rect x="118" y="112" width="34" height="24" rx="3" fill="${hullGradient(defs, '#c79a3a')}" stroke="#4a3610"/>`;
      s += cockpit(defs, 178, 112, 12, 6);
      s += panelLines([[70, 104, 70, 146], [160, 98, 160, 142]], '#2a313c');
      s += lamp(defs, 196, 118, 1.5, '#ff4040');
      return s;
    }),

  large_cargo: () =>
    tile('large_cargo', '#2f6aa8', (defs) => {
      const c = '#8a97a8';
      let s = shipShadow(defs);
      s += engine(defs, 30, 108, 30, 18) + engine(defs, 30, 132, 30, 18);
      s += `<path d="M 30 96 L 190 92 L 222 112 L 222 128 L 190 146 L 30 144 Z" fill="${hullGradient(defs, c)}" stroke="#2a313c"/>`;
      for (let i = 0; i < 5; i++) {
        s += `<rect x="${42 + i * 28}" y="100" width="25" height="18" rx="2" fill="${hullGradient(defs, i % 2 ? '#b0472f' : '#c79a3a')}" stroke="#2a1c10"/>`;
        s += `<rect x="${42 + i * 28}" y="121" width="25" height="18" rx="2" fill="${hullGradient(defs, i % 2 ? '#c79a3a' : '#3f7ab0')}" stroke="#2a1c10"/>`;
      }
      s += cockpit(defs, 205, 112, 10, 5);
      s += lamp(defs, 222, 120, 1.5, '#ff4040');
      return s;
    }),

  light_fighter: () =>
    tile('light_fighter', '#a8432f', (defs) => {
      let s = shipShadow(defs);
      s += engine(defs, 70, 122, 50, 12, '#ff9a40');
      s += `<path d="M 70 112 L 150 108 L 205 122 L 150 136 L 70 132 Z" fill="${hullGradient(defs, '#9aa6b5')}" stroke="#2a313c"/>`;
      s += `<path d="M 95 112 L 125 70 L 140 72 L 128 110 Z" fill="${hullGradient(defs, '#7c8898')}" stroke="#2a313c"/>`;
      s += `<path d="M 95 132 L 125 174 L 140 172 L 128 134 Z" fill="${hullGradient(defs, '#5c6878')}" stroke="#2a313c"/>`;
      s += `<rect x="128" y="68" width="34" height="3" fill="#c0c8d4"/><rect x="128" y="173" width="34" height="3" fill="#c0c8d4"/>`;
      s += cockpit(defs, 160, 117, 14, 5);
      s += `<path d="M 100 116 L 140 116" stroke="#c0302a" stroke-width="3"/>`;
      return s;
    }),

  heavy_fighter: () =>
    tile('heavy_fighter', '#a8432f', (defs) => {
      let s = shipShadow(defs);
      s += engine(defs, 58, 110, 45, 14, '#ff9a40') + engine(defs, 58, 134, 45, 14, '#ff9a40');
      s += `<path d="M 58 100 L 160 98 L 210 120 L 160 144 L 58 144 Z" fill="${hullGradient(defs, '#8592a3')}" stroke="#2a313c"/>`;
      s += `<path d="M 85 100 L 120 55 L 150 58 L 140 100 Z" fill="${hullGradient(defs, '#6e7a8a')}" stroke="#2a313c"/>`;
      s += `<path d="M 85 144 L 120 189 L 150 186 L 140 144 Z" fill="${hullGradient(defs, '#4e5a6a')}" stroke="#2a313c"/>`;
      for (const y of [52, 62, 182, 192]) s += `<rect x="135" y="${y - 2}" width="45" height="4" fill="#d0d6de"/>`;
      s += cockpit(defs, 172, 114, 16, 6);
      s += panelLines([[100, 100, 100, 144], [135, 99, 135, 144]], '#2a313c');
      s += `<path d="M 70 122 L 150 122" stroke="#c0302a" stroke-width="4"/>`;
      return s;
    }),

  cruiser: () =>
    tile('cruiser', '#3a2f8a', (defs) => {
      let s = shipShadow(defs);
      s += engine(defs, 36, 116, 34, 16) + engine(defs, 36, 132, 30, 12);
      s += `<path d="M 36 104 L 120 96 L 228 120 L 120 146 L 36 140 Z" fill="${hullGradient(defs, '#9aa6b5')}" stroke="#2a313c"/>`;
      s += `<path d="M 60 104 L 110 84 L 150 86 L 140 104 Z" fill="${hullGradient(defs, '#7c8898')}" stroke="#2a313c"/>`;
      for (const x of [95, 130, 165]) {
        s += `<circle cx="${x}" cy="${x === 165 ? 108 : 102}" r="6" fill="#4a5462"/><rect x="${x}" y="${(x === 165 ? 108 : 102) - 1.5}" width="18" height="3" fill="#d0d6de"/>`;
      }
      s += cockpit(defs, 195, 118, 12, 4);
      s += panelLines([[70, 104, 70, 140], [150, 103, 150, 140], [36, 126, 200, 126]], '#2a313c');
      s += `<path d="M 50 136 L 180 132" stroke="#59c8ff" stroke-width="2" opacity="0.7"/>`;
      return s;
    }),

  battleship: () =>
    tile('battleship', '#3a2f8a', (defs) => {
      let s = shipShadow(defs);
      for (const y of [100, 120, 140]) s += engine(defs, 26, y, 30, 14);
      s += `<path d="M 26 88 L 150 80 L 232 118 L 150 160 L 26 152 Z" fill="${hullGradient(defs, '#7f8b9b')}" stroke="#20262f" stroke-width="1.5"/>`;
      s += `<path d="M 55 88 L 90 64 L 160 66 L 150 84 Z" fill="${hullGradient(defs, '#69758a')}" stroke="#20262f"/>`;
      s += `<rect x="96" y="54" width="30" height="12" fill="${hullGradient(defs, '#8b97a8')}"/>`;
      for (const [x, y] of [[70, 92], [110, 88], [150, 90], [90, 146], [140, 146]]) {
        s += `<circle cx="${x}" cy="${y}" r="7" fill="#3c4552"/><rect x="${x}" y="${y - 2}" width="24" height="4" fill="#d0d6de"/>`;
      }
      s += panelLines([[60, 88, 60, 152], [100, 84, 100, 156], [180, 96, 180, 140], [26, 120, 210, 120]], '#20262f');
      for (let i = 0; i < 8; i++) s += `<rect x="${45 + i * 18}" y="126" width="6" height="3" fill="#ffd27a"/>`;
      s += lamp(defs, 232, 118, 2, '#ff4040');
      return s;
    }),

  bomber: () =>
    tile('bomber', '#7a2f2f', (defs) => {
      let s = shipShadow(defs);
      s += engine(defs, 52, 104, 40, 14, '#ff9a40') + engine(defs, 52, 140, 40, 14, '#ff9a40');
      s += `<path d="M 52 92 L 120 50 L 168 58 L 210 120 L 168 182 L 120 190 L 52 150 Z" fill="${hullGradient(defs, '#6e6a62')}" stroke="#20262f" stroke-width="1.5"/>`;
      s += `<path d="M 80 110 L 190 116 L 190 124 L 80 130 Z" fill="${hullGradient(defs, '#8a8478')}"/>`;
      for (let i = 0; i < 4; i++) {
        s += `<rect x="${92 + i * 20}" y="140" width="14" height="22" rx="7" fill="#3a3530" stroke="#c0302a" stroke-width="1.2"/>`;
      }
      s += cockpit(defs, 178, 120, 12, 5);
      s += panelLines([[120, 50, 120, 190], [150, 56, 150, 184]], '#20262f');
      return s;
    }),

  destroyer: () =>
    tile('destroyer', '#8a1f1f', (defs) => {
      let s = shipShadow(defs);
      for (const y of [96, 120, 144]) s += engine(defs, 18, y, 26, 16, '#ff5a3a');
      s += `<path d="M 18 82 L 120 70 L 236 120 L 120 170 L 18 158 Z" fill="${hullGradient(defs, '#4e4a52')}" stroke="#120e12" stroke-width="1.5"/>`;
      s += `<path d="M 40 82 L 100 52 L 150 58 L 120 76 Z" fill="${hullGradient(defs, '#3c3840')}" stroke="#120e12"/>`;
      s += `<path d="M 40 158 L 100 188 L 150 182 L 120 164 Z" fill="${hullGradient(defs, '#2c282f')}" stroke="#120e12"/>`;
      s += `<path d="M 30 120 L 236 120" stroke="#c0302a" stroke-width="3"/>`;
      s += `<path d="M 60 100 L 200 112 M 60 140 L 200 128" stroke="#c0302a" stroke-width="1.5" opacity="0.8"/>`;
      for (const [x, y] of [[80, 86], [130, 82], [80, 154], [130, 158]]) {
        s += `<circle cx="${x}" cy="${y}" r="6" fill="#26222a"/><rect x="${x}" y="${y - 2}" width="26" height="4" fill="#c8c0c8"/>`;
      }
      s += lamp(defs, 236, 120, 2.5, '#ff3020');
      return s;
    }),

  freighter: () =>
    tile('freighter', '#8a6a1f', (defs) => {
      let s = shipShadow(defs);
      for (const y of [96, 120, 144]) s += engine(defs, 18, y, 24, 16);
      s += `<path d="M 18 84 L 200 80 L 230 104 L 230 136 L 200 160 L 18 156 Z" fill="${hullGradient(defs, '#9a8a6a')}" stroke="#2a2010"/>`;
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 6; i++) {
          const colors = ['#c79a3a', '#3f7ab0', '#b0472f', '#4a9a5a'];
          s += `<rect x="${30 + i * 28}" y="${88 + row * 22}" width="26" height="20" rx="1.5" fill="${hullGradient(defs, colors[(i + row) % 4])}" stroke="#1a140a"/>`;
        }
      }
      s += cockpit(defs, 214, 112, 10, 6);
      s += `<rect x="200" y="132" width="20" height="4" fill="#d9a441"/>`;
      return s;
    }),

  colony_ship: () =>
    tile('colony_ship', '#2f8a5a', (defs) => {
      let s = shipShadow(defs);
      s += engine(defs, 40, 112, 36, 18) + engine(defs, 40, 136, 36, 18);
      s += `<path d="M 40 100 L 200 104 L 220 124 L 200 144 L 40 148 Z" fill="${hullGradient(defs, '#a8b2bf')}" stroke="#2a313c"/>`;
      const bio = id('bio');
      defs.push(radial(bio, [[0, '#d8fff0'], [0.4, '#7ad8a0', 0.8], [1, '#2a7a5a', 0.6]], { cx: 0.4, cy: 0.3 }));
      s += `<path d="M 70 104 A 50 40 0 0 1 170 104 Z" fill="url(#${bio})" stroke="#c8fff0" stroke-width="1.5"/>`;
      for (let i = 0; i < 7; i++) s += `<circle cx="${85 + i * 12}" cy="${98 - (i % 3) * 5}" r="5" fill="#3f9a52"/>`;
      s += `<path d="M 75 100 Q 120 70 165 100" fill="none" stroke="#ffffff" stroke-opacity="0.5"/>`;
      s += cockpit(defs, 205, 122, 9, 5);
      return s;
    }),

  recycler: () =>
    tile('recycler', '#5a5a2f', (defs, r) => {
      let s = shipShadow(defs);
      s += engine(defs, 50, 116, 36, 18, '#ffcf40') + engine(defs, 50, 138, 30, 12, '#ffcf40');
      s += `<path d="M 50 102 L 150 98 L 180 112 L 180 140 L 150 150 L 50 148 Z" fill="${hullGradient(defs, '#b08a3a')}" stroke="#2a2010"/>`;
      for (let i = 0; i < 6; i++) s += `<path d="M ${60 + i * 16} 102 L ${68 + i * 16} 148" stroke="#1a140a" stroke-width="5" opacity="0.6"/>`;
      // ramiona chwytakow
      s += `<path d="M 170 110 L 205 82 L 222 92" fill="none" stroke="#d0d6de" stroke-width="5" stroke-linejoin="round"/>`;
      s += `<path d="M 170 142 L 205 168 L 222 156" fill="none" stroke="#d0d6de" stroke-width="5" stroke-linejoin="round"/>`;
      // szczatki
      for (let i = 0; i < 10; i++) {
        const x = 195 + r() * 40;
        const y = 100 + r() * 50;
        s += `<polygon points="${x},${y} ${x + 4 + r() * 4},${y + 2} ${x + 2},${y + 6}" fill="${shade('#8a8a8a', r() * 0.4 - 0.2)}"/>`;
      }
      return s;
    }),

  espionage_probe: () =>
    tile('espionage_probe', '#2f6aa8', (defs) => {
      let s = '';
      const body = id('pb');
      defs.push(radial(body, [[0, '#ffffff'], [0.4, '#a8b4c4'], [1, '#2a313c']], { cx: 0.35, cy: 0.3 }));
      s += engine(defs, 96, 122, 40, 10);
      s += `<line x1="120" y1="120" x2="70" y2="70" stroke="#c0c8d4" stroke-width="2"/><line x1="120" y1="120" x2="170" y2="66" stroke="#c0c8d4" stroke-width="2"/><line x1="120" y1="120" x2="175" y2="175" stroke="#c0c8d4" stroke-width="2"/>`;
      s += `<circle cx="70" cy="70" r="4" fill="#59c8ff"/><circle cx="170" cy="66" r="4" fill="#59c8ff"/><circle cx="175" cy="175" r="4" fill="#59c8ff"/>`;
      s += `<circle cx="120" cy="120" r="26" fill="url(#${body})"/>`;
      s += `<circle cx="132" cy="116" r="9" fill="#0a1a2a" stroke="#59c8ff" stroke-width="2"/>`;
      s += lamp(defs, 132, 116, 3, '#ff3030');
      return s;
    }),

  solar_satellite: () =>
    tile('solar_satellite', '#a8862f', (defs) => {
      let s = '';
      const planet = id('pl');
      defs.push(radial(planet, [[0, '#7ab8ff'], [0.6, '#1d4f86'], [1, '#04101e']], { cx: 0.3, cy: 0.3 }));
      s += `<circle cx="30" cy="235" r="110" fill="url(#${planet})"/>`;
      const panel = id('sp');
      defs.push(linear(panel, [[0, '#4fa8ff'], [1, '#0d2550']], { x2: 1, y2: 1 }));
      const wing = (x, y) => {
        let t = `<rect x="${x}" y="${y}" width="62" height="34" fill="url(#${panel})" stroke="#bcd6ff"/>`;
        for (let i = 1; i < 4; i++) t += `<line x1="${x + i * 15.5}" y1="${y}" x2="${x + i * 15.5}" y2="${y + 34}" stroke="#9cc6ff" stroke-opacity="0.5"/>`;
        t += `<line x1="${x}" y1="${y + 17}" x2="${x + 62}" y2="${y + 17}" stroke="#9cc6ff" stroke-opacity="0.5"/>`;
        return t;
      };
      s += `<g transform="rotate(-18 130 100)">`;
      s += wing(40, 83) + wing(158, 83);
      s += `<rect x="102" y="97" width="56" height="6" fill="#c0c8d4"/>`;
      s += `<rect x="115" y="84" width="30" height="32" rx="4" fill="${hullGradient(defs, '#d9a441')}"/>`;
      s += `<line x1="130" y1="84" x2="130" y2="60" stroke="#c0c8d4" stroke-width="2"/>`;
      s += `</g>`;
      s += lamp(defs, 137, 60, 2, '#ffd27a');
      return s;
    }),
};
