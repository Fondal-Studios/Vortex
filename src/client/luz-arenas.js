// LUZ DE LAS ARENAS: cada mapa (m1…m6) tiene su propia DIRECCIÓN y COLOR de luz, un contraluz de otro color y luces puntuales de ambiente ligadas a sus
// órganos vivos (las del organismo de src/sim/arenas-vivas.js), todo con un CICLO suave día → ocaso → eclipse del limbo.  Docs: docs/MAPAS.md → «Luz de las arenas».
// Reglas de diseño (la psicodelia flashera sigue a TOPE, pero el Huésped se lee SIEMPRE):
//   · El «día» es EXACTAMENTE la luz con que cada mapa ya fue medido en tools/legibilidad.mjs (no baja ningún contraste). El ocaso y el eclipse sólo
//     cambian TONO y DIRECCIÓN (≤ 25° de giro del sol para que el disco del cielo siga coherente) y suben el contraluz y la luz de los órganos.
//   · Cuando la luz del sol baja, sube el relleno que sigue al Huésped (quality.js · CLARIDAD, keyLight): lo que se oscurece lo compensa la luz propia.
//   · Dos luces puntuales como máximo (una en Baja): el corazón del organismo (color de amenaza) y su órgano de ayuda (color de ayuda). Latido con la fase.
//   · Nunca modifica lo que el mapa fijó: guarda la luz «base» que dejó el constructor del mapa y mezcla sobre ella (el constructor es asíncrono en m3-m6).
// Ciclo: sigue la infección del mundo (oleada 1 → día, oleada media → ocaso, jefe → eclipse) más un pulso lento de 90 s, y el evento «Eclipse» lo fuerza.
// Para capturas y pruebas: ?ciclo=dia|ocaso|eclipse lo congela.
import * as THREE from 'three';
import { MAPS } from '../sim/maps.js';
import { layoutArena, centroOrgano } from '../sim/arenas-vivas.js';
import { ARENAS_VIVAS } from '../sim/data.js';
import { GRADE } from './post.js';

/** Lo que cambia en cada fase (sólo ocaso y eclipse: el día es la luz medida de cada mapa).
 *  sol: color del sol · solI: × intensidad del sol · az/el: giro de la dirección del sol en grados (az alrededor de la vertical, el hacia el horizonte si es negativo) ·
 *  rel: color del cielo del relleno (hemisférica) · relI: × intensidad · rim: color del contraluz · rimI: × intensidad · niebla: color de la niebla de aire · sat: × saturación del grading
 *  Los colores salen de la paleta de identidad de cada arena (docs/MAPAS.md): ayuda · amenaza. */
export const LUZ = {
  m1: { nombre: 'Vacío de Islas', idea: 'Sol frío y alto desde atrás a la izquierda; contraluz magenta rasante; al ocaso el sol se hunde rosado tras las islas y la medusa se ilumina de cian.',
    ocaso:   { sol: '#ff9ad8', solI: 0.92, az: 18, el: -14, rel: '#d08cff', relI: 1.0, rim: '#19f0ff', rimI: 1.25, niebla: '#5a2a7a', sat: 1.06 },
    eclipse: { sol: '#9a6cff', solI: 0.74, az: 30, el: -22, rel: '#7a4cff', relI: 0.95, rim: '#ff3df2', rimI: 1.7, niebla: '#2a1260', sat: 1.12 } },
  m2: { nombre: 'Cámara Fractal', idea: 'La luz sale del centro de la esfera (sol interior ámbar-rosa); al ocaso se enfría a violeta y en el eclipse sólo brillan los bordes del espejo.',
    ocaso:   { sol: '#c89cff', solI: 0.9, az: 14, el: -12, rel: '#c890ff', relI: 1.0, rim: '#ffb52e', rimI: 1.3, niebla: '#3a1450', sat: 1.05 },
    eclipse: { sol: '#8a5cff', solI: 0.72, az: 24, el: -20, rel: '#6a40d8', relI: 0.95, rim: '#ffb52e', rimI: 1.8, niebla: '#1e0a44', sat: 1.12 } },
  m3: { nombre: 'Laberinto Celestial', idea: 'Luz cenital blanco-menta con rayos oblicuos entre los muros; al ocaso dorada, en el eclipse blanco hielo con contraluz menta.',
    ocaso:   { sol: '#ffc888', solI: 0.9, az: 20, el: -14, rel: '#c8a0ff', relI: 1.0, rim: '#3dffb8', rimI: 1.25, niebla: '#3a2060', sat: 1.05 },
    eclipse: { sol: '#bfe8ff', solI: 0.72, az: 32, el: -22, rel: '#8a9cff', relI: 0.95, rim: '#3dffb8', rimI: 1.7, niebla: '#1a1a58', sat: 1.1 } },
  m4: { nombre: 'Jardín de Carne', idea: 'Luz tibia rosada de costado con contraluz verde ácido; al ocaso rojo carne, y en el eclipse casi negro rojizo con el corazón latiendo.',
    ocaso:   { sol: '#ff7a8c', solI: 0.9, az: 16, el: -14, rel: '#ff7aa0', relI: 1.0, rim: '#b6ff2a', rimI: 1.3, niebla: '#4a1030', sat: 1.06 },
    eclipse: { sol: '#c0344a', solI: 0.72, az: 26, el: -20, rel: '#a02050', relI: 0.95, rim: '#b6ff2a', rimI: 1.8, niebla: '#2a0618', sat: 1.12 } },
  m5: { nombre: 'Plaza de los Ecos', idea: 'Sol bajo azulado detrás de la torre del reloj; al ocaso oro de farol, en el eclipse azul cobalto frío con contraluz dorado.',
    ocaso:   { sol: '#ffcf7a', solI: 0.92, az: 18, el: -10, rel: '#c8a0ff', relI: 1.0, rim: '#ffcf4a', rimI: 1.25, niebla: '#4a2a58', sat: 1.04 },
    eclipse: { sol: '#6a8cff', solI: 0.76, az: 28, el: -16, rel: '#5a6cff', relI: 0.95, rim: '#ffcf4a', rimI: 1.7, niebla: '#1a1c5a', sat: 1.1 } },
  m6: { nombre: 'Osario sin Techo', idea: 'Luz marfil que entra por la nave desde el fondo; al ocaso brasa naranja, en el eclipse rojo ceniza con contraluz de brasa.',
    ocaso:   { sol: '#ff9a50', solI: 0.9, az: 16, el: -12, rel: '#d890a0', relI: 1.0, rim: '#ff6a14', rimI: 1.3, niebla: '#4a2418', sat: 1.05 },
    eclipse: { sol: '#d04a30', solI: 0.72, az: 26, el: -18, rel: '#a04858', relI: 0.95, rim: '#ff6a14', rimI: 1.8, niebla: '#2a0e0e', sat: 1.1 } },
};
/** Luces puntuales de ambiente ligadas a los órganos. dist/decay como las demás luces del juego; i: intensidad base (se multiplica por el latido de la fase). */
export const LUZ_ORGANO = { dist: 28, decay: 1.6, i: 44, iBaja: 32, alto: 1.6, fase: { dormido: 0.2, despierto: 0.6, furioso: 1.1, ofrenda: 0.3 }, latido: { dormido: 0.5, despierto: 1.0, furioso: 1.9, ofrenda: 0.75 } };
export const FASES_CICLO = ['dia', 'ocaso', 'eclipse'];

/* ───────── funciones puras (probadas en tests/luz-arenas.test.js) ───────── */
const sm = (x) => { const k = x < 0 ? 0 : x > 1 ? 1 : x; return k * k * (3 - 2 * k); };
const hexRgb = (s) => { const n = typeof s === 'number' ? s : parseInt(String(s).replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mezclaRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Valor del ciclo 0 (día) … 0.5 (ocaso) … 1 (eclipse). `infect` 0..1 (avance del mundo), `t` segundos, `eclipse` 0..1 (evento), `forzado` 'dia'|'ocaso'|'eclipse'|null. */
export function cicloDe({ infect = 0, t = 0, eclipse = 0, forzado = null } = {}) {
  if (forzado === 'dia') return 0; if (forzado === 'ocaso') return 0.5; if (forzado === 'eclipse') return 1;
  const base = Math.max(0, Math.min(1, infect)) * 0.78, pulso = 0.06 * (0.5 - 0.5 * Math.cos(t * (Math.PI * 2 / 90)));   // el pulso nunca baja de 0: en la oleada 1 sigue siendo día
  return Math.max(0, Math.min(1, Math.max(base + pulso * Math.min(1, base * 6), eclipse)));
}
/** Pesos de mezcla (día → ocaso → eclipse) para un valor del ciclo: { oca, ecl } con 0 ≤ ecl ≤ oca ≤ 1 salvo en el eclipse puro. */
export function pesos(c) { return { oca: sm(Math.min(1, c / 0.5)) * (1 - sm(Math.max(0, (c - 0.5) / 0.5))), ecl: sm(Math.max(0, (c - 0.5) / 0.5)) }; }
/** Luz resultante sobre la «base» del mapa: { sol:[r,g,b], solI, rim, rimI, rel, relI, niebla:[…]|null, sat, az, el, key }. `base` = { sol, rim, rel (colores [r,g,b]) }. */
export function mezclaLuz(mapId, base, c) {
  const D = LUZ[mapId];
  if (!D) return { sol: base.sol, solI: 1, rim: base.rim, rimI: 1, rel: base.rel, relI: 1, niebla: null, sat: 1, az: 0, el: 0, key: 1 };
  const o = D.ocaso, e = D.eclipse, t1 = sm(Math.min(1, c / 0.5)), t2 = sm(Math.max(0, (c - 0.5) / 0.5)), pos = c <= 0.5;
  // día (A0) → ocaso (A1) → eclipse (A2): dos tramos suaves; el color llega al 70 % del ocaso y al 80 % del eclipse (el tono propio del mapa nunca se pierde del todo)
  const num = (v0, v1, v2) => (pos ? v0 + (v1 - v0) * t1 : v1 + (v2 - v1) * t2);
  const col = (b, co, ce) => { const A1 = mezclaRgb(b, hexRgb(co), 0.7), A2 = mezclaRgb(b, hexRgb(ce), 0.8); return pos ? mezclaRgb(b, A1, t1) : mezclaRgb(A1, A2, t2); };
  const fog0 = hexRgb(GRADE[mapId] ? GRADE[mapId].fog : GRADE.def.fog);
  const out = {
    sol: col(base.sol, o.sol, e.sol), rim: col(base.rim, o.rim, e.rim), rel: col(base.rel, o.rel, e.rel),
    solI: num(1, o.solI, e.solI), rimI: num(1, o.rimI, e.rimI), relI: num(1, o.relI, e.relI), sat: num(1, o.sat, e.sat),
    az: num(0, o.az, e.az) || 0, el: num(0, o.el, e.el) || 0,
    niebla: c > 0.001 ? (pos ? mezclaRgb(fog0, mezclaRgb(fog0, hexRgb(o.niebla), 0.85), t1) : mezclaRgb(mezclaRgb(fog0, hexRgb(o.niebla), 0.85), mezclaRgb(fog0, hexRgb(e.niebla), 0.85), t2)) : null,
  };
  out.key = 1 + 0.6 * (1 - out.solI) / (1 - 0.72);   // relleno del Huésped: sube hasta ×1,6 cuando el sol baja a ×0,72 (lo que se oscurece lo compensa su propia luz)
  return out;
}
/** Luz de un órgano: color, intensidad y latido para una fase del organismo. Pura: sirve para pruebas y para el cliente. */
export function luzOrgano(mapId, cual, fase, roto = false, t = 0, baja = false) {
  const def = ARENAS_VIVAS[mapId]; if (!def) return null;
  const cor = cual === 'corazon', color = cor ? (fase === 'furioso' ? def.color2 : def.color) : def.color;
  const lat = LUZ_ORGANO.latido[fase] || 1, pulso = 0.78 + 0.22 * Math.sin(t * lat * Math.PI * 2);
  return { color, i: (baja ? LUZ_ORGANO.iBaja : LUZ_ORGANO.i) * (LUZ_ORGANO.fase[fase] ?? 0.7) * pulso * (roto ? 0.15 : 1) * (cor ? 1 : 0.8) };
}

/* ───────── cliente ───────── */
const URL_CICLO = typeof location !== 'undefined' ? (/[?&]ciclo=(dia|ocaso|eclipse)/.exec(location.search) || [])[1] || null : null;
const APAGADA = typeof location !== 'undefined' && /[?&]luz=0/.test(location.search);   // ?luz=0: sin luz de arenas (diagnóstico A/B)
const same = (a, b) => a && b && a.r === b.r && a.g === b.g && a.b === b.b;

export class LuzArenas {
  constructor(renderer) {
    this.r = renderer; this.t = 0; this.c = 0; this.mapId = null; this.q = { lights: 3 }; this.estado = null;
    const mk = (n) => { const l = new THREE.PointLight(0xffffff, 0, LUZ_ORGANO.dist, LUZ_ORGANO.decay); l.name = n; renderer.scene.add(l); return l; };   // siempre en la escena (intensidad 0 si no hace falta): así no se recompilan los materiales al aparecer
    this.luces = [mk('luz-organo-corazon'), mk('luz-organo-ayuda')];
    this.base = { sol: null, rim: null, rel: null, solI: 0, rimI: 0, relI: 0, dir: new THREE.Vector3(0, 1, 0) };
    this.out = { solHex: -1, rimHex: -1, relHex: -1 };   // lo último que escribimos: si el mapa (o su constructor asíncrono) cambia algo, lo detectamos y tomamos eso como nueva base
    this.tmpC = new THREE.Color(); this.tmpD = new THREE.Vector3(); this.dirOut = null; this.tmpV = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0); this.ax = new THREE.Vector3();
    this.org = null; this.eclipse = 0;
  }
  configure(q) { this.q = q || this.q; this.luces[0].visible = true; this.luces[1].visible = (this.q.lights || 0) >= 3; }   // Baja: una sola luz de órgano · Media/Alta: dos
  setMap(mapId) { this.mapId = mapId; this.base.sol = null; this.org = null; this.dirOut = null; for (const l of this.luces) l.intensity = 0; this.out = { solHex: -1, rimHex: -1, relHex: -1 }; }
  /** Toma la base de la luz del mapa; si el mapa la cambió desde la última vez que escribimos (constructor asíncrono, animación propia como m2), la base es lo nuevo. */
  tomarBase() {
    const R = this.r, b = this.base, ch = (a, h) => a && a.getHex() !== h;
    const nuevo = !b.sol || ch(R.sun.color, this.out.solHex) || ch(R.rim.color, this.out.rimHex) || ch(R.hemi.color, this.out.relHex) || Math.abs(R.sun.intensity - (b.solOut ?? -1)) > 1e-4 || Math.abs(R.rim.intensity - (b.rimOut ?? -1)) > 1e-4 || Math.abs(R.hemi.intensity - (b.relOut ?? -1)) > 1e-4;
    const d = R.sunDir || R.sun.position; this.tmpD.copy(d).normalize();
    if (!this.dirOut || this.tmpD.distanceToSquared(this.dirOut) > 1e-6) b.dir.copy(this.tmpD);   // el mapa cambió la dirección del sol (o es la primera vez)
    if (!nuevo) return;
    b.sol = R.sun.color.toArray(); b.rim = R.rim.color.toArray(); b.rel = R.hemi.color.toArray(); b.solI = R.sun.intensity; b.rimI = R.rim.intensity; b.relI = R.hemi.intensity;
  }
  update(dt, state) {
    const R = this.r; this.t += dt; if (APAGADA) { for (const l of this.luces) l.intensity = 0; return; }
    if (!this.mapId || this.mapId !== R.mapId) this.setMap(R.mapId);
    if (!this.mapId || !LUZ[this.mapId]) return;
    this.tomarBase(); const b = this.base; if (!b.sol) return;
    // ciclo: sigue al mundo (infección) + pulso lento; el evento «Eclipse» lo lleva al final
    const ev = state && state.ev, ecl = ev && ev.id === 'eclipse' ? (ev.ph === 'activo' ? 1 : 0.5) : 0;
    this.eclipse += (ecl - this.eclipse) * Math.min(1, dt * 0.6);
    this.c = cicloDe({ infect: R.infect || 0, t: this.t, eclipse: this.eclipse, forzado: URL_CICLO });
    const L = mezclaLuz(this.mapId, { sol: b.sol, rim: b.rim, rel: b.rel }, this.c);
    R.sun.color.setRGB(L.sol[0], L.sol[1], L.sol[2]); R.rim.color.setRGB(L.rim[0], L.rim[1], L.rim[2]); R.hemi.color.setRGB(L.rel[0], L.rel[1], L.rel[2]);
    R.sun.intensity = b.solI * L.solI; R.rim.intensity = b.rimI * L.rimI; R.hemi.intensity = b.relI * L.relI;
    this.out.solHex = R.sun.color.getHex(); this.out.rimHex = R.rim.color.getHex(); this.out.relHex = R.hemi.color.getHex(); b.solOut = R.sun.intensity; b.rimOut = R.rim.intensity; b.relOut = R.hemi.intensity;
    // dirección del sol: gira alrededor de la vertical (az) y baja hacia el horizonte (el); el disco del cielo queda cerca (≤ 25°)
    if ((L.az || L.el || this.dirOut) && R.mapId !== 'm2') {
      this.tmpV.copy(b.dir); this.tmpV.applyAxisAngle(this.up, L.az * Math.PI / 180);
      this.ax.crossVectors(this.up, this.tmpV); if (this.ax.lengthSq() > 1e-6) { this.ax.normalize(); this.tmpV.applyAxisAngle(this.ax, L.el * Math.PI / 180); }
      this.tmpV.normalize();
      if (!R.sunDir) R.sunDir = new THREE.Vector3(); R.sunDir.copy(this.tmpV); this.dirOut = this.dirOut || new THREE.Vector3(); this.dirOut.copy(this.tmpV);
      if (!R.sun.castShadow) R.sun.position.copy(this.tmpV).multiplyScalar(R.sun.position.length() || 100);
    }
    // el grading de pantalla: niebla de aire y saturación del ocaso/eclipse (el día queda como está)
    if (R.grade) {
      const u = R.grade.uniforms, G0 = { ...GRADE.def, ...(GRADE[this.mapId] || {}) };
      if (L.niebla) this.tmpC.setRGB(L.niebla[0], L.niebla[1], L.niebla[2]); else this.tmpC.setHex(G0.fog);
      u.uFogCol.value.copy(this.tmpC.convertSRGBToLinear()); u.uSat.value = G0.sat * L.sat;
    }
    // relleno que sigue al Huésped: sube cuando el sol baja
    R.luzKey = L.key;
    this.organos(state);
  }
  organos(state) {
    const R = this.r, A = state && state.ar, id = this.mapId;
    if (!A || !ARENAS_VIVAS[id]) { for (const l of this.luces) l.intensity = 0; return; }
    if (!this.org) {
      const Ly = layoutArena(MAPS[id]); if (!Ly) return;
      const cor = Ly.org.findIndex((o) => o.k === 'corazon'), ay = Ly.org.findIndex((o) => o.k !== 'corazon' && o.k !== 'raiz');
      this.org = { L: Ly, cor, ay: ay >= 0 ? ay : Ly.org.findIndex((o) => o.k !== 'corazon') };
    }
    const baja = !(this.q.lights >= 3), me = state.players && state.players[0];
    const apunta = (luz, idx, cual) => {
      if (idx < 0) { luz.intensity = 0; return; }
      const o = this.org.L.org[idx], S = A.o[idx] || [100, 0], roto = !!S[1], d = luzOrgano(id, cual, A.ph, roto, this.t, baja);
      let c = centroOrgano(o);
      if (o.k === 'vena' && me) { const p = { x: me.pos[0], z: me.pos[2] }, ab = { x: o.B.x - o.A.x, z: o.B.z - o.A.z }, l2 = ab.x * ab.x + ab.z * ab.z || 1, k = Math.max(0, Math.min(1, ((p.x - o.A.x) * ab.x + (p.z - o.A.z) * ab.z) / l2)); c = { x: o.A.x + ab.x * k, y: o.pos.y + 1.4, z: o.A.z + ab.z * k }; }
      luz.position.set(c.x, c.y, c.z); this.tmpC.set(d.color); luz.color.copy(this.tmpC); luz.intensity = d.i;
    };
    apunta(this.luces[0], this.org.cor, 'corazon');
    if (baja) this.luces[1].intensity = 0; else apunta(this.luces[1], this.org.ay, 'ayuda');
  }
}
