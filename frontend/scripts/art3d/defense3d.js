// Obrona planetarna i rakiety: dziala na umocnionych stanowiskach na powierzchni planety.
import { THREE, hullMaterial, mat, box, cyl, sphere, loft, greebles, glowSprite, exhaust, mesh } from './lib3d.js';
import { surfaceShot, beam } from './scenes.js';

/** Betonowe stanowisko z obramowaniem i swiatlami. */
function emplacement(g, r, { rad = 1.6, h = 0.35 }) {
  g.add(cyl(rad, rad * 1.12, h, mat.concrete(), { pos: [0, h / 2, 0] }, 8));
  g.add(cyl(rad * 0.82, rad * 0.82, 0.06, new THREE.MeshStandardMaterial({ color: 0x2c3036, metalness: 0.6, roughness: 0.6 }), { pos: [0, h + 0.03, 0] }, 48));
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2 + Math.PI / 8;
    g.add(box(0.3, 0.25, 0.12, mat.concrete(), { pos: [Math.cos(ang) * rad * 1.02, h + 0.1, Math.sin(ang) * rad * 1.02],
      rot: [0, -ang, 0] }));
  }
  for (let a = 0; a < 4; a++) {
    const ang = (a / 4) * Math.PI * 2;
    g.add(sphere(0.04, mat.glow(0xffa030, 6), { pos: [Math.cos(ang) * rad * 0.9, h + 0.05, Math.sin(ang) * rad * 0.9],
      shadow: false }, 8));
  }
}

/** Obrotowa wieza: podstawa, korpus, lufy wycelowane w gore (w strone kamery). */
function turretBody(g, { hm, base = 0.9, bodyW = 1.2, bodyH = 0.8, bodyL = 1.6, y = 0.4, pitch = 0.32, yaw = 0.55 }) {
  const t = new THREE.Group();
  t.add(cyl(base * 0.8, base, 0.35, hm, { pos: [0, 0.17, 0] }, 24));
  const head = new THREE.Group();
  head.add(loft([
    { x: -bodyL * 0.5, w: bodyW, top: bodyH * 0.55, bot: bodyH * 0.45, k: 0.7, kb: 0.8 },
    { x: bodyL * 0.3, w: bodyW * 0.9, top: bodyH * 0.5, bot: bodyH * 0.4, k: 0.65 },
    { x: bodyL * 0.5, w: bodyW * 0.6, top: bodyH * 0.3, bot: bodyH * 0.25, k: 0.6 },
  ], hm));
  head.position.y = 0.35 + bodyH * 0.45;
  head.rotation.z = pitch;
  t.add(head);
  t.position.y = y;
  t.rotation.y = yaw;
  g.add(t);
  return head;
}

function rocketLauncher(g, r) {
  const hm = hullMaterial('rl', { base: [96, 102, 84], accent: '200,160,40', panel: 32 });
  emplacement(g, r, { rad: 1.4 });
  const head = turretBody(g, { hm, bodyW: 1.4, bodyH: 0.9, bodyL: 1.3, pitch: 0.45 });
  // wyrzutnia: 3x3 rury z glowicami
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      head.add(cyl(0.11, 0.11, 0.2, mat.dark(), { pos: [0.66, j * 0.25, i * 0.3], rot: [0, 0, Math.PI / 2] }, 12));
      head.add(sphere(0.08, mat.paint(0xc83020), { pos: [0.7, j * 0.25, i * 0.3], scale: [1.4, 1, 1] }, 12));
    }
  }
}

function laserTurret(heavy) {
  return (g, r) => {
    const hm = hullMaterial(heavy ? 'hl' : 'll', { base: [110, 112, 118], accent: '170,40,36', panel: 30 });
    emplacement(g, r, { rad: heavy ? 1.7 : 1.3 });
    const head = turretBody(g, { hm, bodyW: heavy ? 1.3 : 0.9, bodyH: heavy ? 0.9 : 0.6, bodyL: heavy ? 1.7 : 1.2, pitch: 0.3 });
    const L = heavy ? 1.7 : 1.2;
    const n = heavy ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const z = n === 1 ? 0 : (i ? 0.22 : -0.22);
      head.add(cyl(0.1, 0.13, L * 0.9, mat.gunmetal(), { pos: [L * 0.8, 0, z], rot: [0, 0, Math.PI / 2] }, 16));
      for (let k = 0; k < 4; k++) head.add(cyl(0.16, 0.16, 0.05, mat.copper(), { pos: [L * 0.45 + k * 0.18, 0, z], rot: [0, 0, Math.PI / 2] }, 16));
      head.add(sphere(0.07, mat.glow(0xff3020, 10), { pos: [L * 1.26, 0, z], shadow: false }, 12));
      beam(head, { from: [L * 1.27, 0, z], to: [L * 1.27 + 9, 0, z], color: 0xff2a1a, r: heavy ? 0.045 : 0.03 });
    }
    greebles(r, head, { x0: -L * 0.4, x1: L * 0.2, z0: -0.25, z1: 0.25, y: (heavy ? 0.9 : 0.6) * 0.55, count: 12, size: [0.04, 0.14],
      material: mat.gunmetal() });
  };
}

function ionCannon(g, r) {
  const hm = hullMaterial('ion', { base: [120, 130, 140], accent: '40,110,200', panel: 30 });
  emplacement(g, r, { rad: 1.6 });
  const head = turretBody(g, { hm, bodyW: 1.2, bodyH: 0.9, bodyL: 1.4, pitch: 0.35 });
  head.add(cyl(0.32, 0.38, 1.6, hm, { pos: [1.2, 0, 0], rot: [0, 0, Math.PI / 2] }, 24));
  for (let k = 0; k < 5; k++) {
    head.add(mesh(new THREE.TorusGeometry(0.42, 0.05, 10, 32), mat.glow(0x40a0ff, 3.5), { pos: [0.6 + k * 0.3, 0, 0],
      rot: [0, Math.PI / 2, 0], shadow: false }));
  }
  const sp = glowSprite('80,170,255', 1.6, 0.9);
  sp.position.set(2.1, 0, 0);
  head.add(sp);
}

function gaussCannon(g, r) {
  const hm = hullMaterial('gauss', { base: [88, 90, 96], accent: '210,170,40', panel: 36 });
  emplacement(g, r, { rad: 1.8 });
  const head = turretBody(g, { hm, bodyW: 1.4, bodyH: 1.0, bodyL: 1.6, pitch: 0.28 });
  // dwie szyny akceleratora
  for (const z of [-0.18, 0.18]) head.add(box(3.2, 0.12, 0.1, mat.steel(), { pos: [1.9, 0, z] }));
  for (let k = 0; k < 7; k++) {
    head.add(box(0.12, 0.55, 0.6, mat.copper(), { pos: [0.7 + k * 0.42, 0, 0] }));
  }
  head.add(sphere(0.06, mat.glow(0x9fd8ff, 10), { pos: [3.4, 0, 0], shadow: false }, 10));
  const sp = glowSprite('160,210,255', 0.9, 0.9);
  sp.position.set(3.45, 0, 0);
  head.add(sp);
}

function plasmaTurret(g, r) {
  const hm = hullMaterial('plasma', { base: [80, 76, 92], accent: '150,60,200', panel: 30 });
  emplacement(g, r, { rad: 1.9 });
  const head = turretBody(g, { hm, bodyW: 1.6, bodyH: 1.1, bodyL: 1.6, pitch: 0.25 });
  // komora z plazma (kula w klatce pola)
  const core = sphere(0.45, new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xc060ff, emissiveIntensity: 5 }),
    { pos: [1.35, 0.15, 0], shadow: false }, 32);
  core.userData.fx = true;
  head.add(core);
  for (let k = 0; k < 3; k++) {
    head.add(mesh(new THREE.TorusGeometry(0.6, 0.04, 8, 48), mat.gunmetal(), { pos: [1.35, 0.15, 0], rot: [k * 1.05, k * 0.6, 0] }));
  }
  const sp = glowSprite('200,110,255', 2.6, 0.9);
  sp.position.set(1.35, 0.15, 0);
  head.add(sp);
  head.add(cyl(0.18, 0.25, 1.0, hm, { pos: [2.1, 0.15, 0], rot: [0, 0, Math.PI / 2] }, 16));
}

function shieldDome(large) {
  return (g, r) => {
    const hm = hullMaterial(large ? 'lsd' : 'ssd', { base: [120, 126, 136], accent: '40,140,220', panel: 30 });
    const R = large ? 3.2 : 2.0;
    g.add(cyl(R * 0.98, R, 0.25, mat.concrete(), { pos: [0, 0.12, 0] }, 48));
    // emiter w srodku
    g.add(cyl(0.35, 0.5, 1.0, hm, { pos: [0, 0.75, 0] }, 16));
    g.add(sphere(0.25, mat.glow(0x60c0ff, 6), { pos: [0, 1.35, 0], shadow: false }, 16));
    // pylony na obwodzie
    const n = large ? 6 : 4;
    for (let a = 0; a < n; a++) {
      const ang = (a / n) * Math.PI * 2;
      const x = Math.cos(ang) * R * 0.85, z = Math.sin(ang) * R * 0.85;
      g.add(cyl(0.12, 0.18, large ? 1.3 : 0.9, hm, { pos: [x, large ? 0.8 : 0.6, z] }, 10));
      g.add(sphere(0.08, mat.glow(0x60c0ff, 8), { pos: [x, large ? 1.5 : 1.1, z], shadow: false }, 10));
    }
    // kopula pola silowego z heksagonalna siatka
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d');
    x.strokeStyle = 'rgba(140,210,255,0.9)';
    x.lineWidth = 2;
    const s = 22;
    for (let row = 0; row < 30; row++) {
      for (let col = 0; col < 16; col++) {
        const cx = col * s * 1.5 * 1.15, cy = row * s * 0.87 + (col % 2 ? s * 0.43 : 0);
        x.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          x.lineTo(cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5);
        }
        x.closePath();
        x.stroke();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 2);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x3aa0ff, map: t, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide }));
    dome.position.y = 0.2;
    dome.userData.fx = false; // kopula wyznacza kadr
    g.add(dome);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(R * 0.99, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x0a3060, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending,
        depthWrite: false }));
    inner.position.y = 0.2;
    g.add(inner);
  };
}

/** Rakieta: korpus, glowica, stateczniki; dir 'up' na wyrzutni. */
function missile(g, { len = 2.4, rad = 0.18, body = 0xd8dade, tip = 0xc83020, pos = [0, 0, 0], rot = [0, 0, 0] }) {
  const m = new THREE.Group();
  m.add(cyl(rad, rad, len, mat.paint(body, 0.35), { pos: [0, len / 2, 0] }, 24));
  m.add(mesh(new THREE.ConeGeometry(rad, len * 0.28, 24), mat.paint(tip, 0.35), { pos: [0, len + len * 0.14, 0] }));
  m.add(cyl(rad * 1.01, rad * 1.01, 0.08, mat.paint(0x202020), { pos: [0, len * 0.7, 0] }, 24));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    m.add(box(0.02, len * 0.18, rad * 1.4, mat.paint(0x303438), { pos: [Math.cos(a) * rad * 1.3, len * 0.1, Math.sin(a) * rad * 1.3],
      rot: [0, -a, 0] }));
  }
  m.position.set(...pos);
  m.rotation.set(...rot);
  g.add(m);
  return m;
}

function antiBallistic(g, r) {
  const hm = hullMaterial('abm', { base: [104, 110, 116], panel: 30 });
  g.add(box(2.4, 0.4, 1.8, mat.concrete(), { pos: [0, 0.2, 0] }));
  // pochylona wyrzutnia z dwiema rakietami
  const rail = new THREE.Group();
  rail.add(box(0.25, 3.0, 1.2, hm, { pos: [0, 1.5, 0] }));
  for (const z of [-0.35, 0.35]) missile(rail, { len: 2.3, rad: 0.15, body: 0xe6e8ea, tip: 0x2a6ad0, pos: [0.25, 0.4, z] });
  rail.position.set(-0.3, 0.4, 0);
  rail.rotation.z = -0.35;
  g.add(rail);
  g.add(box(0.6, 0.5, 0.5, hm, { pos: [0.8, 0.65, 0.5] }));
  g.add(cyl(0.02, 0.02, 1.2, mat.steel(), { pos: [0.9, 1.4, 0.5] }, 6));
  g.add(sphere(0.25, mat.steel(), { pos: [0.9, 2.0, 0.5], scale: [1, 0.35, 1] }, 16));
}

function interplanetary(g, r) {
  const hm = hullMaterial('ipm', { base: [92, 96, 100], accent: '220,170,30', panel: 40 });
  // otwarty silos z rakieta
  g.add(cyl(1.4, 1.6, 0.5, mat.concrete(), { pos: [0, 0.25, 0] }, 32));
  g.add(cyl(0.75, 0.75, 0.52, mat.dark(), { pos: [0, 0.26, 0] }, 32));
  for (const s of [1, -1]) {
    const door = box(1.5, 0.12, 0.75, hm, { pos: [0, 0.6, s * 1.1], rot: [s * -0.9, 0, 0] });
    g.add(door);
  }
  missile(g, { len: 3.2, rad: 0.32, body: 0xd0d2d4, tip: 0xe07020, pos: [0, -0.2, 0] });
  // dym i poswiata startowa
  const sp = glowSprite('255,150,60', 2.6, 0.7);
  sp.position.set(0, 0.6, 0);
  g.add(sp);
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    g.add(sphere(0.05, mat.glow(0xffb030, 6), { pos: [Math.cos(ang) * 1.3, 0.52, Math.sin(ang) * 1.3], shadow: false }, 8));
  }
}

export const items = {
  rocket_launcher: surfaceShot('rocket_launcher', rocketLauncher, { ground: [96, 88, 76] }),
  light_laser: surfaceShot('light_laser', laserTurret(false), { ground: [90, 84, 80] }),
  heavy_laser: surfaceShot('heavy_laser', laserTurret(true), { ground: [100, 86, 74] }),
  ion_cannon: surfaceShot('ion_cannon', ionCannon, { ground: [80, 86, 94], sky: ['#10203a', '#3a6aa0'] }),
  gauss_cannon: surfaceShot('gauss_cannon', gaussCannon, { ground: [94, 90, 84] }),
  plasma_turret: surfaceShot('plasma_turret', plasmaTurret, { ground: [86, 78, 90], sky: ['#1a1030', '#7a3aa0'] }),
  small_shield_dome: surfaceShot('small_shield_dome', shieldDome(false), { ground: [84, 88, 92], sky: ['#0e1c34', '#3a6aa0'] }),
  large_shield_dome: surfaceShot('large_shield_dome', shieldDome(true), { ground: [84, 88, 92], sky: ['#0e1c34', '#3a6aa0'] }),
  anti_ballistic_missile: surfaceShot('anti_ballistic_missile', antiBallistic, { ground: [92, 92, 90] }),
  interplanetary_missile: surfaceShot('interplanetary_missile', interplanetary, { ground: [100, 86, 70] }),
};
