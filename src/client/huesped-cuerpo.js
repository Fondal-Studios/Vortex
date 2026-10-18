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
import { uBeat } from './shaders.js';
import { createPresence, pathColor } from './huesped-presencia.js';
import { REGION, pathFor } from './host-human.js';
import { CHARACTERS, MELEE_WEAPONS } from '../sim/data.js';
import * as AXIOMA from './huesped/axioma.js';
import * as VESPER from './huesped/vesper.js';
import * as MICELIO from './huesped/micelio.js';
import * as UMBRA from './huesped/umbra.js';
import * as SERAF from './huesped/seraf.js';

/** Encuadre de cada Huésped para las pantallas de selección y evolución: [centro y, alto, ancho] (m, sin escala de pantalla). */
export const FRAME = { axioma: [0.98, 2.5, 1.9], vesper: [0.98, 2.4, 1.8], micelio: [1.2, 3.5, 2.7], umbra: [1.0, 2.4, 1.8], seraf: [1.0, 2.45, 2.3] };
export const isHost = (char) => !!(CHARACTERS[char] && CHARACTERS[char].host);
const DESIGN = { axioma: AXIOMA, vesper: VESPER, micelio: MICELIO, umbra: UMBRA, seraf: SERAF };
/** Humano base (preset de la fábrica), escala del Huésped y colores clave. */
const LOOK = {
  axioma: { preset: 'jugador1', scale: 1.0, glow: 0x4ab4ff, ember: 0xff6a1a },
  vesper: { preset: 'jugador4', scale: 0.98, glow: 0xb04bff, ember: 0xff5ad8 },
  micelio: { preset: 'jugador3', scale: 1.25, glow: 0x7be03a, ember: 0xc8ff4a },
  umbra: { preset: 'jugador2', scale: 1.0, glow: 0xb98cff, ember: 0x9a6aff, hover: 0.14 }, // flota: el sudario cubre los pies
  seraf: { preset: 'jugador2', scale: 1.0, glow: 0xffd45a, ember: 0xffb040 },
};
const NEUTRAL = { height: 1, width: 1, shoulders: 1, belly: 0, head: 1, jaw: 1, nose: 1 };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const FADE_FAR = 1.6, FADE_NEAR = 0.7;
/** Crecimiento por nivel (+4,5 % por nivel, hasta +18 %) y proporciones propias de cada camino elegido: [ancho, alto] que se SUMAN (coraza ancha y maciza, velocidad esbelta, depredador alto…). */
export const GROW = 0.045;
const PATH_SHAPE = { depredador: [0.03, 0.05], coraza: [0.1, 0.0], velocidad: [-0.04, 0.03], resonancia: [0.0, 0.02], simbiosis: [0.07, 0.03], artilleria: [0.05, 0.0], apoteosis: [0.0, 0.06], anomalia: [0.03, 0.04] };
export function bodyScale(evo, path) { let w = 0, h = 0; for (const id of path.slice(0, evo)) { const q = PATH_SHAPE[id]; if (q) { w += q[0]; h += q[1]; } } const g = 1 + evo * GROW; return { g, x: g * (1 + w), y: g * (1 + h), z: g * (1 + w) }; }

export function createHostBody(THREE, kit, p, opts = {}) {
  const quality = opts.quality || kit.quality || 'low', L = LOOK[p.char] || LOOK.axioma, D = DESIGN[p.char] || AXIOMA;
  const object = new T.Group(); object.name = 'huesped-' + p.char;
  const holder = new T.Group(); holder.scale.setScalar(L.scale); object.add(holder);
  const human = createHuman(kit, { char: p.char, name: p.name || p.char, color: L.glow, accent: L.glow, noGear: true, weapon: null, hands: false, overrides: { body: NEUTRAL } });
  holder.add(human.object); holder.visible = false; // hasta que el kit esté armado no se muestra (si no, se vería el humano desnudo)
  let shownEvo = -1, shape = { g: 1, x: 1, y: 1, z: 1 }, lean = 0, lastPath = '', ak = null, bodyGeo = null, map = opts.map || null, key = '', ready = false, disposed = false, time = Math.random() * 10, act = null, clip = '', fade = 1, fadeMats = [], weapon = null, organs = null, extra = {}, sigil = null;
  const camera = opts.camera || null, presence = createPresence(T, { glow: L.glow, quality }); object.add(presence.object);

  async function loadBodyGeometry() {
    const lod = !!kit.profile.lod, m = await kit.store.mesh(lod ? 'body@none' : 'body', lod, 'body'), g = new T.BufferGeometry();
    for (const [k, a] of Object.entries(m.attrs)) { if (k === 'index') g.setIndex(a.clone()); else g.setAttribute(k, a.clone()); }
    g.computeBoundingSphere(); return g;
  }
  const keyOf = (pl, mp) => `${pl.mr | 0}|${pl.evo | 0}|${(pl.pth || []).join()}|${pl.mw || ''}|${(pl.cg || []).join()}|${mp}`;
  function teardown() {
    if (weapon) { weapon.dispose(); weapon = null; } if (organs) { organs.dispose(); organs = null; }
    if (ak) { ak.dispose(); ak = null; } extra = {};
    if (sigil) { object.remove(sigil); sigil.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); sigil = null; }
  }
  function assemble(pl) {
    teardown();
    const evo = pl.evo | 0, path = pathFor(evo, pl.pth), region = map ? (REGION[map] || null) : null;
    const rimC = new T.Color(L.glow).lerp(new T.Color(region ? region.accent : L.glow), 0.45); if (evo > 0) rimC.lerp(new T.Color(pathColor(path[evo - 1], L.glow)), 0.5); // la luz de borde toma el color del último camino
    ak = createArmorKit(human, kit, { quality, accent: L.ember, rim: rimC, crack: L.ember, belly: D.BELLY ?? 0 });
    curPath = path; shape = bodyScale(evo, path); holder.scale.set(L.scale * shape.x, L.scale * shape.y, L.scale * shape.z); // el cuerpo crece con cada nivel y cambia de proporciones según el camino
    const up = shownEvo >= 0 && evo > shownEvo; shownEvo = evo; lastPath = path[evo - 1] || '';
    presence.set({ evo, path, rank: Math.max(1, pl.mr | 0), scale: L.scale * shape.g });
    const ctx = { evo, path, has: (id) => path.includes(id), region, map, glow: L.glow, ember: L.ember, char: p.char, quality, melee: pl.mw || '' };
    extra = D.build(ak, ctx) || {};
    const reg = addRegion(ak, ctx, { t: tools(ak) }), own = extra.update; extra.update = (dt, tt, c) => { if (own) own(dt, tt, c); reg.update(dt, tt, c); };
    ak.finish({ bodyGeometry: bodyGeo });
    for (const r of ak.extraRoots) object.add(r);
    ak.setObject(object);
    if (evo >= 4) { // forma final: sello brillante en el suelo (2 anillos que giran)
      sigil = new T.Group(); const gm = new T.MeshBasicMaterial({ color: L.glow, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false });
      const r1 = new T.Mesh(new T.RingGeometry(1.2 * L.scale, 1.25 * L.scale, 48), gm), r2 = new T.Mesh(new T.RingGeometry(0.85 * L.scale, 0.875 * L.scale, 6), gm);
      for (const r of [r1, r2]) { r.rotation.x = -Math.PI / 2; r.position.y = 0.03; r.frustumCulled = false; sigil.add(r); } sigil.userData.r = [r1, r2]; object.add(sigil);
    }
    // arma melee fusionada en la mano derecha
    if (pl.mw && MELEE_WEAPONS[pl.mw]) {
      const mount = ak.mount('wrist_R', ak.P('wrist_R')); if (mount) {
        mount.rotation.set(-Math.PI / 2 + 0.2, 0, 0); // hoja hacia delante
        weapon = attachToViewmodel(T, mount, pl.mw, { frame: 'host', size: 1 * (L.scale), offset: [0, -0.1, 0.0], tier: evo, quality, color: L.glow, aura: false });
      }
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
  function setFade(f) {
    if (Math.abs(f - fade) < 0.01) return; fade = f;
    for (const m of fadeMats) { const o0 = m.userData.o0, ghost = f < 0.999; m.transparent = ghost || m.userData.t0; m.opacity = o0 * (ghost ? 0.15 + 0.85 * f : 1); m.depthWrite = ghost ? false : m.userData.d0; m.needsUpdate = true; }
  }
  const has2 = (id) => curPath.includes(id);
  let curPath = [];
  const readyP = human.ready.then(async () => { if (disposed) return; bodyGeo = await loadBodyGeometry(); if (disposed) return; key = keyOf(p, map); assemble(p); return api; }).catch((e) => { console.warn('Huésped:', e); });
  const api = {
    object, human: true, ready: readyP, get isReady() { return ready; }, get labelY() { return 1.95 * L.scale * shape.y + 0.45 + (shownEvo >= 4 ? 0.3 : 0); }, get person() { return human; }, get map() { return map; }, get kit() { return ak; },
    event(e) { if (e.t === 'evolve') { presence.burst(pathColor(e.path || lastPath, L.glow)); return; } act = { k: e.t === 'melee' ? 'punch' : 'cast', t: e.t === 'melee' ? 0.6 : 1.0 }; },
    pose(n) { if (n === 'melee' || n === 'skill') api.event({ t: n }); },
    setMap(m) { map = m || null; },
    stats() { return ak ? ak.stats() : { calls: 0, tris: 0 }; },
    update(dt, pl = p, ctx = {}) {
      time += dt; if (ctx.map && ctx.map !== map) map = ctx.map;
      if (!ready || disposed) { human.update(dt, { speed: 0 }); return; }
      const k2 = keyOf(pl, map); if (k2 !== key) { key = k2; assemble(pl); }
      if (act) { act.t -= dt; if (act.t <= 0) act = null; }
      const spd = ctx.speed || 0, c = pl.dead ? 'death' : act ? act.k : 'idle';
      if (c !== clip) { clip = c; human.play(c, { fade: 0.16, restart: c === 'punch' || c === 'cast' }); }
      human.update(dt, { speed: spd, moveDir: ctx.moveDir, pitch: ctx.pitch || 0, camera });
      presence.update(dt, time, { speed: spd, moveDir: ctx.moveDir, viewH: ctx.viewH });
      const evoN = shownEvo, lev = (has2('apoteosis') ? 0.2 + 0.05 * Math.sin(time * 1.6) : has2('anomalia') ? 0.07 + 0.03 * Math.sin(time * 1.2) : 0); // la forma final levita
      holder.position.y = (L.hover ? L.hover + 0.035 * Math.sin(time * 1.4) + 0.02 * Math.sin(time * 2.3) : 0) + lev * (L.scale);
      lean += ((has2('velocidad') ? Math.min(1, spd / 7) * 0.16 : has2('depredador') ? 0.05 + Math.min(1, spd / 7) * 0.07 : 0) - lean) * Math.min(1, 6 * dt); holder.rotation.x = lean; // postura: la Velocidad se inclina al correr, el Depredador va encorvado
      const br = 1 + 0.006 * evoN * Math.sin(time * 1.9), pp = presence.pop; holder.scale.set(L.scale * shape.x * pp * (2 - br), L.scale * shape.y * pp * br, L.scale * shape.z * pp * (2 - br)); holder.visible = !presence.hide;
      object.updateWorldMatrix(true, true);
      ak.update(dt, time, { object, speed: spd, glow: presence.boost });
      if (sigil) { const r = sigil.userData.r; r[0].rotation.z += dt * 0.3; r[1].rotation.z -= dt * 0.4; }
      if (weapon) weapon.update(dt, time);
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
