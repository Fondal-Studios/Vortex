import * as THREE from 'three';
import { cfg } from '../quality.js';
import { skyMaterial, crystalMaterial, groundMaterial, shellMaterial, zoneMaterial } from '../shaders.js';
import { addMotes } from './common.js';

// Entorno del Mapa 2 · Cámara Fractal. `r` es el Renderer.
export function buildMap2(r, map) {
  const root = r.mapRoot;
  r.shellMat = shellMaterial(0.35, cfg().shellIters);
  root.add(new THREE.Mesh(new THREE.SphereGeometry(map.R, 64, 40), r.shellMat));
  for (const s of map.solids) if (s.type === 'sph') {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s.r, 1), crystalMaterial(new THREE.Color().setHSL((s.c.x * 0.013 + 0.8) % 1, 0.7, 0.55), { glow: 0.12 }));
    m.position.set(s.c.x, s.c.y, s.c.z); root.add(m);
  }
  // espigas de cristal clavadas en el cascarón, apuntando hacia adentro
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < (cfg().decor ? 90 : 40); i++) {
    const z = 1 - (i + 0.5) / (cfg().decor ? 45 : 20), rad = Math.sqrt(Math.max(0, 1 - z * z)), th = i * 2.399963;
    const n = new THREE.Vector3(Math.cos(th) * rad, z, Math.sin(th) * rad);
    if (map.solids.some((s) => s.type === 'sph' && n.clone().multiplyScalar(map.R).distanceTo(new THREE.Vector3(s.c.x, s.c.y, s.c.z)) < s.r + 3)) continue;
    const h = 3 + (i % 5) * 1.6, spike = new THREE.Mesh(new THREE.ConeGeometry(1.1 + (i % 3) * 0.5, h, 5), crystalMaterial(new THREE.Color().setHSL(((i * 0.031) + 0.55) % 1, 0.85, 0.6), { glow: 0.1 }));
    spike.quaternion.setFromUnitVectors(up, n.clone().negate()); spike.position.copy(n.clone().multiplyScalar(map.R - h / 2 + 0.3));
    root.add(spike);
  }
  // polvo cósmico flotando en el volumen
  const N = cfg().decor ? 400 : 120, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(map.R * 0.9 * Math.cbrt(Math.random())); pos.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.5, color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); root.add(dust);
  r.dyn.push((dt) => { dust.rotation.y += dt * 0.02; });
  addMotes(r, root, 160, 26); r.sun.position.set(0.2, 1, 0.1);
  r.sky = null;
}
