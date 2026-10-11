import * as THREE from 'three';
import { cfg } from '../quality.js';
import { addMotes } from './common.js';
import { trackPx } from './props.js';
import { bakeMaze } from './maze-bake.js';
import { floorMaterial, wallMaterial, sharedUniforms } from './maze-materials.js';
import { buildMazeSky } from './maze-sky.js';
import { buildMazeProps } from './maze-props.js';
import { addCosmicEyes } from './eyes.js';

// Entorno del Mapa 3 · LABERINTO CELESTIAL.
// Una losa cuadrada flotando en un cosmos (ver src/sim/map3.js): muros de cristal facetado dibujados EXACTAMENTE sobre las
// cajas de colisión (map.walls), suelo de baldosas con runas que marcan los caminos abiertos, una plaza central con un
// sello (mandala) y ocho obeliscos, dos pares de portales, y mucho relleno (cristales, ruinas flotantes, enredaderas,
// faroles, mariposas, luciérnagas). Cada esquina tiene su color para orientarse:
//   ÁMBAR = esquina de aparición (-x,+z) · CIAN = (+x,+z) · MAGENTA = (-x,-z) · LIMA = (+x,-z) · VIOLETA = plaza.
//
// Uso (desde render.js → setMap): (mapId === 'm3' ? buildMap3 : …)(this, MAPS[mapId]);
// buildMap3(r, map, { eyes = true }) ya añade los ojos cósmicos (eyes.js) — no hace falta llamarlos aparte en m3.

export const M3 = { sun: new THREE.Vector3(0.55, 0.62, -0.45).normalize() };

export function buildMap3(r, map, { eyes = true } = {}) {
  const root = r.mapRoot, q = cfg(), sunDir = M3.sun.clone();
  // luces de este mapa (render.js sólo cambia los colores base; acá las fijamos)
  r.hemi.color.setHex(0xa79cff); r.hemi.groundColor.setHex(0x24104a); r.hemi.intensity = 1.0;
  r.sun.color.setHex(0xffddc4); r.sun.intensity = 2.1; r.sun.position.copy(sunDir);
  r.rim.color.setHex(0xff5cc8); r.rim.intensity = 0.8;
  r.scene.environmentIntensity = 0.4;
  trackPx(r);

  // — mapas horneados: distancia a los muros y sombras de sol (una vez, al cargar)
  const bk = bakeMaze(map, { res: q.decor ? 2 : 1.25, rays: q.decor ? 4 : 2, sun: sunDir.toArray(), wallH: 12 });
  const U = sharedUniforms({ bake: bk.bake, pass: bk.pass, sunL: sunDir });

  // — cielo cósmico, nubes, bruma, planetas lejanos
  buildMazeSky(r, root);

  // — losa (suelo + costados), exactamente la caja de la simulación
  const slab = map.solids.find((s) => !s.wall && s.type === 'box');
  const floor = new THREE.Mesh(new THREE.BoxGeometry(slab.h.x * 2, slab.h.y * 2, slab.h.z * 2), floorMaterial(U, { full: q.decor }));
  floor.position.set(slab.c.x, slab.c.y, slab.c.z); floor.frustumCulled = false; if (q.shadows) floor.receiveShadow = true; root.add(floor);

  // — muros: una sola malla instanciada, una instancia por caja de colisión
  const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wallMaterial(U, { full: q.decor }), map.walls.length);
  const m4 = new THREE.Matrix4(), id = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  map.walls.forEach((w, i) => { m4.compose(ps.set(w.c.x, w.c.y, w.c.z), id, sc.set(w.h.x * 2, w.h.y * 2, w.h.z * 2)); wm.setMatrixAt(i, m4); });
  wm.instanceMatrix.needsUpdate = true; wm.frustumCulled = false; if (q.shadows) wm.castShadow = true; root.add(wm);

  // — decorado instanciado, portales
  buildMazeProps(r, root, map, { sunDir });

  // — luces de color (sólo donde la calidad lo permite; los materiales propios no las necesitan)
  const lights = [];
  if (q.lights >= 3) {
    const pl = new THREE.PointLight(0xaa88ff, 150, 80, 1.2); pl.position.set(0, 9, 0); root.add(pl); lights.push([pl, 150, 0]);
  }
  if (q.lights >= 4) {
    [[-60, 6, 60, 0xffa050], [60, 6, 60, 0x40d8ff], [-60, 6, -60, 0xff44bb], [60, 6, -60, 0x88ff50]].forEach(([x, y, z, c], i) => {
      const l = new THREE.PointLight(c, 90, 70, 1.4); l.position.set(x, y, z); root.add(l); lights.push([l, 90, i + 1]);
    });
  }
  r.dyn.push((dt, t) => { for (const [l, base, k] of lights) l.intensity = base * (0.88 + 0.12 * Math.sin(t * 0.9 + k * 1.7)); });

  addMotes(r, root, q.decor ? 140 : 50, 30);
  if (eyes) addCosmicEyes(r, root, { count: q.decor ? (q.shadows ? 60 : 36) : 12, radius: 330, minR: 90, mode: 'sky', y0: -60, y1: 260 });
}
