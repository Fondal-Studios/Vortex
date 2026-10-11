// ARCANUM NPC FACTORY — rig universal (MakeHuman, 326 huesos): esqueleto de referencia, redirección de animaciones
// y formato binario de los clips de la biblioteca. Sin DOM: lo usan el juego (src/npc/store.js) y la fábrica de
// importación en Node (tools/fabrica-importacion.mjs), así una animación importada se ve igual en los dos.
import * as T from 'three';
import { retargetCharacterClips } from './retarget.js';

/** Nombre canónico (Mixamo) → hueso del rig MakeHuman horneado (assets/characters/narrative/model.json). */
export const ALIAS_MH = { Hips: 'spine05_h', Spine: 'spine04_h', Spine1: 'spine02_h', Spine2: 'spine01_h', Neck: 'neck01_h', Head: 'head_h' };
for (const [side, s] of [['Left', 'L'], ['Right', 'R']]) {
  Object.assign(ALIAS_MH, { [side + 'Shoulder']: `clavicle_${s}_h`, [side + 'Arm']: `upperarm01_${s}_h`, [side + 'ForeArm']: `lowerarm01_${s}_h`, [side + 'Hand']: `wrist_${s}_h`,
    [side + 'UpLeg']: `upperleg01_${s}_h`, [side + 'Leg']: `lowerleg01_${s}_h`, [side + 'Foot']: `foot_${s}_h`, [side + 'ToeBase']: `toe1-1_${s}_h` });
  for (const [i, f] of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].entries()) for (let j = 1; j <= 3; j++) ALIAS_MH[`${side}Hand${f}${j}`] = `finger${i + 1}-${j}_${s}_h`;
}

/** Esqueleto de referencia a partir de model.json. */
export function crearEsqueletoMH(model) {
  const group = new T.Group(), bones = {};
  const list = model.bones.map((b) => { const bone = new T.Bone(); bone.name = b.name; bone.position.fromArray(b.pos); bones[b.name] = bone; return bone; });
  model.bones.forEach((b, i) => (b.parent < 0 ? group : list[b.parent]).add(list[i]));
  group.updateMatrixWorld(true);
  return { group, bones, list, skeleton: new T.Skeleton(list) };
}

/**
 * Redirige clips de `lib` ({ scene, animations }) al rig MakeHuman. extra: { clave → nombre de clip }.
 * opts: { mapa (canónico → hueso origen), solo, enSitio } (ver retargetCharacterClips).
 */
export function redirigirAMakeHuman(lib, model, extra, opts = {}) {
  const rig = crearEsqueletoMH(model), mapped = {};
  for (const [k, v] of Object.entries(ALIAS_MH)) if (rig.bones[v]) mapped[k] = rig.bones[v];
  const clips = retargetCharacterClips(lib, rig.group, mapped, extra, opts);
  // En el rig MakeHuman la «cadera» de la librería (spine05) es hermana de la pelvis: el desplazamiento de cadera
  // movía solo el torso y las piernas quedaban colgadas de `root` (al sentarse o arrodillarse el torso bajaba y las
  // piernas flotaban). Se traslada esa pista a `root`, el padre común: torso y piernas bajan juntos.
  const hips = mapped.Hips, root = hips?.parent;
  if (root?.isBone && hips.position.lengthSq() < 1e-10) for (const c of Object.values(clips)) for (const tr of c.tracks) {
    if (tr.name !== hips.name + '.position') continue;
    tr.name = root.name + '.position'; const v = tr.values;
    for (let i = 0; i < v.length; i += 3) { v[i] += root.position.x; v[i + 1] += root.position.y; v[i + 2] += root.position.z; }
  }
  return clips;
}

// ---------------------------------------------------------------- formato binario de clips (biblioteca)
// Un .bin por paquete. Cada clip: tiempos (Float32 × n) y, por pista, cuaterniones en Int16 normalizados (× 32767)
// o posiciones en Float32. Todas las pistas de un clip comparten los tiempos (muestreo fijo a 30 cuadros/s).
// Entrada del manifiesto: { offset, n, duracion, pistas: [[nombreHueso, 'q'|'p'], …] }

/** Clips de three → { bin: Uint8Array, entradas: { clave → entrada } }. */
export function codificarClips(clips) {
  const partes = [], entradas = {}; let off = 0;
  const push = (arr) => { const pad = (4 - (off % 4)) % 4; if (pad) { partes.push(new Uint8Array(pad)); off += pad; } const u = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); partes.push(u.slice()); const o = off; off += u.length; return o; };
  for (const [clave, clip] of Object.entries(clips)) {
    const t0 = clip.tracks[0]; if (!t0) continue;
    const n = t0.times.length, e = { offset: push(new Float32Array(t0.times)), n, duracion: +clip.duration.toFixed(4), pistas: [] };
    if (clip.userData?.release) e.release = clip.userData.release;
    for (const tr of clip.tracks) {
      if (tr.times.length !== n) continue; // (todas comparten tiempos por construcción)
      const [hueso, prop] = tr.name.split('.');
      if (prop === 'quaternion') { const q = new Int16Array(tr.values.length); for (let i = 0; i < q.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, tr.values[i])) * 32767); push(q); e.pistas.push([hueso, 'q']); }
      else if (prop === 'position') { push(new Float32Array(tr.values)); e.pistas.push([hueso, 'p']); }
    }
    entradas[clave] = e;
  }
  const bin = new Uint8Array(off); let o = 0; for (const p of partes) { bin.set(p, o); o += p.length; }
  return { bin, entradas };
}

/** ArrayBuffer + entradas → { clave → THREE.AnimationClip }. pistasComunes: las del paquete (si la entrada no trae las suyas). */
export function decodificarClips(buffer, entradas, pistasComunes = null) {
  const out = {};
  for (const [clave, e] of Object.entries(entradas)) {
    let off = e.offset; const times = new Float32Array(buffer.slice(off, off + e.n * 4)); off += e.n * 4;
    const tracks = [];
    for (const [hueso, tipo] of e.pistas || pistasComunes || []) {
      if (tipo === 'q') { off += (4 - (off % 4)) % 4; const q = new Int16Array(buffer.slice(off, off + e.n * 8)); off += e.n * 8; const v = new Float32Array(q.length); for (let i = 0; i < q.length; i++) v[i] = q[i] / 32767; tracks.push(new T.QuaternionKeyframeTrack(hueso + '.quaternion', times, v)); }
      else { off += (4 - (off % 4)) % 4; const v = new Float32Array(buffer.slice(off, off + e.n * 12)); off += e.n * 12; tracks.push(new T.VectorKeyframeTrack(hueso + '.position', times, v)); }
    }
    out[clave] = new T.AnimationClip(clave, e.duracion, tracks);
    if (e.release) out[clave].userData = { release: e.release };
  }
  return out;
}
