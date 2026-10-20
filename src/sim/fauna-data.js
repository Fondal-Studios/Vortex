// FAUNA CONSUMIBLE — DATOS (docs/FAUNA.md). Seres vivos psicodélicos que viven en las arenas y que los Huéspedes pueden COMER para
// meterse en una METAMORFOSIS temporal (una «forma» de ~60-90 s). Datos puros, sin azar, sin DOM: los comparten la simulación
// (src/sim/fauna.js), el cliente (dibujo, HUD, Bestiario) y el perfil (Códice de Fauna). Todo el texto visible va en español.
//
//   ESPECIE  → {id, nombre, mapa, forma, cuerpo, c1, c2, tam, vel, corre, alerta, dur, grupo, peso, dorm, vuelo, peligrosa, rara, atrae, cerca, folclore, frase, pista}
//   FORMA    → {id, nombre, icono, color, vis, desc, par, extra}   (par = efectos de partida, ver «PARÁMETROS» abajo; vis = estilo de shader del cuerpo)
//   HÍBRIDO  → se crea al comer dos formas compatibles seguidas (HIBRIDOS): mezcla los efectos de las dos con un tope de equilibrio.
//
// PARÁMETROS de `par` (todos opcionales; los lee src/sim/fauna.js):
//   dIn / dOut     multiplicador del daño que recibís / hacés            spd, jump    multiplicador de velocidad / salto
//   regen, sreg    vida / escudo por segundo                              lifesteal    fracción del daño hecho que vuelve como vida
//   slow [p, s]    prob. por golpe de ralentizar s segundos               freeze [p, s] prob. de congelar (casi frenar) s segundos
//   burn [dps, s]  quemadura                                               poison [dps, s] veneno
//   chain [n, k]   arco eléctrico a n vecinos con k del daño              pierce       el disparo atraviesa (Shooter)
//   push           empuje que reciben los golpeados                       daze [p, r, s] deslumbra: ralentiza a los vecinos de la víctima
//   reflect        fracción del daño recibido que vuelve a los cercanos   thorns       lo mismo, sólo a los que están pegados a vos
//   trail {k,every,r,life,dps,slow,spd}  rastro en el suelo (escarcha, fuego, raíces…)   aura {r, slow, dps}  campo alrededor tuyo
//   nube {p,r,life,dps,slow}  nube tóxica al golpear                       phase [cd, s] fase: 1.ª herida cada cd s te hace intocable s segundos
//   cloak          las criaturas lejanas te pierden de vista               eco p        prob. de que el golpe se repita como eco
//   fin {k,r,dmg,…}  REMATE elemental (Melé: 3.er golpe o golpe pesado)    vulnAmbar    daño extra dentro de nieblas ámbar
//   entra {sh, hp}  escudo / vida que recibís al transformarte
// Equilibrio: ningún número supera dIn ≥ 0,70 · dOut ≤ 1,15 · spd ≤ 1,30 (los híbridos se recortan en mezclar()).

/** Reglas generales de la fauna. */
export const FAUNA = {
  max: 12,             // tope de bichos vivos en toda la partida (con grupos incluidos)
  alcance: 2.7,        // m a los que podés comer (USAR / E)
  alcanceBoca: 3.4,    // m del remate de Melé («devorar»)
  duracionMax: 150,    // tope de segundos de una forma aunque la sigas refrescando
  residuoMax: 20,      // segundos que dura el residuo menor de la forma anterior
  residuoK: 0.4,       // fracción de los números de la forma anterior que conserva el residuo
  respiro: { cada: 1.6, meta: 8 },   // en el respiro entre oleadas: un bicho nuevo cada 1,6 s hasta 8 (+2 por jugador extra)
  oleada: { cada: 11, meta: 3 },     // en combate: aparecen poco (uno cada 11 s hasta 3)
  jefe: { meta: 0 },   // en la oleada del jefe no aparece fauna
  vida: [95, 160],     // segundos que vive un bicho antes de irse (azar determinista)
  lejos: 120,          // si queda a más de 120 m de todos los jugadores se retira
  rara: 0.07,          // probabilidad de que un nacimiento sea de una especie rara (x3 en el Eclipse)
  muerde: { dano: 5, porOla: 0.35, cd: 2.5, alcance: 1.5, vidaMin: 15 },   // las peligrosas: muerden si las pisás (nunca bajan tu vida de vidaMin)
  procCd: 0.12,        // s entre efectos «por golpe» (cadena, nube…) de un mismo jugador: no se disparan en ametralladora
  zonasMax: 8,         // rastros (escarcha, fuego…) vivos a la vez en toda la partida
  remateCd: 0.9,       // s entre remates elementales
};

/* ───────── FORMAS BASE (20) ───────── */
const F = (id, nombre, icono, color, vis, desc, par, extra = {}) => ({ id, nombre, icono, color, vis, desc, par, extra });
export const FORMAS = {
  hielo: F('hielo', 'Piel de Hielo', '❄', '#8be9ff', 0, 'Recibís −20 % de daño. Tus golpes ralentizan y a veces CONGELAN; dejás escarcha resbaladiza (vos corrés más rápido encima, ellos se arrastran). Ojo: el fuego te hace +25 % de daño.',
    { dIn: 0.8, spd: 0.98, slow: [1, 1.8], freeze: [0.14, 1.0], trail: { k: 'escarcha', every: 0.7, r: 2.4, life: 6, slow: 0.45, spd: 0.12 }, vulnAmbar: 1.25, fin: { k: 'hielo', r: 5, dmg: 55, freeze: 0.6, secs: 1.6 } }, { freeze: 0.1 }),
  brasa: F('brasa', 'Cuerpo de Brasa', '🔥', '#ff6a1a', 1, 'Dejás una estela de fuego que quema a las criaturas y tus golpes prenden fuego (+8 % de daño). A cambio, sos un poco más frágil.',
    { dOut: 1.08, dIn: 1.05, burn: [14, 4], trail: { k: 'fuego', every: 0.6, r: 1.8, life: 3.5, dps: 16 }, fin: { k: 'brasa', r: 5.5, dmg: 60, burn: [16, 4] } }, { burn: 5 }),
  electrica: F('electrica', 'Nervios Eléctricos', '⚡', '#ffe14a', 2, '+18 % de velocidad y tus golpes saltan en cadena de bicho en bicho. En Shooter, las balas son rayos.',
    { spd: 1.18, chain: [2, 0.55], fin: { k: 'rayo', r: 6, dmg: 50, chain: 4 } }, { chain: 1 }),
  marea: F('marea', 'Pulso de Marea', '🌊', '#3dffd0', 3, 'Te curás con el tiempo (+3,5 vida/s y escudo) y tus golpes EMPUJAN como una ola. El remate te cura.',
    { regen: 3.5, sreg: 6, dIn: 0.95, push: 7, fin: { k: 'ola', r: 6, dmg: 35, push: 16, heal: 12 } }, { regen: 1.4 }),
  cristal: F('cristal', 'Coraza de Cristal', '💎', '#d9b8ff', 4, 'Recibís −12 % de daño, empezás con +40 de escudo y devolvés el 35 % del daño que te hacen a los que te rodean.',
    { dIn: 0.88, reflect: 0.35, entra: { sh: 40 }, fin: { k: 'prisma', r: 4.5, dmg: 50, slow: 1.5 } }, { reflect: 0.2 }),
  vacio: F('vacio', 'Fase del Vacío', '🌀', '#8a5cff', 5, 'Saltás 35 % más alto, tu primera herida cada 7 s te vuelve intocable 0,8 s (fase) y drenás un 5 % del daño que hacés.',
    { jump: 1.35, spd: 1.04, lifesteal: 0.05, phase: [7, 0.8], fin: { k: 'vacio', r: 6, dmg: 45, pull: 12, heal: 8 } }, { phase: -2 }),
  veneno: F('veneno', 'Sangre Venenosa', '☣', '#9dff2a', 6, 'Tus golpes envenenan y a veces sueltan una nube tóxica que ralentiza y daña. Recibís −5 % de daño.',
    { dIn: 0.95, poison: [9, 5], nube: { p: 0.18, r: 3.2, life: 4, dps: 11, slow: 0.7 }, fin: { k: 'veneno', r: 5, dmg: 30, poison: [14, 5] } }, { poison: 3 }),
  luz: F('luz', 'Piel de Luz', '✨', '#fff2a8', 7, '+10 % de daño, +5 % de velocidad, tus disparos ATRAVIESAN y a veces deslumbran (ralentizan) a los vecinos de tu blanco.',
    { dOut: 1.1, spd: 1.05, pierce: true, daze: [0.18, 6, 1.6], fin: { k: 'luz', r: 7, dmg: 40, daze: 2 } }, { dOut: 0.04 }),
  hueso: F('hueso', 'Armadura de Huesos', '🦴', '#efe6c8', 8, 'Recibís −28 % de daño y las criaturas pegadas a vos se clavan en tus espinas (devolvés el 60 %). Pesás: −5 % de velocidad.',
    { dIn: 0.72, spd: 0.95, thorns: 0.6, fin: { k: 'hueso', r: 4.5, dmg: 70, slow: 1.2 } }, { thorns: 0.3 }),
  eco: F('eco', 'Hilo de Eco', '🕸', '#ff8cf0', 9, 'Tus golpes se repiten como un eco (35 % de las veces, a la mitad de daño) y enredan en seda a las criaturas. Recibís −5 % de daño.',
    { dIn: 0.95, eco: 0.35, slow: [0.4, 1.2], fin: { k: 'seda', r: 5.5, dmg: 30, slow: 3, freeze: 0.3, secs: 1.2 } }, { eco: 0.15 }),
  sangre: F('sangre', 'Sed de Rubí', '🩸', '#ff2f5e', 6, 'Robás vida: el 12 % de tu daño te cura y pegás +5 % más fuerte. Sos más frágil (+10 % de daño recibido).',
    { lifesteal: 0.12, dOut: 1.05, dIn: 1.1, fin: { k: 'sangre', r: 5, dmg: 50, heal: 15 } }, { lifesteal: 0.05 }),
  humo: F('humo', 'Aliento de Humo', '🌫', '#c9c4d8', 5, '+14 % de velocidad y las criaturas a más de 9 m te pierden de vista. Atacar rompe el humo un instante.',
    { spd: 1.14, dIn: 1.05, cloak: true, fin: { k: 'humo', r: 5, dmg: 25, slow: 1.5 } }, { spd: 0.04 }),
  lunar: F('lunar', 'Peso de Luna', '🌙', '#bcd4ff', 0, 'Saltás 30 % más alto, tu escudo se rellena a toda prisa (+9/s) y recibís −5 % de daño. Flotás más.',
    { jump: 1.3, sreg: 9, dIn: 0.95, fin: { k: 'luna', r: 5, dmg: 35, push: 10 } }, { sreg: 4 }),
  sonico: F('sonico', 'Voz Sónica', '🔊', '#7dffb0', 2, '+8 % de velocidad; tus golpes empujan fuerte y a veces aturden con un chillido.',
    { spd: 1.08, push: 9, slow: [0.35, 1.2], fin: { k: 'sonico', r: 7, dmg: 45, push: 20 } }, { push: 4 }),
  flora: F('flora', 'Savia de Raíz', '🌱', '#b6ff2a', 6, 'Te curás (+2,2 vida/s), recibís −10 % de daño y tus golpes ENRAÍZAN (a veces dejan clavadas a las criaturas). Dejás raíces que frenan.',
    { regen: 2.2, dIn: 0.9, freeze: [0.25, 1.4], trail: { k: 'raiz', every: 1.1, r: 2, life: 5, slow: 0.5 }, fin: { k: 'raiz', r: 5.5, dmg: 30, freeze: 0.8, secs: 2.2 } }, { regen: 1 }),
  tiempo: F('tiempo', 'Hora Torcida', '⏳', '#ffcf4a', 1, 'Las criaturas a menos de 7 m van a la mitad de ritmo y tus habilidades se recargan 25 % más rápido. Recibís −5 % de daño.',
    { dIn: 0.95, aura: { r: 7, slow: 0.5 }, cdTick: 0.25, fin: { k: 'hora', r: 6.5, dmg: 40, freeze: 0.5, secs: 1.5 } }, { cdTick: 0.1 }),
  ceniza: F('ceniza', 'Manto de Ceniza', '🌑', '#8a8294', 1, 'Una nube de ceniza te sigue: las criaturas a menos de 6 m se ralentizan y se asfixian un poco. Recibís −10 % de daño.',
    { dIn: 0.9, aura: { r: 6, slow: 0.35, dps: 4 }, fin: { k: 'ceniza', r: 6, dmg: 35, daze: 2 } }, { dps: 3 }),
  cobre: F('cobre', 'Conductor de Cobre', '🔔', '#ff9a5a', 2, 'Recibís −15 % de daño, repartís un arco de chispas a 1 vecino y devolvés un 25 % del daño a los pegados a vos. Tu escudo vuelve más rápido.',
    { dIn: 0.85, thorns: 0.25, chain: [1, 0.5], sreg: 5, fin: { k: 'campana', r: 5.5, dmg: 50, push: 12 } }, { chain: 1 }),
  arcoiris: F('arcoiris', 'Prisma Vivo', '🌈', '#ff7ae6', 4, 'Un poquito de todo: +12 % de daño, +10 % de velocidad, vida que vuelve, chispas, fuego suave y disparos que atraviesan. Rara y brillante.',
    { dOut: 1.12, spd: 1.1, regen: 2, chain: [1, 0.5], slow: [0.5, 1.2], burn: [8, 3], pierce: true, fin: { k: 'arcoiris', r: 6.5, dmg: 55, slow: 2, burn: [10, 3] } }, { regen: 1 }),
  aurora: F('aurora', 'Aliento de Aurora', '🌅', '#7affc4', 3, 'Curación fuerte (+6 vida/s y +14 escudo/s) y −10 % de daño recibido. Un descanso ambulante.',
    { regen: 6, sreg: 14, dIn: 0.9, entra: { hp: 20 }, fin: { k: 'aurora', r: 6, dmg: 25, heal: 25 } }, { regen: 2 }),
};
export const FORMA_BASE_IDS = Object.keys(FORMAS);

/* ───────── HÍBRIDOS (12): comer dos formas compatibles seguidas ───────── */
// Cada híbrido mezcla los efectos de sus dos componentes (mezclar) y suma un toque propio (`sobre`). Nombre y color propios.
export const HIBRIDOS_DEF = [
  { a: 'hielo', b: 'electrica', id: 'ventisca', nombre: 'Ventisca Voltaica', icono: '🌨', color: '#a8f0ff', desc: 'Hielo + eléctrica: tus cadenas de rayo CONGELAN.', sobre: { chainFreeze: 0.25 } },
  { a: 'brasa', b: 'marea', id: 'vapor', nombre: 'Géiser de Vapor', icono: '♨', color: '#ffd0a0', desc: 'Brasa + marea: curás y quemás a la vez; el remate suelta vapor.', sobre: { regen: 1.5 } },
  { a: 'hielo', b: 'brasa', id: 'tibia', nombre: 'Niebla Tibia', icono: '☁', color: '#ffe6d0', desc: 'Hielo + brasa: un campo de vapor frena y quema a los cercanos. Sin la debilidad al fuego.', sobre: { aura: { r: 5, slow: 0.4, dps: 6 }, vulnAmbar: 1 } },
  { a: 'cristal', b: 'luz', id: 'prismatico', nombre: 'Prisma Cegador', icono: '🔆', color: '#fff0ff', desc: 'Cristal + luz: disparos que atraviesan y deslumbran, con coraza que refleja.', sobre: {} },
  { a: 'vacio', b: 'electrica', id: 'relampago_negro', nombre: 'Relámpago Negro', icono: '🌩', color: '#6a4dff', desc: 'Vacío + eléctrica: rayos que drenan vida.', sobre: { lifesteal: 0.04 } },
  { a: 'hueso', b: 'veneno', id: 'peste', nombre: 'Peste Ósea', icono: '☠', color: '#c8d890', desc: 'Hueso + veneno: espinas envenenadas; lo que te toca se pudre.', sobre: { poison: [12, 5] } },
  { a: 'hielo', b: 'cristal', id: 'glaciar', nombre: 'Glaciar Espejo', icono: '🧊', color: '#c8e8ff', desc: 'Hielo + cristal: la coraza más dura (−30 %) que refleja y congela.', sobre: { dIn: 0.9 } },
  { a: 'brasa', b: 'electrica', id: 'plasma', nombre: 'Plasma', icono: '☄', color: '#ffb040', desc: 'Brasa + eléctrica: cadenas de fuego rápidas.', sobre: { spd: 1.04 } },
  { a: 'sangre', b: 'vacio', id: 'carmesi', nombre: 'Eclipse Carmesí', icono: '🌘', color: '#c0204e', desc: 'Sangre + vacío: robás vida del doble y fasás al caer herido.', sobre: { lifesteal: 0.05 } },
  { a: 'humo', b: 'luz', id: 'espejismo', nombre: 'Espejismo', icono: '🪞', color: '#f0e4ff', desc: 'Humo + luz: casi invisible, y cuando te ven los deslumbrás.', sobre: {} },
  { a: 'flora', b: 'veneno', id: 'selva', nombre: 'Selva Tóxica', icono: '🌿', color: '#6aff60', desc: 'Flora + veneno: raíces que envenenan y una nube que te cura.', sobre: { regen: 1 } },
  { a: 'tiempo', b: 'eco', id: 'eco_tiempo', nombre: 'Eco del Tiempo', icono: '⌛', color: '#ffb0e0', desc: 'Tiempo + eco: tus golpes se repiten más y todo a tu alrededor va lento.', sobre: { eco: 0.15 } },
];
const NUM_MIN = { dIn: 0.6 }, NUM_MAX = { dOut: 1.15, spd: 1.3 };
/** Mezcla los efectos de dos formas en uno (híbridos). Los números multiplicativos se componen y se recortan para no romper el equilibrio. */
export function mezclar(A, B, sobre = {}) {
  const a = A.par, b = B.par, o = {};
  const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of claves) {
    const x = a[k], y = b[k];
    if (x === undefined || y === undefined) { o[k] = x !== undefined ? x : y; continue; }
    if (k === 'dIn' || k === 'dOut' || k === 'spd' || k === 'jump') o[k] = x * y;
    else if (k === 'regen' || k === 'sreg' || k === 'push' || k === 'reflect' || k === 'thorns' || k === 'lifesteal' || k === 'eco' || k === 'cdTick') o[k] = (x + y) * 0.85;
    else if (Array.isArray(x) && Array.isArray(y)) o[k] = [Math.max(x[0], y[0]), Math.max(x[1], y[1]), ...(x[2] !== undefined ? [Math.max(x[2], y[2] ?? 0)] : [])];
    else if (k === 'fin') o[k] = { ...y, ...x, dmg: Math.round(Math.max(x.dmg, y.dmg) * 1.1), r: Math.max(x.r, y.r) };
    else if (typeof x === 'boolean') o[k] = x || y;
    else o[k] = x;   // objetos (rastro, aura, nube, entra): manda la forma A
  }
  for (const [k, v] of Object.entries(sobre)) { o[k] = typeof v === 'number' && typeof o[k] === 'number' && (k === 'regen' || k === 'lifesteal' || k === 'eco' || k === 'thorns') ? o[k] + v : v; }
  for (const [k, v] of Object.entries(NUM_MIN)) if (o[k] !== undefined) o[k] = Math.max(v, o[k]);
  for (const [k, v] of Object.entries(NUM_MAX)) if (o[k] !== undefined) o[k] = Math.min(v, o[k]);
  return o;
}
export const HIBRIDOS = {};
for (const h of HIBRIDOS_DEF) {
  const A = FORMAS[h.a], B = FORMAS[h.b];
  HIBRIDOS[h.id] = { id: h.id, nombre: h.nombre, icono: h.icono, color: h.color, vis: A.vis, desc: h.desc, par: mezclar(A, B, h.sobre), extra: {}, hib: [h.a, h.b] };
}
/** Todas las formas (base + híbridas) por id. */
export const TODAS = { ...FORMAS, ...HIBRIDOS };
export const FORMA_IDS = Object.keys(TODAS);                       // el índice + 1 viaja en el snapshot (0 = sin forma)
export const formaIndice = (id) => (id ? FORMA_IDS.indexOf(id) + 1 : 0);
export const formaPorIndice = (i) => (i > 0 ? TODAS[FORMA_IDS[i - 1]] || null : null);
/** ¿Dos formas BASE forman un híbrido? Devuelve el id del híbrido o null (el orden no importa). */
export function hibridoDe(a, b) {
  for (const h of HIBRIDOS_DEF) if ((h.a === a && h.b === b) || (h.a === b && h.b === a)) return h.id;
  return null;
}

/* ───────── ESPECIES (20) ───────── */
// cuerpo: [alas, patas, cola, largo] (0…1,5) y mov: 0 repta/camina · 1 aletea · 2 salta · 3 nada (flota ondulando) · 4 corretea (araña). Lo lee el dibujo (fauna-fx.js).
const E = (o) => ({ peso: 1, dorm: 0.3, grupo: [1, 1], vuelo: 0, peligrosa: false, rara: false, atrae: null, cerca: null, ...o });
export const ESPECIES = {
  lagartija_hielo: E({ id: 'lagartija_hielo', nombre: 'Lagartija de Hielo', mapa: 'm1', forma: 'hielo', mov: 0, cuerpo: [0, 0.6, 1.3, 1.2], c1: '#8be9ff', c2: '#ffffff', tam: 0.55, vel: 3.0, corre: 8.5, alerta: 9, dur: 75, dorm: 0.45, cerca: 'corazon',
    folclore: 'Nació de una gota de la medusa-coral que se congeló antes de caer. Duerme al borde de las islas, quietita, y cuando se asusta deja un camino de escarcha.', frase: '¡Brrr! Te creció escarcha hasta en las pestañas.', pista: 'Dormida se deja acercar. Si despierta, arrinconala contra el borde de la isla.' }),
  polilla_vacio: E({ id: 'polilla_vacio', nombre: 'Polilla de Vacío', mapa: 'm1', forma: 'vacio', mov: 1, cuerpo: [1.3, 0.3, 0.4, 0.8], c1: '#6b3cff', c2: '#19f0ff', tam: 0.5, vel: 3.4, corre: 9, alerta: 11, dur: 70, grupo: [2, 4], vuelo: 2.6, atrae: 'negra',
    folclore: 'Las polillas del vacío se comen la luz de los faroles que no existen. Revolotean en la niebla negra, donde nadie las ve… salvo vos, que sos lo único que brilla.', frase: '¡Pof! Por un segundo no estabas del todo acá.', pista: 'Les gusta la niebla negra: esperalas en el borde y saltá desde arriba.' }),
  colibri_luz: E({ id: 'colibri_luz', nombre: 'Colibrí de Luz', mapa: 'm1', forma: 'luz', mov: 1, cuerpo: [0.9, 0.2, 0.9, 0.7], c1: '#fff2a8', c2: '#ff7ae6', tam: 0.4, vel: 3.8, corre: 11, alerta: 12, dur: 70, grupo: [1, 2], vuelo: 3.2, dorm: 0, atrae: 'cian', peso: 0.9,
    folclore: 'Es una Luz Mala que aprendió a volar de verdad. Se acerca a la niebla cian a beber su brillo; si lo asustás, sale disparado como una chispa.', frase: '¡Ping! Ahora brillás vos.', pista: 'Es el más rápido de la isla. Esperalo en la niebla cian, que lo atrae.' }),
  escarabajo_cristal: E({ id: 'escarabajo_cristal', nombre: 'Escarabajo de Cristal', mapa: 'm2', forma: 'cristal', mov: 0, cuerpo: [0.4, 0.8, 0.1, 0.9], c1: '#d9b8ff', c2: '#7affff', tam: 0.6, vel: 1.8, corre: 6, alerta: 7, dur: 80, dorm: 0.55, cerca: 'boca',
    folclore: 'En la Cámara Fractal todo se mira en todo: este escarabajo se mira tanto que se volvió espejo. Lo tallan los ecos y camina muy despacio, de tan pesado.', frase: '¡Clink! Te salió una coraza que refleja.', pista: 'Es lento y pesado: fácil de alcanzar, difícil de asustar.' }),
  arana_eco: E({ id: 'arana_eco', nombre: 'Araña de Seda de Eco', mapa: 'm2', forma: 'eco', mov: 4, cuerpo: [0, 1.3, 0.3, 0.6], c1: '#ff8cf0', c2: '#ffffff', tam: 0.65, vel: 2.6, corre: 7, alerta: 6, dur: 75, peligrosa: true, dorm: 0.15, peso: 0.7,
    folclore: 'Teje hilos de eco: lo que decís en la Cámara vuelve, y lo que pisás también. Si le pisás la tela, te muerde. Dicen que sabe a lo que dijiste ayer.', frase: '¡Ecoeco! Tus golpes ahora vuelven solos.', pista: 'PELIGROSA: muerde si te acercás sin cuidado. Atacala de lejos o comela rápido, dormida.' }),
  mariposa_electrica: E({ id: 'mariposa_electrica', nombre: 'Mariposa Eléctrica', mapa: 'm2', forma: 'electrica', mov: 1, cuerpo: [1.5, 0.2, 0.2, 0.6], c1: '#ffe14a', c2: '#3dd6ff', tam: 0.5, vel: 3.0, corre: 8.5, alerta: 10, dur: 65, grupo: [2, 4], vuelo: 3.0, dorm: 0, atrae: 'magenta',
    folclore: 'Vuela en bandadas de a cuatro y deja un chasquido en el aire. Le encantan las nieblas magenta, porque ahí los rayos se confunden con flores.', frase: '¡Zzzap! Se te paró hasta el pelo.', pista: 'Vuelan en grupo: si una huye, las otras la siguen. Elegí la más lenta.' }),
  rana_marea: E({ id: 'rana_marea', nombre: 'Rana de Marea', mapa: 'm3', forma: 'marea', mov: 2, cuerpo: [0, 1.0, 0.1, 0.9], c1: '#3dffd0', c2: '#2f63ff', tam: 0.65, vel: 2.4, corre: 8, alerta: 8, dur: 80, dorm: 0.4, cerca: 'boca',
    folclore: 'El Laberinto Celestial tiene su propia marea, y esta rana la lleva en la garganta. Croa en el círculo del Coro y, cuando salta, deja olitas en el aire.', frase: '¡Croac! Te corre una ola por adentro.', pista: 'Salta de a saltos largos: cortale el paso en un pasillo del laberinto.' }),
  pez_lunar: E({ id: 'pez_lunar', nombre: 'Pez Lunar', mapa: 'm3', forma: 'lunar', mov: 3, cuerpo: [0.7, 0, 1.2, 1.3], c1: '#bcd4ff', c2: '#ffffff', tam: 0.7, vel: 2.0, corre: 6, alerta: 9, dur: 85, grupo: [2, 4], vuelo: 2.2, atrae: 'blanca',
    folclore: 'Nada por el aire del laberinto como si fuera agua. Dicen que la Luna se le cae a pedazos cada noche y él los junta. Se junta con los suyos en el Silbido Blanco.', frase: '¡Blup! Pesás la mitad y el doble de bien.', pista: 'Nada lento y en cardumen. Acercate desde abajo, que no mira para ahí.' }),
  grillo_silbador: E({ id: 'grillo_silbador', nombre: 'Grillo Silbador', mapa: 'm3', forma: 'sonico', mov: 2, cuerpo: [0.3, 1.2, 0.1, 0.8], c1: '#7dffb0', c2: '#e8fbff', tam: 0.45, vel: 2.2, corre: 9, alerta: 10, dur: 65, cerca: 'corazon', peso: 0.9,
    folclore: 'El Silbón dejó su silbido en la Garganta y este grillo lo encontró. Si cantás cerca de la Siringe te contesta, y entonces es hora de caerle encima.', frase: '¡Iiiiii! Tu voz ahora empuja paredes.', pista: 'Chilla antes de huir: es tu aviso. Cuando se calla, saltale.' }),
  sapo_venenoso: E({ id: 'sapo_venenoso', nombre: 'Sapo Venenoso', mapa: 'm4', forma: 'veneno', mov: 2, cuerpo: [0, 0.9, 0.1, 1.1], c1: '#9dff2a', c2: '#ff2f5e', tam: 0.8, vel: 1.8, corre: 6, alerta: 5, dur: 80, peligrosa: true, dorm: 0.25, atrae: 'acida', peso: 0.8,
    folclore: 'Vive en las esporas agrias del Jardín de Carne. Es dulce de ver y amargo de pisar: si lo pisás, te muerde, y si lo comés… te vuelve venenoso a vos.', frase: '¡Blargh! Ahora el venenoso sos vos.', pista: 'PELIGROSO: muerde si lo pisás. Comelo dormido o con la boca del Melé.' }),
  sanguijuela_rubi: E({ id: 'sanguijuela_rubi', nombre: 'Sanguijuela de Rubí', mapa: 'm4', forma: 'sangre', mov: 0, cuerpo: [0, 0, 1.1, 1.6], c1: '#ff2f5e', c2: '#ffb0c0', tam: 0.55, vel: 1.4, corre: 4.5, alerta: 6, dur: 70, dorm: 0.6, cerca: 'corazon',
    folclore: 'Se cuelga de las raíces que laten y bebe lo que sobra del Corazón del Jardín. Brilla como un rubí húmedo. Es muy lenta, pero te va a querer tanto como vos a ella.', frase: '¡Glup! Ahora el daño te alimenta.', pista: 'Muy lenta: es la más fácil del Jardín. Buscala cerca del Corazón.' }),
  caracol_raiz: E({ id: 'caracol_raiz', nombre: 'Caracol de Raíz', mapa: 'm4', forma: 'flora', mov: 0, cuerpo: [0, 0, 0.5, 1.0], c1: '#b6ff2a', c2: '#ff9ad5', tam: 0.6, vel: 1.0, corre: 3.5, alerta: 5, dur: 85, dorm: 0.5, cerca: 'pulmon',
    folclore: 'Carga una casa de raíces en la espalda y de ella brotan florcitas. Come esporas sanas, así que lo encontrás pastando junto al Pulmón del Jardín.', frase: '¡Ñam! Te salieron raíces en los talones.', pista: 'El más lento de todos. Paciencia: no hay que correr.' }),
  cucaracha_relojera: E({ id: 'cucaracha_relojera', nombre: 'Cucaracha Relojera', mapa: 'm5', forma: 'tiempo', mov: 4, cuerpo: [0.4, 1.0, 0.1, 0.8], c1: '#ffcf4a', c2: '#2f63ff', tam: 0.5, vel: 3.4, corre: 10, alerta: 8, dur: 75, cerca: 'raiz',
    folclore: 'El relojero juró que el reloj no pararía y, para cumplirlo, soltó cucarachas con engranajes adentro. Hacen tic-tac al caminar y escapan siempre hacia la hora siguiente.', frase: '¡Tic, tac! Todo va un poquito más lento menos vos.', pista: 'Rápida y escurridiza. Las coberturas de la Plaza ayudan a cerrarle el paso.' }),
  paloma_humo: E({ id: 'paloma_humo', nombre: 'Paloma de Humo', mapa: 'm5', forma: 'humo', mov: 1, cuerpo: [1.1, 0.2, 0.7, 1.0], c1: '#c9c4d8', c2: '#ffb6e8', tam: 0.6, vel: 3.0, corre: 8, alerta: 11, dur: 70, grupo: [2, 3], vuelo: 3.4, atrae: 'blanca',
    folclore: 'Las palomas de la Plaza de los Ecos se apagaron con la ciudad y quedaron de humo. Se juntan en la bruma de la plaza y se vuelven invisibles contra el cielo.', frase: '¡Puf! Nadie te ve y todos te buscan.', pista: 'Se esconden en la bruma blanca. Esperalas cerca de los soportales.' }),
  gorrion_cobre: E({ id: 'gorrion_cobre', nombre: 'Gorrión de Cobre', mapa: 'm5', forma: 'cobre', mov: 1, cuerpo: [0.8, 0.25, 0.5, 0.7], c1: '#ff9a5a', c2: '#ffe0a0', tam: 0.38, vel: 3.2, corre: 11, alerta: 12, dur: 65, vuelo: 2.4, dorm: 0.1, atrae: 'ambar', peso: 0.9,
    folclore: 'Pía como una campanita oxidada. Se posa en los faroles de la Hora de Oro y calienta el cobre con las patitas. Lo único que no sabe es dormir.', frase: '¡Tin! Sonás como una campana y pegás como una.', pista: 'Muy rápido. Mejor atraparlo de noche (eclipse) cuando se queda quieto.' }),
  salamandra_brasa: E({ id: 'salamandra_brasa', nombre: 'Salamandra de Brasa', mapa: 'm6', forma: 'brasa', mov: 0, cuerpo: [0, 0.7, 1.4, 1.3], c1: '#ff6a14', c2: '#ffe14a', tam: 0.6, vel: 2.8, corre: 8.5, alerta: 8, dur: 75, dorm: 0.5, cerca: 'pulmon', atrae: 'ambar',
    folclore: 'Vive en la grieta que respira del Osario, entre las brasas que no se apagan. Es lo único cálido de la nave. Los huesos la usan para calentarse de noche.', frase: '¡Ssss! Se te prendió el cuerpo (pero lindo).', pista: 'Duerme pegada al Respiradero. Cuidado: dormida es fácil, despierta quema el aire.' }),
  ciempies_hueso: E({ id: 'ciempies_hueso', nombre: 'Ciempiés de Hueso', mapa: 'm6', forma: 'hueso', mov: 4, cuerpo: [0, 1.0, 0.6, 1.5], c1: '#efe6c8', c2: '#ff6a14', tam: 0.8, vel: 2.4, corre: 7.5, alerta: 6, dur: 85, peligrosa: true, dorm: 0.35, cerca: 'corazon', peso: 0.8,
    folclore: 'Hecho con vértebras sobrantes del osario. Se arma solo cuando alguien se queda quieto, y le encantan los pies quietos. Su mordisco cierra con un «crac».', frase: '¡Crac! Te forraste de huesos.', pista: 'PELIGROSO: muerde si lo pisás. Es largo: atacalo por la cola, que es lo más lento.' }),
  murcielago_ceniza: E({ id: 'murcielago_ceniza', nombre: 'Murciélago de Ceniza', mapa: 'm6', forma: 'ceniza', mov: 1, cuerpo: [1.4, 0.3, 0.2, 0.7], c1: '#8a8294', c2: '#ff6a14', tam: 0.55, vel: 3.0, corre: 9, alerta: 11, dur: 70, grupo: [2, 3], vuelo: 3.0, dorm: 0.2, atrae: 'negra',
    folclore: 'Se deshace en ceniza cuando muere y se vuelve a armar al amanecer. Cuelga de la bóveda que se cayó hacia arriba. Cuando huye deja un velo gris atrás.', frase: '¡Pff! Una nube gris camina con vos.', pista: 'Cuelga en grupo. Cuando uno huye, mirá hacia arriba y buscá al que queda.' }),
  mariposa_prisma: E({ id: 'mariposa_prisma', nombre: 'Mariposa Prisma', mapa: '*', forma: 'arcoiris', mov: 1, cuerpo: [1.6, 0.2, 0.3, 0.7], c1: '#ff7ae6', c2: '#7affff', tam: 0.55, vel: 3.6, corre: 10, alerta: 14, dur: 90, vuelo: 3.6, dorm: 0, rara: true,
    folclore: 'RARA. Dicen que sale de la rendija entre dos arenas y que cada arena le deja un color en las alas. Pocos Huéspedes la vieron; ninguno la vio dos veces seguidas.', frase: '¡Brillo! Un poquito de todos los colores.', pista: 'Muy rara y muy veloz. Aparece en el respiro y se queda un buen rato: no la pierdas de vista.' }),
  axolotl_aurora: E({ id: 'axolotl_aurora', nombre: 'Axolotl de Aurora', mapa: '*', forma: 'aurora', mov: 0, cuerpo: [0.6, 0.6, 1.1, 1.3], c1: '#7affc4', c2: '#ff9ae6', tam: 0.6, vel: 1.6, corre: 6, alerta: 7, dur: 90, dorm: 0.7, rara: true,
    folclore: 'RARO. Vive donde cae la luz de la Aurora Bendita y regenera todo lo que pierde, incluso la timidez. Sonríe siempre, hasta cuando lo comés.', frase: '¡Ahhh! Un descanso ambulante.', pista: 'Casi siempre duerme y es lento. Si ves un brillo verde-rosa, andá despacio.' }),
};
export const ESPECIE_IDS = Object.keys(ESPECIES);
export const especieIndice = (id) => ESPECIE_IDS.indexOf(id);
export const especiePorIndice = (i) => ESPECIES[ESPECIE_IDS[i]] || null;
/** Especies que viven en un mapa (las 3 temáticas; las raras `*` no cuentan). */
export const especiesDe = (mapa) => ESPECIE_IDS.filter((id) => ESPECIES[id].mapa === mapa);
export const RARAS = ESPECIE_IDS.filter((id) => ESPECIES[id].rara);

/* ───────── CÓDICE DE FAUNA (perfil): hitos por especie ───────── */
/** Hitos de cada especie (cuántas veces comida): 1 descubierta · 5 +5 s · 10 +20 % de duración · 25 efecto extra · 50 +10 s y mitad de residuo perdido. */
export const HITOS = [
  { n: 1, txt: 'Descubierta: entra al Códice y te da 1 ADN.' },
  { n: 5, txt: '+5 s de duración de su forma.' },
  { n: 10, txt: '+20 % de duración de su forma.' },
  { n: 25, txt: 'Efecto extra permanente en su forma.' },
  { n: 50, txt: '+10 s más y su residuo dura el doble.' },
];
/** Bonos permanentes que da el contador de una especie. */
export function bonoCodice(n) {
  n = Math.max(0, Math.floor(n) || 0);
  return { descubierta: n >= 1, durMas: (n >= 5 ? 5 : 0) + (n >= 50 ? 10 : 0), durK: n >= 10 ? 1.2 : 1, extra: n >= 25, residuoK: n >= 50 ? 2 : 1 };
}
/** Próximo hito que falta para un contador (o null si ya los tiene todos). */
export const proximoHito = (n) => HITOS.find((h) => h.n > n) || null;
/** Parámetros efectivos de una forma con el efecto extra (hito 25) aplicado: suma el delta al número (o al primer elemento si es una lista). */
export function parConExtra(forma, extra) {
  if (!extra || !forma.extra) return forma.par;
  const o = { ...forma.par };
  for (const [k, d] of Object.entries(forma.extra)) {
    if (k === 'phase' && Array.isArray(o.phase)) o.phase = [Math.max(2, o.phase[0] + d), o.phase[1]];
    else if (k === 'chain' && Array.isArray(o.chain)) o.chain = [o.chain[0] + d, o.chain[1]];
    else if (k === 'dps' && o.aura) o.aura = { ...o.aura, dps: (o.aura.dps || 0) + d };
    else if (Array.isArray(o[k])) o[k] = [o[k][0] + d, ...o[k].slice(1)];
    else if (typeof o[k] === 'number') o[k] = o[k] + d;
    else if (o[k] === undefined && typeof d === 'number') o[k] = d;
  }
  return o;
}
/** Códice de un perfil: { c: {especie: n}, adn: {forma: n}, hib: [híbridos probados], tot: total comidas }. Sanea cualquier cosa que venga del guardado. */
export function limpiarFauna(f) {
  const o = f && typeof f === 'object' ? f : {}, c = {}, adn = {}, nn = (v, m) => Math.max(0, Math.min(m, Math.floor(Number(v) || 0)));
  for (const id of ESPECIE_IDS) { const n = nn(o.c && o.c[id], 99999); if (n) c[id] = n; }
  for (const id of FORMA_BASE_IDS) { const n = nn(o.adn && o.adn[id], 99999); if (n) adn[id] = n; }
  const hib = Array.isArray(o.hib) ? [...new Set(o.hib.filter((h) => HIBRIDOS[h]))] : [];
  return { c, adn, hib, tot: Object.values(c).reduce((a, b) => a + b, 0) };
}
/** Anota que se comió una especie (y, si hubo híbrido, cuál). Devuelve { nuevo, hitos:[n…], f }. No guarda nada: quien llama guarda. */
export function registrarComida(f, esp, hibrido = null) {
  const sp = ESPECIES[esp]; if (!sp) return { nuevo: false, hitos: [] };
  const antes = f.c[esp] || 0, n = Math.min(99999, antes + 1);
  f.c[esp] = n; f.adn[sp.forma] = Math.min(99999, (f.adn[sp.forma] || 0) + 1); f.tot = Object.values(f.c).reduce((a, b) => a + b, 0);
  if (hibrido && HIBRIDOS[hibrido] && !f.hib.includes(hibrido)) f.hib.push(hibrido);
  return { nuevo: antes === 0, hitos: HITOS.filter((h) => antes < h.n && n >= h.n).map((h) => h.n), n };
}
/** Lo que viaja a la simulación al empezar una partida: { especie: n } (sólo para duración y efectos extra). */
export const faunaParaPartida = (f) => ({ ...(f && f.c ? f.c : {}) });
/** Recorta lo que llega por la red (servidor): solo especies conocidas y números sanos. */
export function faunaDeRed(c) {
  const o = {}; if (!c || typeof c !== 'object') return o;
  for (const id of ESPECIE_IDS) { const n = Math.max(0, Math.min(99999, Math.floor(Number(c[id]) || 0))); if (n) o[id] = n; }
  return o;
}
