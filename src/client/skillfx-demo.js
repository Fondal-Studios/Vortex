// Página de prueba de las habilidades de héroes (skillfx.js) con el juego real: Renderer + Game (simulación), sin menú.
// Parámetros: ?q=low|medium|high  &hero=egida|lumen|forja|vigia|nova|umbra  &third=1 (cámara en 3ª persona; por defecto 1)
// API para capturas (window.__demo): setup(heroId) · cast('mov'|'esp'|'team') · run(segundos) · cam({...}) · stats()
import * as THREE from 'three';
import { Renderer } from './render.js';
import { Game } from '../sim/game.js';
import { createSkillFx } from './skillfx.js';
import { uTime } from './shaders.js';

const P = new URLSearchParams(location.search);
const level = P.get('q') || 'low';
const r = new Renderer(document.getElementById('c'), { level, pixelRatio: P.has('pr') ? +P.get('pr') : 1 });
r.setMap('m1');
const sfx = createSkillFx(r);
let g = null, pid = 0, allyId = 0, curState = null, T = 0, off = false;
const camSet = { on: true, dist: 11, yaw: 0.7, lift: 3.2, aimAt: 1.2, fov: 55 }; // yaw: ángulo alrededor del héroe (0 = detrás)

// integración idéntica a la que se pega en render.js: los eventos que skillfx resuelve no pasan al dibujo viejo
const origHandle = r.handleEvents.bind(r), cf = r.fx.combat.frame.bind(r.fx.combat);
let allEvents = [];
r.fx.combat.frame = (rr, st, me) => cf(rr, { ...st, events: allEvents }, me);
r.handleEvents = (state, me) => {
  allEvents = state.events; const keep = [];
  for (const e of state.events) { if (off || !sfx.onEvent(e, me, state)) keep.push(e); }
  state.events = keep; try { origHandle(state, me); } finally { state.events = allEvents; }
  if (!off) sfx.update(1 / 60 * 0 + curDt, state);
};
let curDt = 1 / 60;
const origCam = r.updateCamera.bind(r);
r.updateCamera = (me, dt, look) => {
  origCam(me, dt, look);
  if (!camSet.on || !r.third) return;
  const up = new THREE.Vector3(...me.up).lengthSq() > 0.5 ? new THREE.Vector3(...me.up) : new THREE.Vector3(0, 1, 0), h = new THREE.Vector3(...me.h), right = new THREE.Vector3().crossVectors(h, up).normalize();
  const base = camSet.anchor ? new THREE.Vector3(...camSet.anchor) : new THREE.Vector3(...me.pos), hh = camSet.anchorH ? new THREE.Vector3(...camSet.anchorH) : h;
  const rr = camSet.anchor ? new THREE.Vector3().crossVectors(hh, up).normalize() : right;
  const c = base.clone().addScaledVector(up, camSet.lift - 0.9);
  const dir = hh.clone().multiplyScalar(-Math.cos(camSet.yaw)).addScaledVector(rr, Math.sin(camSet.yaw));
  c.addScaledVector(dir, camSet.dist); r.camera.position.copy(c); r.camera.up.copy(up);
  r.camera.lookAt(base.clone().addScaledVector(up, camSet.aimAt - 0.9).addScaledVector(hh, camSet.fwd || 0));
  if (r.camera.fov !== camSet.fov) { r.camera.fov = camSet.fov; r.camera.updateProjectionMatrix(); }
};

function setup(hero, opts = {}) {
  sfx.clear(); camSet.anchor = null; camSet.anchorH = null; camSet.fixed = false;
  g = new Game({ mapId: 'm1', seed: 3, calm: 1e9 }); g.phaseT = 1e9;
  const p = g.addPlayer('Yo', null, { char: hero }); pid = p.id; p.god = true;
  const a = g.addPlayer('Aliada', null, { char: 'forja' }); allyId = a.id;
  for (const q of g.players) { q.hp = opts.hurt ? 40 : 100; }
  g.setLoadout(pid, hero, null);
  p.heading = new THREE.Vector3(0, 0, -1); p.heading = { x: 0, y: 0, z: -1 };
  a.pos = { x: p.pos.x + 7, y: p.pos.y, z: p.pos.z - 9 }; a.hp = 35; a.heading = { x: 0, y: 0, z: -1 };
  if (opts.monsters !== false) for (const [d, s, k] of [[13, 0, 'geoda'], [17, 5, 'astilla'], [17, -5, 'geoda'], [22, 2, 'lente'], [10, -7, 'astilla'], [26, -3, 'geoda']]) {
    const m = g.spawnMonster(k, { x: p.pos.x + s, y: p.pos.y + (k === 'lente' ? 0 : 0.2), z: p.pos.z - d }, { noElite: true }); if (m) { m.passive = true; m.hp = m.maxhp = 1e5; m.cd = 1e9; if (k === 'geoda') m.open = true; }
  }
  r.camInit = false; r.setThird(P.get('third') !== '0'); r.setMap('m1'); T = 0;
  frame(0.016, 2); // asentar
  return { pid, allyId };
}
function frame(dt = 1 / 60, n = 1) {
  for (let i = 0; i < n; i++) {
    curDt = dt; g.step(dt); const s = g.snapshot(); curState = s;
    if (P.get('brokenup') !== '1') s.players.forEach((q, i) => { const p = g.players[i]; q.upg = q.up; q.up = [p.up.x, p.up.y, p.up.z]; }); // arreglo local del choque de la clave `up` del snapshot (ver docs/gate/heroes.md) T += dt; uTime.value = T;
    r.render(s, dt, pid, null);
  }
}
function cast(kind) {
  const p = g.players.find((q) => q.id === pid); const inp = {};
  if (kind === 'mov') inp.mov = true; else if (kind === 'esp') inp.esp = true; else if (kind === 'team') inp.ability = true;
  if (camSet.fixed) { const q = g.players.find((x) => x.id === pid); camSet.anchor = [q.pos.x, q.pos.y, q.pos.z]; camSet.anchorH = [q.heading.x, q.heading.y, q.heading.z]; }
  g.setInput(pid, { ...inp, mz: kind === 'mov' ? 1 : 0 }); frame(1 / 60, 1); g.setInput(pid, { mz: 0 });
}
function run(sec, dt = 1 / 30) { const n = Math.round(sec / dt); frame(dt, n); }
window.__demo = { setup, cast, run, frame, cam: (o) => Object.assign(camSet, o), get g() { return g; }, get state() { return curState; }, sfx, r, setOff: (v) => { off = !!v; sfx.clear(); },
  stats: () => ({ ...sfx.stats(), calls: r.gl.info.render.calls, tris: r.gl.info.render.triangles, fx: { add: r.fx.add.live, smoke: r.fx.smoke.live, segs: r.fx.strips.n } }) };
window.__ready = true;
document.getElementById('i').textContent = 'skillfx demo · ' + level;
