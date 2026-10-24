# Misiones de conciencia — 23 de octubre de 2026

La selección de arenas ahora es Misiones. Seis operaciones reutilizan los mapas existentes, con tres etapas obligatorias por operación. El atlas de arenas queda en Códice → Arenas. La historia de dos capítulos y el campo de pruebas conservan su funcionamiento.

| Operación | Etapas |
|---|---|
| Refugio de identidades | Reconexión → defensa → extracción |
| La memoria cautiva | Caza → reconexión → extracción |
| Apagar los ojos | Reconexión → caza → defensa |
| El camino que respira | Puente vivo → defensa → extracción |
| Voces de la plaza | Reconexión → extracción → defensa |
| La última transferencia | Reconexión → caza → extracción |

El rescate representa una conciencia contenida en un núcleo transportable, no un NPC humano con seguimiento. Se conserva HERALDO como IA de enlace del canon existente. La defensa se detiene cuando hay enemigos dentro de la zona; perder el ancla o superar el tiempo termina la misión. Completar el objetivo cancela refuerzos y desintegra las defensas restantes sin otorgar bajas por ellas. No hace falta eliminar toda una oleada ni enfrentar un jefe para ganar una operación.

La simulación de operaciones es explícita (`operation: true`); la activan las partidas desde Misiones y el servidor cooperativo. Los snapshots incluyen título, etapa siguiente, integridad del ancla y motivo de fracaso. La partida nueva y el reinicio crean un estado limpio. Se reutilizan las recompensas y liberación de territorios existentes; no se agrega una economía distinta.

## Validación

- 41 pruebas aprobadas, 0 fallidas, 5 omitidas por sus condiciones originales (ver operations-evidence/tests.txt).
- Las seis operaciones se completaron en fixtures de simulación con 1 y 4 jugadores. Se comprobaron defensa disputada, destrucción, tiempo agotado, portador caído/desconectado y recompensa única.
- Dos clientes WebSocket reciben la misma operación y objetivos en el mismo tick. Pasaron pruebas de lobby, cuatro bots, reconexión, snapshots y cierre de partida.
- Navegador Chromium: menú y atlas a 1280×800 y 390×844, sin errores JavaScript ni desborde horizontal. Capturas y reporte en operations-evidence/. El script reproduce la revisión con `BROWSER_EXECUTABLE=/ruta/chromium node tools/check-operations.mjs`.
- Los fixtures mueven jugadores a objetivos para verificar reglas: no equivalen a pruebas humanas de balance, recorridos completos ni a una validación en un iPhone físico.

Pruebas: `node --test --test-force-exit --test-concurrency=1 tests/operations.test.js tests/mission-variety.test.js tests/mission-network.test.js tests/recorrido-menu.test.js tests/campaign-clarity.test.js tests/coop.test.js tests/coop4.test.js tests/waves.test.js`.
