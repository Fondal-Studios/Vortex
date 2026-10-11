# Diseño de juego

## Pilares
1. **Moverse es sobrevivir.** Arenas abiertas, hordas, nada de cobertura pasiva.
2. **La física rota es mecánica, no decoración.** Cada zona de gravedad cambia cómo se pelea.
3. **Patrones legibles.** Toda amenaza avisa (brillo, giro, carga) antes de pegar.
4. **Belleza rara.** Formas simples, colores saturados, escalas imposibles.

## Controles
| | PC | Mando (DualSense/Xbox) | iPhone |
|---|---|---|---|
| Mover | `WASD` | stick izq. | palanca virtual (al borde: correr) |
| Mirar | ratón | stick der. | arrastrar a la derecha |
| Disparar | clic izq. | R2 | botón DISPARO (arrastrable) |
| Saltar | `ESPACIO` | ✕ | SALTO |
| Correr | `SHIFT` | L3 / L2 | CORRER |
| Arma | `1–5` / rueda | L1 / R1 | ‹ › o tocar el nombre |
| Pausa | `ESC` | Options | ❚❚ |

Menús: flechas/WASD + Enter/Esc, mouse, toque o D-pad/stick + ✕/○. Hay una pequeña asistencia de puntería en táctil.

## Cooperativo (2–4)
Cada pasajero tiene color propio y nombre sobre la cabeza. Si cae, un compañero que se quede **3 s a menos de 3,5 u** lo **reanima** (50 de vida); si no, revive al empezar la próxima oleada. Las hordas escalan +60 % por jugador extra.

## Jugador
Vida 100 (no se regenera) + escudo 100 (se regenera 35/s tras 3 s sin daño). Caer al vacío: −25 y reaparecer. Entre oleadas: +40 de vida y botiquín/munición alrededor. Solo: derrota al caer (reintentar). Coop: el caído revive al empezar la próxima oleada.

## Armas
| # | Arma | Tipo | Daño | Cadencia | Munición (inicio/máx.) | Rol |
|---|---|---|---|---|---|---|
| 1 | **Haz** | hitscan | 22 | 0,26 s | ∞ | Respaldo preciso; siempre disponible |
| 2 | **Prisma** | escopeta, 9 perdigones | 12 c/u | 0,8 s | 20 / 48 | Cuerpo a cuerpo, hordas pegadas |
| 3 | **Ráfaga** | automática | 11 | 0,085 s (≈12/s) | 150 / 360 | Dañador general |
| 4 | **Nova** | cohete, área 8 u | 100 | 1,0 s | 10 / 32 | Multitudes y Geodas; sin daño propio |
| 5 | **Aguja** | riel, atraviesa | 170 | 1,4 s | 10 / 28 | Jefes, objetivos en fila |

Sin munición se vuelve al Haz. Las criaturas sueltan botiquines/munición (18 %; 30 % si hay jugadores heridos; la Geoda siempre suelta munición).

## Oleadas
Calma inicial de 4 s → goteo de spawns → oleada limpia → respiro de 7 s. 6 oleadas + jefe por mapa. Tope de criaturas vivas 44 (+10 por jugador extra), duro 90. Si una criatura queda inalcanzable >7 s se reubica cerca de los jugadores.

## Arquitectura multijugador (diseñada desde el día uno)
```
 navegador A ─┐ entradas (30 Hz)            ┌─ snapshots 20 Hz ─▶ navegador A (interpola 110 ms)
 navegador B ─┼──────────▶  server/server.js ┤
 navegador C ─┘   WebSocket   └ src/sim/Game ┴─ snapshots 20 Hz ─▶ navegador B …
                              (60 Hz, autoritativo)
```
- Una `Game` por sala (hasta 4 jugadores). El cliente en solitario usa **la misma** `Game` en proceso.
- `snapshot()` es JSON plano; `events` se vacían en cada snapshot (disparos, bajas, explosiones → efectos y audio del cliente).
- Escalado por jugador: hordas +60 %/jugador, jefes +70 % de vida/jugador.
- **Prototipo en LAN** (`npm start`, abrir `http://IP:8080` en varias máquinas). Qué falta: ver `INFORME_CALIDAD.md`.
