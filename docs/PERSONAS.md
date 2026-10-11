# Personas humanas 3D (trasplante de la NPC Factory de ARCANUM)

Permite crear personas 3D para **Pasajero/a** (protagonista: alguien común atropellado por un tren que despierta en el Vórtice) y los **4 jugadores del coop** (pasajeros comunes con un acento psicodélico emisivo del color de cada jugador).

## Uso
```html
<script type="importmap">{ "imports": { "three": "/vendor/three/three.module.js", "three/addons/": "/vendor/three-addons/" } }</script>
```
(`three/addons/` hace falta porque `src/arcanum/actor.js` y `parts.js` importan `BufferGeometryUtils`; el servidor ya sirve `/vendor/three-addons/` y `/assets/`.)

```js
import { loadHumanKit, createHuman, PLAYER_COLORS } from './humans.js';
const kit = await loadHumanKit({ quality: 'low' });                  // 'low' | 'medium' | 'high'; una vez por página
const h = createHuman(kit, { preset: 'jugador2', color: PLAYER_COLORS[1], name: 'Ana' });
scene.add(h.object);                // se rellena solo al terminar de cargar (await h.ready)
h.play('walk'); h.update(dt, { speed: 3.1, camera });   // cada cuadro
```
- `createHuman(kit, spec)`: `spec = { preset: 'pasajero'|'jugador1'..'jugador4' | seed: 'texto', color: 0xRRGGBB, accent, name, overrides }`. Con `seed` genera una persona joven/adulta reproducible. `color` tiñe la ropa y el acento emisivo.
- Devuelve `{ object, ready, actor, clip, bones, play(clip,{fade,restart}), update(dt,{speed,look,camera,cull,snap}), setLook({color,accent,hair,hairColor,outfit,layer,...}) (async), stats(), dispose() }`. `disposeHumanKit(kit)` libera texturas.
- Clips: `idle walk run(jog) sprint crouch crouchWalk aim aimIdle shoot reload gesture(cast) spellIdle punch hit jump fall land death talk interact dance`. `shoot`, `hit`, `jump`, `land`, `death`, `punch`, `reload`, `cast`, `interact` se reproducen una vez y quedan en la última pose; usá `restart:true` para repetir un disparo. `update({speed})` en m/s ajusta el paso de walk/run/sprint para que los pies no patinen.
- Convención: pies en y=0, mide ≈1,7, **la cara mira a +Z**. Los materiales son `MeshStandardMaterial`: necesitan luces en la escena.
- Demo: `/public/humans.html?q=low|medium|high` (`&anim=walk` fuerza un clip). Captura: `node tools/shot-humans.js [low|medium|high]` → `shots/personas.jpg` (medium) o `personas-<q>.jpg`.

## Medidas (5 personas, Chromium + SwiftShader; sirven para comparar, los fps NO representan un iPhone)
| Calidad | Draw calls | Triángulos | Texturas máx. | Qué recorta |
|---|---|---|---|---|
| low | 34 (≈7/persona) | ≈150 k (≈30 k/persona) | 256 px | sin capas de tela procedurales (abrigos/capas), ojos sin córnea, sin cara animada (ojos/párpados/mandíbula), sin normal maps, sin sombras ni partículas, piel/telas sin detalle extra, 1 cristal de acento |
| medium | 54 (≈11/persona) | ≈210 k (≈42 k/persona) | 512 px | luz de piel, rubor, capas de tela, brazaletes |
| high | 54 | ≈211 k | 1024 px | + normal maps, brillos dobles, sombras propias si el renderer las activa |
Descarga: **≈7–8,5 MB** en total (cuerpo 1,1 MB + máscaras 0,6 MB + texturas de piel/ropa/pelo + `clips.bin` 0,4 MB); las texturas se bajan completas aunque low las achique a 256 px al cargar (no hay versiones chicas en disco). Cada persona extra reutiliza todo lo cargado. Carga inicial ≈5 s en SwiftShader.

## Qué funciona (verificado en Chromium headless)
Las 5 personas se ven con cuerpo, ropa, pelo, mochila, auriculares y acento emisivo, sin errores de consola ni de WebGL (las 3 calidades); animaciones idle/walk/jog/aim/shoot/cast/fall/death; `setLook`, `seed`, `dispose` ejecutados sin error.

## Qué NO se logró / límites honestos
- **No medido en iPhone real.** ≈30 k triángulos por persona en low es mucho si hay 4 jugadores + monstruos; el cuerpo MakeHuman (≈16 k visibles) no se pudo reducir sin una herramienta de decimado. «Menos huesos»: el rig sigue teniendo 326 huesos (sólo se salta la animación facial); no hay un esqueleto reducido.
- Las animaciones son de cuerpo entero (no hay capa «apuntar con el torso mientras corrés»): al disparar en movimiento el clip de disparo reemplaza al de correr. `shoot`/`aim` son de pistola; no hay clips de otras armas.
- La mochila, los auriculares y el cristal/brazaletes son geometría simple propia (cajas/toros); los auriculares sin cable. Los abrigos son las capas procedurales de ARCANUM (estilizadas); en low no hay abrigo, sólo el traje base. En low los trajes `male_worksuit01` son un overol azul (textura original), así que el color del jugador se nota sobre todo en la camiseta, mochila y acento.
- Look «de pasajero» aproximado: no hay jeans/campera reales como piezas; se usan los trajes MakeHuman disponibles. Proporciones algo anchas (base MakeHuman). Las caras no son de calidad GTA (ver `docs/AUDITORIA_NPC.md` de duelo-arcano).
- La verificación visual se hizo sólo con capturas estáticas (no se miró una secuencia larga de animación).

## Origen y licencias
- Copiado/adaptado de `duelo-arcano` (propio del autor): `src/npc/{actor,store,rig,library,parts,materials,schema,deform}.js` y `src/characters/retarget.js` → `src/arcanum/`. Cambios: stubs propios `quality.js` (reemplaza core/quality.js y world/materials.js), `locomotion.js` (sólo velocidades), sin biblioteca de importación; `store.js` carga clips ya horneados; `materials.js` parcheado para three 0.186 (el shader de luz cambió: `BRDF_Lambert(diffuseContribution)`); `actor.js` con perfil `lite`, clips de una sola vez, `restart`/`fade`; presets propios en `src/client/humans.js`.
- `assets/arcanum/narrative/*`: MakeHuman core assets **CC0** (cuerpo, ojos, cabellos, cejas, pieles, trajes, calzado). Incluye `LICENSE.md`, `provenance.json`, `sources.json`. **La verificación pieza por pieza de las ampliaciones (cabellos long01/ponytail01/short02/short04, cejas, pieles extra) quedó pendiente de revisión humana** antes de distribución comercial (así lo declara el LICENSE.md original).
- `assets/arcanum/clips.*`: Quaternius Universal Animation Library, **CC0**, regenerables con `node src/arcanum/build-clips.mjs <ruta>/AnimationLibrary_Godot_Standard.gltf`.
- **No se usó nada de Ready Player Me** (ni `rival_base.glb`, ni avatar del jugador, ni `fp_arm`/`fp_skin`).
