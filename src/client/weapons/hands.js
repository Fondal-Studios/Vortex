// Manos y antebrazos en primera persona. Malla ORGÁNICA esqueletada (MakeHuman CC0, ver hand-rig.js / hand-data.js) con huesos de dedos:
// los dedos se CIERRAN contra la forma real de cada arma (se mide el cuerpo ya construido en el Kit), el índice se apoya en el gatillo y se flexiona
// al disparar (en el shader, ver handmat.js), el pulgar se coloca por cinemática inversa. Encima va el guante táctico (hand-gear.js) y los tatuajes (handmat.js).
// API para las armas (no cambia): rightHand(k, g, hex) -> pivote del índice · triggerFinger(k, g, pivot) · supportHand(k, c, R, hex, opts) · trigCurl · bindTrigger.
// Coordenadas del arma: x derecha, y arriba, z negativo hacia la boca. Todo va en la capa 'g' (material compartido).
import * as THREE from 'three';
import { Kit } from './kit.js';
import { HU } from './handmat.js';
import { Pose, handLod, collectSolids, TriGrid, distTris, distCyl, closeFinger, fitThumb, FINGERS, REST, ARM } from './hand-rig.js';
import { handGeoms, armFrame } from './hand-gear.js';

export const HAND_SCALE = +(((typeof location !== "undefined" && new URLSearchParams(location.search).get("hs2")) || 1.42)); // las armas son ~1.6x el tamaño real: la mano sigue esa escala
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CP = V(0, -0.0245, 0.05);                 // centro de la palma (en el marco local de la mano)
const BASIS_GRIP = [V(0, 1, 0), V(1, 0, 0), V(0, 0, -1)];   // X (pulgar) -> +y · Y (dorso) -> +x · Z (dedos) -> -z : mano derecha agarrando una empuñadura vertical
const BASIS_UNDER = [V(0, 0, -1), V(0, -1, 0), V(-1, 0, 0)]; // palma hacia arriba, dedos hacia -x (mano derecha en el mundo espejo = izquierda real)
const BASIS_OVER = [V(0, 0, 1), V(0, 1, 0), V(-1, 0, 0)];   // palma hacia abajo (mano por encima del tubo), pulgar hacia el tirador, dedos hacia -x
const ABD = [0, -0.1, 0.07, 0.2, 0.3]; // aducción de reposo por dedo para que queden paralelos

function makeRoot(pc, basis, euler, S) {
  const Rb = new THREE.Matrix4().makeBasis(basis[0], basis[1], basis[2]);
  return new THREE.Matrix4().makeTranslation(pc.x, pc.y, pc.z).multiply(new THREE.Matrix4().makeRotationFromEuler(euler)).multiply(Rb).multiply(new THREE.Matrix4().makeScale(S, S, S)).multiply(new THREE.Matrix4().makeTranslation(-CP.x, -CP.y, -CP.z));
}

/** Gira el antebrazo (hueso `arm`) hacia `want` (dirección deseada del codo, en el espacio de resolución), con tope de ángulo. */
function bendArm(pose, H, want, maxAng = 0.7) {
  const A = armFrame(H), nat = A.dir.clone().transformDirection(pose.W[0]), qd = new THREE.Quaternion().setFromUnitVectors(nat, want.clone().normalize());
  const ang = 2 * Math.acos(Math.min(1, Math.abs(qd.w))); if (ang > maxAng) qd.slerp(new THREE.Quaternion(), 1 - maxAng / ang);
  const pw = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(pose.W[0]));
  pose.q[ARM].copy(pw.clone().invert().multiply(qd).multiply(pw)); pose.update();
}

/** Índice hacia el gatillo: busca (rejilla gruesa) los ángulos que acercan la yema al objetivo. */
function reachIndex(pose, target, abd) {
  const b = FINGERS.index, P = V(), best = { e: 1e9, a: [0.3, 0.5, 0.3] }, tip = V(), j3 = V(), dir = V();
  for (let a1 = 0; a1 <= 0.9; a1 += 0.08) for (let a2 = 0; a2 <= 1.5; a2 += 0.1) for (let a3 = 0; a3 <= 1.0; a3 += 0.12) {
    pose.q[b[0]].setFromEuler(new THREE.Euler(a1, abd, 0, 'YXZ')); pose.q[b[1]].setFromEuler(new THREE.Euler(a2, 0, 0)); pose.q[b[2]].setFromEuler(new THREE.Euler(a3, 0, 0)); pose.update();
    pose.tip(1, tip); pose.joint(b[2], j3); dir.copy(tip).sub(j3).normalize(); P.copy(tip).addScaledVector(dir, -0.0075 * HAND_SCALE); // yema (un poco antes de la punta)
    const e = P.distanceTo(target) + 0.012 * Math.abs(a3 - a2 * 0.55) + 0.004 * a1; if (e < best.e) { best.e = e; best.a = [a1, a2, a3]; }
  }
  const a = best.a; pose.q[b[0]].setFromEuler(new THREE.Euler(a[0], abd, 0, 'YXZ')); pose.q[b[1]].setFromEuler(new THREE.Euler(a[1], 0, 0)); pose.q[b[2]].setFromEuler(new THREE.Euler(a[2], 0, 0)); pose.update();
  return best;
}

/* ───────────────────────── trabajos de mano (se resuelven cuando el arma ya está completa) ───────────────────────── */
// Las armas llaman a rightHand/supportHand a mitad de su construcción (todavía faltan correderas, cañones...). Para que los dedos y el pulgar
// respeten el arma ENTERA, aquí sólo se registra el trabajo (y se calcula el pivote del índice, que no depende del resto) y se resuelve
// la primera vez que hace falta: en triggerFinger() o justo antes del primer Kit.build().
const _pending = new WeakMap(), _byG = new WeakMap();
const regJob = (k, job) => { let l = _pending.get(k); if (!l) _pending.set(k, (l = [])); l.push(job); return job; };
const _kitBuild = Kit.prototype.build;
Kit.prototype.build = function build(name, mats) { const l = _pending.get(this); if (l) { _pending.delete(this); for (const j of l) emitJob(j); } return _kitBuild.call(this, name, mats); };

function gripMetrics(k, g) {
  const solids = collectSolids(k, [-0.14, g.top - 0.24, g.zc - 0.2, 0.14, g.top + 0.12, g.zc + 0.2]);
  let gx = -9, zF = 9;
  for (let i = 0; i < solids.length; i += 3) { const x = solids[i], y = solids[i + 1], z = solids[i + 2]; if (y < g.top - 0.06 && y > g.top - 0.17 && Math.abs(x) < 0.05 && z > g.zc - 0.09 && z < g.zc + 0.1) { gx = Math.max(gx, x); zF = Math.min(zF, z); } }
  if (gx < -8) { gx = g.hw; zF = g.zc - g.d / 2; }
  return { gx, zF };
}
const dbgOn = () => !!globalThis.__HANDDBG;
const QP = (k) => { try { return new URLSearchParams(location.search).get(k); } catch { return null; } };   // pruebas: ?arm=x,y,z,ang (dirección del codo, sólo desarrollo)
const armDev = (def, ang) => { const a = QP('arm'); if (!a) return [def, ang]; const v = a.split(',').map(Number); return [V(v[0], v[1], v[2]), v[3] || ang]; };

function solveRight(job) {
  const { k, g, H, S } = job, pose = new Pose(H), t0 = performance.now(), rad = 0.0092 * S;
  const solids = collectSolids(k, [-0.16, g.top - 0.24, g.zc - 0.24, 0.16, g.top + 0.14, g.zc + 0.24]), grid = new TriGrid(solids), dist = (p) => grid.dist(p, rad + 0.012);
  pose.root = job.root.clone(); pose.update();
  for (const fi of [2, 3, 4]) closeFinger(pose, fi, dist, { rad, abd: ABD[fi], base: [0.25, 0.3, 0.15] });
  reachIndex(pose, V(0, job.yT, g.zc - 0.072), ABD[1]);
  const yTh = g.top + 0.024, zTh = g.zc - 0.03; let xL = -g.hw - 0.002; for (let x = -0.12; x < 0.0; x += 0.002) if (grid.dist(V(x, yTh, zTh), 0.01) < 0.004) { xL = x; break; }
  const fr = fitThumb(pose, dist, V(xL - 0.0095 * S, yTh, zTh), { rad: 0.0095 * S + 0.001 });
  if (dbgOn()) console.log('  thumb xL', xL.toFixed(3), 'y', yTh.toFixed(3), 'z', zTh.toFixed(3), 'tipErr', fr.tipErr.toFixed(3), 'tip', pose.tip(0).toArray().map((x) => x.toFixed(3)).join(','), 'J2', pose.joint(2).toArray().map((x) => x.toFixed(3)).join(','), 'J3', pose.joint(3).toArray().map((x) => x.toFixed(3)).join(','));
  bendArm(pose, H, V(-0.15, -0.5, 0.85));
  if (dbgOn()) console.log('  [mano der]', (performance.now() - t0).toFixed(0) + 'ms', 'sólidos', solids.length / 9);
  return pose;
}
function solveSupport(job) {
  const { k, c, R, axis, flip, H, S } = job, pose = new Pose(H), t0 = performance.now(), cm = [-c[0], c[1], c[2]], rad = 0.0092 * S, margin = 0.003;
  const solids = collectSolids(k, [c[0] - 0.3, c[1] - 0.3, c[2] - 0.35, c[0] + 0.3, c[1] + 0.3, c[2] + 0.35]); for (let i = 0; i < solids.length; i += 3) solids[i] = -solids[i]; // mundo espejo
  const grid = new TriGrid(solids), cyl = distCyl(cm, axis, R), dist = (p) => Math.min(cyl(p), grid.dist(p, rad + 0.012));
  if (axis === 'y') {
    pose.root = makeRoot(V(cm[0] + R + margin, c[1], c[2] - R + 0.006 + 0.0464 * S), BASIS_GRIP, new THREE.Euler(0, -0.5, 0), S); pose.update();
    for (const fi of [1, 2, 3, 4]) closeFinger(pose, fi, dist, { rad, abd: ABD[fi], base: [0.25, 0.3, 0.15] });
    fitThumb(pose, dist, V(cm[0] - R - 0.0095 * S, c[1] + 0.045, c[2] - R * 0.3), { rad: rad + 0.001 }); bendArm(pose, H, ...armDev(V(0.5, -0.5, 0.7), 0.7));
  } else {
    const over = QP('over') === '1';
    if (over) pose.root = makeRoot(V(cm[0] + 0.05 - 0.3 * R, c[1] + R + margin, c[2] + 0.004), BASIS_OVER, new THREE.Euler(0, -0.5, 0), S); else
    pose.root = makeRoot(V(cm[0] + 0.062 - 0.3 * R, c[1] - R - margin, c[2] - 0.004), BASIS_UNDER, new THREE.Euler(0, -0.5, 0), S); pose.update();
    for (const fi of [1, 2, 3, 4]) closeFinger(pose, fi, dist, { rad, abd: ABD[fi] * 0.6, base: [0.2, 0.3, 0.15] });
    fitThumb(pose, dist, over ? V(cm[0] - 0.01, c[1] - R * 0.2, c[2] + R + 0.02) : V(cm[0] + R + 0.0095 * S, c[1] + R * 0.25, c[2] - 0.06 - 0.02 * S), { rad: rad + 0.001 });
    bendArm(pose, H, ...armDev(V(0.7 * flip, -0.45, 0.55), 0.7));
  }
  if (dbgOn()) console.log('  [mano izq]', (performance.now() - t0).toFixed(0) + 'ms', 'sólidos', solids.length / 9);
  return pose;
}
const ensure = (job) => { if (!job.pose) job.pose = job.kind === 'right' ? solveRight(job) : solveSupport(job); return job.pose; };

/* ───────────────────────── ensamblado de geometría ───────────────────────── */
/** Refleja una geometría no indexada en X (mano izquierda): invierte el orden de los vértices de cada triángulo. */
function mirrorGeom(g) {
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name], s = a.itemSize, arr = a.array;
    if (name === 'position' || name === 'normal') for (let i = 0; i < arr.length; i += 3) arr[i] = -arr[i];
    for (let t = 0; t < arr.length; t += s * 3) for (let c = 0; c < s; c++) { const x = arr[t + s + c]; arr[t + s + c] = arr[t + 2 * s + c]; arr[t + 2 * s + c] = x; }
    a.needsUpdate = true;
  }
}
/** Añade a una geometría de gear/dedo los atributos del índice (pesos de falange, articulaciones y eje de flexión, ya en el espacio de la pieza). */
function addFinger(g, J2, J3, ax) {
  const n = g.attributes.position.count, FW = g.attributes.fw ? null : new Float32Array(n * 3), j2 = new Float32Array(n * 3), j3 = new Float32Array(n * 3), fx = new Float32Array(n * 3), kd = g.attributes.kind.array;
  for (let i = 0; i < n; i++) { j2.set([J2.x, J2.y, J2.z], i * 3); j3.set([J3.x, J3.y, J3.z], i * 3); fx.set([ax.x, ax.y, ax.z], i * 3); if (FW) { const jb = Math.floor(kd[i] / 16) % 3; FW[i * 3 + jb] = 1; } }
  if (FW) g.setAttribute('fw', new THREE.BufferAttribute(FW, 3));
  g.setAttribute('fj2', new THREE.BufferAttribute(j2, 3)); g.setAttribute('fj3', new THREE.BufferAttribute(j3, 3)); g.setAttribute('fax', new THREE.BufferAttribute(fx, 3));
}
/** Empuja geometrías (en el espacio de resolución) a una parte del Kit (arreglo `part.g`), aplicando su matriz de pila (pivote) y el reflejo si hace falta. */
function flush(part, M, geoms, { mirror = false, fin = null } = {}) {
  for (const g of geoms) {
    if (!g.attributes.rs) { const n = g.attributes.position.count, r = new Float32Array(n * 4); for (let i = 0; i < n; i++) r[i * 4 + 3] = -2; g.setAttribute('rs', new THREE.BufferAttribute(r, 4)); }
    if (mirror) mirrorGeom(g);
    if (fin) { const J2 = fin.J2.clone(), J3 = fin.J3.clone(), A = fin.ax.clone(); addFinger(g, J2.applyMatrix4(M), J3.applyMatrix4(M), A); }
    g.applyMatrix4(M); part.g.push(g);
  }
}
const temp = (k) => { const T = new Kit(k.q); T.part('h'); return T; };
function emitJob(job) {
  if (job.emitted) return; job.emitted = true; const pose = ensure(job), T = temp(job.k);
  flush(job.part, job.M, handGeoms(T, job.H, pose, 'main', { arm: job.arm }), { mirror: job.kind === 'support' });
}

/* ───────────────────────── API ───────────────────────── */

/**
 * Mano derecha sobre la empuñadura. g = {zc (centro en z), top (y del borde superior), d (profundidad), hw (semiancho)}.
 * Mide el arma ya construida para que los dedos medio, anular y meñique envuelvan la empuñadura real; el índice y el pulgar se arman aparte.
 * Devuelve el pivote del índice (su nudillo) para `k.part('trigger', pivote)`.
 */
export function rightHand(k, g, hex, { arm = true } = {}) { // eslint-disable-line no-unused-vars
  const H = handLod(k.q.low ? 'lo' : 'hi'), S = HAND_SCALE, { gx, zF } = gripMetrics(k, g), yT = g.top - 0.02;
  const pc = V(gx + 0.003, yT - 0.0246 * S, zF + 0.006 + 0.0464 * S), root = makeRoot(pc, BASIS_GRIP, new THREE.Euler(0, -0.5, 0), S);
  const job = regJob(k, { kind: 'right', k, g, H, S, arm, root, yT, part: k.cur, M: k.stack[k.stack.length - 1].clone(), pose: null, emitted: false });
  _byG.set(g, job); return REST[FINGERS.index[0]].clone().applyMatrix4(root).toArray();
}

/** Dedo índice: pieza con pivote en el nudillo (`k.part('trigger', pivot)` antes). Descansa en el gatillo y se flexiona con trigCurl(). */
export function triggerFinger(k, g, pivot, reach) { // eslint-disable-line no-unused-vars
  const job = _byG.get(g); if (!job) return g.top;
  const pose = ensure(job), T = temp(k), b = FINGERS.index, W = pose.W[b[0]].elements;
  const J2 = pose.joint(b[1]), J3 = pose.joint(b[2]), ax = V(W[0], W[1], W[2]).normalize();
  flush(k.cur, k.stack[k.stack.length - 1], handGeoms(T, job.H, pose, 'index', { arm: false }), { fin: { J2, J3, ax } });
  return g.top;
}

/** Fija el curvado del índice (0..1) en la pieza `trigger` de un arma. */
export function trigCurl(P, c) { if (P.trigger) P.trigger.userData.curl = c; }
/** Conecta la curva del índice al dibujo (el material es compartido): se llama una vez tras construir las piezas. */
export function bindTrigger(P) {
  if (!P.trigger) return;
  P.trigger.userData.curl = 0; // en reposo el índice respira y tiembla un poco (se suma en onBeforeRender)
  P.trigger.traverse((o) => { if (o.isMesh) o.onBeforeRender = () => { const t = HU.uTime.value; HU.uTrig.value = Math.min(1, (P.trigger.userData.curl || 0) + 0.05 + 0.03 * Math.sin(t * 1.7) + 0.015 * Math.sin(t * 5.3)); }; });
}

/**
 * Mano izquierda de apoyo. c = [x,y,z] centro del tubo, R = radio, axis = 'z' (guardamanos) o 'y' (empuñadura vertical).
 * Se resuelve como una mano derecha en el «mundo espejo» y se refleja al final.
 */
export function supportHand(k, c, R, hex, { axis = 'z', arm = true, flip = 1 } = {}) { // eslint-disable-line no-unused-vars
  regJob(k, { kind: 'support', k, c, R, axis, flip, arm, H: handLod(k.q.low ? 'lo' : 'hi'), S: HAND_SCALE, part: k.cur, M: k.stack[k.stack.length - 1].clone(), pose: null, emitted: false });
}
