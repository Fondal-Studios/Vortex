// Banco de pruebas de hostfx.js (habilidades, estados y melee de los 5 Huéspedes) con el render y la simulación reales.
// Los eventos y el campo `bf` se INYECTAN en el snapshot (la simulación de los Huéspedes la hace otro módulo): así se prueba el cableado real de render.js.
// Parámetros: ?q=low|medium|high  &third=0|1 (cámara en 3.ª persona; por defecto 1)  &host=axioma|vesper|micelio|umbra|seraf
// API para capturas (window.__demo): setup(host,{ally}) · skill(id,k) · bf(mask) · allyBf(mask) · sy(pos|null) · melee(kind,hit) · local(kind,opts) · key(down) · run(seg,dt) · cam({...}) · stats() · measure(fn)
import * as THREE from 'three';
import { Renderer } from './render.js';
import { Game } from '../sim/game.js';
import { Sound } from './audio.js';
import { uTime } from './shaders.js';
import { HOST_PAL } from './hostfx.js';

const P = new URLSearchParams(location.search);
const level = P.get('q') || 'low';
const r = new Renderer(document.getElementById('c'), { level, pixelRatio: P.has('pr') ? +P.get('pr') : 1 });
r.setMap('m1');
const sound = new Sound(); try { sound.init(); sound.resume(); } catch { /* sin audio */ } r.hostfx.setSound(sound);
let g = null, pid = 0, allyId = 0, curState = null, T = 0, curDt = 1 / 60, hero = 'axioma';
let drive = null; const inject = [], over = { bf: 0, allyBf: 0, sy: null, allySy: null, mk: new Set() };
const camSet = { on: true, dist: 11, yaw: 0.7, lift: 3.2, aimAt: 1.2, fov: 55 };
const origCam = r.updateCamera.bind(r);
r.updateCamera = (me, dt, look) => {
  origCam(me, dt, look);
  if (!camSet.on || !r.third) return;
  const up = new THREE.Vector3(0, 1, 0), h = new THREE.Vector3(...me.h), right = new THREE.Vector3().crossVectors(h, up).normalize();
  const base = camSet.anchor ? new THREE.Vector3(...camSet.anchor) : new THREE.Vector3(...me.pos), hh = camSet.anchorH ? new THREE.Vector3(...camSet.anchorH) : h;
  const rr = camSet.anchor ? new THREE.Vector3().crossVectors(hh, up).normalize() : right;
  const c = base.clone().addScaledVector(up, camSet.lift - 0.9), dir = hh.clone().multiplyScalar(-Math.cos(camSet.yaw)).addScaledVector(rr, Math.sin(camSet.yaw));
  c.addScaledVector(dir, camSet.dist); r.camera.position.copy(c); r.camera.up.copy(up);
  r.camera.lookAt(base.clone().addScaledVector(up, camSet.aimAt - 0.9).addScaledVector(hh, camSet.fwd || 0));
  if (r.camera.fov !== camSet.fov) { r.camera.fov = camSet.fov; r.camera.updateProjectionMatrix(); }
};

function setup(host, opts = {}) {
  hero = host; drive = null; r.hostfx.clear(); camSet.anchor = camSet.anchorH = null; inject.length = 0; Object.assign(over, { bf: 0, allyBf: 0, sy: null, allySy: null, mk: new Set() });
  g = new Game({ mapId: 'm1', seed: 3, calm: 1e9 }); g.phaseT = 1e9;
  const p = g.addPlayer('Yo', null, { char: host }); pid = p.id; p.god = true;
  const a = g.addPlayer('Aliada', null, { char: opts.ally || 'seraf' }); allyId = a.id; a.god = true;
  for (const q of g.players) q.hp = 100;
  p.heading = { x: 0, y: 0, z: -1 }; a.pos = { x: p.pos.x + (opts.allyX == null ? 6 : opts.allyX), y: p.pos.y, z: p.pos.z - (opts.allyZ == null ? 8 : opts.allyZ) }; a.heading = { x: 0, y: 0, z: -1 };
  if (opts.monsters !== false) for (const [d, s, k] of [[9, 0, 'geoda'], [12, 4.5, 'astilla'], [14, -4, 'geoda'], [19, 1.5, 'lente'], [7, -6, 'astilla'], [24, -3, 'geoda']]) {
    const m = g.spawnMonster(k, { x: p.pos.x + s, y: p.pos.y + (k === 'lente' ? 0 : 0.2), z: p.pos.z - d }, { noElite: true }); if (m) { m.passive = true; m.hp = m.maxhp = 1e5; m.cd = 1e9; if (k === 'geoda') m.open = true; }
  }
  r.camInit = false; r.setThird(opts.third != null ? !!opts.third : P.get('third') !== '0'); r.setMap('m1'); T = 0; r.hostfx.clear();
  frame(0.016, 3); return { pid, allyId };
}
function frame(dt = 1 / 60, n = 1) {
  for (let i = 0; i < n; i++) {
    if (drive) { const p = me(); p.pos = { x: p.pos.x + drive.x * dt, y: p.pos.y, z: p.pos.z + drive.z * dt }; drive.t -= dt; if (drive.t <= 0) drive = null; }
    curDt = dt; g.step(dt); const s = g.snapshot(); curState = s; T += dt; uTime.value = T;
    s.players.forEach((q) => { if (q.id === pid) { q.char = hero; q.bf = over.bf; q.sy = over.sy; } else { q.char = q.char === hero ? 'seraf' : q.char; q.bf = over.allyBf; q.sy = over.allySy; } });
    s.monsters.forEach((m, i) => { m.mk = over.mk.has(i); });
    while (inject.length) s.events.push(inject.shift());
    r.render(s, dt, pid, null);
  }
}
const me = () => g.players.find((q) => q.id === pid);
function skill(id, k = 'mov', fromAlly = false) {
  const p = fromAlly ? g.players.find((q) => q.id === allyId) : me(); if (camSet.fixed) { camSet.anchor = [p.pos.x, p.pos.y, p.pos.z]; camSet.anchorH = [p.heading.x, p.heading.y, p.heading.z]; }
  inject.push({ t: 'skill', pid: p.id, k, id, p: [p.pos.x, p.pos.y, p.pos.z] });
}
function melee(kind = 'light', hit = 1, fromAlly = false) {
  const p = fromAlly ? g.players.find((q) => q.id === allyId) : me(); inject.push({ t: 'melee', pid: p.id, kind, p: [p.pos.x, p.pos.y, p.pos.z], d: [p.heading.x, p.heading.y, p.heading.z], hit });
}
function push(speed, dur) { const p = me(); drive = { x: p.heading.x * speed, z: p.heading.z * speed, t: dur }; } // empuja al jugador (habilidades de movimiento)
function run(sec, dt = 1 / 30) { frame(dt, Math.round(sec / dt)); }
function stats() { return { ...r.hostfx.stats(), calls: r.gl.info.render.calls, tris: r.gl.info.render.triangles, part: (r.fx.add.live || 0) + (r.fx.smoke.live || 0), segs: r.fx.strips.n, melee: r.hostfx.melee.stats() }; }
/** Cuenta draw calls extra: base (sin efecto) frente al pico durante `sec` segundos de efecto. */
function measure(sec = 1.2, dt = 1 / 20) {
  r.hostfx.clear(); frame(dt, 3); const base = r.gl.info.render.calls, tr0 = r.gl.info.render.triangles; return { base, tr0 };
}
function peak(sec = 1.2, dt = 1 / 20) { let pk = 0, tri = 0, part = 0, segs = 0; const n = Math.round(sec / dt); for (let i = 0; i < n; i++) { frame(dt, 1); pk = Math.max(pk, r.gl.info.render.calls); tri = Math.max(tri, r.gl.info.render.triangles); part = Math.max(part, (r.fx.add.live || 0) + (r.fx.smoke.live || 0)); segs = Math.max(segs, r.fx.strips.n); } return { pk, tri, part, segs }; }
window.__demo = { setup, push, skill, melee, run, frame, cam: (o) => Object.assign(camSet, o), get g() { return g; }, get state() { return curState; }, r, sound, pal: HOST_PAL, measure, peak, stats,
  bf: (m) => { over.bf = m; }, allyBf: (m) => { over.allyBf = m; }, sy: (p) => { over.sy = p; }, allySy: (p) => { over.allySy = p; }, mark: (idx) => { over.mk = new Set(idx); },
  local: (kind, o) => r.hostfx.melee.play(kind, o), key: (down) => r.hostfx.meleeKey(down), setThird: (v) => r.setThird(!!v) };
window.__ready = true;
document.getElementById('i').textContent = 'hostfx demo · ' + level;
