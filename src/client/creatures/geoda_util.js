// Utilidades compartidas de las criaturas pulidas (astilla, geoda, prisma, lente, cuarzo, espejo, racimo).
// Todo el kit propio (geometría, esqueleto, materiales, ojos) vive ahora en geoda-bio.js. Este archivo sólo conserva los exports
// históricos (halo, aura de escudo) por compatibilidad; los parches viejos del kit (fixEye, slimLeg, mergeStatic) ya no hacen falta
// porque el kit nuevo (organism.js) trae ojos y piezas buenas, y las criaturas usan mallas con esqueleto en vez de mallas sueltas.
export { glowSprite, shieldAura, tickAura, haloTexture } from './geoda-bio.js';
