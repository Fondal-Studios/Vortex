# Menú de Gráficos (dueño, 2026-10-18)

**Para qué sirve:** que cualquiera pueda elegir cómo se ve el juego en su equipo —sobre todo en el teléfono— sin buscar un selector escondido. Está en dos lugares:
**Menú principal › Gráficos** y **Pausa › Gráficos…** (dentro de la partida). Es el mismo panel en los dos.

## Qué se puede elegir
| Cosa | Opciones | Qué hace / cuánto pesa |
|---|---|---|
| **Preset** | Baja · Media · Alta · Automático | Un conjunto de ajustes listo. Cada tarjeta dice para qué equipo sirve y cuál es el recomendado para el tuyo. |
| **Escala de resolución** | 50 % – 150 % (de a 5) con − / + y deslizador | Qué tan nítida es la imagen. 100 % = la del preset. **Lo que más FPS da en el teléfono es bajarla.** Dice a cuántos píxeles se dibuja. |
| Sombras | Sí / No | Lo más caro (costo 3 de 3). Reconstruye la escena. |
| Resplandor (bloom) | Sí / No | Halo de luz de lo que brilla (2/3). |
| Color y contorno | Sí / No | Color final del mapa, viñeta y borde de luz del Huésped (1/3). Apagado cuesta leer al Huésped. |
| Niebla de aire | No · 1 · 2 · 3 capas | Bruma de profundidad de cada mapa (2/3). |
| Partículas | Pocas · Normal · Muchas | Chispas, humo y esquirlas (1/3). |
| Nubes de las nieblas de colores | Sólo aviso · Simples · Completas | Cuántas nubes se dibujan (1/3). El efecto en el juego no cambia. |
| Detalle de Huéspedes y criaturas | Bajo · Medio · Alto | Polígonos de los cuerpos (2/3). Reconstruye la escena. |
| Decorado del mapa | Sí / No | Cielo en capas, ojos cósmicos, vegetación (2/3). Reconstruye la escena. |
| Distancia de dibujo | Corta · Normal · Larga | Hasta dónde las criaturas se ven con todo su detalle (1/3). |
| Límite de FPS | 30 · 60 | 30 gasta la mitad de batería y calor (2/3). |
| Claridad | Normal · Alta | Relleno y borde de luz sobre el Huésped y los enemigos (ver `docs/CONCEPTO_ARTE.md`). |
| Medidor de FPS | Sí / No | Numerito en la esquina: verde bien, ámbar justo, rojo lento. El panel siempre muestra los FPS de ese momento. |
| Bajar sola si va lento | Sí / No | **Automático** (AutoQuality): tras 5 s seguidos con menos de 24 FPS baja un escalón (Alta → Media → Baja) y, ya en Baja, la resolución de a 15 puntos hasta 60 %. Se puede apagar. |

Cada fila trae su **nota de costo** («casi nada» … «mucho») y una línea que explica qué cambia; las que reconstruyen la escena (⟳) lo avisan.

## Qué preset elegir
- **iPhone / teléfonos → Baja** (o **Media** en iPhone 12 o más nuevo). Si se calienta: bajá la escala o limitá a 30 FPS.
- **iPad y notebooks → Media.** **PC con placa de video → Alta.** **No sé → Automático** (elige por tu equipo y baja solo).

## Cómo se aplica y se recuerda
- **En vivo, sin recargar:** resolución, bloom, color, niebla de aire, partículas, nubes de nieblas, distancia de dibujo, FPS, medidor, Claridad y Automático.
  **Reconstruye la escena (1-2 s):** sombras, detalle de criaturas, decorado y cambiar de preset (como ya hacía el selector viejo).
- Se guarda en este dispositivo (`localStorage` · `cristal.graficos.v1`): `{ preset, auto, medidor, ajustes:{sólo lo que cambiaste} }`. Quien ya había elegido calidad con el selector viejo (`cristal.calidad.v1`) conserva su elección.
- **`?q=low|medium|high` en la dirección manda** sobre lo guardado (herramientas y pruebas): no aplica ajustes guardados ni baja la resolución sola.
- El selector rápido de Opciones (Baja/Media/Alta) sigue funcionando como atajo y refleja lo elegido acá; en la Pausa lo reemplaza el botón «Gráficos…».
- El límite de FPS salta cuadros en el bucle principal sin perder tiempo de simulación (por defecto 60 en todos los niveles: en pantallas de 120 Hz también ahorra batería).

## Código
- `src/client/graficos.js` — **parte pura** (presets, ajustes, guardado, traducción a `quality.js`): probada en `tests/graficos.test.js` (11 pruebas).
- `src/client/graficos-ui.js` — pantalla, medidor y conexión con el juego. Estilos: `public/graficos.css` (mismo lenguaje que `territorios.css` / `huespedes.css`; botones ≥ 44 px, teclado/mando/táctil).
- `src/client/quality.js` — `LEVELS` (con `fogLayers`, `nieblas`, `scale`), `setOverrides()`/`cfg()` (nivel + ajustes), `AutoQuality`.
- `src/client/render.js` — `applyQuality(nivel, {rebuild})` y `applyScale()`; `src/client/post.js` — `GradePass(nivel, {layers})`.
- Prueba en navegador: `node --test tests/graficos-ui.test.js` (presets en vivo, resolución, recordar, medidor, Pausa, iPhone apaisado).

## Sin probar
iPhone real y GPU real: todo se probó con Chromium por software (SwiftShader), donde los FPS no son representativos. La recomendación «iPhone 12 o más nuevo → Media» es una estimación, no una medición.
