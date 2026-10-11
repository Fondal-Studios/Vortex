import * as THREE from 'three';
import { cfg } from '../quality.js';
import { skyMaterial, zoneMaterial } from '../shaders.js';
import { addMotes } from './common.js';
import { buildIslands } from './islands.js';
import { trackPx } from './props.js';
import { buildSkyFx } from './sky.js';

// Entorno del Mapa 1 · Vacío de Islas. `r` es el Renderer (r.mapRoot, r.shared(), r.dyn, r.sun, r.halo, r.camera…).
const SUN_POS = new THREE.Vector3(380, 300, -700);
export const M1 = { haze: 0x241a58, hazeDens: 0.0000032 };

export function buildMap1(r, map) {
  const root = r.mapRoot, q = cfg(), sunDir = SUN_POS.clone().normalize();
  // luces de este mapa (el renderer sólo cambia los colores; las intensidades las fijamos acá)
  r.hemi.intensity = 1.1; r.sun.intensity = 2.2; r.rim.intensity = 1.0; r.scene.environmentIntensity = 0.55;
  r.sun.position.copy(sunDir);
  trackPx(r);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 48, 24), skyMaterial({ hue: 0.0, speed: 0.04, iters: q.skyIters, sun: sunDir.toArray() })); sky.renderOrder = -10; sky.frustumCulled = false; root.add(sky); r.sky = sky;
  buildSkyFx(r, map, { sunPos: SUN_POS, haze: M1.haze, hazeDens: M1.hazeDens });
  buildIslands(r, map, { haze: M1.haze, hazeDens: M1.hazeDens, sun: sunDir.toArray() });

  // planetoide
  for (const s of map.solids) if (s.type === 'sph') {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s.r, 2), new THREE.MeshStandardMaterial({ color: 0x4488aa, roughness: 0.8 })); m.position.set(s.c.x, s.c.y, s.c.z); root.add(m);
  }
  // zonas
  for (const z of map.zones) {
    let m;
    if (z.kind === 'flip') { const h = z.y1 - z.y0; m = new THREE.Mesh(new THREE.CylinderGeometry(z.r, z.r, h, 24, 1, true), zoneMaterial(0x66ffcc, 1)); m.position.set(z.c.x, z.y0 + h / 2, z.c.z); }
    else { m = new THREE.Mesh(new THREE.SphereGeometry(z.r, 28, 18), zoneMaterial(z.kind === 'zero' ? 0xc7a0ff : z.kind === 'well' ? 0x6aa0ff : 0xffb347, 2)); m.position.set(z.c.x, z.c.y, z.c.z); }
    root.add(m);
  }
  // portales
  for (const po of map.portals) for (const end of [po.a, po.b]) {
    const col = new THREE.Color().setHSL(po.hue, 1, 0.6), g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(po.r * 0.85, 0.16, 8, 32), zoneMaterial(col, 0)), disc = new THREE.Mesh(new THREE.CircleGeometry(po.r * 0.8, 24), zoneMaterial(col, 2));
    g.add(ring, disc); g.position.set(end.x, end.y + 1, end.z); g.rotation.y = Math.atan2(end.x, end.z); root.add(g);
    r.dyn.push((dt, t) => { ring.rotation.z = t * 1.5; disc.rotation.z = -t * 2; });
  }
  addMotes(r, root, 220, 38);
}
