# VORTEX — QA del Bloque 0

Fecha local 21/10/2026. Base 9b7d54a. Evidencia nueva de este ciclo; no reutiliza los números del informe histórico.

## Resultado
**No hay certificación global verde.** Dos correcciones lógicas validadas; defectos pendientes de progreso, reconexión y balance. El navegador remoto no pudo crear WebGL y no hubo iPhone físico. No se observó diversión ni ergonomía real.

| Ejecución | Resultado | Alcance |
|---|---|---|
| npm ci | Correcto | Dependencias del lockfile |
| node tools/build-static.js (antes y después) | Correcto, 48,4 MB informados | Empaquetado, no prueba de carga/render |
| npm test completo | Iniciado, interrumpido a ~8 min durante suites de bots | No terminado; no reportar pass global. Comenzó antes de cambios y pudo leer archivos modificados después: no es baseline inmutable. |
| Selección de armas/física/IA/oleadas/límites/red/objetivos/tienda + regresiones | 102 tests: 101 pass, 1 fail, 0 skip; ~222 s | `targeted.txt`; falla coop4 por no encontrar snapshots comunes |
| Regresiones + director + tienda | 33 pass, 0 fail, 0 skip | `fixes-final.txt`, verde final de cambios entregados |
| Coop4 aislado contra commit original | 1 fail, misma aserción; ~117 s | `coop4-baseline-isolated.txt`: llega a oleada 4, sin snapshots comunes. No atribuible a los dos fixes; causa pendiente. |
| Perfil/inventario/tienda | 50 tests: 49 pass, 1 fail | `currency-after.txt`; balance legendario vesper melee k0: 7.5→16.5 |
| Balance contra original aislado | 1 fail, mismo resultado | `inventory-baseline.txt`; original extraído con git archive, dependencias compartidas; no causado por fixes |
| tests/e2e + coop-browser | 4 omitidos, 0 ejecutados | `browser-skips.txt`; falta Chromium esperado en /opt/pw-browsers |
| Instalación Chromium | Falló | ZIP descargado inválido; no se dispone de navegador local usable |
| Navegador remoto de servicio Render | Título visible, botón no avanza | WebGLRenderer no crea contexto (GL disabled); límite de entorno + falta de aviso de error del juego |
| Render | Servicio identificado, deploy live del commit base | /health responde ok=true, proto=2; no prueba una partida completa ni una garantía de disponibilidad |
| Reanudación final coop, fixture | Fallo esperado | `resume-final-known-failure.txt`; clientes WebSocket reales, estado won inyectado, no victoria jugada |
| Diferencias y estáticos | git diff --check correcto | 261 JS en src; escaneo literal de imports relativos no encontró ausencia real tras descartar ejemplo comentado en eyes.js. No auditoría exhaustiva de assets dinámicos/código muerto. |

No sumar cifras entre filas: hay pruebas repetidas.

## Reproducibilidad de cambios

```sh
npm ci
node --test tests/objective-ammo.test.js tests/perfil-currency.test.js tests/director.test.js tests/tienda.test.js
node tools/build-static.js
# Fallo conocido, intencionalmente fuera de tests/*.test.js:
node --test tools/audit/coop-resume-result.repro.js
# Fallo de balance existente:
node --test --test-name-pattern='equilibrio: con TODO' tests/inventario.test.js
```

Munición: dos fixtures Vesper/Micelio fallaron antes y pasan después; cubren armas finitas equipadas, capacidad mejorada, no equipadas y munición infinita. Moneda: dos fixtures fallaron antes (concatenación y saldo inválido), pasan después con persistencia del 105. Los datos de almacenamiento son fixtures locales, no perfiles reales.

## Matriz solicitada de experiencias

| Escenario | Estado actual | Procedimiento y aceptación pendientes |
|---|---|---|
| Primera partida | No verificado visualmente | Perfil nuevo, sin query de auto/god; título → Jugar → campaña. Registrar tiempos y errores; llegar a control sin ayuda. |
| Primer combate | Parcial: armas/IA probadas en lógica | Primer enemigo en ≤30 s desde entrada; apuntar/disparar/melé con lectura de impacto. |
| Primera muerte | Parcial: lógica muerte/derrota/revivir aprobada | Morir sin modo dios; entender motivo y reiniciar en ≤2 acciones. |
| Primer objetivo | Parcial: director + regresión munición aprobados | Llegar con navegación normal, completar y reconocer recompensa en HUD. |
| Primer desbloqueo | Parcial: tienda/progresión de lógica | Nueva cuenta, ganar recursos reales y comprar/desbloquear sin editar storage. |
| Sesión 5 min | Pendiente humana | PC y Safari iPhone: controles, objetivo y pérdida de foco; registrar errores. |
| Sesión 15 min | Pendiente humana | Completar ruta, morir/reintentar, gastar recompensa; medir FPS/memoria y claridad. |
| Sesión 30 min | Pendiente humana | Varias partidas/transiciones; guardar, recargar, temperatura y memoria sin crecimiento sostenido. |
| Sin conocer controles | Pendiente humana | Novato sin explicación externa; observar acciones, ayudas y comprensión. |
| Explorar sin misión | Pendiente humana | Alejarse de ruta, portales, retorno y orientación; sin zona irrecuperable. |
| Intentar romper sistemas | Parcial | Física/fuzz, límites, mensajes inválidos y permisos básicos ejecutados; faltan multi-tab, storage denegado, orientación y reanudación repetida. |
| Dos participantes | Parcial: WebSocket local aprobado | Dos dispositivos en red externa, lobby/listos/inicio/objetivo/muerte/fin; browser real pendiente. |
| Cuatro bots con 200 ms | Defectuoso en corrida seleccionada | Llegó a oleada 4; falló aserción de snapshots comunes. No equivale por sí solo a desincronización visible; investigar test y buffering. |

El avance acelerado de una simulación no es una sesión humana de 5/15/30 minutos. Emulación móvil Chromium tampoco es Safari ni iPhone físico.

## Gates para integrar/publicar
- Tests de cambios verdes, reproducción conocida explicada, revisión de diff.
- Resolver fallos de guardado/premios y balance antes de declarar versión comercial.
- E2E real obligatorio (no omisión silenciosa) y build publicados desde una sola rama.
- Validación de primera partida PC y Safari/iPhone; evidencia por commit.
- Este ciclo prepara PR borrador; no merge ni despliegue.
