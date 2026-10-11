// ARCANUM NPC FACTORY — almacén compartido: un solo esqueleto de referencia, buffers GPU compartidos,
// texturas cacheadas con carga diferida y clips redirigidos una sola vez para todos los NPC.
import * as T from 'three';
import { crearEsqueletoMH, decodificarClips } from './rig.js';
import { achicarEnMovil } from './quality.js';

// ADAPTADO para Cristal Vórtice: los assets viven en /assets/arcanum/ y las animaciones ya vienen
// redirigidas al rig MakeHuman y empaquetadas (clips.bin + clips.json, ver src/arcanum/build-clips.mjs).
export const NPC_ASSET_BASE = new URL('../../assets/arcanum/narrative/', import.meta.url);
export const CLIPS_BASE = new URL('../../assets/arcanum/', import.meta.url);

const stores = new Map();
/** Un almacén por página y tamaño máximo de textura. */
export function getNpcStore({ textureMax = null, base = NPC_ASSET_BASE } = {}) {
  const key = String(base) + '|' + textureMax;
  if (!stores.has(key)) stores.set(key, createStore({ textureMax, base }));
  return stores.get(key);
}

function createStore({ textureMax, base }) {
  const loader = new T.TextureLoader(), textures = new Map(), meshes = new Map(), masks = new Map(), gains = new Map();
  let model = null, clips = null, clipsPromise = null, bodyCache = null, bytes = 0;
  const ready = (async () => {
    const r = await fetch(new URL('model.json', base)); if (!r.ok) throw Error('No se pudo cargar anatomía humana');
    model = await r.json();
  })();
  function boneWorld() {
    const W = {}; for (const b of model.bones) { const p = b.parent >= 0 ? W[model.bones[b.parent].name] : [0, 0, 0]; W[b.name] = [p[0] + b.pos[0], p[1] + b.pos[1], p[2] + b.pos[2]]; }
    return W;
  }
  const createSkeleton = () => crearEsqueletoMH(model);
  async function mesh(name) {
    await ready;
    if (!meshes.has(name)) meshes.set(name, (async () => {
      const data = model.meshes[name]; if (!data) throw Error(`Asset inexistente: malla ${name}`);
      const r = await fetch(new URL(data.file, base)); if (!r.ok) throw Error(`Asset inexistente: ${data.file}`);
      const buffer = await r.arrayBuffer(), attrs = {};
      for (const [k, a] of Object.entries(data.attributes)) {
        const Type = a.type === '<u4' ? Uint32Array : a.type === '<u2' ? Uint16Array : Float32Array;
        const arr = new Type(buffer, a.offset, a.count * a.width);
        attrs[k] = k === 'index' ? new T.BufferAttribute(arr, 1) : new T.BufferAttribute(arr, a.width);
      }
      return { name, attrs, base: attrs.position.array, triangles: data.triangles };
    })());
    return meshes.get(name);
  }
  async function bodyMask(outfit) {
    await ready;
    if (!masks.has(outfit)) masks.set(outfit, (async () => {
      const a = model.bodyMasks[outfit]; if (!a) return null;
      const r = await fetch(new URL('body-masks.bin', base)); if (!r.ok) throw Error('Máscaras de vestuario no disponibles');
      const buf = await r.arrayBuffer();
      for (const [n, m] of Object.entries(model.bodyMasks)) if (!masks.has(n) || n === outfit) masks.set(n, Promise.resolve(new T.BufferAttribute(new Uint32Array(buf.slice(m.offset, m.offset + m.count * 4)), 1)));
      return masks.get(outfit);
    })());
    return masks.get(outfit);
  }
  function texture(file) {
    if (!textures.has(file)) textures.set(file, loader.loadAsync(new URL(file, base).href).then((t) => {
      t.colorSpace = file.includes('normal') ? T.NoColorSpace : T.SRGBColorSpace; t.anisotropy = 4;
      if (textureMax) achicarEnMovil(t, file.includes('normal') ? Math.min(512, textureMax) : textureMax); else achicarEnMovil(t, file.includes('normal') ? 512 : 1024);
      gains.set(file, luminanceGain(t.image));
      return t;
    }).catch(() => { throw Error(`Material faltante: ${file}`); }));
    return textures.get(file);
  }
  // Factor para recolorear cabello/cejas por luminancia: el tinte elegido pasa a ser el color medio real.
  function luminanceGain(img) {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 32, 32);
      const d = g.getImageData(0, 0, 32, 32).data; let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { sum += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; n++; }
      return n ? Math.min(25, 1 / Math.max(0.03, sum / n)) : 1;
    } catch { return 2; }
  }
  // Datos crudos del cuerpo para derivar capas procedurales (barbas, capuchas, túnicas, botas, guantes).
  async function body() {
    if (bodyCache) return bodyCache;
    const m = await mesh('body'), W = boneWorld(), names = model.bones.map((b) => b.name);
    const si = m.attrs.skinIndex.array, sw = m.attrs.skinWeight.array, n = m.attrs.position.count, dominant = new Array(n);
    for (let i = 0; i < n; i++) { let best = 0; for (let k = 1; k < 4; k++) if (sw[i * 4 + k] > sw[i * 4 + best]) best = k; dominant[i] = names[si[i * 4 + best]]; }
    bodyCache = { position: m.base, normal: m.attrs.normal.array, uv: m.attrs.uv.array, skinIndex: si, skinWeight: sw, index: m.attrs.index.array, dominant, boneWorld: W, boneIndex: Object.fromEntries(names.map((nm, i) => [nm, i])) };
    return bodyCache;
  }
  async function animationClips() {
    await ready;
    if (clips) return clips;
    if (!clipsPromise) clipsPromise = (async () => {
      const [man, bin] = await Promise.all([fetch(new URL('clips.json', CLIPS_BASE)).then((r) => r.json()), fetch(new URL('clips.bin', CLIPS_BASE)).then((r) => r.arrayBuffer())]);
      bytes += bin.byteLength;
      clips = decodificarClips(bin, man.clips, man.pistas);
      return clips;
    })();
    return clipsPromise;
  }
  return {
    ready, mesh, bodyMask, texture, body, animationClips, createSkeleton, boneWorld,
    gain: (file) => gains.get(file) ?? 2,
    get model() { return model; },
    stats: () => ({ textures: textures.size, meshes: meshes.size }),
    dispose() { for (const p of textures.values()) p.then((t) => t.dispose()).catch(() => {}); textures.clear(); },
  };
}
