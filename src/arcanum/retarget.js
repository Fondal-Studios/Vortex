// Shared UAL retargeter extracted from opponent.js; no duplicated animation engine.
import * as THREE from 'three';
const V3 = () => new THREE.Vector3();
const _v = V3(), _v2 = V3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _bx = V3(), _by = V3(), _bz = V3();
function basisQ(x, y, out) {
  const X = _bx.copy(x).normalize(); const Y = _by.copy(y).addScaledVector(X, -y.dot(X)).normalize(); const Z = _bz.crossVectors(X, Y);
  _m.makeBasis(X, Y, Z); return out.setFromRotationMatrix(_m);
}
function frameRot(x0, y0, x1, y1, out) { const q0 = basisQ(x0, y0, new THREE.Quaternion()); return basisQ(x1, y1, out).multiply(q0.invert()); }

const DEFAULT_MAP = { Hips: 'DEF-hips', Spine: 'DEF-spine001', Spine1: 'DEF-spine002', Spine2: 'DEF-spine003', Neck: 'DEF-neck', Head: 'DEF-head' };
for (const [s, S] of [['Left', 'L'], ['Right', 'R']]) {
  Object.assign(DEFAULT_MAP, { [s + 'Shoulder']: `DEF-shoulder${S}`, [s + 'Arm']: `DEF-upper_arm${S}`, [s + 'ForeArm']: `DEF-forearm${S}`, [s + 'Hand']: `DEF-hand${S}`,
    [s + 'UpLeg']: `DEF-thigh${S}`, [s + 'Leg']: `DEF-shin${S}`, [s + 'Foot']: `DEF-foot${S}`, [s + 'ToeBase']: `DEF-toe${S}` });
  for (let i = 1; i <= 3; i++) {
    DEFAULT_MAP[`${s}HandThumb${i}`] = `DEF-thumb0${i}${S}`;
    for (const [f, F] of [['Index', 'index'], ['Middle', 'middle'], ['Ring', 'ring'], ['Pinky', 'pinky']]) DEFAULT_MAP[`${s}Hand${f}${i}`] = `DEF-f_${F}0${i}${S}`;
  }
}
const CHILD = { Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head' };
for (const s of ['Left', 'Right']) {
  Object.assign(CHILD, { [s + 'Shoulder']: s + 'Arm', [s + 'Arm']: s + 'ForeArm', [s + 'ForeArm']: s + 'Hand', [s + 'Hand']: s + 'HandMiddle1',
    [s + 'UpLeg']: s + 'Leg', [s + 'Leg']: s + 'Foot', [s + 'Foot']: s + 'ToeBase' });
  for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) { CHILD[`${s}Hand${f}1`] = `${s}Hand${f}2`; CHILD[`${s}Hand${f}2`] = `${s}Hand${f}3`; }
}
const UP_SEC = /Foot|Thumb/; // huesos cuyo eje secundario es "arriba" (apuntan hacia delante)
const CLIPS = { idle: 'Idle_Loop', cast: 'Spell_Simple_Shoot!', spellIdle: 'Spell_Simple_Idle_Loop!', hitChest: 'Hit_Chest', hitHead: 'Hit_Head', death: 'Death01', calm: 'Idle_Loop',
  pIdle: 'Pistol_Idle_Loop', pAim: 'Pistol_Aim_Neutral', pShoot: 'Pistol_Shoot', sIdle: 'Sword_Idle', sEnter: 'Spell_Simple_Enter' };

const sourceRest=new WeakMap();
// Clips extra para NPC con vida (caminar, hablar, interactuar…): solo los pide la NPC Factory, no el rival.
export const NPC_CLIPS = { walk: 'Walk_Loop', walkFormal: 'Walk_Formal_Loop', jog: 'Jog_Fwd_Loop', talk: 'Idle_Talking_Loop', interact: 'Interact',
  pickup: 'PickUp_Table', kneel: 'Fixing_Kneeling', crouch: 'Crouch_Idle_Loop', sit: 'Sitting_Idle_Loop', sitTalk: 'Sitting_Talking_Loop', torch: 'Idle_Torch_Loop', spellEnter: 'Spell_Simple_Enter!', spellExit: 'Spell_Simple_Exit!' };
/**
 * Redirige clips de una biblioteca (lib = { scene, animations }) a un esqueleto destino.
 * bones: { nombreCanónico → hueso destino }. extra: { clave → nombre del clip ('!' = espejado) }.
 * opts.mapa: { nombreCanónico → nombre del hueso ORIGEN tal como lo deja three.js } (por defecto, la UAL de Quaternius;
 * la fábrica de importación lo calcula con src/npc/huesos.js para Mixamo, Unreal, MakeHuman, BVH…).
 * opts.solo: usar solo `extra` (sin los clips del rival). opts.enSitio: claves que se dejan en el sitio (sin avance).
 */
export function retargetCharacterClips(lib, tgtRoot, bones, extra = null, opts = {}) {
    const MAP = opts.mapa || DEFAULT_MAP;
    const src=lib.scene;
    if(!sourceRest.has(src)){const poses=[];src.traverse(o=>poses.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]));sourceRest.set(src,poses)}
    const restore=()=>{for(const[o,p,q,s]of sourceRest.get(src)){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s)}src.updateMatrixWorld(true)};restore();
    const sb = {}; src.traverse((o) => { if (o.isBone || o.type === 'Object3D' || o.isObject3D) sb[o.name] = o; });
    const names = Object.keys(MAP).filter((n) => bones[n] && sb[MAP[n]]);
    // orden jerárquico (padres antes)
    const order = []; tgtRoot.traverse((o) => { const name=names.find(n=>bones[n]===o); if(name)order.push(name); });
    const restQ = (o) => o.getWorldQuaternion(new THREE.Quaternion()), restP = (o) => o.getWorldPosition(V3());
    const tRestQ = {}, tRestP = {}, sRestQ = {}, sRestP = {};
    for (const n of order) { tRestQ[n] = restQ(bones[n]); tRestP[n] = restP(bones[n]); sRestQ[n] = restQ(sb[MAP[n]]); sRestP[n] = restP(sb[MAP[n]]); }
    const restQ0 = {}; for (const n of Object.values(MAP)) if (sb[n]) restQ0[n] = restQ(sb[n]);
    const hipsParentQ = bones.Hips.parent.getWorldQuaternion(new THREE.Quaternion());
    const hipsParentInv = bones.Hips.parent.matrixWorld.clone().invert();
    const scale = tRestP.Hips.y / Math.max(0.3, sRestP.Hips.y);
    const mixer = new THREE.AnimationMixer(src);
    const out = {};
    const FWD = V3().set(0, 0, 1), UP = V3().set(0, 1, 0);
    for (const [key, clipSpec] of Object.entries(opts.solo ? extra || {} : extra ? { ...CLIPS, ...extra } : CLIPS)) {
      // '!' = animación espejada (los hechizos de la librería usan la mano izquierda; el rival lanza con la derecha)
      const mirror = clipSpec.endsWith('!'); const clipName = clipSpec.replace('!', '');
      const clip = lib.animations.find((c) => c.name === clipName); if (!clip) continue;
      const sname = (n) => MAP[mirror ? n.replace(/Left|Right/, (m) => (m === 'Left' ? 'Right' : 'Left')) : n];
      const mv = (v) => { if (mirror) v.x = -v.x; return v; };
      const mq = (q) => { if (mirror) { q.y = -q.y; q.z = -q.z; } return q; };
      mixer.stopAllAction(); const act = mixer.clipAction(clip); act.reset().play();
      const fps = 30, N = Math.max(2, Math.round(clip.duration * fps) + 1);
      const times = new Float32Array(N); const qv = {}; for (const n of order) qv[n] = new Float32Array(N * 4); const hp = new Float32Array(N * 3);
      const wq = {}; let bestT = 0, bestZ = -1e9; let prevZ = null;
      for (let f = 0; f < N; f++) {
        const t = Math.min(clip.duration, f / fps); times[f] = t; mixer.setTime(t); src.updateMatrixWorld(true);
        for (const n of order) {
          const so = sb[sname(n)]; const sQ = restQ(so); const delta = mq(sQ.clone().multiply(restQ0[sname(n)].clone().invert()));
          let Qw;
          const ch = CHILD[n];
          if (ch && sb[sname(ch)] && bones[ch]) {
            const x1 = mv(restP(sb[sname(ch)]).sub(restP(so)).normalize()); const x0 = tRestP[ch].clone().sub(tRestP[n]).normalize();
            const sec = UP_SEC.test(n) ? UP : FWD; const y1 = sec.clone().applyQuaternion(delta);
            Qw = frameRot(x0, sec, x1, y1, new THREE.Quaternion());
            Qw.multiply(tRestQ[n]);
          } else Qw = delta.multiply(tRestQ[n]);
          wq[bones[n].uuid] = Qw;
          const parent = bones[n].parent; let ancestor=parent;while(ancestor&&!wq[ancestor.uuid])ancestor=ancestor.parent;
          const pq=ancestor ? wq[ancestor.uuid].clone().multiply(ancestor.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(parent.getWorldQuaternion(new THREE.Quaternion()))) : parent.getWorldQuaternion(new THREE.Quaternion());
          const loc = pq.clone().invert().multiply(Qw); loc.toArray(qv[n], f * 4);
        }
        const sh = restP(sb[MAP.Hips]); const dH = mv(sh.sub(sRestP.Hips)).multiplyScalar(scale); if (key === 'death') { dH.x *= 0.25; dH.z *= 0.25; } if (/^(walk|walkFormal|jog)$/.test(key) || opts.enSitio?.includes(key)) { dH.x *= 0.3; dH.z = 0; } // en el sitio: el desplazamiento lo hace la locomoción
        const p = tRestP.Hips.clone().add(dH).applyMatrix4(hipsParentInv);
        p.toArray(hp, f * 3);
        if (key === 'cast') { const hz = restP(sb[sname('RightHand')]).z; if (prevZ !== null && t > clip.duration * 0.2) { const vz = (hz - prevZ) * fps; if (vz > bestZ) { bestZ = vz; bestT = t; } } prevZ = hz; }
      }
      void hipsParentQ;
      const tracks = order.map((n) => new THREE.QuaternionKeyframeTrack(`${bones[n].name}.quaternion`, times, qv[n]));
      tracks.push(new THREE.VectorKeyframeTrack(`${bones.Hips.name}.position`, times, hp));
      out[key] = new THREE.AnimationClip(key, clip.duration, tracks);
      if (key === 'cast') out[key].userData = { release: Math.max(0.2, bestT) };
    }
    mixer.stopAllAction();restore();return out;
  }

