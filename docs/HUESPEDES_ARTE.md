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

---

## EL KIT — cómo se arma (y se mejora) un Huésped

### Mapa de archivos
| archivo | qué hace |
|---|---|
| `src/client/huesped-cuerpo.js` | **`createHostBody(THREE, kit, jugador, {quality, camera, map})`**: el cuerpo ÚNICO (partida, selección, evolución). Crea al humano de ARCANUM (`humans.js`, sin ropa ni pelo), lo viste con el diseño de `player.char`, aplica evolución (`pth`/`evo`), órganos (`cg`), arma melee (`mw`) y aspecto regional (`REGION`), y reconstruye sólo cuando cambia alguno. Devuelve `{ object, event(e), update(dt, pl, ctx), pose(k), setMap(m), stats(), ready (Promise), isReady, human:true, person, kit, dispose() }`. Exporta `FRAME` (encuadre para las pantallas) e `isHost`. |
| `src/client/huesped-armor.js` | **El kit**: `createArmorKit(human, kit, {quality, accent, rim, crack, belly})`. Primitivas de geometría (`G`), fusión por material en mallas con esqueleto, materiales PBR, huesos extra, cadenas de muelles, tela (Verlet), halos y brasas. |
| `src/client/huesped-piezas.js` | Caja de herramientas de diseño (`tools(ak)`): `armorPlate`, `outline`, `spikeAt`, `seam`, `crackLine`, `ringAt`, `limb`, `dome`, `cuff`, `bonelump`, `box`, `blade`… |
| `src/client/huesped-evo-piezas.js` | **`addEvolution(ak, ctx, {t, pal})`**: una pieza física por cada camino de `EVO_PATHS` (garras / placas / tendones / anillos / simbiosis / cañones / alas / vacío), sirve para los cinco. |
| `src/client/huesped/<id>.js` | El **diseño** de cada Huésped: `export function build(ak, ctx)` (+ `export const BELLY`). `axioma.js` es el de referencia (calidad objetivo); `vesper/micelio/umbra/seraf.js` son versiones base. |
| `public/huesped-arte.html` + `src/client/huesped-arte-demo.js` | Visor de arte (mismas luces y HDRI que la selección, bloom en Media/Alta). `?char=axioma&evo=4&pth=coraza,resonancia,artilleria,apoteosis&q=low&cam=q34&yaw=30&clip=punch&speed=7&frozen=1&w=900&h=900` (cams: full, q34, close, head, torso, back, backq, side, legs, hands). |
| `tools/shot-huesped-arte.mjs` | `node tools/shot-huesped-arte.mjs <carpeta> "n=a1&char=axioma&q=high&cam=q34" "n=a2&…"` → `<carpeta>/a1.png…` y imprime `calls`/`tris` por material. |
| `tools/shot-huesped3p.mjs` | El Huésped en la partida real (3ª persona), por mapa/nivel/camino. `tools/shot-huespedes-sel.mjs`: la pantalla de selección con el cuerpo unificado. |

### Cómo funciona (en 6 líneas)
1. El esqueleto de ARCANUM tiene **326 huesos sin rotación en la pose de enlace** (A-pose): una pieza «a la altura del codo» sólo necesita la posición absoluta del codo (`ak.P('lowerarm01')`). `+Z` = adelante, `+X` = izquierda del personaje, `y = 0` = pies, el humano mide ≈ 1,7 u.
2. Cada pieza (una `BufferGeometry` en ese marco) se une **rígidamente a un hueso** (`skinIndex`) y todas las del mismo material se **funden en una sola `SkinnedMesh`**: ≈ 1 llamada de dibujo por material (metal, oro, hueso, cuero, brasa, luz, espíritu, cristal…).
3. El cuerpo humano se reemplaza por una piel **espectral** (`kit-cuerpo`: oscura, borde de luz por fresnel, grietas y vientre de brasa que laten con `uBeat`); la ropa y el pelo del humano se ocultan. Todo comparte **un único esqueleto** (el de ARCANUM + los huesos extra del kit).
4. Los materiales PBR usan las texturas Poly Haven (`rusty_metal_02`, `metal_plate`, `rock_boulder_cracked`, `brown_leather`, `bark_brown_02`, `rough_linen`, `marble_01`) proyectadas **en caja** (UV por cara en el momento de fusionar, así no hace falta desenrollar nada) y el metal lleva encima líneas de panel y remaches dibujados sobre su normal.
5. Lo que se mueve solo: **huesos extra** (`ak.bone`, p. ej. el halo de espadas que gira), **cadenas de muelles** (`ak.chain`: cola, látigo, tentáculos, raíces; cada eslabón es una pieza rígida pegada a su hueso) y **tela suelta** (`ak.cloth`: capa y faldones, Verlet con colisión contra cápsulas del cuerpo, la gravedad sigue el «arriba» del jugador; el dobladillo puede brillar con `ember:`).
6. `update(dt, t, {object, speed, glow})` hace latir las costuras (`uBeat`), mueve cadenas y telas y llama a las funciones que el diseño registró.

### Cómo se agrega una pieza a un Huésped
```js
// src/client/huesped/axioma.js  (dentro de build(ak, ctx))
const t = tools(ak), { G, X, limb, spikeAt, seam, S, low } = t, P = (n) => ak.P(n);
ak.both(() => {                                    // se dibuja el lado IZQUIERDO (+x); el derecho se espeja solo
  const E0 = P('lowerarm01'), W0 = P('wrist');
  // placa con bisel, curvada alrededor del antebrazo, con filete de brasa (todo en una llamada)
  t.armorPlate('lowerarm01', [[-0.03, 0.09], [0.03, 0.09], [0.024, -0.09], [-0.024, -0.09]],
    { depth: 0.014, wrap: { rx: 0.062, rz: 0.066 }, color: 0x666a82, trim: 'ember', place: (g) => limb(g, E0, W0, 0.55) });
  ak.add('bone', spikeAt(E0.clone().add(V(0.07, 0, -0.04)), V(1, 0.25, -0.7), 0.12, 0.019, 0.025, Y), 'lowerarm01', { color: 0xb5a482 });  // púa de hueso
  ak.add('ember', seam([a, b, c], 0.003), 'lowerarm01', { color: 0xff7a22 });                                                          // costura que late
});
```
- **`ak.add(material, geometría, hueso, {color})`**: materiales `metal`, `gold`, `bone`, `leather`, `bark`, `stone`, `cloth`, `marble` (PBR), `flesh`, `dark`, `mirror`, `crystal` (la luz interior sale del color del vértice), y los que brillan: `ember` (brasa), `light` (luz blanca/del Huésped), `spirit` (aditivo translúcido). `color` es un hex, `[r,g,b]` o una función `(x,y,z,nx,ny,nz) => color` (degradados por vértice, p. ej. la hoja de espíritu).
- Huesos: `head`, `neck01`, `spine01…05`, `clavicle`, `upperarm01`, `lowerarm01`, `wrist`, `finger2-3`…, `upperleg01`, `lowerleg01`, `foot`, `toe3-1` (en `both` se agrega `_L`/`_R`); los extra los crea `ak.bone('nombre', 'padre', posición)`.
- Convención de un **segmento a→b** (`limb(g, a, b, t, {off, r, s})`): la pieza se modela con eje **Y = a→b**, **+Z = adelante**, **+X = hacia el centro del cuerpo**.
- Primitivas (`G`): `plate` (extrusión con bisel y normales con arista dura), `wrapE`/`bend` (curvar una placa alrededor de un eje), `lathe` (`crease` = facetado), `tube` (radio variable, aristas, torsión), `spike`, `rock` (hueso/roca/corteza desplazados con ruido), `band`, `blade`, `shard`, `torus`, `box`, `rivets`.
- **Presupuesto**: en `low` usá `S(n, min)` para los segmentos (`ak.s`), `t.box`/`t.blade` (versiones baratas) y `if (!low)` para lo diminuto (remaches, collares). `ak.stats()` y `ak.dbg` (`[material, hueso, triángulos]` por pieza) dicen cuánto cuesta cada cosa; `node tools/shot-huesped-arte.mjs` imprime el total.
- **Evolución**: no hace falta tocar el diseño: `addEvolution(ak, ctx, {t, pal})` agrega las piezas de cada camino (mirá `ctx.has('coraza')`, `ctx.evo`, `ctx.path`). Un Huésped puede dibujar las suyas propias en su `build` con `ctx.has(...)`.
- **Para un Huésped nuevo**: crear `src/client/huesped/<id>.js`, agregarlo a `DESIGN` y `LOOK` (preset humano, escala, colores) en `huesped-cuerpo.js` y a `FRAME`.

### Presupuesto medido (renderer.info, escena con sólo el Huésped; `node --test tests/huesped-cuerpo.test.js`)
Baja (`q=low`, ≤ 45 llamadas / ≤ 20 000 triángulos por Huésped; el cuerpo espectral solo cuesta 3 668 triángulos y 1 llamada):
| Huésped | nivel 0 | nivel 4 (peor caso medido) |
|---|---|---|
| Axioma (referencia) | 18 llamadas · 15 344 tris | 27 llamadas · 19 758 tris |
| Vesper | 9 · 7 708 | 21 · 12 530 |
| Micelio | 6 · 8 916 | 20 · 13 738 |
| Umbra | 10 · 5 360 | 24 · 10 182 |
| Seraf (v2, detallado) | 17 · 15 934 | 29 · 19 364 |
Media/Alta usan más segmentos (`ak.Q` 1,0 / 1,25) y la piel completa (26 756 tris); Axioma Alta ≈ 80 000 tris en el kit (sin límite fijo).

### Pendiente para quien siga
- Vesper, Micelio, Umbra y Seraf son **versiones base**: silueta distinta y todo funciona (evolución, región, física), pero falta el nivel de detalle de Axioma (placas con `armorPlate` y filetes, paneles, costillar/vientre, cabeza trabajada). Usar `huesped/axioma.js` como modelo.
- Un crítico independiente con imágenes no estuvo disponible dentro de esta tarea: queda pendiente pasar `shots/huespedes-unificado/` por uno.
