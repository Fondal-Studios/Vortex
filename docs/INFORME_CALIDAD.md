# Informe de calidad (fase 1)

Redactado con los resultados reales de la última corrida (`npm test`: **63 pruebas, 63 OK, ~40 s**) y de `npm run bench` / `npm run shots`. Nada acá se declara «terminado» ni «balanceado» sin la evidencia citada. Lo que **no** se probó está en la última sección.

## 1. Pruebas automáticas de lógica (`tests/`)
| Archivo | # | Qué verifica |
|---|---|---|
| `weapons.test.js` | 13 | daño exacto del Haz; las 4 armas hitscan dañan y respetan su tope; cadencia (Ráfaga ≈ 12/s); consumo de munición y caída al Haz; Aguja atraviesa y Haz no; la geometría bloquea disparos; Nova: área, caída por distancia y sin daño propio; escudo→vida y regeneración; muerte y derrota; blindaje de Geoda; puntos/bajas; recogida con topes |
| `physics.test.js` | 15 | apoyo y salto; **ascensor de gravedad invertida** (se camina por el techo); **cero-G**; **planetoide** (se camina alrededor); caída al vacío y reaparición; portales y enfriamiento; **tiempo lento 30 %**; proyectiles contra geometría y límites; **esfera hueca** (radio conservado, «arriba» al centro); **marea** (aviso, ventana, flotar y nadar); colinas sólidas; **fuzz 60 s** con entradas aleatorias en ambos mapas sin NaN; **determinismo** (misma semilla+entradas ⇒ mismo estado) |
| `ai.test.js` | 11 | cada una de las 8 criaturas + 2 jefes: Astilla (persigue, salta, muerde), Geoda (ciclo abierto/cerrado, velocidad, blindaje), Prisma (orbita, aviso, picada), Lente (rango, aviso, proyectil), Cuarzo (invoca, tope de hijas), Espejo (camuflaje, revelado, parpadeo), Racimo (detona y encadena), Gravitón (invierte gravedad), **Coloso** (3 fases, orbes, refuerzos, pulsos, derrotable) y **Madre Geoda** (ciclos, espirales, Racimos, 15 % cerrada, derrotable); roles distintos |
| `waves.test.js` | 6 | dificultad creciente por oleada (ambos mapas); sólo criaturas habilitadas y jefe al final; bestiario completo repartido entre los mapas; escalado por jugador; ciclo calma→goteo→limpia→respiro; victoria/derrota; revivir en coop; tope duro de 90 |
| `limits.test.js` | 4 | topes de proyectiles/pickups/eventos; limpieza de muertos y vencidos; **partida de 4 min con 4 bots y dificultad 2.5** (pico real: 49 criaturas, 19 proyectiles, 40 pickups); **memoria**: +0,1 MB de heap tras 3 partidas completas |
| `perf.test.js` | 1 | ver §3 |
| `bots.test.js` | 3 | ver §2 |
| `coop.test.js` | 4 | ver §4 |
| `e2e.test.js` | 2 | Chromium real: teclado+ratón (mover, girar, cambiar arma, disparar, HUD) y coop con **dos navegadores** |

## 2. Gameplay con bots (partidas completas, 60 Hz, mismo código del servidor)
Bot con límites humanos (giro ≤ 7 rad/s, puntería con ruido, esquiva proyectiles, **no** dispara a Geodas cerradas, no cae de la isla…). 8 semillas por mapa, `skill 1.2`:

| Mapa | Victorias | Oleada máx. | Oleada media de derrota | Tiempo medio |
|---|---|---|---|---|
| Vacío de Islas | **3 / 8** | 7 (jefe) | 6,6 | 335 s |
| Cámara Fractal | **3 / 8** | 7 (jefe) | 6,0 | 378 s |
| Coop, 2 bots, M1 | **4 / 4** | 7 | — | — |

Se verifica: ninguna partida se cuelga (`maxStall < 150 s` sin progreso, contando la vida del jefe), no hay NaN, las oleadas empiezan en orden creciente, **el jefe de cada mapa se derrota** (≥ 1 victoria) y **no es trivial** (hay derrotas), y los bots llegan hasta el jefe. Lectura honesta: una dificultad media-alta *para un bot*; **no sabemos cómo la vive una persona** (§6).

## 3. Rendimiento
**Simulación (Node, 1 hilo), horda máxima** = 90 criaturas + ~300 proyectiles + 4 jugadores, 600 pasos:
| Mapa | media | p99 | presupuesto 60 Hz |
|---|---|---|---|
| Vacío de Islas | 1,03 ms/paso | 3,72 ms | 16,7 ms |
| Cámara Fractal | 1,13 ms/paso | 2,31 ms | 16,7 ms |
Un servidor puede llevar varias salas por núcleo.

**Navegador** (`npm run bench`; Chromium + **SwiftShader, es decir, render por CPU sin GPU**; 1280×720; 88–90 criaturas vivas; bot jugando; 10 s tras 6 s de calentamiento):
| Mapa | pixelRatio | FPS medio | FPS mín. | draw calls | triángulos | heap JS |
|---|---|---|---|---|---|---|
| Islas | 1 | 34,2 | 13,9 | 423 | 19,6 k | 14,6 MB |
| Islas | 0,6 | 18,8 | 12,8 | 209 | 22,9 k | 18,3 MB |
| Fractal | 1 | 18,6 | 15,5 | 364 | 17,8 k | 14,7 MB |
| Fractal | 0,6 | 22,4 | 17,2 | 647 | 26,6 k | 11,9 MB |

- **Los FPS son los de un renderizador por software**: sirven como piso pesimista y para detectar regresiones, **no** como medida en una GPU real (no hay GPU en este entorno; sin medir). El ruido entre corridas es alto (el pixelRatio menor no mejoró de forma consistente: el cuello es CPU).
- **Memoria**: heap JS estable en 12–21 MB durante 75 s de horda máxima; geometrías en GPU 128→131 y 9 programas de shader (sin fuga tras corregir una: antes se creaban geometrías/materiales por proyectil y por pickup; ahora se comparten).
- Nota de modo de uso: en solitario el bucle usa 60 Hz fijos; si el cuadro tarda >100 ms se recorta el avance.

## 4. Cooperativo (servidor autoritativo + clientes reales por WebSocket)
- 2 clientes en la misma sala reciben **snapshots idénticos bit a bit para el mismo tick**; ~20 snapshots/s (71 en ~3,6 s).
- Cada cliente sólo mueve a su jugador (A camina >10 u, B queda a <1 u).
- **Divergencia máxima entre las vistas interpoladas de los dos clientes: 0,01 u** sobre 104 muestras; retraso respecto del servidor < 0,35 s.
- Sala llena rechaza al 5º; desconexión limpia; sala vacía se elimina; entradas malformadas o hostiles (`dyaw: 1e308`, JSON roto, `weapon: 99`) no tumban al servidor.
- E2E con dos navegadores: crear sala → código → unirse → ambos ven «2 jugadores» en el HUD.
- **Salvedad honesta:** como los clientes son «finos» (sólo dibujan el estado del servidor), «sin desincronización» es casi por construcción; lo que se midió es el **retraso y la coherencia de las vistas**, en `localhost`. **No** se simuló latencia, jitter ni pérdida de paquetes.

## 5. Revisión visual (capturas reales en `shots/`, Chromium)
25 capturas: menú, 3 oleadas por mapa (1, 4, jefe), las 10 criaturas (+ Geoda abierta, Espejo camuflado, bestiario completo) y 5 escenas de física rota. Se **miraron** y se corrigió:
1. **Arma en pantalla enorme** → escalada al 55 %.
2. **Mapa 2 ilegible** (el cascarón fractal tapaba a las criaturas) → atenuado y con menos espigas; ahora el jefe y las criaturas destacan.
3. **Cristales apagados y luego quemados a blanco** (núcleo de la Geoda abierta) → más luz base + tonemap suave + núcleo naranja.
4. **Visor del bestiario cortaba a la Madre Geoda** → encuadre ajustado.
5. **Fuga de GPU** detectada al revisar el render (no por captura) → caches compartidas.

Lo que **sigue sin gustarme** (no se corrigió): los modelos son *low-poly* y toscos (sirven por silueta y color; las siluetas son distinguibles); el Coloso se ve chico desde la isla; no hay barras de vida sobre las criaturas; no hay distorsión de pantalla real (sólo giro de tono por CSS); el Mapa 1 tiene mucho verde en el cielo en estas capturas (el tono rota, falta variarlo por oleada).

## 6. Qué falló durante el desarrollo (y cómo se resolvió)
| Hallazgo | Cómo apareció | Arreglo |
|---|---|---|
| Ráfaga disparaba 10/s en vez de ~12/s (cadencia redondeada al tick) | `weapons.test` | el sobrante de enfriamiento se arrastra |
| Hasta 8 Geodas en una oleada (el sorteo ignoraba el costo) | bots morían siempre en la oleada 4 | sorteo por 1/costo + topes por tipo |
| Oleadas «eternas» (>150 s) | `maxStall` de los bots | Geodas sueltan munición; el bot espera su ventana abierta |
| Los refuerzos del jefe impedían ganar | `ai.test` (jefes) | al caer el jefe todo se hace añicos |
| En coop una oleada de 94 criaturas tardaba ~3 min en salir | prueba de límites (pico de 1 criatura) | el goteo de spawns escala con el tamaño de la oleada (~40 s) |
| El bot nunca disparaba la Nova al jefe (sin campo `range`) | partida atascada 1500 s | corrección en el bot |
| Bot caía por el borde con salto+correr | trazas | freno duro en el borde |
| Error de consola «A user gesture is required to request Pointer Lock» en modo auto | e2e | sin captura de ratón sin gesto |

## 7. Limitaciones y lo que **no** se probó
- **Ninguna persona jugó esto.** El balance es de bot (D-10). No sabemos si es divertido, si la cámara al invertir la gravedad **marea** (hay interpolación de 14 /s pero no hay evidencia de comodidad), ni si los avisos son suficientes para esquivar.
- **Sin GPU real**: FPS sólo con render por software; sin pruebas en móviles, Firefox, Safari ni mandos. Sin soporte táctil.
- **Audio**: sintetizado y sin errores, pero **nadie lo escuchó**; mezcla y volúmenes sin calibrar.
- **Red:** sin predicción de movimiento (el jugador local ve su movimiento con la latencia del viaje de ida y vuelta + 110 ms), sin compensación de latencia en los disparos, sin reconexión, sin lobby ni lista de salas (se entra por código), sin protección contra trampas más allá de acotar entradas, sin cifrado (`ws://`), sin prueba con latencia/pérdida.
- Coop: «reiniciar» desde la pantalla final no tiene prueba e2e; un jugador caído no puede espectar.
- Hitboxes de criaturas = esfera; el *ray-marching* de la línea de tiro avanza de 1,5 u (puede dejar pasar un disparo por un sólido muy fino).
- Los modelos y animaciones son procedurales y simples; no hay animación esquelética.
- Sólo 2 mapas y 1 modo (hordas), por pedido.

---
# Fase 2 — historia isekai, organismos, PS5, iPhone, video

## Qué se hizo y cómo se verificó
| Pedido | Qué hay | Evidencia |
|---|---|---|
| Historia **visible en el juego** | Campaña `▶ Historia`: cine del tren → despertar → Heraldo → cap. 1 → interludio → cap. 2 → final | `demo/cristal-vortice-demo.mp4` (cuadros reales del juego), `shots/historia-*.jpg` |
| Enemigos **organismos** | 14 criaturas orgánicas (kit + 3 agentes en paralelo) | bestiario del video y `shots/` |
| Personajes / armas psicodélicas | Pasajero humano (Arcanum NPC Factory) con 3ª persona (`V`); 5 armas con modelo propio animado | video (tercera persona), `iphone.jpg` |
| Interfaz PS5 | título, menú con tarjetas, bestiario 3D, opciones, carga, trofeos, mando | `shots/ui-*.jpg`, video |
| PC + iPhone, calidad | Baja/Media/Alta, táctil, PWA, build estático para GitHub Pages | e2e iPhone emulado ✓ |
| Coop 4 | reanimar, nombres, avatares humanos (Media/Alta) | pruebas de IA y e2e de 2 navegadores |
| Video de demo | 131 s, 1280×720, 30 fps, audio sintetizado | `demo/cristal-vortice-demo.mp4` |

Pruebas: **69** (67 + las dos corregidas). Esta fase encontró y arregló: un `dt` negativo en el primer cuadro que trababa la simulación en cargas lentas, el balance del Mapa 2 (el bot ganaba 8/8 → ahora 2/8; Mapa 1: 5/8) y un coste de dibujo desmedido de las criaturas.

## Rendimiento (honesto)
Chromium + SwiftShader (**CPU, sin GPU**), horda de 88–90 criaturas todas cerca (peor caso, irreal):
| Calidad | llamadas de dibujo | triángulos | FPS (software) |
|---|---|---|---|
| Baja (iPhone) | ~230 | 21–31 k | 9–16 |
| Alta (PC) | ~1.450 | 200–275 k | ~1 |
- **Sin el tope de modelos completos** Baja pedía ~3.300 llamadas (cada organismo cuesta 35–40): imposible para un teléfono. Ahora solo las N criaturas más cercanas (Baja 10, Media 24, Alta 56) tienen modelo completo y las lejanas son un proxy.
- **Los FPS de software no predicen un iPhone ni una GPU de PC.** **No se probó en un iPhone real.** La estimación (230 llamadas, ~25 k triángulos, sin post-proceso) es *plausible* para un iPhone reciente, pero es una hipótesis.
- Memoria JS ~45–65 MB.

## Lo que NO se probó / límites
- **Nada en un iPhone real**, ni mando físico (el código usa el mapeo estándar de la Gamepad API; se probó solo con teclado/táctil emulado).
- **No es «nivel Halo».** Hay bloom, reflejos, luz dinámica y un salto grande respecto a la fase 1, pero los modelos son procedurales y estilizados, el terreno es simple y no hay sombras proyectadas. Lo digo claro para que no haya sorpresas.
- Las criaturas: ojos aún algo caricaturescos; **Ariete** y **Obelisco** son lo más flojo; el Heraldo sale muy brillante por el bloom.
- El video usa el bot jugando (modo dios) y cámara en 3ª persona; **no es una partida humana**. Parte del audio (música y efectos) es sintético, sin mezclar en altavoces reales.
- Personas: ≈30 k triángulos cada una, por eso en Baja se usa un avatar liviano; el rig sigue con 326 huesos. La verificación pieza por pieza de las ampliaciones CC0 de MakeHuman queda **pendiente de revisión humana** (ver `PERSONAS.md`).
- La interfaz PS5 es *inspiración de estilo*; sin recursos de Sony.
