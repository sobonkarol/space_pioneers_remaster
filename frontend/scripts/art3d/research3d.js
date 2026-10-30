// Badania: urzadzenia eksperymentalne w laboratorium.
import { THREE, hullMaterial, mat, box, cyl, sphere, loft, greebles, glowSprite, exhaust, mesh, mergeGeometries } from './lib3d.js';
import { labShot, holoRing, beam } from './scenes.js';

function laser(g, r) {
  const hm = hullMaterial('lt', { base: [70, 74, 82], panel: 30 });
  // emiter z zwojnicami chlodzenia
  g.add(cyl(0.55, 0.65, 0.4, hm, { pos: [-1.6, 0.2, 0] }));
  const em = new THREE.Group();
  em.add(cyl(0.32, 0.38, 2.2, hm, { rot: [0, 0, Math.PI / 2] }));
  for (let i = -0.8; i <= 0.8; i += 0.2) em.add(cyl(0.4, 0.4, 0.05, mat.copper(), { pos: [i, 0, 0], rot: [0, 0, Math.PI / 2] }));
  em.add(cyl(0.2, 0.32, 0.4, mat.steel(), { pos: [1.3, 0, 0], rot: [0, 0, Math.PI / 2] }));
  em.add(sphere(0.14, mat.glow(0xff2a20, 12), { pos: [1.5, 0, 0], shadow: false }));
  em.position.set(-1.4, 1.0, 0);
  g.add(em);
  // krysztal ogniskujacy w uchwycie
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshPhysicalMaterial({ color: 0xff8080,
    emissive: 0xff2020, emissiveIntensity: 1.2, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.85, clearcoat: 1 }));
  crystal.position.set(1.0, 1.0, 0);
  crystal.scale.set(1, 1.5, 1);
  g.add(crystal);
  for (const a of [0, 2.1, 4.2]) {
    g.add(cyl(0.025, 0.025, 1.0, mat.steel(), { pos: [1.0 + Math.cos(a) * 0.4, 0.5, Math.sin(a) * 0.4] }, 8));
  }
  g.add(cyl(0.5, 0.6, 0.15, hm, { pos: [1.0, 0.07, 0] }));
  // wiazki
  beam(g, { from: [0.1, 1.0, 0], to: [0.75, 1.0, 0], color: 0xff2a20, r: 0.03 });
  beam(g, { from: [1.25, 1.0, 0], to: [4.5, 1.0, 0], color: 0xff2a20, r: 0.045 });
  const sp = glowSprite('255,60,40', 1.6, 0.9);
  sp.position.set(1.0, 1.0, 0);
  g.add(sp);
  // konsola
  g.add(box(0.8, 0.9, 0.5, hm, { pos: [-0.2, 0.45, 1.4], rot: [0, 0.3, 0] }));
  g.add(box(0.7, 0.4, 0.04, mat.glow(0x3ab0ff, 1.5), { pos: [-0.17, 0.95, 1.18], rot: [-0.5, 0.3, 0], shadow: false }));
  holoRing(g, { r: 2.4, y: 0.02, color: 0xff4030, tube: 0.015 });
}

// ---------- pozostale technologie ----------
/** Mniejsza, delikatniejsza poswiata - przy bloomie duze sprite'y przepalaja kadr. */
/** Przygaszony plomien/strumien. */
function jet(color, length, radius) {
  const m = exhaust(color, length, radius);
  m.material.opacity = 0.5;
  return m;
}

function halo(color, scale, opacity = 1) {
  return glowSprite(color, scale * 0.4, opacity * 0.45);
}

/** Postument laboratoryjny pod eksponatem. */
function pedestal(g, hm, { r = 1.2, h = 0.4 } = {}) {
  g.add(cyl(r, r * 1.1, h, hm, { pos: [0, h / 2, 0] }, 32));
  g.add(cyl(r * 0.85, r * 0.85, 0.04, mat.dark(), { pos: [0, h + 0.02, 0] }, 32));
}

/** Luk elektryczny: lamana linia z emisyjnych odcinkow. */
function arc(g, r, a, b, { color = 0x9fd8ff, segments = 10, jitter = 0.15 } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const p = A.clone().lerp(B, i / segments);
    if (i > 0 && i < segments) p.add(new THREE.Vector3(r.range(-jitter, jitter), r.range(-jitter, jitter), r.range(-jitter, jitter)));
    pts.push(p);
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.012, 6, false);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3) }));
  m.userData.fx = true;
  g.add(m);
}

function energy(g, r) {
  const hm = hullMaterial('en', { base: [80, 84, 92], panel: 30 });
  pedestal(g, hm);
  // ogniwo energetyczne w klatce z kondensatorami
  const cell = cyl(0.35, 0.35, 1.4, new THREE.MeshPhysicalMaterial({ color: 0xffd040, emissive: 0xffb020, emissiveIntensity: 1.2,
    transparent: true, opacity: 0.85, roughness: 0.1 }), { pos: [0, 1.15, 0] }, 32);
  g.add(cell);
  for (const y of [0.42, 1.88]) g.add(cyl(0.45, 0.45, 0.12, hm, { pos: [0, y, 0] }, 32));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    g.add(cyl(0.035, 0.035, 1.5, mat.copper(), { pos: [Math.cos(a) * 0.55, 1.15, Math.sin(a) * 0.55] }, 8));
  }
  for (const [x, z] of [[-1.6, 0.4], [1.6, -0.3]]) {
    g.add(cyl(0.25, 0.25, 1.2, hm, { pos: [x, 0.6, z] }, 16));
    g.add(sphere(0.12, mat.steel(), { pos: [x, 1.3, z] }));
    arc(g, r, [x, 1.3, z], [0, 1.3, 0], { color: 0xffe080 });
  }
  const sp = halo('255,210,90', 2.4, 0.8);
  sp.position.set(0, 1.15, 0);
  g.add(sp);
}

function ion(g, r) {
  const hm = hullMaterial('ion', { base: [90, 96, 108], panel: 30 });
  pedestal(g, hm, { r: 1.0 });
  // silnik jonowy: siatka emisyjna i strumien niebieskich czastek
  const body = new THREE.Group();
  body.add(cyl(0.7, 0.8, 1.0, hm, { rot: [0, 0, Math.PI / 2] }, 32));
  body.add(cyl(0.62, 0.62, 0.04, mat.glow(0x4ab8ff, 4), { pos: [0.52, 0, 0], rot: [0, 0, Math.PI / 2], shadow: false }, 32));
  for (let k = -0.5; k <= 0.5; k += 0.2) {
    body.add(box(0.05, 1.2, 0.02, mat.dark(), { pos: [0.55, 0, k] }));
    body.add(box(0.05, 0.02, 1.2, mat.dark(), { pos: [0.55, k, 0] }));
  }
  body.position.set(-0.4, 1.3, 0);
  g.add(body);
  const fl = jet('80,170,255', 3.5, 0.55);
  fl.rotation.y = Math.PI;
  fl.position.set(0.15, 1.3, 0);
  g.add(fl);
  const geos = [];
  for (let i = 0; i < 160; i++) {
    const x = r.range(0.2, 3.5), spread = 0.1 + x * 0.12;
    const gg = new THREE.SphereGeometry(r.range(0.01, 0.025), 6, 4);
    gg.translate(x, 1.3 + r.range(-spread, spread), r.range(-spread, spread));
    geos.push(gg);
  }
  const p = new THREE.Mesh(mergeGeometries(geos), mat.glow(0x8fd0ff, 2.5));
  p.userData.fx = true;
  g.add(p);
}

function hyperspace(g, r) {
  const hm = hullMaterial('hs', { base: [70, 70, 84], panel: 30 });
  pedestal(g, hm, { r: 1.3 });
  // zakrzywienie przestrzeni: ciemna kula w pierscieniach z poswiata
  g.add(sphere(0.55, new THREE.MeshPhysicalMaterial({ color: 0x050010, roughness: 0, metalness: 1, clearcoat: 1 }), { pos: [0, 1.6, 0] }, 48));
  const sp = halo('160,90,255', 3.2, 0.8);
  sp.position.set(0, 1.6, 0);
  g.add(sp);
  for (let k = 0; k < 4; k++) {
    const t = mesh(new THREE.TorusGeometry(0.8 + k * 0.22, 0.02, 8, 96), mat.glow(k % 2 ? 0xb080ff : 0x6040ff, 4),
      { pos: [0, 1.6, 0], rot: [Math.PI / 2 + r.range(-0.6, 0.6), r.range(-0.6, 0.6), 0], shadow: false });
    t.userData.fx = true;
    g.add(t);
  }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    g.add(cyl(0.06, 0.1, 1.6, hm, { pos: [Math.cos(a) * 1.0, 0.9, Math.sin(a) * 1.0], rot: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3] }, 10));
  }
}

function plasma(g, r) {
  const hm = hullMaterial('pl', { base: [76, 72, 88], panel: 30 });
  pedestal(g, hm, { r: 1.4 });
  // pulapka magnetyczna z torusem plazmy
  const core = mesh(new THREE.TorusGeometry(0.8, 0.22, 24, 96), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xd060ff,
    emissiveIntensity: 2.2 }), { pos: [0, 1.4, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
  core.userData.fx = true;
  g.add(core);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    g.add(mesh(new THREE.TorusGeometry(0.34, 0.07, 10, 24), hm, { pos: [Math.cos(a) * 0.8, 1.4, Math.sin(a) * 0.8], rot: [0, -a, 0] }));
  }
  const sp = halo('210,120,255', 3, 0.7);
  sp.position.set(0, 1.4, 0);
  g.add(sp);
  for (let k = 0; k < 4; k++) arc(g, r, [0, 1.4, 0], [Math.cos(k * 1.6) * 0.75, 1.4 + r.range(-0.2, 0.2), Math.sin(k * 1.6) * 0.75],
    { color: 0xe0a0ff, segments: 8, jitter: 0.08 });
}

function testStand(g, hm) {
  // stanowisko testowe silnika: rama i podstawa
  g.add(box(3.0, 0.3, 1.6, mat.concrete(), { pos: [0, 0.15, 0] }));
  for (const x of [-1.2, 0.4]) for (const z of [-0.6, 0.6]) g.add(box(0.12, 1.6, 0.12, hm, { pos: [x, 1.0, z] }));
  g.add(box(1.8, 0.12, 1.3, hm, { pos: [-0.4, 1.75, 0] }));
}

function drive(kind) {
  return (g, r) => {
    const hm = hullMaterial('dr' + kind, { base: [96, 98, 104], accent: kind === 'combustion' ? '220,120,40' : kind === 'impulse' ? '60,140,220' : '140,80,220', panel: 30 });
    testStand(g, mat.gunmetal());
    const eng = new THREE.Group();
    if (kind === 'combustion') {
      eng.add(cyl(0.45, 0.45, 1.4, hm, { rot: [0, 0, Math.PI / 2] }, 32));
      const bell = new THREE.LatheGeometry([[0.25, 0], [0.3, 0.2], [0.5, 0.6], [0.7, 0.9]].map(([w, h]) => new THREE.Vector2(w, h)), 32);
      bell.rotateZ(Math.PI / 2);
      eng.add(mesh(bell, mat.copper(), { pos: [0.7, 0, 0] }));
      for (let k = 0; k < 6; k++) eng.add(cyl(0.03, 0.03, 1.4, mat.steel(), { pos: [0, Math.cos(k) * 0.48, Math.sin(k) * 0.48], rot: [0, 0, Math.PI / 2] }, 6));
      const fl = jet('255,150,60', 3.2, 0.6);
      fl.rotation.y = Math.PI;
      fl.position.set(1.6, 0, 0);
      eng.add(fl);
      const sp = halo('255,160,70', 2.2, 0.8);
      sp.position.set(1.7, 0, 0);
      eng.add(sp);
    } else {
      const color = kind === 'impulse' ? 0x4ab0ff : 0xb070ff;
      const cs = kind === 'impulse' ? '80,170,255' : '180,120,255';
      eng.add(loft([{ x: -0.8, w: 0.9, top: 0.45, bot: 0.45, k: 0.75, kb: 0.75 }, { x: 0.6, w: 1.0, top: 0.5, bot: 0.5, k: 0.75, kb: 0.75 },
        { x: 0.9, w: 0.8, top: 0.4, bot: 0.4, k: 0.7, kb: 0.7 }], hm));
      const rings = kind === 'impulse' ? 3 : 5;
      for (let k = 0; k < rings; k++) {
        eng.add(mesh(new THREE.TorusGeometry(0.55 + (kind === 'impulse' ? 0 : k * 0.04), 0.05, 10, 48), mat.glow(color, 3.5),
          { pos: [-0.5 + k * (1.2 / rings), 0, 0], rot: [0, Math.PI / 2, 0], shadow: false }));
      }
      eng.add(cyl(0.35, 0.35, 0.05, mat.glow(color, 6), { pos: [0.93, 0, 0], rot: [0, 0, Math.PI / 2], shadow: false }, 32));
      const fl = jet(cs, kind === 'impulse' ? 2.6 : 3.2, 0.32);
      fl.rotation.y = Math.PI;
      fl.position.set(0.95, 0, 0);
      eng.add(fl);
      const sp = halo(cs, 1.8, 0.8);
      sp.position.set(1.0, 0, 0);
      eng.add(sp);
      if (kind === 'hyperspace') {
        for (let k = 0; k < 2; k++) {
          const t = mesh(new THREE.TorusGeometry(1.0 + k * 0.25, 0.015, 6, 96), mat.glow(0xc090ff, 4),
            { pos: [0.1, 0, 0], rot: [k * 0.8, Math.PI / 2 + 0.3, 0], shadow: false });
          t.userData.fx = true;
          eng.add(t);
        }
      }
    }
    eng.position.set(-0.4, 1.05, 0);
    g.add(eng);
  };
}

function espionage(g, r) {
  const hm = hullMaterial('es', { base: [60, 64, 70], panel: 26 });
  pedestal(g, hm, { r: 0.9 });
  // dron zwiadowczy unoszacy sie nad postumentem i stozek skanowania
  const drone = new THREE.Group();
  drone.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), hm));
  drone.add(sphere(0.1, mat.glow(0x40ff90, 8), { pos: [0.28, 0, 0], shadow: false }));
  for (const s of [1, -1]) drone.add(box(0.5, 0.02, 0.3, mat.dark(), { pos: [0, 0, s * 0.45] }));
  drone.position.set(0, 1.9, 0);
  g.add(drone);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.4, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x2aff80,
    transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.set(0, 1.15, 0);
  cone.userData.fx = true;
  g.add(cone);
  // hologram planety z siatka namiaru
  const holo = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16), new THREE.MeshBasicMaterial({ color: 0x40ff90, wireframe: true,
    transparent: true, opacity: 0.7 }));
  holo.position.set(0, 0.85, 0);
  holo.userData.fx = true;
  g.add(holo);
}

function computer(g, r) {
  const hm = hullMaterial('ct', { base: [52, 56, 64], panel: 26 });
  // rzedy szaf serwerowych z diodami i rdzen kwantowy
  for (const z of [-1.0, 1.0]) {
    for (let i = 0; i < 4; i++) {
      const x = -1.5 + i * 0.75;
      g.add(box(0.65, 2.0, 0.6, hm, { pos: [x, 1.0, z] }));
      const geos = [];
      for (let k = 0; k < 24; k++) {
        const gg = new THREE.BoxGeometry(0.04, 0.03, 0.01);
        gg.translate(x + r.range(-0.25, 0.25), r.range(0.2, 1.85), z - Math.sign(z) * 0.305);
        geos.push(gg);
      }
      const leds = new THREE.Mesh(mergeGeometries(geos), mat.glow(r() < 0.5 ? 0x40c0ff : 0x40ff90, 5));
      leds.userData.fx = true;
      g.add(leds);
    }
  }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshPhysicalMaterial({ color: 0x60b0ff,
    emissive: 0x2a80ff, emissiveIntensity: 1, transparent: true, opacity: 0.8, flatShading: true, roughness: 0.1 }));
  core.position.set(1.8, 1.2, 0);
  g.add(core);
  g.add(cyl(0.3, 0.45, 0.6, hm, { pos: [1.8, 0.3, 0] }, 16));
  const sp = halo('80,160,255', 2, 0.7);
  sp.position.set(1.8, 1.2, 0);
  g.add(sp);
}

function astrophysics(g, r) {
  const hm = hullMaterial('as', { base: [110, 112, 118], panel: 30 });
  pedestal(g, hm, { r: 1.6, h: 0.3 });
  // hologram ukladu planetarnego
  g.add(sphere(0.3, mat.glow(0xffd070, 5), { pos: [0, 1.4, 0], shadow: false }));
  const sp = halo('255,210,120', 1.6, 0.8);
  sp.position.set(0, 1.4, 0);
  g.add(sp);
  const cols = [0x80b0ff, 0xd08050, 0x60d0a0, 0xc0c0ff];
  for (let k = 0; k < 4; k++) {
    const rad = 0.6 + k * 0.35;
    const orbit = mesh(new THREE.TorusGeometry(rad, 0.006, 6, 128), new THREE.MeshBasicMaterial({ color: 0x80c0ff, transparent: true,
      opacity: 0.5 }), { pos: [0, 1.4, 0], rot: [Math.PI / 2 + 0.15, 0, 0], shadow: false });
    orbit.userData.fx = true;
    g.add(orbit);
    const a = r.range(0, Math.PI * 2);
    g.add(sphere(0.06 + k * 0.02, new THREE.MeshStandardMaterial({ color: cols[k], emissive: cols[k], emissiveIntensity: 0.6 }),
      { pos: [Math.cos(a) * rad, 1.4 - Math.sin(a) * rad * 0.15, Math.sin(a) * rad], shadow: false }, 16));
  }
  // teleskop obok
  const tel = new THREE.Group();
  tel.add(cyl(0.18, 0.24, 1.6, mat.paint(0xe8e8ec, 0.4), { rot: [0, 0, Math.PI / 2] }, 24));
  tel.add(cyl(0.25, 0.25, 0.1, mat.dark(), { pos: [0.8, 0, 0], rot: [0, 0, Math.PI / 2] }, 24));
  tel.position.set(-2.2, 1.4, -0.6);
  tel.rotation.set(0, 0.4, 0.8);
  g.add(tel);
  g.add(cyl(0.05, 0.08, 1.2, mat.steel(), { pos: [-2.2, 0.6, -0.6] }, 8));
}

function weapons(g, r) {
  const hm = hullMaterial('wt', { base: [84, 86, 80], accent: '160,40,30', panel: 30 });
  // prototyp dziala na stojaku i pociski na stole
  g.add(box(3.2, 0.9, 1.4, hm, { pos: [0, 0.45, 0] }));
  const gun = new THREE.Group();
  gun.add(box(1.4, 0.5, 0.6, mat.gunmetal(), {}));
  gun.add(cyl(0.12, 0.14, 2.2, mat.dark(), { pos: [1.7, 0.05, 0], rot: [0, 0, Math.PI / 2] }, 16));
  for (let k = 0; k < 4; k++) gun.add(cyl(0.17, 0.17, 0.06, mat.gunmetal(), { pos: [1.1 + k * 0.35, 0.05, 0], rot: [0, 0, Math.PI / 2] }, 16));
  gun.position.set(-0.6, 1.3, 0);
  gun.rotation.z = 0.08;
  g.add(gun);
  for (let k = 0; k < 5; k++) {
    const sh = new THREE.Group();
    sh.add(cyl(0.08, 0.08, 0.45, mat.copper(), {}, 16));
    sh.add(mesh(new THREE.ConeGeometry(0.08, 0.18, 16), mat.steel(), { pos: [0, 0.31, 0] }));
    sh.position.set(0.6 + k * 0.22, 1.13, 0.4);
    g.add(sh);
  }
  const sp = halo('255,140,60', 1.2, 0.9);
  sp.position.set(1.5, 1.4, 0);
  g.add(sp);
}

function shielding(g, r) {
  const hm = hullMaterial('sh', { base: [90, 96, 108], panel: 30 });
  pedestal(g, hm, { r: 0.7 });
  g.add(cyl(0.2, 0.3, 0.8, hm, { pos: [0, 0.8, 0] }, 16));
  g.add(sphere(0.18, mat.glow(0x60c0ff, 6), { pos: [0, 1.3, 0], shadow: false }));
  // bańka pola silowego z heksagonami
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.strokeStyle = 'rgba(140,210,255,0.95)';
  x.lineWidth = 2.5;
  for (let row = 0; row < 26; row++) {
    for (let col = 0; col < 16; col++) {
      const cx = col * 38, cy = row * 22 + (col % 2 ? 11 : 0);
      x.beginPath();
      for (let k = 0; k < 6; k++) x.lineTo(cx + Math.cos((k / 6) * Math.PI * 2) * 12, cy + Math.sin((k / 6) * Math.PI * 2) * 12);
      x.closePath();
      x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2);
  const bub = new THREE.Mesh(new THREE.SphereGeometry(1.5, 64, 32), new THREE.MeshBasicMaterial({ color: 0x3aa0ff, map: t,
    transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  bub.position.set(0, 1.3, 0);
  g.add(bub);
  // pocisk odbijajacy sie od pola
  const sp = halo('255,150,70', 0.9, 1);
  sp.position.set(1.15, 1.9, 0.9);
  g.add(sp);
}

function armour(g, r) {
  const hm = hullMaterial('ar', { base: [96, 98, 102], panel: 40 });
  // przekroj warstw pancerza: plyty roznych materialow, slad trafienia
  const layers = [[mat.steel(), 0.18], [mat.copper(), 0.08], [new THREE.MeshStandardMaterial({ color: 0x3a3e46, metalness: 0.2, roughness: 0.9 }), 0.22],
    [hm, 0.16], [mat.gold(), 0.05], [hm, 0.2]];
  let y = 0.1;
  for (const [m, h] of layers) {
    g.add(box(2.6, h, 1.8, m, { pos: [0, y + h / 2, 0] }));
    y += h + 0.02;
  }
  // krater po trafieniu na wierzchu
  g.add(sphere(0.35, mat.dark(), { pos: [0.5, y + 0.02, 0.2], scale: [1, 0.25, 1] }, 24));
  const sp = halo('255,140,60', 0.8, 0.8);
  sp.position.set(0.5, y + 0.05, 0.2);
  g.add(sp);
  // heksagonalne plytki ceramiczne
  for (let i = -3; i <= 3; i++) {
    for (let j = -2; j <= 2; j++) {
      if (Math.hypot(i * 0.34 - 0.5, j * 0.34 - 0.2) < 0.5) continue;
      g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 6), hm, { pos: [i * 0.34 + (j % 2 ? 0.17 : 0), y + 0.03, j * 0.3] }));
    }
  }
}

export const items = {
  energy_tech: labShot('energy_tech', energy, { tint: 0xffb030 }),
  laser_tech: labShot('laser_tech', laser, { tint: 0xff4a30, dir: [0.35, 0.45, 1.2] }),
  ion_tech: labShot('ion_tech', ion, { tint: 0x3a9aff, dir: [0.5, 0.45, 1.2] }),
  hyperspace_tech: labShot('hyperspace_tech', hyperspace, { tint: 0x8a50ff }),
  plasma_tech: labShot('plasma_tech', plasma, { tint: 0xc050ff }),
  combustion_drive: labShot('combustion_drive', drive('combustion'), { tint: 0xff8030, dir: [0.5, 0.45, 1.2] }),
  impulse_drive: labShot('impulse_drive', drive('impulse'), { tint: 0x3a9aff, dir: [0.5, 0.45, 1.2] }),
  hyperspace_drive: labShot('hyperspace_drive', drive('hyperspace'), { tint: 0x9a60ff, dir: [0.5, 0.45, 1.2] }),
  espionage_tech: labShot('espionage_tech', espionage, { tint: 0x30ff80 }),
  computer_tech: labShot('computer_tech', computer, { tint: 0x3a8aff, dir: [0.9, 0.5, 1.0] }),
  astrophysics: labShot('astrophysics', astrophysics, { tint: 0x6a8aff }),
  weapons_tech: labShot('weapons_tech', weapons, { tint: 0xff5030 }),
  shielding_tech: labShot('shielding_tech', shielding, { tint: 0x3aa0ff }),
  armour_tech: labShot('armour_tech', armour, { tint: 0x7088a8, dir: [0.8, 0.8, 1.1] }),
};
