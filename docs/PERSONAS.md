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

## API v2 (animación por capas, arma, roles, gestos)
`createHuman(kit, { preset, role, color, weapon, name, overrides })`
- `role`: `'vanguardia'` (peto, hombreras de cristal, cúpula en el hombro) · `'soporte'` (mochila blanca con frascos de cristal verde y cruz luminosa) · `'ingeniero'` (overol, mochila con herramientas y mini-torreta plegada, gafas) · `'explorador'` (visor luminoso, capa corta, rollo de dormir). Mismo cuerpo base; `color` tiñe los acentos de cristal y un matiz de la sudadera. **render.js todavía no pasa `role`**: agregar `role: p.role` en el `createHuman` de `syncPlayers`.
- `weapon`: índice de `createWeaponModel` (por defecto 0; `null` = desarmado). `h.setWeapon(i)` cambia el arma con animación (baja la vieja, sube la nueva, destello). Si `weapons-vm.js` no existe se usa un arma de respaldo.
- `h.update(dt, { speed, moveDir:{x,z}, pitch, look, firing, camera })`: `speed` (m/s) elige idle/walk/jog/sprint para las PIERNAS y ajusta el paso; `moveDir` (x derecha, z adelante, relativo a hacia dónde mira) da strafe y retroceso (las piernas giran hasta ±66° y hacia atrás el ciclo corre al revés; el torso lo compensa); `pitch` (rad, + arriba) reparte el giro en columna/cuello y el arma lo sigue.
- Capas: con arma, torso/brazos/cabeza = `aimIdle` + retroceso procedural y la mano izquierda se coloca por IK en el guardamano; las piernas siguen a la locomoción. Sin arma, las dos capas usan el mismo clip. Clips `idle walk jog sprint aim aimIdle shoot` son «de locomoción»; los demás (`fall death revive interact cast reload hit jump…`) son de cuerpo entero. `revive` = muerte al revés (reanimación), `interact` = gesto de ayuda.
- `h.shoot()` (o `play('shoot',{restart:true})`): retroceso + fogonazo en la boca (`userData.muzzle`). `h.gesture('ping',{target:Vector3})` señala con el brazo derecho, `h.gesture('wave')` saluda, `h.gesture(null)` cancela.
- Equipo en `src/arcanum/gear.js`, IK en `src/arcanum/pose.js`.

## Guantes y tatuajes de cristal (manos y antebrazos)
`createHuman(kit, { char: 'egida'|'lumen'|'forja'|'vigia'|'nova'|'umbra', ... })` (también `CHAR_IDS`, `CHAR_INFO` en humans.js). `char` pone, si faltan, color, preset/semilla y rol del personaje (como CHARACTERS en src/sim/data.js). Sin `char`, un `role` elige el estilo (vanguardia→égida, soporte→lumen, ingeniero→forja, explorador→vigía); `hands:false` lo apaga; sin rol ni char no hay guantes (Pasajero/a igual que antes). `h.char` devuelve el estilo; `setLook({accent})` recolorea.
- Estilos: égida runas angulares y triángulos · lumen venas curativas + cruz (acento verde) · forja circuitos y chip · vigía constelaciones y astrolabio · nova ojos cósmicos (iris y párpados que parpadean) · umbra tentáculos con ventosas y ojo de pupila vertical con anillos de glifos.
- Cómo: (1) `gloveSkin` (materials.js) pinta la piel más allá de la muñeca como guante oscuro con yemas y aros luminosos (cero mallas); (2) gear.js `gloves()` agrega por mano 2 mallas fusionadas (tubo proyectado en el antebrazo sobre la manga + puño, placa del dorso, nudillos y muñequera de cristal) con un único `tattooMaterial` (shader emisivo, 6 estilos, pulso que viaja hacia la mano). Demo: `set=chars`, `set=solo&char=umbra&cam=handL|handR&anim=idle&weapon=none`.
- Costo: +4 draw calls y ≈+1,5 k triángulos por persona en todas las calidades (low ≈ 18–24 dc, 10–13 k tri); medium/high sólo suman teselado y 2 cristales. Límites: placas rígidas (no siguen el curvado de los dedos), tatuaje del antebrazo es una proyección sobre la manga, no piel; en vista de cuerpo entero (≈25 px de antebrazo) se lee como brillo de color más que como dibujo.

## LOD bajo (iPhone)
`low` usa mallas decimadas: `assets/arcanum/narrative/lod.json + lod.bin` (1,5 MB; cuerpo ya recortado por prenda: ≈2,5–3,7 k tri, ropa ≈2 k, pelo 1–2,4 k, ojos 280, calzado 900). Regenerar (herramienta de un solo uso, no queda en package.json):
`npm i --no-save meshoptimizer && node src/arcanum/bake-lod.mjs` (o `MESHOPT_DIR=<carpeta con node_modules/meshoptimizer>`).

## Medidas (Chromium + SwiftShader, 4 personas con rol y arma 0)
| Calidad | Draw calls/persona | Triángulos/persona | Notas |
|---|---|---|---|
| low | 21–26 (arma ≈8–10 de ellas) | 9,5–12 k (antes ≈30 k) | LOD, sin capas de tela, piel liviana, sin sombras |
| medium | 24–28 | 37–48 k | cuerpo completo, trama de tela, poros |
| high | 24–28 | 42–53 k | + normal maps de ropa, sombras |
Descarga ≈7,6–8 MB (low baja además lod.bin 1,5 MB y no el cuerpo de 1,1 MB). Las texturas en disco son 512 px.

## Pruebas
`node tools/shot-humans.js <q> --w 1400 --h 560 --multi "nombre:set=roles&cam=full&frozen=1&speed=4&move=0,1;..."` → `shots/<nombre>.jpg`. Parámetros de la demo: ver cabecera de `src/client/humans-demo.js` (set, role, weapon, anim, speed, move, pitch, cam, yaw, ov=campo:valor).

## Límites honestos (v2)
- No medido en iPhone real. low sigue pasando de 8–10 k triángulos y ~25 draw calls cuando el arma (varias mallas) cuenta; medium/high subieron por el equipo.
- En low la ropa oscura se ve muy oscura (sin mapa de entorno). Metal de equipo sin reflejos reales en low.
- Cara/pelo: base MakeHuman 512 px; borde de pelo duro (el juego no usa MSAA). Dedos del gesto «señalar» no se curvan (mano abierta).
- Peto de la vanguardia algo cuadrado; capa del explorador es una malla rígida que se mece. No se verificó visualmente: reanimación (`revive`), saludo, `ping`, cambio de arma animado (sólo se probó que corre sin errores).
- La mano izquierda por IK puede tener un pequeño desfase con armas largas.

## Origen y licencias
- Copiado/adaptado de `duelo-arcano` (propio del autor): `src/npc/{actor,store,rig,library,parts,materials,schema,deform}.js` y `src/characters/retarget.js` → `src/arcanum/`. Cambios: stubs propios `quality.js` (reemplaza core/quality.js y world/materials.js), `locomotion.js` (sólo velocidades), sin biblioteca de importación; `store.js` carga clips ya horneados; `materials.js` parcheado para three 0.186 (el shader de luz cambió: `BRDF_Lambert(diffuseContribution)`); `actor.js` con perfil `lite`, clips de una sola vez, `restart`/`fade`; presets propios en `src/client/humans.js`.
- `assets/arcanum/narrative/*`: MakeHuman core assets **CC0** (cuerpo, ojos, cabellos, cejas, pieles, trajes, calzado). Incluye `LICENSE.md`, `provenance.json`, `sources.json`. **La verificación pieza por pieza de las ampliaciones (cabellos long01/ponytail01/short02/short04, cejas, pieles extra) quedó pendiente de revisión humana** antes de distribución comercial (así lo declara el LICENSE.md original).
- `assets/arcanum/clips.*`: Quaternius Universal Animation Library, **CC0**, regenerables con `node src/arcanum/build-clips.mjs <ruta>/AnimationLibrary_Godot_Standard.gltf`.
- **No se usó nada de Ready Player Me** (ni `rival_base.glb`, ni avatar del jugador, ni `fp_arm`/`fp_skin`).
