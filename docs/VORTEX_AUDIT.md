# VORTEX — Auditoría inicial, Bloque 0

Fecha local: 21/10/2026 (America/Argentina/Jujuy). Base: `9b7d54aee532e2a210ca0359ec79cf9a3ae45efa`.
Repositorio: `drmarianojimenez94-sudo/Shower-psico`. Rama predeterminada y desplegada: `claude/larga-con-eso-s43nfe`. Rama de auditoría: `codex/vortex-block0-audit`.

## Diagnóstico ejecutivo
Vortex tiene una base funcional considerable: Three.js 0.186.1, JavaScript ESM, Node >=20, WebSocket `ws`, simulación compartida autoritativa, seis arenas, prólogo de estación/tren, huéspedes, armas, objetivos, economía y abundante infraestructura de tests. No corresponde llamarlo un escenario vacío ni afirmar que sólo tiene dos mapas.

El cuello de botella de producto es consolidar la primera partida y asegurar sus recompensas. Hay defectos comprobables de moneda, recompensa de munición y recuperación del resultado cooperativo; además hay gates de publicación insuficientes. La cantidad de sistemas supera la evidencia disponible de diversión, ergonomía y estabilidad de una sesión humana.

**Dictamen: no certificar lanzamiento comercial.** Preparar una demo de 10–15 minutos centrada en una arena y un huésped; congelar sistemas nuevos. No se afirma que el juego no sea divertido: todavía no fue posible medirlo.

## Método y límites
Tres revisiones independientes por subagentes: gameplay/UX/niveles; técnica/red/persistencia; arte/progresión/producto. La junta de 12 cargos es una síntesis editorial de esas revisiones, no doce personas ni doce playtests. Los cinco críticos son hipótesis explícitas.

- **Verificado:** resultado empírico o hecho estático explícitamente identificado.
- **Parcialmente verificado:** lógica o transporte probado sin recorrido visual/hardware completo.
- **No verificado:** prueba pendiente, hipótesis de diseño o afirmación sin evidencia actual.
- **Defectuoso:** reproducción o contradicción concreta; se distingue defecto del producto de limitación del entorno.

Instalación `npm ci` y build estático ejecutados; dist informa 48,4 MB. Servicio Render identificado en My Workspace, despliegue del mismo commit marcado live; GET /health devolvió ok=true, proto=2. No se alteraron salas ni servicio vivo. El navegador remoto abrió el título pero WebGL no pudo crearse. La descarga de Chromium local falló con archivo ZIP inválido. Por ello no hay playtest visual actual, FPS real, audio escuchado ni iPhone físico probado. Capturas antiguas sólo orientan hipótesis.

## Los 20 problemas principales
El orden combina daño potencial al progreso, exposición de versiones no validadas y fricción inicial. P0 de guardado es condicional al fallo de almacenamiento; no significa que todo usuario pierda datos. Esfuerzos son estimaciones de ingeniería incluyendo pruebas, no compromisos de calendario.

### V01 — Guardado falla sin aviso · P0 condicional
- Evidencia/causa: Defecto reproducido con almacenamiento que arroja excepción. perfil.js:guardar captura y descarta el error; main.js:bankProfile marca banked antes de persistir. No se ha observado una pérdida en un usuario real.
- Solución: Resultado explícito, aviso y recuperación sin duplicar premios.
- Esfuerzo: 0,5–1 d. Impacto: protege progreso y confianza.
- Cierre objetivo: QuotaExceededError produce aviso, permite recuperar y no afirma persistencia.

### V02 — Resultado cooperativo ausente al reconectar · P1
- Evidencia/causa: Reproducción WebSocket local: estado won con fin=null; server/server.js:resume no reenvía terminar.
- Solución: Diseñar entrega recuperable y acreditación idempotente juntas.
- Esfuerzo: 1–2 d. Impacto: protege progreso y confianza.
- Cierre objetivo: Cortar antes del fin y volver conserva exactamente el botín personal.

### V03 — Acreditación sin identificador persistente de partida · P1
- Evidencia/causa: perfil.js:cerrarPartida suma cada llamada; session.banked sólo existe en memoria. Duplicación al recargar inferida, no probada en UI.
- Solución: matchId, recibo persistente y cierre transaccional.
- Esfuerzo: 1–2 d. Impacto: protege progreso y confianza.
- Cierre objetivo: Tres reconexiones/recargas acreditan una vez, también con fallo de storage.

### V04 — Arranque WebGL fallido deja título inerte · P1
- Evidencia/causa: Observado en navegador remoto: error creando WebGL en render.js:63 y main.js:61, título sin respuesta. Causa del contexto fallido: entorno remoto; no prueba incompatibilidad iPhone.
- Solución: Capturar fallo y ofrecer explicación/reintento accesible.
- Esfuerzo: 2–4 h. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: Sin WebGL aparece estado de error útil; no queda un botón inerte.

### V05 — CI verde puede omitir navegador · P1
- Evidencia/causa: ci.yml no instala Chromium; e2e.test.js y otras suites skip si falta /opt/pw-browsers.
- Solución: Ruta portable, instalar navegador y gate obligatorio sin skips por ausencia.
- Esfuerzo: 0,5–1 d. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: Job de navegador ejecuta E2E y falla si falta ejecutable.

### V06 — Publicación no depende de tests · P1
- Evidencia/causa: pages.yml publica desde main y claude/larga-con-eso-s43nfe sin gate de tests; Render autodeploy por commit.
- Solución: Rama canónica, gate y exclusión mutua de despliegues.
- Esfuerzo: 0,5 d. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: Commit con test fallido no alcanza producción; conservar rollback.

### V07 — Sin checkpoint de progreso de sesión · P1
- Evidencia/causa: main.js guarda al terminar/salir por botones; no checkpoint de oleada/pagehide encontrado. Riesgo al cierre Safari, no reproducido físicamente.
- Solución: Checkpoint idempotente separado del cierre y premios finales.
- Esfuerzo: 1–2 d. Impacto: protege progreso y confianza.
- Cierre objetivo: Cerrar tras oleada y volver preserva avance sin duplicarlo.

### V08 — Moneda cargada sin normalización · P1
- Evidencia/causa: REPRODUCIDO: cores="100" y premio 5 resultaba "1005". perfil.js:load/cerrarPartida.
- Solución: Normalización finita, entera y no negativa. IMPLEMENTADO en rama.
- Esfuerzo: 1–2 h. Impacto: protege progreso y confianza.
- Cierre objetivo: Fixture da 105; negativos y valores inválidos dan 0.

### V09 — Objetivo repone armas ajenas al equipo · P1
- Evidencia/causa: REPRODUCIDO: objectives.js:finish usaba índices 1,2,3; Vesper y Micelio tienen otros arsenales.
- Solución: Reponer slots equipados y respetar ammoMax. IMPLEMENTADO en rama.
- Esfuerzo: 1–2 h. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: Dos huéspedes recuperan su arsenal sin tocar armas no equipadas ni infinito.

### V10 — Prueba de balance de equipo falla · P1
- Evidencia/causa: tests/inventario.test.js:288 falla en commit original: vesper melee k0 7.5→16.5 supera tolerancia ±30%. Mide bot/fixture, no balance humano.
- Solución: Investigar interacción equipo/IA y actualizar comportamiento o fixture con justificación, no ampliar umbral a ciegas.
- Esfuerzo: 0,5–2 d. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: Causa reproducida y prueba válida pasa; conservar comparación sin equipo.

### V11 — Demora antes del primer combate · P1 diseño
- Evidencia/causa: prologo.js:24 y story.js:WAKE suman 86,2 s de secuencia si no se salta; excluye carga. Hay botón de salto.
- Solución: Primer encuentro interactivo ≤30 s; cine completo opcional.
- Esfuerzo: 1–2 d. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: Medir con perfil nuevo tiempo desde entrada a nivel hasta primer ataque.

### V12 — Tutorial corre mientras corre la partida · P1 diseño
- Evidencia/causa: main.js:showTutorial: ocho filas, autocierre 16 s, marca visto sin confirmación; no pausa.
- Solución: Pausar solo, confirmar comprensión; coop enseñanza contextual no bloqueante.
- Esfuerzo: 0,5 d. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: En solo daño/oleada no avanzan durante modal; visto sólo al confirmar.

### V13 — Perfil depende del origen y del navegador · P1 producto
- Evidencia/causa: perfil.js usa localStorage; Render y Pages son orígenes distintos, sin cuenta/backup visible.
- Solución: Exportar/importar validado y copia última versión sana antes de vender progreso.
- Esfuerzo: 1–2 d. Impacto: protege progreso y confianza.
- Cierre objetivo: Round-trip y migración entre orígenes preservan inventario/moneda.

### V14 — Campaña normal no integra seis arenas · P2
- Evidencia/causa: story.js:RUTAS corta m1,m2; larga m1,m5,m6,m2 habilitada por query. m3/m4 accesibles como arenas.
- Solución: Explicitar demo corta y ruta visible; decidir qué arenas pertenecen al relato.
- Esfuerzo: 0,5–1 d. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: No se necesita editar URL para acceder a campaña anunciada.

### V15 — Editor táctil puede sacar botones de pantalla · P2
- Evidencia/causa: touch.js:editMove aplica dx/dy sin acotar ni revalidar orientación. Defecto estático; gesto real pendiente.
- Solución: Acotar a viewport/safe areas y restaurar posiciones válidas.
- Esfuerzo: 2–4 h. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: Todos los botones recuperables en retrato/horizontal y tras resize.

### V16 — Demasiadas acciones táctiles iniciales · P2 hipótesis
- Evidencia/causa: touch.js: básico incluye nueve botones más contextuales. Densidad verificable, incomodidad no medida en iPhone.
- Solución: Preset inicial con acciones esenciales, expansión contextual.
- Esfuerzo: 1 d. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: Prueba novato: mover, mirar y disparar simultáneamente sin ocultar objetivo.

### V17 — Marcador no indica ruta navegable · P2 hipótesis
- Evidencia/causa: meta-ui.js:48–61 apunta directo; m1 requiere portales/islas.
- Solución: Waypoint al siguiente portal/ascensor, luego al destino.
- Esfuerzo: 1–2 d. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: Novatos alcanzan primer objetivo sin indicación externa ni salto imposible.

### V18 — Capas de progreso antes de validar el núcleo · P2 hipótesis
- Evidencia/causa: perfil.js:fresh reúne órganos, esencias, dos árboles, maestría, forja, cultivo, fauna, herbario, etc.
- Solución: Mostrar una mejora recomendada y desbloquear sistemas gradualmente.
- Esfuerzo: 1–2 d. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: 4/5 novatos explican su siguiente mejora; criterio propuesto, no resultado.

### V19 — Pages sin backend cooperativo predeterminado · P2
- Evidencia/causa: public/config.json servidor vacío; servidor.js excluye same-origin github.io. En Render same-origin sí aplica.
- Solución: Config por entorno con endpoint verificado.
- Esfuerzo: 1–2 h. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: Perfil limpio en Pages descubre backend compatible sin pegar URL.

### V20 — Evidencia artística y QA desactualizada · P2
- Evidencia/causa: INFORME_CALIDAD describe 63/69 tests históricos; ARTE_AUDIO niega importados aunque ASSETS los lista; ARTGATE_REGISTRY pendiente.
- Solución: Inventario y gate por asset/commit/captura; separar histórico de actual.
- Esfuerzo: 1–2 d. Impacto: reduce riesgo técnico o fricción de la experiencia inicial.
- Cierre objetivo: Licencias y loaders reconciliados, revisión visual de commit actual registrada.

## Registro complementario

| ID | Problema / evidencia | Solución | Esfuerzo | Cierre |
|---|---|---|---|---|
|A21|Guía marcada vista al mostrarse; `meta-ui.js:27`|Registrar práctica/confirmación|0,5 d|No perder ayuda sin ejecutar acción|
|A22|Primera misión secundaria pide melé en shooter; `metas.js:19–30`|Alinear misión al modo|2–4 h|Tres bajas con modo elegido satisfacen primera misión|
|A23|Texto Núcleo habla de compañeros y tecla E en solo/táctil; `data.js:OBJECTIVE_INFO`|Texto por dispositivo/equipo|2 h|Solo y táctil reciben instrucción realizable|
|A24|Invitado puede reiniciar sala terminada; `server.js:restart`|Permiso de anfitrión o voto|2–4 h|Invitado no reinicia sin autorización|
|A25|Sin límite de cola saliente WebSocket; `server.js:send/difundirSnap`|Control bufferedAmount y recuperación|1 d|Cliente lento no hace crecer cola sin límite|
|A26|Forja agrega espera y atajo con núcleos; `items.js:398–401; perfil.js:343`|Completar durante partida o quitar espera|2–4 h|No exige esperar mirando contador|
|A27|Respec pierde 25%; bendiciones irreversibles; `progresion.js; perfil.js:elegirBendicion`|Prueba gratuita inicial y decisión informada|0,5–1 d|Probar builds sin castigo inicial; hipótesis a testear|
|A28|Perfil cliente no apto para competición confiable; `server.js valida límites, no propiedad adquirida`|Coop normalizado o perfil autoritativo si hay ranking|3–5 d|Cliente no puede autoconceder poder competitivo|
|A29|Continuar reinicia en lugar de reanudar partida; `ui.js:89–93; main.js:812`|Etiqueta precisa hasta existir checkpoint|1–2 h|Nombre describe conducta real|
|A30|Sin evidencia actual de FPS iPhone/audio/comodidad; `Prueba visual bloqueada; sin dispositivo físico`|Matriz real PC/Safari/iPhone y escucha|1–2 d|Sesiones de 5/15/30 min registradas sin presentar emulación como hardware|

## Fallo adicional de QA detectado al cerrar el ciclo
La prueba existente de cuatro bots con latencia falla por `hay snapshots en común` (coop4.test.js:116), tanto en selección actual como aislada sobre commit original. Llega a oleada 4. Prioridad P1 de validación de red, asociada al grupo V02: no afirmar que las vistas se desincronizan sin investigar el fixture/buffering. Cierre: causa identificada y prueba fiable de snapshots coincidentes pasa bajo latencia. Esfuerzo estimado 0,5–1 día.

## Primera experiencia: las seis preguntas
| Pregunta | Respuesta implementada | Evaluación |
|---|---|---|
| ¿Dónde estoy? | Prólogo del tren y despertar en Vórtice | Identidad clara en contenido; larga espera sin saltar |
| ¿Qué hago? | Sobrevivir oleadas, objetivo y jefe; HUD principal/secundario | Existe, no es ausencia de misión; tutorial compite con acción |
| ¿Adónde voy? | Flecha al objetivo, landmarks y portales | Ruta directa no siempre equivale a ruta transitable |
| ¿A quién enfrento? | Familias de criaturas y jefes con fases | IA probada parcialmente; lectura visual y audio pendientes |
| ¿Qué gano? | Munición/curación, botín, núcleos, maestría, bendición | Recompensa existe; errores y persistencia debilitan confianza |
| ¿Por qué repetir? | Builds, huéspedes, armas, arenas, progresión | Muchas opciones; disfrute humano y deseo de repetir sin medir |

La estación sí existe como prólogo 3D. No se verificó una estación explorable persistente. La ruta principal es corta; otras arenas existen separadamente. “Continuar” no equivale a restaurar una partida suspendida.

Propuesta de primer minuto: 0–10 s despertar con movimiento y objetivo visible; 10–30 s primer enemigo con aviso legible; 30–60 s completar acción y recibir una recompensa explícita. Cinemática completa opcional. Es un diseño propuesto, no cambio implementado ni tiempo medido.

## Diez mejoras de mayor impacto con menor esfuerzo
| Orden | Mejora | Estimación | Evidencia de cierre |
|---|---|---|---|
|1|Normalizar núcleos V08 — implementado|1–2 h|Regresión 100 + 5 = 105|
|2|Reponer arsenal real V09 — implementado|1–2 h|Vesper/Micelio con límites y munición infinita|
|3|Aviso y recuperación de error de guardado V01|0,5–1 d|Storage denegado visible y recuperable|
|4|Estado de fallo WebGL V04|2–4 h|Sin contexto muestra explicación y reintento|
|5|Pausar tutorial solo y confirmar visto V12|0,5 d|No avanza daño ni oleada bajo modal|
|6|Acotar editor táctil V15|2–4 h|Botones siempre dentro de zona segura|
|7|Alinear misión inicial al modo A22|2–4 h|Objetivo realizable con control recién enseñado|
|8|Corregir etiqueta Continuar A29|1–2 h|No promete un checkpoint inexistente|
|9|Textos de objetivo por dispositivo A23|2 h|No solicita E en pantalla táctil ni compañero en solo|
|10|Config de backend de Pages V19|1–2 h|Coop accesible desde perfil limpio|

Recuperación/idempotencia de premios queda por encima en prioridad técnica, pero no se vende como arreglo trivial. No se aplican cambios de diseño amplios sin validación.
