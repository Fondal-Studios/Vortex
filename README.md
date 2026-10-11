# CRISTAL VÓRTICE

Shooter de supervivencia por hordas en primera persona, en 3D, donde **la gravedad es una mecánica**: caés hacia arriba, caminás por dentro de una esfera hueca, flotás en mareas sin peso y vivís entre criaturas de cristal. Inspirado en la jugabilidad de *Serious Sam* y *Halo* y en el surrealismo cósmico de David OReilly.

> Estado: **fase 1 completa y probada** — un jugador con 2 mapas, 8 criaturas + 2 jefes, historia, y arquitectura de servidor autoritativo con prototipo cooperativo (2–4 jugadores en red local). Ver [`docs/INFORME_CALIDAD.md`](docs/INFORME_CALIDAD.md) para lo que se probó, lo que falló y lo que **no** se probó.

## Jugar (1 comando)
```bash
npm install
npm start            # → http://localhost:8080
```
Abrí la URL en Chrome/Edge/Firefox, elegí un mapa y hacé clic para capturar el ratón.

| Tecla | Acción | | Tecla | Acción |
|---|---|---|---|---|
| `WASD` | mover | | `SHIFT` | correr |
| ratón | apuntar | | `1–5` / rueda | cambiar de arma |
| clic izq. | disparar | | `ESC` | pausa |
| `ESPACIO` | saltar | | | |

**Cooperativo (LAN):** una persona ejecuta `npm start`, abre el juego y elige *Cooperativo · crear sala* (le muestra un código de 4 dígitos); las demás abren `http://IP-DE-ESA-PC:8080` y usan *Unirse* con el código. Hasta 4 jugadores.

## Los mapas
1. **Vacío de Islas** — islas flotantes: ascensores de gravedad invertida, planetoides, zonas sin peso, burbujas de tiempo lento, portales. Jefe: *Coloso Prismático*.
2. **Cámara Fractal** — por dentro de una esfera hueca; el suelo está en todas partes y cada 60 s «la marea» apaga la gravedad. Jefe: *Madre Geoda*.

## Pruebas
```bash
npm test             # 63 pruebas: armas, física, IA, oleadas, límites, bots, rendimiento, coop, e2e (≈1 min)
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

## Documentación
[Diseño](docs/DISENO.md) · [Historia](docs/HISTORIA.md) · [Bestiario](docs/BESTIARIO.md) · [Mapas](docs/MAPAS.md) · [Decisiones](docs/DECISIONES.md) · [Arte y audio](docs/ARTE_AUDIO.md) · [Licencias](docs/LICENCIAS.md) · [Informe de calidad](docs/INFORME_CALIDAD.md)

Licencia: MIT. Sin assets externos: modelos, shaders y audio son procedurales.
