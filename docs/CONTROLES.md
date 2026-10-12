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
