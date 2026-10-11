// Ayudas de pose sobre el esqueleto MakeHuman (todas trabajan en el espacio del mundo; llamar con las matrices al día).
//  · twoBoneIK: brazo/pierna de dos huesos hacia un objetivo, con «polo» (hacia dónde apunta el codo).
//  · setWorldQuat: fija la orientación de un hueso en el mundo.
//  · handBasis: orientación (adelante, arriba-pulgar) de una mano en la pose de enlace, para alinear armas y gestos.
import * as T from 'three';

const _p = new T.Vector3(), _q = new T.Quaternion(), _q2 = new T.Quaternion(), _m = new T.Matrix4();
const S = new T.Vector3(), E = new T.Vector3(), Wr = new T.Vector3(), D = new T.Vector3(), N = new T.Vector3(), E2 = new T.Vector3(), A = new T.Vector3(), B = new T.Vector3();

/** Orientación mundial deseada de un hueso (q) respetando a su padre. */
export function setWorldQuat(bone, q) {
  bone.parent.getWorldQuaternion(_q2).invert(); bone.quaternion.copy(_q2.multiply(q)); bone.updateMatrixWorld(true);
}
/** Gira el hueso `bone` (en el mundo) el cuaternión `dq`. */
function rotateWorld(bone, dq) {
  bone.getWorldQuaternion(_q); _q.premultiply(dq); setWorldQuat(bone, _q);
}
/**
 * Mueve `end` (muñeca/tobillo) hacia `target` doblando `upper` y `lower` (las articulaciones son los huesos «_h»).
 * hint: dirección del mundo hacia la que se abre el codo (si falta, se conserva el doblez actual). weight 0..1.
 */
export function twoBoneIK(upper, lower, end, target, hint = null, weight = 1) {
  if (weight <= 0.001) return;
  upper.updateWorldMatrix(true, true);
  upper.getWorldPosition(S); lower.getWorldPosition(E); end.getWorldPosition(Wr);
  const l1 = E.distanceTo(S), l2 = Wr.distanceTo(E); if (l1 < 1e-5 || l2 < 1e-5) return;
  D.copy(target).sub(S); let d = D.length(); if (d < 1e-5) return; D.divideScalar(d);
  d = Math.min(d, (l1 + l2) * 0.995); d = Math.max(d, Math.abs(l1 - l2) + 1e-3);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  // polo: la componente del hint (o del codo actual) perpendicular a la línea hombro→objetivo
  N.copy(hint || A.copy(E).sub(S)); N.addScaledVector(D, -N.dot(D)); if (N.lengthSq() < 1e-8) N.set(0, -1, 0).addScaledVector(D, D.y); N.normalize();
  E2.copy(S).addScaledVector(D, a).addScaledVector(N, h);
  // 1) hombro: la dirección hombro→codo pasa a hombro→codo nuevo
  A.copy(E).sub(S).normalize(); B.copy(E2).sub(S).normalize();
  _q2.setFromUnitVectors(A, B); if (weight < 1) _q2.slerp(new T.Quaternion(), 1 - weight); rotateWorld(upper, _q2);
  // 2) codo: la dirección codo→muñeca apunta al objetivo
  lower.updateWorldMatrix(true, true); lower.getWorldPosition(E); end.getWorldPosition(Wr);
  A.copy(Wr).sub(E).normalize(); B.copy(target).sub(E); if (B.lengthSq() < 1e-9) return; B.normalize();
  _q2.setFromUnitVectors(A, B); if (weight < 1) _q2.slerp(new T.Quaternion(), 1 - weight); rotateWorld(lower, _q2);
}

/** Base de una mano en la pose de enlace: { f: hacia los dedos, u: hacia el pulgar (perpendicular a f) } en coordenadas de reposo. */
export function handBasis(W, side) {
  const g = (n) => new T.Vector3(...W[n]);
  const wrist = g(`wrist_${side}_h`), f = g(`finger3-1_${side}_h`).sub(wrist).normalize();
  const u = g(`finger1-1_${side}_h`).sub(g(`finger5-1_${side}_h`)); u.addScaledVector(f, -u.dot(f)).normalize();
  return { f, u };
}
/** Cuaterniones: de la base de la mano en reposo a una base deseada (adelante, arriba) → orientación mundial de la muñeca. */
export function basisQuat(fromF, fromU, toF, toU) {
  const m0 = new T.Matrix4().makeBasis(fromF.clone().cross(fromU), fromU, fromF.clone().negate()); // x = f × u, y = u, z = −f
  const m1 = new T.Matrix4().makeBasis(toF.clone().cross(toU), toU, toF.clone().negate());
  const q0 = new T.Quaternion().setFromRotationMatrix(m0), q1 = new T.Quaternion().setFromRotationMatrix(m1);
  return q1.multiply(q0.invert());
}
void _p; void _m;
