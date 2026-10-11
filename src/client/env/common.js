import * as THREE from 'three';
import { cfg } from '../quality.js';
import { particleMat, particleGeo } from './props.js';

// Elementos comunes del entorno (polvo, helpers). Dueño: agente de entorno.
/** Polvo cósmico que flota alrededor de la cámara (sensación de volumen y de gravedad cambiante). */
export function addMotes(r, root, n, radius) {
  // motas redondas y suaves que derivan alrededor de la cámara (volumen, y gravedad cambiante)
  const g = particleGeo(n, (i, rd) => { const v = new THREE.Vector3().randomDirection().multiplyScalar(radius * Math.cbrt(rd())); return [v.x, v.y, v.z]; }, 11);
  const m = new THREE.Points(g, particleMat({ color: 0xc8d8ff, size: 0.12, mode: 1, amp: 1.2, alpha: 0.7 })); m.frustumCulled = false; root.add(m);
  r.dyn.push((dt, t) => { m.position.copy(r.camera.position); m.rotation.y = t * 0.02; m.rotation.x = Math.sin(t * 0.1) * 0.1; });
}
