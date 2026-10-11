// ADAPTADO de arcanum/src/npc/locomotion.js: sólo la tabla de velocidades (el resto —seguir rutas— no hace falta aquí:
// en Cristal Vórtice el servidor decide dónde está cada jugador).
// m/s de cada ciclo a timeScale 1 con el rig a escala 1 (evita que los pies patinen).
export const CLIP_SPEED = { walk: 1.04, walkFormal: 1.0, jog: 4.2, sprint: 6.0, crouchWalk: 1.2 };
