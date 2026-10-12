# Art Gate — Efectos de combate (disparos, impactos, sonido)

Estado: ver "Veredicto" al final. Dueño del trabajo: agente de combate visual. Sigue la rúbrica de `docs/ARTGATE.md`.

## Qué estaba mal
El dueño jugó y dijo: "Los disparos no tienen efectos, no se ven." Era cierto, y por tres causas medidas en capturas reales:
1. **El fogonazo y la traza nacían en un punto casi sin ancho**: el cañón apunta casi al centro de la pantalla, así que una línea del cañón al blanco mide 30-60 px y se ve como un punto.
2. **Todo duraba menos que un cuadro** en equipos lentos (`life` de 0,05-0,1 s con cuadros de 0,1 s): el efecto se creaba y moría antes de dibujarse.
3. **Sólo había 5 sonidos de disparo** (`Sound.shot` cubría las armas 0-4) y ninguno de impacto con identidad.

## Qué se hizo (por archivo)
- `src/client/combatfx.js`
  - **Disparo en 1ª persona** (`firstPerson`): fogonazo de pantalla pegado a la cámara en la boca REAL del arma (se lee del viewmodel: `muzzleWorld`), con el dibujo propio de cada arma (estrella, abanico, rayo, hielo, anillos...; usa `flashTexture` de `weapons/fx.js`, sólo lectura) + halo del color canon del arma + lavado de color de pantalla (hace de "luz" también en Baja, donde no hay PointLight) + luz de fogonazo (la PointLight existente, sólo Alta).
  - **Trazas** (`ray`): halo de color + núcleo blanco + cabeza luminosa que viaja, 0,2-0,6 s de vida, aditivas. Nacen un poco a la derecha/abajo de la boca para que se lean como línea. Familias: rayo (Haz, Pulso, Ráfaga, Gemelas, Dardos, Glaciar, Réquiem), rayo con hélice y anillos (Aguja), zigzag con ramas (Fractal, Voltaico), onda (Cetro, Plaga), chorro de llamas (Solar, Brasa), abanico de rayos de color (Prisma), escopeta (Eclipse), hoja giratoria (Sierra), proyectiles con estela (Nova, Enjambre, Cometa, Vórtice, Lanza, Sembradora).
  - **Impactos** (`impact`): destello de color + estrella blanca + onda sobre la superficie + chispas/esquirlas/humo según estilo (chispa, cristal, anillo, hielo, veneno, fuego, rayo, vacío, explosión, corte, vida) + quemadura breve en pared/suelo. El tamaño escala con la distancia (de lejos se agranda para verse; de cerca se achica para no tapar). Sobre criaturas: brillo del material herido y salpicadura por material (fluido / cristal / roca / energía). **Crítico**: estallido dorado grande, onda con color separado, estrellas, golpe de FOV y sacudida chica.
  - **Patada de cámara y golpe de FOV** (`postCamera`, se engancha sola a `Renderer.updateCamera`): potencia por arma en `WS` (`kick`, `fov`), sacudida en explosiones y muertes (`addShake`). **Respeta "reducir movimiento"**: `localStorage['cristal.reduceMotion']==='1'` o la preferencia del sistema `prefers-reduced-motion` → sin golpe de FOV, patada al 15 %, sacudida al 10 %, lavado al 25 %.
  - **Tablas por arma** al final del archivo: `WS` (ficha visual de las 25 armas + variantes de la Quimera), `MZ` (fogonazo de mundo, para los demás jugadores), `TIPS` (estilo de impacto), `TRACE` (traza).
- `src/client/effects.js`: las cintas tienen **ancho mínimo en pantalla** (una traza lejana ya no se vuelve un hilo invisible); los efectos **no envejecen más de 0,05 s por cuadro** (en equipos lentos un destello llega a dibujarse al menos un cuadro); más destellos/anillos/marcas en Baja (12/8/6).
- `src/client/render.js` (sólo `handleEvents` y la luz): el origen del disparo propio sale de `C.muzzleWorld(this)` (boca real del viewmodel); la luz de fogonazo la fija `combatfx` por arma y decae seca; la sacudida de explosión y de jefe respeta "reducir movimiento".
- `src/client/audio.js` (sólo armas/impactos/muertes): **25 sonidos de disparo sintetizados** (WebAudio, sin archivos), cada uno = golpe grave + chasquido + cola, por familia (ver tabla). Más: `hit` (3 variantes), `boom` (golpe sub-grave + estallido + retumbo), `hitmark` (golpe / crítico / blindado / eliminación, ahora audibles), muerte (`voice(kind,'die')` agrega rotura de cristal + golpe sordo). Respeta `Sound.setVolume` (todo pasa por `master`) y el panorama por posición; las armas de cadencia loca tienen compuerta (`_gate`) para no saturar. En modo CAP `main.js` reemplaza `shot/hit/boom/voice` por el registro `__evlog`: los ayudantes nuevos (`thump`, `crack`, `_shot`, `_gate`) no se registran, así que el registro no cambia.
- `src/client/hud-combat.js`, `src/client/shotfx.js`: sin cambios en esta pasada (el HUD ya estaba conectado y el marcador ahora suena).

### Sonidos (todos sintetizados)
| Familia | Armas | Receta |
|---|---|---|
| Láser / pulso | Haz, Pulso | golpe 150-210 Hz + zap diente de sierra 2400→240 Hz + chasquido |
| Esquirlas | Prisma, Lanza, Dardos | golpe + ruido de banda + campanitas de cristal |
| Automáticas | Ráfaga, Gemelas | golpe corto + chasquido + tic; con compuerta 40-45 ms |
| Cañón pesado | Nova, Cometa, Mina | golpe 80-160 Hz→28 + cola de ruido + silbido / clic metálico |
| Riel | Aguja, Réquiem | carga que sube + chasquido + campana grave (Réquiem: sub-grave 55 Hz) |
| Eléctrico | Fractal, Voltaico, Quimera(azar) | zumbido + 4-5 chisporroteos de ruido agudo |
| Fuego | Solar, Brasa | siseo/crepitar con compuerta 45 ms |
| Hielo / veneno / vida | Glaciar, Plaga, Cetro | crujido de hielo / burbujas viscosas / dos notas cálidas |
| Salva | Enjambre | 5 silbidos escalonados |
| Escopeta | Eclipse | golpe 90 Hz→26 + estallido + bombeo (2 clics) |
| Gravedad / onda | Vórtice, Pulsar | succión ascendente / sub-grave 75 Hz + onda |
| Cuchilla | Sierra | zumbido de hoja corto con compuerta |

## Costos (medidos; ver `tools/combatfx-test.js`)
Ver sección "Mediciones" al final.

## Rutas
- Capturas definitivas: `shots/gate/combatfx/arma-NN-low.jpg` (25 armas) y `arma-NN-high.jpg` (18 armas), 844×390 (celular horizontal). Escenas: `escena-*.jpg`, `muerte-*.jpg`.
- Herramientas nuevas: `tools/shot-combatfx-real.js` (captura en tiempo real, sin cámara lenta; congela los efectos 0,05 s después de un disparo NUEVO y reintenta si justo no hay destello), `tools/combatfx-test.js` (presupuesto y "reducir movimiento"), `tools/audio-combatfx-test.js` (renderiza cada sonido sin conexión: pico, duración, brillo).
- Cómo repetirlo: `node tools/shot-combatfx-real.js todas low shots/gate/combatfx 844 390 500 0.05` (y `high`). `SIN_BLANCOS=1` dispara al horizonte. `node tools/combatfx-test.js low`. `node tools/audio-combatfx-test.js`.

## Cambios requeridos en `main.js` u otros
Ninguno obligatorio. Opcionales:
1. Un interruptor en Ajustes para "Reducir movimiento" que escriba `localStorage['cristal.reduceMotion']='1'` (hoy se respeta si existe, o la preferencia del sistema).
2. `main.js` llama `sound.shot(e.w, ...)` con el número de arma: ya cubre las 25. Si algún día el evento `shot` trae `e.fx` (Quimera), se podría pasar para elegir el sonido exacto (hoy la Quimera suena a azar entre 7 familias).
3. `sound.hit(e.p)` no sabe el material: si el evento `hit` trajera `kind`, se podría variar el golpe por material.
