# Controles táctiles (reforma estilo shooter móvil)

## Auditoría: por qué se sentía pesado
1. **Cámara con suavizado (slerp 14/s)**: la vista iba rezagada respecto del dedo → ahora la cámara usa la dirección de la simulación directamente (sólo se suaviza el cambio de gravedad).
2. **Sensibilidad única y fija** → ahora horizontal y vertical independientes, más multiplicadores de ADS y de mira óptica.
3. **Un dedo podía "robar" otro rol** al cruzar zonas → el rol del dedo se fija al tocar y no cambia hasta soltar.
4. **Eventos perdidos** → se usan eventos de puntero fusionados (coalesced) y se acumula el giro hasta el siguiente paso de simulación (60 Hz fijo, independiente de los FPS).

## Cómo funciona
- Mitad izquierda: SÓLO palanca de movimiento (flotante). Mitad derecha: cámara libre en ambos ejes, sin palanca fija.
- El giro es proporcional al desplazamiento relativo del dedo (rad/px). Velocidad fija por defecto; aceleración opcional.
- Arrastrar desde el gatillo también apunta. Los botones tienen función propia (disparo, ADS, salto, agacharse, dash, habilidad, usar, ping).
- Giroscopio opcional (en iPhone pide permiso; **no probado en un dispositivo real**).
- Ayuda de puntería suave configurable (0–3).
- HUD personalizable (posición, tamaño, opacidad), presets de 2/3/4 dedos; todo se guarda por jugador en `localStorage` (`cristal.ajustes.v2`).
- Desde la reforma del HUD sí hay botón RECARGA (modo Disparo; en Melé ese botón es ATAQUE 2).

## Pruebas
`node --test tests/controles.test.js` (Chromium con toques reales vía CDP): giro exacto por píxel, ida y vuelta, giro ~180° con dos deslizamientos, microajuste de 3 px, vertical independiente, palanca+cámara+disparo simultáneos, arrastre desde el gatillo, cruce de botones sin pulsarlos, ADS reduce la sensibilidad, persistencia tras recargar. `npm test` completo: 101/101.

## Dos modos en partida: Disparo ↔ Melé (HUD estilo Wild Rift)
En partida hay un botón **MODO** (táctil), **Tab** (PC) o **Select/Back** (mando) que pasa de **Disparo** a **Melé** y viceversa **al instante, sin pausar**. Tiene una espera de ~0,6 s (`MODO_ESPERA` en `src/sim/modos.js`) para no cambiar sin querer; el botón muestra un anillo mientras espera. Disparo es el modo `shooter` y Melé es el modo `combo` de la simulación (`src/sim/combos.js`): el cliente manda `mode` en cada entrada, así que también viaja por `setInput` en cooperativo y es determinista. El modo se **recuerda por Huésped** (`settings.modes`, p. ej. Vesper en Melé y Axioma en Disparo); si un Huésped no eligió, vale el último usado (`settings.mode`, el selector del menú). Sólo los 8 Huéspedes juegan Melé.

### Botones táctiles (pulgar izquierdo = palanca, derecho = ataque con las 3 habilidades en arco)
| Botón | Disparo | Melé |
|---|---|---|
| **Grande** (abajo a la derecha) | DISPARAR (tocar o mantener = ráfaga/carga; arrastrarlo apunta) | ATAQUE 1 (mantener repite y encadena el combo; arrastrarlo apunta) |
| **Chico** (encima del grande) | RECARGA | ATAQUE 2 (Seraf: mantener = cargar la flecha) |
| **Arco** a la izquierda del grande | HAB.1 · HAB.2 · HAB.3 (siempre visibles: anillo de enfriamiento, icono y, al tocar, el nombre corto de la habilidad) | HAB.1 · HAB.2 · HAB.3 (igual) |
| SALTO | sí | sí |
| MELÉ (golpe rápido; mantener = pesado) | sí | no (el ataque es A1/A2) |
| MODO (⌖ ↔ ⚔, con badge ⇄) | sí | sí |
| Contextuales (segundo arco): ULTI · USAR · EVOLUC. | aparecen solos cuando sirven | igual |
| Modo avanzado (Opciones táctiles o «Habilidades» en Pausa): APUNTAR · AGACHAR · EQUIPO · SEÑALAR | sí | no |

Cada modo muestra **sólo sus botones**; al cambiar, los botones «brotan» con una animación de 0,3 s y los rótulos cambian. La botonera se ubica por el centro de cada botón en múltiplos de una unidad `--u` (12,5 % del alto, entre 44 y 64 px: todos los toques son ≥ 44 px), respetando las zonas seguras del iPhone, y no tapa el centro de la pantalla (hay prueba). Correr es automático (palanca al máximo); el arma se cambia tocando o deslizando la barra de armas de abajo (sólo Disparo; en Melé no hay barra).

### HUD de pantalla (táctil)
- **Arriba al centro**: la línea de meta (`#goal`) y la mini-misión (`#mision`), con puntos suspensivos si son largas.
- **Arriba a la izquierda**: pausa, cámara, mini-barras de vida y escudo (sin números), nombre del Huésped con sus estados, y el contador de esencias/núcleos (`#evohud`; su botón EVOLUC. propio se oculta porque ya está el de la botonera).
- **Disparo**: la munición («cargador / reserva», con barrita al recargar) arriba de la barra de armas; la mira en el centro.
- **Melé**: arriba a la derecha el contador de combo (×N, nombre del último golpe, barra de la ventana) y el rango de estilo D–S con las bajas de un golpe; el anillo del botón ATAQUE 1 muestra cuánto falta para que se corte la cadena.
- El cambio de modo reordena el HUD con una transición corta (`body.modo-swap`).
- Botín: el resumen (`#botin-toasts`) sale a la izquierda, a la altura del pulgar izquierdo pero sin tapar el ataque, y el aviso «USAR · recoger …» (en PC «E · …») sale a la izquierda del centro.
- **Editor de botones** y **preajustes de 2/3/4 dedos** siguen igual (cada botón se mueve/escala por su id; ATAQUE 1 y DISPARAR comparten botón, igual que RECARGA y ATAQUE 2). 3 y 4 dedos agregan el mismo ataque principal a la izquierda (`fireL`).
- Munición: `cl`/`rs` (∞ si `rs=-1`) y barrita de recarga (`rl`) en `hud-huesped.js`.

## Tabla Huésped × modo × slot (las TRES habilidades en los dos modos)
Las teclas y botones son **los mismos** en los dos modos: HAB.1 = `mov`, HAB.2 = `esp`, HAB.3 = `s3` en la entrada. La simulación (`src/sim/modos.js → enrutar`, llamada desde `game.js → setInput`) decide qué habilidad dispara cada slot. En **Melé** HAB.3 es la **habilidad principal de Combo** (★, `HABILIDADES` en `data.js`); cuando esa principal repite lo que ya hacía la HAB.2 de Disparo (Colmena, Danzante, Singular), la HAB.2 de Melé pasa a ser la HAB.3 de Disparo, así no hay dos botones casi iguales.

| Huésped | Modo | HAB.1 | HAB.2 | HAB.3 |
|---|---|---|---|---|
| Axioma | Disparo | Impulso muscular | Descarga de espinas | Caparazón |
| | Melé | Impulso muscular | Descarga de espinas | Baluarte ★ |
| Vesper | Disparo | Desplazamiento | Camuflaje refractivo | Marca biológica |
| | Melé | Desplazamiento | Camuflaje refractivo | Frenesí de caza ★ |
| Micelio | Disparo | Barrera orgánica | Nube de esporas | Absorción de biomasa |
| | Melé | Barrera orgánica | Nube de esporas | Estallido de esporas ★ |
| Umbra | Disparo | Fase | Campo gravitatorio | Distorsión temporal |
| | Melé | Fase | Campo gravitatorio | Eclipse ★ |
| Seraf | Disparo | Alas membranosas | Pulso vital | Simbionte |
| | Melé | Alas membranosas | Pulso vital | Bendición ★ |
| Colmena | Disparo | Zumbido | Criar enjambre | Nido-torreta |
| | Melé | Zumbido | Nido-torreta | Llamado del enjambre ★ |
| Danzante | Disparo | Pirueta | Parada perfecta | Lazo de cintas |
| | Melé | Pirueta | Lazo de cintas | Contrapaso ★ |
| Singular | Disparo | Honda gravitatoria | Pozo gravitatorio | Reflujo de marea |
| | Melé | Honda gravitatoria | Reflujo de marea | Colapso gravitatorio ★ |

La **definitiva** (ULTI) funciona igual en los dos modos y aparece cuando está cargada.

**Balance**: el estilo interno «combo» multiplica ×1,5 el daño de habilidad (pensado para la principal, que enfría 9–22 s). Para que HAB.1 y HAB.2 no sumen ese bono extra, en Melé pegan × `MODO_K` = 0,67 (≈ ×1,0, igual que en Disparo); la principal conserva el ×1,5 (`p.inHab` en `combos.js`, `hostOut` en `huespedes.js`). En Melé el disparo, el golpe rápido y recargar no hacen nada. Pruebas: `node --test tests/modos.test.js` (tabla, enrutado, cambio de modo, determinismo y balance), `tests/combos.test.js`, `tests/estilos.test.js`, `tests/huespedes.test.js`.

## Huéspedes: teclas (PC) y mando
| Acción | Disparo | Melé | Mando |
|---|---|---|---|
| Ataque principal | clic izq. (mantener = ráfaga) | clic izq. = ATAQUE 1 (mantener repite y encadena) | RT |
| Secundario | clic der. = HAB.2 · R recarga · V melé rápido | clic der. = ATAQUE 2 | LT o B / ○ = ATAQUE 2 (en Disparo: LT apunta, B melé rápido, X / □ recarga) |
| HAB.1 | F | F o 1 | LB |
| HAB.2 | G (o clic der.) | G o 2 | RB |
| HAB.3 | Z | Z, Q o 3 | cruceta ↑ |
| Definitiva | T | T | cruceta ↓ |
| Cambiar de modo | **Tab** | **Tab** | **Select / Back** |
| Saltar · usar | Espacio · E | Espacio · E | A / ✕ · Y / △ |
| Equipo (rol) · señalar | Q · B / clic central | B / clic central | Select + LB · R3 |
| Armas | 1–5 · rueda | (no hay barra de armas: 1/2/3 son habilidades) | cruceta ← / → |
| 3.ª persona · pista de teclas | P · K | P · K | — |

`X` queda como APUNTAR (mantener) y no cambia de modo (el pedido original decía «Tab o X»; X ya era el apuntado, así que se usa sólo Tab). La **pista de teclas** («Mostrar controles»): una línea chica abajo a la izquierda que cambia con el modo; se prende con **K** o con «Ver controles» en la Pausa. En el panel del Huésped (derecha, PC) cada habilidad muestra su tecla y la definitiva es **T** (antes decía R por error). Táctil/mando: **no probados en un dispositivo real**.

## Percepción de caída y bordes (`src/client/caida.js`)
Sólo usa el snapshot (posición, `up`, velocidad derivada) y, si llega, el evento `{t:'fall'}`:
- **Borde**: halo con rayas de peligro y anillos hacia el vacío sobre la isla donde pisás, líneas de profundidad que se apagan hacia abajo, aviso «BORDE A n m» con flecha y brillo ámbar en los bordes de la pantalla.
- **Vacío debajo / Suelo a n m** mientras estás en el aire.
- **Caída rápida**: viñeta azul, líneas de velocidad, viento sintético (`Sound.wind`) y temblor suave.
- **Caer fuera del mapa**: «¡CAÍSTE AL VACÍO!», destello, columna de luz y flecha hacia la isla segura.
- **Aterrizaje fuerte**: onda, polvo, golpe grave (`Sound.landing`) y sacudida.
- «Reducir movimiento» (Opciones) apaga sacudidas, líneas animadas y baja la viñeta.
- Pruebas: `node tools/shot-caida.js shots/caida` · `node --test tests/cartas.test.js`.

## Tarjetas y carteles
`#cards` es una cuadrícula fluida con zona segura de iPhone y desplazamiento interno de respaldo; `node tools/shot-cartas.js` comprueba 844×390, 667×375, 390×844, 1280×720 y 1920×1080.

## Modo Melé (antes «Combo»)
Dos ataques encadenados + tres habilidades. Ya no se elige sólo en el menú: se alterna en partida (ver «Dos modos en partida» arriba). Con «Modo simple» activado, ATAQUE 1 se encadena solo cuando hay un enemigo cerca y de frente. Los ajustes de menú (`?modo=combo`, `settings.mode`) siguen existiendo y fijan el modo inicial de un Huésped que todavía no eligió el suyo. Pruebas: `node --test tests/combos.test.js`.

## Modo Combo: qué se ve y se siente al golpear
- A1/A2 (clic izq./der., RT/RB, botones táctiles) lanzan golpes distintos por Huésped y por golpe: el héroe se agacha, gira el torso, da el paso y avanza hacia la criatura más cercana; sale una estela del arma y, al contacto, hit-stop breve, destello/chispas del color del Huésped, sacudida y empujón de FOV de la cámara. El remate de una cadena (2+ golpes) trae onda grande y 0,12 s de cámara lenta visual.
- Opciones › «Efectos de golpe» (Completos / Reducidos) y «Reducir movimiento» apagan o atenúan sacudida, FOV, hit-stop y cámara lenta. En 3.ª persona el contador de combo se corre a la derecha para no tapar al héroe.
- Detalle técnico y tabla de poses: docs/HUESPEDES.md → «Golpes que se ven y se sienten». **No probado**: iPhone real, táctil real, mando, coop.

## Menú principal (VORTEX): una acción grande + 5 puertas
Detalle y mapa completo en **docs/MENU.md**. Inicio = botón enorme **Continuar / Jugar** (retoma lo último que jugaste), **Elegir partida** al lado y cinco puertas: **La Base · Huéspedes · Colección · Cooperativo · Ajustes**. Cada puerta abre directo su primera pantalla (sin pasillos) y arriba queda **una sola barra** en todas las pantallas:

`[‹ Volver] · pestañas de la sección · [Shooter | Melé] · [engranaje = Gráficos] · [◆ núcleos = Tienda]`

| Sección | Pestañas |
|---|---|
| Partidas (Elegir partida) | Historia · Arenas · Cooperativo |
| Huéspedes | Huésped · Evolución · Inventario · Forja · Tienda · Equipo |
| Colección | Criaturas · Fauna · Herbario · Territorios |
| Ajustes | Controles y sonido · Gráficos |

- **Volver**: botón «‹ Volver», **Esc / Retroceso**, botón ○ del mando, o (táctil) deslizar desde el **borde izquierdo** hacia la derecha. Las pestañas no apilan: un solo Volver sale de la sección. En la Tienda, Esc cierra primero el cartel de confirmación.
- **Pestañas**: tocar, o **Q / E** (también RePág / AvPág) y **LB / RB** del mando (acciones `tabprev` / `tabnext`).
- **Teclado / mando**: flechas o WASD mueven el foco al vecino más cercano en el inicio y la Tienda; Enter/Espacio/✕ abre; en un `<select>` izquierda/derecha lo cambia. El foco se ve siempre (anillo blanco).
- **Puntitos rojos** sólo donde hay una acción útil: cosecha lista en la Base, botín nuevo, puntos de progresión sin gastar, Huésped que ya podés comprar, bendición para elegir y arena nueva abierta. Se calculan del perfil (`menu-nav.js → avisos`).
- **Primera vez**: bienvenida de 3 pasos (Elegí tu Huésped → Jugá → Volvé a la Base) con «Saltar»; no vuelve. En pruebas automáticas no sale salvo con `?bienvenida=1`.
- **Pausa en partida**: Continuar · Modo de juego · Gráficos · Controles y cámara (plegable: ver controles, editar botones, sensibilidad, cámara, claridad, estilo, habilidades, Evolución) · Salir a la Base · Salir al menú.
- Los ids de siempre se conservan (`#huesped`, `#inventario`, `#evolucion`, `#loadout`, `#graficos`, `#options`, `#modeitem`…). Código: `src/client/menu-hubs.js` (dibujo), `menu-nav.js` (mapa, avisos, ruta), `menu-bienvenida.js`, `ui.js` (navegación), `public/menu.css`.

## En la Base (2026-10-20)
En el mapa-hub «El Santuario» (docs/BASE.md) los controles de movimiento y cámara son los de siempre; **USAR / E** interactúa con la estación o el personaje que tengas cerca (el cartel de abajo lo dice). **No hay armas**: disparo, habilidades y modo Melé quedan apagados (la simulación los ignora) y en táctil sólo se ven palanca, salto, USAR y pausa. Los mini-menús de las estaciones se eligen con 1 / 2 / 3 (o tocando) y se cierran con Esc / E. Desde cualquier pantalla abierta en la Base, **Volver** o Esc te devuelve al mapa.
