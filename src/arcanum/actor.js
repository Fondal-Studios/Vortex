// ARCANUM NPC FACTORY — actor 3D construido a partir de una definición de datos.
// MISMO PERSONAJE, DISTINTA REPRESENTACIÓN: el nivel de calidad cambia detalle, sombras, partículas y LOD,
// nunca la definición ni los assets originales.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { assertNPC, resolveVisibility } from './schema.js';
import { SKINS, HAIR, EYEBROWS, OUTFITS, PALETTES, AFFINITIES, ANIMATION_SETS, BASES, BEARDS, meshesFor, fabricId } from './library.js';
import { deformPositions } from './deform.js';
import { CLIP_SPEED } from './locomotion.js';
import { npcProfile } from './quality.js';
import { buildClothLayers, buildBeard, buildRigid, buildHeld, makeProfile, fabricTexture, strandTexture } from './parts.js';
import { npcTier, skinMaterial, eyeMaterial, hairMaterial, beardMaterial, fabricMaterial, eyeIndex, restAttribute } from './materials.js';

// Perfil de representación: una sola fuente de verdad en src/core/quality.js (PRESETS[q].npc).
export function npcQuality(q, { movil = false } = {}) {
  const p = npcProfile(q, { movil });
  return { detail: p.accessoryDetail + 1, shadows: p.shadows, particles: p.particles, lodDistance: p.lodDistance, textureMax: p.textureMax, facial: p.facial, normalMaps: p.normalMaps, lite: p.lite, lod: !!p.lod };
}

const PARTICLES = { brasas: { color: '#ffb46b', rise: 0.25, size: 0.018, blend: T.AdditiveBlending }, gotas: { color: '#9fd8ff', rise: -0.12, size: 0.014, blend: T.AdditiveBlending },
  polvo: { color: '#c8b28a', rise: 0.04, size: 0.012, blend: T.NormalBlending }, brisa: { color: '#e4fff6', rise: 0.02, size: 0.012, blend: T.AdditiveBlending, swirl: 2.4 },
  ceniza: { color: '#3c3346', rise: 0.15, size: 0.016, blend: T.NormalBlending }, burbujas: { color: '#b6f5a0', rise: 0.1, size: 0.012, blend: T.AdditiveBlending } };

function dominantFor(entry, names) {
  if (entry.dominant) return entry.dominant;
  const si = entry.attrs.skinIndex.array, sw = entry.attrs.skinWeight.array, n = entry.attrs.position.count, d = new Array(n);
  for (let i = 0; i < n; i++) { let best = 0; for (let k = 1; k < 4; k++) if (sw[i * 4 + k] > sw[i * 4 + best]) best = k; d[i] = names[si[i * 4 + best]]; }
  return (entry.dominant = d);
}

// ------------------------------------------------------------------ ACTUACIÓN (capa procedural sobre los clips)
// Huesos que mueve la capa procedural. Los que no están acá los maneja solo el mezclador.
const PROC_BONES = ['root', 'spine05_h', 'upperleg01_L_h', 'upperleg01_R_h', 'lowerleg01_L_h', 'lowerleg01_R_h', 'spine04_h', 'spine03_h', 'spine02_h', 'spine01_h', 'neck01_h', 'neck02_h', 'head_h', 'shoulder01_L_h', 'shoulder01_R_h', 'jaw_h',
  'clavicle_L_h', 'clavicle_R_h', 'upperarm01_L_h', 'upperarm01_R_h', 'lowerarm01_L_h', 'lowerarm01_R_h', 'wrist_L_h', 'wrist_R_h',
  ...['L', 'R'].flatMap((s) => [1, 2, 3, 4, 5].flatMap((f) => [1, 2, 3].map((j) => `finger${f}-${j}_${s}_h`))),
  'eye_L_h', 'eye_R_h', 'orbicularis03_L_h', 'orbicularis04_L_h', 'orbicularis03_R_h', 'orbicularis04_R_h', 'oculi01_L_h', 'oculi01_R_h'];
const LADOS = ['L', 'R'].map((s) => ({ up: 'orbicularis03_' + s + '_h', lo: 'orbicularis04_' + s + '_h', brow: 'oculi01_' + s + '_h' }));
const LOCO = new Set(['walk', 'walkFormal', 'jog', ...Object.keys(CLIP_SPEED)]); // (+ caminatas de la biblioteca)
const LOW = new Set(['kneel', 'sit', 'sitTalk', 'crouch']);           // bajar / subir el cuerpo: transición más larga
const QUICK = new Set(['revive', 'spellEnter', 'spellExit', 'cast', 'hitChest', 'hitHead', 'shoot', 'hit', 'punch', 'jump', 'land']);
const ONCE = new Set(['death', 'revive', 'land', 'hit', 'jump', 'shoot', 'punch', 'reload', 'cast', 'interact']); // se reproducen una vez y quedan en la última pose
const ONESHOT = new Set(['interact', 'pickup', 'kneel', 'spellEnter', 'spellExit', 'cast', 'hitChest', 'hitHead', ...ONCE]); // empiezan desde el principio
const IDLE = new Set(['calm', 'idle', 'talk', 'spellIdle', 'torch']); // en estos se nota el cambio de peso
// Tramo que se repite (ida y vuelta) mientras se mantiene el clip: arrodillarse baja una vez y sigue examinando.
const HOLD = { kneel: [0.95, 4.05] };
// CAPAS: cada clip se parte en dos clips con los mismos tiempos: «lo» (raíz, cadera, piernas) y «up» (columna, brazos, dedos, cuello).
// Cada mitad tiene su propio mezclador de pesos: así las piernas siguen al clip de locomoción mientras el torso apunta o dispara.
const LOWER = /^(root|spine05_h|pelvis|upperleg|lowerleg|foot|toe)/;
function splitClip(clip, key) {
  const part = (keep) => { const c = new T.AnimationClip(key, clip.duration, clip.tracks.filter((t) => keep === LOWER.test(t.name)).map((t) => t.clone())); if (clip.userData) c.userData = clip.userData; return c; };
  return { lo: part(true), up: part(false) };
}
const keyPhase = (key) => ((hash(key) % 997) / 997);
/** Un mezclador de capa: un peso por clip que se acerca a 1 (el actual) o a 0 (los demás). */
const makeGroup = (acts) => ({ layers: Object.entries(acts).map(([key, action]) => ({ key, action, w: 0 })), current: null, currentKey: null, fade: 0.4, holdDir: 1, prevKey: null });
/** Duración del fundido entre dos clips (s). */
export function fadeFor(from, to) {
  if (LOW.has(from) || LOW.has(to)) return 0.75;
  if (QUICK.has(to) || QUICK.has(from)) return 0.25;
  if (LOCO.has(from) || LOCO.has(to)) return 0.32;
  return 0.42;
}
// Gestos de cabeza. Los asentimientos bajan y vuelven (1 − cos): empiezan y terminan en reposo, sin salto.
// eje x = asentir, y = negar, z = inclinar. f = rad/s, a = amplitud (rad), una = un solo asentimiento lento.
export const GESTOS = {
  nod: { eje: 'x', f: 7, a: 0.09 }, nodFast: { eje: 'x', f: 12, a: 0.1 }, nodSmall: { eje: 'x', f: 6.5, a: 0.045 },
  nodSlow: { eje: 'x', f: 2.6, a: 0.17, una: true }, shake: { eje: 'y', f: 8, a: 0.14 }, tilt: { eje: 'z', f: 0, a: 0.11 },
};
// Semilla estable por personaje: nadie respira, se balancea ni parpadea en sincronía con otro.
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function persona(id) {
  let st = hash(String(id || 'npc')) || 1;
  const rnd = () => { st = (st + 0x6d2b79f5) | 0; let t = Math.imul(st ^ (st >>> 15), 1 | st); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { rnd, fase: rnd(), ritmo: 0.93 + rnd() * 0.14, respira: 0.2 + rnd() * 0.09, balanceo: 0.045 + rnd() * 0.04, balanceoFase: rnd() * 6.283, lado: rnd() < 0.5 ? -1 : 1 };
}
function actingState() {
  return { blinkT: 1 + Math.random() * 3, blink: -1, doble: false, sacT: 0.5, sacY: 0, sacP: 0, eyeY: 0, eyeP: 0,
    glanceT: 3 + Math.random() * 5, glance: 0, gY: 0, gP: 0, gW: 0, jaw: 0, jawTo: 0, jawT: 0, beatT: 0.6, beat: 0, beatY: 0, emph: 0,
    hablaba: false, gesto: null, gestoT: 0, gestoW: 0, idleW: 0 };
}
/** Cambia el clip objetivo de una capa; el peso de cada clip se mueve hacia él en blend (fundido sin saltos). */
function setMotion(b, g, key, fade) {
  const layer = g.layers.find((l) => l.key === key); if (!layer || layer === g.current) return;
  const next = layer.action;
  if (layer.w <= 0.001) {
    next.reset(); next.enabled = true; next.setLoop(ONCE.has(key) ? T.LoopOnce : T.LoopRepeat, Infinity); next.clampWhenFinished = ONCE.has(key); next.play(); next.setEffectiveWeight(0);
    // Los clips cíclicos empiezan en una fase propia de cada personaje (igual en las dos capas: brazos y piernas van acompasados); los de una vez, desde el principio.
    if (!ONESHOT.has(key)) next.time = ((b.persona.fase + keyPhase(key)) % 1) * next.getClip().duration;
    if (key === 'revive') next.time = next.getClip().duration; // levantarse = la caída al revés
  }
  g.prevKey = g.currentKey; g.current = layer; g.currentKey = key; g.fade = fade; g.holdDir = 1;
  // Sin fundido (el personaje se coloca fuera de cuadro o con la pantalla en negro): ya está en la pose, y si el clip
  // tiene un tramo sostenido (arrodillado), ya está abajo.
  if (fade === 0) { for (const l of g.layers) { l.w = l === layer ? 1 : 0; if (!l.w) l.action.stop(); } if (HOLD[key]) next.time = HOLD[key][0]; }
}

/** Crea un NPC. quality: 'low'|'medium'|'high'|'ultra' (o perfil). Devuelve una API síncrona con `ready`. */
export function createNpcActor(store, definition, { quality = 'medium', movil = false } = {}) {
  const root = new T.Group(); root.name = 'npc';
  let def = null, built = null, profileQ = typeof quality === 'string' ? npcQuality(quality, { movil }) : quality, time = 0, status = 'loading';
  const tmp = new T.Vector3(), tmp2 = new T.Vector3(), tmp3 = new T.Vector3(), q0 = new T.Quaternion(), up = new T.Vector3(0, 1, 0), eul = new T.Euler();

  async function build(input) {
    const d = assertNPC(input), vis = resolveVisibility(d);
    await store.ready;
    const model = store.model, names = model.bones.map((b) => b.name);
    const needed = meshesFor(d).filter((m) => m !== 'shoes02' || vis.shoes).filter((m) => m !== HAIR[d.hair]?.mesh || vis.hair);
    const lod = !!profileQ.lod; // mallas decimadas (assets/arcanum/narrative/lod.*): ≈ 9 k triángulos por persona
    const load = (n) => (lod ? (n === 'body' ? store.mesh('body@' + (OUTFITS[d.outfit] ? d.outfit : 'none'), true, 'body') : store.mesh(n, true)) : store.mesh(n));
    const [entries, clips, bodyData] = await Promise.all([Promise.all(needed.map(load)), store.animationClips(), store.body(lod)]);
    const byName = Object.fromEntries(entries.map((e) => [e.name, e]));
    const textures = {}; const files = new Set([SKINS[d.skin].file, 'HighPolyEyes-color.png']);
    if (OUTFITS[d.outfit]) { files.add(d.outfit + '-color.png'); if (OUTFITS[d.outfit].normal && profileQ.normalMaps !== false) files.add(d.outfit + '-normal.png'); }
    if (vis.hair && HAIR[d.hair].mesh) files.add(HAIR[d.hair].mesh + '-color.png');
    if (EYEBROWS[d.eyebrows].mesh) files.add(EYEBROWS[d.eyebrows].mesh + '-color.png');
    if (vis.shoes) files.add('shoes02-color.png');
    await Promise.all([...files].map(async (f) => { textures[f] = await store.texture(f); }));
    const mask = OUTFITS[d.outfit] && !lod ? await store.bodyMask(d.outfit) : null;

    const rig = store.createSkeleton(), group = new T.Group(); group.add(rig.group);
    const materials = new Set(), geometries = new Set(), meshes = {}, detailOnly = [];
    const mat = (o) => { const m = new T.MeshStandardMaterial(o); materials.add(m); return m; };
    const palette = { ...PALETTES[d.palette], ...d.colors }, affinity = AFFINITIES[d.magicAffinity];
    if (affinity.tinte) palette.secundario = '#' + new T.Color(palette.secundario).lerp(new T.Color(affinity.tinte), 0.25).getHexString();
    const deformed = {};
    // Materiales de alta fidelidad (src/npc/materials.js): mismo número de draw calls, más detalle según la calidad.
    const tier = npcTier(profileQ.detail), aff = d.magicAffinity;
    const dirt = aff === 'earth' ? 0.9 : aff === 'alchemist' ? 0.6 : aff === 'demonic' || d.role === 'reclutador' ? 0.12 : 0.4;
    const flush = aff === 'demonic' ? 0.35 : aff === 'fire' ? 1.1 : 1;
    // Mallas MakeHuman: atributos compartidos entre NPC, posición propia (proporciones).
    for (const e of entries) {
      const g = new T.BufferGeometry(); for (const [k, a] of Object.entries(e.attrs)) if (k !== 'position' && k !== 'index') g.setAttribute(k, a);
      const pos = deformPositions(e.base, new Float32Array(e.base.length), d.body); deformed[e.name] = pos;
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      const hair = e.name === HAIR[d.hair]?.mesh, brow = e.name === EYEBROWS[d.eyebrows]?.mesh, eyes = e.name === 'HighPolyEyes', skin = e.name === 'body', outfit = e.name === d.outfit;
      if (skin || eyes) g.setAttribute('npcRest', restAttribute(e)); // posición sin proporciones: máscaras de rostro y ojos
      g.setIndex(skin && mask ? mask : eyes ? eyeIndex(e) : e.attrs.index); if (eyes && profileQ.lite) g.setDrawRange(0, e.eyeGlobe); g.computeBoundingSphere(); geometries.add(g);
      const file = skin ? SKINS[d.skin].file : eyes ? 'HighPolyEyes-color.png' : e.name + '-color.png';
      const m = mat({ map: textures[file], normalMap: outfit ? textures[e.name + '-normal.png'] || null : null, roughness: eyes ? 0.17 : hair || brow ? 0.78 : skin ? 0.62 : 0.9, metalness: 0,
        side: hair ? T.DoubleSide : T.FrontSide, alphaTest: hair ? 0.45 : brow ? 0.3 : 0, transparent: false });
      if (skin && d.skinTint) m.color.set(d.skinTint);
      if (skin) skinMaterial(m, { tier, flush, edad: BASES[d.base].edad, barba: BEARDS[d.beard]?.capas ? { capas: BEARDS[d.beard].capas, color: d.beardColor || d.hairColor } : null });
      if (eyes) eyeMaterial(m, { tier });
      if (outfit) {
        if (d.clothTop) {
          // tinte por zonas (sudadera arriba, pantalón abajo) y trama de tela por zonas: lana arriba, lona abajo
          const pa = e.attrs.position, fb = new Float32Array(pa.count * 2); for (let i = 0; i < pa.count; i++) { fb[i * 2] = pa.getY(i) > 0.97 ? fabricId('lana') : fabricId('lona'); fb[i * 2 + 1] = 1; }
          g.setAttribute('npcFab', new T.BufferAttribute(fb, 2)); m.color.set('#ffffff');
          fabricMaterial(m, { tier, mode: 'garment', dirt, top: d.clothTop, bottom: d.clothBottom });
        } else { m.color.set(palette.secundario).lerp(new T.Color('#ffffff'), 0.35); fabricMaterial(m, { tier, mode: 'garment', dirt }); }
      }
      if (hair || brow) hairMaterial(m, { color: brow ? new T.Color(d.hairColor).multiplyScalar(0.7) : new T.Color(d.hairColor), gain: store.gain(file), tier, brow });
      const mesh = new T.SkinnedMesh(g, m); mesh.name = 'npc-' + e.name; mesh.frustumCulled = false; group.add(mesh); mesh.bind(rig.skeleton); meshes[e.name] = mesh;
      if (brow) detailOnly.push(mesh);
    }
    // Capas procedurales derivadas de cuerpo y ropa (ya deformados).
    const src = (name) => byName[name] && { pos: deformed[name], nrm: byName[name].attrs.normal.array, index: byName[name].attrs.index.array, si: byName[name].attrs.skinIndex.array, sw: byName[name].attrs.skinWeight.array, dominant: dominantFor(byName[name], names) };
    const body = src('body'), outfit = OUTFITS[d.outfit] ? src(d.outfit) : null;
    const profile = makeProfile([body, outfit].filter(Boolean)), bi = bodyData.boneIndex, detail = profileQ.detail;
    const clothGeo = profileQ.lite ? null : buildClothLayers({ def: d, body, outfit, bi, profile, palette, detail });
    const clothMat = mat({ vertexColors: true, map: fabricTexture(), roughness: 0.88, metalness: 0, side: T.DoubleSide });
    const sway = { value: 0 }; windShader(clothMat, sway); fabricMaterial(clothMat, { tier, mode: 'uv', dirt });
    if (clothGeo) { geometries.add(clothGeo); const m = new T.SkinnedMesh(clothGeo, clothMat); m.name = 'npc-capas'; m.frustumCulled = false; group.add(m); m.bind(rig.skeleton); meshes.capas = m; }
    const beard = buildBeard({ def: d, body, bi, profile, color: d.beardColor || d.hairColor, detail });
    if (beard) {
      // Base opaca (sin huecos de piel) + mechones con canal alfa que se deshilachan en los bordes.
      const layers = [['barba-base', beard.base, beardMaterial(mat({ vertexColors: true, roughness: 0.9 }), { tier })], ['barba', beard.strands, beardMaterial(mat({ vertexColors: true, map: strandTexture(), alphaTest: 0.42, roughness: 0.8, side: T.DoubleSide }), { tier })]];
      for (const [name, g, bm] of layers) { if (!g) continue; geometries.add(g); const m = new T.SkinnedMesh(g, bm); m.name = 'npc-' + name; m.frustumCulled = false; group.add(m); m.bind(rig.skeleton); meshes[name] = m; }
    }
    // Accesorios rígidos fusionados por hueso y tipo de material.
    const W = bodyData.boneWorld, rigid = buildRigid({ def: d, profile, palette, affinity, hairVisible: vis.hair && !!HAIR[d.hair].mesh, detail });
    const kinds = { matte: mat({ vertexColors: true, roughness: 0.78, metalness: 0.02 }), metal: mat({ vertexColors: true, roughness: 0.32, metalness: 0.78 }),
      gem: mat({ vertexColors: true, roughness: 0.2, metalness: 0.1, emissive: new T.Color(affinity.gema), emissiveIntensity: affinity.brillo * 0.8 }) };
    fabricMaterial(kinds.matte, { tier, mode: 'tri', dirt: 0 });
    for (const [bone, sets] of Object.entries(rigid)) for (const [kind, list] of Object.entries(sets)) {
      if (!list.length || !rig.bones[bone]) continue;
      const g = mergeGeometries(list); list.forEach((x) => x.dispose()); const w = W[bone]; g.translate(-w[0], -w[1], -w[2]); geometries.add(g);
      const m = new T.Mesh(g, kinds[kind]); m.name = `npc-${bone}-${kind}`; rig.bones[bone].add(m);
      if (bone === 'finger4-1_L_h' || kind === 'gem') detailOnly.push(m);
    }
    // Objetos sostenidos: se reubican cada cuadro.
    const heldGeo = buildHeld({ def: d, palette, affinity, detail }), held = {};
    for (const [k, g] of Object.entries(heldGeo)) {
      if (k === 'staff') { geometries.add(g.geo); held.staff = new T.Mesh(g.geo, kinds.matte); held.staff.userData = g; group.add(held.staff); continue; }
      geometries.add(g); held[k] = new T.Mesh(g, k === 'staffGem' || k === 'orb' ? kinds.gem : kinds.matte); group.add(held[k]);
    }
    if (held.staffGem) { held.staff.add(held.staffGem); held.staffGem.position.set(0, 0, 0); }
    // Partículas sutiles de afinidad (cantidad según calidad; ninguna en Bajo).
    let particles = null; const pk = PARTICLES[affinity.particulas];
    if (pk) {
      const n = 40, g = new T.BufferGeometry(), seeds = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) seeds[i] = Math.abs(Math.sin(i * 12.9898 + d.id.length * 7.1)) % 1;
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3)); geometries.add(g);
      const pm = new T.PointsMaterial({ color: pk.color, size: pk.size, transparent: true, opacity: 0.75, depthWrite: false, blending: pk.blend }); materials.add(pm);
      particles = new T.Points(g, pm); particles.frustumCulled = false; particles.userData = { seeds, kind: pk, n }; group.add(particles); detailOnly.push(particles);
    }
    const mixer = new T.AnimationMixer(rig.group), actions = {}, lo = {}, up = {};
    const addClip = (k, c) => { const sp = splitClip(c, k); lo[k] = mixer.clipAction(sp.lo); up[k] = mixer.clipAction(sp.up); actions[k] = true; };
    for (const [k, c] of Object.entries(clips)) addClip(k, c);
    if (clips.death) addClip('revive', clips.death); // reanimación: la muerte reproducida al revés
    const set = ANIMATION_SETS[d.animationSet], tempo = set.tempo * affinity.tempo * (BASES[d.base].tempo || 1);
    // Mezclador propio por capa: un peso por clip que se acerca a 1 (el actual) o a 0 (los demás); nunca un salto de pose.
    const groups = { lo: makeGroup(lo), up: makeGroup(up) };
    // Huesos que la capa procedural toca (mirada, respiración, gestos, rostro): se restauran a la última pose del
    // mezclador antes de cada cuadro, en vez de devolver TODO el esqueleto a la pose de enlace (el mezclador de three
    // solo escribe un hueso si su valor cambió: con clips estáticos, como sentarse, la pose quedaba en la de enlace).
    const proc = PROC_BONES.filter((n) => rig.bones[n]).map((n) => ({ bone: rig.bones[n], p: rig.bones[n].position.clone(), q: rig.bones[n].quaternion.clone() }));
    group.scale.setScalar(d.body.height);
    const b = { def: d, group, rig, meshes, materials, geometries, held, particles, mixer, actions, groups, proc, set, tempo, sway, detailOnly, legYaw: 0, kick: 0,
      posture: Math.max(set.postura, BASES[d.base].postura), persona: persona(d.id), act: actingState() };
    const rest = actions[set.reposo] ? set.reposo : 'idle'; setMotion(b, groups.lo, rest, 0); setMotion(b, groups.up, rest, 0);
    return b;
  }

  function windShader(m, uTime) {
    m.onBeforeCompile = (s) => { s.uniforms.uTime = uTime; s.vertexShader = 'attribute float sway;\nuniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
 transformed.z -= sway * ( 0.012 + 0.012 * sin( uTime * 1.3 + position.y * 3.1 ) );
 transformed.x += sway * 0.01 * sin( uTime * 1.7 + position.x * 6.0 + position.y * 2.0 );`); };
    m.customProgramCacheKey = () => 'npc-cloth';
  }

  function applyQuality() {
    if (!built) return;
    const shadows = profileQ.shadows;
    built.group.traverse((o) => { if (o.isMesh) { o.castShadow = shadows && o.name !== 'npc-HighPolyEyes'; o.receiveShadow = shadows; } });
    if (built.particles) { built.particles.visible = profileQ.particles > 0; built.particles.geometry.setDrawRange(0, Math.round(built.particles.userData.n * profileQ.particles)); }
  }

  function disposeBuilt(b) {
    if (!b) return; b.mixer.stopAllAction(); b.group.removeFromParent();
    b.geometries.forEach((g) => g.dispose()); b.materials.forEach((m) => m.dispose()); b.rig.skeleton.dispose();
  }

  let token = 0;
  async function setDefinition(input) {
    const my = ++token; status = 'loading';
    try {
      const next = await build(input);
      if (my !== token) { disposeBuilt(next); return api; }
      disposeBuilt(built); built = next; def = next.def; root.add(next.group); applyQuality(); status = 'ready'; return api;
    } catch (e) { if (my === token) status = 'error'; throw e; }
  }

  const toLocal = (bone, out) => { bone.getWorldPosition(out); return built.group.worldToLocal(out); };
  function updateHeld(dt) {
    const h = built.held, b = built.rig.bones;
    if (h.staff) {
      const hand = toLocal(b.wrist_R_h, tmp), base = tmp2.set(hand.x - 0.04, 0, hand.z + 0.05);
      tmp3.subVectors(hand, base).normalize();
      h.staff.position.copy(base); h.staff.quaternion.setFromUnitVectors(up, tmp3);
    }
    if (h.wand) { const w = toLocal(b.wrist_R_h, tmp), f = toLocal(b['finger3-3_R_h'] || b.wrist_R_h, tmp2); tmp3.subVectors(f, w).normalize(); h.wand.position.copy(w).addScaledVector(tmp3, 0.05); h.wand.quaternion.setFromUnitVectors(up, tmp3.lengthSq() ? tmp3 : up); }
    if (h.book && built.def.grimoire === 'mano') { const w = toLocal(b.wrist_L_h, tmp); h.book.position.set(w.x - 0.02, w.y + 0.02, w.z + 0.1); h.book.rotation.set(0.9, 0, -0.15); }
    if (h.book && built.def.grimoire === 'flotante') { h.book.position.set(0.42, 1.18 + Math.sin(time * 1.3) * 0.04, 0.28); h.book.rotation.set(0.5 + Math.sin(time * 0.7) * 0.05, -0.5, 0.05); }
    if (h.orb) { h.orb.position.set(-0.38, 1.32 + Math.sin(time * 1.7) * 0.05, 0.22); h.orb.rotation.y += dt * 0.8; }
  }
  function updateParticles() {
    const p = built.particles; if (!p?.visible) return;
    const { seeds, kind, n } = p.userData, arr = p.geometry.attributes.position.array, h = built.held;
    const anchor = h.staff ? h.staff.localToWorld(tmp.set(0, h.staff.userData.length, 0)) : toLocal(built.rig.bones.wrist_R_h, tmp).applyMatrix4(built.group.matrixWorld);
    built.group.worldToLocal(anchor);
    for (let i = 0; i < n; i++) {
      const s = seeds[i * 4], ph = (time * (0.25 + seeds[i * 4 + 1] * 0.35) + s) % 1, a = s * 6.283 + time * (kind.swirl || 0.6) * (seeds[i * 4 + 2] - 0.5), r = 0.03 + seeds[i * 4 + 3] * 0.07;
      arr[i * 3] = anchor.x + Math.cos(a) * r; arr[i * 3 + 1] = anchor.y + ph * kind.rise * 1.4 + (kind.rise < 0 ? 0.05 : 0); arr[i * 3 + 2] = anchor.z + Math.sin(a) * r;
    }
    p.geometry.attributes.position.needsUpdate = true; p.material.opacity = 0.65;
  }

  /** Mezcla de clips por capa: los pesos se acercan al objetivo a ritmo constante y se normalizan (nunca asoma la pose de enlace). */
  function blend(dt, speeds) {
    const B = built;
    for (const [gk, g] of Object.entries(B.groups)) {
      const motionSpeed = speeds[gk], rate = dt / Math.max(0.05, g.fade || 0.4); let sum = 0;
      for (const l of g.layers) {
        const target = l === g.current ? 1 : 0;
        if (l.w === 0 && target === 0) continue;
        l.w = target ? Math.min(1, l.w + rate) : Math.max(0, l.w - rate);
        if (l.w === 0) { l.action.stop(); continue; }
        sum += l.w * l.w * (3 - 2 * l.w); // suavizado: entra y sale despacio
      }
      for (const l of g.layers) {
        if (l.w === 0) continue;
        const a = l.action, hold = HOLD[l.key];
        a.setEffectiveWeight(sum > 0 ? (l.w * l.w * (3 - 2 * l.w)) / sum : 1);
        let ts = LOCO.has(l.key) ? motionSpeed : B.persona.ritmo * B.tempo;
        if (hold && l === g.current) { if (a.time > hold[1]) g.holdDir = -1; else if (a.time < hold[0] && g.holdDir < 0) g.holdDir = 1; ts *= g.holdDir; }
        a.timeScale = l.key === 'revive' ? -Math.abs(ts) : ts;
      }
    }
    B.mixer.update(dt);
  }
  function nextBlink(A, P) { A.blinkT = 1.6 + P.rnd() * 4.2; A.doble = P.rnd() < 0.14; }

  /**
   * Un cuadro del NPC. motion: clip a reproducir ('walk', 'talk', 'interact', 'kneel', 'sit'…; null = reposo del set);
   * look: punto del mundo a mirar (null = la cámara; false = no girar la cabeza);
   * gesture: 'nod' | 'nodFast' | 'nodSmall' | 'nodSlow' | 'shake' | 'tilt' | null (ver GESTOS);
   * speaking: mandíbula y labios, pulsos de énfasis con la cabeza y cejas que suben al empezar a hablar;
   * cull: el NPC está fuera de cámara → animación a 1/4 de frecuencia (ahorro en teléfono);
   * snap: cambiar de clip sin fundido (solo cuando nadie lo ve: recién colocado fuera de cuadro o en negro).
   */
  function update(dt, { speaking = false, action = '', expression = 'sereno', camera = null, motion = null, motionSpeed = 1, look = null, gesture = null, cull = false, snap = false, restart = false, fade = null,
    upper = null, lower = null, upperSpeed = null, legYaw = 0, pitch = 0, kick = 0, overlay = null } = {}) {
    if (status !== 'ready' || !built || !Number.isFinite(dt) || dt <= 0) return;
    time += dt; built.sway.value = time; if (snap) built.snap = true; // se recuerda aunque este cuadro se salte (cull)
    if (cull) { built.culled = (built.culled || 0) + dt; if (built.culled < 0.25) return; dt = built.culled; } built.culled = 0;
    const b = built.rig.bones, cam = camera, A = built.act, P = built.persona;
    let far = false;
    if (cam) { root.getWorldPosition(tmp); far = tmp.distanceTo(cam.getWorldPosition(tmp2)) > profileQ.lodDistance; }
    for (const o of built.detailOnly) o.visible = !far && (o !== built.particles || profileQ.particles > 0);
    for (const r of built.proc) { r.bone.position.copy(r.p); r.bone.quaternion.copy(r.q); }
    // Capas: «motion» manda en las dos mitades (cuerpo entero); «lower»/«upper» pisan sólo piernas / torso+brazos.
    const has = (k) => k && built.actions[k], rest = built.actions[built.set.reposo] ? built.set.reposo : 'idle';
    const base = has(motion) ? motion : action === 'presentar' && has(built.set.demostrar) ? built.set.demostrar : rest;
    const keys = { lo: has(lower) ? lower : base, up: has(upper) ? upper : base };
    for (const [gk, g] of Object.entries(built.groups)) {
      const k = keys[gk];
      if (restart && k === g.currentKey && (gk === 'up' || !lower)) { const a = g.current.action; a.reset(); a.setLoop(ONCE.has(k) ? T.LoopOnce : T.LoopRepeat, Infinity); a.play(); }
      if (k !== g.currentKey) setMotion(built, g, k, built.snap ? 0 : fade ?? fadeFor(g.currentKey, k));
    }
    built.snap = false;
    blend(dt, { lo: motionSpeed, up: upperSpeed ?? motionSpeed });
    for (const r of built.proc) { r.p.copy(r.bone.position); r.q.copy(r.bone.quaternion); } // pose del mezclador = base del próximo cuadro
    const key = built.groups.lo.currentKey || '', walking = LOCO.has(key);
    // Giro de las piernas (strafe / retroceso): la raíz gira con las piernas y la cadera lo deshace, así el torso sigue mirando adelante.
    built.legYaw += (legYaw - built.legYaw) * (1 - Math.exp(-dt * 10)); built.kick = Math.max(kick, built.kick - dt * 6);
    if (Math.abs(built.legYaw) > 0.002) { q0.setFromAxisAngle(up, built.legYaw); b.root?.quaternion.premultiply(q0); q0.setFromAxisAngle(up, -built.legYaw); b.spine05_h?.quaternion.premultiply(q0); }
    // Apuntar arriba/abajo: el pitch del jugador se reparte entre la columna y el cuello (los brazos y el arma lo siguen).
    if (pitch) { const p = T.MathUtils.clamp(pitch, -1.2, 1.2); b.spine04_h?.rotateX(-p * 0.1); b.spine02_h?.rotateX(-p * 0.2); b.spine01_h?.rotateX(-p * 0.24); b.neck01_h?.rotateX(-p * 0.14); b.head_h?.rotateX(-p * 0.14); }
    if (built.kick > 0.01) { b.spine02_h?.rotateX(-0.03 * built.kick); b.spine01_h?.rotateX(-0.05 * built.kick); b.clavicle_L_h?.rotateZ(0.03 * built.kick); b.clavicle_R_h?.rotateZ(-0.03 * built.kick); }
    // Postura: ancianos y eruditos se inclinan levemente.
    if (built.posture) { b.spine01_h?.rotateX(built.posture * 0.12); b.neck01_h?.rotateX(built.posture * 0.1); }
    // Respiración (pecho y hombros) y cambio de peso lento en reposo; ritmo y fase propios de cada personaje.
    A.idleW += ((IDLE.has(key) ? 1 : 0) - A.idleW) * Math.min(1, dt * 1.5);
    const br = Math.sin((time * P.respira + P.fase) * 6.283) * (speaking ? 1.3 : 1);
    b.spine03_h?.rotateX(-0.012 * br); b.shoulder01_L_h?.rotateZ(0.012 * br); b.shoulder01_R_h?.rotateZ(-0.012 * br);
    if (A.idleW > 0.01) {
      const sw = Math.sin(time * P.balanceo * 6.283 + P.balanceoFase) * A.idleW, sw2 = Math.sin(time * P.balanceo * 2.7 * 6.283 + P.fase * 9) * A.idleW;
      b.root?.rotateZ(0.014 * sw * P.lado); b.spine03_h?.rotateZ(-0.018 * sw * P.lado); b.root?.rotateY(0.03 * sw2);
    }
    // Gesto de cabeza con envolvente (entra y sale sin salto).
    if (gesture && GESTOS[gesture] && gesture !== A.gesto) { A.gesto = gesture; A.gestoT = 0; }
    A.gestoW += ((gesture && gesture === A.gesto ? 1 : 0) - A.gestoW) * Math.min(1, dt * 7);
    if (A.gestoW < 0.002 && !gesture) A.gesto = null;
    A.gestoT += dt;
    let gx = 0, gy = 0, gz = 0;
    if (A.gesto) {
      const G = GESTOS[A.gesto], ph = A.gestoT * G.f, w = A.gestoW * G.a;
      const v = G.eje === 'z' ? 1 : G.eje === 'y' ? Math.sin(ph) : G.una && ph > 6.283 ? 0 : 0.5 - 0.5 * Math.cos(ph);
      if (G.eje === 'x') gx = v * w * 1.6; else if (G.eje === 'y') gy = v * w; else gz = v * w * P.lado;
    }
    if (!far) {
      const head = b.head_h, neck = b.neck02_h || b.neck01_h;
      // Mirada con inercia: el objetivo cambia de golpe, la cabeza no (≈0,3 s); cuello 40 %, cabeza 60 %. Los ojos se adelantan.
      let wy = 0, wp = 0, ey = 0, ep = 0;
      const mira = !!(head && look !== false && (look || cam));
      if (mira) {
        built.group.updateMatrixWorld(true); const hp = head.getWorldPosition(tmp), d = (look ? tmp2.copy(look) : cam.getWorldPosition(tmp2)).sub(hp);
        const ry = eul.setFromQuaternion(built.group.getWorldQuaternion(q0), 'YXZ').y;
        ey = T.MathUtils.euclideanModulo(Math.atan2(d.x, d.z) - ry + Math.PI, Math.PI * 2) - Math.PI; ep = -Math.atan2(d.y, Math.hypot(d.x, d.z));
        wy = T.MathUtils.clamp(ey, -0.75, 0.75); wp = T.MathUtils.clamp(ep, -0.35, 0.4);
      }
      // Desvío de la mirada: cada tanto mira a otro lado (piensa, recuerda) y vuelve.
      A.glanceT -= dt;
      if (A.glanceT <= 0) {
        if (A.glance) { A.glance = 0; A.glanceT = (speaking ? 3.5 : 5) + P.rnd() * 5; }
        else { A.glance = 1; A.glanceT = 0.5 + P.rnd() * (speaking ? 0.8 : 1.2); A.gY = (P.rnd() < 0.5 ? -1 : 1) * (0.22 + P.rnd() * 0.3); A.gP = speaking ? 0.05 + P.rnd() * 0.15 : -0.06 + P.rnd() * 0.2; if (P.rnd() < 0.6 && A.blink < 0) A.blinkT = Math.min(A.blinkT, 0.02); }
      }
      A.gW += ((A.glance && mira && !walking && !A.gesto ? 1 : 0) - A.gW) * Math.min(1, dt * 6);
      wy += A.gY * A.gW; wp += A.gP * A.gW;
      const k = 1 - Math.exp(-dt * 5); built.lookYaw = (built.lookYaw || 0) + (wy - (built.lookYaw || 0)) * k; built.lookPitch = (built.lookPitch || 0) + (wp - (built.lookPitch || 0)) * k;
      // Al hablar: pulsos de énfasis de la cabeza (sílabas acentuadas) y cejas que suben al empezar la frase.
      if (speaking && !A.hablaba) { A.emph = 1; A.beatT = 0.25; }
      A.hablaba = speaking; A.emph = Math.max(0, A.emph - dt * 0.8);
      A.beatT -= dt;
      if (speaking && A.beatT <= 0) { A.beatT = 0.7 + P.rnd() * 1.1; A.beat = 1; A.beatY = (P.rnd() - 0.5) * 0.06; }
      A.beat = Math.max(0, A.beat - dt * 3.2);
      const pulso = speaking ? Math.sin(A.beat * Math.PI) : 0;
      neck?.rotateY(built.lookYaw * 0.4); head?.rotateY(built.lookYaw * 0.6 + gy + A.beatY * pulso); head?.rotateZ(gz);
      head?.rotateX(built.lookPitch * 0.7 + gx + 0.035 * pulso + Math.sin(time * 0.7 + P.fase * 6) * 0.018);
      if (profileQ.facial !== false) {
      // Ojos: van primero al objetivo (lo que la cabeza todavía no giró) + microsacadas.
      A.sacT -= dt; if (A.sacT <= 0) { A.sacT = 0.35 + P.rnd() * 1.8; A.sacY = (P.rnd() - 0.5) * 0.09; A.sacP = (P.rnd() - 0.5) * 0.05; }
      const tY = mira ? T.MathUtils.clamp(T.MathUtils.clamp(ey + A.gY * A.gW, -1.2, 1.2) - built.lookYaw, -0.38, 0.38) : 0;
      const tP = mira ? T.MathUtils.clamp(T.MathUtils.clamp(ep + A.gP * A.gW, -0.6, 0.6) - built.lookPitch * 0.7, -0.25, 0.25) : 0;
      const ke = Math.min(1, dt * 28); A.eyeY += (tY + A.sacY - A.eyeY) * ke; A.eyeP += (tP + A.sacP - A.eyeP) * ke;
      if (b.eye_L_h) { b.eye_L_h.rotateY(A.eyeY); b.eye_L_h.rotateX(A.eyeP); }
      if (b.eye_R_h) { b.eye_R_h.rotateY(A.eyeY); b.eye_R_h.rotateX(A.eyeP); }
      // Parpadeo: intervalos al azar (a veces doble) y al desviar la mirada.
      A.blinkT -= dt; if (A.blinkT <= 0 && A.blink < 0) A.blink = 0;
      let lid = 0;
      if (A.blink >= 0) { A.blink += dt; const u = A.blink / 0.17; lid = u < 0.4 ? u / 0.4 : Math.max(0, 1 - (u - 0.4) / 0.6); if (u >= 1) { A.blink = -1; if (A.doble) { A.doble = false; A.blinkT = 0.12; } else nextBlink(A, P); } }
      const caido = Math.max(lid, A.eyeP > 0 ? A.eyeP * 0.6 : 0); // al mirar hacia abajo el párpado acompaña
      const ceja = (expression === 'alerta' ? 0.002 : expression === 'atento' ? 0.001 : 0) + 0.0022 * A.emph + 0.001 * pulso;
      for (const side of LADOS) {
        const up3 = b[side.up], lo4 = b[side.lo], brow = b[side.brow];
        if (up3) up3.position.y -= caido * 0.009; if (lo4) lo4.position.y -= lid * 0.003; if (brow) brow.position.y += ceja;
      }
      // Mandíbula y labios: sílabas al azar (abre, cierra, a veces pausa) con suavizado; no es sincronía labial exacta.
      A.jawT -= dt;
      if (A.jawT <= 0) { A.jawT = 0.07 + P.rnd() * 0.11; A.jawTo = speaking ? (P.rnd() < 0.2 ? 0.005 : 0.04 + P.rnd() * 0.09) : 0; }
      if (!speaking) A.jawTo = 0;
      A.jaw += (A.jawTo - A.jaw) * Math.min(1, dt * 20);
      if (b.jaw_h) b.jaw_h.rotateX(A.jaw);
      }
    }
    built.group.updateMatrixWorld(true);
    if (overlay) { overlay(built.rig.bones, built.group, dt); built.group.updateMatrixWorld(true); } // arma en la mano, IK de la mano libre, gestos
    updateHeld(dt); if (!far) updateParticles();
  }

  function stats() {
    let drawCalls = 0, triangles = 0;
    root.traverse((o) => { if ((o.isMesh || o.isPoints) && o.visible) { drawCalls++; const g = o.geometry; triangles += g.index ? g.index.count / 3 : o.isPoints ? 0 : g.attributes.position.count / 3; } });
    return { drawCalls, triangles: Math.round(triangles), materials: built?.materials.size || 0 };
  }

  const api = {
    root, get group() { return root; },
    get definition() { return def; }, get status() { return status; }, get bones() { return built?.rig.bones || {}; },
    hasClip(k) { return !!built?.actions[k]; },
    /** Clip actual de cada capa: { lower, upper }. */
    get layerClips() { return built ? { lower: built.groups.lo.currentKey, upper: built.groups.up.currentKey } : null; },
    /** Punta del báculo (o la mano derecha si no tiene) en coordenadas del mundo: de ahí salen sus hechizos. */
    punta(out = new T.Vector3()) {
      if (!built) return null; const h = built.held;
      if (h.staff) { h.staff.updateWorldMatrix(true, false); return h.staff.localToWorld(out.set(0, h.staff.userData.length || 1.5, 0)); }
      const w = built.rig.bones.wrist_R_h; if (!w) return null; w.updateWorldMatrix(true, false); return w.getWorldPosition(out);
    },
    /** Mano ('L' | 'R') en coordenadas del mundo (gestos de las coreografías). */
    mano(lado = 'R', out = new T.Vector3()) { const w = built?.rig.bones['wrist_' + lado + '_h']; if (!w) return null; w.updateWorldMatrix(true, false); return w.getWorldPosition(out); },
    ready: null, setDefinition, update, stats,
    setQuality(q) { const nextQ = typeof q === 'string' ? npcQuality(q, { movil }) : q; const rebuild = nextQ.detail !== profileQ.detail; profileQ = nextQ; if (rebuild && def) return setDefinition(def); applyQuality(); return Promise.resolve(api); },
    get quality() { return profileQ; },
    dispose() { token++; disposeBuilt(built); built = null; root.removeFromParent(); status = 'disposed'; },
  };
  api.ready = setDefinition(definition);
  api.ready.catch(() => {});
  return api;
}
