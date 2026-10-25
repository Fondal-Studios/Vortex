# Recompensas, resultados y guardado (Sprint 1)

Código: `src/sim/recompensas.js` (reglas), `src/sim/ledger.js` (recibos), `src/sim/perfil-esquema.js` (esquema y copia),
`src/sim/resultados.js` (pantalla final), `src/client/perfil.js` (`cerrarPartida`), `server/server.js` (mensaje `fin`).
Pruebas: `tests/ledger.test.js`, `tests/guardado.test.js`, `tests/resultados.test.js`, `tests/coop-resume.test.js`, `tests/coop4.test.js`, `tests/resultados-browser.test.js`.

## 1. Cada partida tiene un `matchId` y deja un recibo
- Solo: lo crea el cliente al empezar (`session.matchId`). Cooperativo: lo emite el **servidor** (`crypto.randomUUID()` por partida) y viaja en `fin`.
- `cerrarPartida(char, jugador, info)` busca el `matchId` en el **ledger** del perfil (últimos 50 recibos, con huella del resultado).
  Si ya está, **no suma** (devuelve el recibo, `duplicado: true`). Recarga, reintento de red, doble clic y reconexión no duplican premios.
- Transaccional: los guardados intermedios se difieren; se escribe todo junto (premios + recibo). Si falla, se **deshace** en memoria y la partida
  queda en la **cola de pendientes** (memoria + clave aparte `cristal.pendientes.v1`). `reintentarGuardado()` la acredita al volver el almacenamiento, una sola vez.
- Sin `matchId` (pruebas viejas) se deriva uno del contenido: repetir exactamente la misma llamada tampoco suma.

## 2. Guardado robusto
- `guardar()` devuelve `{ ok, motivo, mensaje }` (`lleno`, `bloqueado`, `verificacion`, `version`, `desconocido`) y verifica leyendo lo escrito.
- `estadoGuardado()` / `alGuardar(fn)` para la interfaz. La pantalla final muestra un aviso rojo con **Reintentar guardado**, **Descargar copia** y **Copiar texto**.
- Copia: `exportarProgreso()` → texto `VORTEX-COPIA-1:…` con huella; `importarProgreso(texto)` rechaza texto cortado/editado y **une los ledgers** (importar una copia vieja no permite cobrar de nuevo).
- Esquema: `esq` (guardado) migra perfiles viejos (`inv`→`inventario`, núcleos como texto, sin ledger). Un perfil de versión futura no se sobrescribe. Un JSON dañado deja copia en `cristal.perfil.v1.corrupto` en vez de pisarse en silencio. (`ver` es del onboarding y no se toca.)

## 3. Regla de recompensas (GDD §4)
«Biomasa» = esencias: es un banco que se arrastra, no un premio de fin de misión; no se recorta.

| Concepto | Victoria | Derrota (parcial) |
|---|---|---|
| Núcleos ganados | 100 % | 25 %–60 % según etapas superadas / total |
| XP de maestría | completa (+60 de victoria) | 50 % de la XP por bajas y etapas + hitos (etapa 10, objetivo 20, secundario 15, élite 8; tope 150) |
| Puntos de árbol | 100 % | 50 % |
| Materiales y semillas del botín | 100 % | 25 %–75 % (mín. 1 por pila; **0** si no superó ninguna etapa) |
| Objetos de equipo, planos (incl. de jefe), arma firma | sí | **no** |
| Avance de capítulo, territorio y bendición, desbloqueo de huéspedes | sí | **no** |
| Maduración de piezas, pity, esencias sobrantes | sí | sí (es estado, no premio) |

### Cooperativo (la calcula el servidor al terminar y la manda en `fin.recompensa`)
- Botín **personal**: cada jugador recibe sólo el suyo (también al reanudar).
- Base 1,0 para todo participante legítimo. Bono por contribución hasta **+25 %**: cada categoría (daño, objetivos, apoyo, reanimaciones) se mide contra el mejor del equipo;
  aporte = 60 % mejor categoría + 40 % promedio de las categorías en juego → quien apoya o reanima rinde igual que quien hace daño.
- Anti-AFK: sin aporte mínimo (150 de daño, 1 objetivo, 2 apoyos, 1 reanimación, 1 élite o 3 bajas, y ≥ 20 s presente) la base baja a 0,5 y no hay bono. En solitario no hay bono.
- El multiplicador (`base + bono`) escala núcleos y XP; la regla de derrota se aplica encima.

## 4. Pantalla de resultados
Una sola (solo y coop): título, Oleada/Etapa X/Y, tiempo, recompensa (parcial marcada), botín, desbloqueos con animación breve, aviso de guardado,
y **Ver detalle** (objetivos obligatorios/secundarios/élites, tu aporte, tabla del equipo, qué sólo da la victoria). Reemplaza al texto de botín de `perfil.botinTexto()`;
el botín **en partida** sigue siendo `botin-hud.js`. Botones: **Reintentar**, Entrar a la Base, Menú principal.

## 5. Cooperativo: resultado y reconexión
El servidor guarda el resultado de la sala (`room.fin`) y lo **reenvía al reanudar** (`resume`) con el mismo `matchId`; el cliente cobra con ese id.
Una sala terminada sin nadie conectado se cierra sola pasado el tiempo de gracia.

## No cubierto / pendiente
Autoridad total del servidor sobre el perfil (hoy el perfil vive en `localStorage` y el servidor sólo acota el resultado); sincronización con cuentas tácticas;
bots/sustitución de desconectados; pruebas con humanos, iPhone e internet real.
