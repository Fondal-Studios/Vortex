// STUB propio (reemplaza core/quality.js y world/materials.js de ARCANUM): perfiles de calidad para personas 3D.
// low = pensado para iPhone con muchos jugadores; medium/high para escritorio.
//   textureMax: lado máximo de las texturas · accessoryDetail: segmentos de piezas procedurales (0 = mínimo)
//   lite: sin capas de tela procedurales (abrigos/capas, ≈11 k triángulos por persona), ojos sin córnea y traje liviano
//   shadows: sombras propias · particles: partículas de afinidad (0 = ninguna) · lodDistance: metros a partir de los cuales se apaga el detalle
export const PROFILES = {
  low:    { textureMax: 256,  accessoryDetail: 0, shadows: false, particles: 0,   lodDistance: 6,  facial: false, normalMaps: false, lite: true },
  medium: { textureMax: 512,  accessoryDetail: 1, shadows: false, particles: 0.4, lodDistance: 12, facial: true,  normalMaps: false, lite: false },
  high:   { textureMax: 1024, accessoryDetail: 2, shadows: true,  particles: 1,   lodDistance: 22, facial: true,  normalMaps: true, lite: false },
};
export function npcProfile(q, { movil = false } = {}) {
  const p = { ...(PROFILES[q] || PROFILES.medium) };
  if (movil) { p.shadows = false; p.textureMax = Math.min(p.textureMax, 512); }
  return p;
}

/** Reduce una textura ya cargada a `max` px de lado (usa un lienzo; libera memoria de GPU en móviles). */
export function achicarEnMovil(t, max) {
  try {
    const im = t.image, w = im?.naturalWidth || im?.width || 0, h = im?.naturalHeight || im?.height || 0;
    if (!w || !h || !max || Math.max(w, h) <= max) return;
    const k = max / Math.max(w, h), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d', { willReadFrequently: true }).drawImage(im, 0, 0, c.width, c.height);
    t.image = c; t.needsUpdate = true;
  } catch (e) { console.warn('[arcanum] no se pudo achicar la textura', e); }
}
