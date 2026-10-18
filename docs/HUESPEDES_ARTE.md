# Huéspedes — dirección de arte unificada («simbiosis»), 2026-10-18

**Problema detectado:** el Huésped de la pantalla de selección (figuras de cápsulas y conos) y el cuerpo del jugador en partida (humano con máscara
y túnica) eran dos cosas distintas, y ninguna llega al nivel de detalle pedido. **Nueva regla: UN SOLO CUERPO** en partida, selección,
evolución y cinemáticas: `createHostBody`.

## Concepto: el Pasajero y el Huésped son un solo ser (simbiosis)
Como en Warframe, **todos los Huéspedes son humanoides** sobre el **esqueleto y las animaciones reales de ARCANUM** (humans.js: MakeHuman CC0 +
clips Quaternius: idle, walk, run, jump, melee, hit, death…). Lo que cambia entre ellos es la **armadura/mutación**: un kit de piezas rígidas y
sueltas **ancladas a los huesos** (casco/cabeza, hombros, pecho, brazos, manos/garras, cintura, faldones, piernas/pezuñas, espalda: alas,
cola, raíces, velos), con **materiales PBR de verdad** (Poly Haven: metal, oro, hueso, cuero, roca, corteza; public/assets/ph/) y **luz interior**
(costuras emisivas, núcleo en el pecho que late con uBeat, ojos). La piel humana casi no se ve: queda **espectral** (traslúcida con fresnel).
Se ve el humano **fundido** con el guardián: el rostro del Pasajero queda detrás de la máscara/casco del Huésped.

## Los cinco (silueta MUY distinta, estilo flashero/psicodélico)
- **Axioma — Guerrero Caído:** armadura de hueso y metal ennegrecido con costuras de brasa, hombreras con púas, capa rasgada, cuchillas de espíritu en los antebrazos, casco con cuerno.
- **Vesper — Bestia Cazadora:** proporciones felinas (piernas digitígradas largas, torso estrecho), cráneo de lobo/felino como casco, garras largas, cola de nervios luminosos, ojos fosforescentes.
- **Micelio — Coloso Raíz:** el más grande (escala ×1,25), armadura de corteza y raíces, hombros de hongos-estantería, brazos descomunales, cuerpo cubierto de musgo luminoso.
- **Umbra — el Errante:** sudario de sombra que flota (sin piernas visibles), fragmentos de espejo orbitando, capucha vacía con dos puntos de luz, hoja dimensional.
- **Seraf — Ángel Caído:** vestido y armadura de marfil y oro, alas de luz de muchas plumas (sueltas, con física simple), aureola quebrada, látigo de luz.

## Evolución y órganos visibles (contrato con la sim)
`pth` (caminos elegidos), `cg` (órganos del campeón), `evo`, `mw` (arma melee fusionada) cambian el cuerpo: ver cabecera de host-human.js. Aspecto
regional por mapa (REGION). Cada camino agrega una pieza FÍSICA reconocible; cada órgano crece en el cuerpo (organs-vis.js).

## Calidad objetivo y presupuesto
Lo más cercano a Warframe que se pueda: detalle de armadura con kitbash (muchas piezas pequeñas biseladas), materiales PBR con normales,
siluetas icónicas, animación real. Presupuesto Low ≤ 45 draw calls / 20k tris por Huésped (fusionar piezas por material); Media/Alta más detalle.
