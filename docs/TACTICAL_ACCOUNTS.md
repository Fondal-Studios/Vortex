# Minimapa, reanimación y cuentas persistentes

## HUD táctico

- Mapa relativo al huésped: arriba es su frente, radio de 90 unidades. La proyección usa su plano de gravedad, incluyendo arenas esféricas. Huellas de terreno, anillos de distancia y flechas de altura; los destinos lejanos permanecen en el borde.
- Formas: triángulo = huésped; círculo = aliado; cruz = caído; aspa = enemigo; rombo = élite; estrella = jefe; cuadrado = objetivo principal; bandera = misión secundaria. No depende únicamente del color.
- Objetivos activos transmiten todos sus destinos, no sólo el más cercano. Las misiones de melé, élite y alimentación señalan blancos válidos. Intocable no tiene lugar físico: conserva el texto de misión existente.
- Opacidad 20–100 %, guardada por dispositivo; editable en Opciones o en «Símbolos · opacidad». Canvas 2D a 10 Hz, sin nuevas geometrías, luces ni draw calls WebGL.
- Reanimar: mantener E, USAR del mando o botón táctil junto a un aliado caído a menos de 3,5 unidades. El servidor valida elegibilidad y elige el más cercano. Tres segundos; Soporte, 1,5. Soltar deja decaer el progreso. Alejarse, caer, desconectarse o perder al aliado oculta el botón. Las habilidades de reanimación instantánea conservan su comportamiento.

La simplificación de HUD de la PR1 es una tarea separada. Los puntos de integración son `createTacticalHUD`, `readInput`, la actualización del HUD y un slider en Opciones. Preservarlos cuando se integre esa PR.

## Cuentas

El menú «Cuenta» permite registrar usuario/contraseña, iniciar y cerrar sesión, recuperar mediante código privado y guardar/restaurar progreso entre dispositivos. El respaldo es **manual**, con confirmación antes de reemplazar el perfil local. No se mezclan automáticamente dos perfiles.

El servidor usa PostgreSQL mediante `DATABASE_URL`. Sin esa configuración responde 503 para cuentas y mantiene disponible el juego como invitado: nunca crea cuentas temporales en el disco efímero de Render. Las migraciones iniciales son aditivas e idempotentes. Tablas `vortex_accounts` y `vortex_sessions`.

Contraseñas con scrypt N=32768/r=8/p=1 y sal aleatoria; token de sesión aleatorio de 256 bits, sólo su SHA-256 en la base, cookie HttpOnly/SameSite=Strict/Secure bajo HTTPS. Sesiones de siete días, revocadas al cerrar o recuperar cuenta. Recuperación con código aleatorio de un solo uso, almacenado como hash; el nuevo código sólo se muestra al usuario. No se recoge correo. Sin el código ni contraseña no hay recuperación automática.

API de mismo origen, JSON y cabecera propia para mutaciones; rechaza origen cruzado. Límite de 96 KiB por petición, quince mutaciones por IP/minuto, cuatro hashes simultáneos. SQL parametrizado y revisión optimista para detectar escrituras concurrentes (409). El service worker excluye `/api/` de caché.

El perfil respaldado sigue siendo progreso declarado por el cliente. **No es un registro autorizado de compras**, no verifica propiedad de equipamiento en WebSocket y no habilita cobros. La economía con dinero real requiere un ledger y validación de recibos separados (ver COSMETIC_COMMERCE.md).

### API

Base `/api/account`; POST requiere `Content-Type: application/json` y `X-Vortex-Account: 1`.

| Ruta | Método | Datos |
|---|---|---|
| `/register` | POST | username, password |
| `/login` | POST | username, password |
| `/me` | GET | sesión por cookie |
| `/profile` | POST | profile, revision |
| `/logout` | POST | objeto vacío |
| `/recover` | POST | username, password nueva, recovery |
| `/password` | POST | currentPassword, password nueva; invalida sesiones |

## Activación concreta en Render — pendiente de costo

Inspección del 2026-10-22: `shower-psico-coop`, región Virginia, plan web Free, despliegue automático desde `claude/larga-con-eso-s43nfe`. **No está siguiendo main**. No se modificaron otras aplicaciones ni sus bases.

Propuesta: base propia `vortex-accounts`, PostgreSQL 18, Virginia, plan `0.1c-256mb` (alias aceptado por MCP `basic_256mb`), 1 GB inicial. Precio publicado: US$6/mes; confirmar importe en creación. Fuente: https://render.com/pricing y https://render.com/docs/compute-plans. Una base Free vence a los 30 días y no cumple persistencia de producción.

Después de aprobar ese costo:

1. Crear la base propia en My Workspace/Virginia; acceso externo restringido.
2. Configurar su URL **interna** como secreto `DATABASE_URL` en `shower-psico-coop`, preservando el resto de variables. `TRUST_PROXY=1` permite cookies Secure detrás de Render.
3. Cambiar la rama del servicio a `main` y health check `/health`. El conector actual no expone cambio de rama: realizarlo en Dashboard o con una API autorizada. No sobrescribir la rama anterior ni fusionar la PR1 como atajo.
4. Esperar autodeploy (no disparar otro despliegue duplicado). `/health` debe indicar `accounts: true`.
5. Verificar registro, respaldo, reinicio y restauración con una cuenta de QA; configurar respaldo/PITR según el plan. Mantener credenciales y códigos fuera de logs y repositorio.

Se usa el juego servido por el backend para cuentas. GitHub Pages sigue siendo estático y no aloja esta API; no se permite CORS de credenciales hacia un servidor arbitrario.

## Validación

- `node --test tests/accounts.test.js tests/tactical.test.js tests/ai.test.js tests/director.test.js`
- Persistencia con PostgreSQL embebido PGlite sobre un directorio temporal, cierre/reapertura de base y servidor; sesión, recuperación, rechazo de código reutilizado, CSRF y conflictos de revisión.
- `node tools/check-tactical-accounts.mjs`: Chromium/WebGL, cuenta por interfaz, sala real y botón → WebSocket → simulación autoritativa, capturas Baja/Alta/móvil.
- Capturas e informe en `docs/tactical/`; el fixture usa personajes y objetivos reales del servidor con oleadas detenidas para reproducibilidad.

Resultados del bloque: 39 pruebas de cuentas/táctica/IA/director pasan; flujo de cuenta y reanimación por interfaz escritorio y táctil pasa sin errores JS; build estático válido. El ensayo de cuatro bots con 200 ms de latencia llega a oleada 4, verifica reconexión y estados iguales, con 18,4 KB/s comprimidos por jugador. Se corrigió su instrumento de comparación: ahora conserva historia de 256 snapshots en la prueba, en lugar de comparar buffers visuales de sólo 12 fotogramas a velocidad artificial 6× (menores que la latencia inyectada). No se relajó igualdad ni frescura de red.

La suite general también detecta una expectativa heredada fuera de este bloque: `tests/arsenal.test.js` espera diez personajes, mientras `CHARACTER_IDS` de main ya contiene trece. Los datos de personajes y ese test no fueron modificados aquí; no se declara toda la suite verde.
