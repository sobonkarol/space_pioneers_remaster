// Budynki: kompleksy przemyslowe na powierzchni planety.
import { THREE, hullMaterial, mat, box, cyl, sphere, loft, greebles, hullLights, glowSprite, mesh, mergeGeometries } from './lib3d.js';
import { surfaceShot } from './scenes.js';

/** Kratownica (wieza wiertnicza, maszt): cztery nogi i poprzeczki. */
export function lattice(group, { x = 0, z = 0, w = 1.2, h = 5, top = 0.35, material = mat.steel(), levels = 8 }) {
  const geos = [];
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const at = (k, y) => {
    const s = (w / 2) * (1 - (y / h) * (1 - top));
    return [legs[k][0] * s, y, legs[k][1] * s];
  };
  const rod = (p, q, r) => {
    const a = new THREE.Vector3(...p), b = new THREE.Vector3(...q);
    const geo = new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    const m = a.add(b).multiplyScalar(0.5);
    geo.translate(m.x, m.y, m.z);
    geos.push(geo);
  };
  for (let k = 0; k < 4; k++) rod(at(k, 0), at(k, h), 0.045);
  for (let i = 0; i < levels; i++) {
    const y0 = (i * h) / levels, y1 = ((i + 1) * h) / levels;
    for (let k = 0; k < 4; k++) {
      rod(at(k, y1), at((k + 1) % 4, y1), 0.025);
      rod(at(k, y0), at((k + 1) % 4, y1), 0.02);
    }
  }
  const m = mesh(mergeGeometries(geos), material);
  m.position.set(x, 0, z);
  group.add(m);
}

/** Lampa ostrzegawcza / reflektor z poswiata. */
export function beacon(group, { x, y, z, color = 0xff3a2a, s = 0.06, glow = 0.6 }) {
  group.add(sphere(s, mat.glow(color, 10), { pos: [x, y, z], shadow: false }, 12));
  const sp = glowSprite(`${Math.round(new THREE.Color(color).r * 255)},${Math.round(new THREE.Color(color).g * 255)},${Math.round(new THREE.Color(color).b * 255)}`, glow, 0.8);
  sp.position.set(x, y, z);
  group.add(sp);
}

/** Hala przemyslowa: prostopadloscian z dachem, oknami i detalami na dachu. */
export function hall(group, r, { x = 0, z = 0, w = 2.5, h = 1.2, d = 1.6, material, roof = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.4, roughness: 0.7 }), seed = 'hall', lights = true }) {
  group.add(box(w, h, d, material, { pos: [x, h / 2, z] }));
  group.add(box(w + 0.1, 0.1, d + 0.1, roof, { pos: [x, h + 0.05, z] }));
  greebles(r, group, { x0: x - w / 2 + 0.2, x1: x + w / 2 - 0.2, z0: z - d / 2 + 0.2, z1: z + d / 2 - 0.2, y: h + 0.1, count: 14,
    size: [0.08, 0.3], material: roof });
  if (lights) {
    hullLights(r, group, { x0: x - w / 2 + 0.1, x1: x + w / 2 - 0.3, at: () => [d / 2, h * 0.35, h * 0.85], count: 18,
      size: 0.05, intensity: 3.2 });
  }
}

function metalMine(g, r) {
  const hm = hullMaterial('mm', { base: [96, 92, 88], accent: '210,150,40', panel: 48 });
  const rust = hullMaterial('mm-rust', { base: [120, 78, 52], panel: 70 });
  // wieza wiertnicza nad szybem
  lattice(g, { x: -0.6, z: 0, w: 1.6, h: 4.6, material: mat.steel() });
  g.add(cyl(0.9, 1.05, 0.35, mat.concrete(), { pos: [-0.6, 0.17, 0] }));
  g.add(cyl(0.25, 0.25, 4.0, mat.gunmetal(), { pos: [-0.6, 2.2, 0] }, 16));
  g.add(box(0.8, 0.5, 0.8, hm, { pos: [-0.6, 4.75, 0] }));
  beacon(g, { x: -0.6, y: 5.1, z: 0 });
  // hala przerobu rudy
  hall(g, r, { x: 2.2, z: 0.4, w: 2.6, h: 1.4, d: 1.8, material: hm });
  // przenosnik tasmowy na kratownicy
  const conv = new THREE.Group();
  conv.add(box(3.2, 0.12, 0.35, rust, { pos: [0, 0, 0] }));
  for (let i = -1.4; i <= 1.4; i += 0.7) conv.add(cyl(0.04, 0.04, 1.0, mat.steel(), { pos: [i, -0.5, 0] }, 8));
  conv.position.set(0.9, 1.15, -1.3);
  conv.rotation.z = 0.28;
  g.add(conv);
  // hałdy rudy
  const ore = new THREE.MeshStandardMaterial({ color: 0x5e5a56, roughness: 0.95, metalness: 0.35, flatShading: true });
  for (const [x, z, s] of [[2.8, -1.6, 0.9], [1.6, -2.0, 0.6], [3.4, -0.9, 0.5]]) {
    const geo = new THREE.IcosahedronGeometry(s, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.8 + r() * 0.4;
      p.setXYZ(i, p.getX(i) * k, Math.max(0, p.getY(i) * 0.6 * k), p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    g.add(mesh(geo, ore, { pos: [x, 0, z] }));
  }
  // zbiorniki i rury
  for (const [x, z] of [[-2.4, 1.2], [-2.4, -0.4]]) {
    g.add(cyl(0.55, 0.55, 1.6, hm, { pos: [x, 0.8, z] }));
    g.add(sphere(0.55, hm, { pos: [x, 1.6, z], scale: [1, 0.4, 1] }));
  }
  g.add(cyl(0.08, 0.08, 4.5, mat.copper(), { pos: [0, 0.35, 1.6], rot: [0, 0, Math.PI / 2] }, 10));
  beacon(g, { x: 3.4, y: 1.6, z: 1.3, color: 0xffb030, glow: 0.5 });
}

// ---------- pozostale budynki ----------
const dark = () => new THREE.MeshStandardMaterial({ color: 0x2a2d32, metalness: 0.5, roughness: 0.6 });

/** Kopula (polkula) z pierscieniem u podstawy. */
function dome(g, { x = 0, z = 0, r = 1, material, y = 0, ring = true }) {
  g.add(mesh(new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), material, { pos: [x, y, z] }));
  if (ring) g.add(cyl(r * 1.03, r * 1.06, 0.2, dark(), { pos: [x, y + 0.1, z] }, 48));
}

/** Rura laczaca dwa punkty na zadanej wysokosci. */
function pipe(g, a, b, { r = 0.07, material = mat.steel() } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const m = cyl(r, r, A.distanceTo(B), material, {}, 12);
  m.position.copy(A.clone().add(B).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.add(m);
}

/** Kepa krysztalow (graniastoslupy z polprzezroczystego materialu). */
function crystals(g, r, { x, z, n = 7, color = 0x50b0ff, scale = 1 }) {
  const m = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.1,
    transparent: true, opacity: 0.8, clearcoat: 1, flatShading: true });
  for (let i = 0; i < n; i++) {
    const h = r.range(0.6, 1.8) * scale, rad = r.range(0.12, 0.28) * scale;
    const geo = new THREE.CylinderGeometry(0, rad, h * 0.25, 6);
    geo.translate(0, h * 0.5 + h * 0.125, 0);
    const body = new THREE.CylinderGeometry(rad, rad, h, 6);
    body.translate(0, h / 2, 0);
    for (const gg of [geo, body]) {
      const c = new THREE.Mesh(gg, m);
      c.position.set(x + r.range(-0.4, 0.4) * scale, -0.05, z + r.range(-0.4, 0.4) * scale);
      c.rotation.set(r.range(-0.4, 0.4), r.range(0, 6), r.range(-0.4, 0.4));
      c.castShadow = true;
      g.add(c);
    }
  }
  const sp = glowSprite('80,170,255', 2.2 * scale, 0.35);
  sp.position.set(x, 0.8 * scale, z);
  g.add(sp);
}

function crystalMine(g, r) {
  const hm = hullMaterial('cm', { base: [92, 98, 110], accent: '40,120,200', panel: 44 });
  crystals(g, r, { x: -1.6, z: -0.6, n: 9, scale: 1.2 });
  crystals(g, r, { x: 1.9, z: -1.6, n: 5, scale: 0.8 });
  hall(g, r, { x: 1.4, z: 0.9, w: 2.4, h: 1.2, d: 1.6, material: hm });
  // ramie koparki nad zlozem
  g.add(cyl(0.35, 0.45, 0.6, hm, { pos: [-0.2, 0.3, 0.6] }, 16));
  const arm = new THREE.Group();
  arm.add(box(2.4, 0.22, 0.3, mat.paint(0xd0a030), { pos: [-1.1, 0, 0] }));
  arm.add(box(0.2, 1.0, 0.25, mat.paint(0xd0a030), { pos: [-2.2, -0.45, 0] }));
  arm.add(cyl(0.05, 0.25, 0.4, mat.steel(), { pos: [-2.2, -1.1, 0] }, 12));
  arm.position.set(-0.2, 1.4, 0.6);
  arm.rotation.set(0, 0.5, 0.35);
  g.add(arm);
  pipe(g, [0, 0.25, 0.6], [1.4, 0.25, 0.6], { r: 0.1 });
  beacon(g, { x: 2.5, y: 1.4, z: 1.6, color: 0x40b0ff, glow: 0.5 });
}

function tritiumSynth(g, r) {
  const hm = hullMaterial('ts', { base: [100, 108, 104], accent: '40,170,90', panel: 40 });
  const glowGreen = mat.glow(0x30ff8a, 3);
  // kuliste reaktory
  for (const [x, z, rr] of [[-1.4, -0.4, 0.9], [0.5, -1.0, 0.7]]) {
    g.add(sphere(rr, hm, { pos: [x, rr + 0.35, z] }, 32));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      g.add(cyl(0.06, 0.06, rr + 0.35, mat.steel(), { pos: [x + Math.cos(a) * rr * 0.7, (rr + 0.35) / 2, z + Math.sin(a) * rr * 0.7] }, 8));
    }
    g.add(mesh(new THREE.TorusGeometry(rr * 1.01, 0.04, 8, 48), glowGreen, { pos: [x, rr + 0.35, z], rot: [Math.PI / 2, 0, 0], shadow: false }));
  }
  // wieze chlodnicze
  for (const [x, z] of [[1.9, 0.6], [1.0, 1.4]]) {
    const geo = new THREE.LatheGeometry([0.9, 0.75, 0.6, 0.55, 0.6, 0.68].map((w, i) => new THREE.Vector2(w, i * 0.45)), 32);
    g.add(mesh(geo, mat.concrete(), { pos: [x, 0, z] }));
  }
  // przezroczyste rury z zielonym trytem
  const tube = new THREE.MeshStandardMaterial({ color: 0x0, emissive: 0x30ff8a, emissiveIntensity: 1.6 });
  pipe(g, [-1.4, 0.4, -0.4], [0.5, 0.4, -1.0], { r: 0.09, material: tube });
  pipe(g, [0.5, 0.4, -1.0], [1.9, 0.4, 0.6], { r: 0.09, material: tube });
  hall(g, r, { x: -1.0, z: 1.3, w: 1.6, h: 0.8, d: 1.1, material: hm });
}

function solarPlant(g, r) {
  // pola paneli fotowoltaicznych
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#0b1530';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    x.fillStyle = '#18306a';
    x.fillRect(i * 32 + 2, j * 32 + 2, 28, 28);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.MeshStandardMaterial({ map: t, metalness: 0.8, roughness: 0.18 });
  for (let i = -3; i <= 3; i++) {
    for (let j = -2; j <= 2; j++) {
      if (Math.abs(i) < 1 && Math.abs(j) < 1) continue;
      const px = i * 0.85, pz = j * 0.95;
      g.add(cyl(0.03, 0.03, 0.4, mat.steel(), { pos: [px, 0.2, pz] }, 6));
      g.add(box(0.75, 0.03, 0.55, pm, { pos: [px, 0.42, pz], rot: [0, 0, 0.5] }));
    }
  }
  // wieza z odbiornikiem
  g.add(cyl(0.18, 0.3, 2.6, mat.concrete(), { pos: [0, 1.3, 0] }, 16));
  g.add(cyl(0.35, 0.35, 0.4, mat.gunmetal(), { pos: [0, 2.7, 0] }, 16));
  g.add(sphere(0.18, mat.glow(0xffc040, 4), { pos: [0, 2.7, 0.3], shadow: false }, 16));
  beacon(g, { x: 0, y: 3.0, z: 0 });
}

function fusionPlant(g, r) {
  const hm = hullMaterial('fp', { base: [110, 112, 118], accent: '220,120,30', panel: 48 });
  // budynek reaktora z odkrytym tokamakiem
  g.add(cyl(1.7, 1.8, 0.9, hm, { pos: [0, 0.45, 0] }, 48));
  const torus = mesh(new THREE.TorusGeometry(1.2, 0.35, 24, 64), hm, { pos: [0, 1.1, 0], rot: [Math.PI / 2, 0, 0] });
  g.add(torus);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    g.add(mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 24), mat.copper(), { pos: [Math.cos(a) * 1.2, 1.1, Math.sin(a) * 1.2], rot: [0, -a, 0] }));
  }
  const plasma = mesh(new THREE.TorusGeometry(1.2, 0.12, 16, 64), mat.glow(0xff8a30, 6), { pos: [0, 1.48, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
  g.add(plasma);
  const sp = glowSprite('255,150,60', 3.5, 0.5);
  sp.position.set(0, 1.5, 0);
  g.add(sp);
  for (const [x, z] of [[-2.6, -0.8], [2.6, -0.6]]) {
    const geo = new THREE.LatheGeometry([0.9, 0.75, 0.6, 0.55, 0.6, 0.7].map((w, i) => new THREE.Vector2(w, i * 0.5)), 32);
    g.add(mesh(geo, mat.concrete(), { pos: [x, 0, z] }));
  }
  hall(g, r, { x: 0.4, z: 2.2, w: 2.4, h: 0.8, d: 0.9, material: hm });
}

/** Ramie robota przemyslowego. */
function robotArm(g, { x, z, s = 1, color = 0xe0a020, yaw = 0 }) {
  const m = mat.paint(color, 0.45);
  const a = new THREE.Group();
  a.add(cyl(0.25 * s, 0.3 * s, 0.25 * s, mat.gunmetal(), { pos: [0, 0.12 * s, 0] }, 16));
  const l1 = new THREE.Group();
  l1.add(box(0.18 * s, 1.1 * s, 0.18 * s, m, { pos: [0, 0.55 * s, 0] }));
  const l2 = new THREE.Group();
  l2.add(box(0.9 * s, 0.14 * s, 0.14 * s, m, { pos: [0.45 * s, 0, 0] }));
  l2.add(cyl(0.05 * s, 0.08 * s, 0.25 * s, mat.steel(), { pos: [0.95 * s, -0.12 * s, 0] }, 8));
  l2.position.y = 1.1 * s;
  l2.rotation.z = -0.5;
  l1.add(l2);
  l1.position.y = 0.25 * s;
  l1.rotation.z = 0.35;
  a.add(l1);
  a.position.set(x, 0, z);
  a.rotation.y = yaw;
  g.add(a);
}

function roboticsFactory(g, r) {
  const hm = hullMaterial('rf', { base: [104, 108, 116], accent: '220,160,30', panel: 44 });
  hall(g, r, { x: -0.6, z: -0.6, w: 3.4, h: 1.5, d: 2.0, material: hm });
  // linia montazowa z ramionami robotow przed hala
  g.add(box(3.6, 0.25, 0.6, mat.gunmetal(), { pos: [-0.2, 0.12, 1.2] }));
  for (let i = 0; i < 4; i++) g.add(box(0.4, 0.3, 0.35, hm, { pos: [-1.6 + i * 0.95, 0.4, 1.2] }));
  robotArm(g, { x: -1.1, z: 2.0, yaw: -1.2 });
  robotArm(g, { x: 0.8, z: 2.0, yaw: -1.9 });
  robotArm(g, { x: 1.8, z: 0.2, yaw: 2.6, color: 0xd04a20 });
  for (const i of [-1.5, 0.3]) g.add(sphere(0.06, mat.glow(0x60c0ff, 6), { pos: [i, 0.65, 1.2], shadow: false }, 8));
}

function naniteFactory(g, r) {
  const shell = new THREE.MeshStandardMaterial({ color: 0x9aa4b0, metalness: 0.95, roughness: 0.18 });
  dome(g, { r: 1.7, material: shell });
  g.add(box(0.9, 0.7, 0.5, mat.dark(), { pos: [0, 0.35, 1.6] }));
  g.add(box(0.6, 0.45, 0.05, mat.glow(0x30e0d0, 2), { pos: [0, 0.35, 1.86], shadow: false }));
  // pas swiecacy wokol kopuly
  g.add(mesh(new THREE.TorusGeometry(1.45, 0.04, 8, 64), mat.glow(0x30e0d0, 4), { pos: [0, 0.75, 0], rot: [Math.PI / 2, 0, 0], shadow: false }));
  // roj nanorobotow (punkty swiatla) nad kopula
  const geos = [];
  for (let i = 0; i < 260; i++) {
    const a = r.range(0, Math.PI * 2), rad = r.range(0.4, 2.6), y = r.range(1.6, 3.4);
    const gg = new THREE.SphereGeometry(r.range(0.015, 0.035), 6, 4);
    gg.translate(Math.cos(a) * rad * (1 - (y - 1.6) / 4), y, Math.sin(a) * rad * (1 - (y - 1.6) / 4));
    geos.push(gg);
  }
  const swarm = new THREE.Mesh(mergeGeometries(geos), mat.glow(0x40ffe8, 5));
  swarm.userData.fx = true;
  g.add(swarm);
  for (const [x, z] of [[-2.3, 0.6], [2.2, -0.4]]) g.add(cyl(0.4, 0.4, 1.2, shell, { pos: [x, 0.6, z] }, 24));
}

function shipyard(g, r) {
  const hm = hullMaterial('sy', { base: [104, 108, 114], accent: '220,160,30', panel: 44 });
  // plyta doku i suwnica bramowa
  g.add(box(5.6, 0.2, 2.8, mat.concrete(), { pos: [0, 0.1, 0] }));
  const yellow = mat.paint(0xc89018, 0.7);
  for (const x of [-2.4, 2.4]) {
    for (const z of [-1.3, 1.3]) g.add(box(0.25, 3.2, 0.25, yellow, { pos: [x, 1.7, z] }));
    g.add(box(0.3, 0.3, 2.9, yellow, { pos: [x, 3.3, 0] }));
  }
  g.add(box(5.2, 0.35, 0.35, yellow, { pos: [0, 3.35, -1.2] }));
  g.add(box(5.2, 0.35, 0.35, yellow, { pos: [0, 3.35, 1.2] }));
  g.add(box(0.7, 0.4, 2.6, mat.gunmetal(), { pos: [0.6, 3.1, 0] }));
  g.add(cyl(0.02, 0.02, 1.4, mat.steel(), { pos: [0.6, 2.25, 0] }, 6));
  // kadlub statku w budowie (czesciowo odsloniety szkielet)
  const hull = loft([
    { x: -2.0, w: 1.6, top: 0.55, bot: 0.45, k: 0.75 },
    { x: 0.6, w: 1.5, top: 0.6, bot: 0.45, k: 0.7 },
    { x: 2.1, w: 0.2, top: 0.1, bot: 0.08, k: 0.6 },
  ], hm, { pos: [0, 0.95, 0] });
  g.add(hull);
  for (let i = -1.8; i <= -0.2; i += 0.32) {
    g.add(mesh(new THREE.TorusGeometry(0.62, 0.04, 6, 16, Math.PI), mat.steel(), { pos: [i - 0.6, 1.0, 0], rot: [0, Math.PI / 2, 0] }));
  }
  // iskry spawania
  for (const [x, y, z] of [[0.6, 1.6, 0.3], [-1.2, 1.5, -0.5]]) {
    const sp = glowSprite('180,220,255', 0.7, 1);
    sp.position.set(x, y, z);
    g.add(sp);
  }
  beacon(g, { x: 2.4, y: 3.6, z: 1.3 });
  beacon(g, { x: -2.4, y: 3.6, z: -1.3 });
}

function storage(kind) {
  return (g, r) => {
    const hm = hullMaterial('st' + kind, { base: [108, 110, 114], accent: kind === 'metal' ? '200,150,40' : kind === 'crystal' ? '40,120,210' : '40,170,90', panel: 44 });
    if (kind === 'tritium') {
      for (const [x, z, rr] of [[-1.4, 0, 1.0], [0.9, -0.8, 0.8], [1.2, 1.2, 0.65]]) {
        g.add(sphere(rr, hm, { pos: [x, rr + 0.4, z] }, 32));
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          g.add(cyl(0.05, 0.05, rr + 0.4, mat.steel(), { pos: [x + Math.cos(a) * rr * 0.75, (rr + 0.4) / 2, z + Math.sin(a) * rr * 0.75] }, 8));
        }
        g.add(mesh(new THREE.TorusGeometry(rr * 1.01, 0.035, 8, 48), mat.glow(0x30ff8a, 2.2), { pos: [x, rr + 0.4, z], rot: [Math.PI / 2, 0, 0], shadow: false }));
      }
      return;
    }
    // silosy i magazyn
    const siloMat = kind === 'crystal'
      ? new THREE.MeshPhysicalMaterial({ color: 0x3a80c0, emissive: 0x2060a0, emissiveIntensity: 0.5, metalness: 0.2, roughness: 0.15, clearcoat: 1 })
      : hm;
    for (let i = 0; i < 4; i++) {
      const x = -1.8 + i * 1.05;
      g.add(cyl(0.48, 0.48, 2.4, siloMat, { pos: [x, 1.2, -0.8] }, 32));
      g.add(sphere(0.48, hm, { pos: [x, 2.4, -0.8], scale: [1, 0.35, 1] }, 24));
      for (let k = 0.3; k < 2.3; k += 0.45) g.add(cyl(0.5, 0.5, 0.05, mat.dark(), { pos: [x, k, -0.8] }, 32));
    }
    g.add(box(4.2, 0.12, 0.4, dark(), { pos: [-0.2, 2.75, -0.8] }));
    hall(g, r, { x: 0.2, z: 1.0, w: 3.2, h: 1.0, d: 1.4, material: hm });
    if (kind === 'crystal') crystals(g, r, { x: 2.3, z: 0.6, n: 4, scale: 0.6 });
  };
}

function researchLab(g, r) {
  const hm = hullMaterial('rl', { base: [150, 154, 160], accent: '40,120,210', panel: 44 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x80c8ff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.45,
    emissive: 0x2a70c0, emissiveIntensity: 0.6, clearcoat: 1 });
  g.add(cyl(1.6, 1.7, 0.8, hm, { pos: [0, 0.4, 0] }, 48));
  dome(g, { r: 1.45, material: glass, y: 0.8, ring: false });
  g.add(sphere(0.35, mat.glow(0x60c0ff, 3), { pos: [0, 1.4, 0], shadow: false }, 24));
  // talerz radioteleskopu
  const dish = new THREE.Group();
  dish.add(mesh(new THREE.SphereGeometry(1.0, 32, 16, 0, Math.PI * 2, 0, 0.9), mat.steel(), { rot: [Math.PI, 0, 0] }));
  dish.add(cyl(0.02, 0.02, 0.9, mat.steel(), { pos: [0, -0.5, 0] }, 6));
  dish.position.set(2.4, 2.4, -0.6);
  dish.rotation.set(0.7, 0, -0.5);
  g.add(dish);
  g.add(cyl(0.12, 0.2, 2.2, mat.concrete(), { pos: [2.4, 1.1, -0.6] }, 12));
  hullLights(r, g, { x0: -1.4, x1: 1.4, at: () => [1.62, 0.25, 0.65], count: 20, color: 0xbfe0ff, intensity: 2.5 });
  for (const [x, z] of [[-2.2, 0.8], [-2.0, -1.0]]) g.add(cyl(0.02, 0.02, 1.8, mat.steel(), { pos: [x, 0.9, z] }, 6));
  beacon(g, { x: -2.2, y: 1.85, z: 0.8 });
}

function terraformer(g, r) {
  const hm = hullMaterial('tf', { base: [96, 100, 104], accent: '60,160,110', panel: 56 });
  // ogromny procesor atmosferyczny
  const geo = new THREE.LatheGeometry([[1.8, 0], [1.6, 1.2], [1.0, 2.2], [0.8, 4.2], [1.0, 4.8], [0.7, 5.4], [0.0, 5.5]].map(([w, h]) => new THREE.Vector2(w, h)), 12);
  g.add(mesh(geo, hm));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    g.add(box(0.35, 2.4, 0.35, hm, { pos: [Math.cos(a) * 1.5, 1.2, Math.sin(a) * 1.5], rot: [0, -a, Math.cos(a) * 0.1] }));
  }
  hullLights(r, g, { x0: -0.6, x1: 0.6, at: () => [0.82, 2.4, 4.2], count: 24, intensity: 3 });
  // kolumny pary / chmur wydobywajace sie z gory
  const cloud = new THREE.MeshStandardMaterial({ color: 0xc8d4dc, transparent: true, opacity: 0.35, roughness: 1, depthWrite: false });
  for (let i = 0; i < 14; i++) {
    const s = r.range(0.4, 1.1) * (1 + i * 0.08);
    const c = sphere(s, cloud, { pos: [r.range(-0.4, 0.4) + i * 0.08, 5.6 + i * 0.32, r.range(-0.4, 0.4)], shadow: false }, 16);
    c.userData.fx = true;
    g.add(c);
  }
  g.add(sphere(0.2, mat.glow(0x40ff90, 5), { pos: [0, 5.4, 0], shadow: false }, 12));
  // zielone poletka u podstawy (terraformowany grunt)
  g.add(cyl(2.8, 2.8, 0.03, new THREE.MeshStandardMaterial({ color: 0x3a5a30, roughness: 1 }), { pos: [0, 0.01, 0] }, 48));
}

function tradeCenter(g, r) {
  const hm = hullMaterial('tc', { base: [150, 146, 136], accent: '220,170,60', panel: 50 });
  // wysoka wieza z platformami ladowniczymi
  const tower = new THREE.LatheGeometry([[1.2, 0], [1.0, 1], [0.6, 2], [0.55, 4.5], [0.75, 5], [0.3, 5.6], [0, 6.0]].map(([w, h]) => new THREE.Vector2(w, h)), 8);
  g.add(mesh(tower, hm));
  for (const [y, a] of [[2.6, 0.4], [3.6, 2.5], [4.4, 4.4]]) {
    const pad = new THREE.Group();
    pad.add(cyl(0.8, 0.8, 0.1, mat.gunmetal(), { pos: [1.2, 0, 0] }, 24));
    pad.add(box(1.0, 0.12, 0.3, hm, { pos: [0.5, 0, 0] }));
    pad.add(mesh(new THREE.TorusGeometry(0.7, 0.02, 6, 32), mat.glow(0xffc040, 3), { pos: [1.2, 0.06, 0], rot: [Math.PI / 2, 0, 0], shadow: false }));
    pad.position.y = y;
    pad.rotation.y = a;
    g.add(pad);
  }
  hullLights(r, g, { x0: -0.4, x1: 0.4, at: () => [0.57, 2.2, 4.4], count: 40, intensity: 3, color: 0xffd080 });
  g.add(mesh(new THREE.TorusGeometry(0.76, 0.05, 8, 32), mat.gold(), { pos: [0, 5.0, 0], rot: [Math.PI / 2, 0, 0] }));
  beacon(g, { x: 0, y: 6.05, z: 0, color: 0xffc040 });
  // maly frachtowiec przy platformie
  const ship = loft([{ x: -0.5, w: 0.4, top: 0.15, bot: 0.12 }, { x: 0.5, w: 0.1, top: 0.05, bot: 0.04 }], hm);
  ship.position.set(Math.cos(0.4) * 1.2, 2.75, -Math.sin(0.4) * 1.2);
  g.add(ship);
}

function warAcademy(g, r) {
  const hm = hullMaterial('wa', { base: [86, 88, 92], accent: '160,30,30', panel: 50 });
  // twierdza: bryla z fazowanymi scianami i wieze narozne
  g.add(loft([
    { x: -2.0, w: 3.4, top: 1.4, bot: 0.001, k: 0.82, kb: 1 },
    { x: 2.0, w: 3.4, top: 1.4, bot: 0.001, k: 0.82, kb: 1 },
  ], hm));
  for (const [x, z] of [[-2, -1.7], [2, -1.7], [-2, 1.7], [2, 1.7]]) {
    g.add(cyl(0.45, 0.55, 2.2, hm, { pos: [x, 1.1, z] }, 8));
    g.add(cyl(0.6, 0.45, 0.25, mat.dark(), { pos: [x, 2.3, z] }, 8));
    g.add(sphere(0.05, mat.glow(0xff3020, 8), { pos: [x, 2.5, z], shadow: false }, 8));
  }
  // czerwone sztandary
  for (const x of [-0.8, 0.8]) {
    g.add(cyl(0.02, 0.02, 1.4, mat.steel(), { pos: [x, 2.1, 1.5] }, 6));
    g.add(box(0.5, 0.8, 0.02, mat.paint(0x9a1a1a, 0.8), { pos: [x + 0.26, 2.35, 1.5] }));
  }
  g.add(box(1.4, 0.9, 0.06, mat.dark(), { pos: [0, 0.45, 1.72] }));
  g.add(box(1.2, 0.05, 0.08, mat.glow(0xff5030, 3), { pos: [0, 0.95, 1.72], shadow: false }));
  hullLights(r, g, { x0: -1.8, x1: 1.8, at: () => [1.62, 0.6, 1.2], count: 26, intensity: 2.6, color: 0xffb080 });
  // plac cwiczen z mysliwcem
  g.add(box(2.4, 0.03, 1.6, mat.paint(0x2a2c30), { pos: [3.8, 0.02, 0.6] }));
}

function missileSilo(g, r) {
  const hm = hullMaterial('ms', { base: [92, 96, 90], accent: '220,170,30', panel: 40 });
  g.add(box(5.0, 0.4, 3.0, mat.concrete(), { pos: [0, 0.2, 0] }));
  // szesc wlazow: dwa otwarte z wystajacymi rakietami
  let k = 0;
  for (let i = -1; i <= 1; i++) {
    for (const z of [-0.7, 0.7]) {
      const x = i * 1.5;
      g.add(cyl(0.5, 0.5, 0.42, mat.dark(), { pos: [x, 0.22, z] }, 24));
      if (k === 1 || k === 4) {
        g.add(cyl(0.26, 0.26, 1.2, mat.paint(0xd8d8da, 0.35), { pos: [x, 0.8, z] }, 24));
        g.add(mesh(new THREE.ConeGeometry(0.26, 0.5, 24), mat.paint(0xe07020, 0.35), { pos: [x, 1.65, z] }));
        g.add(box(1.0, 0.08, 0.5, hm, { pos: [x + 0.6, 0.6, z], rot: [0, 0, 1.2] }));
      } else {
        g.add(cyl(0.52, 0.52, 0.08, hm, { pos: [x, 0.46, z] }, 24));
      }
      k++;
    }
  }
  for (let i = -2.3; i < 2.4; i += 0.5) g.add(box(0.25, 0.02, 0.15, mat.paint(0xe0b020), { pos: [i, 0.41, 1.35] }));
  g.add(box(1.0, 0.8, 0.7, hm, { pos: [-2.0, 0.8, -1.1] }));
  beacon(g, { x: -2.0, y: 1.3, z: -1.1 });
}

function lunarBase(g, r) {
  const hm = hullMaterial('lb', { base: [132, 130, 124], panel: 40 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xb0d8ff, roughness: 0.05, transparent: true, opacity: 0.5, emissive: 0xffd8a0,
    emissiveIntensity: 0.4, clearcoat: 1 });
  dome(g, { x: 0, z: 0, r: 1.5, material: hm });
  dome(g, { x: 2.4, z: 0.8, r: 0.9, material: glass });
  dome(g, { x: -2.2, z: 0.9, r: 0.8, material: hm });
  dome(g, { x: 0.6, z: -2.2, r: 0.7, material: glass });
  // korytarze laczace
  for (const [a, b] of [[[0, 0.35, 0], [2.4, 0.35, 0.8]], [[0, 0.35, 0], [-2.2, 0.35, 0.9]], [[0, 0.35, 0], [0.6, 0.35, -2.2]]]) {
    pipe(g, a, b, { r: 0.25, material: hm });
  }
  hullLights(r, g, { x0: -1.2, x1: 1.2, at: () => [1.48, 0.3, 0.6], count: 14, intensity: 2.5 });
  // ladowisko
  g.add(cyl(1.0, 1.0, 0.05, mat.gunmetal(), { pos: [-1.2, 0.03, -1.9] }, 32));
  g.add(mesh(new THREE.TorusGeometry(0.9, 0.03, 6, 32), mat.glow(0x60c0ff, 3), { pos: [-1.2, 0.06, -1.9], rot: [Math.PI / 2, 0, 0], shadow: false }));
  g.add(cyl(0.02, 0.02, 1.6, mat.steel(), { pos: [1.2, 1.9, -0.3] }, 6));
  beacon(g, { x: 1.2, y: 2.7, z: -0.3 });
}

function sensorPhalanx(g, r) {
  const hm = hullMaterial('sp', { base: [150, 150, 150], panel: 40 });
  g.add(cyl(1.0, 1.3, 0.6, hm, { pos: [0, 0.3, 0] }, 8));
  g.add(cyl(0.25, 0.35, 2.0, hm, { pos: [0, 1.6, 0] }, 12));
  // wielka antena paraboliczna z zasilaczem
  const dish = new THREE.Group();
  dish.add(mesh(new THREE.SphereGeometry(2.0, 48, 16, 0, Math.PI * 2, 0, 0.75), new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide }), { rot: [Math.PI, 0, 0] }));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    pipe(dish, [Math.cos(a) * 1.3, -0.6, Math.sin(a) * 1.3], [0, -1.8, 0], { r: 0.03 });
  }
  dish.add(sphere(0.15, mat.glow(0x40ff90, 6), { pos: [0, -1.85, 0], shadow: false }));
  dish.position.set(0, 3.6, 0);
  dish.rotation.set(-0.9, 0.7, 0);
  g.add(dish);
  // mniejsze anteny i linie skanu
  for (const [x, z] of [[1.8, 1.0], [-1.6, 1.2]]) {
    g.add(cyl(0.05, 0.08, 1.2, mat.steel(), { pos: [x, 0.6, z] }, 8));
    g.add(mesh(new THREE.SphereGeometry(0.45, 24, 8, 0, Math.PI * 2, 0, 0.7), mat.steel(), { pos: [x, 1.3, z], rot: [2.6, 0, 0.3] }));
  }
  for (let k = 1; k <= 3; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(k * 1.1, 0.01, 6, 96), new THREE.MeshBasicMaterial({ color: 0x40ff90,
      transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    ring.userData.fx = true;
    g.add(ring);
  }
}

function jumpGate(g, r) {
  const hm = hullMaterial('jg', { base: [120, 122, 130], accent: '120,60,200', panel: 40 });
  // pierscien bramy na podporach
  const ring = mesh(new THREE.TorusGeometry(2.0, 0.28, 16, 96), hm, { pos: [0, 2.6, 0] });
  g.add(ring);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.add(box(0.5, 0.35, 0.7, hm, { pos: [Math.cos(a) * 2.0, 2.6 + Math.sin(a) * 2.0, 0], rot: [0, 0, a] }));
  }
  for (const s of [1, -1]) {
    g.add(box(0.6, 1.2, 1.0, hm, { pos: [s * 1.5, 0.6, 0], rot: [0, 0, s * -0.3] }));
  }
  // portal: wirujaca energia
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(256, 256, 10, 256, 256, 256);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(180,140,255,0.9)');
  gr.addColorStop(0.7, 'rgba(90,40,200,0.6)');
  gr.addColorStop(1, 'rgba(40,10,120,0.2)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 512, 512);
  x.strokeStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 40; i++) {
    x.lineWidth = r.range(1, 4);
    x.beginPath();
    const a0 = r.range(0, Math.PI * 2);
    x.arc(256, 256, r.range(40, 250), a0, a0 + r.range(0.5, 2));
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const portal = new THREE.Mesh(new THREE.CircleGeometry(1.8, 64), new THREE.MeshBasicMaterial({ map: t, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  portal.position.set(0, 2.6, 0);
  portal.userData.fx = true;
  g.add(portal);
  const sp = glowSprite('170,120,255', 6, 0.5);
  sp.position.set(0, 2.6, 0.2);
  g.add(sp);
  g.add(cyl(2.4, 2.6, 0.2, mat.concrete(), { pos: [0, 0.1, 0] }, 48));
}

export const items = {
  metal_mine: surfaceShot('metal_mine', metalMine, { ground: [104, 82, 66] }),
  crystal_mine: surfaceShot('crystal_mine', crystalMine, { ground: [84, 86, 96], sky: ['#0e1c34', '#3a6aa0'] }),
  tritium_synthesizer: surfaceShot('tritium_synthesizer', tritiumSynth, { ground: [86, 92, 84], sky: ['#0e2420', '#3a8a70'] }),
  solar_plant: surfaceShot('solar_plant', solarPlant, { ground: [112, 92, 70], sky: ['#1a2a44', '#e0904a'] }),
  fusion_plant: surfaceShot('fusion_plant', fusionPlant, { ground: [96, 86, 78] }),
  robotics_factory: surfaceShot('robotics_factory', roboticsFactory, { ground: [96, 88, 80] }),
  nanite_factory: surfaceShot('nanite_factory', naniteFactory, { ground: [82, 88, 92], sky: ['#0a1c24', '#2a7a80'] }),
  shipyard: surfaceShot('shipyard', shipyard, { ground: [92, 86, 80] }),
  metal_storage: surfaceShot('metal_storage', storage('metal'), { ground: [100, 86, 72] }),
  crystal_storage: surfaceShot('crystal_storage', storage('crystal'), { ground: [84, 86, 96], sky: ['#0e1c34', '#3a6aa0'] }),
  tritium_tank: surfaceShot('tritium_tank', storage('tritium'), { ground: [86, 92, 84], sky: ['#0e2420', '#3a8a70'] }),
  research_lab: surfaceShot('research_lab', researchLab, { ground: [90, 88, 92], sky: ['#0e1c34', '#3a6aa0'] }),
  terraformer: surfaceShot('terraformer', terraformer, { ground: [100, 88, 74], dir: [0.9, 0.3, 1.2] }),
  trade_center: surfaceShot('trade_center', tradeCenter, { ground: [104, 92, 76], sky: ['#1a2440', '#d08a40'], dir: [0.9, 0.3, 1.2] }),
  war_academy: surfaceShot('war_academy', warAcademy, { ground: [96, 80, 72], sky: ['#1a1428', '#a03a2a'] }),
  missile_silo: surfaceShot('missile_silo', missileSilo, { ground: [96, 90, 80] }),
  lunar_base: surfaceShot('lunar_base', lunarBase, { moon: true }),
  sensor_phalanx: surfaceShot('sensor_phalanx', sensorPhalanx, { moon: true }),
  jump_gate: surfaceShot('jump_gate', jumpGate, { moon: true, dir: [0.7, 0.3, 1.2] }),
};
