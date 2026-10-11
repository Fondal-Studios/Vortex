// Utilidades compartidas por geoda / lente / cuarzo / racimo (fusión de piezas estáticas, halo y aura).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Funde en UN solo Mesh todas las mallas descendientes de `root` que usan el material `mat` (piezas que no se animan por separado). */
export function mergeStatic(root, mat) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), geos = [], kill = [];
  root.traverse((o) => {
    if (!o.isMesh || o.material !== mat) return;
    const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    geos.push(g); kill.push(o);
  });
  if (!geos.length) return null;
  const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
  kill.forEach((o) => o.parent && o.parent.remove(o)); geos.forEach((g) => g.dispose());
  const m = new THREE.Mesh(merged, mat); root.add(m); return m;
}

let haloTex = null;
export function haloTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (haloTex = new THREE.CanvasTexture(c));
}
/** Resplandor aditivo (sprite) que se ve desde cualquier ángulo. */
export function glowSprite(color, size = 1, opacity = 0) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.setScalar(size); return s;
}
/** Aura de escudo (cáscara aditiva). */
export function shieldAura(color, r = 1.5) {
  const a = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }));
  a.scale.setScalar(r); a.visible = false; a.userData.r = r; return a;
}
/** Anima el aura según st.sd. */
export function tickAura(a, st, t) { a.visible = !!st.sd; if (st.sd) { a.material.opacity = 0.16 + 0.07 * Math.sin(t * 6); a.scale.setScalar(a.userData.r * (1 + 0.025 * Math.sin(t * 5))); } }

/** Workaround del kit: en eye() el iris/pupila quedan por DEBAJO de la esclera (0.93r < r) y se ven blancos. Los saca a la superficie. */
export function fixEye(e) {
  const ball = e.object.children[0], look = e.object.children[1]; if (!ball || !look) return e;
  const r = ball.scale.x; look.children[0].position.z = r * 1.02; look.children[1].position.z = r * 1.035; return e;
}
