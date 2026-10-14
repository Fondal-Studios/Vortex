// Recursos fotográficos CC0 de Poly Haven (descargados con tools/polyhaven-fetch.mjs → public/assets/ph/, lista en docs/ASSETS.md).
// · phTextures(id, {repeat})  → { map, normalMap, roughnessMap } (cacheados; listos para MeshStandardMaterial / MeshPhysicalMaterial).
// · phMaterial(id, opts)      → MeshStandardMaterial con esos mapas (mármol, piedra, oro, lino…).
// · loadEnvHDRI(gl, id)       → Promise<Texture> PMREM del cielo HDRI (reflejos y luz ambiente por imagen).
// Si un archivo falta (p. ej. copia sin assets), los materiales siguen funcionando con su color plano.
import * as THREE from 'three';

export const PH_BASE = new URL('../../public/assets/ph/', import.meta.url).href; // relativo al módulo: sirve igual en el servidor local y en el sitio estático
export const PH = {
  textures: ['marble_01', 'marble_tiles', 'white_sandstone_bricks', 'medieval_wall_01', 'metal_plate', 'rough_linen'],
  hdris: ['small_cathedral_02', 'moonless_golf', 'qwantani_dusk_2_puresky'],
};
/** Cielo de iluminación de cada mapa: templo dorado (interior), atardecer (islas), noche (laberinto). */
export const MAP_HDRI = { m1: 'qwantani_dusk_2_puresky', m2: 'small_cathedral_02', m3: 'moonless_golf', m4: 'small_cathedral_02', m5: 'moonless_golf', m6: 'small_cathedral_02', menu: 'small_cathedral_02' };

const loader = new THREE.TextureLoader(), texCache = new Map();
function load(url, srgb, repeat) {
  const key = url + '|' + repeat; let t = texCache.get(key); if (t) return t;
  t = loader.load(url, undefined, undefined, () => { /* sin el archivo: queda el color del material */ });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t); return t;
}
export function phTextures(id, { repeat = 1 } = {}) {
  const p = `${PH_BASE}${id}/${id}_`;
  return { map: load(p + 'diff_1k.jpg', true, repeat), normalMap: load(p + 'nor_gl_1k.jpg', false, repeat), roughnessMap: load(p + 'rough_1k.jpg', false, repeat) };
}
/** Material PBR con mapas fotográficos. `color` tiñe el diffuse (oro = metal_plate × dorado, metalness 1). */
export function phMaterial(id, { repeat = 1, color = 0xffffff, metalness = 0, roughness = 1, normalScale = 1, envMapIntensity = 1, physical = false, ...rest } = {}) {
  const M = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  return new M({ ...phTextures(id, { repeat }), color, metalness, roughness, normalScale: new THREE.Vector2(normalScale, normalScale), envMapIntensity, ...rest });
}
/** Oro envejecido (filigrana, máscaras, coronas). */
export const goldMaterial = (o = {}) => phMaterial('metal_plate', { color: 0xf2c66d, metalness: 1, roughness: 0.55, repeat: 2, normalScale: 0.6, envMapIntensity: 1.4, ...o });
/** Porcelana / mármol pulido (máscaras rituales, placas). */
export const porcelainMaterial = (o = {}) => phMaterial('marble_01', { color: 0xffffff, emissive: 0x34343c, metalness: 0, roughness: 0.4, repeat: 1, normalScale: 0.35, envMapIntensity: 1.1, physical: true, clearcoat: 0.6, clearcoatRoughness: 0.25, ...o });

const envCache = new Map();
/** Carga un HDRI 1K y lo pasa por PMREM. Cachea por renderer+id. */
export function loadEnvHDRI(gl, id) {
  const key = id; if (envCache.has(key)) return envCache.get(key);
  const pr = import('three/addons/loaders/HDRLoader.js').then(({ HDRLoader }) => new Promise((res, rej) => {
    new HDRLoader().setDataType(THREE.HalfFloatType).load(`${PH_BASE}${id}/${id}_1k.hdr`, (hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping; const pm = new THREE.PMREMGenerator(gl); const env = pm.fromEquirectangular(hdr).texture; pm.dispose(); hdr.dispose(); res(env);
    }, undefined, rej);
  }));
  pr.catch(() => envCache.delete(key)); envCache.set(key, pr); return pr;
}
