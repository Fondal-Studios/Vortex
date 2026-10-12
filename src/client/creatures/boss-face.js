// Ayuda de los JEFES voladores: girar todo el cuerpo (rig) para que mire a la cámara EN 3D.
// Motivo: el motor (render.js › orient) solo orienta en el plano horizontal (m.u × m.f); si el jugador está muy abajo / arriba / en
// la pared opuesta (Mapa 2), la «cara» del jefe quedaba de canto y no se veía el ojo ni el punto débil. Aquí el modelo se corrige solo.
// Uso:  const F = makeFacer();  en tick:  F.step(dt, dirLocal, { rate, limit });  rig.quaternion.copy(F.q) (× balanceo propio)
//       F.toRig(v) → pasa un vector del espacio del `root` al del `rig` (ya girado) para ojos/rayos.
import * as THREE from 'three';

const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
export function makeFacer({ rate = 2.6, limit = 1.35 } = {}) {
  const q = new THREE.Quaternion(), tq = new THREE.Quaternion(), inv = new THREE.Quaternion(), m = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), r = new THREE.Vector3(), u = new THREE.Vector3();
  let init = false;
  return {
    q,
    /** dir: hacia dónde mirar (espacio del root). rateMul: más rápido (p. ej. al disparar). */
    step(dt, dir, rateMul = 1) {
      d.copy(dir); if (d.lengthSq() < 1e-6) d.set(0, 0, 1); d.normalize();
      // como mucho `limit` rad respecto al frente que da el motor (así por detrás sigue viéndose el lomo; no gira 180°)
      const ang = Math.acos(Math.max(-1, Math.min(1, d.z)));
      if (ang > limit) { const k = Math.sin(limit) / Math.max(Math.sin(ang), 1e-4); d.set(d.x * k, d.y * k, Math.cos(limit)); }
      // «arriba» continuo: se arrastra el arriba anterior para que no haya vuelcos al cruzar los polos
      u.copy(up).addScaledVector(d, -up.dot(d)); if (u.lengthSq() < 0.04) { u.copy(Math.abs(d.y) > 0.9 ? X : Y); u.addScaledVector(d, -u.dot(d)); } u.normalize(); up.copy(u);
      r.crossVectors(u, d).normalize(); u.crossVectors(d, r).normalize();
      m.makeBasis(r, u, d); tq.setFromRotationMatrix(m);
      if (!init) { q.copy(tq); init = true; } else q.slerp(tq, 1 - Math.exp(-rate * rateMul * Math.min(dt, 0.05)));
      return q;
    },
    /** Vector del espacio del root → espacio del rig girado (modifica y devuelve v). */
    toRig(v) { inv.copy(q).invert(); return v.applyQuaternion(inv); },
  };
}
