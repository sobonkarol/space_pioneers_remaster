import {
  PALETTES, block, cylinder, dome, frame, glowFilter, groundScene, hash, id, lamp, linear, radial, resetIds, rng,
  shade, shadowEllipse, svg,
} from './lib.mjs';

const S = 240;

function tile(key, palette, draw) {
  resetIds();
  const defs = [];
  const scene = groundScene(defs, S, hash(key), PALETTES[palette]);
  const ctx = { y0: scene.horizonY, r: rng(hash(key) + 7) };
  const body = draw(defs, ctx);
  return svg(S, S, defs, scene.svg + body + frame(defs, S));
}

function pipe(x1, y1, x2, y2, color, w = 4) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${shade(color, -0.3)}" stroke-width="${w + 1.5}" stroke-linecap="round"/>
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${shade(color, 0.25)}" stroke-width="${w * 0.5}" stroke-linecap="round" opacity="0.8"/>`;
}

function windows(x, y, cols, rows, dx, dy, color = '#ffd27a', r) {
  let s = '';
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (r && r() < 0.25) continue;
      s += `<rect x="${x + i * dx}" y="${y + j * dy}" width="${dx * 0.55}" height="${dy * 0.45}" fill="${color}" opacity="0.85"/>`;
    }
  }
  return s;
}

export const buildings = {
  metal_mine: () =>
    tile('metal_mine', 'rocky', (defs, { y0, r }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 95, 14);
      // halda rudy
      const ore = id('ore');
      defs.push(radial(ore, [[0, '#9aa2ad'], [1, '#3a3e45']], { cx: 0.4, cy: 0.3 }));
      s += `<path d="M 130 ${y0 + 50} Q 175 ${y0 - 5} 215 ${y0 + 50} Z" fill="url(#${ore})"/>`;
      for (let i = 0; i < 14; i++) {
        s += `<circle cx="${140 + r() * 65}" cy="${y0 + 25 + r() * 25}" r="${1.5 + r() * 3}" fill="${shade('#8c939c', r() * 0.4 - 0.2)}"/>`;
      }
      // wieza wyciagowa (kratownica)
      const steel = '#7d8796';
      s += `<polygon points="60,${y0 + 45} 80,${y0 - 95} 100,${y0 - 95} 120,${y0 + 45}" fill="none" stroke="${steel}" stroke-width="5"/>`;
      for (let k = 0; k < 6; k++) {
        const yy = y0 + 45 - k * 23;
        const half = 30 - k * 3.3;
        s += `<line x1="${90 - half}" y1="${yy}" x2="${90 + half}" y2="${yy - 23}" stroke="${shade(steel, -0.2)}" stroke-width="2.5"/>`;
        s += `<line x1="${90 + half}" y1="${yy}" x2="${90 - half}" y2="${yy - 23}" stroke="${shade(steel, -0.2)}" stroke-width="2.5"/>`;
      }
      // kolo wyciagowe
      s += `<circle cx="90" cy="${y0 - 100}" r="16" fill="none" stroke="#c9d1db" stroke-width="4"/>`;
      s += `<circle cx="90" cy="${y0 - 100}" r="3" fill="#c9d1db"/>`;
      for (let a = 0; a < 6; a++) {
        const ang = (a * Math.PI) / 3;
        s += `<line x1="90" y1="${y0 - 100}" x2="${90 + Math.cos(ang) * 15}" y2="${y0 - 100 + Math.sin(ang) * 15}" stroke="#c9d1db" stroke-width="1.5"/>`;
      }
      // budynek maszynowni
      s += block(defs, 22, y0 + 5, 70, 42, 14, '#6b5a4a');
      s += windows(30, y0 + 14, 5, 2, 12, 14, '#ffcf73', r);
      // tasmociag
      s += `<line x1="118" y1="${y0 + 30}" x2="170" y2="${y0 - 2}" stroke="#2c2f35" stroke-width="7" stroke-linecap="round"/>`;
      s += `<line x1="118" y1="${y0 + 30}" x2="170" y2="${y0 - 2}" stroke="#d29a3a" stroke-width="2" stroke-dasharray="4 5"/>`;
      s += lamp(defs, 90, y0 - 118, 2.5, '#ff5040');
      return s;
    }),

  crystal_mine: () =>
    tile('crystal_mine', 'violet', (defs, { y0, r }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 100, 14);
      const glow = id('gl');
      defs.push(glowFilter(glow, 4));
      const crystal = (x, base, h, w, tilt, hue) => {
        const g = id('cr');
        defs.push(linear(g, [[0, shade(hue, 0.7), 0.95], [0.5, hue, 0.85], [1, shade(hue, -0.5), 0.9]], { x2: 1, y2: 0.3 }));
        const tip = x + tilt;
        return `<polygon points="${x - w},${base} ${x - w * 0.8},${base - h * 0.7} ${tip},${base - h} ${x + w * 0.8},${base - h * 0.7} ${x + w},${base}" fill="url(#${g})" stroke="${shade(hue, 0.8)}" stroke-width="1" filter="url(#${glow})"/>
        <line x1="${tip}" y1="${base - h}" x2="${x}" y2="${base}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.2"/>`;
      };
      s += crystal(150, y0 + 48, 120, 18, 6, '#59b8ff');
      s += crystal(180, y0 + 50, 80, 14, 10, '#7ad0ff');
      s += crystal(125, y0 + 50, 70, 12, -8, '#9a7aff');
      s += crystal(205, y0 + 52, 50, 10, 5, '#59b8ff');
      // ramie wydobywcze
      s += block(defs, 18, y0 + 10, 62, 38, 12, '#4e5a6e');
      s += windows(26, y0 + 18, 4, 2, 13, 13, '#9fe0ff', r);
      s += `<path d="M 60 ${y0 + 8} L 80 ${y0 - 60} L 128 ${y0 - 48}" fill="none" stroke="#a7b3c4" stroke-width="7" stroke-linejoin="round"/>`;
      s += `<path d="M 60 ${y0 + 8} L 80 ${y0 - 60} L 128 ${y0 - 48}" fill="none" stroke="#3b4454" stroke-width="2"/>`;
      s += `<circle cx="80" cy="${y0 - 60}" r="6" fill="#d4dde8"/>`;
      s += `<polygon points="124,${y0 - 54} 140,${y0 - 40} 128,${y0 - 36}" fill="#e2b14c"/>`;
      s += lamp(defs, 135, y0 - 40, 2.5, '#7ad0ff');
      for (let i = 0; i < 10; i++) {
        s += `<circle cx="${110 + r() * 100}" cy="${y0 - 70 + r() * 90}" r="${0.8 + r()}" fill="#bfe8ff" opacity="${0.4 + r() * 0.6}"/>`;
      }
      return s;
    }),

  tritium_synthesizer: () =>
    tile('tritium_synthesizer', 'ice', (defs, { y0 }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 100, 14);
      const liquid = id('lq');
      defs.push(linear(liquid, [[0, '#8dffc4', 0.95], [1, '#13995a', 0.95]]));
      const glow = id('gw');
      defs.push(glowFilter(glow, 3));
      const tank = (cx, top, h, rx) => {
        let t = cylinder(defs, cx, top, rx, h, '#8a97a8');
        t += `<rect x="${cx - rx * 0.35}" y="${top + h * 0.15}" width="${rx * 0.7}" height="${h * 0.75}" rx="${rx * 0.2}" fill="url(#${liquid})" filter="url(#${glow})"/>`;
        t += `<rect x="${cx - rx * 0.35}" y="${top + h * 0.15}" width="${rx * 0.7}" height="${h * 0.75}" rx="${rx * 0.2}" fill="none" stroke="#dfffee" stroke-opacity="0.6"/>`;
        return t;
      };
      s += tank(62, y0 - 70, 112, 28);
      s += tank(122, y0 - 40, 85, 24);
      s += tank(178, y0 - 58, 100, 26);
      s += pipe(90, y0 - 30, 98, y0 - 20, '#9aa6b5', 5);
      s += pipe(146, y0 - 10, 152, y0 - 20, '#9aa6b5', 5);
      s += pipe(62, y0 - 70, 62, y0 - 95, '#9aa6b5', 4);
      s += pipe(62, y0 - 95, 178, y0 - 95, '#9aa6b5', 4);
      s += pipe(178, y0 - 95, 178, y0 - 58, '#9aa6b5', 4);
      s += lamp(defs, 120, y0 - 95, 2.5, '#5dff9d');
      // para
      const steam = id('st');
      defs.push(radial(steam, [[0, '#ffffff', 0.35], [1, '#ffffff', 0]]));
      s += `<circle cx="70" cy="${y0 - 110}" r="22" fill="url(#${steam})"/><circle cx="84" cy="${y0 - 130}" r="16" fill="url(#${steam})"/>`;
      return s;
    }),

  solar_plant: () =>
    tile('solar_plant', 'desert', (defs, { y0 }) => {
      let s = '';
      const sun = id('sun');
      defs.push(radial(sun, [[0, '#ffffff'], [0.2, '#fff1b0'], [0.5, '#ffb040', 0.6], [1, '#ff7020', 0]]));
      s += `<circle cx="190" cy="${y0 - 105}" r="55" fill="url(#${sun})"/>`;
      s += shadowEllipse(defs, 120, y0 + 50, 105, 12);
      const panel = id('pn');
      defs.push(linear(panel, [[0, '#4fa8ff'], [0.5, '#1d4f9a'], [1, '#0d2550']], { x2: 1, y2: 1 }));
      const row = (y, scale, xs) => {
        let t = '';
        for (const x of xs) {
          const w = 46 * scale;
          const h = 24 * scale;
          t += `<line x1="${x + w / 2}" y1="${y + h * 0.6}" x2="${x + w / 2}" y2="${y + h * 1.4}" stroke="#7d8796" stroke-width="${2.5 * scale}"/>`;
          t += `<polygon points="${x},${y + h} ${x + w * 0.2},${y} ${x + w * 1.2},${y} ${x + w},${y + h}" fill="url(#${panel})" stroke="#bcd6ff" stroke-width="${0.8 * scale}"/>`;
          for (let i = 1; i < 4; i++) {
            const f = i / 4;
            t += `<line x1="${x + w * f}" y1="${y + h}" x2="${x + w * 0.2 + w * f}" y2="${y}" stroke="#9cc6ff" stroke-opacity="0.5" stroke-width="${0.6 * scale}"/>`;
          }
          t += `<line x1="${x + w * 0.1}" y1="${y + h / 2}" x2="${x + w * 1.1}" y2="${y + h / 2}" stroke="#9cc6ff" stroke-opacity="0.5" stroke-width="${0.6 * scale}"/>`;
          t += `<polygon points="${x + w * 0.2},${y} ${x + w * 0.5},${y} ${x + w * 0.35},${y + h * 0.5}" fill="#ffffff" opacity="0.25"/>`;
        }
        return t;
      };
      s += row(y0 - 4, 0.75, [20, 65, 110, 155]);
      s += row(y0 + 18, 1, [8, 66, 124, 182]);
      return s;
    }),

  fusion_plant: () =>
    tile('fusion_plant', 'rocky', (defs, { y0 }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 100, 14);
      s += block(defs, 30, y0 - 10, 150, 58, 22, '#4a5363');
      // torus reaktora
      const plasma = id('pl');
      defs.push(radial(plasma, [[0, '#ffffff'], [0.3, '#ffd27a'], [0.65, '#ff6a20', 0.9], [1, '#ff3000', 0]]));
      const glow = id('fg');
      defs.push(glowFilter(glow, 6));
      s += `<ellipse cx="110" cy="${y0 - 50}" rx="70" ry="26" fill="none" stroke="#6f7a8b" stroke-width="18"/>`;
      s += `<ellipse cx="110" cy="${y0 - 50}" rx="70" ry="26" fill="none" stroke="#b6c1d0" stroke-width="3" stroke-dasharray="6 9"/>`;
      s += `<ellipse cx="110" cy="${y0 - 50}" rx="60" ry="20" fill="none" stroke="#ff9a3a" stroke-width="5" filter="url(#${glow})"/>`;
      s += `<circle cx="110" cy="${y0 - 50}" r="16" fill="url(#${plasma})" filter="url(#${glow})"/>`;
      for (const x of [55, 110, 165]) {
        s += `<rect x="${x - 5}" y="${y0 - 30}" width="10" height="22" fill="#5c6677"/>`;
      }
      s += `<rect x="40" y="${y0 + 5}" width="130" height="6" fill="#ff8a30" opacity="0.6"/>`;
      s += cylinder(defs, 200, y0 - 25, 14, 70, '#7a8494');
      s += lamp(defs, 200, y0 - 30, 2, '#ff8a30');
      return s;
    }),

  robotics_factory: () =>
    tile('robotics_factory', 'rocky', (defs, { y0, r }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 105, 14);
      s += block(defs, 20, y0 - 30, 150, 78, 26, '#7b6a52');
      // dach piloksztaltny
      let saw = `M 20 ${y0 - 30}`;
      for (let i = 0; i < 5; i++) {
        saw += ` L ${20 + i * 30} ${y0 - 52} L ${20 + i * 30 + 30} ${y0 - 30}`;
      }
      s += `<path d="${saw} Z" fill="#9b8a6e" stroke="#4b3f30" stroke-width="1"/>`;
      for (let i = 0; i < 5; i++) {
        s += `<polygon points="${22 + i * 30},${y0 - 31} ${22 + i * 30},${y0 - 49} ${30 + i * 30},${y0 - 40}" fill="#8fd2ff" opacity="0.7"/>`;
      }
      s += `<rect x="70" y="${y0 + 5}" width="44" height="43" fill="#2d2a26"/>`;
      s += `<rect x="70" y="${y0 + 5}" width="44" height="43" fill="none" stroke="#e0a030" stroke-width="2" stroke-dasharray="6 4"/>`;
      s += windows(28, y0 - 18, 3, 2, 13, 16, '#ffd27a', r);
      s += windows(124, y0 - 18, 3, 2, 13, 16, '#ffd27a', r);
      // ramie robota
      s += `<rect x="186" y="${y0 + 28}" width="30" height="16" fill="#e0a030"/>`;
      s += `<path d="M 200 ${y0 + 30} L 190 ${y0 - 25} L 222 ${y0 - 55}" fill="none" stroke="#f0b040" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
      s += `<path d="M 200 ${y0 + 30} L 190 ${y0 - 25} L 222 ${y0 - 55}" fill="none" stroke="#5a4010" stroke-width="2"/>`;
      s += `<circle cx="190" cy="${y0 - 25}" r="6" fill="#3a3a3a"/>`;
      s += `<path d="M 218 ${y0 - 62} L 230 ${y0 - 58} M 218 ${y0 - 50} L 230 ${y0 - 54}" stroke="#d0d6de" stroke-width="3"/>`;
      s += lamp(defs, 222, y0 - 55, 2, '#40c0ff');
      return s;
    }),

  nanite_factory: () =>
    tile('nanite_factory', 'violet', (defs, { y0, r }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 100, 14);
      const hex = (cx, cy, rad, fill, stroke) => {
        const pts = Array.from({ length: 6 }, (_, k) => {
          const a = (Math.PI / 3) * k + Math.PI / 6;
          return `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a) * 0.55).toFixed(1)}`;
        }).join(' ');
        return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
      };
      // korpus heksagonalny
      for (let i = 0; i < 5; i++) {
        const yy = y0 + 40 - i * 16;
        const rad = 80 - i * 9;
        s += hex(120, yy, rad, shade('#3c3a5e', i * 0.08), '#8f86ff');
      }
      s += hex(120, y0 - 24, 34, '#1a1830', '#c0b8ff');
      const glow = id('ng');
      defs.push(glowFilter(glow, 3));
      const core = id('nc');
      defs.push(radial(core, [[0, '#ffffff'], [0.4, '#7af0ff'], [1, '#2060ff', 0]]));
      s += `<circle cx="120" cy="${y0 - 30}" r="22" fill="url(#${core})" filter="url(#${glow})"/>`;
      // roj nanitow
      for (let i = 0; i < 90; i++) {
        const a = r() * Math.PI * 2;
        const d = 25 + r() * 75;
        const x = 120 + Math.cos(a) * d;
        const y = y0 - 50 + Math.sin(a) * d * 0.5 - r() * 30;
        s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.6 + r() * 1.4).toFixed(2)}" fill="#8ff6ff" opacity="${(0.3 + r() * 0.7).toFixed(2)}"/>`;
      }
      return s;
    }),

  shipyard: () =>
    tile('shipyard', 'rocky', (defs, { y0 }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 110, 14);
      // platforma
      s += block(defs, 10, y0 + 30, 200, 16, 18, '#4c5462');
      // kadlub statku w budowie
      const hull = id('hl');
      defs.push(linear(hull, [[0, '#d8e0ea'], [0.5, '#8b97a8'], [1, '#3e4654']]));
      s += `<path d="M 40 ${y0 + 4} L 160 ${y0 - 6} L 205 ${y0 + 8} L 160 ${y0 + 24} L 40 ${y0 + 24} Z" fill="url(#${hull})"/>`;
      s += `<path d="M 90 ${y0 - 2} L 90 ${y0 + 24} M 120 ${y0 - 4} L 120 ${y0 + 24}" stroke="#3e4654" stroke-width="1.5"/>`;
      s += `<path d="M 40 ${y0 + 4} L 40 ${y0 - 18} L 70 ${y0 - 18} L 80 ${y0 + 2}" fill="none" stroke="#9aa6b8" stroke-width="2" stroke-dasharray="3 3"/>`;
      // suwnica bramowa
      const crane = '#e3a53a';
      s += `<rect x="22" y="${y0 - 95}" width="10" height="125" fill="${crane}"/><rect x="188" y="${y0 - 95}" width="10" height="125" fill="${crane}"/>`;
      s += `<rect x="16" y="${y0 - 105}" width="188" height="14" fill="${crane}"/>`;
      for (let i = 0; i < 12; i++) {
        s += `<line x1="${20 + i * 15}" y1="${y0 - 104}" x2="${32 + i * 15}" y2="${y0 - 92}" stroke="#7a5418" stroke-width="2"/>`;
      }
      s += `<rect x="112" y="${y0 - 92}" width="22" height="12" fill="#5a3e12"/>`;
      s += `<line x1="123" y1="${y0 - 80}" x2="123" y2="${y0 - 25}" stroke="#ccc" stroke-width="1.5"/>`;
      s += `<rect x="113" y="${y0 - 25}" width="20" height="10" fill="#8a98aa"/>`;
      s += lamp(defs, 27, y0 - 110, 2, '#ff4030');
      s += lamp(defs, 193, y0 - 110, 2, '#ff4030');
      s += lamp(defs, 160, y0 + 4, 2.5, '#60d0ff');
      return s;
    }),

  metal_storage: () =>
    tile('metal_storage', 'rocky', (defs, { y0 }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 105, 14);
      s += cylinder(defs, 60, y0 - 60, 30, 104, '#8d96a3');
      s += cylinder(defs, 125, y0 - 40, 30, 86, '#8d96a3');
      s += cylinder(defs, 188, y0 - 52, 28, 98, '#8d96a3');
      for (const [x, y, h] of [[60, y0 - 60, 104], [125, y0 - 40, 86], [188, y0 - 52, 98]]) {
        for (let k = 1; k < 4; k++) {
          s += `<line x1="${x - 29}" y1="${y + (h / 4) * k}" x2="${x + 29}" y2="${y + (h / 4) * k}" stroke="#5b636f" stroke-width="1.5"/>`;
        }
        s += `<rect x="${x - 8}" y="${y + 12}" width="16" height="10" fill="#c9cfd8"/>`;
        s += `<text x="${x}" y="${y + 20}" font-family="Verdana" font-size="8" font-weight="bold" text-anchor="middle" fill="#30343a">Fe</text>`;
      }
      return s;
    }),

  crystal_storage: () =>
    tile('crystal_storage', 'violet', (defs, { y0 }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 105, 14);
      s += block(defs, 25, y0 + 10, 170, 36, 18, '#4a4f66');
      const glass = (cx, cy, rx) => {
        let t = dome(defs, cx, cy, rx, rx * 0.95, '#6fc4ff', { opacity: 0.55 });
        t += `<path d="M ${cx - rx} ${cy} A ${rx} ${rx * 0.95} 0 0 1 ${cx + rx} ${cy}" fill="none" stroke="#cfeeff" stroke-width="1.5"/>`;
        t += `<path d="M ${cx - rx * 0.6} ${cy - rx * 0.6} Q ${cx - rx * 0.3} ${cy - rx * 0.85} ${cx} ${cy - rx * 0.9}" stroke="#fff" stroke-opacity="0.7" stroke-width="2" fill="none"/>`;
        return t;
      };
      const crystals = (cx, cy) =>
        `<polygon points="${cx - 14},${cy} ${cx - 8},${cy - 30} ${cx - 2},${cy}" fill="#9fdcff"/><polygon points="${cx - 4},${cy} ${cx + 4},${cy - 40} ${cx + 10},${cy}" fill="#7ab8ff"/><polygon points="${cx + 6},${cy} ${cx + 14},${cy - 24} ${cx + 18},${cy}" fill="#b49aff"/>`;
      s += crystals(70, y0 + 10) + glass(70, y0 + 10, 42);
      s += crystals(158, y0 + 10) + glass(158, y0 + 10, 42);
      return s;
    }),

  tritium_tank: () =>
    tile('tritium_tank', 'ice', (defs, { y0 }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 105, 14);
      const sphere = (cx, cy, rad) => {
        const g = id('sp');
        defs.push(radial(g, [[0, '#ffffff'], [0.25, '#d4dde8'], [0.7, '#7d8a9b'], [1, '#3a4250']], { cx: 0.35, cy: 0.3, r: 0.75 }));
        let t = `<line x1="${cx - rad * 0.6}" y1="${cy + rad * 0.5}" x2="${cx - rad * 0.7}" y2="${y0 + 46}" stroke="#5a6372" stroke-width="5"/>`;
        t += `<line x1="${cx + rad * 0.6}" y1="${cy + rad * 0.5}" x2="${cx + rad * 0.7}" y2="${y0 + 46}" stroke="#5a6372" stroke-width="5"/>`;
        t += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="url(#${g})"/>`;
        t += `<ellipse cx="${cx}" cy="${cy}" rx="${rad}" ry="${rad * 0.18}" fill="none" stroke="#5a6372" stroke-width="1.5"/>`;
        t += `<rect x="${cx - 12}" y="${cy - 6}" width="24" height="12" rx="2" fill="#20c070"/>`;
        t += `<text x="${cx}" y="${cy + 4}" font-family="Verdana" font-size="9" font-weight="bold" text-anchor="middle" fill="#04200f">T</text>`;
        return t;
      };
      s += sphere(70, y0 - 15, 45);
      s += sphere(170, y0 - 5, 38);
      s += pipe(110, y0 + 20, 135, y0 + 20, '#8a97a8', 5);
      return s;
    }),

  research_lab: () =>
    tile('research_lab', 'ice', (defs, { y0, r }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 105, 14);
      s += block(defs, 35, y0 - 5, 150, 52, 20, '#d8dee6', { light: 0.1 });
      s += windows(45, y0 + 5, 9, 2, 15, 18, '#8fe0ff', r);
      // obserwatorium
      s += dome(defs, 110, y0 - 5, 50, 46, '#e6ecf3');
      s += `<path d="M 104 ${y0 - 51} L 116 ${y0 - 51} L 118 ${y0 - 5} L 102 ${y0 - 5} Z" fill="#20283a"/>`;
      s += `<rect x="96" y="${y0 - 62}" width="30" height="10" fill="#5c6a80" transform="rotate(-35 110 ${y0 - 40})"/>`;
      // antena
      s += `<line x1="190" y1="${y0 - 12}" x2="200" y2="${y0 - 80}" stroke="#aab4c2" stroke-width="3"/>`;
      s += `<path d="M 180 ${y0 - 82} Q 205 ${y0 - 60} 225 ${y0 - 92}" fill="none" stroke="#e6ecf3" stroke-width="5"/>`;
      s += lamp(defs, 200, y0 - 82, 2, '#ff4040');
      // wiazka danych
      s += `<path d="M 200 ${y0 - 84} L 230 ${y0 - 140}" stroke="#8fe0ff" stroke-width="1.5" stroke-dasharray="3 4" opacity="0.8"/>`;
      return s;
    }),

  terraformer: () =>
    tile('terraformer', 'green', (defs, { y0, r }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 100, 14);
      const beam = id('bm');
      defs.push(linear(beam, [[0, '#9effc8', 0], [0.4, '#7affb0', 0.5], [1, '#ffffff', 0.9]]));
      s += `<polygon points="108,0 132,0 128,${y0 - 90} 112,${y0 - 90}" fill="url(#${beam})"/>`;
      // chmury
      const cloud = id('cl');
      defs.push(radial(cloud, [[0, '#d8fff0', 0.6], [1, '#d8fff0', 0]]));
      for (let i = 0; i < 6; i++) {
        s += `<ellipse cx="${60 + r() * 120}" cy="${10 + r() * 40}" rx="${25 + r() * 30}" ry="${8 + r() * 8}" fill="url(#${cloud})"/>`;
      }
      // wieza
      s += `<polygon points="80,${y0 + 46} 105,${y0 - 90} 135,${y0 - 90} 160,${y0 + 46}" fill="#5d6b5a"/>`;
      s += `<polygon points="105,${y0 - 90} 135,${y0 - 90} 160,${y0 + 46} 140,${y0 + 46}" fill="#3e4a3c"/>`;
      for (let k = 0; k < 5; k++) {
        const yy = y0 + 30 - k * 26;
        s += `<rect x="${100 + k * 2}" y="${yy}" width="${40 - k * 4}" height="4" fill="#9effc8" opacity="0.8"/>`;
      }
      s += `<ellipse cx="120" cy="${y0 - 92}" rx="24" ry="7" fill="#b9ffda"/>`;
      // zielen wokol
      for (let i = 0; i < 26; i++) {
        const x = 15 + r() * 210;
        const y = y0 + 30 + r() * 40;
        s += `<circle cx="${x}" cy="${y}" r="${3 + r() * 6}" fill="${shade('#3f9a52', r() * 0.3 - 0.15)}" opacity="0.9"/>`;
      }
      return s;
    }),

  trade_center: () =>
    tile('trade_center', 'desert', (defs, { y0, r }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 105, 14);
      const gold = '#d9a441';
      s += block(defs, 70, y0 - 110, 60, 156, 20, '#4b5262');
      s += windows(78, y0 - 100, 4, 9, 13, 16, '#ffe19a', r);
      s += `<polygon points="70,${y0 - 110} 100,${y0 - 140} 130,${y0 - 110}" fill="${gold}"/>`;
      // ladowiska
      for (const [x, y] of [[30, y0 - 30], [170, y0 - 60]]) {
        s += `<ellipse cx="${x}" cy="${y}" rx="30" ry="9" fill="#3a3f4a" stroke="${gold}" stroke-width="2"/>`;
        s += `<text x="${x}" y="${y + 4}" font-family="Verdana" font-size="10" font-weight="bold" text-anchor="middle" fill="${gold}">H</text>`;
        s += `<rect x="${x - 3}" y="${y + 6}" width="6" height="${y0 + 46 - y - 6}" fill="#6a7180"/>`;
      }
      // statek handlowy
      s += `<path d="M 165 ${y0 - 78} L 195 ${y0 - 82} L 205 ${y0 - 74} L 170 ${y0 - 70} Z" fill="#c8cfda"/>`;
      s += `<circle cx="100" cy="${y0 - 60}" r="10" fill="none" stroke="${gold}" stroke-width="2"/>`;
      s += `<text x="100" y="${y0 - 56}" font-family="Verdana" font-size="11" font-weight="bold" text-anchor="middle" fill="${gold}">¤</text>`;
      return s;
    }),

  war_academy: () =>
    tile('war_academy', 'desert', (defs, { y0 }) => {
      let s = shadowEllipse(defs, 120, y0 + 52, 105, 14);
      const wall = '#5a4a46';
      s += block(defs, 20, y0 - 10, 180, 56, 18, wall);
      for (let i = 0; i < 9; i++) {
        s += `<rect x="${22 + i * 20}" y="${y0 - 20}" width="12" height="10" fill="${shade(wall, 0.15)}"/>`;
      }
      s += block(defs, 85, y0 - 80, 50, 70, 16, '#6a5852');
      s += `<rect x="102" y="${y0 + 14}" width="26" height="32" fill="#1c1210"/>`;
      // sztandary
      for (const x of [40, 175]) {
        s += `<line x1="${x}" y1="${y0 - 10}" x2="${x}" y2="${y0 - 75}" stroke="#bbb" stroke-width="2"/>`;
        s += `<path d="M ${x} ${y0 - 74} L ${x + 22} ${y0 - 68} L ${x} ${y0 - 58} Z" fill="#c0302a"/>`;
      }
      // emblemat
      s += `<circle cx="110" cy="${y0 - 52}" r="14" fill="#c0302a" stroke="#f0d070" stroke-width="2"/>`;
      s += `<path d="M 104 ${y0 - 44} L 116 ${y0 - 60} M 104 ${y0 - 60} L 116 ${y0 - 44}" stroke="#f0d070" stroke-width="3"/>`;
      s += lamp(defs, 110, y0 - 88, 2, '#ff4030');
      return s;
    }),
};
