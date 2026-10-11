import * as THREE from 'three';
import { cfg } from '../quality.js';
import { skyMaterial } from '../shaders.js';
import { addMotes } from './common.js';
import { buildIslands } from './islands.js';
import { trackPx } from './props.js';
import { buildSkyFx } from './sky.js';
import { buildZones } from './zones.js';

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

  buildZones(r, map, { sun: sunDir.toArray() });
  addMotes(r, root, 220, 38);
}
