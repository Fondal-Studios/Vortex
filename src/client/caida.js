// Percepción de caída y bordes (cliente). Objetivo: que se entienda SIEMPRE dónde está el borde, qué hay debajo y qué pasó al caer.
//  · Advertencia de borde: halo con rayas de peligro sobre la isla + anillos hacia el vacío, líneas de profundidad que se desvanecen y aviso «BORDE» con flecha.
//  · «Vacío debajo» / «Suelo a N m» mientras estás en el aire.
//  · Caída rápida: viñeta azul + líneas de velocidad + viento sintético + sacudida suave (se apaga con «Reducir movimiento»).
//  · Caer fuera del mapa: «¡Caíste al vacío!», destello, columna de luz y flecha hacia la isla segura al reaparecer.
//  · Aterrizaje fuerte: onda, polvo, golpe grave y sacudida.
// Sólo LEE datos del snapshot (posición, up, velocidad derivada) y el evento {t:'fall'} si llega; no toca el simulador.
// Uso (ver main.js):  const caida = createCaida({ renderer, root: $('hud'), sound });
//   en cada evento: caida.onEvent(e, me)    ·   una vez por cuadro, tras renderizar: caida.update(dt, state, me)
import * as THREE from 'three';
import { MAPS } from '../sim/maps.js';

const STYLE_ID = 'caida-style';
const CSS = `
.caida{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:3;font-family:"Trebuchet MS","Segoe UI",system-ui,sans-serif;user-select:none}
.caida .cd-vig{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,rgba(10,20,60,0) 38%,rgba(20,50,150,.55) 78%,rgba(5,10,40,.9) 100%)}
.caida .cd-lines{position:absolute;inset:0;opacity:0;background:repeating-linear-gradient(90deg,transparent 0 22px,rgba(170,210,255,.22) 22px 24px,transparent 24px 61px,rgba(170,210,255,.14) 61px 62px);background-size:100% 220px;animation:cdfall .35s linear infinite;-webkit-mask:radial-gradient(ellipse at center,transparent 28%,#000 85%);mask:radial-gradient(ellipse at center,transparent 28%,#000 85%)}
.caida.rm .cd-lines{animation:none}
@keyframes cdfall{from{background-position:0 0}to{background-position:0 220px}}
.caida .cd-edgeglow{position:absolute;inset:0;opacity:0;box-shadow:inset 0 0 90px 10px rgba(255,170,30,.55)}
.caida .cd-chip{position:absolute;left:50%;transform:translateX(-50%);display:none;align-items:center;gap:8px;padding:5px 14px;border-radius:999px;font-size:clamp(11px,1.6vw,15px);font-weight:800;letter-spacing:.12em;color:#fff;background:#10092ccc;border:2px solid #ffb02e;text-shadow:0 0 6px #000;white-space:nowrap;max-width:86vw}
.caida .cd-edge{top:calc(env(safe-area-inset-top,0px) + 18%)}
.caida .cd-edge.near{background:#4a1200dd;border-color:#ff5a3c;animation:cdpulse .5s ease-in-out infinite alternate}
.caida .cd-edge i{display:inline-block;font-style:normal;font-size:1.3em;line-height:1}
.caida .cd-void{top:calc(env(safe-area-inset-top,0px) + 26%);border-color:#ff3a5a;background:#3a0620dd}
.caida .cd-void.ground{border-color:#5cf2ff;background:#06203add}
@keyframes cdpulse{from{transform:translateX(-50%) scale(1)}to{transform:translateX(-50%) scale(1.07)}}
.caida .cd-msg{position:absolute;left:0;right:0;top:34%;text-align:center;opacity:0;padding:0 6%}
.caida .cd-msg b{display:block;font-size:clamp(24px,5.4vw,56px);letter-spacing:.14em;color:#ff5a7a;text-shadow:0 0 18px #ff1a4a,0 0 4px #000,0 2px 0 #000;font-style:italic}
.caida .cd-msg span{display:block;margin-top:6px;font-size:clamp(12px,2vw,20px);letter-spacing:.06em;color:#fff;text-shadow:0 0 8px #000,0 0 3px #000}
.caida .cd-flash{position:absolute;inset:0;opacity:0;background:radial-gradient(circle,#fff 0,#9be8ff 45%,#6a7bff 100%)}
.caida .cd-land{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,rgba(255,255,255,0) 40%,rgba(255,255,255,.55) 100%)}
.caida .cd-arrow{position:absolute;left:50%;top:50%;width:0;height:0;display:none}
.caida .cd-arrow div{position:absolute;left:-30px;top:-30px;width:60px;height:60px;display:grid;place-items:center;font-size:44px;color:#5cf2ff;text-shadow:0 0 12px #5cf2ff,0 0 4px #000;transform-origin:30px 30px}
.caida .cd-arrow small{position:absolute;left:-60px;width:120px;top:34px;text-align:center;font-size:11px;font-weight:800;letter-spacing:.12em;color:#fff;text-shadow:0 0 6px #000,0 0 3px #000}
`;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ───────── halo de borde (un solo plano con shader) ───────── */
const HALO_VS = 'varying vec2 vP; uniform float uSize; void main(){ vP = position.xy * uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const HALO_FS = `varying vec2 vP; uniform float uOp,uT,uR,uShape; uniform vec3 uCol,uHot;
float sdf(vec2 p){ if(uShape<0.5) return length(p)-uR; vec2 q=abs(p)-vec2(uR); return max(q.x,q.y); }
void main(){
  float d=sdf(vP); float a=0.0;
  if(d>0.0){ float f=clamp(1.0-d/16.0,0.0,1.0); float r=0.5+0.5*sin(d*1.3-uT*3.2); a=f*f*(0.22+0.5*r); }
  else { float f=clamp(1.0+d/3.6,0.0,1.0); float s=step(0.5,fract((vP.x+vP.y)*0.30+uT*0.35)); a=f*(0.12+0.5*s); }
  float rim=smoothstep(0.4,0.0,abs(d)); a+=rim;
  vec3 c=mix(uCol,uHot,rim);
  if(a<0.01) discard;
  gl_FragColor=vec4(c,clamp(a,0.0,1.0)*uOp);
}`;

/** Geometrías unitarias del borde (radio/semilado = 1): líneas verticales que se apagan hacia abajo y aros de profundidad. */
function rimParts(shape) {
  const N = 72, pts = [];
  for (let i = 0; i < N; i++) {
    const t = i / N;
    if (shape === 'circle') pts.push([Math.cos(t * Math.PI * 2), Math.sin(t * Math.PI * 2)]);
    else { const s = t * 4, k = Math.floor(s), f = s - k; const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; const a = c[k % 4], b = c[(k + 1) % 4]; pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
  }
  const DEPTH = 42, pos = [], col = [];
  for (const [x, z] of pts) { pos.push(x, 0, z, x, -DEPTH, z); col.push(1, 0.62, 0.15, 0, 0, 0); } // ámbar arriba → negro (invisible, aditivo) abajo
  const lines = new THREE.BufferGeometry(); lines.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lines.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const loop = new THREE.BufferGeometry(); loop.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([x, z]) => [x, 0, z]), 3));
  return { lines, loop, DEPTH };
}

export function createCaida({ renderer, root, sound = null } = {}) {
  const doc = root.ownerDocument || document;
  if (!doc.getElementById(STYLE_ID)) { const s = doc.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; doc.head.appendChild(s); }
  const host = doc.createElement('div'); host.className = 'caida'; root.appendChild(host);
  host.innerHTML = '<div class="cd-vig"></div><div class="cd-lines"></div><div class="cd-edgeglow"></div><div class="cd-land"></div><div class="cd-flash"></div>' +
    '<div class="cd-chip cd-edge"><i>⚠</i><span></span></div><div class="cd-chip cd-void"><i>▼</i><span></span></div>' +
    '<div class="cd-msg"><b></b><span></span></div><div class="cd-arrow"><div>➤</div><small>ISLA SEGURA</small></div>';
  const q = (s) => host.querySelector(s);
  const E = { vig: q('.cd-vig'), lines: q('.cd-lines'), glow: q('.cd-edgeglow'), land: q('.cd-land'), flash: q('.cd-flash'), edge: q('.cd-edge'), void: q('.cd-void'), msg: q('.cd-msg'), arrow: q('.cd-arrow'), arrowIn: q('.cd-arrow div') };
  const edgeTxt = E.edge.querySelector('span'), edgeIco = E.edge.querySelector('i'), voidTxt = E.void.querySelector('span'), msgB = E.msg.querySelector('b'), msgS = E.msg.querySelector('span');
  const anim = (node, frames, o) => { try { return node.animate(frames, o); } catch { return null; } };

  /* ── escena: halo + líneas de profundidad ── */
  const scene = renderer.scene, group = new THREE.Group(); group.visible = false; group.frustumCulled = false; scene.add(group);
  const haloMat = new THREE.ShaderMaterial({ vertexShader: HALO_VS, fragmentShader: HALO_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uOp: { value: 0 }, uT: { value: 0 }, uR: { value: 20 }, uShape: { value: 0 }, uSize: { value: 100 }, uCol: { value: new THREE.Color(1, 0.62, 0.12) }, uHot: { value: new THREE.Color(1, 0.9, 0.55) } } });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloMat); halo.rotation.x = -Math.PI / 2; halo.frustumCulled = false; group.add(halo);
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const loopMat = new THREE.LineBasicMaterial({ color: 0xffb02e, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const parts = { circle: rimParts('circle'), square: rimParts('square') };
  const rim = new THREE.Group(); group.add(rim); rim.frustumCulled = false; let rimShape = null;
  const setShape = (shape) => {
    if (rimShape === shape) return; rimShape = shape; rim.clear(); const P = parts[shape];
    const ls = new THREE.LineSegments(P.lines, lineMat); ls.frustumCulled = false; rim.add(ls);
    for (const dep of [0, 0.15, 6, 14, 26, 40]) { const l = new THREE.LineLoop(P.loop, loopMat); l.position.y = -dep; l.frustumCulled = false; rim.add(l); }
  };
  // columna de luz del punto de reaparición
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 40, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beacon.visible = false; beacon.frustumCulled = false; scene.add(beacon);

  /* ── estado ── */
  const S = { lands: 0, falls: 0, t: 0, prev: null, vel: new THREE.Vector3(), vFall: 0, peak: 0, fallT: 0, voidSeen: 0, k: 0, mapId: null, respawnT: 0, landBlock: 0, msgT: 0, hp: 100, init: false, rmT: -9, rm: false, spawnP: new THREE.Vector3(), safeP: null, lastGround: null };
  const reduced = () => {
    if (S.t - S.rmT > 2) { S.rmT = S.t; let v = false; try { v = localStorage.getItem('cristal.reduceMotion') === '1'; } catch { /* sin almacenamiento */ } try { if (!v && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) v = true; } catch { /* sin matchMedia */ } S.rm = v; host.classList.toggle('rm', v); }
    return S.rm;
  };
  const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  /** «Arriba» del jugador. Usa me.up si es un vector válido; si el snapshot no lo trae bien (hoy `up` se pisa con las mejoras de armas) lo deduce de la gravedad del mapa. */
  const upOf = (me, map, t) => {
    const u = me.up; if (Array.isArray(u) && u.length >= 3 && typeof u[0] === 'number' && typeof u[1] === 'number' && typeof u[2] === 'number' && Math.hypot(u[0], u[1], u[2]) > 0.5) return V(u).normalize();
    if (map && map.gravityAt) { try { const g = map.gravityAt({ x: me.pos[0], y: me.pos[1], z: me.pos[2] }, t || 0), l = Math.hypot(g.x, g.y, g.z); if (l > 1e-6) return new THREE.Vector3(-g.x / l, -g.y / l, -g.z / l); } catch { /* sin gravedad */ } }
    return S.lastUp ? S.lastUp.clone() : new THREE.Vector3(0, 1, 0);
  };

  /** Consulta el suelo bajo `pos` (según `up`): { has, d (m hasta el suelo), edge (m al borde; <0 = afuera), isl }. */
  function ground(map, pos, up) {
    if (!map || !map.islands) return { has: true, d: 0, edge: Infinity, isl: null }; // cascarón (m2) u otros: sin bordes
    if (Math.abs(up.y) < 0.7) return { has: true, d: 0, edge: Infinity, isl: null }; // planetoide / gravedad rara: no opinamos
    const s = up.y > 0 ? 1 : -1, square = map.id === 'm3'; let best = null;
    for (const is of map.islands) {
      const dx = pos.x - is.x, dz = pos.z - is.z, edge = square ? is.r + 2 - Math.max(Math.abs(dx), Math.abs(dz)) : is.r - Math.hypot(dx, dz);
      const surf = s > 0 ? is.top : is.y0, d = (pos.y - surf) * s - 0.9;
      if (d < -2.5) continue; // la superficie queda "arriba": no es suelo
      const score = (edge >= -0.3 ? 0 : 1000 - edge) + d * 0.01 + (edge < -0.3 ? 0 : 0);
      if (!best || score < best.score) best = { score, edge, d: Math.max(0, d), isl: is, surf, s, inside: edge >= -0.3 };
    }
    if (!best) return { has: false, d: Infinity, edge: -99, isl: null, s };
    return { has: best.inside, d: best.inside ? best.d : Infinity, edge: best.edge, isl: best.isl, surf: best.surf, s, near: best };
  }

  function show(title, sub, ms = 2600) {
    msgB.textContent = title; msgS.textContent = sub || ''; S.msgT = ms / 1000;
    anim(E.msg, [{ opacity: 0, transform: 'scale(1.25)' }, { opacity: 1, transform: 'scale(1)', offset: 0.08 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
  }
  function landed(k, pos, up) {
    const rm = reduced(); k = clamp(k, 0.2, 1); S.lands++;
    if (sound && sound.landing) sound.landing(k);
    anim(E.land, [{ opacity: rm ? 0.25 * k : 0.7 * k }, { opacity: 0 }], { duration: 380, fill: 'forwards' });
    if (!rm) { renderer.shake = Math.max(renderer.shake || 0, 0.55 * k); try { if (navigator.vibrate) navigator.vibrate(Math.round(30 + 50 * k)); } catch { /* sin vibración */ } }
    const fx = renderer.fx; if (fx && pos) {
      const feet = pos.clone().addScaledVector(up, -0.85);
      try {
        fx.ring(feet, up.clone(), 0xffe9b0, 2.5 + 7 * k, 0.55, { shock: true, op: 0.9 });
        fx.spray(feet, 0xbdb4d8, Math.round(18 + 30 * k), 7 + 8 * k, 0.9, 0.9, { flat: up.clone(), up: 1.6, drag: 2.4, grow: 0.5, smoke: true });
      } catch { /* efectos no disponibles */ }
    }
    S.landBlock = 0.5; S.peak = 0;
  }
  function fellOut(map, pos, up) {
    S.falls++; S.respawnT = 5; S.landBlock = 1; S.peak = 0; S.fallT = 0; S.k = 0;
    show('¡CAÍSTE AL VACÍO!', 'Perdés 25 de vida y volvés a tu punto de inicio');
    anim(E.flash, [{ opacity: 0.9 }, { opacity: 0 }], { duration: 700, fill: 'forwards' });
    if (sound) { if (sound.abyss) sound.abyss(); if (sound.wind) sound.wind(0); }
    if (!reduced()) { renderer.shake = Math.max(renderer.shake || 0, 0.5); try { if (navigator.vibrate) navigator.vibrate([60, 40, 90]); } catch { /* ok */ } }
    S.spawnP.copy(pos); S.safeP = map && map.islands && map.islands[0] ? new THREE.Vector3(map.islands[0].x, pos.y, map.islands[0].z) : new THREE.Vector3(0, pos.y, 0);
    try { renderer.fx && renderer.fx.blast(pos.clone(), 0x7fe9ff, 9, 0.8); } catch { /* ok */ }
  }

  function onEvent(e, me) {
    if (!e || e.t !== 'fall' || !me || e.pid !== me.id) return;
    // v = velocidad de caída (m/s); sin dato usamos una caída media
    const v = Number.isFinite(e.v) ? Math.abs(e.v) : 24, up = upOf(me, MAPS[S.mapId], 0);
    landed(smooth(12, 40, v), V(e.p || me.pos), up); S.landBlock = 0.6;
  }

  function hide() {
    group.visible = false; beacon.visible = false; E.edge.style.display = E.void.style.display = 'none'; E.arrow.style.display = 'none';
    E.vig.style.opacity = E.lines.style.opacity = E.glow.style.opacity = '0'; if (sound && sound.wind) sound.wind(0);
  }

  function update(dt, state, me) {
    S.t += dt; const rm = reduced();
    if (!me || me.dead || !state || !state.map) { S.prev = null; hide(); return; }
    const map = MAPS[state.map], pos = V(me.pos), up = upOf(me, map, state.time); S.lastUp = up.clone();
    if (S.mapId !== state.map) { S.mapId = state.map; S.prev = null; S.fallT = 0; S.peak = 0; }
    const dts = clamp(dt, 1 / 240, 0.1);
    let tele = false;
    if (S.prev) {
      const disp = pos.distanceTo(S.prev), prevGround = ground(map, S.prev, up);
      if (disp > 6 && (disp / dts > 90 || disp > 25)) { // salto de posición: portal, habilidad o reaparición
        const nearPortal = map && map.portals && map.portals.some((p) => Math.hypot(S.prev.x - p.a.x, S.prev.y - p.a.y, S.prev.z - p.a.z) < 5 || Math.hypot(S.prev.x - p.b.x, S.prev.y - p.b.y, S.prev.z - p.b.z) < 5);
        const hpDrop = S.hp - me.hp >= 15, wasFalling = S.fallT > 0.5 || (!prevGround.has && S.voidSeen > 0.3) || (map && map.outOfBounds && map.outOfBounds({ x: S.prev.x, y: S.prev.y - 3, z: S.prev.z, }));
        tele = true;
        if (!nearPortal && (wasFalling || (hpDrop && !prevGround.has))) fellOut(map, pos, up);
        S.vel.set(0, 0, 0); S.vFall = 0;
      } else { S.vel.lerp(pos.clone().sub(S.prev).divideScalar(dts), 1 - Math.exp(-18 * dts)); S.vFall = -S.vel.dot(up); }
    }
    S.prev = pos.clone(); S.hp = me.hp; S.landBlock = Math.max(0, S.landBlock - dt); S.respawnT = Math.max(0, S.respawnT - dt);
    const g = ground(map, pos, up), airborne = !g.has || g.d > 1.3;
    S.voidSeen = !g.has && airborne ? S.voidSeen + dt : 0;
    if (S.vFall > 10 && (!g.has || g.d > 4)) S.fallT += dt; else if (S.vFall < 5) S.fallT = 0; else S.fallT = Math.max(0, S.fallT - dt);
    // aterrizaje derivado de los datos (si el evento 'fall' no llegó)
    if (!tele) {
      if (S.vFall > S.peak) S.peak = S.vFall; else S.peak = Math.max(0, S.peak - dt * 8);
      if (S.landBlock <= 0 && S.peak >= 16 && S.vFall < 4 && !airborne) landed(smooth(14, 38, S.peak), pos, up);
    }
    /* viñeta, líneas y viento por velocidad de caída */
    const kT = smooth(12, 32, S.vFall) * (S.fallT > 0.25 ? 1 : 0.3); S.k += (kT - S.k) * (1 - Math.exp(-6 * dts));
    E.vig.style.opacity = String(clamp(S.k, 0, 1) * (rm ? 0.55 : 0.95)); E.lines.style.opacity = String(rm ? 0 : clamp(S.k * 1.2, 0, 1) * 0.9);
    if (sound && sound.wind) sound.wind(S.k > 0.04 ? S.k : 0);
    if (!rm && S.k > 0.3) renderer.shake = Math.max(renderer.shake || 0, 0.3 * S.k); // temblor suave constante mientras caés rápido
    /* aviso «vacío debajo» / «suelo a N m» */
    const free = Math.abs(up.y) >= 0.7 && map && map.islands;
    if (free && airborne && (!g.has || (S.vFall > 6 && g.d > 6))) {
      E.void.style.display = 'flex';
      if (!g.has) { E.void.classList.remove('ground'); voidTxt.textContent = S.vFall > 8 ? 'VACÍO DEBAJO · CAYENDO' : 'VACÍO DEBAJO'; }
      else { E.void.classList.add('ground'); voidTxt.textContent = `SUELO A ${Math.round(g.d)} m`; }
    } else E.void.style.display = 'none';
    /* aviso de borde */
    const onIsland = free && g.has && g.d < 3 && g.isl, e = onIsland ? g.edge : (free && g.near ? g.near.edge : 99);
    let glow = 0;
    if (free && g.isl && g.d < 3 && e < 6 && e > -1.2) {
      const near = e < 2.5; E.edge.style.display = 'flex'; E.edge.classList.toggle('near', near);
      edgeTxt.textContent = e < 0.4 ? 'ESTÁS EN EL BORDE' : `BORDE A ${Math.max(0.5, e).toFixed(1).replace('.', ',')} m`;
      const cam = renderer.camera, is = g.isl, square = map.id === 'm3';
      if (cam && cam.matrixWorldInverse) { // flecha hacia el punto más cercano del borde, respecto de la vista
        let rx, rz; if (square) { const dx = pos.x - is.x, dz = pos.z - is.z, ax = Math.abs(dx), az = Math.abs(dz); rx = ax > az ? is.x + Math.sign(dx) * (is.r + 2) : pos.x; rz = ax > az ? pos.z : is.z + Math.sign(dz) * (is.r + 2); }
        else { const dx = pos.x - is.x, dz = pos.z - is.z, l = Math.hypot(dx, dz) || 1; rx = is.x + dx / l * is.r; rz = is.z + dz / l * is.r; }
        const m = cam.matrixWorldInverse.elements, y = pos.y, x = m[0] * rx + m[4] * y + m[8] * rz + m[12], z = m[2] * rx + m[6] * y + m[10] * rz + m[14], ang = Math.atan2(x, -z);
        edgeIco.textContent = '▲'; edgeIco.style.transform = `rotate(${(ang * 180 / Math.PI).toFixed(0)}deg)`;
      }
      glow = clamp((6 - e) / 6, 0, 1) * (rm ? 0.5 : 1);
    } else E.edge.style.display = 'none';
    E.glow.style.opacity = String(glow * 0.9);
    /* halo + líneas de profundidad en 3D */
    let op = 0;
    const isl = (g.isl || (g.near && g.near.isl)) || null;
    if (free && isl) {
      const s = up.y > 0 ? 1 : -1, surf = s > 0 ? isl.top : isl.y0, vert = Math.abs(pos.y - surf), eAbs = g.isl ? g.edge : (g.near ? g.near.edge : 99);
      op = (1 - smooth(5, 18, Math.abs(eAbs))) * (1 - smooth(8, 22, vert));
      if (op > 0.01) {
        const square = map.id === 'm3', R = square ? isl.r + 2 : isl.r; setShape(square ? 'square' : 'circle');
        group.visible = true; group.position.set(isl.x, surf + s * 0.04, isl.z);
        rim.scale.set(R, s, R); halo.scale.setScalar((R + 20) * 2); haloMat.uniforms.uSize.value = (R + 20) * 2;
        const hot = smooth(6, 0.5, Math.abs(eAbs)), pulse = 0.78 + 0.22 * Math.sin(S.t * (3 + 7 * hot));
        haloMat.uniforms.uOp.value = op * pulse; haloMat.uniforms.uT.value = S.t; haloMat.uniforms.uR.value = R; haloMat.uniforms.uShape.value = square ? 1 : 0;
        haloMat.uniforms.uCol.value.setRGB(1, 0.62 - 0.4 * hot, 0.12 + 0.05 * hot);
        lineMat.opacity = op * (0.55 + 0.45 * hot) * pulse; loopMat.opacity = op * 0.7 * pulse; loopMat.color.setRGB(1, 0.7 - 0.45 * hot, 0.2);
      } else group.visible = false;
    } else group.visible = false;
    /* reaparición: columna de luz + flecha a la isla segura */
    if (S.respawnT > 0) {
      const f = clamp(S.respawnT / 5, 0, 1);
      beacon.visible = true; beacon.position.copy(S.spawnP).addScaledVector(up, 18); beacon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up); beacon.material.opacity = 0.35 * f * (0.7 + 0.3 * Math.sin(S.t * 6));
      const cam = renderer.camera, tgt = S.safeP;
      if (cam && cam.matrixWorldInverse && tgt && Math.hypot(pos.x - tgt.x, pos.z - tgt.z) > 3) {
        const m = cam.matrixWorldInverse.elements, x = m[0] * tgt.x + m[4] * tgt.y + m[8] * tgt.z + m[12], z = m[2] * tgt.x + m[6] * tgt.y + m[10] * tgt.z + m[14];
        const ang = Math.atan2(x, -z), R = Math.min(innerWidth, innerHeight) * 0.28;
        E.arrow.style.display = 'block'; E.arrow.style.transform = `translate(${Math.sin(ang) * R}px, ${-Math.cos(ang) * R}px)`; E.arrowIn.style.transform = `rotate(${(ang * 180 / Math.PI - 90).toFixed(0)}deg)`;
        E.arrow.style.opacity = String(clamp(f * 2, 0, 1));
      } else E.arrow.style.display = 'none';
    } else { beacon.visible = false; E.arrow.style.display = 'none'; }
  }

  return { onEvent, update, hide, state: S, ground };
}
