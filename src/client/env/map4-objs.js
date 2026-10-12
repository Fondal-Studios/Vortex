import * as THREE from 'three';
import { M4U } from './map4-state.js';
import { MAPS } from '../../sim/maps.js';

// Objetos del acertijo «Cultivo» del Mapa 4 (los crea el simulador: src/sim/cultivo.js) y sus eventos.
//  · 'capullo'  vaina carnosa. Hambriento = morado apagado y cerrado; cada impacto la alimenta: se abre, brilla y se enciende
//               un punto más del anillo de 12 (cada punto = 8 %). Florecido = flor verde ácido con un faro de luz. Si las criaturas la
//               roen tiembla y se pone roja (evento 'gnaw').
//  · 'puente'   no dibuja nada propio: escribe en los uniformes de M4U cuántos discos de su tramo ya crecieron (los dibuja env/map4.js).
// Todo con geometría compartida y materiales aditivos/baratos (3 capullos en total).

const GEO = {
  sph: new THREE.SphereGeometry(1, 20, 14),
  petal: (() => { const g = new THREE.ConeGeometry(0.42, 2.3, 5, 1, true); g.translate(0, 1.15, 0); return g; })(),
  ring: new THREE.TorusGeometry(1, 0.05, 6, 40),
  dot: new THREE.SphereGeometry(0.17, 8, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12, 1, true),
};
const add = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const HUNGRY = new THREE.Color(0x7a2a66), FED = new THREE.Color(0xff3a8a), BLOOM = new THREE.Color(0xb6ff3a), GNAW = new THREE.Color(0xff3030);
const tmp = new THREE.Color();

export const M4_BUILD = {
  capullo(o) {
    const g = new THREE.Group(), r = o.r || 2.2;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5a1a44, emissive: 0x7a2a66, emissiveIntensity: 0.8, roughness: 0.45, metalness: 0.05 });
    const body = new THREE.Mesh(GEO.sph, bodyMat); body.scale.set(r * 0.62, r * 0.85, r * 0.62); body.position.y = r * 0.85; g.add(body);
    const petalMat = new THREE.MeshStandardMaterial({ color: 0x8a2a5a, emissive: 0x7a2a66, emissiveIntensity: 0.7, roughness: 0.5, side: THREE.DoubleSide });
    const petals = [];
    for (let i = 0; i < 6; i++) { const pv = new THREE.Group(); pv.rotation.y = (i / 6) * Math.PI * 2; pv.position.y = 0.2; const p = new THREE.Mesh(GEO.petal, petalMat); p.scale.set(1, r * 0.55, 0.45); p.position.x = r * 0.42; pv.add(p); g.add(pv); petals.push(p); }
    const halo = new THREE.Mesh(GEO.sph, add(0xff3a8a, 0.1)); halo.scale.setScalar(r * 1.9); halo.position.y = r * 0.9; g.add(halo);
    const beam = new THREE.Mesh(GEO.cyl, add(0xff3a8a, 0.14)); beam.position.y = 14; beam.scale.set(0.7, 28, 0.7); g.add(beam);
    const ring = new THREE.Mesh(GEO.ring, add(0xff7ab0, 0.4)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; ring.scale.setScalar(r * 1.55); g.add(ring);
    const dotOff = add(0x4a1a3a, 0.5), dotOn = add(0xb6ff3a, 1.0), dots = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, d = new THREE.Mesh(GEO.dot, dotOff); d.position.set(Math.cos(a) * r * 1.55, 0.2, Math.sin(a) * r * 1.55); g.add(d); dots.push(d); }
    g.userData = { body, bodyMat, petals, petalMat, halo, beam, ring, dots, dotOn, dotOff, r, pop: 0, shake: 0, lit: -1, nut: 0 };
    return g;
  },
  puente() { return new THREE.Group(); },
};

/** Animación por cuadro; `t` = reloj, `o` = objeto del snapshot ({ v: nutrición 0..1, s: 'on' si florecido }). */
export function m4Animate(it, o, u, t, dt) {
  if (o.t === 'puente') { // el tramo que le toca = el más cercano a su posición
    if (it.sec === undefined) { const S = MAPS.m4.layout.sections; let b = 0, bd = 1e9; S.forEach((s, k) => { const d = Math.hypot(s.c.x - o.p[0], s.c.z - o.p[2]); if (d < bd) { bd = d; b = k; } }); it.sec = b; it.cnt = S[b].ids.length; }
    M4U.uSecN.value.setComponent(it.sec, (o.v || 0) * it.cnt); return;
  }
  const nut = o.v || 0, bloom = o.s === 'on', beat = M4U.uBeat.value;
  u.nut += (nut - u.nut) * Math.min(1, 6 * dt); u.pop = Math.max(0, u.pop - dt * 3); u.shake = Math.max(0, u.shake - dt * 1.5);
  const k = u.nut, hungerPulse = 1 + 0.06 * Math.sin(t * (bloom ? 1.5 : 3 + (1 - k) * 4) + o.id) + u.pop * 0.35;
  u.body.scale.set(u.r * 0.62 * (1 + k * 0.25) * hungerPulse, u.r * 0.85 * (1 + k * 0.2) * hungerPulse, u.r * 0.62 * (1 + k * 0.25) * hungerPulse);
  u.body.position.x = Math.sin(t * 60) * u.shake * 0.12; u.body.position.y = u.r * 0.85;
  tmp.copy(HUNGRY).lerp(FED, Math.min(1, k * 1.2)); if (bloom) tmp.copy(BLOOM); if (u.shake > 0.05) tmp.lerp(GNAW, Math.min(1, u.shake));
  u.bodyMat.emissive.copy(tmp); u.bodyMat.emissiveIntensity = 0.5 + k * 0.7 + (bloom ? 0.3 : 0) + u.pop * 1.0 + 0.2 * beat;
  u.bodyMat.color.copy(tmp).multiplyScalar(0.35);
  u.petalMat.emissive.copy(tmp); u.petalMat.emissiveIntensity = u.bodyMat.emissiveIntensity * 0.8; u.petalMat.color.copy(tmp).multiplyScalar(0.4);
  const open = bloom ? 1.25 : 0.1 + k * 0.85;
  u.petals.forEach((p, i) => { p.parent.rotation.z = -open * 0.9 + Math.sin(t * 2 + i) * 0.03; });
  u.halo.material.opacity = 0.05 + k * 0.08 + (bloom ? 0.06 : 0) + u.pop * 0.15; u.halo.material.color.copy(tmp);
  u.beam.material.opacity = bloom ? 0.34 : 0.08 + k * 0.14; u.beam.material.color.copy(tmp);
  u.ring.material.color.copy(tmp); u.ring.rotation.z = t * (bloom ? 0.8 : 0.3);
  const lit = bloom ? 12 : Math.floor(k * 12 + 1e-6);
  if (lit !== u.lit) { u.lit = lit; u.dots.forEach((d, i) => { d.material = i < lit ? u.dotOn : u.dotOff; }); }
  if (bloom) u.body.rotation.y = t * 0.5;
}

/** Eventos del acertijo → efectos y marcas en los objetos. Devuelve true si el evento era de este módulo. */
export function m4Event(e, fx, view) {
  const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  if (e.t === 'feed') {
    const it = view.items.get(e.id); if (it) { it.g.userData.pop = 1; }
    if (e.at) fx.burst(V(e.at), 0xff5aa8, 5, 6, 0.5, 0.5);
    return true;
  }
  if (e.t === 'gnaw') { const it = view.items.get(e.id); if (it) it.g.userData.shake = 1; fx.burst(V(e.p), 0xff3030, 6, 5, 0.5, 0.5); return true; }
  if (e.t === 'bloom') { fx.blast(V(e.p), 0xb6ff3a, 14, 1.1); fx.burst(V(e.p), 0xb6ff3a, 60, 12, 1.3, 1.1); fx.blast(V(e.p), 0xff3a8a, 7, 0.7); return true; }
  if (e.t === 'bridge') {
    if (e.ph === 'start') { fx.blast(V(e.p), 0x9dff3a, 18, 1.4); fx.burst(V(e.p), 0x9dff3a, 40, 9, 1.5, 1.0); }
    else if (e.ph === 'sec') fx.blast(V(e.p), 0xe8ffb0, 10, 0.8);
    else if (e.ph === 'open') { fx.blast(V(e.p), 0xb6ff3a, 40, 2.0); fx.burst(V(e.p), 0xffffff, 80, 14, 1.8, 1.4); }
    return true;
  }
  if (e.t === 'hint') { fx.blast(V(e.p), 0xffe27a, 6, 0.9); return true; }
  return false;
}

/** Una vez por cuadro: el cultivo en curso hace brillar el «fantasma» del puente. */
export function m4Frame(state) { M4U.uFeed.value = state.obj && state.obj.type === 'cultivo' ? state.obj.prog : (state.map === 'm4' && state.obj == null ? M4U.uFeed.value * 0.98 : M4U.uFeed.value); }
