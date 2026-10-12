import * as THREE from 'three';

// Uniformes compartidos del Mapa 4 (Jardín de Carne). Los escribe el cliente cada cuadro (cámara, latido) y los objetos del
// acertijo (tramos del puente, comida de los capullos); los leen los shaders de env/map4.js. Cero objetos nuevos por cuadro.
export const M4U = {
  uPlayer: { value: new THREE.Vector3(0, -999, 0) },   // dónde está el jugador (la vegetación se retrae / brilla cerca)
  uBeat: { value: 0 },                                  // latido del Corazón 0..1 (doble golpe cada ~1,2 s)
  uSecN: { value: new THREE.Vector3(0, 0, 0) },         // discos crecidos de cada tramo del puente (fracción * cantidad)
  uFeed: { value: 0 },                                  // progreso global del cultivo 0..1 (el puente «fantasma» brilla más)
};
export function beatAt(t) { const a = Math.max(0, Math.sin(t * 5.2)), b = Math.max(0, Math.sin(t * 5.2 - 1.15)); return Math.min(1, a ** 10 * 0.9 + b ** 10 * 0.55); }
