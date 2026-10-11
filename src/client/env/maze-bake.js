import * as THREE from 'three';

// "Horneado" del laberinto: como los muros no se mueven, calculamos UNA vez (al cargar el mapa) dos mapas pequeños que
// el suelo y los muros leen en el shader: distancia al muro más cercano (para oclusión y brillo de la base) y
// sombra del sol (los muros proyectan sombras largas en el suelo, en TODAS las calidades, sin costo por cuadro).
export const BAKE_HALF = 80;   // el mapa horneado cubre [-80, 80] en x y z

/** Devuelve { bake: DataTexture RGBA (R = distancia al muro/8, G = luz de sol 0..1, B = apertura), pass: DataTexture RG (pasillos) }. */
export function bakeMaze(map, { res = 2, rays = 4, sun = [0.55, 0.62, -0.45], wallH = 12 } = {}) {
  const W = Math.round(BAKE_HALF * 2 * res), data = new Uint8Array(W * W * 4);
  const L = new THREE.Vector3(...sun).normalize();
  const walls = map.walls.map((w) => ({ x0: w.c.x - w.h.x, x1: w.c.x + w.h.x, z0: w.c.z - w.h.z, z1: w.c.z + w.h.z }));
  // direcciones del sol con un poco de abanico (sombras suaves)
  const dirs = [];
  const tx = new THREE.Vector3().crossVectors(L, new THREE.Vector3(0, 1, 0)).normalize(), ty = new THREE.Vector3().crossVectors(tx, L).normalize();
  for (let k = 0; k < rays; k++) { const a = (k / rays) * 6.2832 + 0.4, rr = rays === 1 ? 0 : 0.085; dirs.push(L.clone().addScaledVector(tx, Math.cos(a) * rr).addScaledVector(ty, Math.sin(a) * rr).normalize()); }
  const REACH = 22;
  const near = [];
  for (let iz = 0; iz < W; iz++) for (let ix = 0; ix < W; ix++) {
    const x = (ix + 0.5) / res - BAKE_HALF, z = (iz + 0.5) / res - BAKE_HALF;
    near.length = 0; let dmin = 99;
    for (const w of walls) {
      const dx = Math.max(w.x0 - x, 0, x - w.x1), dz = Math.max(w.z0 - z, 0, z - w.z1), d = Math.hypot(dx, dz);
      if (d < dmin) dmin = d;
      if (d < REACH) near.push(w);
    }
    let lit = 0;
    for (const d of dirs) {
      let hit = false;
      for (const w of near) { // rayo desde (x, 0.2, z) hacia el sol contra la caja [x0,x1]×[0,H]×[z0,z1]
        let t0 = 0, t1 = 1e9;
        const sl = (o, dd, a, b) => { if (Math.abs(dd) < 1e-6) return o >= a && o <= b; let ta = (a - o) / dd, tb = (b - o) / dd; if (ta > tb) { const s = ta; ta = tb; tb = s; } t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); return t0 <= t1; };
        if (sl(x, d.x, w.x0, w.x1) && sl(0.2, d.y, 0, wallH) && sl(z, d.z, w.z0, w.z1) && t1 > 0.01) { hit = true; break; }
      }
      if (!hit) lit++;
    }
    // apertura: cuántos de 8 rumbos a 6 u están libres de muro (esquinas y pasillos estrechos oscurecen más)
    let open = 0;
    for (let k = 0; k < 8; k++) { const a = k * 0.7854, px = x + Math.cos(a) * 5, pz = z + Math.sin(a) * 5; let inside = false; for (const w of near) if (px >= w.x0 && px <= w.x1 && pz >= w.z0 && pz <= w.z1) { inside = true; break; } if (!inside) open++; }
    const o = (iz * W + ix) * 4;
    data[o] = Math.min(255, Math.round((dmin / 8) * 255)); data[o + 1] = Math.round((lit / dirs.length) * 255); data[o + 2] = Math.round((open / 8) * 255); data[o + 3] = 255;
  }
  const bake = new THREE.DataTexture(data, W, W, THREE.RGBAFormat, THREE.UnsignedByteType);
  bake.magFilter = THREE.LinearFilter; bake.minFilter = THREE.LinearFilter; bake.wrapS = bake.wrapT = THREE.ClampToEdgeWrapping; bake.needsUpdate = true;

  // pasillos: por celda (N×N), R = abierto hacia +x (este), G = abierto hacia +z (sur), B = 255 si la celda está en la plaza
  const mz = map.maze, N = mz.vw.length - 1, pd = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const o = (j * N + i) * 4;
    pd[o] = i < N - 1 && !mz.vw[i + 1][j] ? 255 : 0;
    pd[o + 1] = j < N - 1 && !mz.hw[i][j + 1] ? 255 : 0;
    pd[o + 2] = 0; pd[o + 3] = 255;
  }
  const pass = new THREE.DataTexture(pd, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  pass.magFilter = THREE.NearestFilter; pass.minFilter = THREE.NearestFilter; pass.needsUpdate = true;
  return { bake, pass, N };
}
