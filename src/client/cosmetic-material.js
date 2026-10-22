import { cosmeticFor } from '../shared/cosmetics.js';
import { HOST_IDENTITY } from '../shared/identity.js';
// Acabados sobre materiales propios del kit. No toca emisión, transparencia,
// silueta, armas, animación ni colores que comunican habilidades.
export function applyCosmeticMaterials(kit, host, id) {
  const c = cosmeticFor(host, id); if (!c || !kit?.mats) return;
  for (const name of ['metal', 'bone', 'gold', 'mirror', 'marble', 'bark', 'stone']) {
    const m = kit.mats[name]; if (!m?.color) continue;
    if (c.finish === 'archivo' && !['metal', 'bone', 'gold'].includes(name)) continue;
    if (c.finish !== 'archivo') m.vertexColors = false; // pintura sobre la superficie; las texturas y normales conservan el relieve
    const color = name === 'bone' ? c.bone : c.finish === 'archivo' ? HOST_IDENTITY[host].material : c.metal;
    m.color.set(color); m.roughness = c.roughness; m.needsUpdate = true; m.metalness = name === 'bone' ? 0 : c.metalness;
  }
}
