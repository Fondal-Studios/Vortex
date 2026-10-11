// Proporciones del NPC aplicadas a la pose de enlace (sin dependencias: se prueba en node).
// Se aplica igual a cuerpo, ropa, cabello, cejas y capas procedurales para que todo encaje sin clipping.
const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const HEAD_CENTER = [0, 1.585, 0.055];

export function deformPoint(x, y, z, b) {
  // Cabeza: escala alrededor del centro del cráneo (incluye pelo, cejas, ojos y barba).
  const hk = smooth(y, 1.44, 1.5) * (b.head - 1);
  if (hk) { x += x * hk; y += (y - HEAD_CENTER[1]) * hk; z += (z - HEAD_CENTER[2]) * hk; }
  // Rostro y complexión (fórmula histórica de narrativeHuman.js conservada).
  const face = smooth(y, 1.39, 1.52), jaw = Math.exp(-Math.pow((y - 1.48) / 0.08, 2));
  x *= b.width + (1 + (b.jaw - 1) * jaw - b.width) * face;
  if (z > 0.065 && y > 1.48 && y < 1.62) z += (b.nose - 1) * 0.03 * Math.exp(-Math.pow(x / 0.025, 2));
  // Hombros: desplaza clavículas y brazos hacia afuera.
  const ax = Math.abs(x);
  if (b.shoulders !== 1 && y > 0.85 && y < 1.5) x += Math.sign(x) * (b.shoulders - 1) * 0.18 * smooth(ax, 0.05, 0.17) * smooth(y, 0.85, 1.2) * (1 - smooth(y, 1.43, 1.49));
  // Vientre: volumen frontal suave.
  if (b.belly > 0) z += b.belly * 0.065 * Math.exp(-Math.pow((y - 1.04) / 0.11, 2)) * Math.exp(-Math.pow(x / 0.13, 2)) * smooth(z, -0.02, 0.07);
  return [x, y, z];
}

export function deformPositions(src, out, body) {
  const b = { height: 1, width: 1, shoulders: 1, belly: 0, head: 1, jaw: 1, nose: 1, ...body };
  for (let i = 0; i < src.length; i += 3) { const p = deformPoint(src[i], src[i + 1], src[i + 2], b); out[i] = p[0]; out[i + 1] = p[1]; out[i + 2] = p[2]; }
  return out;
}
