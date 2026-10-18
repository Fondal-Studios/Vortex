// PROGRESIÓN PERMANENTE de los dos tipos de jugador (docs/EVOLUCION.md → «Árbol de combos y de disparo»):
//   · Árbol de COMBOS (modo Combo): por Huésped, 3 ramas EXCLUYENTES de 3 nodos (Dominio de Cadena / Aniquilación en Área / Ejecución).
//   · Árbol de DISPARO (modo Shooter): por Huésped, 3 ramas EXCLUYENTES de 3 nodos (Precisión / Perforación y Rebote / Cargadores).
// Datos puros y deterministas (sin DOM, sin azar, sin g.rng, sin perfil). El perfil (src/client/perfil.js) guarda los puntos y los nodos
// elegidos; la simulación sólo recibe los ids (opts.arbol de addPlayer / prof.arbol de setLoadout) y los convierte en efectos (p.ac / p.as).
// Los nodos de Combo NO tocan Shooter y viceversa: p.ac sólo lo lee combos.js; p.as sólo lo leen firePlayer (game.js) y clipOf/reloadTime (loadout.js).
import { HOST_IDS } from './data.js';

/** Costo en puntos de cada nodo de una rama (1.º, 2.º, 3.º). Una rama completa = 195 puntos. */
export const PC_COSTE = [25, 60, 110];
/** El reinicio de un árbol devuelve todo menos esta fracción de lo gastado (el costo de cambiar de idea). */
export const RESET_COSTO = 0.25;
/** Tope de daño EXTRA por golpe (en múltiplos del daño del golpe) que pueden repartir entre todos los enemigos los efectos de arrasar (finisher de área, propagación, objetivos de más). */
export const ARRASE_PRESUPUESTO = 6;
/** Ventana (s) tras una baja para seguir contando el multi-kill. */
export const MULTI_VENTANA = 0.9;

export const MODOS_ARBOL = ['combo', 'disparo'];
export const RAMAS = {
  combo: {
    cadena:    { nombre: 'Dominio de Cadena',    texto: 'Más tiempo para encadenar, golpes nuevos en la cadena y cancelaciones: el que no para de pegar.' },
    area:      { nombre: 'Aniquilación en Área', texto: 'Golpes que atraviesan, remates que barren y bajas que se propagan: arrasar hordas enteras.' },
    ejecucion: { nombre: 'Ejecución',            texto: 'Marcas, remates que cobran y ejecuciones que no dejan de golpear: el cazador de uno en uno.' },
  },
  disparo: {
    punteria:  { nombre: 'Precisión',            texto: 'Tiros más juntos y más fuertes: cada bala vale más.' },
    perfora:   { nombre: 'Perforación y Rebote', texto: 'Las balas atraviesan y el daño salta entre enemigos cercanos.' },
    cargador:  { nombre: 'Cargadores',           texto: 'Más balas por cargador y recargas más rápidas: disparar sin parar.' },
  },
};

/* ───────── árbol de COMBOS: nombres e identidad por Huésped ───────── */
/** Finisher de área de cada Huésped (nodo «area2»): onda/cono (Axioma), torbellino (Vesper), sismo (Micelio), vacío que arrastra (Umbra), cadena de rayos (Seraf). */
export const FIN_HUESPED = { axioma: 'cono', vesper: 'torbellino', micelio: 'sismo', umbra: 'vacio', seraf: 'rayos' };
const FIN_TEXTO = {
  cono: 'El remate de cada cadena lanza un IMPACTO EN CONO que empuja a todo lo de enfrente.',
  torbellino: 'El remate de cada cadena abre un TORBELLINO de garras alrededor tuyo.',
  sismo: 'El remate de cada cadena hace un SISMO: daña, ralentiza y suelta raíces alrededor.',
  vacio: 'El remate de cada cadena abre un VACÍO que ARRASTRA a los enemigos hacia un punto y los golpea.',
  rayos: 'El remate de cada cadena dispara una CADENA DE RAYOS que salta entre hasta 7 enemigos.',
};
const NOMBRES_C = {
  axioma:  { cadena: ['Ritmo de acero', 'Contragolpe de coraza', 'Cataclismo'],     area: ['Filo atravesador', 'Impacto en cono', 'Ola de choque'],      ejecucion: ['Marca de sentencia', 'Remate cobrador', 'Veredicto de acero'] },
  vesper:  { cadena: ['Pulso de manada', 'Remolino de zarpas', 'Furia de la manada'], area: ['Zarpas voraces', 'Torbellino de garras', 'Estampida'],      ejecucion: ['Rastro de sangre', 'Remate cobrador', 'Cazadora implacable'] },
  micelio: { cadena: ['Raíz tenaz', 'Lluvia de esporas', 'Floración total'],         area: ['Puños de bosque', 'Sismo de raíces', 'Micelio en cadena'],    ejecucion: ['Esporas de sentencia', 'Cosecha', 'Podredumbre final'] },
  umbra:   { cadena: ['Paso largo', 'Cruce invertido', 'Mil planos'],                area: ['Filo sin borde', 'Vacío que arrastra', 'Eco que se contagia'], ejecucion: ['Marca del vacío', 'Corte cobrador', 'Eclipse de sentencia'] },
  seraf:   { cadena: ['Pulso de luz', 'Flecha gemela', 'Lluvia estelar'],            area: ['Luz que atraviesa', 'Cadena de rayos', 'Resplandor en cadena'], ejecucion: ['Marca de luz', 'Flecha cobradora', 'Juicio de luz'] },
};
const TEXTO_C = {
  cadena1: 'Ventana de encadenado ×1,6, la siguiente pulsación se guarda más tiempo y se acepta antes (cancelación al 85 %).',
  cadena2: (c) => `NUEVO GOLPE en la cadena: «${EXTRA_C2[c].name}» (${EXTRA_C2[c].seq.map((b) => b.toUpperCase()).join(' → ')}).`,
  cadena3: (c) => `Cadena +1, cualquier ataque cancela la recuperación a tiempo y se abre el golpe final «${CAPITULO[c].name}» (${CAPITULO[c].seq.map((b) => b.toUpperCase()).join(' → ')}).`,
  area1: 'Tus golpes ATRAVIESAN: alcance +15 %, ángulo +25 %, hasta 14 enemigos por golpe (antes 4) e ignoran la guardia de los arietes. Las flechas de Seraf atraviesan.',
  area2: (c) => FIN_TEXTO[FIN_HUESPED[c]],
  area3: 'RESONANCIA: cada baja empuja a los de alrededor y les propaga parte del daño, en cadena (máx. 2 saltos y 14 golpes por ataque).',
  ejecucion1: 'Cada golpe MARCA al enemigo 4 s (recibe +15 % de daño) y ejecutás con un 5 % más de vida restante.',
  ejecucion2: 'El remate pega un 35 % más; cada baja con un remate te cura 4 y acelera 1,2 s tu habilidad (hasta 5 bajas).',
  ejecucion3: 'Ejecutás con un 7 % más de vida restante y cada ejecución cancela la recuperación: el golpe siguiente sale ya.',
};
const mv = (id, name, seq, o = {}) => ({ id, name, seq, evo: 0, w: 'l', dmg: 1, rng: 1, arc: 1, cdr: 1, hits: 1, kind: 'light', ...o });
/** Golpe nuevo del nodo «cadena2» (secuencia que el set base no usa). Reutiliza las mecánicas de los 8 golpes de cada Huésped. */
export const EXTRA_C2 = {
  axioma:  mv('contragolpe', 'Contragolpe de coraza', ['a2', 'a1'], { w: 'h', dmg: 1.25, fx: 'sismo', arc: 1.6, kind: 'heavy', cdr: 1.1 }),
  vesper:  mv('remolino', 'Remolino de zarpas', ['a2', 'a1'], { dmg: 0.6, hits: 3, arc: 2, kind: 'spin', cdr: 1.1 }),
  micelio: mv('lluvia_esporas', 'Lluvia de esporas', ['a2', 'a1'], { w: 'h', dmg: 1.3, fx: 'raices', arc: 1.8, kind: 'heavy', cdr: 1.1 }),
  umbra:   mv('cruce_invertido', 'Cruce invertido', ['a2', 'a2'], { w: 'h', dmg: 1.3, blink: 5, line: true, kind: 'lunge', cdr: 1.1 }),
  seraf:   mv('flecha_gemela', 'Flecha gemela', ['a2', 'a1'], { ranged: true, w: 'h', dmg: 1.1, hits: 2, rng: 14, pierce: true, fan: 0.05, kind: 'heavy', cdr: 1.1 }),
};
/** Golpe final del nodo «cadena3» (continúa el de cadena2, así que la cadena llega hasta él aunque el nivel de evolución sea bajo). */
export const CAPITULO = {
  axioma:  mv('cataclismo', 'Cataclismo de acero', ['a2', 'a1', 'a2'], { w: 'h', dmg: 2.1, fx: 'sismo+onda', arc: 2, kind: 'air', cdr: 1.5 }),
  vesper:  mv('furia_manada', 'Furia de la manada', ['a2', 'a1', 'a2'], { dmg: 0.7, hits: 4, arc: 2, dash: 8, kind: 'spin', cdr: 1.5 }),
  micelio: mv('floracion_total', 'Floración total', ['a2', 'a1', 'a2'], { w: 'h', dmg: 1.9, arc: 2, fx: 'raices+sismo', big: true, kind: 'air', cdr: 1.5 }),
  umbra:   mv('mil_planos', 'Mil planos', ['a2', 'a2', 'a1'], { w: 'h', dmg: 0.8, hits: 3, blink: 8, line: true, kind: 'lunge', cdr: 1.5 }),
  seraf:   mv('lluvia_estelar', 'Lluvia estelar', ['a2', 'a1', 'a2'], { ranged: true, dmg: 0.8, hits: 9, rng: 12, fan: 0.08, pierce: true, kind: 'heavy', cdr: 1.8 }),
};

/** Efectos NEUTROS del árbol de combos (sin nodos): combos.js los lee con `p.ac || NEUTRO_C`. */
export const NEUTRO_C = Object.freeze({ win: 1, buf: 1, cancel: 0, chain: 0, extra: Object.freeze([]), freeCancel: false, maxT: 0, rng: 1, arc: 1, pen: false, fin: '', res: false, mark: false, exec: 0, finMul: 1, refund: false, execCancel: false });
export const NEUTRO_S = Object.freeze({ dmg: 1, spread: 1, pierce: false, chain: 0, clip: 1, reload: 1 });

/** Nodos del árbol de combos de un Huésped: [{ id, rama, nivel (1..3), nombre, texto, coste }] (9). Vacío si no es Huésped. */
export function arbolCombo(char) {
  if (!HOST_IDS.includes(char)) return [];
  const out = [];
  for (const rama of Object.keys(RAMAS.combo)) for (let n = 1; n <= 3; n++) {
    const id = rama + n, t = TEXTO_C[rama + n];
    out.push({ id, rama, nivel: n, nombre: NOMBRES_C[char][rama][n - 1], texto: typeof t === 'function' ? t(char) : t, coste: PC_COSTE[n - 1] });
  }
  return out;
}
/** Nodos del árbol de disparo (iguales para los 5 Huéspedes; el progreso es de cada uno). */
export const ARBOL_DISPARO = [
  { id: 'punteria1', rama: 'punteria', nivel: 1, nombre: 'Pulso firme', texto: 'Los disparos se dispersan un 35 % menos y pegan un 4 % más.' },
  { id: 'punteria2', rama: 'punteria', nivel: 2, nombre: 'Ojo de halcón', texto: 'Dispersión −50 % en total y daño +10 % en total.' },
  { id: 'punteria3', rama: 'punteria', nivel: 3, nombre: 'Tirador perfecto', texto: 'Dispersión −75 % en total y daño +16 % en total.' },
  { id: 'perfora1', rama: 'perfora', nivel: 1, nombre: 'Balas perforantes', texto: 'Los disparos y proyectiles ATRAVIESAN a los enemigos.' },
  { id: 'perfora2', rama: 'perfora', nivel: 2, nombre: 'Rebote', texto: 'El daño REBOTA: salta a 2 enemigos cercanos más (70 % del daño).' },
  { id: 'perfora3', rama: 'perfora', nivel: 3, nombre: 'Tormenta de plomo', texto: 'El rebote salta a 4 enemigos y las balas pegan un 6 % más.' },
  { id: 'cargador1', rama: 'cargador', nivel: 1, nombre: 'Cargador largo', texto: 'Cargadores un 25 % más grandes.' },
  { id: 'cargador2', rama: 'cargador', nivel: 2, nombre: 'Manos rápidas', texto: 'Cargadores +45 % en total y recargas un 20 % más rápidas.' },
  { id: 'cargador3', rama: 'cargador', nivel: 3, nombre: 'Sin parar', texto: 'Cargadores +75 % en total y recargas un 35 % más rápidas.' },
].map((n) => ({ ...n, coste: PC_COSTE[n.nivel - 1] }));

/** Nodos de un árbol: modo 'combo' (por Huésped) o 'disparo'. */
export const nodosDe = (modo, char) => (modo === 'combo' ? arbolCombo(char) : modo === 'disparo' && HOST_IDS.includes(char) ? ARBOL_DISPARO : []);

/** Sanea una lista de ids de un árbol: sólo nodos reales, UNA rama (la del primer nodo), en orden 1→2→3 sin saltos y sin repetir. */
export function cleanNodos(modo, char, ids) {
  const nodos = nodosDe(modo, char); if (!nodos.length || !Array.isArray(ids)) return [];
  const ok = new Set(ids.filter((x) => typeof x === 'string' && nodos.some((n) => n.id === x)));
  if (!ok.size) return [];
  const first = ids.find((x) => ok.has(x)), rama = nodos.find((n) => n.id === first).rama, out = [];
  for (let n = 1; n <= 3; n++) { const nd = nodos.find((q) => q.rama === rama && q.nivel === n); if (ok.has(nd.id)) out.push(nd.id); else break; }
  return out;
}
/** Sanea { combo: [ids], disparo: [ids] } de un cliente (el servidor y addPlayer lo usan: acota, no verifica puntos). */
export function cleanArbol(char, raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return { combo: cleanNodos('combo', char, Array.isArray(r.combo) ? r.combo.slice(0, 6) : []), disparo: cleanNodos('disparo', char, Array.isArray(r.disparo) ? r.disparo.slice(0, 6) : []) };
}
/** Puntos que cuestan los nodos elegidos. */
export const gastado = (modo, char, ids) => cleanNodos(modo, char, ids).reduce((a, id) => a + (nodosDe(modo, char).find((n) => n.id === id) || { coste: 0 }).coste, 0);
/** Por qué NO se puede comprar este nodo ahora (texto en español) o null si se puede. `pc` = puntos ganados en total en ese árbol. */
export function errorNodo(modo, char, ids, id, pc) {
  const nodos = nodosDe(modo, char), nd = nodos.find((n) => n.id === id); if (!nd) return 'Ese nodo no existe.';
  const own = cleanNodos(modo, char, ids); if (own.includes(id)) return 'Ya lo tenés.';
  if (own.length) { const rama = nodos.find((n) => n.id === own[0]).rama; if (nd.rama !== rama) return `Ya elegiste la rama «${RAMAS[modo][rama].nombre}»: las ramas se excluyen. Reiniciá el árbol para cambiar.`; }
  if (nd.nivel !== own.length + 1) return `Primero conseguí el nodo ${nd.nivel - 1} de esta rama.`;
  const libres = (pc | 0) - gastado(modo, char, own); if (libres < nd.coste) return `Te faltan ${nd.coste - libres} puntos (cuesta ${nd.coste}).`;
  return null;
}
/** Cuántos puntos se pierden al reiniciar un árbol (el resto se devuelve). */
export const costeReinicio = (modo, char, ids) => Math.ceil(gastado(modo, char, ids) * RESET_COSTO);

/** Puntos de combo de una partida en modo Combo: golpes encadenados, remates, multi-kills y oleadas. `st` = { h: golpes que dieron, f: remates, m: multi-kills, mm: mayor multi-kill }. */
export function puntosCombo(st = {}, wave = 0) {
  const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
  return Math.min(250, Math.floor(n(st.h) / 15) + Math.floor(n(st.f) / 2) + n(st.m) + Math.floor(n(st.mm) / 4) + Math.min(40, n(wave)));
}
/** Puntos de disparo de una partida en modo Shooter: bajas, multi-kills y oleadas. `st` = { k: bajas, m: multi-kills, mm: mayor multi-kill }. */
export function puntosDisparo(st = {}, wave = 0) {
  const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
  return Math.min(250, Math.floor(n(st.k) / 5) + n(st.m) + Math.floor(n(st.mm) / 4) + Math.min(40, n(wave)));
}

/* ───────── efectos ───────── */
/** Convierte los nodos de combo elegidos en efectos (un objeto con las mismas claves que NEUTRO_C). */
export function efectosCombo(char, ids) {
  const ac = { ...NEUTRO_C, extra: [] }, own = cleanNodos('combo', char, ids);
  for (const id of own) {
    if (id === 'cadena1') { ac.win = 1.6; ac.buf = 1.5; ac.cancel = Math.max(ac.cancel, 0.85); }
    else if (id === 'cadena2') ac.extra.push(EXTRA_C2[char]);
    else if (id === 'cadena3') { ac.chain = 1; ac.freeCancel = true; ac.extra.push(CAPITULO[char]); }
    else if (id === 'area1') { ac.pen = true; ac.maxT = 14; ac.rng = 1.15; ac.arc = 1.25; }
    else if (id === 'area2') ac.fin = FIN_HUESPED[char];
    else if (id === 'area3') ac.res = true;
    else if (id === 'ejecucion1') { ac.mark = true; ac.exec += 0.05; }
    else if (id === 'ejecucion2') { ac.finMul = 1.35; ac.refund = true; }
    else if (id === 'ejecucion3') { ac.exec += 0.07; ac.execCancel = true; }
  }
  return ac;
}
/** Convierte los nodos de disparo elegidos en efectos (mismas claves que NEUTRO_S). */
export function efectosDisparo(char, ids) {
  const as = { ...NEUTRO_S }, own = cleanNodos('disparo', char, ids);
  for (const id of own) {
    if (id === 'punteria1') { as.spread = 0.65; as.dmg = 1.04; }
    else if (id === 'punteria2') { as.spread = 0.5; as.dmg = 1.1; }
    else if (id === 'punteria3') { as.spread = 0.25; as.dmg = 1.16; }
    else if (id === 'perfora1') as.pierce = true;
    else if (id === 'perfora2') as.chain = 2;
    else if (id === 'perfora3') { as.chain = 4; as.dmg *= 1.06; }
    else if (id === 'cargador1') as.clip = 1.25;
    else if (id === 'cargador2') { as.clip = 1.45; as.reload = 0.8; }
    else if (id === 'cargador3') { as.clip = 1.75; as.reload = 0.65; }
  }
  return as;
}
/** Da forma al arma que dispara un jugador en Shooter (lo llama game.js → firePlayer). En Combo no hace nada. */
export function shapeArbolGun(w, p) {
  const a = p.as; if (!a || p.mode === 'combo') return;
  w.dmg *= a.dmg; if (w.spread) w.spread *= a.spread; if (a.pierce) w.pierce = true; if (a.chain && !w.noChain) w.chain = Math.max(w.chain || 0, a.chain);
}

/* ───────── rango de estilo (D → S) y estadísticas de la partida ───────── */
export const RANGOS_ESTILO = ['D', 'C', 'B', 'A', 'S'];
/** Puntos de estilo necesarios para cada rango. */
export const UMBRAL_ESTILO = [0, 10, 30, 60, 100];
export const rangoDeEstilo = (pts) => { let r = 0; for (let i = 1; i < UMBRAL_ESTILO.length; i++) if (pts >= UMBRAL_ESTILO[i]) r = i; return r; };

const r2 = (n) => Math.round(n * 100) / 100;
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];
/** Estadísticas de la partida (p.ps) y efectos (p.ac, p.as) de un jugador. `arbol` = lo que mandó el perfil/cliente. Idempotente. */
export function applyArbol(p, arbol) {
  const a = cleanArbol(p.char, arbol);
  p.arbChar = p.char; p.arb = a; p.ac = efectosCombo(p.char, a.combo); p.as = efectosDisparo(p.char, a.disparo);
  p.ps = { c: { h: 0, f: 0, m: 0, mm: 0, k: 0 }, s: { k: 0, m: 0, mm: 0 }, pts: 0, rk: 0, mk: 0, mkT: 0, k0: p.kills | 0, idle: 0 };
  return p;
}
/** Un golpe de combo que dio a `hits` enemigos (fin = remate de una cadena de 2 o más). */
export function progHit(p, hits, fin) {
  const s = p.ps; if (!s) return; if (hits > 0) { s.c.h += hits; s.pts += hits; s.idle = 0; } if (fin) { s.c.f++; s.pts += 4; s.idle = 0; }
}
/** Cada tick (lo llama huespedes.js → updateHost): cuenta bajas y multi-kills, y hace caer el rango de estilo si no atacás. */
export function progStep(g, p, dt) {
  if (!p.ps) applyArbol(p, p.arb);
  const s = p.ps, combo = p.mode === 'combo', ks = (p.kills | 0) - s.k0; s.k0 = p.kills | 0;
  if (s.mkT > 0) { s.mkT -= dt; if (s.mkT <= 0) cerrarMulti(g, p); }
  if (ks > 0) {
    if (combo) { s.c.k += ks; s.pts += 3 * ks; } else s.s.k += ks;
    s.mk += ks; s.mkT = MULTI_VENTANA; s.idle = 0;
    if (combo && s.mk >= 2 && ks > 0) s.pts += 2 * Math.min(ks, 3);
  }
  if (combo) {
    s.idle += dt; if (s.idle > 2.5) s.pts = Math.max(0, s.pts - (4 + s.pts * 0.12) * dt);
    const rk = rangoDeEstilo(s.pts);
    if (rk > s.rk) g.emit({ t: 'rango', pid: p.id, r: RANGOS_ESTILO[rk], i: rk, p: a3(p.pos) });
    s.rk = rk;
  } else { s.pts = 0; s.rk = 0; }
}
function cerrarMulti(g, p) {
  const s = p.ps, n = s.mk; s.mk = 0; s.mkT = 0;
  if (n < 2) return;
  const st = p.mode === 'combo' ? s.c : s.s; st.m++; st.mm = Math.max(st.mm, n);
  if (p.mode === 'combo') s.pts += 4 * (n - 1);
  g.emit({ t: 'multi', pid: p.id, n, p: a3(p.pos) });
}
/** Campos del snapshot: rk/rp (rango de estilo y avance al siguiente), mk (bajas del multi-kill en curso), pk (para el perfil: golpes, remates, multis, bajas, multis shooter, bajas shooter, mejor multi combo, mejor multi shooter). */
export function progSnap(p) {
  const s = p.ps; if (!s) return {};
  const rk = s.rk, nx = UMBRAL_ESTILO[rk + 1], lo = UMBRAL_ESTILO[rk];
  return { rk, rp: nx ? r2(Math.min(1, (s.pts - lo) / (nx - lo))) : 1, mk: s.mk, pk: [s.c.h, s.c.f, s.c.m, s.c.k, s.s.m, s.s.k, s.c.mm, s.s.mm] };
}
