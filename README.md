# PACTO PSICO

Acción de supervivencia por hordas (modos Shooter y Combo) en primera persona, en 3D, **solo o hasta 4 en cooperativo**. Te atropella un tren, despertás en el **Vórtice** —lo que hay entre vivir y no— con armas psicodélicas en las manos y un bicho extraño (el **Heraldo**) te explica la única regla: *sobrevivir a todo para volver al mundo de los vivos*. Los enemigos son **organismos vivos** (carne + biocristal), la gravedad es una mecánica, y corre en **PC y en iPhone**.

> Estado: **en desarrollo activo**. Ver [`docs/INFORME_CALIDAD.md`](docs/INFORME_CALIDAD.md) para lo que se probó, lo que falló y lo que **no** se probó.

## Jugar
### En PC (1 comando)
```bash
npm install
npm start            # → http://localhost:8080
```
Elegí **▶ Historia** (campaña con la intro del tren) o una **Arena**, y hacé clic para capturar el ratón.

| Tecla | Acción | | Tecla | Acción |
|---|---|---|---|---|
| `WASD` | mover | | `SHIFT` | correr |
| ratón | apuntar | | `1–5` / rueda | cambiar de arma |
| `Q` | habilidad de tu rol | | `E` | usar / pasar el núcleo |
| `G` o rueda (clic) | señalar (ping) | | | |
| clic izq. | disparar | | `ESC` | pausa |
| `ESPACIO` | saltar | | `Enter`/clic | saltar la intro |

### En iPhone
- **Con tu PC:** corré `npm start` y abrí `http://IP-DE-TU-PC:8080` en Safari (misma Wi-Fi). Funciona **solo y cooperativo**. Compartir ▸ *Agregar a pantalla de inicio* lo deja a pantalla completa.
- **Sin PC (solo, tipo app):** `node tools/build-static.js` genera `dist/` (sitio estático); el workflow `.github/workflows/pages.yml` lo publica en GitHub Pages (activá *Settings ▸ Pages ▸ Source: GitHub Actions*). El cooperativo necesita el servidor.
- **Controles táctiles:** palanca a la izquierda (empujala al borde para correr), arrastrá a la derecha para mirar, botón **DISPARO** grande (también se puede arrastrar desde él), **SALTO**, **CORRER**, **HABILIDAD**, **USAR**, ◆ (señalar), ‹ › para cambiar de arma o tocar el nombre del arma, ❚❚ pausa. Hay una pequeña asistencia de puntería. Girá el teléfono en horizontal.
- **Gráficos:** el menú y la pausa tienen *Baja / Media / Alta*. En teléfono arranca en **Baja**; si los FPS caen solos, baja un nivel. Se recuerda la elección.

### Cooperativo (2–4)
Una persona crea la sala (código de 4 dígitos) y las demás se unen con ese código desde `http://IP:8080`. Si un compañero cae, **acercate 3 segundos para reanimarlo**.

## Demo en video
`demo/cristal-vortice-demo.mp4`: título y menú PS5, la intro del tren, el despertar con el Heraldo, los dos capítulos, los dos jefes y el bestiario. Se regenera con `node tools/make-video.js && bash tools/assemble-video.sh` (tarda: el render es por CPU).

## Los mapas
1. **Vacío de Islas** — islas flotantes: ascensores de gravedad invertida, planetoides, zonas sin peso, burbujas de tiempo lento, portales. Jefe: *Coloso Prismático* (ojo-colmena leviatán).
2. **Cámara Fractal** — por dentro de una esfera hueca; el suelo está en todas partes y cada 60 s «la marea» apaga la gravedad. Jefe: *Madre Geoda* (flor-útero).

## Pruebas
```bash
npm test             # armas, física, IA, oleadas, límites, bots, rendimiento, coop, e2e escritorio + iPhone
npm run test:fast    # sólo lógica (≈10 s)
npm run bots         # tabla de partidas completas de bots (SKILL=1.2 PLAYERS=2 DIFF=1)
npm run bench        # FPS y memoria reales en Chromium con la horda máxima
npm run shots        # capturas de cada mapa/criatura → shots/
```
Las pruebas e2e y las capturas usan el Chromium de `/opt/pw-browsers` (WebGL por software); se omiten solas si no está.

## Estructura
```
src/sim/      simulación pura y determinista (Game, física, IA, mapas, datos, bot)   ← única fuente de verdad
src/client/   render Three.js, shaders, modelos, efectos, audio, red, HUD
server/       servidor estático + WebSocket autoritativo
public/       index.html, style.css, viewer.html (visor del bestiario)
tests/        node:test — ver `docs/INFORME_CALIDAD.md`
tools/        bots-report, perf-browser, screenshots, browser helper
docs/         diseño, historia, bestiario, mapas, decisiones, arte/audio, licencias, informe
shots/        capturas reales (Chromium) de cada mapa y criatura
```

## Menú y Tienda
El menú tiene **Continuar** y cuatro puertas: **Jugar** (Historia, Arenas, Cooperativo y el selector Shooter/Combo), **Mi Huésped** (Huésped, Evolución, Inventario y Forja, Equipo), **Mundo** (Territorios, Bestiario, Tienda) y **Ajustes** (Gráficos, Controles y sonido). Volvés con Esc, el botón ○ del mando o deslizando desde el borde izquierdo. En la **Tienda** el Cambista de Almas vende Huéspedes (empezás con Axioma, Vesper y Micelio), planos, materiales, objetos y servicios a cambio de núcleos. Detalles: [`docs/TIENDA.md`](docs/TIENDA.md) · [`docs/CONTROLES.md`](docs/CONTROLES.md). El nombre y el subtítulo del juego viven en un solo archivo: `src/client/marca.js`.

## Documentación
[Tienda](docs/TIENDA.md) · [Diseño](docs/DISENO.md) · [Historia](docs/HISTORIA.md) · [Bestiario](docs/BESTIARIO.md) · [Mapas](docs/MAPAS.md) · [Decisiones](docs/DECISIONES.md) · [Arte y audio](docs/ARTE_AUDIO.md) · [Licencias](docs/LICENCIAS.md) · [Informe de calidad](docs/INFORME_CALIDAD.md)

Licencia: MIT. Modelos de criaturas, armas, shaders y audio son procedurales. Las **personas** usan la NPC Factory de *Duelo Arcano* (assets CC0 de MakeHuman + animaciones Quaternius CC0): ver [`docs/PERSONAS.md`](docs/PERSONAS.md).
