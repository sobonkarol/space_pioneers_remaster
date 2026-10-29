import { glowFilter, hash, id, linear, radial, resetIds, rng, shade, stars, svg } from './lib.mjs';

const S = 240;
const C = 120;

/** Emblemat badania: tlo technologiczne, okragla rama i ikona. */
function emblem(key, color, draw) {
  resetIds();
  const defs = [];
  const r = rng(hash(key));
  const bg = id('bg');
  defs.push(radial(bg, [[0, shade(color, -0.55)], [0.7, '#060b16'], [1, '#02040a']], { r: 0.75 }));
  const ring = id('rg');
  defs.push(linear(ring, [[0, '#e8eef6'], [0.5, '#7a8aa0'], [1, '#2a3444']], { x2: 1, y2: 1 }));
  const inner = id('in');
  defs.push(radial(inner, [[0, shade(color, -0.2)], [1, '#050a14']], { cy: 0.35, r: 0.7 }));
  const glow = id('gw');
  defs.push(glowFilter(glow, 4));
  let s = `<rect width="${S}" height="${S}" fill="url(#${bg})"/>`;
  // siatka obwodow
  for (let i = 0; i < 14; i++) {
    const y = 10 + r() * 220;
    const x = r() * 240;
    s += `<path d="M ${x} ${y} h ${20 + r() * 40} v ${r() < 0.5 ? -15 : 15} h ${10 + r() * 30}" fill="none" stroke="${color}" stroke-opacity="0.18" stroke-width="1.2"/>`;
    s += `<circle cx="${x}" cy="${y}" r="2" fill="${color}" opacity="0.3"/>`;
  }
  s += stars(r, S, S, 25, { maxR: 0.7 });
  s += `<circle cx="${C}" cy="${C}" r="92" fill="url(#${inner})" stroke="url(#${ring})" stroke-width="8"/>`;
  s += `<circle cx="${C}" cy="${C}" r="82" fill="none" stroke="${color}" stroke-opacity="0.6" stroke-width="1.5" stroke-dasharray="4 6"/>`;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    s += `<rect x="${C - 3}" y="${C - 99}" width="6" height="8" fill="#c8d4e2" transform="rotate(${(a * 180) / Math.PI} ${C} ${C})"/>`;
  }
  s += `<g filter="url(#${glow})">${draw(defs, color)}</g>`;
  s += `<rect x="1" y="1" width="${S - 2}" height="${S - 2}" fill="none" stroke="#7ea4cc" stroke-opacity="0.35" stroke-width="2"/>`;
  return svg(S, S, defs, s);
}

function fillGrad(defs, color) {
  const g = id('fg');
  defs.push(linear(g, [[0, '#ffffff'], [0.4, shade(color, 0.3)], [1, shade(color, -0.3)]]));
  return `url(#${g})`;
}

export const research = {
  energy_tech: () =>
    emblem('energy_tech', '#ffcf40', (defs, c) =>
      `<polygon points="132,48 82,128 116,128 102,192 158,104 122,104 140,48" fill="${fillGrad(defs, c)}" stroke="#fff6c8" stroke-width="2"/>`),

  laser_tech: () =>
    emblem('laser_tech', '#ff4a3a', (defs, c) =>
      `<rect x="48" y="104" width="54" height="32" rx="5" fill="${fillGrad(defs, '#9aa6b8')}"/>
       <ellipse cx="112" cy="120" rx="10" ry="26" fill="#bfe8ff" opacity="0.8"/>
       <line x1="120" y1="120" x2="196" y2="120" stroke="${c}" stroke-width="10" stroke-linecap="round"/>
       <line x1="120" y1="120" x2="196" y2="120" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),

  ion_tech: () =>
    emblem('ion_tech', '#59c8ff', (defs, c) =>
      `<circle cx="120" cy="120" r="16" fill="${fillGrad(defs, c)}"/>
       <ellipse cx="120" cy="120" rx="64" ry="22" fill="none" stroke="${c}" stroke-width="4"/>
       <ellipse cx="120" cy="120" rx="64" ry="22" fill="none" stroke="${c}" stroke-width="4" transform="rotate(60 120 120)"/>
       <ellipse cx="120" cy="120" rx="64" ry="22" fill="none" stroke="${c}" stroke-width="4" transform="rotate(-60 120 120)"/>
       <circle cx="184" cy="120" r="7" fill="#fff"/><circle cx="88" cy="65" r="7" fill="#fff"/><circle cx="88" cy="175" r="7" fill="#fff"/>`),

  hyperspace_tech: () =>
    emblem('hyperspace_tech', '#b060ff', (defs, c) => {
      let s = '';
      for (let i = 0; i < 6; i++) {
        s += `<ellipse cx="120" cy="${120 + i * 4}" rx="${70 - i * 11}" ry="${26 - i * 3.5}" fill="none" stroke="${shade(c, i * 0.12)}" stroke-width="${3 - i * 0.3}"/>`;
      }
      for (let i = -3; i <= 3; i++) {
        s += `<path d="M ${120 + i * 22} 98 Q ${120 + i * 9} 125 120 150" fill="none" stroke="${c}" stroke-opacity="0.6" stroke-width="1.5"/>`;
      }
      return s + `<circle cx="120" cy="150" r="7" fill="#fff"/>`;
    }),

  plasma_tech: () =>
    emblem('plasma_tech', '#e060ff', (defs, c) => {
      const g = id('pl');
      defs.push(radial(g, [[0, '#ffffff'], [0.35, '#ffc8ff'], [0.7, c], [1, shade(c, -0.6), 0]]));
      let s = `<circle cx="120" cy="120" r="50" fill="url(#${g})"/>`;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        s += `<path d="M ${120 + Math.cos(a) * 20} ${120 + Math.sin(a) * 20} Q ${120 + Math.cos(a + 0.6) * 50} ${120 + Math.sin(a + 0.6) * 50} ${120 + Math.cos(a + 0.3) * 72} ${120 + Math.sin(a + 0.3) * 72}" fill="none" stroke="#ffe0ff" stroke-width="2"/>`;
      }
      return s;
    }),

  combustion_drive: () =>
    emblem('combustion_drive', '#ff8a30', (defs, c) => {
      const fl = id('fl');
      defs.push(linear(fl, [[0, '#ffffff'], [0.3, '#ffd27a'], [0.7, c], [1, c, 0]], { x2: 1, y2: 0 }));
      return `<polygon points="70,92 118,104 118,136 70,148" fill="${fillGrad(defs, '#9aa6b8')}" stroke="#2a313c" stroke-width="2"/>
        <rect x="54" y="88" width="20" height="64" rx="4" fill="${fillGrad(defs, '#7a8698')}"/>
        <path d="M 118 106 Q 170 110 200 120 Q 170 130 118 134 Z" fill="url(#${fl})"/>`;
    }),

  impulse_drive: () =>
    emblem('impulse_drive', '#40d0ff', (defs, c) => {
      let s = `<rect x="56" y="98" width="56" height="44" rx="8" fill="${fillGrad(defs, '#9aa6b8')}"/>`;
      for (let i = 0; i < 4; i++) {
        s += `<ellipse cx="${128 + i * 18}" cy="120" rx="${6 + i * 2}" ry="${22 - i * 3}" fill="none" stroke="${c}" stroke-width="${4 - i * 0.6}" opacity="${1 - i * 0.2}"/>`;
      }
      return s;
    }),

  hyperspace_drive: () =>
    emblem('hyperspace_drive', '#a070ff', (defs, c) => {
      let s = '';
      for (let i = 0; i < 9; i++) {
        const y = 80 + i * 10;
        s += `<line x1="${44 + (i % 3) * 8}" y1="${y}" x2="${130 - (i % 2) * 20}" y2="${y}" stroke="${c}" stroke-width="2" stroke-opacity="${0.4 + (i % 3) * 0.2}" stroke-linecap="round"/>`;
      }
      return s + `<path d="M 120 104 L 186 120 L 120 136 L 132 120 Z" fill="${fillGrad(defs, '#d0d8e4')}" stroke="#fff" stroke-width="1.5"/>`;
    }),

  espionage_tech: () =>
    emblem('espionage_tech', '#40ff9a', (defs, c) => {
      const iris = id('ir');
      defs.push(radial(iris, [[0, '#000'], [0.35, '#000'], [0.4, c], [1, shade(c, -0.6)]]));
      return `<path d="M 50 120 Q 120 56 190 120 Q 120 184 50 120 Z" fill="#eaf6ff" stroke="${c}" stroke-width="4"/>
        <circle cx="120" cy="120" r="30" fill="url(#${iris})"/><circle cx="110" cy="110" r="7" fill="#fff"/>`;
    }),

  computer_tech: () =>
    emblem('computer_tech', '#40ffb0', (defs, c) => {
      let s = `<rect x="80" y="80" width="80" height="80" rx="6" fill="${fillGrad(defs, '#3a4a5a')}" stroke="${c}" stroke-width="3"/>`;
      for (let i = 0; i < 5; i++) {
        const o = 88 + i * 16;
        s += `<line x1="${o}" y1="62" x2="${o}" y2="80" stroke="${c}" stroke-width="4"/><line x1="${o}" y1="160" x2="${o}" y2="178" stroke="${c}" stroke-width="4"/>`;
        s += `<line x1="62" y1="${o}" x2="80" y2="${o}" stroke="${c}" stroke-width="4"/><line x1="160" y1="${o}" x2="178" y2="${o}" stroke="${c}" stroke-width="4"/>`;
      }
      return s + `<rect x="100" y="100" width="40" height="40" fill="${c}" opacity="0.8"/>`;
    }),

  astrophysics: () =>
    emblem('astrophysics', '#ffd27a', (defs, c) => {
      let s = '';
      for (let arm = 0; arm < 2; arm++) {
        let d = '';
        for (let t = 0; t < 60; t++) {
          const a = t * 0.12 + arm * Math.PI;
          const rr = 6 + t * 1.15;
          d += `${t === 0 ? 'M' : 'L'} ${(120 + Math.cos(a) * rr).toFixed(1)} ${(120 + Math.sin(a) * rr * 0.6).toFixed(1)} `;
        }
        s += `<path d="${d}" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" opacity="0.85"/>`;
      }
      const core = id('co');
      defs.push(radial(core, [[0, '#ffffff'], [1, c, 0]]));
      return s + `<circle cx="120" cy="120" r="20" fill="url(#${core})"/>`;
    }),

  weapons_tech: () =>
    emblem('weapons_tech', '#ff5040', (defs, c) =>
      `<circle cx="120" cy="120" r="54" fill="none" stroke="${c}" stroke-width="5"/>
       <circle cx="120" cy="120" r="30" fill="none" stroke="${c}" stroke-width="3"/>
       <line x1="120" y1="52" x2="120" y2="96" stroke="#fff" stroke-width="4"/><line x1="120" y1="144" x2="120" y2="188" stroke="#fff" stroke-width="4"/>
       <line x1="52" y1="120" x2="96" y2="120" stroke="#fff" stroke-width="4"/><line x1="144" y1="120" x2="188" y2="120" stroke="#fff" stroke-width="4"/>
       <circle cx="120" cy="120" r="6" fill="${c}"/>`),

  shielding_tech: () =>
    emblem('shielding_tech', '#59c8ff', (defs, c) =>
      `<path d="M 120 52 L 176 72 Q 176 150 120 188 Q 64 150 64 72 Z" fill="${fillGrad(defs, c)}" stroke="#e0f6ff" stroke-width="3" opacity="0.9"/>
       <path d="M 120 72 L 158 86 Q 158 140 120 166" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="3"/>`),

  armour_tech: () =>
    emblem('armour_tech', '#c8d0da', (defs, c) => {
      let s = '';
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const x = 72 + col * 34 + (row % 2) * 6;
          const y = 72 + row * 34;
          s += `<rect x="${x}" y="${y}" width="30" height="30" rx="3" fill="${fillGrad(defs, c)}" stroke="#2a313c" stroke-width="1.5"/>`;
          s += `<circle cx="${x + 5}" cy="${y + 5}" r="2" fill="#3a424e"/><circle cx="${x + 25}" cy="${y + 25}" r="2" fill="#3a424e"/>`;
        }
      }
      return s;
    }),
};
