// Wspolne narzedzia renderingu 3D (uruchamiane w przegladarce): materialy, tekstury proceduralne,
// oswietlenie filmowe, tla, poswiata. Wszystko deterministyczne (ziarno losowania na obiekt).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE, mergeGeometries };

// ---------- losowosc deterministyczna ----------
export function rng(seed) {
  let s = 0;
  for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  s = s || 1;
  const f = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  f.range = (a, b) => a + f() * (b - a);
  f.int = (a, b) => Math.floor(a + f() * (b - a + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

// ---------- tekstury proceduralne ----------
function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

/** Szum wartosci 2D (kafelkowalny) do zabrudzen i nieregularnosci. */
function noiseLayer(ctx, size, r, scale, alpha, color) {
  const cells = Math.max(2, Math.floor(size / scale));
  const grid = Array.from({ length: (cells + 1) * (cells + 1) }, () => r());
  const at = (x, y) => grid[(y % cells) * (cells + 1) + (x % cells)];
  const img = ctx.getImageData(0, 0, size, size);
  const [cr, cg, cb] = color;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * cells, gy = (y / size) * cells;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const tx = gx - x0, ty = gy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const v = (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
      const a = v * alpha;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i] * (1 - a) + cr * a;
      img.data[i + 1] = img.data[i + 1] * (1 - a) + cg * a;
      img.data[i + 2] = img.data[i + 2] * (1 - a) + cb * a;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const textureCache = new Map();

/**
 * Poszycie kadluba: plyty o roznych odcieniach, linie laczen, nity, pasy ostrzegawcze, zabrudzenia.
 * Zwraca { map, roughnessMap, bumpMap }.
 */
export function hullTextures(seed, { base = [150, 156, 166], variance = 26, panel = 64, accent = null, size = 1024 } = {}) {
  const key = `hull:${seed}:${base}:${panel}:${accent}`;
  if (textureCache.has(key)) return textureCache.get(key);
  const r = rng(key);
  const [c, g] = canvas(size);
  const [rc, rg] = canvas(size);
  const [bc, bg] = canvas(size);
  g.fillStyle = `rgb(${base})`;
  g.fillRect(0, 0, size, size);
  rg.fillStyle = 'rgb(120,120,120)';
  rg.fillRect(0, 0, size, size);
  bg.fillStyle = 'rgb(128,128,128)';
  bg.fillRect(0, 0, size, size);
  // plyty: rekurencyjny podzial prostokatow
  const rects = [];
  const split = (x, y, w, h, d) => {
    if (d > 5 || (w < panel * 1.3 && h < panel * 1.3) || (d > 2 && r() < 0.25)) {
      rects.push([x, y, w, h]);
      return;
    }
    if (w > h) {
      const s = Math.round(w * r.range(0.3, 0.7));
      split(x, y, s, h, d + 1);
      split(x + s, y, w - s, h, d + 1);
    } else {
      const s = Math.round(h * r.range(0.3, 0.7));
      split(x, y, w, s, d + 1);
      split(x, y + s, w, h - s, d + 1);
    }
  };
  split(0, 0, size, size, 0);
  for (const [x, y, w, h] of rects) {
    const dv = r.range(-variance, variance);
    g.fillStyle = `rgb(${base.map((v) => Math.max(0, Math.min(255, v + dv)))})`;
    g.fillRect(x + 1, y + 1, w - 2, h - 2);
    const rough = Math.floor(r.range(80, 170));
    rg.fillStyle = `rgb(${rough},${rough},${rough})`;
    rg.fillRect(x + 1, y + 1, w - 2, h - 2);
    // lekkie wybrzuszenie plyty
    bg.fillStyle = `rgb(${138 + r.int(-6, 6)},${138},${138})`;
    bg.fillRect(x + 2, y + 2, w - 4, h - 4);
    // nity w rogach wiekszych plyt
    if (w > 40 && h > 40 && r() < 0.6) {
      bg.fillStyle = 'rgb(175,175,175)';
      g.fillStyle = 'rgba(40,44,50,0.5)';
      for (const [px, py] of [[x + 5, y + 5], [x + w - 6, y + 5], [x + 5, y + h - 6], [x + w - 6, y + h - 6]]) {
        bg.fillRect(px, py, 2, 2);
        g.fillRect(px, py, 2, 2);
      }
    }
    // detale: kratki wentylacyjne i luki
    if (w > 60 && h > 30 && r() < 0.18) {
      const vx = x + w * 0.2, vy = y + h * 0.3, vw = w * 0.6, vh = Math.min(20, h * 0.4);
      for (let i = 0; i < vh; i += 4) {
        g.fillStyle = 'rgba(25,28,34,0.7)';
        g.fillRect(vx, vy + i, vw, 2);
        bg.fillStyle = 'rgb(90,90,90)';
        bg.fillRect(vx, vy + i, vw, 2);
      }
    }
  }
  // linie laczen
  g.strokeStyle = 'rgba(30,34,40,0.85)';
  bg.strokeStyle = 'rgb(70,70,70)';
  g.lineWidth = bg.lineWidth = 1.5;
  for (const [x, y, w, h] of rects) {
    g.strokeRect(x + 0.5, y + 0.5, w, h);
    bg.strokeRect(x + 0.5, y + 0.5, w, h);
  }
  // pasy akcentu (barwy floty)
  if (accent) {
    for (let i = 0; i < 3; i++) {
      const y = r.int(0, size - 30);
      g.fillStyle = `rgba(${accent},0.75)`;
      g.fillRect(0, y, size, r.int(6, 14));
    }
  }
  // zabrudzenia i przypalenia
  noiseLayer(g, size, r, 90, 0.35, [40, 38, 36]);
  noiseLayer(g, size, r, 24, 0.12, [20, 20, 22]);
  noiseLayer(rg, size, r, 60, 0.4, [200, 200, 200]);
  const make = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const res = { map: make(c, true), roughnessMap: make(rc, false), bumpMap: make(bc, false) };
  textureCache.set(key, res);
  return res;
}

/** Okna / swiatla nawigacyjne jako tekstura emisji. */
export function windowsTexture(seed, { density = 0.35, color = '255,214,150', size = 512, rows = 40 } = {}) {
  const r = rng('win' + seed);
  const [c, g] = canvas(size);
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  const rowH = size / rows;
  for (let y = 0; y < rows; y++) {
    if (r() < 0.45) continue;
    let x = r.int(0, 20);
    while (x < size) {
      const len = r.int(3, 30);
      if (r() < density) {
        g.fillStyle = `rgba(${color},${r.range(0.5, 1)})`;
        g.fillRect(x, y * rowH + rowH * 0.35, len, Math.max(1.5, rowH * 0.3));
      }
      x += len + r.int(2, 12);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- materialy ----------
export function hullMaterial(seed, opts = {}) {
  const tex = hullTextures(seed, opts);
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.map,
    roughnessMap: tex.roughnessMap,
    bumpMap: tex.bumpMap,
    bumpScale: opts.bump ?? 2.2,
    metalness: opts.metalness ?? 0.75,
    roughness: opts.roughness ?? 1.0, // mnozone przez roughnessMap (0.3-0.67)
  });
  if (opts.repeat) {
    for (const t of [m.map, m.roughnessMap, m.bumpMap]) t.repeat.set(opts.repeat, opts.repeat);
  }
  return m;
}

export const mat = {
  dark: () => new THREE.MeshStandardMaterial({ color: 0x24282f, metalness: 0.7, roughness: 0.68 }),
  steel: () => new THREE.MeshStandardMaterial({ color: 0x8c939d, metalness: 0.85, roughness: 0.5 }),
  gunmetal: () => new THREE.MeshStandardMaterial({ color: 0x3b4048, metalness: 0.8, roughness: 0.6 }),
  copper: () => new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1, roughness: 0.35 }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xd4a646, metalness: 1, roughness: 0.25 }),
  concrete: () => new THREE.MeshStandardMaterial({ color: 0x4a4744, metalness: 0.05, roughness: 0.92 }),
  glass: (color = 0x7fc8ff) => new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.05, transmission: 0.0,
    transparent: true, opacity: 0.55, emissive: color, emissiveIntensity: 0.25, clearcoat: 1 }),
  glow: (color, intensity = 4) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity }),
  paint: (color, rough = 0.5) => new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: rough }),
};

// ---------- geometria pomocnicza ----------
export function mesh(geo, material, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], shadow = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export const box = (w, h, d, material, o) => mesh(new THREE.BoxGeometry(w, h, d), material, o);
export const cyl = (rt, rb, h, material, o, seg = 32) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material, o);
export const sphere = (r, material, o, seg = 48) => mesh(new THREE.SphereGeometry(r, seg, seg / 2), material, o);

/** Kadlub z obrysu (widok z gory) wyciagniety w gore z fazowaniem: punkty [x, z]. */
export function hull(points, height, material, { bevel = 0.15, pos = [0, 0, 0] } = {}) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 2, curveSegments: 12 });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, height / 2, 0);
  // UV z rzutu z gory - poszycie bez rozciagniec
  const p = geo.attributes.position, uv = geo.attributes.uv, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ay > 0.5) uv.setXY(i, p.getX(i) * 0.08, p.getZ(i) * 0.08);
    else if (ax > 0.5) uv.setXY(i, p.getZ(i) * 0.08, p.getY(i) * 0.08);
    else uv.setXY(i, p.getX(i) * 0.08, p.getY(i) * 0.08);
  }
  return mesh(geo, material, { pos });
}

/**
 * Kadlub "loftowany": przekroje wzdluz osi X. Kazdy przekroj: { x, w, top, bot, y = 0, k = 0.7 }
 * (szerokosc, wysokosc nad/pod linia burty, przesuniecie w pionie, zwezenie gornego pokladu).
 * Przekroj jest szesciokatny (fazowane burty), cieniowanie plaskie - wyglada jak poszycie z plyt.
 */
export function loft(sections, material, { pos = [0, 0, 0], uvScale = 0.09 } = {}) {
  const ring = (s) => {
    const y = s.y ?? 0, k = s.k ?? 0.7, kb = s.kb ?? 0.55;
    return [[s.w / 2, y], [s.w / 2 * k, y + s.top], [-s.w / 2 * k, y + s.top], [-s.w / 2, y], [-s.w / 2 * kb, y - s.bot], [s.w / 2 * kb, y - s.bot]];
  };
  const pos3 = [], uv = [];
  const perim = (r) => {
    const acc = [0];
    for (let i = 1; i <= r.length; i++) {
      const a = r[i - 1], b = r[i % r.length];
      acc.push(acc[i - 1] + Math.hypot(a[0] - b[0], a[1] - b[1]));
    }
    return acc;
  };
  const tri = (a, b, c, ua, ub, uc) => { pos3.push(...a, ...b, ...c); uv.push(...ua, ...ub, ...uc); };
  for (let i = 0; i < sections.length - 1; i++) {
    const s0 = sections[i], s1 = sections[i + 1];
    const r0 = ring(s0), r1 = ring(s1), p0 = perim(r0), p1 = perim(r1);
    for (let j = 0; j < 6; j++) {
      const j2 = (j + 1) % 6;
      const a = [s0.x, r0[j][1], r0[j][0]], b = [s0.x, r0[j2][1], r0[j2][0]];
      const c = [s1.x, r1[j2][1], r1[j2][0]], d = [s1.x, r1[j][1], r1[j][0]];
      const ua = [s0.x * uvScale, p0[j] * uvScale], ub = [s0.x * uvScale, p0[j + 1] * uvScale];
      const uc = [s1.x * uvScale, p1[j + 1] * uvScale], ud = [s1.x * uvScale, p1[j] * uvScale];
      tri(a, c, b, ua, uc, ub);
      tri(a, d, c, ua, ud, uc);
    }
  }
  // zamkniecia koncow
  for (const [s, flip] of [[sections[0], true], [sections[sections.length - 1], false]]) {
    const r = ring(s), cy = (s.y ?? 0) + (s.top - s.bot) / 2;
    for (let j = 0; j < 6; j++) {
      const j2 = (j + 1) % 6;
      const a = [s.x, cy, 0], b = [s.x, r[j][1], r[j][0]], c = [s.x, r[j2][1], r[j2][0]];
      if (flip) tri(a, b, c, [0, 0], [r[j][0] * uvScale, r[j][1] * uvScale], [r[j2][0] * uvScale, r[j2][1] * uvScale]);
      else tri(a, c, b, [0, 0], [r[j2][0] * uvScale, r[j2][1] * uvScale], [r[j][0] * uvScale, r[j][1] * uvScale]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos3, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return mesh(geo, material, { pos });
}

/**
 * Swiatla na burtach: drobne swiecace punkty (okna, swiatla pozycyjne) rozmieszczone wzdluz kadluba.
 * at(x) zwraca [polowa szerokosci, wysokosc dolna, wysokosc gorna] burty w punkcie x.
 */
export function hullLights(r, group, { x0, x1, at, count = 120, color = 0xffd9a8, size = 0.028, intensity = 2.6 }) {
  const geos = [];
  for (let i = 0; i < count; i++) {
    const x = r.range(x0, x1);
    const [hw, ylo, yhi] = at(x);
    if (hw <= 0.05) continue;
    const y = r.range(ylo, yhi);
    const side = r() < 0.5 ? 1 : -1;
    const run = r() < 0.4 ? r.int(2, 6) : 1;
    for (let k = 0; k < run; k++) {
      const gb = new THREE.BoxGeometry(size * 1.6, size, size);
      gb.translate(x + k * size * 2.6, y, side * (hw + 0.005));
      geos.push(gb);
    }
  }
  if (!geos.length) return;
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color,
    emissiveIntensity: intensity }));
  m.userData.fx = true;
  group.add(m);
}

/** Ustawia kamere tak, by obiekt wypelnil kadr: kierunek dir (od obiektu do kamery), margines. */
export function fitCamera(object, dir, { fov = 35, margin = 1.08, lift = 0 } = {}) {
  object.updateMatrixWorld(true);
  // kadr wg bryly, bez efektow (plomienie, poswiaty)
  const box3 = new THREE.Box3();
  object.traverse((o) => {
    if (o.isMesh && !o.userData.fx && !o.isSprite) box3.expandByObject(o, true);
  });
  const sphere3 = box3.getBoundingSphere(new THREE.Sphere());
  const d = new THREE.Vector3(...dir).normalize();
  const dist = (sphere3.radius * margin) / Math.sin(THREE.MathUtils.degToRad(fov / 2));
  const c = new THREE.PerspectiveCamera(fov, 1, 0.1, 500);
  const target = sphere3.center.clone().add(new THREE.Vector3(0, lift, 0));
  c.position.copy(target).addScaledVector(d, dist);
  c.lookAt(target);
  return c;
}

/** Rozrzuca drobne detale (greeble) po prostokacie na wysokosci y. */
export function greebles(r, group, { x0, x1, z0, z1, y, count, size = [0.08, 0.5], material }) {
  const geos = [];
  for (let i = 0; i < count; i++) {
    const w = r.range(...size), d = r.range(...size), h = r.range(size[0] * 0.5, size[1] * 0.7);
    const g = r() < 0.75 ? new THREE.BoxGeometry(w, h, d) : new THREE.CylinderGeometry(w / 2, w / 2, h, 10);
    g.translate(r.range(x0, x1), y + h / 2, r.range(z0, z1));
    geos.push(g);
  }
  if (!geos.length) return;
  const m = mesh(mergeGeometries(geos), material);
  group.add(m);
}

/** Poswiata silnika/wiazki: sprite z addytywnym mieszaniem (zlapie go bloom). */
export function glowSprite(color, scale, opacity = 1) {
  const [c, g] = canvas(128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, `rgba(${color},0.9)`);
  grad.addColorStop(0.5, `rgba(${color},0.25)`);
  grad.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, opacity }));
  s.scale.set(scale, scale, scale);
  return s;
}

/** Plomien silnika: wydluzony stozek z gradientem, addytywny. */
export function exhaust(color, length, radius) {
  const geo = new THREE.ConeGeometry(radius, length, 24, 1, true);
  geo.rotateZ(Math.PI / 2);
  geo.translate(-length / 2, 0, 0);
  const [c, g] = canvas(256);
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, `rgba(${color},0)`);
  grad.addColorStop(0.6, `rgba(${color},0.55)`);
  grad.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide }));
  m.userData.fx = true;
  // UV stozka: u wzdluz obwodu - przeliczamy na wzdluz dlugosci
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, 1 + p.getX(i) / length, 0.5);
  return m;
}

// ---------- tla ----------
/** Kosmos: gwiazdy, mglawice, odlegla planeta. */
export function spaceBackdrop(seed, { nebula = ['70,90,170', '150,60,140'], planet = true, size = 1024 } = {}) {
  const r = rng('bg' + seed);
  const [c, g] = canvas(size);
  const bgGrad = g.createLinearGradient(0, 0, size, size);
  bgGrad.addColorStop(0, '#02040a');
  bgGrad.addColorStop(1, '#070a16');
  g.fillStyle = bgGrad;
  g.fillRect(0, 0, size, size);
  // mglawice: wiele miekkich plam
  for (const col of nebula) {
    const cx = r.range(0, size), cy = r.range(0, size);
    for (let i = 0; i < 40; i++) {
      const x = cx + r.range(-size * 0.35, size * 0.35), y = cy + r.range(-size * 0.25, size * 0.25);
      const rad = r.range(size * 0.05, size * 0.22);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${col},${r.range(0.04, 0.12)})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, size, size);
    }
  }
  noiseLayer(g, size, r, 40, 0.18, [0, 0, 0]);
  // gwiazdy
  for (let i = 0; i < 900; i++) {
    const x = r.range(0, size), y = r.range(0, size);
    const b = Math.pow(r(), 4);
    const rad = 0.35 + b * 1.4;
    const tint = r.pick(['255,255,255', '200,220,255', '255,230,200']);
    g.fillStyle = `rgba(${tint},${0.15 + b * 0.8})`;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
    if (b > 0.85) {
      const gr = g.createRadialGradient(x, y, 0, x, y, rad * 6);
      gr.addColorStop(0, `rgba(${tint},0.35)`);
      gr.addColorStop(1, `rgba(${tint},0)`);
      g.fillStyle = gr;
      g.fillRect(x - rad * 6, y - rad * 6, rad * 12, rad * 12);
    }
  }
  if (planet && r() < 0.6) {
    const corner = r.pick([[0, 1], [1, 1], [1, 0]]);
    const pr = r.range(size * 0.14, size * 0.24);
    const px = corner[0] ? size + pr * r.range(-0.55, -0.2) : pr * r.range(0.2, 0.55) - pr * 0.6;
    const py = corner[1] ? size + pr * r.range(-0.5, -0.15) : pr * r.range(-0.2, 0.2);
    const hue = r.pick([[180, 120, 80], [90, 130, 180], [150, 160, 170], [170, 90, 70]]);
    const lx = px + pr * 0.55, ly = py - pr * 0.55;
    const pg = g.createRadialGradient(lx, ly, pr * 0.05, lx, ly, pr * 1.5);
    pg.addColorStop(0, `rgb(${hue.map((v) => Math.min(255, v * 0.9))})`);
    pg.addColorStop(0.45, `rgb(${hue.map((v) => v * 0.35)})`);
    pg.addColorStop(0.75, 'rgb(6,8,12)');
    pg.addColorStop(1, 'rgb(2,3,6)');
    g.fillStyle = pg;
    g.beginPath();
    g.arc(px, py, pr, 0, Math.PI * 2);
    g.fill();
    // pasy chmur na oswietlonej stronie
    g.save();
    g.beginPath();
    g.arc(px, py, pr, 0, Math.PI * 2);
    g.clip();
    for (let i = 0; i < 26; i++) {
      const yy = py - pr + r() * pr * 2;
      g.fillStyle = `rgba(${hue.map((v) => Math.min(255, v + 60))},${r.range(0.02, 0.07)})`;
      g.fillRect(px - pr, yy, pr * 2, r.range(2, 9));
    }
    const shade = g.createRadialGradient(lx, ly, pr * 0.3, lx, ly, pr * 1.6);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(0.6, 'rgba(0,0,0,0.55)');
    shade.addColorStop(1, 'rgba(0,0,0,0.95)');
    g.fillStyle = shade;
    g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    g.restore();
    const atm = g.createRadialGradient(px, py, pr * 0.97, px, py, pr * 1.06);
    atm.addColorStop(0, `rgba(${hue.map((v) => Math.min(255, v + 80))},0.3)`);
    atm.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = atm;
    g.fillRect(0, 0, size, size);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Powierzchnia planety (teren z przemieszczeniem) i niebo o zmierzchu. */
export function surface(scene, seed, { ground = [92, 84, 76], sky = ['#1a2a44', '#c46a3a'], size = 60, moon = false } = {}) {
  const r = rng('surf' + seed);
  const geo = new THREE.PlaneGeometry(size, size, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const bumps = Array.from({ length: 30 }, () => [r.range(-size / 2, size / 2), r.range(-size / 2, size / 2), r.range(2, 9), r.range(-0.8, 2.5)]);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let y = 0;
    for (const [bx, bz, br, bh] of bumps) {
      const d = Math.hypot(x - bx, z - bz);
      y += bh * Math.exp(-(d * d) / (br * br));
    }
    // srodek plaski - miejsce na budowle
    const flat = Math.min(1, Math.hypot(x, z) / 7);
    y *= flat * flat;
    y += (r() - 0.5) * 0.04;
    p.setY(i, y);
  }
  geo.computeVertexNormals();
  // grunt: pyl, kamienie, slady kraterow (bez plyt)
  const [gc, gg] = canvas(1024);
  gg.fillStyle = `rgb(${ground})`;
  gg.fillRect(0, 0, 1024, 1024);
  noiseLayer(gg, 1024, r, 160, 0.45, ground.map((v) => v * 0.55));
  noiseLayer(gg, 1024, r, 40, 0.3, ground.map((v) => Math.min(255, v * 1.35)));
  noiseLayer(gg, 1024, r, 10, 0.18, ground.map((v) => v * 0.6));
  for (let i = 0; i < 900; i++) {
    const x = r.range(0, 1024), y = r.range(0, 1024), rad = r.range(0.6, 3.2);
    gg.fillStyle = `rgba(${ground.map((v) => v * r.range(0.4, 1.4))},0.8)`;
    gg.beginPath(); gg.arc(x, y, rad, 0, Math.PI * 2); gg.fill();
  }
  for (let i = 0; i < 14; i++) {
    const x = r.range(0, 1024), y = r.range(0, 1024), rad = r.range(10, 45);
    const cg = gg.createRadialGradient(x, y, rad * 0.5, x, y, rad);
    cg.addColorStop(0, 'rgba(0,0,0,0.25)');
    cg.addColorStop(0.85, 'rgba(255,255,255,0.08)');
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    gg.fillStyle = cg;
    gg.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const gt = new THREE.CanvasTexture(gc);
  gt.wrapS = gt.wrapT = THREE.RepeatWrapping;
  gt.colorSpace = THREE.SRGBColorSpace;
  gt.repeat.set(4, 4);
  gt.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({ color: 0xb0a8a0, map: gt, roughness: 0.97, metalness: 0.02, bumpMap: gt, bumpScale: 1.5 });
  const ground3 = mesh(geo, m, { shadow: false });
  scene.add(ground3);
  // niebo: gradient + gwiazdy u gory
  const [c, g] = canvas(1024);
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#03050c');
  grad.addColorStop(0.45, sky[0]);
  grad.addColorStop(0.62, sky[1]);
  grad.addColorStop(1, sky[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 500; i++) {
    const y = r.range(0, 420);
    g.fillStyle = `rgba(255,255,255,${r.range(0.1, 0.8) * (1 - y / 420)})`;
    g.fillRect(r.range(0, 1024), y, 1.3, 1.3);
  }
  const ex = r.range(650, 900), ey = r.range(120, 260), er = moon ? r.range(110, 150) : r.range(50, 90);
  const pg = g.createRadialGradient(ex - er * 0.3, ey - er * 0.3, er * 0.1, ex, ey, er);
  if (moon) {
    // macierzysta planeta na czarnym niebie ksiezyca
    pg.addColorStop(0, 'rgba(150,200,255,1)');
    pg.addColorStop(0.5, 'rgba(40,90,170,1)');
    pg.addColorStop(0.85, 'rgba(10,30,70,1)');
    pg.addColorStop(1, 'rgba(10,30,70,0)');
  } else {
    pg.addColorStop(0, 'rgba(230,220,210,0.95)');
    pg.addColorStop(0.8, 'rgba(120,110,120,0.6)');
    pg.addColorStop(1, 'rgba(60,60,80,0)');
  }
  g.fillStyle = pg;
  g.beginPath();
  g.arc(ex, ey, er, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
  scene.fog = new THREE.Fog(new THREE.Color(sky[1]).multiplyScalar(0.35), size * 0.18, size * 0.5);
  return ground3;
}

// ---------- scena i render ----------
let renderer = null;
let pmrem = null;
let envTex = null;

export function createScene() {
  const scene = new THREE.Scene();
  if (!envTex) {
    pmrem = new THREE.PMREMGenerator(renderer);
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  scene.environment = envTex;
  scene.environmentIntensity = 0.6;
  return scene;
}

/** Oswietlenie filmowe: cieple swiatlo glowne, zimne kontrowe, slabe wypelniajace. */
export function cinematicLights(scene, { key = 0xfff0dc, keyPos = [8, 10, 6], keyI = 3.4, rim = 0x7fb4ff, rimPos = [-9, 4, -8],
  rimI = 5.5, fill = 0x30405a, fillI = 1.1, shadowSize = 12 } = {}) {
  const k = new THREE.DirectionalLight(key, keyI);
  k.position.set(...keyPos);
  k.castShadow = true;
  k.shadow.mapSize.set(2048, 2048);
  k.shadow.camera.left = k.shadow.camera.bottom = -shadowSize;
  k.shadow.camera.right = k.shadow.camera.top = shadowSize;
  k.shadow.bias = -0.0005;
  k.shadow.normalBias = 0.02;
  scene.add(k);
  const rl = new THREE.DirectionalLight(rim, rimI);
  rl.position.set(...rimPos);
  scene.add(rl);
  scene.add(new THREE.HemisphereLight(fill, 0x050505, fillI));
}

export function init(size) {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  return renderer;
}

/** Render z poswiata; zwraca dataURL (JPEG) pomniejszony do outSize (supersampling). */
export function render(scene, camera, { size, outSize, bloom = [0.45, 0.35, 0.9], quality = 0.9 }) {
  renderer.setSize(size, size);
  camera.aspect = 1;
  camera.updateProjectionMatrix();
  const composer = new EffectComposer(renderer);
  composer.setSize(size, size);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(size, size), ...bloom));
  composer.addPass(new OutputPass());
  composer.render();
  const out = document.createElement('canvas');
  out.width = out.height = outSize;
  const g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(renderer.domElement, 0, 0, outSize, outSize);
  // delikatna winieta i ziarno filmowe
  const v = g.createRadialGradient(outSize / 2, outSize / 2, outSize * 0.35, outSize / 2, outSize / 2, outSize * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = v;
  g.fillRect(0, 0, outSize, outSize);
  const img = g.getImageData(0, 0, outSize, outSize);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 7;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  composer.dispose();
  return out.toDataURL('image/jpeg', quality);
}

export function camera(fov, pos, target = [0, 0, 0]) {
  const c = new THREE.PerspectiveCamera(fov, 1, 0.1, 400);
  c.position.set(...pos);
  c.lookAt(...target);
  return c;
}
