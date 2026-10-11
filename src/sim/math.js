// Matemática 3D mínima sobre objetos {x,y,z} + RNG determinista.
export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const clone = (a) => ({ x: a.x, y: a.y, z: a.z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const madd = (a, b, s) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const norm = (a, fallback = { x: 0, y: 1, z: 0 }) => {
  const l = Math.hypot(a.x, a.y, a.z);
  return l < 1e-9 ? clone(fallback) : { x: a.x / l, y: a.y / l, z: a.z / l };
};
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Quita de `a` su componente a lo largo de `n` (n unitario). */
export const project = (a, n) => madd(a, n, -dot(a, n));
/** Rotación de Rodrigues de v alrededor del eje unitario k. */
export function rotAround(v, k, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
}
export const finite = (a) => Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z);

export function makeRng(seed = 1) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    unit() {
      const z = next() * 2 - 1, a = next() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      return { x: r * Math.cos(a), y: z, z: r * Math.sin(a) };
    },
    gauss() { return (next() + next() + next() + next() - 2) * 1.2; },
  };
}
