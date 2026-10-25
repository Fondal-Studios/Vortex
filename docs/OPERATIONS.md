# Actualización: campaña y modos de juego

La evolución vigente de este sistema está documentada en [CAMPAIGN_AUDIT.md](CAMPAIGN_AUDIT.md). El informe siguiente conserva el alcance de la primera entrega, anterior a la campaña de seis capítulos.

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

# Operación, CI y despliegue (Sprint 1 · pista D) — 24 de octubre de 2026

Rama canónica: `claude/larga-con-eso-s43nfe`. Todo lo de esta sección vive en archivos del repo; **nada se despliega ni se toca en servicios externos desde aquí**. El resultado real del CI en GitHub solo se ve tras un push: lo descrito abajo está **escrito y revisado, no verificado en GitHub**.

## Pruebas

| Comando | Qué corre | Cuándo |
|---|---|---|
| `npm run test:unit` | Todos los `tests/*.test.js` que **no** usan navegador (simulación, servidor, datos, contratos de código). | Siempre; es lo rápido. |
| `npm run test:browser` | Los archivos que importan `browserAvailable` de `tools/browser.js` (23): E2E con Chromium, WebGL por software. | Antes de publicar. |
| `npm run test:ci` | `unit` y luego `browser` (lo que cubre el CI entero, en serie). | Para reproducir el CI en tu PC. |
| `npm test` | Todo en un solo proceso (comando histórico). | Igual que antes. |

El reparto lo hace `tools/run-tests.mjs` mirando qué archivos importan `browserAvailable`: una prueba de navegador nueva cae sola en el grupo `browser`.

### Chromium: dónde se busca y qué pasa si falta
`tools/browser.js` busca, en este orden: `BROWSER_EXECUTABLE` (ruta exacta) → `PLAYWRIGHT_BROWSERS_PATH` → `/opt/pw-browsers` → `~/.cache/ms-playwright` → `/usr/bin/chromium*` o Chrome del sistema. Si no hay navegador, **en local** las pruebas de navegador se omiten (se ve `# SKIP`); **con `REQUIRE_BROWSER=1`** (el CI lo pone; `run-tests.mjs` también lo activa si existe `CI`) el archivo **falla** al cargar con un mensaje en español. Instalarlo en una máquina limpia: `npx playwright install --with-deps chromium`.

## Flujo `.github/workflows/ci.yml`
- **`unit`** y **`browser`** corren **en paralelo** (el tiempo total es el del más lento, no la suma). Ambos usan caché de `npm` (`setup-node cache: npm`); `browser` además cachea Chromium (`.pw-browsers`) y siempre instala sus librerías del sistema.
- Tiempos máximos: `unit` 30 min, `browser` 45 min, `pages` 15 min. Una subida nueva **cancela** la corrida anterior de la misma rama (excepto en la rama canónica y `main`, donde cada commit queda verificado).
- Si `browser` falla se suben las capturas de `shots/` como artefacto (7 días).
- La concurrencia de pruebas es 1 (`--test-concurrency=1`): hay pruebas con relojes reales y WebSockets que se vuelven inestables bajo carga. Subirla es una decisión posterior, con medición.

## Compuerta de despliegue (GitHub Pages)
- El trabajo `pages` está **dentro de `ci.yml`** con `needs: [unit, browser]` y la condición «push a la rama canónica». Si cualquiera de los dos falla, **no se publica**. (No se usa `workflow_run` porque solo se dispara con el archivo en la rama por defecto del repositorio, que no es la canónica.)
- `pages.yml` queda como **vía manual** (`workflow_dispatch`): solo en la rama canónica y solo si ese commit ya tiene un CI verde.
- Si algún día la rama canónica pasa a ser `main`, hay que cambiar el nombre en `ci.yml` (dos sitios), `pages.yml` y `render.yaml`.

## Render (servidor cooperativo) — `render.yaml`
- Nombre del servicio: **`shower-psico-coop`** (el real, ver `docs/TACTICAL_ACCOUNTS.md`). El archivo decía `arcanum-coop`, que no existe en Render. **No lo renombres** sin decidirlo: un Blueprint con otro nombre crearía un servicio nuevo.
- `autoDeployTrigger: checksPass`: Render despliega **solo cuando los checks del commit pasan** (necesita que el repo esté conectado a Render por la app de GitHub). Si prefieres despliegue manual, cambia a `off` y usa «Manual Deploy» tras ver el CI en verde.
- `healthCheckPath: /health` (ya existía; devuelve estado y contadores sin datos personales).
- **`ALLOWED_ORIGINS` = `https://fondal-studios.github.io`** (solo el origen de Pages, sin ruta ni barra final; varias separadas por coma). Antes estaba vacío = cualquier página podía abrir un WebSocket.
- Además, `server/server.js` ahora tiene un **valor por defecto restrictivo**: con `ALLOWED_ORIGINS` vacío, en producción (`NODE_ENV=production` o `RENDER=true`, que el `Dockerfile` y `render.yaml` ponen) solo acepta Pages y **el propio sitio del servidor** (el juego servido desde él mismo). En desarrollo y pruebas sigue abierto. Quien aloje el juego en otro dominio **debe** poner su dominio en `ALLOWED_ORIGINS`.
- Sin secretos en el repo: `DATABASE_URL` figura con `sync: false` (se escribe solo en el panel de Render).
- Las ayudas de `docs/COOP_ONLINE.md` y `public/config.json` ya usan el nombre `shower-psico-coop` en sus ejemplos.

## AC-07 · Sonido de impacto solo con colisión confirmada
- **Regla:** sonido de impacto, destello, hit-stop, empuje de cámara y reacción de criaturas solo ocurren con un contacto que **la simulación confirmó** (`hit` / `arhit` por daño aplicado; `combo`/`melee` con `hit > 0`; `boom`/`orbburst` con `hit > 0`). Atacar al aire solo suena a barrido corto (`audio.melee(..., hit = 0)`).
- **Defecto corregido:** `combo-fx.js` hacía `near = hit || C.ranged`, así que los ataques a distancia (flechas de Seraf y similares) sonaban a impacto sin tocar nada. Ahora `near = hit`, y el remate (anillo, destello, chispas) también exige contacto.
- **Habilidades de área:** los `boom` que emiten las habilidades/remates (`combos.js`, `huespedes.js`, `characters.js`, `enjambre.js`, `singular.js`, `game.explode(..., habilidad=true)`) llevan ahora `hit` = criaturas alcanzadas. Con `hit: 0` no suena a explosión, no hay chispas, destello ni sacudida; solo queda el anillo que marca el alcance (`combatfx.boom`).
- **Un golpe = un impacto:** `src/client/impacto.js` es la única puerta de `main.js` para el sonido de golpe; el `hit` de daño de un golpe cuerpo a cuerpo no suena aparte cuando el propio golpe (combo-fx/hostfx-melee) ya pone su impacto.
- **Pruebas:** `tests/impacto.test.js` (simulación real + combo-fx real + audio y renderer falsos): aire en Combo con 8 Huéspedes (golpes encadenados y cancelados), flechas de Seraf que fallan y que pegan, melé Shooter al aire, disparos que fallan, habilidades de área sin y con blancos, un golpe = un `comboHit`, y el despachador `sonarImpacto`.
- **Límites conocidos:** las explosiones de proyectil (`game.explode` sin `habilidad`) siguen sonando siempre porque su colisión (con criatura o con el entorno) *es* el evento; `pozoend` (cierre de un pozo) conserva su sonido propio. No se probó el audio real en un navegador (el harness cuenta llamadas a un audio falso).

## Los 9 tests rojos del CI (run 40056119035) y su arreglo
| # | Prueba | Causa | Arreglo |
|---|---|---|---|
| 1 | `arsenal` «personajes: 10…» | Hoy hay 13 personajes (se sumaron Colmena, Singular y Danzante). Danzante (Contrapaso) no daña si nadie lo golpea. | Prueba actualizada a 13; Danzante exento del «dañó» con justificación. |
| 2 | `colmena` «ficha completa» | Las definitivas pasaron de carga 0-100 (`ult.charge`) a **recarga por tiempo** (`ult.cd`). | Prueba actualizada al modelo nuevo. |
| 3 | `colmena` «zánganos… NO carga su definitiva» | `p.ul` ya no existe (NaN). | Ahora comprueba que el daño de zánganos no reembolsa la recarga. |
| 4 | `estilos` equilibrio por Huésped | Con la definitiva lista al empezar, el estilo «habilidad» de Axioma llega a 2,25× (tope 2,0). | Tope 2,5× por Huésped; el control de fondo (promedio < 1,5×) se mantiene. **Pendiente de diseño:** revisar Sobrecarga Evolutiva. |
| 5 | `huespedes` «las últimas criaturas vienen a buscarte» | Defecto de la prueba: en esa semilla la criatura acosada cruza el vacío entre islas, cae y se desintegra a la vista (política «sin teletransportes»). | Acepta «se acercó o se desintegró» y exige que haya entrado en acoso. |
| 6 | `inventario` equilibrio con equipo legendario («vesper melee k0: 7.5→16.5») | El bot de melé es caótico: el mismo Huésped sin equipo tarda 7,5 s o 16,5 s según la disposición. | Cota por duelo suelta (0,25–4); el agregado ±30 % sigue vigente y pasa (0,74–0,95). |
| 7 | `limbo-mapas` m5 «no es trivial» | El bot con habilidad 0,25 ya gana m5 3/3 (m5 más permisiva). | «Torpe» pasa a 0,1, con el que sí se pierde. |
| 8 | `map4` «llegan al jefe 6 !== 7» | Dos semillas del bot hábil mueren en la oleada 6 (mapa 4 más duro). | Exige llegar al jefe **o** perder, y ≥ mitad llegan. |
| 9 | `mundo-cliente` cableado | El input ahora pasa por `learnedInput(npcInput(i))`; la prueba buscaba `return npcInput(i)`. | Regex acepta ambos. |

`coop4` con latencia **no** falló en el CI (era una sospecha); no se tocó.

## Limpieza menor (P3)
- `WAKE_SHORT` (código muerto) eliminado de `src/client/story.js` y de `tests/prologo.test.js`.
- `README.md`: el ejemplo del enlace de invitación decía `…/Shower-psico/…`, ahora `…/vortex/…`. `package.json` conserva `name: cristal-vortex` (nombre técnico; cambiarlo exige cambiar también `package-lock.json` y no aporta). «Duelo Arcano» en el README es crédito real de la NPC Factory y se deja. `Dockerfile` no tenía nombres heredados.
