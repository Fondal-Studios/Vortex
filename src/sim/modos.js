// MODOS DE COMBATE EN PARTIDA: Disparo ↔ Melé (docs/CONTROLES.md → «Tabla Huésped × modo × slot»). Datos puros y deterministas: sin DOM, sin azar.
//
// Internamente «Disparo» es el modo 'shooter' y «Melé» es el modo 'combo' (src/sim/combos.js); sólo cambian los nombres que ve el jugador.
// Los TRES botones de habilidad (HAB.1, HAB.2, HAB.3) existen en los dos modos y se piden SIEMPRE con las mismas teclas: la entrada de la
// simulación sigue llamándose `mov` (HAB.1), `esp` (HAB.2) y `s3` (HAB.3). Lo que cambia es QUÉ habilidad dispara cada slot:
//   · Disparo: HAB.1 = mov, HAB.2 = esp, HAB.3 = s3 (las de siempre, data.js → CHARACTERS).
//   · Melé:    HAB.1 = mov, HAB.2 = esp, HAB.3 = la habilidad PRINCIPAL de Combo (data.js → HABILIDADES).
//     Cuando la principal de Combo repite lo que ya hace la esp (Danzante, Singular, Colmena), el slot 2 pasa a ser la s3 de Disparo
//     (así no hay dos botones que hagan casi lo mismo) y la s3 queda en el slot 2.
// Balance: en Melé el estilo Combo multiplica ×1,5 las habilidades (pensado para la principal, que enfría 9–22 s). Para que HAB.1 y HAB.2 no
// vuelvan a sumar ese bono, pegan × MODO_K (0,67 ⇒ ×1,0 efectivo, igual que en Disparo). Se aplica en huespedes.js → hostOut.
import { CHARACTERS, HABILIDADES } from './data.js';

export const MODOS = {
  shooter: { id: 'disparo', nombre: 'Disparo', icono: '⌖', corto: 'DISPARO' },
  combo:   { id: 'mele',    nombre: 'Melé',    icono: '⚔', corto: 'MELÉ' },
};
export const MODO_ESPERA = 0.6;   // s entre un cambio de modo y el siguiente (lo respeta el cliente; la simulación acepta el cambio al instante)
export const MODO_K = 0.67;

/** Qué habilidad dispara cada slot (1, 2, 3) en Melé. 'mov' | 'esp' | 's3' = las de Disparo · 'hab' = la principal de Combo. */
export const SLOTS_MELE = {
  axioma:   ['mov', 'esp', 'hab'],
  vesper:   ['mov', 'esp', 'hab'],
  micelio:  ['mov', 'esp', 'hab'],
  umbra:    ['mov', 'esp', 'hab'],
  seraf:    ['mov', 'esp', 'hab'],
  colmena:  ['mov', 's3', 'hab'],    // Llamado del enjambre repite «Criar enjambre» (esp): el slot 2 es el Nido-torreta
  danzante: ['mov', 's3', 'hab'],    // Contrapaso repite la Parada perfecta (esp): el slot 2 es el Lazo de cintas
  singular: ['mov', 's3', 'hab'],    // Colapso gravitatorio repite el Pozo (esp): el slot 2 es el Reflujo de marea
};
const SLOTS_DISPARO = ['mov', 'esp', 's3'];

/** Fuente de cada slot ('mov' | 'esp' | 's3' | 'hab') para un Huésped en un modo ('shooter' | 'combo'). */
export function fuentes(char, modo) {
  if (modo !== 'combo') return SLOTS_DISPARO;
  return SLOTS_MELE[char] || ['mov', 'esp', 'hab'];
}

/** Las 3 habilidades de un slot con nombre, enfriamiento y descripción: [{ slot, src, id, name, cd, desc }]. */
export function habSlots(char, modo) {
  const C = CHARACTERS[char]; if (!C) return [];
  return fuentes(char, modo).map((src, i) => {
    const d = src === 'hab' ? HABILIDADES[char] : C[src];
    return { slot: i + 1, src, id: d ? d.id : '', name: d ? d.name : `Habilidad ${i + 1}`, cd: d ? d.cd : 0, desc: d ? d.desc : '' };
  });
}

/**
 * Traduce la entrada de los 3 slots a las acciones internas de la simulación según el modo del jugador.
 * Recibe los tres pedidos (`mov` = HAB.1, `esp` = HAB.2, `s3` = HAB.3) y devuelve { mov, esp, s3, hab }.
 * En Disparo es la identidad (hab = el pedido directo de `hab`, que sólo usan bots y pruebas de Combo).
 */
export function enrutar(char, modo, pedido, habDirecto = false) {
  const out = { mov: false, esp: false, s3: false, hab: !!habDirecto };
  const src = fuentes(char, modo), v = [!!pedido.mov, !!pedido.esp, !!pedido.s3];
  for (let i = 0; i < 3; i++) if (v[i]) out[src[i]] = true;
  return out;
}
