// NIEBLAS TÓXICAS DE COLORES (docs/MUNDO_VIVO.md → «Nieblas con función»): zonas de niebla con efecto de juego, por color.
// Determinista y sin DOM: usa su PROPIO generador derivado de la semilla (g.ngRng, como g.evRng en eventos.js y g.arRng en arenas-vivas.js)
// y NUNCA toca g.rng. Tres orígenes de niebla, un solo sistema:
//   · ARENA   → 2 nieblas temáticas fijas por mapa (NIEBLAS_ARENA). «Respiran»: aviso (se ve venir) → activa → dormida, en ciclos de ~35-45 s.
//   · ÓRGANO  → los pulmones de las arenas vivas (Fuelle, Pulmón de Esporas, Respiradero) sueltan una nube que se aleja al exhalar.
//   · EVENTO  → los eventos de oleada «Niebla de Almas» (blanca) y «Marea de Sangre» (ámbar) la usan (src/sim/eventos.js llama a nieblaEvento).
// REGLAS DE JUSTICIA: una niebla dañina nunca actúa sin AVISO previo (≥ NIEBLA.avisoMin s, la niebla se ve venir y el HUD avisa);
// el veneno no mata (deja ≥ 8 de vida); en el respiro entre oleadas y en el campo de pruebas las nieblas dañinas duermen.
// «Reducir efectos» (input.soft, el mismo interruptor de la gravedad) apaga la deriva de la niebla magenta.
import { v3, madd, mul, sub, dot, len, dist, norm, project, rotAround, makeRng } from './math.js';
import { PLAYER } from './data.js';

const r2 = (n) => Math.round(n * 100) / 100;
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];
/** Interruptor para pruebas A/B (apagar todo el sistema sin tocar nada más). */
export const CTL = { off: false, sinOrganos: false, sinEventos: false };

/* ───────── datos ───────── */
/** Reglas generales. Tiempos en segundos. */
export const NIEBLA = {
  avisoMin: 2,         // toda niebla dañina se ve (y avisa) al menos 2 s antes de actuar
  maxZonas: 9,         // tope de zonas vivas a la vez (el cliente dibuja lo mismo: un solo InstancedMesh)
  alto: 1.6,           // metros sobre el piso a los que está el centro de la esfera de niebla
  fadeRate: 0.9,       // cuánto sube/baja la densidad visual por segundo
  histeresis: 0.8,     // s sin pisar la niebla para que cuente como «salir» (evita avisos repetidos en el borde)
  venenoMin: 8,        // el veneno nunca baja la vida de un jugador de este valor
};
/** Los 6 tipos. `i` es el índice que viaja en el snapshot. `nocivo`: dormida en el respiro y con aviso previo.
 *  Los números son por segundo; los multiplicadores valen 1 = sin cambio. */
export const NIEBLAS = {
  acida:   { i: 0, nombre: 'Niebla ácida', corto: 'Veneno', color: '#8dff2a', icono: '☣', nocivo: true, minOla: 2, aviso: 2.4,
    desc: 'Veneno: te quema un poco (nunca te mata) y frena a todos, también a las criaturas, que además se queman más que vos.',
    par: { dps: 2.6, dpsOla: 0.08, vel: 0.78, mDps: 4.5 } },
  cian:    { i: 1, nombre: 'Niebla restauradora', corto: 'Cura', color: '#19f0ff', icono: '✚', nocivo: false, minOla: 1, aviso: 0.8,
    desc: 'Cura y da escudo si te quedás adentro, pero ATRAE a las criaturas hacia su centro: es un descanso con precio.',
    par: { hp: 4.5, sh: 9, tira: 3.2, alcance: 2.2 } },   // tira: m/s que arrastra a las criaturas hacia el centro
  magenta: { i: 2, nombre: 'Niebla alucinógena', corto: 'Ecos falsos', color: '#ff3df2', icono: '✺', nocivo: true, minOla: 2, aviso: 2.4,
    desc: 'Muestra ecos falsos de criaturas en pantalla y tuerce un poco tu rumbo al caminar (se apaga con «Reducir efectos»). A cambio, tus golpes pegan +15 %.',
    par: { deriva: 0.2, danio: 1.15 } },
  ambar:   { i: 3, nombre: 'Niebla de frenesí', corto: 'Frenesí', color: '#ff9a1f', icono: '♨', nocivo: true, minOla: 2, aviso: 2.4,
    desc: 'Sangre en el aire: TODO el que esté adentro hace y recibe +30 % de daño (vos, las criaturas y los demás jugadores).',
    par: { mul: 1.3 } },
  blanca:  { i: 4, nombre: 'Niebla de ocultamiento', corto: 'Oculto', color: '#eef4ff', icono: '☁', nocivo: false, minOla: 1, aviso: 1.2,
    desc: 'Las criaturas a más de 9 m dejan de verte (los jefes no se engañan, y quien recibe un disparo tuyo te ve 3 s). Escondete para respirar.',
    par: { ver: 9, revela: 3 } },
  negra:   { i: 5, nombre: 'Niebla del vacío', corto: 'Drena', color: '#7a4dff', icono: '◍', nocivo: true, minOla: 3, aviso: 2.4,
    desc: 'Drena tus habilidades: los tiempos de recarga se congelan y la carga de la definitiva se apaga. Cruzala rápido.',
    par: { drenaUlt: 8 } },
};
export const NIEBLA_IDS = Object.keys(NIEBLAS);
export const nieblaPorIndice = (i) => NIEBLAS[NIEBLA_IDS[i]] || null;
/** 1–2 nieblas temáticas por arena. ancla: punto de referencia del mapa (`spots`); r: radio; ciclo: segundos de un ciclo completo; fase: desfase (0..1);
 *  act: fracción del ciclo en que está activa (el aviso ocupa los primeros 0,13). */
export const NIEBLAS_ARENA = {
  m1: [{ tipo: 'cian', nombre: 'Bruma de Luz Mala', ancla: ['plates', 0], r: 7, ciclo: 36, fase: 0.0, act: 0.8 },
       { tipo: 'negra', nombre: 'Vacío de la Isla', ancla: ['core'], r: 8, ciclo: 44, fase: 0.45, act: 0.55 }],
  m2: [{ tipo: 'magenta', nombre: 'Niebla de Espejos', ancla: ['valves', 0], r: 9, ciclo: 40, fase: 0.1, act: 0.6 },
       { tipo: 'ambar', nombre: 'Brasa del Espejo', ancla: ['valves', 1], r: 9, ciclo: 42, fase: 0.6, act: 0.55 }],
  m3: [{ tipo: 'blanca', nombre: 'Silbido Blanco', ancla: ['plates', 0], r: 9, ciclo: 38, fase: 0.2, act: 0.8 },
       { tipo: 'cian', nombre: 'Aliento del Coro', ancla: ['plates', 1], r: 7, ciclo: 36, fase: 0.7, act: 0.8 }],
  m4: [{ tipo: 'acida', nombre: 'Esporas Agrias', ancla: ['plates', 3], r: 8, ciclo: 38, fase: 0.0, act: 0.6 },
       { tipo: 'magenta', nombre: 'Esporas del Sueño', ancla: ['core'], r: 9, ciclo: 44, fase: 0.5, act: 0.55 }],
  m5: [{ tipo: 'ambar', nombre: 'Hora de Oro', ancla: ['valves', 1], r: 8, ciclo: 40, fase: 0.15, act: 0.55 },
       { tipo: 'blanca', nombre: 'Bruma de la Plaza', ancla: ['valves', 0], r: 9, ciclo: 36, fase: 0.65, act: 0.8 }],
  m6: [{ tipo: 'negra', nombre: 'Ceniza del Osario', ancla: ['valves', 0], r: 8, ciclo: 44, fase: 0.3, act: 0.55 },
       { tipo: 'acida', nombre: 'Moho de Hueso', ancla: ['valves', 1], r: 8, ciclo: 38, fase: 0.8, act: 0.6 }],
};
/** Nube que suelta un pulmón de las arenas vivas al exhalar: calmo → cian (sana); furioso → el tipo nocivo de su arena. */
export const NUBE_PULMON = { calmo: 'cian', furioso: { m2: 'magenta', m4: 'acida', m6: 'ambar' }, r: 6, vida: 9, deriva: 1.1, alto: 0.4 };
/** Eventos de oleada que usan el sistema (src/sim/eventos.js los llama en su `aviso`). */
export const NIEBLA_EVENTO = { niebla_almas: { tipo: 'blanca', n: 3, r: 10 }, marea_sangre: { tipo: 'ambar', n: 1, r: 10 } };

/* ───────── estado ───────── */
function normalEn(g, pos) { const gv = g.map.gravityAt(pos, g.time), l = len(gv); return l > 1e-3 ? mul(gv, -1 / l) : v3(0, 1, 0); }
function anclaPos(g, a) {
  const sp = g.map.spots || {}; let p = sp[a[0]];
  if (Array.isArray(p)) p = p[a[1] || 0];
  return p ? { x: p.x, y: p.y, z: p.z } : { x: g.map.center.x, y: g.map.center.y, z: g.map.center.z };
}
function nuevaZona(g, d) {
  const N = g.ng, z = {
    id: N.nextId++, tipo: d.tipo, nombre: d.nombre || NIEBLAS[d.tipo].nombre, r: d.r, src: d.src, born: g.time, ph: 'dormida', k: 0.1,
    pos: d.pos, u: d.u, ciclo: d.ciclo || 0, fase: d.fase || 0, act: d.act || 0.6, vida: d.vida ?? Infinity, vel: d.vel || null, evId: d.evId || null, org: d.org ?? -1,
  };
  N.zonas.push(z); return z;
}
export function initNieblas(g) {
  g.ngRng = makeRng((((g.seed | 0) ^ 0x6e1e61) * 2654435761) >>> 0);
  g.ng = null;
  if (CTL.off) return;
  g.ng = { zonas: [], nextId: 1, pm: {}, stats: { entradas: 0, venenoDado: 0, curado: 0, ocultas: 0, drenado: 0, zonasEvento: 0, zonasOrgano: 0 } };
  for (const d of NIEBLAS_ARENA[g.mapId] || []) {
    const c = anclaPos(g, d.ancla), u = normalEn(g, c);
    // el desfase y el largo del ciclo varían un poco con la semilla (mismo mapa, otra partida: otro compás), siempre dentro de ±8 %
    const ciclo = d.ciclo * (0.92 + 0.16 * g.ngRng.next()), fase = (d.fase + 0.1 * g.ngRng.next()) % 1;
    nuevaZona(g, { ...d, src: 'arena', pos: madd(c, u, NIEBLA.alto), u, ciclo, fase });
  }
}
const vivos = (g) => g.players.filter((p) => !p.dead);

/* ───────── orígenes temporales ───────── */
function temporal(g, tipo, pos, u, r, vida, src, extra = {}) {
  const N = g.ng; if (!N) return null;
  if (N.zonas.length >= NIEBLA.maxZonas) {   // si no hay lugar, se retira la temporal más vieja que ya esté dormida
    const i = N.zonas.findIndex((z) => z.src !== 'arena' && z.ph === 'dormida'); if (i < 0) return null; N.zonas.splice(i, 1);
  }
  return nuevaZona(g, { tipo, nombre: NIEBLAS[tipo].nombre, pos, u, r, vida, src, ...extra });
}
/** Para pruebas, modo desarrollo y campo de pruebas: crea una niebla temporal del tipo pedido en `pos` (centro de la esfera). Devuelve la zona. */
export function nieblaTemporal(g, tipo, pos, r = 8, vida = 20) {
  if (!NIEBLAS[tipo]) return null;
  return temporal(g, tipo, { x: pos.x, y: pos.y, z: pos.z }, normalEn(g, pos), r, vida, 'dev');
}
/** Un evento de oleada pide su niebla (se llama en la fase de aviso del evento). */
export function nieblaEvento(g, evId) {
  const N = g.ng, def = NIEBLA_EVENTO[evId]; if (!N || !def || CTL.sinEventos) return;
  if (N.zonas.some((z) => z.evId === evId && z.ph !== 'dormida')) return;
  const vs = vivos(g); if (!vs.length) return;
  for (let i = 0; i < def.n; i++) {
    const ref = vs[i % vs.length];
    let pos = null; try { pos = g.map.spawnGround(g.ngRng, ref.pos); } catch { pos = null; }
    if (!pos || dist(pos, ref.pos) < 8) pos = madd(ref.pos, ref.heading, 12);
    const u = normalEn(g, pos); N.stats.zonasEvento++;
    temporal(g, def.tipo, madd(pos, u, NIEBLA.alto), u, def.r, Infinity, 'evento', { evId });
  }
}
function nubesDePulmon(g) {
  const A = g.ar, N = g.ng; if (!A || CTL.sinOrganos) return;
  A.L.org.forEach((o, i) => {
    if (o.k !== 'pulmon') return;
    const S = A.org[i], antes = N.pm[i] || 0; N.pm[i] = S.mode;
    if (S.roto || S.mode !== 2 || antes === 2) return;             // sólo al EMPEZAR a exhalar
    if (N.zonas.some((z) => z.org === i && z.ph !== 'dormida')) return;
    const toxica = A.ph === 'furioso' && !A.sed;
    const tipo = toxica ? NUBE_PULMON.furioso[g.mapId] || 'acida' : NUBE_PULMON.calmo;
    const ang = g.ngRng.next() * 6.2832, dir = norm(project(v3(Math.cos(ang), 0, Math.sin(ang)), o.u), v3(1, 0, 0));
    const pos = madd(madd(o.pos, o.u, NIEBLA.alto), dir, o.r * 0.35);
    N.stats.zonasOrgano++;
    temporal(g, tipo, pos, o.u, NUBE_PULMON.r, NUBE_PULMON.vida, 'organo', { org: i, vel: mul(dir, NUBE_PULMON.deriva) });
  });
}

/* ───────── ciclo de vida de cada zona ───────── */
function faseDe(g, z) {
  const T = NIEBLAS[z.tipo];
  if (z.src === 'arena') {
    if ((g.practice && !g.ngForce) || g.wave < T.minOla || (T.nocivo && g.phase !== 'wave')) return 'dormida';   // en el respiro y en el campo de pruebas las dañinas duermen
    const u = (((g.time / z.ciclo) + z.fase) % 1 + 1) % 1, av = Math.min(0.2, T.aviso / z.ciclo);
    return u < av ? 'aviso' : u < av + z.act ? 'activo' : 'dormida';
  }
  if (z.src === 'evento') { const e = g.ev; return e && e.id === z.evId ? (e.ph === 'aviso' ? 'aviso' : 'activo') : 'dormida'; }
  const edad = g.time - z.born;
  return edad < T.aviso ? 'aviso' : edad < T.aviso + z.vida ? 'activo' : 'dormida';
}
function pasoZonas(g, dt) {
  const N = g.ng, quita = [];
  for (const z of N.zonas) {
    const antes = z.ph; z.ph = faseDe(g, z);
    if (z.ph !== antes && (antes !== 'dormida' || z.ph !== 'dormida')) {
      g.emit({ t: 'ng', ph: z.ph === 'dormida' ? 'fin' : z.ph, k: NIEBLAS[z.tipo].i, z: z.id, p: a3(z.pos), n: z.nombre });
    }
    const meta = z.ph === 'activo' ? 1 : z.ph === 'aviso' ? 0.6 : (z.src === 'arena' ? 0.1 : 0);
    z.k += Math.max(-NIEBLA.fadeRate * dt, Math.min(NIEBLA.fadeRate * dt, meta - z.k));
    if (z.vel) z.pos = madd(z.pos, z.vel, dt);
    if (z.src !== 'arena' && z.ph === 'dormida' && z.k <= 0.02) quita.push(z);
  }
  if (quita.length) N.zonas = N.zonas.filter((z) => !quita.includes(z));
}
/** ¿La zona está haciendo efecto ahora? (activa y ya con cuerpo visible). */
export const activa = (z) => z.ph === 'activo' && z.k >= 0.55;
const dentro = (z, pos) => dist(pos, z.pos) < z.r;

/* ───────── efectos ───────── */
const credito = (g, m) => { let best = null, bd = Infinity; for (const p of g.players) { if (p.dead) continue; const d = dist(p.pos, m.pos); if (d < bd) { bd = d; best = p; } } return best; };
function efectosJugador(g, p, dt, zs) {
  const N = g.ng, B = p.ngB || (p.ngB = {});
  B.vel = 1; B.dOut = 1; B.dIn = 1; B.oculto = false; B.deriva = 0;
  const ant = p.ngIn || [];
  p.ngIn = [];
  if (p.dead) { p.ngT = 0; return; }
  for (const z of zs) {
    if (!activa(z) || !dentro(z, p.pos)) continue;
    p.ngIn.push(z);
    const T = NIEBLAS[z.tipo], P = T.par;
    if (z.tipo === 'acida') {
      B.vel = Math.min(B.vel, P.vel);
      p.ngAcc = (p.ngAcc || 0) + dt;
      if (p.ngAcc >= 0.5) {
        p.ngAcc -= 0.5;
        const d = Math.min((P.dps + P.dpsOla * g.wave) * 0.5, Math.max(0, p.hp + p.shield - NIEBLA.venenoMin));
        if (d > 0) { g.hurtPlayer(p, d); N.stats.venenoDado += d; }
      }
    } else if (z.tipo === 'cian') {
      const h0 = p.hp; p.hp = Math.min(PLAYER.hp, p.hp + P.hp * dt); p.shield = Math.min(PLAYER.shield, p.shield + P.sh * dt); N.stats.curado += p.hp - h0;
    } else if (z.tipo === 'magenta') {
      B.dOut *= P.danio; if (!(p.input && p.input.soft)) B.deriva = P.deriva;
    } else if (z.tipo === 'ambar') {
      B.dOut *= P.mul; B.dIn *= P.mul;
    } else if (z.tipo === 'blanca') {
      B.oculto = true;
    } else if (z.tipo === 'negra') {
      for (const k of ['movCd', 'espCd', 'abilityCd', 's3Cd', 'habCd']) if (p[k] > 0) { p[k] += dt; N.stats.drenado += dt; }   // congela la recarga (updatePlayer resta dt después)
      if (!(p.ultT > 0) && p.ul > 0) p.ul = Math.max(0, p.ul - P.drenaUlt * dt);
    }
  }
  // aviso de entrada / salida (con histéresis): un evento por cambio de niebla principal
  const prim = p.ngIn[0] || null;
  if (prim) {
    p.ngOut = 0; p.ngT = (p.ngT || 0) + dt;
    if (!ant.length || ant[0].id !== prim.id) { N.stats.entradas++; p.ngT = 0; g.emit({ t: 'ng', ph: 'entra', k: NIEBLAS[prim.tipo].i, z: prim.id, pid: p.id, p: a3(p.pos) }); }
  } else if (ant.length) {
    p.ngOut = (p.ngOut || 0) + dt;
    if (p.ngOut < NIEBLA.histeresis) p.ngIn = ant.filter((z) => z.ph !== 'dormida' && dist(p.pos, z.pos) < z.r * 1.15);   // todavía «adentro» un momento (no parpadea en el borde)
    else { p.ngT = 0; g.emit({ t: 'ng', ph: 'sale', pid: p.id }); }
  }
}
function efectosCriaturas(g, dt, zs) {
  const N = g.ng;
  for (const z of zs) {
    if (!activa(z)) continue;
    if (z.tipo !== 'acida' && z.tipo !== 'cian') continue;
    const T = NIEBLAS[z.tipo], P = T.par, alc = z.tipo === 'cian' ? z.r * P.alcance : z.r;
    for (const m of g.monsters) {
      if (m.dead || m.def.boss || dist(m.pos, z.pos) > alc) continue;
      if (z.tipo === 'acida') {
        m.slowUntil = Math.max(m.slowUntil || 0, g.time + 0.5);
        m.hp -= P.mDps * dt; m.hurt = Math.max(m.hurt || 0, 0.05);
        if (m.hp <= 0) { g.killMonster(m, credito(g, m)); }
      } else if (dist(m.pos, z.pos) > z.r * 0.6) {   // cian: tira suave hacia el centro (en el piso: sólo por el plano tangente)
        let dir = norm(sub(z.pos, m.pos)); if (!m.def.fly) dir = norm(project(dir, m.up || z.u), dir);
        m.pos = madd(m.pos, dir, P.tira * dt);   // arrastre directo (la IA recalcula su velocidad cada paso, un empujón de velocidad no se notaría)
      }
    }
  }
}
/** Un paso por tick (después de tickArenas, antes de mover a los jugadores). */
export function tickNieblas(g, dt) {
  const N = g.ng; if (!N) return;
  if (g.practice && !g.ngForce) { for (const p of g.players) { if (p.ngB) { p.ngB.vel = 1; p.ngB.dOut = 1; p.ngB.dIn = 1; p.ngB.oculto = false; p.ngB.deriva = 0; } p.ngIn = []; } }
  nubesDePulmon(g);
  pasoZonas(g, dt);
  const zs = N.zonas;
  for (const p of g.players) efectosJugador(g, p, dt, zs);
  efectosCriaturas(g, dt, zs);
}

/* ───────── ganchos (pocos y baratos; los llama game.js) ───────── */
/** Multiplicador de velocidad del jugador (veneno). */
export const ngVel = (g, p) => (p.ngB ? p.ngB.vel : 1);
/** Multiplicador del daño que HACE el jugador (ámbar, magenta). */
export const ngDanio = (g, p) => (p.ngB ? p.ngB.dOut : 1);
/** Multiplicador del daño que RECIBE el jugador (ámbar). */
export const ngRecibe = (g, p) => (p.ngB ? p.ngB.dIn : 1);
/** Multiplicador del daño que recibe una criatura que está dentro de una niebla ámbar activa. */
export function ngMonstruoRecibe(g, m, by = null) {
  const N = g.ng; if (!N) return 1;
  if (by && by.ngB && by.ngB.oculto) m.ngVisto = g.time + NIEBLAS.blanca.par.revela;   // disparar desde la niebla blanca delata tu posición un rato
  for (const z of N.zonas) if (z.tipo === 'ambar' && activa(z) && dist(m.pos, z.pos) < z.r) return NIEBLAS.ambar.par.mul;
  return 1;
}
/** ¿Esta criatura NO ve a este jugador por la niebla blanca? (sólo a más de `ver` metros; de cerca lo siguen viendo). */
export const ngOculta = (g, p, m) => !!(p.ngB && p.ngB.oculto) && !m.def.boss && g.time >= (m.ngVisto || 0) && dist(p.pos, m.pos) > NIEBLAS.blanca.par.ver;
/** Tuerce un poco el rumbo deseado dentro de la niebla magenta (±0,2 rad, lento). Con «Reducir efectos» no hace nada. */
export function ngDeforma(g, p, wish) {
  const B = p.ngB; if (!B || !B.deriva || (p.input && p.input.soft)) return wish;
  const l = len(wish); if (l < 1e-6) return wish;
  return rotAround(wish, p.up, B.deriva * Math.sin(g.time * 1.7 + (p.id || 0)));
}

/* ───────── snapshot ───────── */
/** ng = null | { z: [[id, tipo(0-5), x,y,z, r, densidad 0-1, fase(0 dormida/1 aviso/2 activa), ux,uy,uz]], d: [[jugador, tipo, zona, segundos adentro]] } */
export function ngSnap(g) {
  const N = g.ng; if (!N || !N.zonas.length || (g.practice && !g.ngForce)) return null;
  const FASE = { dormida: 0, aviso: 1, activo: 2 };
  const d = [];
  for (const p of g.players) if (p.ngIn && p.ngIn.length) d.push([p.id, NIEBLAS[p.ngIn[0].tipo].i, p.ngIn[0].id, r2(p.ngT || 0)]);
  return { z: N.zonas.map((z) => [z.id, NIEBLAS[z.tipo].i, ...a3(z.pos), z.r, r2(z.k), FASE[z.ph], ...a3(z.u)]), d };
}
