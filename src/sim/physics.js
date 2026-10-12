import { clamp, dot } from './math.js';

/**
 * Esfera (pos, r) contra los sólidos del mapa. Muta pos/vel y devuelve la mejor
 * normal de contacto respecto de `up` (para saber si está "parado").
 * Tipos: cyl (isla: disco vertical), sph (planetoide / colina), inner (cascarón hueco).
 */
export function collide(map, pos, vel, r, up) {
  let best = null, bestD = -2;
  const solids = map.solids;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    let nx = 0, ny = 0, nz = 0, hit = false;
    if (s.type === 'cyl') {
      if (pos.x - s.c.x > s.r + r || s.c.x - pos.x > s.r + r || pos.z - s.c.z > s.r + r || s.c.z - pos.z > s.r + r || pos.y > s.y1 + r || pos.y < s.y0 - r) continue; // descarte rápido (mapas con muchos discos)
      const dx = pos.x - s.c.x, dz = pos.z - s.c.z, d = Math.hypot(dx, dz);
      const k = d > s.r ? s.r / d : 1;
      const cx = s.c.x + dx * k, cz = s.c.z + dz * k, cy = clamp(pos.y, s.y0, s.y1);
      const ex = pos.x - cx, ey = pos.y - cy, ez = pos.z - cz, l = Math.hypot(ex, ey, ez);
      if (l < r && l > 1e-6) {
        nx = ex / l; ny = ey / l; nz = ez / l;
        pos.x = cx + nx * r; pos.y = cy + ny * r; pos.z = cz + nz * r; hit = true;
      } else if (l <= 1e-6) { // centro dentro del sólido: salir por la cara más cercana
        const top = s.y1 - pos.y, bot = pos.y - s.y0, side = s.r - d;
        const m = Math.min(top, bot, side);
        if (m === top) { ny = 1; pos.y = s.y1 + r; }
        else if (m === bot) { ny = -1; pos.y = s.y0 - r; }
        else { nx = dx / (d || 1); nz = dz / (d || 1); pos.x = s.c.x + nx * (s.r + r); pos.z = s.c.z + nz * (s.r + r); }
        hit = true;
      }
    } else if (s.type === 'sph') {
      const ex = pos.x - s.c.x, ey = pos.y - s.c.y, ez = pos.z - s.c.z, l = Math.hypot(ex, ey, ez), lim = s.r + r;
      if (l < lim) {
        if (l > 1e-6) { nx = ex / l; ny = ey / l; nz = ez / l; } else ny = 1;
        pos.x = s.c.x + nx * lim; pos.y = s.c.y + ny * lim; pos.z = s.c.z + nz * lim; hit = true;
      }
    } else if (s.type === 'inner') {
      const ex = pos.x - s.c.x, ey = pos.y - s.c.y, ez = pos.z - s.c.z, l = Math.hypot(ex, ey, ez), lim = s.R - r;
      if (l > lim && l > 1e-6) {
        nx = -ex / l; ny = -ey / l; nz = -ez / l;
        pos.x = s.c.x + (ex / l) * lim; pos.y = s.c.y + (ey / l) * lim; pos.z = s.c.z + (ez / l) * lim; hit = true;
      }
    } else if (s.type === 'box') {
      // caja alineada a los ejes (muros del laberinto): punto más cercano de la caja a la esfera
      const hx = s.h.x, hy = s.h.y, hz = s.h.z;
      if (pos.x < s.c.x - hx - r || pos.x > s.c.x + hx + r || pos.z < s.c.z - hz - r || pos.z > s.c.z + hz + r || pos.y < s.c.y - hy - r || pos.y > s.c.y + hy + r) continue;
      const qx = clamp(pos.x, s.c.x - hx, s.c.x + hx), qy = clamp(pos.y, s.c.y - hy, s.c.y + hy), qz = clamp(pos.z, s.c.z - hz, s.c.z + hz);
      const ex = pos.x - qx, ey = pos.y - qy, ez = pos.z - qz, l = Math.hypot(ex, ey, ez);
      if (l < r && l > 1e-6) { nx = ex / l; ny = ey / l; nz = ez / l; pos.x = qx + nx * r; pos.y = qy + ny * r; pos.z = qz + nz * r; hit = true; }
      else if (l <= 1e-6) { // centro dentro de la caja: salir por la cara más cercana
        const dxp = s.c.x + hx - pos.x, dxn = pos.x - (s.c.x - hx), dyp = s.c.y + hy - pos.y, dyn = pos.y - (s.c.y - hy), dzp = s.c.z + hz - pos.z, dzn = pos.z - (s.c.z - hz);
        const m = Math.min(dxp, dxn, dyp, dyn, dzp, dzn);
        if (m === dyp) { ny = 1; pos.y = s.c.y + hy + r; } else if (m === dyn) { ny = -1; pos.y = s.c.y - hy - r; }
        else if (m === dxp) { nx = 1; pos.x = s.c.x + hx + r; } else if (m === dxn) { nx = -1; pos.x = s.c.x - hx - r; }
        else if (m === dzp) { nz = 1; pos.z = s.c.z + hz + r; } else { nz = -1; pos.z = s.c.z - hz - r; }
        hit = true;
      }
    }
    if (hit) {
      if (vel) {
        const vn = vel.x * nx + vel.y * ny + vel.z * nz;
        if (vn < 0) { vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
      }
      const d = up ? nx * up.x + ny * up.y + nz * up.z : 0;
      if (d > bestD) { bestD = d; best = { x: nx, y: ny, z: nz, d }; }
    }
  }
  return best;
}

/** ¿El punto está dentro de materia sólida? (balas, cohetes, línea de tiro) */
export function blocked(map, p) {
  const solids = map.solids;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (s.type === 'cyl') {
      if (p.y >= s.y0 && p.y <= s.y1 && Math.hypot(p.x - s.c.x, p.z - s.c.z) <= s.r) return true;
    } else if (s.type === 'sph') {
      if (Math.hypot(p.x - s.c.x, p.y - s.c.y, p.z - s.c.z) <= s.r) return true;
    } else if (s.type === 'inner') {
      if (Math.hypot(p.x - s.c.x, p.y - s.c.y, p.z - s.c.z) >= s.R) return true;
    } else if (s.type === 'box') {
      if (Math.abs(p.x - s.c.x) <= s.h.x && Math.abs(p.z - s.c.z) <= s.h.z && Math.abs(p.y - s.c.y) <= s.h.y) return true;
    }
  }
  return false;
}
export { dot };
