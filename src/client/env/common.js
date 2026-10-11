import * as THREE from 'three';
import { cfg } from '../quality.js';

// Elementos comunes del entorno (polvo, helpers). Dueño: agente de entorno.
/** Polvo cósmico que flota alrededor de la cámara (sensación de volumen y de gravedad cambiante). */
export function addMotes(r, root, n, radius) {
  const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(radius * Math.cbrt(Math.random())); pos.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.18, color: 0xc8d8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); m.frustumCulled = false; root.add(m);
  r.dyn.push((dt, t) => { m.position.copy(r.camera.position); m.rotation.y = t * 0.02; m.rotation.x = Math.sin(t * 0.1) * 0.1; });
}
