// KIT ORGÁNICO — bloques para construir criaturas VIVAS (no formas geométricas): piel que respira con micro-relieve, venas que
// laten, bioluminiscencia, heridas que aparecen con el daño, ojos húmedos con iris que miran, tentáculos que ondulan,
// mandíbulas, patas con cinemática inversa y cristales que brotan de la piel (biocristal). Todo procedural, sin texturas.
//   · materiales  → organism-skin.js  (flesh, chitin, membrane, goo, fur, bone, bioCrystal, lid + setHurt/setWound/setBeat)
//   · ojos        → organism-eye.js   (eye con kind: normal | predator | cyclops | insect | compound)
//   · piezas      → organism-parts.js (blob, horn, tentacle, leg, jaw, crestRow, teeth, ribs, sac, scar, mergeStatic…)
// La API anterior sigue intacta; todo lo nuevo es opcional. Guía de uso: ver el informe / comentarios de cada archivo.
import * as THREE from 'three';
import { uTime, crystalMaterial } from './shaders.js';
import { fleshMaterial, chitinMaterial, membraneMaterial, gooMaterial, furMaterial, boneMaterial, bioCrystalMaterial, lidMaterial, setHurt, setWound, setBeat } from './organism-skin.js';
import { eye } from './organism-eye.js';
import { blob, capsule, horn, crystalSpike, scatterOnSurface, tentacle, jaw, leg, crestRow, teeth, ribs, sac, scar, scarOn, mergeStatic, Spring, lodOf } from './organism-parts.js';

export { crystalMaterial };
export const TAU = Math.PI * 2;
export { fleshMaterial, chitinMaterial, membraneMaterial, gooMaterial, furMaterial, boneMaterial, bioCrystalMaterial, lidMaterial, setHurt, setWound, setBeat };
export { eye };
export { blob, capsule, horn, crystalSpike, scatterOnSurface, tentacle, jaw, leg, crestRow, teeth, ribs, sac, scar, scarOn, mergeStatic, Spring, lodOf };
export const kit = {
  fleshMaterial, chitinMaterial, membraneMaterial, gooMaterial, furMaterial, boneMaterial, bioCrystalMaterial, lidMaterial,
  blob, capsule, horn, crystalSpike, scatterOnSurface, tentacle, eye, jaw, leg, crestRow, teeth, ribs, sac, scar, scarOn, mergeStatic,
  Spring, setHurt, setWound, setBeat, THREE, TAU, uTime,
};
