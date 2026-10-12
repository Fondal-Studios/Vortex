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

## Costos (medidos con `node tools/combatfx-test.js low`, WebGL por software)
- **Baja (iPhone)**: partículas vivas máximo **150** (112 aditivas + 38 de humo; el pedido era ≤ 200; medido: Enjambre y Cometa llegan al tope), cintas vivas ≤ 140 (un solo draw call), destellos 12, anillos 8, marcas 6, esquirlas 6. **Sin PointLights nuevos** (se reutiliza la `muzzle` de Alta). El fogonazo de pantalla son 3 grupos de 3 sprites aditivos pegados a la cámara (9 sprites, pool fijo, 0 asignaciones por disparo).
- **CPU por disparo** (`CombatFx.shot`): 0,1-1,5 ms típico; hasta ~5 ms en el PRIMER disparo de algunas armas (compilación JIT/primer uso). Las texturas de fogonazo se calientan 1,5 s después de cargar para que no haya tirón.
- **Alta**: 1700 partículas / 900 cintas de tope; el bloom amplifica lo aditivo, por eso en Media/Alta el destello de pantalla se atenúa (opacidad ×0,5, halo ×0,6, lavado 0,15).
- **Audio**: cada disparo crea 2-8 nodos de WebAudio efímeros (osciladores/ruido con envolvente); las armas de cadencia loca tienen compuerta de 40-50 ms.
- Límite de la medición: en Alta el WebGL por software da 1-3 cuadros/s, así que la cifra de ms/tiro en Alta no es representativa de un teléfono o una PC real. **No se midió en un iPhone real.**

## Defectos conocidos / lo flojo
1. **La traza en 1ª persona es corta en pantalla** (el cañón del viewmodel apunta casi al centro). Se compensa con el origen desplazado, el fogonazo grande y el impacto; un hitscan al horizonte se ve como una línea de ~60-100 px, no de borde a borde.
2. **Ráfaga y Gemelas** (cadencia alta) tienen el fogonazo más modesto a propósito (para no ser estroboscópico): se leen, pero son los menos espectaculares.
3. En **Alta** algunos impactos sobre criaturas "abiertas" (esfera blanca) se ven lavados: la criatura Geoda abierta ya es muy brillante de por sí.
4. **Sin prueba en dispositivo real**: la sensación de la patada de cámara/FOV y el volumen relativo de los sonidos están afinados "de oído" sobre cifras (pico/duración/brillo), no escuchados en un altavoz.
5. El **ancho mínimo de cinta** (efectos.js) también afecta a chispas lejanas: a 100 m una chispa mide ~0,6 m (se ve; podría verse demasiado grande).
6. `e2e coop` (tests/e2e.test.js) falló una vez por `page.goto` agotando 30 s con la máquina cargada por otros Chromium; los e2e de PC y de iPhone pasan.

## Auto-puntuación (rúbrica de `docs/ARTGATE.md`; NO sustituye al crítico independiente)
| Criterio | Nota | Por qué |
|---|---|---|
| Silueta y legibilidad | 8 | Las 25 armas se distinguen en una captura de 844×390 por color, dibujo del fogonazo y forma de traza (rayo, zigzag, onda, llamas, abanico, hoja). |
| Modelado y detalle | 7 | Todo es sprites/cintas/partículas procedurales; funcional y variado, no "hecho a mano". |
| Materiales y luz | 7 | Color por arma y luz por arma bien; en Alta el bloom quema a blanco algunos impactos. |
| Coherencia | 8 | Colores canon (`WEAPON_COLORS`), mismo lenguaje cristal/energía. |
| Animación y feedback | 9 | Fogonazo + traza + impacto + número + marcador + sonido + patada de cámara/FOV + sacudida, por arma, con "reducir movimiento". |
| Costo | 8 | Baja ≤ 150 partículas, sin PointLights nuevos, sin errores de consola. |
Mínimo = **7** (modelado y luz). Para llegar a 8 en todo haría falta un crítico que mire en dispositivo real y/o arte hecho a mano (sprites pintados) que hoy no existe.

## Rutas
- Capturas definitivas: `shots/gate/combatfx/arma-NN-low.jpg` (25 armas) y `arma-NN-high.jpg` (armas 0-6, 8, 10, 12, 14-16, 18, 20, 21, 23, 24 = 18 armas), 844×390 (celular horizontal). Escenas (1000×560, cámara lenta ×5): `escena-boom-*.jpg`, `muerte-*-*.jpg` (astilla, cristal, fuego, hielo, rayo). Los demás `escena-*`/`otros-*` son del agente anterior.
- Herramientas nuevas: `tools/shot-combatfx-real.js` (captura en tiempo real, sin cámara lenta; congela los efectos 0,05 s después de un disparo NUEVO y reintenta si justo no hay destello), `tools/combatfx-test.js` (presupuesto y "reducir movimiento"), `tools/audio-combatfx-test.js` (renderiza cada sonido sin conexión: pico, duración, brillo).
- Cómo repetirlo: `node tools/shot-combatfx-real.js todas low shots/gate/combatfx 844 390 500 0.05` (y `high`). `SIN_BLANCOS=1` dispara al horizonte. `node tools/combatfx-test.js low`. `node tools/audio-combatfx-test.js`.

## Cambios requeridos en `main.js` u otros
Ninguno obligatorio. Opcionales:
1. Un interruptor en Ajustes para "Reducir movimiento" que escriba `localStorage['cristal.reduceMotion']='1'` (hoy se respeta si existe, o la preferencia del sistema).
2. `main.js` llama `sound.shot(e.w, ...)` con el número de arma: ya cubre las 25. Si algún día el evento `shot` trae `e.fx` (Quimera), se podría pasar para elegir el sonido exacto (hoy la Quimera suena a azar entre 7 familias).
3. `sound.hit(e.p)` no sabe el material: si el evento `hit` trajera `kind`, se podría variar el golpe por material.
