// Cuerpo de un jugador EN PARTIDA con su modelo de Huésped (huespedes-evo.js): lo usa render.js → syncPlayers (propio en 3ª persona y aliados).
//   const b = createHostBody(THREE, p, { quality: 'low' });   // p = jugador del snapshot (char, evo, mw)
//   scene.add(b.object); cada cuadro: b.update(dt, p, { speed, moveDir:{x,z}, pitch, camDist, self }); eventos: b.event(e) ({t:'melee'|'skill', pid})
// El modelo mira a +Z con los pies en y = 0; render.js orienta `b.object` (rumbo h, gravedad up) y lo apoya en el suelo.
// Locomoción procedural (el Huésped no tiene articulaciones en las piernas): inclinación hacia donde se mueve, balanceo hacia los costados, rebote de pasos,
// vaivén de brazos opuestos (sólo si no está en una pose de golpe o habilidad), cabeza que acompaña la mira y reposo con respiración al quedarse quieto.
// Pose de melee / habilidad al llegar el evento. Si la cámara se acerca a menos de FADE_NEAR el cuerpo propio se vuelve translúcido (y a < HIDE_NEAR se oculta).
// Presupuesto Low: ≤ 24 llamadas de dibujo (la geometría de evolución se recorta para caber; escala y brillo siguen el nivel real).
import { buildHostEvo } from './huespedes-evo.js';
import { CHARACTERS } from '../sim/data.js';

const FADE_FAR = 1.6, FADE_NEAR = 0.7;           // distancia de cámara (u): translúcido por debajo de FAR, casi invisible en NEAR
const SIZE = { axioma: 0.92, vesper: 0.9, micelio: 0.7, umbra: 0.78, seraf: 0.88 }; // tamaño relativo (el jugador mide ~1.8 u)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const isHost = (char) => !!(CHARACTERS[char] && CHARACTERS[char].host);

export function createHostBody(THREE, p, opts = {}) {
  const T = THREE, quality = opts.quality || 'low';
  const object = new T.Group(); object.name = 'cuerpo-' + p.char;
  const build = () => buildHostEvo(T, p.char, { evo: p.evo | 0, melee: p.mw || '', organs: p.cg || [], quality, budget: quality === 'low' ? 24 : 0 });
  let host = build(), time = Math.random() * 10, phase = 0, key = `${p.evo | 0}|${p.mw || ''}|${(p.cg || []).join()}`, fade = 1, mats = [];
  const holder = new T.Group(); holder.scale.setScalar(SIZE[p.char] || 0.9); holder.add(host.group); object.add(holder);
  function collect() { // materiales únicos del cuerpo, con su opacidad original, para el fundido
    const set = new Set(); host.group.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => set.add(m)); });
    mats = [...set].map((m) => { if (m.userData.o0 == null) { m.userData.o0 = m.opacity; m.userData.t0 = m.transparent; m.userData.d0 = m.depthWrite; } return m; }); fade = 1;
  }
  collect();
  function setFade(f) {
    if (Math.abs(f - fade) < 0.01) return; fade = f;
    for (const m of mats) { const o0 = m.userData.o0, ghost = f < 0.999; m.transparent = ghost || m.userData.t0; m.opacity = o0 * (ghost ? 0.18 + 0.82 * f : 1); m.depthWrite = ghost ? false : m.userData.d0; m.needsUpdate = true; }
  }
  return {
    object, get host() { return host; },
    event(e) { if (e.t === 'melee') host.pose('melee'); else if (e.t === 'skill') host.pose('skill'); },
    update(dt, pl, ctx = {}) {
      const k2 = `${pl.evo | 0}|${pl.mw || ''}|${(pl.cg || []).join()}`;
      if (k2 !== key) { key = k2; host.setEvo(pl.evo | 0); host.setMelee(pl.mw || ''); host.setOrgans(pl.cg || []); collect(); }
      time += dt; host.update(dt, time);
      const J = host.joints, spd = ctx.speed || 0, mv = ctx.moveDir || { x: 0, z: 0 }, k = clamp(spd / 8, 0, 1), still = host.poseName === 'idle';
      phase += dt * (3.2 + spd * 0.75);
      if (J.root) { J.root.g.rotation.x += mv.z * k * 0.2; J.root.g.rotation.z += mv.x * k * 0.14; J.root.g.position.y += Math.abs(Math.sin(phase)) * 0.06 * k; }
      if (J.torso) J.torso.g.rotation.y += Math.sin(phase) * 0.16 * k * (still ? 1 : 0.3);
      if (still) { const sw = Math.sin(phase) * 0.75 * k * (mv.z >= 0 ? 1 : -1); if (J.armR) J.armR.g.rotation.x += sw; if (J.armL) J.armL.g.rotation.x -= sw; if (J.foreR) J.foreR.g.rotation.x -= Math.max(0, sw) * 0.5; if (J.foreL) J.foreL.g.rotation.x -= Math.max(0, -sw) * 0.5; }
      if (J.head) J.head.g.rotation.x -= clamp(ctx.pitch || 0, -1, 1) * 0.55;
      if (J.tail1) J.tail1.g.rotation.y += Math.sin(phase * 0.5) * 0.2 * k;
      if (ctx.self && ctx.camDist != null) { const f = clamp((ctx.camDist - FADE_NEAR) / (FADE_FAR - FADE_NEAR), 0, 1); setFade(f); object.visible = ctx.camDist > 0.35 && !pl.dead; } else { setFade(1); object.visible = !pl.dead; }
    },
    dispose() { host.dispose(); },
  };
}
