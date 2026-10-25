import { applyCosmeticMaterials } from './cosmetic-material.js';
// CUERPO UNIFICADO de los Huéspedes (docs/HUESPEDES_ARTE.md): humano de ARCANUM (esqueleto y animaciones reales) + kit de armadura/mutación anclado a los huesos
// (huesped-armor.js) + diseño de cada Huésped (src/client/huesped/<id>.js) + evolución por camino (`pth`) + órganos (`cg`) + arma melee fusionada (`mw`) + aspecto regional.
//   const b = createHostBody(THREE, kit, player, { quality, camera, map });          // kit = await loadHumanKit(...)  (humans.js) · player = jugador del snapshot { char, evo, pth, cg, mw, dead }
//   scene.add(b.object); cada cuadro: b.update(dt, player, { speed, moveDir:{x,z}, pitch, camDist, self, map, shot });  eventos: b.event({ t:'melee'|'skill' })
//   b.ready (Promise) · b.human = true · b.person (la persona de humans.js) · b.stats() · b.setMap(id) · b.pose('idle'|'melee'|'skill') (para la selección) · b.dispose()
// El modelo mira a +Z con los pies en y = 0 y mide ≈ 1,7 u (× SCALE del Huésped); render.js lo orienta y lo apoya en el suelo (como host-body.js).
import * as T from 'three';
import { createHuman } from './humans.js';
import { createArmorKit } from './huesped-armor.js';
import { addRegion } from './huesped-evo-piezas.js';
import { tools } from './huesped-piezas.js';
import { attachChampOrgans } from './organs-vis.js';
import { attachToViewmodel } from './melee-models.js';
import { parseEq, armorSlots, itemOfSlot, addEquipmentArmor, mountItemWeapon, buildGunBack } from './items-vis.js';
import { uBeat } from './shaders.js';
import { createPresence, pathColor, PATH_STYLE } from './huesped-presencia.js';
import { REGION, pathFor } from './host-human.js';
import { CHARACTERS, MELEE_WEAPONS, EVO_PATHS, evoPathsFor } from '../sim/data.js';
import { settings } from './settings.js';
import { formaPorIndice } from '../sim/fauna-data.js';   // metamorfosis de fauna: color y estilo de material de la forma activa (snapshot `mf`)
import * as AXIOMA from './huesped/axioma.js';
import * as VESPER from './huesped/vesper.js';
import * as MICELIO from './huesped/micelio.js';
import * as UMBRA from './huesped/umbra.js';
import * as SERAF from './huesped/seraf.js';
import * as COLMENA from './huesped/colmena.js';
import * as DANZANTE from './huesped/danzante.js';
import * as SINGULAR from './huesped/singular.js';
import * as LABORATORIO from './huesped/laboratorio.js';   // Híbrido Genómico: el diseño del jugador (docs/EDITOR_HUESPEDES.md)
import { aplicarProporciones, elevacionViva } from './lab-prop.js';
import { buildDe } from './lab-activo.js';
import { defecto as labDefecto, huella as labHuella } from '../shared/host-build.js';

/** Encuadre de cada Huésped para las pantallas de selección y evolución: [centro y, alto, ancho] (m, sin escala de pantalla). */
export const FRAME = { axioma: [0.98, 2.5, 1.9], vesper: [0.98, 2.4, 1.8], micelio: [1.2, 3.5, 2.7], umbra: [1.0, 2.4, 1.8], seraf: [1.0, 2.45, 2.3], danzante: [1.05, 2.6, 2.0], singular: [1.1, 2.8, 2.6] };
export const isHost = (char) => !!(CHARACTERS[char] && CHARACTERS[char].host);
const DESIGN = { axioma: AXIOMA, vesper: VESPER, micelio: MICELIO, umbra: UMBRA, seraf: SERAF, danzante: DANZANTE, singular: SINGULAR };
/** Humano base (preset de la fábrica), escala del Huésped y colores clave. */
const LOOK = {
  axioma: { preset: 'jugador1', scale: 1.0, glow: 0x4ab4ff, ember: 0xff6a1a },
  vesper: { preset: 'jugador4', scale: 0.98, glow: 0xb04bff, ember: 0xff5ad8 },
  micelio: { preset: 'jugador3', scale: 1.25, glow: 0x7be03a, ember: 0xc8ff4a },
  umbra: { preset: 'jugador2', scale: 1.0, glow: 0xb98cff, ember: 0x9a6aff, hover: 0.14 }, // flota: el sudario cubre los pies
  seraf: { preset: 'jugador2', scale: 1.0, glow: 0xffd45a, ember: 0xffb040 },
  danzante: { preset: 'jugador4', scale: 1.0, glow: 0xff3fa0, ember: 0xffb020, skin: 0x2b1240 },   // fucsia de carnaval + cempasúchil, piel de ciruela
  singular: { preset: 'jugador3', scale: 1.08, glow: 0xe0b0ff, ember: 0xffd24a },   // ultravioleta + oro de estrella muerta
};
const NEUTRAL = { height: 1, width: 1, shoulders: 1, belly: 0, head: 1, jaw: 1, nose: 1 };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const FADE_FAR = 1.6, FADE_NEAR = 0.7;
/** Crecimiento por nivel (+4,5 % por nivel, hasta +18 %) y proporciones propias de cada camino elegido: [ancho, alto] que se SUMAN (coraza ancha y maciza, velocidad esbelta, depredador alto…). */
export const GROW = 0.045;
const PATH_SHAPE = { depredador: [0.03, 0.05], coraza: [0.1, 0.0], velocidad: [-0.04, 0.03], resonancia: [0.0, 0.02], simbiosis: [0.07, 0.03], artilleria: [0.05, 0.0], apoteosis: [0.0, 0.06], anomalia: [0.03, 0.04] };
// COLMENA (invocadora de enjambre, caminos propios): diseño, aspecto, encuadre, forma y aura de cada camino; `pathOf` respeta los caminos propios de un Huésped (EVO_PATHS sólo vale para los demás)
DESIGN.laboratorio = LABORATORIO; FRAME.laboratorio = [1.0, 2.45, 1.9]; LOOK.laboratorio = { preset: 'jugador3', scale: 1.0, glow: 0xff7a22, ember: 0xff7a22 };   // el aspecto real sale del diseño del jugador (paleta, base)
DESIGN.colmena = COLMENA; FRAME.colmena = [1.0, 2.5, 2.3];
LOOK.colmena = { preset: 'jugador3', scale: 1.0, glow: 0xff3a3a, ember: 0xffb83a };   // borde y charco de luz ROJOS (jalea real) con venas de miel ámbar sobre quitina burdeos: contrasta con las alas ámbar y con los pisos fríos (Danzante es fucsia, Seraf oro: Colmena es el ÚNICO rojo)
Object.assign(PATH_SHAPE, { criador: [0.0, 0.02], aguijon: [0.0, 0.03], nidos: [0.04, 0.02], nube: [0.02, 0.0], cohabita: [0.05, 0.03], detonador: [0.03, 0.0], reina: [0.03, 0.07], plaga: [0.06, 0.04] });
Object.assign(PATH_STYLE, { criador: { color: 0xffc24a, kind: 4, n: 16 }, aguijon: { color: 0xff3b55, kind: 2, n: 18 }, nidos: { color: 0xffa21c, kind: 8, n: 16 }, nube: { color: 0xffd070, kind: 1, n: 22 }, cohabita: { color: 0xff7a90, kind: 3, n: 14 }, detonador: { color: 0xff6a1a, kind: 0, n: 18 }, reina: { color: 0xffe08a, kind: 6, n: 18 }, plaga: { color: 0xd8402f, kind: 7, n: 20 } });
function pathOf(char, evo, pth) { const EP = evoPathsFor(char); if (EP === EVO_PATHS) return pathFor(evo, pth); const out = []; for (let i = 1; i <= evo; i++) { const id = pth && pth[i - 1]; out.push((EP[i] || []).some((o) => o.id === id) ? id : EP[i][0].id); } return out; }
export function bodyScale(evo, path) { let w = 0, h = 0; for (const id of path.slice(0, evo)) { const q = PATH_SHAPE[id]; if (q) { w += q[0]; h += q[1]; } } const g = 1 + evo * GROW; return { g, x: g * (1 + w), y: g * (1 + h), z: g * (1 + w) }; }

export function createHostBody(THREE, kit, p, opts = {}) {
  const quality = opts.quality || kit.quality || 'low', D = DESIGN[p.char] || AXIOMA, esLab = p.char === 'laboratorio';
  // Híbrido Genómico: el diseño (CustomHostBuild) manda en el aspecto; las proporciones son escalas de hueso (no reconstruyen)
  const hexN = (h) => parseInt(String(h).replace('#', ''), 16), mixHex = (a, b, k) => new T.Color(a).lerp(new T.Color(b), k).getHex();
  let lab = esLab ? (opts.lab || buildDe(p) || labDefecto()) : null, labK = lab ? labHuella({ ...lab, prop: {} }) : '', labShape = { x: 1, y: 1, z: 1, lift: 0 }, labLift = 0, baseShape = null;
  const labLook = (b) => ({ ...LOOK.laboratorio, preset: b.base.preset, glow: hexN(b.pal.emisivo), ember: hexN(b.pal.emisivo), skin: mixHex(0x14121c, hexN(b.base.piel), 0.04) });
  let L = lab ? labLook(lab) : (LOOK[p.char] || LOOK.axioma);
  const object = new T.Group(); object.name = 'huesped-' + p.char;
  const holder = new T.Group(); holder.scale.setScalar(L.scale); object.add(holder);
  const human = createHuman(kit, { char: p.char, name: p.name || p.char, color: L.glow, accent: L.glow, noGear: true, weapon: null, hands: false, ...(lab ? { preset: L.preset } : {}), overrides: { body: NEUTRAL } });
  holder.add(human.object); holder.visible = false; // hasta que el kit esté armado no se muestra (si no, se vería el humano desnudo)
  let fk = 0, fkT = 0, fId = '', fHex = null, fVis = 0, itemW = [], shownEvo = -1, shape = { g: 1, x: 1, y: 1, z: 1 }, lean = 0, lastPath = '', ak = null, bodyGeo = null, map = opts.map || null, key = '', ready = false, disposed = false, time = Math.random() * 10, act = null, clip = '', fade = 1, fadeMats = [], weapon = null, organs = null, extra = {}, sigil = null;
  let cosmetic = opts.cosmetic || null;
  const camera = opts.camera || null, presence = createPresence(T, { glow: L.glow, quality, camera }); object.add(presence.object);

  async function loadBodyGeometry() {
    const lod = !!kit.profile.lod, m = await kit.store.mesh(lod ? 'body@none' : 'body', lod, 'body'), g = new T.BufferGeometry();
    for (const [k, a] of Object.entries(m.attrs)) { if (k === 'index') g.setIndex(a.clone()); else g.setAttribute(k, a.clone()); }
    g.computeBoundingSphere(); return g;
  }
  const keyOf = (pl, mp) => `${pl.mr | 0}|${pl.evo | 0}|${(pl.pth || []).join()}|${pl.mw || ''}|${(pl.cg || []).join()}|${mp}|${pl.eq || ''}|${cosmetic || ''}${lab ? '|' + labK : ''}`;
  function teardown() {
    if (weapon) { weapon.dispose(); weapon = null; } for (const w of itemW) w.dispose(); itemW = []; if (organs) { organs.dispose(); organs = null; }
    if (extra.dispose) { try { extra.dispose(); } catch (e) { /* zonas de selección */ } }
    if (ak) { ak.dispose(); ak = null; } extra = {};
    if (sigil) { object.remove(sigil); sigil.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); sigil = null; }
  }
  function assemble(pl) {
    teardown(); labApply();   // (el esqueleto ya está listo: las escalas de hueso del diseño se aplican acá y en setLab)
    const evo = pl.evo | 0, path = pathOf(p.char, evo, pl.pth), region = map ? (REGION[map] || null) : null;
    const rimC = new T.Color(L.glow).lerp(new T.Color(region ? region.accent : L.glow), 0.12); if (evo > 0) rimC.lerp(new T.Color(pathColor(path[evo - 1], L.glow)), 0.18); // la luz de borde toma el color del último camino
    ak = createArmorKit(human, kit, { quality, accent: L.ember, rim: rimC, crack: L.ember, belly: D.BELLY ?? 0, skin: L.skin });
    curPath = path; baseShape = bodyScale(evo, path); shape = labShapeOf(baseShape); holder.scale.set(L.scale * shape.x, L.scale * shape.y, L.scale * shape.z); // el cuerpo crece con cada nivel y cambia de proporciones según el camino
    const up = shownEvo >= 0 && evo > shownEvo; shownEvo = evo; lastPath = path[evo - 1] || '';
    presence.set({ evo, path, rank: Math.max(1, pl.mr | 0), scale: L.scale * shape.g });
    const ctx = { evo, path, has: (id) => path.includes(id), region, map, glow: L.glow, ember: L.ember, char: p.char, quality, melee: pl.mw || '', lab };
    const eq = parseEq(pl.eq); ak.replaceSlots(armorSlots(eq));   // el equipo SUSTITUYE la geometría base de las zonas con armadura (items-vis.js)
    extra = D.build(ak, ctx) || {};
    const reg = addRegion(ak, ctx, { t: tools(ak) }), own = extra.update; extra.update = (dt, tt, c) => { if (own) own(dt, tt, c); reg.update(dt, tt, c); };
    ak.keepAll(); addEquipmentArmor(ak, eq);
    ak.finish({ bodyGeometry: bodyGeo });
    applyCosmeticMaterials(ak, p.char, cosmetic); if (D.postFinish) D.postFinish(ak);   // ajustes de material propios del diseño (Laboratorio)
    if (lab && lab.pal.acabado && lab.pal.acabado !== 'archivo') applyCosmeticMaterials(ak, 'axioma', 'axioma_' + lab.pal.acabado);   // acabado elegido en el Laboratorio (porcelana, obsidiana): sólo pinta los materiales del kit
    for (const r of ak.extraRoots) object.add(r);
    ak.setObject(object);
    if (evo >= 4) { // forma final: sello brillante en el suelo (2 anillos que giran)
      sigil = new T.Group(); const gm = new T.MeshBasicMaterial({ color: L.glow, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false });
      const r1 = new T.Mesh(new T.RingGeometry(1.2 * L.scale, 1.25 * L.scale, 48), gm), r2 = new T.Mesh(new T.RingGeometry(0.85 * L.scale, 0.875 * L.scale, 6), gm);
      for (const r of [r1, r2]) { r.rotation.x = -Math.PI / 2; r.position.y = 0.03; r.frustumCulled = false; sigil.add(r); } sigil.userData.r = [r1, r2]; object.add(sigil);
    }
    // arma melee fusionada en la mano derecha
    const iwE = itemOfSlot(eq, 'melee'), igE = itemOfSlot(eq, 'gun');
    if (iwE) { // arma cuerpo a cuerpo de objeto: reemplaza a la fusionada; las de dos hojas cuelgan de las dos manos
      const sd = iwE.it.m.dual || iwE.id === 'gemelas_axioma' || iwE.id === 'colmillos_luna';
      for (const [bn, side] of sd ? [['wrist_R', 'R'], ['wrist_L', 'L']] : [['wrist_R', 'R']]) {
        const mount = ak.mount(bn, ak.P(bn)); if (!mount) continue; mount.rotation.set(-Math.PI / 2 + 0.2, 0, 0);
        itemW.push(mountItemWeapon(T, mount, iwE.id, { frame: 'host', size: L.scale * (iwE.it.m.dual ? 0.9 : 1), offset: [0, -0.1, 0], phase: iwE.fase, quality, side }));
      }
    } else if (pl.mw && MELEE_WEAPONS[pl.mw]) {
      const mount = ak.mount('wrist_R', ak.P('wrist_R')); if (mount) {
        mount.rotation.set(-Math.PI / 2 + 0.2, 0, 0); // hoja hacia delante
        weapon = attachToViewmodel(T, mount, pl.mw, { frame: 'host', size: 1 * (L.scale), offset: [0, -0.1, 0.0], tier: evo, quality, color: L.glow, aura: false });
      }
    }
    if (igE) { // arma de disparo de objeto: cruzada a la espalda
      const back = ak.mount('spine03', ak.P('spine03').add(new T.Vector3(0, 0.25, -0.16)));
      if (back) { const g = buildGunBack(T, igE.id, { phase: igE.fase, quality }); g.group.rotation.set(0.2, 0, 0.9); g.group.scale.setScalar(L.scale * 0.9); back.add(g.group); itemW.push({ update: g.update, dispose() { back.remove(g.group); g.dispose(); } }); }
    }
    // órganos del campeón
    if ((pl.cg || []).length) {
      const ta = ak.mount('spine01', ak.P('spine01').add(new T.Vector3(0, -0.1, 0.12))), hd = ak.mount('head', ak.P('head').add(new T.Vector3(0, 0.08, 0.08)));
      if (ta && hd) { ta.scale.setScalar(0.62); hd.scale.setScalar(0.62); try { organs = attachChampOrgans(T, 'seraf', { torso: { g: ta }, head: { g: hd } }, pl.cg, { color: L.glow, quality }); } catch (e) { console.warn('órganos:', e.message); } }
    }
    fadeMats = [...Object.values(ak.mats)];
    for (const r of ak.extraRoots) if (r.material && !fadeMats.includes(r.material)) fadeMats.push(r.material);
    for (const m of fadeMats) if (m.userData.o0 == null) { m.userData.o0 = m.opacity; m.userData.t0 = m.transparent; m.userData.d0 = m.depthWrite; }
    fade = 1; ready = true; holder.visible = true;
    if (up) presence.burst(pathColor(lastPath, L.glow)); // transformación (≈ 1,2 s) al subir de nivel
  }
  /** Proporciones del diseño: escalas de hueso (sin reconstruir) + escala global (ancho, altura) del contenedor. */
  function labShapeOf(b) { return lab ? { g: b.g, x: b.x * labShape.x, y: b.y * labShape.y, z: b.z * labShape.z } : b; }
  function labApply() { if (!lab) return; labShape = aplicarProporciones(human.bones, lab.prop, kit.store.boneWorld()); if (baseShape) shape = labShapeOf(baseShape); }
  function setFade(f) {
    if (Math.abs(f - fade) < 0.01) return; fade = f;
    for (const m of fadeMats) { const o0 = m.userData.o0, ghost = f < 0.999; m.transparent = ghost || m.userData.t0; m.opacity = o0 * (ghost ? 0.15 + 0.85 * f : 1); m.depthWrite = ghost ? false : m.userData.d0; m.needsUpdate = true; }
  }
  const has2 = (id) => curPath.includes(id);
  let curPath = [];
  const readyP = human.ready.then(async () => { if (disposed) return; bodyGeo = await loadBodyGeometry(); if (disposed) return; key = keyOf(p, map); assemble(p); return api; }).catch((e) => { console.warn('Huésped:', e); });
  const api = {
    object, human: true, ready: readyP, get isReady() { return ready; }, get labelY() { return 1.95 * L.scale * shape.y + 0.45 + (shownEvo >= 4 ? 0.3 : 0); }, get person() { return human; }, get map() { return map; }, get kit() { return ak; },
    /** Metamorfosis: al comer, la transformación breve (≈ 0,8 s) con el color de la forma nueva. */
    formaEvent(e) { if (e.ph !== 'come') return; const F = formaPorIndice(e.f); presence.burst(F ? parseInt(F.color.slice(1), 16) : L.glow, 1.5); },
    /** Híbrido Genómico: cambia el diseño. Las proporciones se aplican al instante; si cambian piezas o colores, se reconstruye en el próximo cuadro (la huella sin proporciones es la clave). */
    setLab(b) {
      if (!esLab || !b) return; lab = b; const k = labHuella({ ...b, prop: {} }), nl = labLook(b); if (nl.glow !== L.glow) { presence.setForma(nl.glow); } L = nl; labK = k; labApply();
    },
    get lab() { return lab; }, get proxies() { return (extra && extra.proxies) || []; }, get holder() { return holder; },
    event(e) { if (e.t === 'evolve') { presence.burst(pathColor(e.path || lastPath, L.glow)); return; } act = { k: e.t === 'melee' ? 'punch' : 'cast', t: e.t === 'melee' ? 0.6 : 1.0 }; },
    pose(n) { if (n === 'melee' || n === 'skill') api.event({ t: n }); },
    setCosmetic(id) { cosmetic = id || null; },
    setMap(m) { map = m || null; },
    stats() { return ak ? ak.stats() : { calls: 0, tris: 0 }; },
    update(dt, pl = p, ctx = {}) {
      time += dt; if (ctx.map && ctx.map !== map) map = ctx.map;
      if (!ready || disposed) { human.update(dt, { speed: 0 }); return; }
      const k2 = keyOf(pl, map); if (k2 !== key) { key = k2; assemble(pl); }
      // Modo Combo: los golpes los anima combo-anim.js (pose procedural + avance + hit-stop); el clip único «punch»/«cast» sólo se usa fuera del Combo
      const an = ctx.anim || null; if (an) act = null;
      if (act) { act.t -= dt; if (act.t <= 0) act = null; }
      const stop = an && ctx.freeze > 0, vis = an && an.w > 0 ? an.vis : 0, spd = Math.max(ctx.speed || 0, Math.min(14, vis)), c = pl.dead ? 'death' : act ? act.k : 'idle';
      if (c !== clip) { clip = c; human.play(c, { fade: 0.16, restart: c === 'punch' || c === 'cast' }); }
      if (an && !an.measured && human.bones && human.bones.upperarm01_R_h) { an.measured = true; an.measure(human.bones); }
      const post = an && an.w > 0.01 ? (b, g) => an.apply(b, g) : null;
      human.update(stop ? 0 : dt, { speed: spd, moveDir: vis > 1 ? { x: 0, z: 1 } : ctx.moveDir, pitch: ctx.pitch || 0, camera, post });
      if (lab) labLift = elevacionViva(human.bones, lab.prop, holder);   // las piernas y los pies más largos o cortos: la planta sigue en el suelo
      { // metamorfosis (fauna): el MATERIAL del cuerpo y la armadura pasa a escarcha / brasa / arcos… (huesped-armor.js) y el aura toma su color; ≈ 0,8 s para entrar y salir
        const F = formaPorIndice(pl.mf); if (F) { if (F.id !== fId) { fId = F.id; fHex = parseInt(F.color.slice(1), 16); fVis = F.vis; presence.setForma(fHex); } fkT = 1; } else if (fId) { fkT = 0; if (fk <= 0.001) { fId = ''; presence.setForma(null); } }
        fk += Math.max(-dt * 1.25, Math.min(dt * 1.25, fkT - fk)); ak.setForma(fHex, fVis, settings().reducirGravedad ? fk * 0.7 : fk);
      }
      presence.update(dt, time, { speed: spd, moveDir: ctx.moveDir, viewH: ctx.viewH });
      const evoN = shownEvo, lev = ((has2('apoteosis') || has2('reina')) ? 0.2 + 0.05 * Math.sin(time * 1.6) : has2('anomalia') ? 0.07 + 0.03 * Math.sin(time * 1.2) : 0); // la forma final levita
      const ao = an && an.w > 0 ? an.off : null, jit = stop ? Math.sin(time * 140) * 0.012 * (ctx.freezeK || 1) : 0;   // el hit-stop vibra apenas: el golpe «traba»
      holder.position.set((ao ? ao.lat || 0 : 0) + jit, (L.hover ? L.hover + 0.035 * Math.sin(time * 1.4) + 0.02 * Math.sin(time * 2.3) : 0) + lev * (L.scale) + (ao ? ao.up : 0) + labLift * holder.scale.y, ao ? ao.fwd : 0);
      lean += ((has2('velocidad') ? Math.min(1, spd / 7) * 0.16 : has2('depredador') ? 0.05 + Math.min(1, spd / 7) * 0.07 : 0) - lean) * Math.min(1, 6 * dt); holder.rotation.set(lean, (ao ? ao.yaw : 0) + (ctx.face || 0), 0, 'YXZ'); // postura: la Velocidad se inclina al correr, el Depredador va encorvado
      const br = 1 + 0.006 * evoN * Math.sin(time * 1.9), pp = presence.pop; holder.scale.set(L.scale * shape.x * pp * (2 - br), L.scale * shape.y * pp * br, L.scale * shape.z * pp * (2 - br)); holder.visible = !presence.hide;
      object.updateWorldMatrix(true, true);
      ak.update(dt, time, { object, speed: spd, glow: presence.boost });
      if (sigil) { const r = sigil.userData.r; r[0].rotation.z += dt * 0.3; r[1].rotation.z -= dt * 0.4; }
      if (weapon) weapon.update(dt, time); for (const w of itemW) w.update(dt, time);
      if (organs) organs.update(dt, time);
      if (extra.update) extra.update(dt, time, ctx);
      presence.object.visible = !(ctx.self && ctx.camDist != null && ctx.camDist < 1.3);
      if (ctx.self && ctx.camDist != null) { const f = clamp((ctx.camDist - FADE_NEAR) / (FADE_FAR - FADE_NEAR), 0, 1); setFade(f); object.visible = ctx.camDist > 0.35 && !pl.dead; } else { setFade(1); object.visible = !pl.dead; }
    },
    dispose() { disposed = true; teardown(); presence.dispose(); if (bodyGeo) bodyGeo.dispose(); human.dispose(); },
  };
  void uBeat;
  return api;
}
