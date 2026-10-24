# VORTEX — RELEASE_NOTES (estado real por versión)

> **Estado del documento**
> - Versión del documento: 0.1 · Fecha: 2026-10-24 · Responsable: Claude (estudio)
> - SHA base: `62244b61eaecff34ba539fc4018456172579bf03` (rama canónica `claude/larga-con-eso-s43nfe`) · Rama de trabajo `claude/vortex-fase0-sprint1` @ `d009eec` · Archivo **sin commitear**
> - Propósito: decir **qué se puede afirmar hoy sobre el juego y qué NO**, para que ninguna comunicación (web, redes, prensa, mensajes a jugadores) adelante lo que no existe. Distingue Diseñado / Implementado / Probado / Mergeado / Desplegado.
> - Estado de publicación: **no hay demo pública aprobada.** No hay etiquetas de versión en el repositorio local (`git tag` vacío) ni releases verificados. `package.json` declara `0.1.0` (`cristal-vortex`), un número de paquete, no una versión publicada.
> - Hermanos: [DEMO_RELEASE_CHECKLIST.md](DEMO_RELEASE_CHECKLIST.md) · [AUDIT.md](AUDIT.md) · [QA_MATRIX.md](QA_MATRIX.md) · [ROADMAP.md](ROADMAP.md)

## Versión 0.1.0 — estado actual de la rama canónica (`62244b6`)

**Qué es hoy.** Un prototipo jugable en el navegador con campaña de seis misiones encadenadas, cooperativo por salas de hasta cuatro y ocho Huéspedes. Está en fase de auditoría: **NO-GO provisional** para una demo pública (puntaje 45,6/100 frente a 80 exigido; [QA_MATRIX.md](QA_MATRIX.md)).

### Qué se PUEDE decir hoy (con su evidencia y su nivel)

| Afirmación | Nivel | Evidencia |
|---|---|---|
| Hay 8 Huéspedes con arte, habilidades, golpes de combo, arma innata, maestría y acabados cosméticos | Implementado; presupuesto gráfico Low **Probado** | [audit/INVENTARIO_HUESPEDES.md](audit/INVENTARIO_HUESPEDES.md) |
| Hay seis arenas y una campaña de seis misiones encadenadas: Vacío de Islas → Laberinto Celestial → Jardín de Carne → Plaza de los Ecos → Osario sin Techo → Cámara Fractal | Implementado; terminación **Probada solo con bots** (54/54) | [AUDIT.md](AUDIT.md) §5 |
| Cada misión tiene un número finito de etapas y termina en victoria o derrota | Implementado; no se halló bucle infinito en misiones | [audit/MATRIZ_GAPS.md](audit/MATRIZ_GAPS.md) §2 |
| Dos capítulos tienen jefe final (Coloso Prismático y Madre Geoda) | Implementado | `src/sim/campaign.js` |
| Hay modo Disparo y modo Melé, y un HUD de cuatro acciones con minimapa | Implementado; validado en Chromium en tres tamaños (informes previos), **no en dispositivo** | [VORTEX_QA_REPORT.md](VORTEX_QA_REPORT.md) |
| Cooperativo de hasta 4 jugadores con salas privadas y códigos | Implementado; **Probado con bots WebSocket**, con un fallo conocido (`coop4`) | [QA_MATRIX.md](QA_MATRIX.md) §4.5 |
| Se puede jugar con teclado y ratón o con controles táctiles | Implementado | `src/client/touch.js` |
| El juego no tiene compras con dinero, moneda premium ni comercio entre jugadores | Verificado (grep de la auditoría) | [COSMETIC_COMMERCE.md](COSMETIC_COMMERCE.md) |
| Los cosméticos (acabados) no cambian el poder | Implementado (diseño) | `src/shared/cosmetics.js` |
| Existen cuentas con respaldo manual del progreso | Implementado; **requiere una base PostgreSQL aún no contratada** para funcionar en producción | [TACTICAL_ACCOUNTS.md](TACTICAL_ACCOUNTS.md) |
| Hay una versión estática publicada en GitHub Pages | **Desplegado** (la sesión comprobó la publicación exitosa); no es una versión aprobada | [AUDIT.md](AUDIT.md) §1 |

### Qué NO se puede anunciar (todavía)

| No anunciar | Por qué | Estado real |
|---|---|---|
| «Capítulo Islas — Despertar» con cinemática de transferencia y tutorial | No existe | El capítulo 1 se llama «Refugio de la conciencia»; intro de ~18,5 s de subtítulos; tarjeta de controles en vez de tutorial jugable |
| «Capítulos de 8 a 12 minutos» | Medido: 0,70–2,44 min de mediana con bots; sin datos humanos | AC-10 Parcial |
| «Seis capítulos terminados y con jefe final» | Capítulos 2–5 terminan sin encuentro final | Solo capítulos 1 y 6 tienen jefe |
| «Cooperativo con bots» o «sin esperar a nadie» | No hay bots de producto ni bot sustituto | `bot.js` solo se usa en pruebas |
| «Reconexión sin perder nada» | El resultado no se reenvía al reanudar; el cuerpo queda inmóvil | Repro que falla |
| «Progreso seguro en la nube» | Persistencia en `localStorage`; premios decididos por el cliente; cierre no idempotente | P0 abierto |
| «Cuentas disponibles» | Dependen de una base que no está contratada | Sin `DATABASE_URL`, responden 503 |
| «Un Huésped inicial; los demás se ganan jugando» | Hay 3 iniciales y 5 que se compran con núcleos | Decisión del propietario pendiente (C1, C3) |
| «Probado por jugadores» / «bien recibido» / «divertido» | **No hubo testers humanos reales**; las notas de personas son simulación | [20_PERSONAS_SIMULADAS.md](20_PERSONAS_SIMULADAS.md) |
| «Funciona en iPhone/Android» | No se probó en dispositivo físico | Solo emulación Chromium |
| «Accesible» | Faltan daltonismo, escala de texto, contraste y remapeo | Solo movimiento reducido y formas en el minimapa |
| «Sonido de impacto fiel» | Riesgo de impacto sonoro falso en ataques de Combo a distancia | AC-07 Parcial |
| «Tienda cosmética», «pase de temporada», «comercio», «subastas», «facciones», «temporadas», «chat» | No existen | [FUTURE_BACKLOG.md](FUTURE_BACKLOG.md) (todo Diseñado) |
| «Editor de criaturas», «genética», «simbiontes», «armas orgánicas» | No existen | [FUTURE_BACKLOG.md](FUTURE_BACKLOG.md) |
| «Modo supervivencia infinita» | No existe como modo; solo rutas de prueba (`?horde=1`, Campo de pruebas) | Backlog |
| «Voces de personajes» | No se hallaron archivos de audio (ogg, mp3, wav) ni `speechSynthesis` en `src/`, `assets/` ni `public/` (grep de 2026-10-24); el audio es sintetizado y la narración, por subtítulos | Ausente |
| «Los 8 Huéspedes están pulidos» | Danzante sin animaciones propias; Singular y Colmena con audio genérico; ninguno fue jugado por una persona | AC-04 con reservas |

### Problemas conocidos de esta versión

- CI en rojo: run `40056119035` con 809 tests, 734 pass, **9 fail**, 66 skipped. Fallo local visto: `tests/arsenal.test.js` («personajes: 10 (5 Huéspedes + 5 veteranos)…» espera 10 y hay 13). La corrida local completa quedó invalidada por ediciones ajenas en el árbol: PENDIENTE: ver log.
- Cerrar la misma partida varias veces multiplica núcleos y XP (3 cierres = 900 núcleos en vez de 300).
- Si el almacenamiento del navegador lanza error, el juego no avisa y puede mostrar premios no guardados.
- Un jugador inactivo en solitario puede dejar la partida congelada en «elegir mejora» (m2).
- Melé sin victorias de bot en m4 (Cultivo) y m2 (Madre Geoda); causa sin determinar.
- Pelea de jefe sin tope de tiempo.
- Atajos de depuración (`?horde`, `?wave`, `?god`) accesibles por URL.
- Nombres heredados en README y servicios de Render (Shower Psycho / `arcanum-coop` / `shower-psico-coop`).

### Despliegue

- **GitHub Pages:** publica en cada push a la rama canónica y a `main`, sin esperar a la CI. Última publicación exitosa (consulta de la sesión). **Desplegado ≠ aprobado.**
- **Render:** `render.yaml` define `arcanum-coop` con `autoDeploy: true` (plan Free, se duerme a los 15 min). El estado vivo de hoy no fue reverificado por este agente; el 2026-10-21 el informe previo registró `/health` con `ok=true, proto=2`.
- **URL pública verificable:** no se anota aquí porque no se verificó una URL concreta en esta fase. Debe agregarse con evidencia antes de cualquier comunicado (puerta P-8 de [DEMO_RELEASE_CHECKLIST.md](DEMO_RELEASE_CHECKLIST.md)).

---

## Versión de trabajo de la Fase 0 — rama `claude/vortex-fase0-sprint1` @ `d009eec`

- **Contenido:** solo documentación y herramientas de auditoría (`docs/audit/*`, `tools/audit/medicion-capitulos.mjs`, `tools/audit/guardado-test.mjs`) más los 8 documentos operativos de esta entrega (sin commitear). **No cambia el comportamiento del juego** ni su código.
- **Estado:** Mergeado: no. Desplegado: no. Sin PR abierto.

---

## Versiones previstas (todas **Diseñadas**; no existen)

| Versión prevista | Contenido planeado | Condición |
|---|---|---|
| Alfa 1 (post Sprint 1) | Capítulo «Islas — Despertar» con cinemática, tutorial, jefe, resultados y ledger idempotente | [ROADMAP.md](ROADMAP.md) Sprint 1 completado y CI en verde |
| Alfa 2 (post Sprint 2–3) | Combate/audio/HUD corregidos y seis capítulos de 8–12 min | Sprints 2–3 |
| Beta (post Sprint 4–5) | Coop con bots y reconexión; progresión y desbloqueos; cuentas en servidor | Sprints 4–5 y base de datos aprobada |
| Demo pública | Todo lo anterior más QA, dispositivos, 20 perfiles, humanos reales y despliegue autorizado | Puertas P-1…P-8 de [DEMO_RELEASE_CHECKLIST.md](DEMO_RELEASE_CHECKLIST.md) |

Los nombres de versión (Alfa 1, Alfa 2, Beta) son etiquetas de planificación de este documento, no versiones existentes ni compromisos de calendario.

## Regla de actualización

Cada vez que una afirmación pase de la columna «NO se puede anunciar» a «Se puede decir», debe citarse la evidencia (prueba ejecutada, SHA y, si es despliegue, la URL verificada) y el nivel alcanzado.
