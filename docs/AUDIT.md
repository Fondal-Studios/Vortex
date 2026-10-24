# VORTEX — AUDIT (diagnóstico consolidado de la Fase 0)

> **Estado del documento**
> - Versión: 0.1 (borrador de Fase 0, sin aprobar por el propietario) · Fecha: 2026-10-24
> - SHA base: `62244b61eaecff34ba539fc4018456172579bf03` (rama canónica `claude/larga-con-eso-s43nfe`, fusión del PR #14)
> - Rama de trabajo: `claude/vortex-fase0-sprint1` @ `d009eec` (3 commits de solo auditoría sobre la base; este documento aún **sin commitear**)
> - Responsable: Claude (estudio)
> - Aviso: al redactar, el árbol de trabajo contenía modificaciones de código ajenas a esta auditoría (otro trabajo en curso). Todo lo descrito aquí corresponde al SHA base `62244b6` y a lecturas hechas sobre él; no al árbol modificado.
> - Niveles que usa este documento (GDD §15): **Diseñado** (está en el GDD) · **Implementado** (el código existe y se leyó) · **Probado** (se ejecutó una prueba y se citó el resultado) · **Mergeado** (está en la rama canónica) · **Desplegado** (está publicado y se comprobó).
> - Documentos hermanos: [GDD.md](GDD.md) · [ROADMAP.md](ROADMAP.md) · [QA_MATRIX.md](QA_MATRIX.md) · [20_PERSONAS_SIMULADAS.md](20_PERSONAS_SIMULADAS.md) · [FUTURE_BACKLOG.md](FUTURE_BACKLOG.md) · [DEMO_RELEASE_CHECKLIST.md](DEMO_RELEASE_CHECKLIST.md) · [RELEASE_NOTES.md](RELEASE_NOTES.md)
> - Evidencia de origen (léase junto con este documento): [audit/MATRIZ_GAPS.md](audit/MATRIZ_GAPS.md) · [audit/INVENTARIO_HUESPEDES.md](audit/INVENTARIO_HUESPEDES.md) · [audit/MEDICION_CAPITULOS.md](audit/MEDICION_CAPITULOS.md)

Regla de lectura: nada de lo que sigue es un playtest humano. Donde se escribe «medido» se refiere a simulación con bots o a un comando ejecutado; donde se escribe «leído», a lectura de código. Lo que no se pudo comprobar se marca **No verificado**.

---

## 0. Tabla de estado (Verificado / Modificado / Probado / En PR / Mergeado / Desplegado / Pendiente)

| Elemento | Verificado | Modificado | Probado | En PR | Mergeado | Desplegado | Pendiente |
|---|---|---|---|---|---|---|---|
| Repositorio oficial `Fondal-Studios/Vortex`, rama canónica y SHA | Sí (git local: `git rev-parse 62244b6` = `62244b61…`; remoto `origin` = `Fondal-Studios/vortex`; el resto, consulta a GitHub hecha por la sesión de auditoría el 2026-10-24) | No | n/a | n/a | Sí (es la base) | n/a | Rama `main` atrasada en `94280a5`: decidir cuál es la principal |
| 14 PR previos (#1–#14, de Codex) | Sí (consulta a GitHub; ninguno abierto) | No | n/a | Ninguno abierto | Sí, los 14 | n/a | Ninguno |
| CI (`ci.yml`: `npm ci` + `npm test`, ~15 min) | Sí (workflow leído; últimas corridas consultadas) | No | **Falla**: run `40056119035` = 809 tests, 734 pass, **9 fail**, 66 skipped | No | n/a | n/a | Corregir los 9 fallos y volver la CI en verde (ver §6) |
| Suite local `npm test` en este SHA | Parcial | No | **Corrida local invalidada**: el árbol de trabajo recibió ediciones ajenas mientras corría (ver §6.2). Solo el fallo `arsenal`, visto antes de esa contaminación, es citable | No | n/a | n/a | PENDIENTE: ver log; repetir sobre un árbol limpio en `62244b6` (§6.2) |
| GitHub Pages (`pages.yml`) | Sí (workflow leído; la sesión comprobó que publica en cada push y fue exitosa) | No | Build estático ejecutado antes (informe de Bloque 0: 48,4 MB), no re-ejecutado hoy | No | Sí | **Sí** (publica a cada push a la rama canónica y a `main`) | Sin compuerta de CI (`needs`) |
| Render (`render.yaml`, `autoDeploy: true`) | Archivo leído; estado vivo de Render no re-consultado hoy | No | `/health` respondió `ok=true, proto=2` el 2026-10-21 (informe previo) | No | Sí | Informe previo (2026-10-21): live con el commit base de entonces | Confirmar hoy el commit en vivo; autodeploy sin compuertas |
| Inventario de 8 Huéspedes | Sí (script sobre `src/sim/data.js`) | Solo doc | Presupuesto Low: 2/2 tests OK, 409,7 s | No | No (docs de auditoría en rama de trabajo) | No | Danzante sin animaciones propias; Singular/Colmena sin audio propio |
| Medición de capítulos con bots (54 partidas) | Sí | Solo `tools/audit/*` | Sí (sim pura, no humanos) | No | No | No | Medir con humanos |
| «Islas — Despertar», cinemática de transferencia, tutorial de ~3 min | Sí (ausentes) | No | n/a | No | No | No | Sprint 1 |
| Cooperativo con bots / espectador / ledger / telemetría | Sí (ausentes o parciales) | No | Repro que **falla** (`tools/audit/coop-resume-result.repro.js`) | No | No | No | Sprints 4–5 |

---

## 1. Repositorio, rama, PR y despliegue (AC-01)

| Dato | Valor | Evidencia |
|---|---|---|
| Repositorio oficial | `Fondal-Studios/Vortex` (nombre anterior del proyecto: Shower Psycho; el repo histórico `drmarianojimenez94-sudo/Shower-psico` figura en [VORTEX_AUDIT.md](VORTEX_AUDIT.md)) | `git remote -v` → `https://github.com/Fondal-Studios/vortex`; confirmación del propietario en el documento maestro |
| Rama canónica y predeterminada | `claude/larga-con-eso-s43nfe` @ `62244b61eaecff34ba539fc4018456172579bf03` | `git rev-parse`; consulta a GitHub (sesión de auditoría) |
| `main` | Atrasada: `94280a5` | Consulta a GitHub (sesión de auditoría). No re-verificada por este agente |
| Rama de trabajo | `claude/vortex-fase0-sprint1` @ `d009eec` | `git log --oneline`: `d009eec`, `5d9abf5`, `db80289` sobre `62244b6` |
| PR previos | #1–#14, todos fusionados, ninguno abierto; el último (#14) es «last-human-consciousness» | Consulta a GitHub (sesión de auditoría); `git log` muestra «Merge pull request #14» |
| CI | `.github/workflows/ci.yml`: Node 22, `npm ci`, `npm test`; sin lint, sin matriz, sin job de navegador | Archivo leído |
| Resultado de CI | **Rojo** en las últimas corridas: run `40056119035` = 809 tests / 734 pass / 9 fail / 66 skipped | Consulta a GitHub (sesión de auditoría) |
| Pages | `.github/workflows/pages.yml`: se ejecuta en push a `main` y a `claude/larga-con-eso-s43nfe`; build `node tools/build-static.js` y deploy; **no depende de CI** | Archivo leído; ejecución exitosa comprobada por la sesión |
| Render | `render.yaml`: servicio `arcanum-coop` (plan Free, se duerme a los 15 min), `autoDeploy: true`, `ALLOWED_ORIGINS` sin valor (cualquiera), `MAX_SALAS=10`, `MAX_POR_IP=8`, `healthCheckPath: /health` | Archivo leído. La documentación habla de `shower-psico-coop` ([TACTICAL_ACCOUNTS.md](TACTICAL_ACCOUNTS.md)): nombre distinto, a reconciliar |

Conclusión AC-01: **Parcial**. El repositorio, la rama y el SHA están identificados; falta un único documento vivo que reemplace a los `VORTEX_*.md` y limpie nombres heredados (`README.md` dice «Shower-psico»; `public/config.json` apunta a `arcanum-coop.onrender.com`).

Aviso sobre despliegue: hoy cualquier push a la rama canónica se publica en Pages y Render lo redespliega solo, sin esperar a la CI. GDD §11 (Sprint 6) y §15 piden activar el despliegue público «solo con autorización y criterios cumplidos». Esto es una contradicción abierta (C15 en [audit/MATRIZ_GAPS.md](audit/MATRIZ_GAPS.md)).

---

## 2. Stack tecnológico

| Capa | Contenido | Evidencia |
|---|---|---|
| Lenguaje y módulos | JavaScript con módulos ES nativos, `"type": "module"`, Node >= 20 (CI y Render usan 22). Sin paso de build salvo `tools/build-static.js` (empaquetado estático) | `package.json`, workflows |
| Render 3D | `three` 0.186.1 (versión fija) | `package.json` |
| Red | `ws` ^8.18.0 (WebSocket); servidor autoritativo en `server/server.js`; simulación pura compartida en `src/sim` | `package.json`, `server/` |
| Cuentas | `pg` ^8.16.3 (PostgreSQL por `DATABASE_URL`); sin esa variable las cuentas responden 503 y el juego sigue como invitado. Tablas `vortex_accounts`, `vortex_sessions` | [TACTICAL_ACCOUNTS.md](TACTICAL_ACCOUNTS.md), `server/accounts.js` |
| Desarrollo | `@electric-sql/pglite`, `playwright-core` (tests de navegador; se omiten solos si falta `/opt/pw-browsers`) | `package.json`, `tools/browser.js` |
| Pruebas | `node --test`; script `npm test` = `node --expose-gc --test --test-concurrency=1 "tests/*.test.js"` | `package.json` |
| Contenedor | `Dockerfile` (con HEALTHCHECK), `Procfile` | Raíz del repo |
| Persistencia del jugador | `localStorage` del navegador (un solo blob JSON de perfil) más respaldo manual a cuenta | `src/client/perfil.js`, `server/accounts.js` |

Comprobación de sintaxis hecha hoy: `node --check src/sim/game.js` y `node --check server/server.js` terminan sin error.

---

## 3. Estructura del repositorio (conteos verificados con `ls`/`find`)

| Ruta | Contenido |
|---|---|
| `src/sim/` | Simulación autoritativa compartida (juego, oleadas, objetivos, operaciones, campaña, jefes, huéspedes, tienda, maestría, mapas). Unos 55 módulos |
| `src/client/` | Cliente: render, HUD, audio sintetizado, menú, perfil, arte de Huéspedes (`huesped/`), cinemática y relato |
| `src/shared/` | Cosméticos, identidad, tácticas y habilidades comunes a cliente y servidor |
| `src/arcanum/` | Base técnica heredada de ARCANUM (rig, piezas, retarget) |
| `server/` | Servidor cooperativo, salas, cuentas |
| `tests/` | 96 archivos `*.test.js` en la raíz (el script de `npm test` ejecuta `tests/*.test.js`) |
| `tools/` | Utilidades, medición, `tools/audit/` (4 archivos de auditoría, ver §10) |
| `public/`, `assets/`, `shots/`, `demo/` | Páginas, retratos (8), assets de esqueleto/clips, capturas |
| `docs/` | Documentación del repo (más de 50 archivos) más estos 8 entregables |
| `src/` en total | 277 archivos `.js` |

---

## 4. Inventario de Huéspedes (8) — resumen

Detalle completo: [audit/INVENTARIO_HUESPEDES.md](audit/INVENTARIO_HUESPEDES.md) (léase ahí la evidencia por dimensión).

- Hay exactamente **8 Huéspedes** (`HOST_IDS`): axioma, vesper, micelio, umbra, seraf, danzante, singular, colmena. Los 5 de `CHARACTER_IDS` restantes (egida, lumen, forja, vigia, nova) son **heredados** (`legacy`) y no cuentan como Huéspedes.
- Todos tienen arte propio con cuerpo unificado, retrato 192×192, 4 habilidades más pasiva, 8 golpes de Combo (datos), arma innata, maestría (rangos 1–10) y 4 acabados cosméticos (32 SKU).
- Presupuesto gráfico en calidad Low (probado hoy, `tests/huesped-cuerpo.test.js`, 2 de 2 OK en 409,7 s): peor caso 35 llamadas (límite 45) y 19 556 triángulos (límite 20 000, Seraf al 98 %).
- Desbloqueo hoy: 3 iniciales (axioma, vesper, micelio) y 5 de tienda (umbra 500, seraf 500, danzante 600, singular 750 con rango 3, colmena 600 con rango 3; en núcleos). No existe desbloqueo por campaña, desafío o exploración.

| Huésped | AC-04 (carga, ataques, habilidad, animaciones mínimas) | Brecha principal |
|---|---|---|
| Axioma, Vesper, Micelio, Umbra, Seraf | Sí (con la reserva general: ninguno fue jugado por una persona) | Margen de triángulos muy justo; revisión visual pendiente («versión base» según `docs/HUESPEDES_ARTE.md:88`) |
| Danzante | Con reservas | `ANIM_GOLPE.danzante` y `ANIM_HAB.danzante` no existen; usa respaldo genérico y la pose de Axioma |
| Singular | Con reservas | Sin sonido propio en sus 4 habilidades ni en el golpe; sin arma firma; falta en `hostfx.test.js` |
| Colmena | Con reservas | Golpe con el sonido por defecto; picaduras y Reina con sonido de torreta; coop con varios invocadores y tienda sin probar |

---

## 5. Arenas (6), campaña, enemigos y jefes

### 5.1 Arenas y orden de campaña (nombres reales del código)

Orden de campaña: `CAMPAIGN_ORDER` = `m1, m3, m4, m5, m6, m2` (`src/sim/campaign.js`). Nombres de arena: `src/sim/maps.js`. Operaciones: `src/sim/operations.js`. Medición: [audit/MEDICION_CAPITULOS.md](audit/MEDICION_CAPITULOS.md).

| Cap. | Id | Arena (repo) | Operación | Etapas | Jefe de campaña | Mediana de victoria con bots (min) |
|---|---|---|---|---|---|---|
| 1 | m1 | Vacío de Islas | Refugio de la conciencia | 4 | Coloso Prismático | 2,39 |
| 2 | m3 | Laberinto Celestial | Apagar los ojos | 3 | No | 1,82 |
| 3 | m4 | Jardín de Carne | El camino que respira | 3 | No | 2,44 (5 de 9 victorias) |
| 4 | m5 | Plaza de los Ecos | Voces de la plaza | 3 | No | 1,41 |
| 5 | m6 | Osario sin Techo | El vínculo del Osario | 3 | No | 0,70 |
| 6 | m2 | Cámara Fractal | La última transferencia | 4 | Madre Geoda | 6,73 (6 de 9 victorias) |

Nota: los títulos de operación se leyeron en `src/sim/operations.js` (fuente de verdad). `docs/OPERATIONS.md` y `docs/CAMPAIGN_AUDIT.md` todavía llaman «Refugio de identidades» al capítulo 1, y `OPERATIONS.md` asocia «La última transferencia» a otro orden de etapas: están desactualizados respecto del código.

El GDD llama «Islas — Despertar» al capítulo 1; el código lo llama «Refugio de la conciencia» sobre la arena «Vacío de Islas». El nombre del GDD **no existe** en el repo.

### 5.2 Enemigos: 15 criaturas (`MONSTERS` en `src/sim/data.js`, verificado por script)

| Tipo | Id → nombre en el juego |
|---|---|
| 12 comunes y élites | astilla → Ánima · geoda → Almamula · prisma → Luz Mala · lente → La Llorona · cuarzo → Salamanquera · espejo → Pombero · racimo → Fuego Fatuo · graviton → El Familiar · obelisco → La Viuda · aurora → Difunta · ariete → Lobizón · espiral → El Silbón |
| 3 jefes | coloso → El Mandinga (3000 PV) · argos → El Basilisco (3400 PV) · madre → La Madre de las Ánimas (3200 PV) |

- Además hay 6 afijos de élite (`AFFIXES`) y mecánicas de jefe en `bossmech.js`, `jefe-ia.js`, `jefe-mec.js`.
- En la campaña solo se usan **2** jefes: m1 (Coloso Prismático) y m2 (Madre Geoda) mediante `CAMPAIGN_BOSSES`. `BOSS_OF` asigna jefes a las 6 arenas (m3, m4 y m6 → argos; m5 → coloso) pero no entran en campaña: los capítulos 2–5 terminan al cumplir el último objetivo, sin encuentro final.
- Las listas 4–6 de `WAVE_PLANS` (geoda, ariete, cuarzo, obelisco, graviton, aurora, espiral) casi nunca se alcanzan en misiones: contenido de arte y diseño sin uso.

### 5.3 Finitud de las misiones (AC-02)

Revisados `game.js`, `data.js`, `director.js`, `operations.js` y otros: **no se encontró ninguna misión ni campaña que pueda quedar en oleadas infinitas**. Rutas sin fin, todas fuera de misión: Campo de pruebas (`practice`), `?horde=1` (banco de rendimiento) y el Santuario (hub). Riesgos reales: pelea de jefe sin tope de tiempo ni enrage; intermedio en solitario que espera sin límite la elección de mejora (un jugador AFK en m2 dejó la partida 1480 s congelada); atajos `?horde`, `?wave`, `?god` accesibles por URL.

---

## 6. Salud de las pruebas

### 6.1 CI en GitHub

Run `40056119035`: **809 tests, 734 pass, 9 fail, 66 skipped**. Los 66 omitidos incluyen las pruebas de navegador, que se saltan solas si falta Chromium. Un «verde» de CI no probaría el cliente en navegador (V05 en [VORTEX_AUDIT.md](VORTEX_AUDIT.md)).

### 6.2 Fallos de la suite completa

PENDIENTE: ver log. La corrida local de `npm test` (salida en `/tmp/claude-0/vortex-npmtest.log`, sin línea final `FIN` al cerrar este documento) **no es una línea base válida**: mientras corría, el árbol de trabajo recibió ediciones de otro trabajo en curso (`git status` muestra decenas de archivos de `src/`, `tests/`, `server/` y workflows modificados y archivos nuevos como `src/sim/ledger.js` que NO pertenecen a esta auditoría). Prueba de la contaminación: decenas de suites fallan al importar con `SyntaxError: The requested module './eventos.js' does not provide an export named 'forzarEvento'` (`src/sim/game.js:33`). Por eso **solo se cita un `not ok`**, el que el log mostraba antes de esa contaminación y que coincide con lo ya documentado:

| Prueba | Fallo | Origen |
|---|---|---|
| `tests/arsenal.test.js` — «personajes: 10 (5 Huéspedes + 5 veteranos), cada uno con desplazamiento y disparo especial propios, con recarga» | El test espera 10 personajes y `CHARACTER_IDS` tiene 13 (8 Huéspedes + 5 heredados). Test heredado desactualizado | Visto en el log local; ya señalado en [audit/MATRIZ_GAPS.md](audit/MATRIZ_GAPS.md) (AC-04) |

Fallos adicionales ya conocidos por la documentación (no reconfirmados hoy): enemigo rezagado y balance legendario de Vesper en melé ([VORTEX_QA_REPORT.md](VORTEX_QA_REPORT.md)), y `coop4` sin snapshots comunes (mismo informe). Los nombres exactos de los 9 fallos de la CI de GitHub **no se tienen**: hay que leer el log del run `40056119035`. Para obtener la lista real hay que repetir `npm test` sobre un árbol limpio en `62244b6` (por ejemplo un `git worktree` de ese SHA) o leer el log del run `40056119035`, y completar esta sección con los `not ok` reales.

### 6.3 Pruebas que sí se ejecutaron en esta fase

| Comando | Resultado |
|---|---|
| `timeout 600 node --test tests/huesped-cuerpo.test.js` | exit 0; 2 pass, 0 fail; 409,7 s |
| `node tools/audit/medicion-capitulos.mjs all all 1,2,3 …` | 54 partidas con bots, 0 timeouts a 25 min; resultados en MEDICION_CAPITULOS |
| `node tools/audit/guardado-test.mjs` | V03 vigente (3 cierres = 900 núcleos en vez de 300); V01 vigente (falla sin avisar); V08 corregido |
| `node --test tests/campaign-route.test.js tests/operations.test.js tests/prologo.test.js` | 4+5+2 OK (según MEDICION_CAPITULOS) |
| `node --check src/sim/game.js`, `node --check server/server.js` | OK (hoy) |

---

## 7. Sistemas existentes (Implementado = código leído; Probado solo donde se indica)

| Sistema | Estado | Nota |
|---|---|---|
| Simulación autoritativa y oleadas/etapas finitas | Implementado; probado con bots | `waveTotal` = pasos de la operación (+1 si hay jefe) |
| Objetivos (Reconexión, Ancla, Caza, Núcleo, Cultivo, Sintonía) con límite de tiempo | Implementado | Límites de 110 a 260 s |
| Combate Disparo y Melé, Combos por Huésped | Implementado; «sensación» sin medir | Scorecard previo: combate 65 |
| HUD de cuatro acciones, minimapa táctico con formas, retrato/vida inferiores | Implementado; verificado en 3 tamaños de Chromium (informes previos), no en dispositivo | No hay reloj de partida en el HUD |
| Cámara 1.ª/3.ª con botón y tecla | Implementado | 3.ª inicial solo en Melé; el cambio de modo fuerza la cámara |
| Coop hasta 4 con salas y códigos | Implementado; probado con bots WebSocket (`coop4`: fallo de snapshots) | Sin bots de producto, sin espectador |
| Reanimación | Implementado | Revive automático en la siguiente oleada, sin límite |
| Perfil, maestría, árbol por Huésped, evolución, tienda de núcleos, cuentas con respaldo manual | Implementado | Cliente autoritativo en progreso |
| Cosméticos (acabados) | Implementado; sin cobros | 32 SKU; solo «acabados» de material |
| Audio | Sintetizado (Web Audio); «nadie lo escuchó» ([INFORME_CALIDAD.md](INFORME_CALIDAD.md)) | Falso impacto potencial en Combo a distancia |
| Narrativa vigente | «La última conciencia humana» ([VORTEX_STORY.md](VORTEX_STORY.md)) | Sin cinemática de transferencia ni decisiones morales |
| Telemetría | **Ausente** | |
| Santuario (hub) | Implementado | Destino por defecto tras cada partida (contradicción con el GDD, ver [GDD.md](GDD.md)) |

---

## 8. Riesgos P0–P3 (consolidados de [audit/MATRIZ_GAPS.md](audit/MATRIZ_GAPS.md) y [audit/MEDICION_CAPITULOS.md](audit/MEDICION_CAPITULOS.md))

| Nivel | Riesgo | Evidencia |
|---|---|---|
| **P0** | Premios y progreso sin ledger ni idempotencia: el cliente se acredita solo; `cerrarPartida` no es idempotente (3 cierres = 900 núcleos); el resultado `fin` no se reenvía al reanudar la sala coop; la protección `session.banked` solo vive en memoria | `perfil.js:92-104`, `main.js:810`, `server.js:229-240`, repro que falla |
| **P0/P1** | Persistencia solo en `localStorage` con respaldo manual; el guardado falla sin avisar si el almacenamiento lanza error (V01); cuentas dependen de una base PostgreSQL aún no contratada | `perfil.js:88`, `guardado-test.mjs` |
| P1 | Despliegue sin compuertas (Pages y Render al hacer push; CI sin navegador ni lint; CI roja) | `pages.yml`, `render.yaml`, `ci.yml` |
| P1 | Sin cinemática de transferencia ni tutorial jugable; el capítulo 1 no se llama «Islas — Despertar» | `prologo.js` (stub), `main.js:324` |
| P1 | Capítulos de 0,7 a 2,4 min medianos con bots, frente a 8–12 (AC-10); m3–m6 sin jefe | MEDICION_CAPITULOS |
| P1 | Coop sin bots ni espectador; un desconectado queda inmóvil y vulnerable 45 s | `server.js:196-206,315`, `bot.js` |
| P1 | Posible falso sonido de impacto en ataques a distancia del modo Combo (`near = hit \|\| C.ranged`) y sin prueba automática (AC-07) | `combo-fx.js:134,170` |
| P1 | Desbloqueo de Huéspedes por compra con núcleos, 3 iniciales (decisión del propietario pendiente) | `tienda.js` |
| P1 | Seguridad: `ALLOWED_ORIGINS` vacío = cualquier origen, sin CSP/HSTS, perfil respaldado como JSON libre, cliente decide su progreso | `server.js:87`, `accounts.js:45` |
| P1 | Calidad no certificada: puntuación previa 60,95/100 provisional; CI roja; sin dispositivos reales ni humanos | [VORTEX_SCORECARD.md](VORTEX_SCORECARD.md) |
| P2 | Melé 0 de 3 en m4 (Cultivo) y m2 (Madre Geoda) con bots: causa del bot o del diseño sin determinar | MEDICION_CAPITULOS P2-1 |
| P2 | Jefe sin tope de tiempo; intermedio en solitario sin límite | MEDICION_CAPITULOS P2-2, P2-3 |
| P2 | Cámara dependiente del modo; sin accesibilidad avanzada (daltonismo, escala de texto, remapeo); sin telemetría | MATRIZ_GAPS |
| P2 | Danzante sin animaciones propias; Singular y Colmena sin audio propio | INVENTARIO_HUESPEDES |
| P2 | Contenido muerto (`WAVE_PLANS` 4–6) y dos catálogos de personajes (8 + 5 heredados) | `data.js` |
| P3 | Atajos de depuración en producción; documentación y nombres heredados desalineados (tren, Shower-psico, `arcanum-coop`); `WAKE_SHORT` es código muerto | varios |

---

## 9. Propuesta de sprints (detalle en [ROADMAP.md](ROADMAP.md))

| Sprint | Foco | Primer entregable verificable |
|---|---|---|
| 0 (este) | Auditoría, línea base | Estos 8 documentos más `docs/audit/*` |
| 1 | Corte vertical «Islas — Despertar» y protección de premios | Menú → Huésped → tutorial → oleadas → jefe → resultado, con ledger idempotente |
| 2 | Combate, audio, HUD, cámara | AC-05, AC-06, AC-07 con pruebas automáticas |
| 3 | Campaña y arenas (6 capítulos de 8–12 min) | Duración medida por capítulo |
| 4 | Coop y resiliencia | Bots de producto, espectador, reconexión con resultado |
| 5 | Progresión y colección | Huésped inicial único, desbloqueos, ledger en servidor, telemetría |
| 6 | QA, endurecimiento y decisión go/no-go | Puntuación >= 80 sustentada, humanos reales, despliegue autorizado |

Primera acción recomendada antes del Sprint 1: dejar la CI en verde (corregir el test `arsenal` y los demás fallos) y poner una compuerta entre CI y despliegue.

---

## 10. Archivos de auditoría y comandos

Archivos creados en esta fase (rama de trabajo): `docs/audit/INVENTARIO_HUESPEDES.md`, `docs/audit/MATRIZ_GAPS.md`, `docs/audit/MEDICION_CAPITULOS.md`, `tools/audit/medicion-capitulos.mjs`, `tools/audit/guardado-test.mjs` (commits `db80289`, `5d9abf5`, `d009eec`). `tools/audit/coop-resume-result.repro.js` y `tools/audit/gameplay-radar.repro.mjs` ya existían de ciclos anteriores. Este documento y sus 7 hermanos están sin commitear.

## 11. Limitaciones

- No hay jugadores humanos, dispositivos físicos ni medición de FPS reales; el audio no fue escuchado.
- Los datos de GitHub (PR, CI, ramas, Pages) provienen de la consulta de la sesión de auditoría del 2026-10-24; este agente no los volvió a pedir a GitHub.
- La suite completa local quedó invalidada por ediciones concurrentes ajenas en el árbol de trabajo; los documentos describen el SHA base `62244b6`, no el árbol modificado.
- Números de línea citados son del SHA base más el árbol de trabajo y pueden moverse.
