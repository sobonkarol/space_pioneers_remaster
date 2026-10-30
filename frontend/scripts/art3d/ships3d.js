// Statki: modele 3D (kadluby loftowane z przekrojow, nadbudowki, wiezyczki, silniki, drobne detale).
// Statki leca w kierunku +X (dziob), silniki z tylu (-X).
import {
  THREE, rng, hullMaterial, windowsTexture, mat, box, cyl, sphere, loft, greebles, hullLights, glowSprite, exhaust,
  spaceBackdrop, createScene, cinematicLights, render, fitCamera, mesh,
} from './lib3d.js';

/** Dysza silnika z plomieniem i poswiata. */
export function engine(group, { x, y, z, r, color = '120,190,255', len = 3, housing }) {
  group.add(cyl(r * 1.05, r * 1.25, r * 1.4, housing ?? mat.gunmetal(), { pos: [x, y, z], rot: [0, 0, Math.PI / 2] }));
  group.add(cyl(r * 0.8, r * 0.8, 0.04, mat.glow(new THREE.Color(`rgb(${color})`), 7),
    { pos: [x - r * 0.71, y, z], rot: [0, 0, Math.PI / 2], shadow: false }));
  const fl = exhaust(color, len, r * 0.75);
  fl.position.set(x - r * 0.72, y, z);
  group.add(fl);
  const s = glowSprite(color, r * 2.6, 0.75);
  s.position.set(x - r * 0.9, y, z);
  group.add(s);
}

/** Wiezyczka: podstawa, oslona, dwie lufy. */
export function turret(group, { x, y, z, s = 0.35, material, yaw = 0.15 }) {
  const t = new THREE.Group();
  t.add(cyl(s * 0.9, s, s * 0.3, material, { pos: [0, s * 0.15, 0] }));
  t.add(loft([{ x: -s * 0.7, w: s * 1.1, top: s * 0.35, bot: 0.001, y: s * 0.3, k: 0.6 },
    { x: s * 0.6, w: s * 1.0, top: s * 0.28, bot: 0.001, y: s * 0.3, k: 0.6 }], material));
  for (const dz of [-0.2, 0.2]) {
    t.add(cyl(s * 0.06, s * 0.08, s * 1.9, mat.dark(), { pos: [s * 1.3, s * 0.45, dz * s], rot: [0, 0, Math.PI / 2] }, 12));
  }
  t.position.set(x, y, z);
  t.rotation.y = yaw;
  group.add(t);
}

/** Pas okien na burcie (emisyjna tekstura). */
export function windowStrip(group, seed, { x, y, z, w, h, rotY = 0, rotX = 0 }) {
  const tex = windowsTexture(seed, { rows: 5, density: 0.45 });
  tex.repeat.set(w / 2.5, 1);
  const m = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 2.4,
    transparent: true, alphaMap: tex });
  group.add(mesh(new THREE.PlaneGeometry(w, h), m, { pos: [x, y, z], rot: [rotX, rotY, 0], shadow: false }));
}

/** Ujecie w kosmosie: statek obrocony nosem lekko ku kamerze, kadr dopasowany automatycznie. */
export function spaceShot(key, build, { dir = [0.25, 0.42, 1], fov = 30, yaw = -0.62, margin = 0.84, nebula, roll = 0 } = {}) {
  return ({ size, outSize }) => {
    const scene = createScene();
    scene.background = spaceBackdrop(key, nebula ? { nebula } : {});
    cinematicLights(scene, { keyPos: [7, 8, 9], rimPos: [-10, 4, -6], shadowSize: 12 });
    const g = new THREE.Group();
    build(g, rng(key));
    g.rotation.set(roll, yaw, 0);
    scene.add(g);
    return render(scene, fitCamera(g, dir, { fov, margin }), { size, outSize });
  };
}

// ---------- okrety liniowe ----------
export function capital(g, r, { len = 10, wid = 3.2, hgt = 0.7, accent = null, turrets = 4, engines = 3, color = '255,170,90',
  base = [112, 118, 128], tower = true, seed, prow = 0.12 }) {
  const hm = hullMaterial(seed, { base, accent, panel: 56 });
  const hm2 = hullMaterial(seed + 'b', { base: base.map((v) => v - 28), panel: 36 });
  const L = len / 2;
  // glowny kadlub: sztylet, gorny poklad zwezony, stepka pod spodem
  g.add(loft([
    { x: -L, w: wid * 0.82, top: hgt * 1.1, bot: hgt * 0.8, k: 0.75 },
    { x: -L * 0.45, w: wid, top: hgt * 1.2, bot: hgt, k: 0.72 },
    { x: L * 0.25, w: wid * 0.62, top: hgt * 0.95, bot: hgt * 0.7, k: 0.68 },
    { x: L * (1 - prow), w: wid * 0.16, top: hgt * 0.45, bot: hgt * 0.3, k: 0.6 },
    { x: L, w: 0.06, top: 0.08, bot: 0.05, k: 0.6 },
  ], hm));
  // drugi poklad (nadbudowa grzbietowa)
  g.add(loft([
    { x: -L * 0.92, w: wid * 0.55, top: hgt * 0.75, bot: 0.01, y: hgt * 1.15, k: 0.7 },
    { x: -L * 0.2, w: wid * 0.42, top: hgt * 0.7, bot: 0.01, y: hgt * 1.12, k: 0.68 },
    { x: L * 0.45, w: wid * 0.08, top: hgt * 0.15, bot: 0.01, y: hgt * 0.75, k: 0.6 },
  ], hm2));
  // trzeci poklad z wieza
  if (tower) {
    const tx = -L * 0.62, ty = hgt * 1.85;
    g.add(loft([
      { x: tx - 0.9, w: wid * 0.32, top: hgt * 0.9, bot: 0.01, y: ty, k: 0.75 },
      { x: tx + 0.9, w: wid * 0.24, top: hgt * 0.6, bot: 0.01, y: ty, k: 0.7 },
    ], hm));
    const bridge = new THREE.Group();
    bridge.add(box(0.8, 0.28, wid * 0.55, hm2, { pos: [0, 0, 0] }));
    bridge.add(box(0.05, 0.08, wid * 0.5, mat.glow(0xffd8a0, 3), { pos: [0.41, 0.02, 0], shadow: false }));
    bridge.position.set(tx + 0.1, ty + hgt * 0.9 + 0.12, 0);
    g.add(bridge);
    for (const dz of [-0.25, 0.25]) g.add(cyl(0.025, 0.025, 0.8, mat.steel(), { pos: [tx - 0.3, ty + hgt * 0.9 + 0.5, dz] }, 8));
    g.add(sphere(0.18, hm2, { pos: [tx - 0.2, ty + hgt * 0.9 + 0.32, wid * 0.22], scale: [1, 0.6, 1] }, 24));
  }
  // drobne detale na grzbiecie i pokladzie
  greebles(r, g, { x0: -L * 0.9, x1: L * 0.2, z0: -wid * 0.17, z1: wid * 0.17, y: hgt * 1.85, count: 80, size: [0.05, 0.28], material: hm2 });
  greebles(r, g, { x0: -L * 0.8, x1: L * 0.35, z0: -wid * 0.33, z1: wid * 0.33, y: hgt * 1.12, count: 120, size: [0.04, 0.18],
    material: mat.gunmetal() });
  // wiezyczki
  for (let i = 0; i < turrets; i++) {
    const x = L * 0.45 - i * (L * 1.05) / Math.max(1, turrets - 1);
    const side = i % 2 ? 1 : -1;
    const zw = wid * 0.5 * (0.62 - Math.max(0, x) / L * 0.45) * 0.62;
    turret(g, { x, y: hgt * (x > L * 0.2 ? 0.95 : 1.15), z: side * zw, s: 0.3, material: hm2, yaw: 0.1 * side });
  }
  // swiatla okien wzdluz burt (szerokosc burty interpolowana z przekrojow)
  const prof = [[-L, wid * 0.82], [-L * 0.45, wid], [L * 0.25, wid * 0.62], [L * (1 - prow), wid * 0.16], [L, 0.06]];
  const halfAt = (x) => {
    for (let i = 0; i < prof.length - 1; i++) {
      const [xa, wa] = prof[i], [xb, wb] = prof[i + 1];
      if (x >= xa && x <= xb) return (wa + (wb - wa) * ((x - xa) / (xb - xa))) / 2;
    }
    return 0;
  };
  hullLights(r, g, { x0: -L * 0.95, x1: L * 0.55, at: (x) => [halfAt(x) * 0.985, 0.05, hgt * 0.12], count: 70 });
  hullLights(r, g, { x0: -L * 0.95, x1: L * 0.35, at: (x) => [halfAt(x) * 0.9, -hgt * 0.35, -hgt * 0.15], count: 40,
    color: 0xbfe0ff, intensity: 3 });
  // ciemne rowy wzdluz burt
  for (const s of [1, -1]) {
    g.add(box(len * 0.55, 0.06, 0.04, mat.dark(), { pos: [-L * 0.3, hgt * 0.32, s * halfAt(-L * 0.3) * 0.99] }));
  }
  // blok silnikow
  g.add(box(0.7, hgt * 2.0, wid * 0.7, hm2, { pos: [-L - 0.3, hgt * 0.15, 0] }));
  for (let i = 0; i < engines; i++) {
    const z = engines === 1 ? 0 : -wid * 0.26 + (i * wid * 0.52) / (engines - 1);
    engine(g, { x: -L - 0.75, y: hgt * 0.15 + (engines > 2 && i % 2 ? 0.4 : 0), z, r: 0.3, color, len: 2.6 });
  }
  // swiatla pozycyjne
  for (const [z, c] of [[wid * 0.48, 0x3cff6a], [-wid * 0.48, 0xff3a3a]]) {
    g.add(sphere(0.045, mat.glow(c, 9), { pos: [-L * 0.45, 0.02, z], shadow: false }, 12));
  }
}

// ---------- mysliwce ----------
export function fighter(g, r, { seed, len = 3.2, wing = 3.2, accent = '170,40,36', color = '255,150,80', heavy = false,
  base = [128, 132, 140] }) {
  const hm = hullMaterial(seed, { base, accent, panel: heavy ? 52 : 34 });
  const dm = mat.gunmetal();
  const L = len / 2;
  g.add(loft([
    { x: -L, w: 0.7, top: 0.3, bot: 0.22, k: 0.7 },
    { x: -L * 0.3, w: 0.85, top: 0.38, bot: 0.26, k: 0.62 },
    { x: L * 0.45, w: 0.42, top: 0.22, bot: 0.16, k: 0.55 },
    { x: L * 1.15, w: 0.04, top: 0.03, bot: 0.02, k: 0.5 },
  ], hm));
  // kabina: przyciemniane szklo
  const canopy = new THREE.MeshPhysicalMaterial({ color: 0x0c1824, metalness: 0.2, roughness: 0.05, clearcoat: 1,
    emissive: 0x1a3a5a, emissiveIntensity: 0.35 });
  g.add(sphere(0.3, canopy, { pos: [L * 0.05, 0.36, 0], scale: [1.9, 0.55, 0.62] }, 32));
  // skrzydla: cienkie plyty z lekkim wzniosem
  for (const s of [1, -1]) {
    const shape = new THREE.Shape([new THREE.Vector2(L * 0.25, 0), new THREE.Vector2(-L * 0.7, wing / 2),
      new THREE.Vector2(-L * 0.98, wing / 2), new THREE.Vector2(-L * 0.85, 0.25)]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02,
      bevelSegments: 1 });
    geo.rotateX(Math.PI / 2);
    const w = mesh(geo, hm, { pos: [0, 0.03, 0] });
    w.scale.z = s;
    w.rotation.x = s * -0.08;
    g.add(w);
    // dzialka na koncach skrzydel
    g.add(cyl(0.035, 0.045, 1.3, dm, { pos: [-L * 0.55, 0.05, s * wing * 0.48], rot: [0, 0, Math.PI / 2] }, 10));
    g.add(sphere(0.03, mat.glow(s > 0 ? 0x3cff6a : 0xff3a3a, 9), { pos: [-L * 0.9, 0.05, s * wing * 0.5], shadow: false }, 10));
    // stateczniki skosne
    const fs = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.6, 0), new THREE.Vector2(-0.8, 0.6),
      new THREE.Vector2(-0.55, 0.6)]);
    const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.04, bevelEnabled: false });
    const fin = mesh(fg, hm, { pos: [-L * 0.45, 0.3, s * 0.22] });
    fin.rotation.x = s * 0.35;
    g.add(fin);
    if (heavy) {
      g.add(loft([{ x: -0.5, w: 0.3, top: 0.12, bot: 0.12, k: 0.7 }, { x: 0.5, w: 0.22, top: 0.08, bot: 0.08, k: 0.6 }], dm,
        { pos: [-L * 0.2, 0.0, s * 0.85] }));
    }
  }
  greebles(r, g, { x0: -L * 0.9, x1: -L * 0.1, z0: -0.2, z1: 0.2, y: 0.36, count: 16, size: [0.03, 0.1], material: dm });
  const eng = heavy ? [-0.42, -0.15, 0.15, 0.42] : [-0.19, 0.19];
  for (const s of eng) engine(g, { x: -L - 0.05, y: 0.06, z: s, r: heavy ? 0.14 : 0.15, color, len: 1.5 });
  if (heavy) {
    g.add(loft([{ x: -L, w: 1.25, top: 0.25, bot: 0.2, k: 0.8 }, { x: -L * 0.2, w: 1.05, top: 0.3, bot: 0.22, k: 0.7 },
      { x: L * 0.3, w: 0.5, top: 0.15, bot: 0.12, k: 0.6 }], hm));
    for (const s of [1, -1]) g.add(cyl(0.05, 0.06, 1.6, mat.gunmetal(), { pos: [L * 0.2, -0.05, s * 0.4], rot: [0, 0, Math.PI / 2] }, 10));
  }
}

// ---------- transportowce i statki cywilne ----------
/** Kontener towarowy z zebrowaniem. */
function container(g, { x, y, z, l = 1.2, h = 0.5, w = 0.5, color = 0x8a5a2a }) {
  const m = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.55 });
  g.add(box(l, h, w, m, { pos: [x, y, z] }));
  for (let i = -l / 2 + 0.1; i <= l / 2 - 0.05; i += 0.15) {
    g.add(box(0.03, h * 1.02, w * 1.02, mat.dark(), { pos: [x + i, y, z] }));
  }
}

function cargo(g, r, { seed, len = 4, modules = 2, rows = 2, accent = '210,150,40', engines = 2, color = '255,180,100', freighter = false }) {
  const hm = hullMaterial(seed, { base: [120, 116, 108], accent, panel: 40 });
  const hm2 = hullMaterial(seed + 'b', { base: [84, 86, 92], panel: 30 });
  const L = len / 2;
  // kabina z przodu
  g.add(loft([
    { x: L * 0.55, w: 1.0, top: 0.5, bot: 0.35, k: 0.7 },
    { x: L * 0.85, w: 0.9, top: 0.45, bot: 0.3, k: 0.6 },
    { x: L * 1.12, w: 0.35, top: 0.12, bot: 0.12, k: 0.5 },
  ], hm));
  g.add(box(0.05, 0.12, 0.6, mat.glow(0xbfe4ff, 2.5), { pos: [L * 0.95, 0.38, 0], rot: [0, 0, -0.6], shadow: false }));
  // kregoslup z kontenerami
  g.add(box(len * 0.9, 0.22, 0.28, hm2, { pos: [-L * 0.05, 0, 0] }));
  const colors = [0x5e4a36, 0x3c4a58, 0x5a3a34, 0x4a5240, 0x6a6250];
  const cw = (len * 0.8) / modules;
  for (let i = 0; i < modules; i++) {
    for (let k = 0; k < rows; k++) {
      for (const s of [1, -1]) {
        container(g, { x: L * 0.42 - cw / 2 - i * cw, y: 0.3 - k * 0.56, z: s * 0.42, l: cw * 0.92, h: 0.5, w: 0.5,
          color: colors[(i * 3 + k + (s > 0 ? 1 : 0)) % colors.length] });
      }
    }
  }
  if (freighter) {
    // pierscien zalogi i zlote wykonczenia
    const ring = mesh(new THREE.TorusGeometry(0.9, 0.12, 12, 48), mat.gold(), { pos: [-L * 0.55, 0.05, 0], rot: [0, Math.PI / 2, 0] });
    g.add(ring);
    hullLights(r, g, { x0: -L * 0.6, x1: -L * 0.5, at: () => [0.95, -0.1, 0.1], count: 10 });
  }
  // blok napedowy
  g.add(loft([{ x: -L * 0.95, w: 1.3, top: 0.45, bot: 0.45, k: 0.75 }, { x: -L * 0.6, w: 1.0, top: 0.35, bot: 0.35, k: 0.7 }], hm));
  for (let i = 0; i < engines; i++) {
    const z = engines === 1 ? 0 : -0.35 + (i * 0.7) / (engines - 1);
    const y = engines > 2 ? (i % 2 ? 0.2 : -0.2) : 0;
    engine(g, { x: -L * 0.98, y, z: engines > 2 ? (i < 2 ? -0.3 : 0.3) : z, r: 0.2, color, len: 1.6 });
  }
  greebles(r, g, { x0: -L * 0.9, x1: L * 0.4, z0: -0.1, z1: 0.1, y: 0.11, count: 20, size: [0.04, 0.12], material: hm2 });
}

function bomber(g, r) {
  const hm = hullMaterial('bomber', { base: [92, 96, 90], accent: '120,30,30', panel: 44 });
  const dm = mat.gunmetal();
  // latajace skrzydlo: szeroki, plaski kadlub
  g.add(loft([
    { x: -2.2, w: 5.2, top: 0.32, bot: 0.25, k: 0.8, kb: 0.8 },
    { x: -0.8, w: 4.6, top: 0.42, bot: 0.3, k: 0.6 },
    { x: 1.4, w: 1.4, top: 0.38, bot: 0.28, k: 0.55 },
    { x: 2.6, w: 0.12, top: 0.05, bot: 0.04, k: 0.5 },
  ], hm));
  g.add(sphere(0.3, new THREE.MeshPhysicalMaterial({ color: 0x0c1824, roughness: 0.05, clearcoat: 1, emissive: 0x3a1a0a,
    emissiveIntensity: 0.4 }), { pos: [1.2, 0.4, 0], scale: [1.8, 0.45, 0.8] }));
  // zasobniki z bombami pod skrzydlami
  for (const s of [1, -1]) {
    for (const zz of [0.9, 1.6]) {
      g.add(loft([{ x: -0.9, w: 0.28, top: 0.14, bot: 0.14, k: 0.8, kb: 0.8 }, { x: 0.6, w: 0.24, top: 0.12, bot: 0.12, k: 0.7, kb: 0.7 },
        { x: 0.9, w: 0.05, top: 0.03, bot: 0.03 }], dm, { pos: [-0.6, -0.42, s * zz] }));
      g.add(box(0.06, 0.15, 0.04, mat.dark(), { pos: [-0.5, -0.3, s * zz] }));
    }
    g.add(sphere(0.035, mat.glow(s > 0 ? 0x3cff6a : 0xff3a3a, 9), { pos: [-2.1, 0.05, s * 2.55], shadow: false }, 10));
  }
  greebles(r, g, { x0: -2, x1: 0.8, z0: -1.4, z1: 1.4, y: 0.36, count: 50, size: [0.04, 0.16], material: dm });
  for (const z of [-1.0, -0.35, 0.35, 1.0]) engine(g, { x: -2.3, y: 0.02, z, r: 0.2, color: '255,140,60', len: 1.8 });
}

function destroyer(g, r) {
  capital(g, r, { seed: 'ds', len: 13, wid: 4.2, hgt: 0.85, turrets: 7, engines: 5, accent: '100,20,30', base: [70, 74, 82],
    color: '255,90,70' });
  // dzialo glowne na dziobie
  g.add(cyl(0.12, 0.2, 2.6, mat.dark(), { pos: [5.6, 0.5, 0], rot: [0, 0, Math.PI / 2] }, 16));
  for (let i = 0; i < 5; i++) g.add(cyl(0.26, 0.26, 0.08, mat.copper(), { pos: [4.7 + i * 0.4, 0.5, 0], rot: [0, 0, Math.PI / 2] }, 16));
  const tip = glowSprite('255,60,60', 0.9, 0.9);
  tip.position.set(6.95, 0.5, 0);
  g.add(tip);
  // czerwone swiatla wzdluz kadluba
  hullLights(r, g, { x0: -6, x1: 3, at: (x) => [1.9 - Math.max(0, x) * 0.25, 0.9, 1.0], count: 30, color: 0xff3a30, intensity: 3 });
}

function colonyShip(g, r) {
  const hm = hullMaterial('colony', { base: [150, 150, 145], accent: '60,140,90', panel: 48 });
  const dm = mat.gunmetal();
  // kregoslup
  g.add(cyl(0.3, 0.3, 6, hm, { rot: [0, 0, Math.PI / 2] }, 24));
  // obracajacy sie pierscien mieszkalny na szprychach
  const ring = mesh(new THREE.TorusGeometry(1.8, 0.28, 16, 96), hm, { pos: [0.4, 0, 0], rot: [0, Math.PI / 2, 0] });
  g.add(ring);
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    g.add(cyl(0.06, 0.06, 1.8, dm, { pos: [0.4, Math.sin(ang) * 0.9, Math.cos(ang) * 0.9], rot: [ang, 0, 0] }, 8));
  }
  // okna pierscienia
  const wm = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffe2a8, emissiveIntensity: 1.5 });
  for (let a = 0; a < 48; a++) {
    const ang = (a / 48) * Math.PI * 2;
    const w = box(0.08, 0.05, 0.12, wm, { pos: [0.4 + 0.29, Math.sin(ang) * 1.8, Math.cos(ang) * 1.8], rot: [ang, 0, 0], shadow: false });
    w.userData.fx = true;
    g.add(w);
  }
  // kopuly z roslinnoscia (zielone swiatlo) z przodu
  for (const [x, y, z] of [[2.4, 0.35, 0], [2.0, 0.2, 0.45], [2.0, 0.2, -0.45]]) {
    g.add(sphere(0.38, new THREE.MeshPhysicalMaterial({ color: 0x4a8a5a, transparent: true, opacity: 0.6, roughness: 0.1,
      emissive: 0x3aa860, emissiveIntensity: 0.9, clearcoat: 1 }), { pos: [x, y, z], scale: [1, 0.8, 1] }));
  }
  g.add(cyl(0.6, 0.45, 0.6, hm, { pos: [2.2, 0, 0], rot: [0, 0, Math.PI / 2] }));
  // zbiorniki i naped
  for (const s of [1, -1]) g.add(sphere(0.45, hm, { pos: [-1.8, 0, s * 0.55] }));
  g.add(box(0.8, 0.9, 0.9, hm, { pos: [-2.8, 0, 0] }));
  for (const z of [-0.25, 0.25]) engine(g, { x: -3.3, y: 0, z, r: 0.22, color: '120,200,255', len: 1.8 });
  greebles(r, g, { x0: -2.6, x1: 1.6, z0: -0.15, z1: 0.15, y: 0.28, count: 24, size: [0.04, 0.12], material: dm });
}

function recycler(g, r) {
  const hm = hullMaterial('rec', { base: [128, 118, 92], accent: '230,170,30', panel: 40 });
  const dm = mat.gunmetal();
  g.add(loft([
    { x: -2.4, w: 1.8, top: 0.7, bot: 0.6, k: 0.8, kb: 0.8 },
    { x: 0.6, w: 1.9, top: 0.75, bot: 0.65, k: 0.8, kb: 0.8 },
    { x: 1.4, w: 1.4, top: 0.5, bot: 0.45, k: 0.7 },
  ], hm));
  // lej zbierajacy z przodu
  g.add(cyl(0.9, 0.45, 0.8, dm, { pos: [1.85, 0.05, 0], rot: [0, 0, Math.PI / 2] }, 24));
  g.add(cyl(0.7, 0.7, 0.05, mat.glow(0x40ff90, 1.1), { pos: [2.26, 0.05, 0], rot: [0, 0, Math.PI / 2], shadow: false }, 24));
  // ramiona chwytakow
  for (const s of [1, -1]) {
    const arm = new THREE.Group();
    arm.add(cyl(0.08, 0.1, 2.0, mat.steel(), { pos: [0.9, 0, 0], rot: [0, 0, Math.PI / 2] }, 10));
    arm.add(sphere(0.15, dm, { pos: [0, 0, 0] }));
    arm.add(cyl(0.06, 0.08, 1.2, mat.steel(), { pos: [2.3, 0, s * -0.3], rot: [0, s * 0.5, Math.PI / 2] }, 10));
    arm.add(box(0.3, 0.12, 0.25, dm, { pos: [2.8, 0, s * -0.6] }));
    arm.position.set(0.6, 0.3, s * 1.0);
    arm.rotation.y = s * -0.25;
    g.add(arm);
  }
  // ladownia: kontenery z odpadami na grzbiecie
  for (let i = 0; i < 3; i++) container(g, { x: -1.6 + i * 0.75, y: 0.95, z: 0, l: 0.65, h: 0.4, w: 1.1, color: 0x6a6040 });
  // pasy ostrzegawcze
  for (let i = -2.2; i < 1.2; i += 0.5) {
    g.add(box(0.2, 0.06, 1.95, new THREE.MeshStandardMaterial({ color: 0xe0a020, roughness: 0.6 }), { pos: [i, -0.55, 0] }));
  }
  greebles(r, g, { x0: -2.2, x1: 0.8, z0: -0.7, z1: 0.7, y: 0.7, count: 40, size: [0.05, 0.18], material: dm });
  for (const z of [-0.45, 0.45]) engine(g, { x: -2.55, y: 0, z, r: 0.28, color: '255,190,90', len: 2 });
}

function probe(g, r) {
  const hm = hullMaterial('probe', { base: [170, 170, 176], panel: 20 });
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), hm));
  g.children[g.children.length - 1].castShadow = true;
  g.add(sphere(0.12, mat.glow(0x40c8ff, 6), { pos: [0.42, 0, 0], shadow: false }));
  const lens = glowSprite('80,200,255', 0.7, 0.9);
  lens.position.set(0.5, 0, 0);
  g.add(lens);
  // panele sloneczne
  const panel = new THREE.MeshStandardMaterial({ color: 0x14244a, metalness: 0.8, roughness: 0.25, emissive: 0x0a1a3a });
  for (const s of [1, -1]) {
    g.add(cyl(0.02, 0.02, 0.6, mat.steel(), { pos: [0, 0, s * 0.6], rot: [Math.PI / 2, 0, 0] }, 6));
    g.add(box(0.5, 0.02, 0.9, panel, { pos: [0, 0, s * 1.3] }));
    for (let k = -0.35; k <= 0.36; k += 0.18) g.add(box(0.52, 0.025, 0.01, mat.steel(), { pos: [0, 0, s * 1.3 + k] }));
  }
  // anteny
  g.add(cyl(0.01, 0.01, 1.0, mat.steel(), { pos: [-0.2, 0.7, 0], rot: [0, 0, 0.4] }, 6));
  g.add(sphere(0.18, mat.steel(), { pos: [-0.3, -0.5, 0], scale: [1, 0.3, 1] }));
  g.add(sphere(0.03, mat.glow(0xff3a3a, 9), { pos: [-0.4, 1.15, 0], shadow: false }, 8));
  engine(g, { x: -0.5, y: 0, z: 0, r: 0.08, color: '120,190,255', len: 0.8 });
}

function satellite(g, r) {
  const hm = hullMaterial('sat', { base: [180, 170, 140], panel: 24 });
  g.add(cyl(0.35, 0.35, 1.2, hm, {}, 8));
  g.add(sphere(0.3, mat.gold(), { pos: [0, 0.75, 0], scale: [1, 0.4, 1] }));
  // ramiona z panelami fotowoltaicznymi (siatka ogniw)
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#0c1a3a';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const gr = x.createLinearGradient(i * 32, j * 32, i * 32 + 32, j * 32 + 32);
      gr.addColorStop(0, '#1d3d7a');
      gr.addColorStop(1, '#0a1630');
      x.fillStyle = gr;
      x.fillRect(i * 32 + 2, j * 32 + 2, 28, 28);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.MeshStandardMaterial({ map: t, metalness: 0.7, roughness: 0.2 });
  for (const s of [1, -1]) {
    g.add(cyl(0.03, 0.03, 0.7, mat.steel(), { pos: [0, 0, s * 0.65], rot: [Math.PI / 2, 0, 0] }, 6));
    for (const k of [0, 1]) g.add(box(1.4, 0.03, 1.4, pm, { pos: [0, 0, s * (1.75 + k * 1.5)], rot: [0.25, 0, 0] }));
  }
  g.add(cyl(0.02, 0.02, 0.8, mat.steel(), { pos: [0, -0.9, 0] }, 6));
  g.add(sphere(0.03, mat.glow(0x3cff6a, 9), { pos: [0, -1.3, 0], shadow: false }, 8));
}

export const items = {
  small_cargo: spaceShot('small_cargo', (g, r) => cargo(g, r, { seed: 'sc', len: 3.4, modules: 2, rows: 1 })),
  large_cargo: spaceShot('large_cargo', (g, r) => cargo(g, r, { seed: 'lc', len: 6, modules: 4, rows: 2, engines: 4, accent: '60,110,170' })),
  freighter: spaceShot('freighter', (g, r) => cargo(g, r, { seed: 'fr', len: 7, modules: 5, rows: 2, engines: 4, accent: '220,170,60',
    freighter: true })),
  bomber: spaceShot('bomber', bomber, { yaw: -0.7, dir: [0.2, 0.6, 1] }),
  destroyer: spaceShot('destroyer', destroyer, { nebula: ['160,40,50', '60,40,120'] }),
  colony_ship: spaceShot('colony_ship', colonyShip, { yaw: -0.55, dir: [0.35, 0.4, 1], nebula: ['50,120,110', '70,80,160'] }),
  recycler: spaceShot('recycler', recycler, { yaw: -0.65 }),
  espionage_probe: spaceShot('espionage_probe', probe, { yaw: -0.4, dir: [0.4, 0.35, 1], nebula: ['40,80,140', '40,120,140'] }),
  solar_satellite: spaceShot('solar_satellite', satellite, { yaw: -0.9, dir: [0.6, 0.45, 1], margin: 0.72, nebula: ['160,120,60', '80,60,140'] }),
  light_fighter: spaceShot('light_fighter', (g, r) => fighter(g, r, { seed: 'lf' }), { yaw: -0.75, dir: [0.15, 0.55, 1] }),
  heavy_fighter: spaceShot('heavy_fighter', (g, r) => fighter(g, r, { seed: 'hf', len: 4.2, wing: 3.4, accent: '210,120,30', heavy: true,
    base: [86, 92, 84], color: '255,120,60' }), { yaw: -0.95, dir: [0.35, 0.5, 1], nebula: ['160,90,40', '80,40,90'] }),
  battleship: spaceShot('battleship', (g, r) => capital(g, r, { seed: 'bs', len: 10, wid: 3.4, turrets: 5, engines: 4,
    accent: '140,36,36' })),
  cruiser: spaceShot('cruiser', (g, r) => capital(g, r, { seed: 'cr', len: 8, wid: 2.5, turrets: 3, engines: 2,
    base: [104, 114, 126], accent: '40,90,160', color: '120,190,255' })),
};
