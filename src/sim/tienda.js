// TIENDA del Cambista (docs/TIENDA.md): catálogo, precios fijos y rotación del stock. Lógica PURA: no toca el navegador ni el perfil.
// Las compras reales (las que gastan núcleos y cambian el perfil) viven en src/client/tienda.js y usan estas funciones para decidir.
//   · precios fijos acá (anti-trampas simples: la pantalla no inventa ningún precio) · stock rotativo determinista por día + partidas
//   · moneda: núcleos (`perfil.cores`); las esencias (`perfil.ess`) sólo se cambian
import { CHARACTERS, HOST_IDS } from './data.js';
import { ITEMS, ITEM_IDS, PLANOS, MATERIAL_IDS, MATERIALS, RARITIES, CALIDADES } from './items.js';
import { rangoDeXp } from './maestria.js';

export const CAMBISTA = {
  nombre: 'El Cambista de Almas',   // el mismo mercader que aparece en las partidas (src/sim/npcs.js)
  titulo: 'Mercader del Vórtice',
  saludo: 'Todo se cambia. Hasta lo que ya no tenés. Pasá, pasá: en VORTEX se paga con núcleos, y yo prefiero núcleos.',
  frases: {
    comprado: ['Hecho. Que te rinda.', 'Trato cerrado. No se devuelve, ni en esta vida ni en la otra.', 'Buena elección. Casi siempre las hacés buenas.', 'Eso ya es tuyo. Cuidalo.'],
    pobre: ['Con ese bolsillo no se compra ni una sombra. Volvé con más núcleos.', 'Faltan núcleos. Los muertos no fían.'],
    requisito: ['Esa puerta todavía no se abre para vos. Falta algo.', 'Primero ganate el derecho; después hablamos de precio.'],
    vendido: ['Lo tomo. Siempre hay alguien que lo necesita más que vos.', 'Vendido. Poco, pero limpio.'],
    nada: ['No tengo nada que comprarte. Volvé con botín.'],
  },
};
/** Frase del Cambista según lo que pasó; `n` hace que la elección sea estable y no al azar. */
export const frase = (tipo, n = 0) => { const L = CAMBISTA.frases[tipo] || CAMBISTA.frases.comprado; return L[Math.abs(n | 0) % L.length]; };

/* ───────── Huéspedes ───────── */
/** ¿Es un Huésped que viene en el kit inicial? (los que no dicen `starter:false`). */
export const esInicial = (id) => !!(CHARACTERS[id] && CHARACTERS[id].host && CHARACTERS[id].starter !== false);
export const HUESPEDES_INICIALES = HOST_IDS.filter(esInicial);
/** Huéspedes que se compran en la tienda, en el orden de los datos. */
export const HUESPEDES_TIENDA = HOST_IDS.filter((id) => !esInicial(id) && CHARACTERS[id] && CHARACTERS[id].unlock);
export const precioHuesped = (id) => (CHARACTERS[id] && CHARACTERS[id].unlock && Math.max(1, Math.floor(CHARACTERS[id].unlock.precio)) ) || 0;
/** Huéspedes que ya usabas antes de la tienda: si hay rastro de uso en el perfil (maestría, evolución, camino, árbol) o es el elegido, siguen siendo tuyos. */
export function migrarHuespedes(o, elegido = null) {
  const out = new Set(); const src = o && typeof o === 'object' ? o : {};
  if (Array.isArray(src.huespedes)) { for (const id of src.huespedes) if (HUESPEDES_TIENDA.includes(id)) out.add(id); return [...out]; }
  for (const id of HUESPEDES_TIENDA) {
    const m = src.mae && src.mae[id], arb = src.arb && src.arb[id];
    const usado = (m && (m.xp > 0 || m.partidas > 0)) || (src.evo && src.evo[id] > 0) || (src.path && Array.isArray(src.path[id]) && src.path[id].length) || (arb && ['combo', 'disparo'].some((k) => arb[k] && ((arb[k].pc | 0) > 0 || (arb[k].nodos || []).length)));
    if (usado || elegido === id) out.add(id);
  }
  return [...out];
}
/** ¿Este perfil (objeto plano con `huespedes`) posee al Huésped? Los iniciales siempre; los veteranos (no Huéspedes) no se compran. */
export const poseeHuesped = (p, id) => !!CHARACTERS[id] && (!CHARACTERS[id].host || esInicial(id) || (p && Array.isArray(p.huespedes) && p.huespedes.includes(id)));
/** Rango de maestría más alto que tenés con un Huésped distinto de `excepto` (0 si ninguno). */
export function mejorRango(p, excepto = null) {
  let r = 0; const mae = (p && p.mae) || {};
  for (const id of HOST_IDS) if (id !== excepto && mae[id]) r = Math.max(r, rangoDeXp(mae[id].xp));
  return r;
}
/** Requisito de un Huésped: { ok, texto } (texto vacío si no hay requisito). */
export function reqHuesped(p, id) {
  const q = CHARACTERS[id] && CHARACTERS[id].unlock && CHARACTERS[id].unlock.req; if (!q) return { ok: true, texto: '' };
  const ok = q.rango ? mejorRango(p, id) >= q.rango : true;
  return { ok, texto: q.texto || (q.rango ? `Rango ${q.rango} de maestría con otro Huésped.` : '') };
}
/** Estado de un Huésped en la tienda: 'poseido' · 'comprable' · 'sin nucleos' · 'falta requisito'. */
export function estadoHuesped(p, id) {
  if (poseeHuesped(p, id)) return 'poseido';
  if (!reqHuesped(p, id).ok) return 'falta requisito';
  return (p.cores | 0) >= precioHuesped(id) ? 'comprable' : 'sin nucleos';
}

/* ───────── precios de materiales, planos y objetos ───────── */
const FACTOR_MAT = { hueso: 1, quitina: 1, raiz: 1, carne: 1, espora: 1.1, cristal: 1.25, vacio: 1.5 };
const BASE_CAL = [3, 9, 24, 60];
/** Precio de UNA unidad de material (por calidad 0..3). */
export const precioMat = (mat, cal) => Math.max(1, Math.round((BASE_CAL[cal] || 3) * (FACTOR_MAT[mat] || 1)));
/** Lo que paga el Cambista por una unidad: el 35 % (nunca comprás y vendés para ganar). */
export const ventaMat = (mat, cal) => Math.max(1, Math.floor(precioMat(mat, cal) * 0.35));
const BASE_PLANO = [0, 90, 240, 560];
export const precioPlano = (id) => (PLANOS[id] ? BASE_PLANO[ITEMS[id].r] || 0 : 0);
const BASE_OBJ = [30, 110, 320, 800];
/** Precio de un objeto terminado según su rareza y su tirada q (0..1). */
export const precioObjeto = (id, q = 0.5) => Math.max(1, Math.round(BASE_OBJ[ITEMS[id].r] * (0.9 + 0.3 * Math.max(0, Math.min(1, q)))));
export const conDescuento = (precio, desc) => Math.max(1, Math.round(precio * (1 - Math.max(0, Math.min(60, desc | 0)) / 100)));

/* ───────── servicios ───────── */
export const SERVICIOS = {
  botiquin: { id: 'botiquin', nombre: 'Botiquín inicial', precio: 35, max: 5, desc: 'Entrás a la próxima partida con una segunda oportunidad: la primera vez que caigas, te levantás con la mitad de la vida y el escudo lleno. Se gasta uno por partida en solitario.' },
  reinicio: { id: 'reinicio', nombre: 'Reinicio de nodos del árbol', precio: 80, desc: 'Devuelve TODOS los puntos gastados de un árbol (Shooter o Combo) de un Huésped, sin el 25 % de pérdida que cobra el reinicio normal.' },
  reroll: { id: 'reroll', nombre: 'Retirada de la tirada (Forja)', base: 25, porRareza: 35, desc: 'Una pieza de tu inventario vuelve a tirar sus rasgos: cambia su calidad (puede mejorar o empeorar). Determinista: no sirve recargar la página para repetir.' },
  esencia: { id: 'esencia', nombre: 'Cambio de esencias', compra: 14, venta: 4, desc: 'Comprá una esencia por núcleos (para órganos) o vendé las que te sobren.' },
};
export const precioReroll = (rareza) => SERVICIOS.reroll.base + SERVICIOS.reroll.porRareza * (rareza | 0);
export const ESENCIAS_IDS = ['carne', 'cristal', 'ojo', 'vacio'];

/* ───────── rotación del stock ───────── */
/** Día (UTC) como número entero: el stock cambia a medianoche UTC. */
export const diaDe = (ahora = Date.now()) => Math.floor(ahora / 86400000);
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const elegir = (r, pesos) => { const t = pesos.reduce((a, b) => a + b, 0); let x = r() * t; for (let i = 0; i < pesos.length; i++) { x -= pesos[i]; if (x < 0) return i; } return pesos.length - 1; };
const DESCUENTOS = [0, 0, 0, 10, 15, 20];
const PLANOS_VENDIBLES = ITEM_IDS.filter((id) => !ITEMS[id].host && ITEMS[id].r >= 1);
const OBJETOS_VENDIBLES = ITEM_IDS.filter((id) => !ITEMS[id].host && ITEMS[id].r <= 1);

/** Clave de una oferta: cambia con el día y con cada partida terminada (`rot`). */
export const claveOferta = (dia, rot = 0) => `${dia | 0}:${rot | 0}`;
/** Stock de la tienda para un día y un contador de partidas: SIEMPRE el mismo para los mismos números.
 *  { clave, materiales[4], planos[2], objetos[3] }; cada renglón: { k (id estable), …, base (precio sin descuento), desc (%), precio }. */
export function oferta(dia, rot = 0) {
  const clave = claveOferta(dia, rot), r = rng(hash('tienda|' + clave));
  const materiales = [], planos = [], objetos = [];
  for (let i = 0; i < 4; i++) {
    const mat = MATERIAL_IDS[Math.floor(r() * MATERIAL_IDS.length)], cal = elegir(r, [34, 34, 24, 8]), n = [[5, 8], [4, 6], [2, 4], [1, 2]][cal], cant = n[0] + Math.floor(r() * (n[1] - n[0] + 1));
    const desc = DESCUENTOS[Math.floor(r() * DESCUENTOS.length)], base = precioMat(mat, cal) * cant;
    materiales.push({ k: 'm' + i, mat, cal, n: cant, base, desc, precio: conDescuento(base, desc) });
  }
  for (let i = 0; i < 2; i++) {
    let id; const rar = [1, 2, 3][elegir(r, [60, 32, 8])];
    const pool = PLANOS_VENDIBLES.filter((x) => ITEMS[x].r === rar && !planos.some((p) => p.id === x));
    id = pool[Math.floor(r() * pool.length)]; if (!id) { id = PLANOS_VENDIBLES.find((x) => !planos.some((p) => p.id === x)); }
    const desc = DESCUENTOS[Math.floor(r() * DESCUENTOS.length)], base = precioPlano(id);
    planos.push({ k: 'p' + i, id, desc, base, precio: conDescuento(base, desc) });
  }
  for (let i = 0; i < 3; i++) {
    const rar = elegir(r, [55, 45]), pool = OBJETOS_VENDIBLES.filter((x) => ITEMS[x].r === rar && !objetos.some((o) => o.id === x));
    const id = pool[Math.floor(r() * pool.length)] || OBJETOS_VENDIBLES.find((x) => !objetos.some((o) => o.id === x)), q = Math.round((0.35 + 0.45 * r()) * 100) / 100;
    const desc = DESCUENTOS[Math.floor(r() * DESCUENTOS.length)], base = precioObjeto(id, q);
    objetos.push({ k: 'o' + i, id, q, desc, base, precio: conDescuento(base, desc) });
  }
  // «oferta del día»: un renglón al azar baja al menos 25 %
  const todos = [...materiales, ...planos, ...objetos], esp = todos[Math.floor(r() * todos.length)]; esp.desc = Math.max(esp.desc, 25); esp.precio = conDescuento(esp.base, esp.desc); esp.especial = true;
  return { clave, materiales, planos, objetos };
}
export const textoMat = (m) => `${m.n}× ${MATERIALS[m.mat].name} ${CALIDADES[m.cal]}`;
export const nombreRareza = (id) => RARITIES[ITEMS[id].r].name;
