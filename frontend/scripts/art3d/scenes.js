// Ujecia wspolne: budowla na powierzchni planety, obiekt w laboratorium badawczym.
import { THREE, rng, createScene, cinematicLights, render, fitCamera, surface, mat, mesh } from './lib3d.js';

/** Budowla na powierzchni planety o zmierzchu, kamera z gory pod katem. */
export function surfaceShot(key, build, { dir = [0.95, 0.42, 1.2], fov = 36, margin = 0.9, ground, sky, yaw = 0, moon = false } = {}) {
  return ({ size, outSize }) => {
    const skyCols = moon ? ['#020306', '#0a0c12'] : (sky ?? ['#1a2a44', '#c46a3a']);
    const scene = createScene({ sky: skyCols }); // odbicia nieba planety zamiast lamp studyjnych
    surface(scene, key, moon ? { ground: ground ?? [120, 120, 122], sky: skyCols, moon: true } : { ground, sky: skyCols });
    cinematicLights(scene, { key: 0xffd9b0, keyPos: [9, 6, 3], keyI: 2.3, rim: 0x8fb8ff, rimPos: [-8, 5, -9], rimI: 3.2,
      fillI: 0.55, shadowSize: 9 });
    const g = new THREE.Group();
    build(g, rng(key));
    g.rotation.y = yaw;
    scene.add(g);
    const cam = fitCamera(g, dir, { fov, margin, lift: 0.6 });
    return render(scene, cam, { size, outSize, bloom: [0.5, 0.4, 0.85] });
  };
}

/** Laboratorium: ciemna, blyszczaca podloga z siatka, hologramy w tle; obiekt badawczy w centrum. */
export function labShot(key, build, { dir = [0.8, 0.55, 1.2], fov = 34, margin = 0.95, tint = 0x3ab0ff, yaw = 0 } = {}) {
  return ({ size, outSize }) => {
    const scene = createScene();
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g2 = c.getContext('2d');
    const gr = g2.createRadialGradient(256, 200, 20, 256, 256, 400);
    const col = new THREE.Color(tint);
    gr.addColorStop(0, `rgb(${Math.round(col.r * 40)},${Math.round(col.g * 40)},${Math.round(col.b * 50)})`);
    gr.addColorStop(1, '#020306');
    g2.fillStyle = gr;
    g2.fillRect(0, 0, 512, 512);
    const bg = new THREE.CanvasTexture(c);
    bg.colorSpace = THREE.SRGBColorSpace;
    scene.background = bg;
    // podloga z siatka
    const fc = document.createElement('canvas');
    fc.width = fc.height = 512;
    const fg = fc.getContext('2d');
    fg.fillStyle = '#0b0e14';
    fg.fillRect(0, 0, 512, 512);
    fg.strokeStyle = `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},0.35)`;
    fg.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      fg.beginPath(); fg.moveTo(i, 0); fg.lineTo(i, 512); fg.stroke();
      fg.beginPath(); fg.moveTo(0, i); fg.lineTo(512, i); fg.stroke();
    }
    const ft = new THREE.CanvasTexture(fc);
    ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
    ft.repeat.set(10, 10);
    ft.colorSpace = THREE.SRGBColorSpace;
    const floor = mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: ft, metalness: 0.3, roughness: 0.7, envMapIntensity: 0.15,
      emissive: 0xffffff, emissiveMap: ft, emissiveIntensity: 0.12 }), { rot: [-Math.PI / 2, 0, 0], shadow: false });
    floor.userData.fx = true;
    scene.add(floor);
    scene.fog = new THREE.Fog(0x020306, 14, 34);
    cinematicLights(scene, { key: 0xf2f6ff, keyPos: [6, 9, 6], keyI: 2.6, rim: tint, rimPos: [-6, 4, -7], rimI: 6, fillI: 0.7,
      shadowSize: 6 });
    const p = new THREE.PointLight(tint, 7, 10);
    p.position.set(0, 2.5, 0);
    scene.add(p);
    const g = new THREE.Group();
    build(g, rng(key));
    g.rotation.y = yaw;
    scene.add(g);
    return render(scene, fitCamera(g, dir, { fov, margin }), { size, outSize, bloom: [0.42, 0.4, 0.9] });
  };
}

/** Holograficzny pierscien (emisyjny, polprzezroczysty). */
export function holoRing(group, { r = 1.5, y = 0.5, color = 0x3ab0ff, tube = 0.02, tilt = 0 }) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 96), new THREE.MeshBasicMaterial({ color, transparent: true,
    opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = Math.PI / 2 + tilt;
  m.position.y = y;
  m.userData.fx = true;
  group.add(m);
  return m;
}

/** Wiazka swiatla (laser, plazma): emisyjny walec + otoczka. */
export function beam(group, { from, to, color = 0xff3030, r = 0.04 }) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  for (const [rad, op, inten] of [[r, 1, 8], [r * 3.5, 0.25, 3]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 16, 1, true), new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(inten), transparent: true, opacity: op, blending: THREE.AdditiveBlending,
      depthWrite: false }));
    m.position.copy(mid);
    m.quaternion.copy(q);
    m.userData.fx = true;
    group.add(m);
  }
}

export { mat };
