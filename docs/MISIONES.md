# Misiones declarativas y finitas (Sprint 1-A)

Cada misión (las seis de la campaña y sus versiones independientes y cooperativas) se define en **`src/sim/mision-config.js`**. Nada es infinito.

## Qué declara cada misión
- **Oleadas «X/Y»**: 8 por capítulo (`stages`). Tipos: `combate`, `caza`, `mecanismo` (reconexión, sintonía, núcleo, cultivo), `defensa` (ancla), `cronometrada` (resistir 90 s), `evento` (anomalía ambiental forzada) y `jefe` (siempre la última).
- Por oleada: `plan` (fila de `WAVE_PLANS` del mapa: ya se usan las seis), `tier` (intensidad: presupuesto y vida de las criaturas), `span` (en cuántos segundos se reparte la oleada), `budget`, `cap`, `reward` y `bonus` (misión secundaria opcional).
- **Jefe final** (`boss`): el cuerpo (`coloso`, `argos`, `madre`; los mismos con fases e IA adaptativa de `jefe-*.js`), con enfurecimiento en `enrageT` (90 s; +30 s por jugador extra).
- `duracion` objetivo, `victoria` y `derrota` (texto), `limites` y `descanso`.

| Capítulo | Arena | Jefe |
|---|---|---|
| 1 · Islas — Despertar (m1) | Vacío de Islas | El Coloso |
| 2 · Apagar los ojos (m3) | Laberinto Celestial | Argos |
| 3 · El camino que respira (m4) | Jardín de Carne | Argos, el Ojo Primordial |
| 4 · Voces de la plaza (m5) | Plaza de los Ecos | Mandinga del Reloj |
| 5 · El vínculo del Osario (m6) | Osario sin Techo | El Basilisco |
| 6 · La última transferencia (m2) | Cámara Fractal | La Madre Geoda |

## Límites duros (en segundos de simulación)
| Qué | Tope | Qué pasa al agotarse |
|---|---|---|
| Objetivo de una oleada | 110–260 s (`OBJECTIVE_INFO.limit`) | Derrota: «Se agotó el tiempo del objetivo» |
| Oleada de combate/evento | 150 s | La red se repliega (se desintegra a los rezagados) y se sigue |
| Encuentro final | 450 s (+60 s por jugador extra) | Derrota: «Tiempo agotado: el encuentro final…» |
| Misión completa | 1500 s (25 min) | Derrota: «Tiempo agotado: la misión superó el límite…» |
| Elegir mejora en solitario | 20 s | La mejora se elige sola (un jugador AFK no congela la partida) |

El jefe enfurecido (desde `enrageT`) pega más fuerte pero recibe hasta **+150 %** de daño: el enrage acorta el final, nunca lo alarga.
Descansos entre oleadas: 14 s en solitario, 20 s en coop; 12 s si todos ya eligieron. Tres mejoras temporales a elegir; premio de oleada (`CORES.wave + 2·n`) y 120 núcleos al vencer la misión.

El **Campo de pruebas** (`MODOS_APARTE.practica`) es el único modo sin final y está declarado como modo aparte; El Santuario es un hub sin oleadas. `tests/mision-config.test.js` comprueba que toda arena es una misión finita o un modo declarado.

## Defectos del juego corregidos al medir (antes de culpar al bot)
1. **El Combo (modo Melé) no golpeaba objetos hostiles** (capullos del Cultivo, ojos de Argos, huevos de la Madre): sólo el golpe rápido los alcanzaba. Un jugador Melé no podía completar el Cultivo del Jardín (0/5 → 5/5 con el arreglo, ver tabla). `src/sim/combos.js`; además un golpe vale como un tiro a tope (`CULT.meleeHit`).
2. **La Caza se perdía si el custodio desaparecía sin que lo matara un jugador** (un Fuego Fatuo que explota; una desintegración de rezagado): ahora el bloqueo cae y se supera.
3. Daño de criaturas y jefes escalaba con el nº de oleada (`1 + 0,04·(w−1)`); con ocho oleadas habría subido más de lo previsto: ahora usa `tier` (intensidad).
Del lado del bot (no del juego): el bot melé iba a golpear con el núcleo en brazos (no se puede atacar); el bot de habilidades nunca disparaba el arma si una habilidad quedaba bloqueada por el nivel de campaña.

## Medición
`node tools/audit/medicion-capitulos.mjs all all 1,2,3,4,5 salida.jsonl` y `node tools/audit/resumen-medicion.mjs salida.jsonl` (tablas de duración y victorias). `DEBUG_JEFE=1` / `DEBUG_HP=<s>` imprimen el estado durante la partida.
Pruebas: `node --test tests/mision-config.test.js` (definición, terminación por todos los caminos, AFK, límites), `tests/mision-duracion.test.js` (6 capítulos con bot tirador: 7,5–13 min y jefe vencido), `tests/operations.test.js`, `tests/campaign-route.test.js`.

**Lo medido es con bots, no con humanos.** Los humanos serán más lentos (se estiman 10–15 min); no hay playtest, ni navegador, ni coop real, ni dispositivos en esta medición.
