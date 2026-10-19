// EFECTOS DE GOLPE DEL MODO COMBO (3.ª persona y espectadores; la 1.ª persona la dibuja hostfx-melee.js con los golpes que elige `fpFor`).
// Convierte los eventos de la simulación (`combo`, `melee`, `beam`, `blink`, `hab`) en lo que el jugador VE y SIENTE:
//   · pose procedural del cuerpo por golpe (combo-anim.js: anticipación → golpe → contacto → recuperación) + avance visual hacia el objetivo
//   · estela del arma/garra (UNA malla con 6 cintas, 1 llamada de dibujo) con el color de identidad del Huésped
//   · IMPACTO en el instante del contacto: hit-stop visual del atacante (2–7 cuadros, la simulación NO se toca), destello + chispas + onda con el estilo del Huésped
//     (hostfx-melee.worldImpact), sacudida y empujón de FOV de la cámara proporcionales al peso del golpe (con tope), reacción de las criaturas, sonido que crece por golpe
//   · REMATE (último golpe de una cadena de 2+): onda grande, más hit-stop, cámara lenta visual de 0,12 s
// Todo es visual (no toca g.rng ni el estado del juego) y respeta «Reducir movimiento» (cristal.reduceMotion) y «Reducir efectos» (cristal.reduceFx).
// API (render.js crea `renderer.comboFx = createComboFx(renderer)`):
//   ingest(state, me)         · UNA vez por cuadro, ANTES de syncPlayers: lee los eventos y arranca las poses
//   frameFor(pid, dt, p)      · lo llama syncPlayers por jugador: avanza la pose y devuelve el contexto del cuerpo { anim, freeze, face }
//   update(dt, state, me)     · después de syncPlayers: estelas, cámara y cámara lenta
//   owns(e, me, state)        · ¿este `melee` ya lo dibuja combo-fx? (hostfx-melee lo omite)   ·  fpFor(pid) → nombre del golpe de 1.ª persona
//   lead(pid)                 · cuánto adelanta el cuerpo (m) para que la cámara de 3.ª persona lo acompañe   ·  timeScale() → 1 normalmente, <1 en el remate
import * as THREE from 'three';
import { CHARACTERS } from '../sim/data.js';
import { HOST_PAL } from './hostfx.js';
import { cfg } from './quality.js';
import { StrikePose, animDe, animHab, animMelee } from './combo-anim.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), WHITE = new THREE.Color(0xffffff);
const FRAME = 1 / 60;
const NR = 6, TP = 12, LIFE = 0.24;   // cintas de estela: cuántas, puntos por cinta, vida (s)
const palOf = (char) => HOST_PAL[char] || { c: CHARACTERS[char] ? CHARACTERS[char].color : 0x66ffee, a: 0xffffff, d: 0x10101c };
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

export function createComboFx(renderer) {
  const scene = renderer.scene, fx = renderer.fx;
  const runs = new Map();            // pid → { pose, char, freeze, freezeK, face, cur, ... }
  let prevMon = [], slow = 0, frame = 0, sound = null, meId = 0, lastState = null;
  const touched = new Set();

  /* ── opciones: nivel de efectos (0 completos · 1 reducidos · 2 sin movimiento de cámara) ── */
  const level = () => (fx.combat && fx.combat.reduced ? 2 : lsGet('cristal.reduceFx') === '1' ? 1 : 0);
  const budget = () => clamp(cfg().particles / 1600, 0.4, 1) * (level() ? 0.6 : 1);   // Baja dibuja menos partículas

  /* ── cintas de estela (una malla; color por vértice; aditiva) ── */
  const pos = new Float32Array(NR * TP * 2 * 3), col = new Float32Array(NR * TP * 2 * 3), alp = new Float32Array(NR * TP * 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('aC', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('aA', new THREE.BufferAttribute(alp, 1).setUsage(THREE.DynamicDrawUsage));
  { const idx = []; for (let r = 0; r < NR; r++) for (let i = 0; i < TP - 1; i++) { const v = (r * TP + i) * 2; idx.push(v, v + 1, v + 2, v + 2, v + 1, v + 3); } geo.setIndex(idx); }
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'attribute vec3 aC; attribute float aA; varying vec3 vC; varying float vA; void main(){ vC = aC; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ gl_FragColor = vec4(vC, vA); }' });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 20; mesh.visible = false; mesh.name = 'combo-estelas'; scene.add(mesh);
  const ribbons = Array.from({ length: NR }, () => ({ pid: 0, hand: '', hist: [], color: new THREE.Color(), on: 0 }));
  const ribbonFor = (pid, hand) => ribbons.find((r) => r.pid === pid && r.hand === hand) || ribbons.find((r) => !r.hist.length && !r.on) || ribbons[0];

  /* ── ciclo de vida de un jugador ── */
  function runOf(pid, char) {
    let R = runs.get(pid);
    if (!R || R.char !== char) { R = { pose: new StrikePose(), char, freeze: 0, freezeK: 1, face: 0, faceT: 0, cur: null, lastPos: null, slide: null, relT: 0, n: 0, aliveUntil: 0 }; runs.set(pid, R); }
    return R;
  }
  const playerOf = (state, pid) => state.players.find((p) => p.id === pid);

  /** La criatura más cercana por delante del jugador (usa también las del cuadro anterior: la que acaba de morir ya no viene en el snapshot). */
  function targetOf(p, dir, maxD) {
    let best = null, bd = 1e9; const up = V(p.up), o = V(p.pos);
    const seen = new Set();
    for (const list of [lastState ? lastState.monsters : [], prevMon]) for (const m of list) {
      if (seen.has(m.id)) continue; seen.add(m.id);
      _a.set(m.p[0], m.p[1], m.p[2]).sub(o); _a.addScaledVector(up, -_a.dot(up)); const l = _a.length(); if (l > maxD + (m.r || 1) || l < 1e-3) continue;
      if (_a.divideScalar(l).dot(dir) < 0.35 && l > (m.r || 1) + 0.8) continue;
      if (l < bd) { bd = l; best = m; }
    }
    return best ? { m: best, dist: bd } : null;
  }

  /* ── eventos del cuadro ── */
  function ingest(state, me) {
    if (me) meId = me.id; frame++;
    const evs = state.events; if (!evs || !evs.length) { prevMon = state.monsters; lastState = state; return; }
    lastState = lastState || state;
    const beams = new Map(), blinks = new Map(), melee = new Map();
    for (const e of evs) { if (e.t === 'beam' && e.pid != null) beams.set(e.pid, e.to); else if (e.t === 'blink' && e.pid != null) blinks.set(e.pid, e.p); else if (e.t === 'melee' && e.pid != null) melee.set(e.pid, e); }
    // melé del modo SHOOTER: sin evento `combo`; el `melee` (kind + cmb) elige la pose. Si hubo ejecución y golpe normal en el mismo cuadro, manda el normal (la ejecución sólo pesa más).
    const sh = new Map();
    for (const e of evs) if (e.t === 'melee' && e.pid != null && !e.land) { const q = sh.get(e.pid); if (!q || (q.kind === 'exec' && e.kind !== 'exec')) sh.set(e.pid, { ...e, execAlso: !!(q && q.kind === 'exec') }); else if (e.kind === 'exec') q.execAlso = true; }
    const todo = []; for (const e of evs) if (e.t === 'combo' || e.t === 'hab') todo.push(e);
    for (const [pid, e] of sh) { const p = playerOf(state, pid); if (p && p.md !== 1) todo.push({ ...e, t: 'melee1' }); }
    for (const e of todo) {
      const p = playerOf(state, e.pid); if (!p || p.dead || (e.t !== 'melee1' && p.md !== 1) || !CHARACTERS[p.char] || !CHARACTERS[p.char].host) continue;
      const R = runOf(e.pid, p.char), h = V(p.h), up = V(p.up), self = e.pid === meId;
      if (e.t === 'hab') {
        const d = animHab(p.char, e.ph === 'cast' ? 'cast' : 'go'); if (e.ph === 'cast') R.pose.trigger(d); else { R.pose.release(); R.pose.trigger(d); }
        R.cur = { d, e, p, hab: true, P: null }; continue;
      }
      // golpe
      if (R.cur && R.pose.arq && !R.pose.hit && !R.cur.hab) contact(R, state, true);   // el golpe anterior se cancela antes de su contacto: que igual se sienta
      const m1 = e.t === 'melee1', fin = m1 ? (e.kind === 'exec' || e.execAlso || (e.kind === 'light' && e.cmb === 3)) : !!e.fin && (e.n | 0) >= 2;
      const d = m1 ? { ...animMelee(p.char, e.kind, { cmb: e.cmb }), ...(fin ? { fin: true, peso: Math.max(1.9, animMelee(p.char, e.kind, { cmb: e.cmb }).peso * 1.2), hs: 5 } : {}) } : animDe(p.char, e.id, { fin, n: e.n | 0 });
      const ranged = !m1 && !!(melee.size === 0 && beams.has(e.pid)) || d.a === 'arco' || d.a === 'carga' || d.a === 'apertura';
      const tg = targetOf(p, h, ranged ? 16 : 9), dist = tg ? tg.dist : 99, av = Math.max(0.1, d.av || 0);
      const reach = av <= 0.01 || d.av <= 0 ? 1 : (tg ? clamp((dist - 1.15) / av, 0, 1) : (e.hit ? 0.5 : 0.7));
      R.pose.trigger(d, { reach: ranged ? 0 : reach });
      R.cur = { d, e, p, tg, P: null, beam: beams.get(e.pid) || null, up, h, self, hits: e.hit | 0, ranged, fin };
      R.n = m1 ? (e.cmb || 1) : e.n | 0; R.aliveUntil = renderer.t + 1.2;
      // giro visual hacia el objetivo (hasta ±0,7 rad, vuelve solo)
      if (tg) { _a.set(tg.m.p[0], tg.m.p[1], tg.m.p[2]).sub(V(p.pos)); const fw = _a.dot(h), sd = _a.dot(_b.crossVectors(up, h)); R.face = clamp(Math.atan2(sd, fw), -0.7, 0.7); } else R.face = 0; R.faceT = 0.5;
      // 1.ª persona propia: el viewmodel de hostfx-melee sólo reacciona a `melee`; las flechas de Seraf y la «Caída» no lo emiten, así que se le pide el golpe
      if (self && !renderer.third && !melee.has(e.pid) && !m1 && renderer.hostfx && renderer.hostfx.melee) renderer.hostfx.melee.play(d.peso >= 1.4 ? 'heavy' : 'light', { char: p.char, hit: e.hit | 0, keepCombo: true, u0: 0.15, fp: d.fp });
      // sonido del barrido (el del contacto va aparte)
      if (sound && !(self && !renderer.third)) sound.melee(p.char, m1 && e.kind === 'exec' ? 'light' : d.peso >= 1.4 ? 'heavy' : 'light', e.p || null, 0, d.peso >= 1.4);
      // marcador del golpe en 3.ª persona: el teletransporte se ve como un arrastre (Umbra) en vez de un salto
      const bl = blinks.get(e.pid); if (bl && R.lastPos) blinkSlide(R, p, bl);
    }
    prevMon = state.monsters; lastState = state;
  }
  function blinkSlide(R, p, to) {
    const from = R.lastPos, up = V(p.up), h = V(p.h), pal = palOf(p.char);
    _a.copy(from).sub(V(to)); const l = _a.length(); if (l < 0.6 || l > 14) return;
    const rg = _b.crossVectors(up, h).normalize();
    R.slide = { fwd: _a.dot(h), lat: _a.dot(rg), t: 0, max: 0.14 };
    const a = from.clone().addScaledVector(up, 1.0), b = V(to).addScaledVector(up, 1.0);
    fx.line(a, b, 0xffffff, 0.16, 0.22, { a0: 1, a1: 0, shrink: 0.9 }); fx.line(a, b, pal.c, 0.6, 0.3, { a0: 0.55, a1: 0, shrink: 0.9 });
    fx.sparks(a, pal.a, Math.round(6 * budget()), 8, 0.35, { c2: pal.c });
  }

  /** El momento del contacto: hit-stop, destello y chispas, cámara, criaturas y sonido. `cancel` = se llama porque el siguiente golpe interrumpió la animación. */
  function contact(R, state, cancel = false) {
    const C = R.cur; if (!C || C.done) return; C.done = true; if (C.hab) return;
    const d = C.d, p = C.p, pal = palOf(p.char), self = C.self, lv = level(), hit = C.hits > 0, peso = d.peso * (cancel ? 0.7 : 1);
    const up = C.up, h = C.h, o = V(p.pos);
    // punto del impacto: la criatura (pegado a su lado cercano), el final del rayo (arqueros) o el alcance del arma
    let P;
    if (C.ranged && C.beam) P = V(C.beam);
    else if (C.tg) { const m = C.tg.m; P = V(m.p).addScaledVector(_a.copy(o).sub(V(m.p)).normalize(), (m.r || 1) * 0.6); }
    else P = o.clone().addScaledVector(up, 1.0).addScaledVector(h, 2.4);
    C.P = P;
    const R2 = renderer, snd = sound;
    const near = hit || C.ranged;
    if (near && R2.hostfx && R2.hostfx.melee && R2.hostfx.melee.worldImpact) {
      const n = _d.copy(h).negate().clone(); // el estilo propio de cada Huésped (chispas, garras, anillos…)
      R2.hostfx.melee.worldImpact(p.char, P, n, pal, peso >= 1.4, !!C.fin, up);
    }
    // onda extra y chispas por peso (con tope y presupuesto de partículas)
    const b = budget();
    if (near) {
      fx.sparks(P, 0xffffff, Math.round(clamp(5 + peso * 5, 6, 22) * b), 14 + peso * 3, 0.42, { dir: _d.copy(h).negate(), cone: 1.4, c2: pal.c });
      if (peso >= 1.5) fx.ring(P.clone().addScaledVector(up, -0.3), up, pal.c, 2 + peso * 1.2, 0.38, { th: 0.12, shock: true });
    }
    if (C.fin) { // REMATE: onda grande en el suelo, columna de chispas y destello del color del Huésped
      fx.ring(o.clone().addScaledVector(up, 0.05), up, pal.a, 5 + peso, 0.5, { th: 0.16, shock: true }); fx.ring(o.clone().addScaledVector(up, 0.05), up, pal.c, 3.2, 0.36, { th: 0.1 });
      fx.flash(P, pal.a, 3.2, 0.22, { burst: true }); fx.sparks(P, pal.a, Math.round(20 * b), 18, 0.55, { c2: 0xffffff }); fx.spray(P, pal.c, Math.round(6 * b), 6, 0.6, 0.6, { c2: pal.a, up: 3, grow: -0.4 });
    }
    // sensación en el atacante: hit-stop (visual) y cámara
    const frames = lv === 2 ? 0 : lv === 1 ? Math.max(0, Math.round(d.hs * 0.4)) : d.hs;
    if (near && frames > 0) { R.freeze = Math.max(R.freeze, frames * FRAME); R.freezeK = clamp(peso, 0.6, 2); }
    if (self && fx.combat && near) {
      if (lv < 2) { fx.combat.addShake(clamp(0.1 + 0.2 * peso, 0.1, 0.95) * (lv ? 0.5 : 1)); fx.combat.K.fov = Math.min(fx.combat.K.fov + (lv ? 0.3 : 0.5) * peso, 3.2); fx.combat.K.p = Math.min(fx.combat.K.p + 0.004 * peso, 0.02); }
    }
    if (C.fin && lv === 0 && near) slow = 0.12;   // cámara lenta visual (sólo partículas y animaciones)
    // reacción de las criaturas cercanas al impacto (el empujón real lo da la simulación; acá se ve el golpe)
    if (near) for (const [id, e] of renderer.ents.mon) { const m = (state.monsters.find((q) => q.id === id)); if (!m) continue; if (V(m.p).distanceTo(P) < 2.2 + (m.r || 1)) { e.kick = Math.min(1.6, (e.kick || 0) + 0.6 + 0.4 * peso); e.kickT = 0; } }
    if (snd && near && !(self && !renderer.third)) snd.comboHit(p.char, peso, R.n || 1, !!C.fin, P.toArray());
  }

  /** Cuadro de un jugador: avanza la pose y arma el contexto del cuerpo. Devuelve null si ese jugador no está en Combo. */
  function frameFor(pid, dt, p, state) {
    if (!p || !CHARACTERS[p.char] || !CHARACTERS[p.char].host) { runs.delete(pid); return null; }
    const R = runOf(pid, p.char); R.stepped = frame; touched.add(pid);
    if (R.freeze > 0) { R.freeze = Math.max(0, R.freeze - dt); if (R.freeze > 0) return { anim: R.pose, freeze: R.freeze, freezeK: R.freezeK, face: R.face * clamp(R.faceT * 2, 0, 1) }; }
    const hit = R.pose.step(dt); if (hit && R.cur) contact(R, state || lastState);
    if (R.faceT > 0) R.faceT -= dt; else R.face += (0 - R.face) * Math.min(1, dt * 8);
    if (R.slide) { R.slide.t += dt; const u = clamp(R.slide.t / R.slide.max, 0, 1), k = (1 - u) * (1 - u); R.pose.off.fwd += R.slide.fwd * k; R.pose.off.lat = R.slide.lat * k; if (u >= 1) { R.slide = null; R.pose.off.lat = 0; } } else R.pose.off.lat = 0;
    R.lastPos = V(p.pos);
    return { anim: R.pose, freeze: 0, freezeK: 1, face: R.face * clamp(R.faceT * 2 + (R.pose.w > 0 ? 0.5 : 0), 0, 1) };
  }

  /** Estelas + jugadores que no se dibujan (1.ª persona propia: sólo se mantiene el reloj) + cámara lenta. */
  function update(dt, state, me) {
    if (me) meId = me.id; lastState = state;
    for (const [pid, R] of runs) {
      if (R.stepped !== frame) { // sin cuerpo en pantalla (1.ª persona propia): el contacto sólo mueve el reloj y las sensaciones de cámara
        const p = playerOf(state, pid); if (!p || !CHARACTERS[p.char] || !CHARACTERS[p.char].host) { runs.delete(pid); continue; }
        if (R.freeze > 0) R.freeze = Math.max(0, R.freeze - dt); else { const hit = R.pose.step(dt); if (hit && R.cur) { if (pid === meId && !renderer.third) R.cur.done = true; else contact(R, state); } }
      }
    }
    if (slow > 0) slow = Math.max(0, slow - dt);
    // cintas
    let any = false;
    for (const r of ribbons) { for (const q of r.hist) q.age += dt; while (r.hist.length && r.hist[r.hist.length - 1].age > LIFE) r.hist.pop(); r.on = Math.max(0, r.on - dt); }
    for (const [pid, R] of runs) {
      const P = R.pose, C = R.cur; if (!C || C.hab || !P.arq || P.done || !C.d.trk || !P.bones) continue;
      const a = P.arq, tt = P.time, win = tt > a.hit - 0.1 && tt < a.hit + 0.07; if (!win || R.freeze > 0) continue;
      const pal = palOf(R.char), span = C.d.trk * 0.6 * (P.armLen / 0.6) + (C.p.mw ? 0.35 : 0);
      for (const hand of a.tip) {
        const side = C.d.m && a.tip.length === 1 ? (hand === 'R' ? 'L' : 'R') : hand, r = ribbonFor(pid, hand); r.pid = pid; r.hand = hand; r.on = 0.3;
        if (!P.tip(side, 0.12, _a)) continue; const b0 = _a.clone(); P.tip(side, 0.12 + span, _b);
        r.hist.unshift({ a: b0, b: _b.clone(), age: 0 }); if (r.hist.length > TP) r.hist.pop();
        r.color.set(pal.c).lerp(WHITE, 0.4);
      }
    }
    for (let ri = 0; ri < NR; ri++) {
      const r = ribbons[ri], hs = r.hist; if (!hs.length && r.pid) { r.pid = 0; r.hand = ''; }
      for (let i = 0; i < TP; i++) {
        const q = hs[Math.min(i, hs.length - 1)], v = (ri * TP + i) * 2;
        if (!q) { alp[v] = alp[v + 1] = 0; continue; }
        const al = i < hs.length ? Math.pow(1 - q.age / LIFE, 1.3) : 0;
        pos[v * 3] = q.a.x; pos[v * 3 + 1] = q.a.y; pos[v * 3 + 2] = q.a.z; pos[v * 3 + 3] = q.b.x; pos[v * 3 + 4] = q.b.y; pos[v * 3 + 5] = q.b.z;
        for (let j = 0; j < 2; j++) { col[(v + j) * 3] = r.color.r; col[(v + j) * 3 + 1] = r.color.g; col[(v + j) * 3 + 2] = r.color.b; }
        alp[v] = al * 0.22; alp[v + 1] = al * 0.85; if (al > 0.01) any = true;
      }
    }
    geo.attributes.position.needsUpdate = geo.attributes.aC.needsUpdate = geo.attributes.aA.needsUpdate = true; mesh.visible = any;
    touched.clear();
  }

  return {
    ingest, frameFor, update, setSound(s) { sound = s; },
    /** hostfx-melee: ¿el `melee` de este jugador lo dibuja combo-fx? (Combo + (3.ª persona propia o de otro jugador)). */
    owns(e, me, state) { const p = state && state.players.find((q) => q.id === e.pid); return !!(p && !e.land && CHARACTERS[p.char] && CHARACTERS[p.char].host && !(me && e.pid === me.id && !renderer.third)); },
    /** Golpe de 1.ª persona (nombre de keyframes de hostfx-melee) para el `combo` de este cuadro. */
    fpFor(pid) { const R = runs.get(pid); return R && R.cur && R.cur.d ? R.cur.d.fp || null : null; },
    lead(pid) { const R = runs.get(pid); return R && R.pose.w > 0 ? R.pose.off.fwd * 0.5 : 0; },
    timeScale() { return slow > 0 ? 0.3 : 1; },
    get level() { return level(); },
    stats() { return { draws: mesh.visible ? 1 : 0, runs: runs.size, slow: slow > 0, level: level() }; },
    runs, ribbons,
    clear() { runs.clear(); for (const r of ribbons) { r.hist.length = 0; r.pid = 0; r.on = 0; } mesh.visible = false; slow = 0; },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); runs.clear(); },
  };
}
