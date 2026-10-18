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
- No hay botón "Recargar": el juego usa reservas de munición, no cargadores.

## Pruebas
`node --test tests/controles.test.js` (Chromium con toques reales vía CDP): giro exacto por píxel, ida y vuelta, giro ~180° con dos deslizamientos, microajuste de 3 px, vertical independiente, palanca+cámara+disparo simultáneos, arrastre desde el gatillo, cruce de botones sin pulsarlos, ADS reduce la sensibilidad, persistencia tras recargar. `npm test` completo: 101/101.

## HUD táctil simple (por defecto) y modo avanzado
- **Básico**: sólo DISPARO (grande; arrastrarlo también apunta), RECARGA, MELEE y SALTO (+ pausa). Correr es automático (palanca al máximo). El arma se cambia tocando o deslizando sobre la barra de armas de abajo.
- **Contextuales** (aparecen solos): ULTI con la definitiva cargada, USAR con algo cerca u objetivo activo, EVOLUC. cuando `co ≥ evn`.
- **Modo avanzado** (`advanced`; Opciones táctiles o «Habilidades» en Pausa): HAB.1/2/3, APUNTAR, AGACHAR, EQUIPO y SEÑALAR.
- Munición: «cargador / reserva» (`cl`/`rs`, ∞ si `rs=-1`) y barrita de recarga (`rl`) en `hud-huesped.js`.

## Huéspedes: teclas
| Acción | Teclado/ratón | Mando | Táctil |
|---|---|---|---|
| Habilidad 1 (`mov`) | F | LB | HAB.1 (avanzado) |
| Habilidad 2 (`esp`) | G · clic der. | RB | HAB.2 (avanzado) |
| Habilidad 3 (`s3`) | Z | cruceta ↑ | HAB.3 (avanzado) |
| Definitiva (`ult`) | T | cruceta ↓ | ULTI (contextual) |
| Recargar (`reload`) | R | X / □ | RECARGA |
| Melee (`melee`; mantener = pesado) | V | B / ○ | MELEE |
| Señalar | B · clic central | R3 | ◆ (avanzado) |
| 3.ª persona | P | — | — |

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

## Modo Combo (alternativa a Shooter)
El modo se elige arriba de **Jugar** (barra «Modo de juego», siempre visible en ese hub), en la pantalla Huésped (botón «Modo»), en Opciones (`#modesel`), en la Pausa o con `?modo=combo` / `?modo=shooter`; se guarda en `settings.mode`. Shooter queda igual que arriba. Sólo los 5 Huéspedes juegan Combo.
| Acción | Teclado/ratón | Mando | Táctil |
|---|---|---|---|
| Ataque 1 (`a1`) | clic izq. (mantener = repite y encadena) | RT / R2 | ATAQUE 1 (arrastrarlo también apunta) |
| Ataque 2 (`a2`; Seraf: mantener = cargar, soltar = flecha) | clic der. | RB / R1 o B / ○ | ATAQUE 2 |
| Habilidad principal (`hab`) | Q o F | LB / L1 | HABILIDAD (grande, con anillo de enfriamiento) |
| Saltar | Espacio | A / ✕ | SALTO |
| Usar · Evolucionar · Definitiva | E · N · T | (igual que Shooter) | USAR · EVOLUC. · ULTI (aparecen solos) |
La **E** sigue siendo USAR (la habilidad no se ata a E para no perder las interacciones). En táctil el HUD de Combo muestra sólo ATAQUE 1, ATAQUE 2, HABILIDAD, SALTO y los contextuales; el modo avanzado no agrega botones de Shooter. Se pueden mover y cambiar de tamaño en «Editar controles» como los demás. Con «Modo simple» activado, A1 se encadena solo cuando hay un enemigo cerca y de frente. Pruebas: `node --test tests/combos.test.js`. Táctil/mando: **no probados en un dispositivo real**.

## Modo Combo: qué se ve y se siente al golpear
- A1/A2 (clic izq./der., RT/RB, botones táctiles) lanzan golpes distintos por Huésped y por golpe: el héroe se agacha, gira el torso, da el paso y avanza hacia la criatura más cercana; sale una estela del arma y, al contacto, hit-stop breve, destello/chispas del color del Huésped, sacudida y empujón de FOV de la cámara. El remate de una cadena (2+ golpes) trae onda grande y 0,12 s de cámara lenta visual.
- Opciones › «Efectos de golpe» (Completos / Reducidos) y «Reducir movimiento» apagan o atenúan sacudida, FOV, hit-stop y cámara lenta. En 3.ª persona el contador de combo se corre a la derecha para no tapar al héroe.
- Detalle técnico y tabla de poses: docs/HUESPEDES.md → «Golpes que se ven y se sienten». **No probado**: iPhone real, táctil real, mando, coop.

## Menú principal en 4 puertas (PACTO PSICO)
Inicio = botón grande **Continuar / Jugar** (retoma lo último que jugaste: Historia o la última arena) + 4 puertas. Cada una abre un «hub» de tarjetas:

| Puerta | Qué trae |
|---|---|
| **Jugar** | Barra de modo **Shooter / Combo** (siempre arriba) · Historia · Arenas · Cooperativo · «Tu ruta» (próximos objetivos) |
| **Mi Huésped** | Huésped (elegir, maestría, progresión Shooter/Combo) · Evolución · Inventario y Forja · Equipo |
| **Mundo** | Territorios · Bestiario · Tienda (con tu saldo) |
| **Ajustes** | Gráficos · Controles y sonido |

- **Volver**: botón «‹ Volver», **Esc / Retroceso**, botón ○ del mando, o (táctil) deslizar desde el **borde izquierdo** hacia la derecha. En la Tienda, Esc cierra primero el cartel de confirmación.
- **Migas de pan** arriba («Inicio › Mi Huésped › Inventario»): cada miga anterior es clicable y salta directo.
- **Teclado / mando**: flechas o WASD mueven el foco al vecino más cercano en esa dirección (rejillas y pestañas incluidas); Enter/Espacio/✕ abre; en un `<select>` izquierda/derecha lo cambia.
- **Ayuda breve**: cada puerta y tarjeta muestra una línea de qué hace (y la repite como `title` al pasar el mouse).
- **Puntitos rojos**: botín nuevo, puntos de progresión sin gastar, Huésped comprable, stock nuevo en la Tienda, bendición para elegir, territorio recién abierto. Se calculan del perfil (`src/client/menu-nav.js → avisos`), no se guardan aparte (salvo «inventario visto» y «stock visto» en `perfil.menu`).
- Los ids de siempre se conservan (`#huesped`, `#inventario`, `#evolucion`, `#loadout`, `#graficos`, `#options`, `#modeitem`…): sólo cambió dónde se llega a ellos. Código: `src/client/menu-hubs.js` (dibujo), `menu-nav.js` (mapa, avisos, ruta), `ui.js` (navegación), `public/menu.css`.
