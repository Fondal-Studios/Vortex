// Efectos locales a la cámara para las armas: fogonazos con forma propia, esquirlas de cristal y vapor.
import * as THREE from 'three';

/* ───────── texturas de fogonazo (una por forma, compartidas) ───────── */
const _tex = new Map();
export function flashTexture(shape) {
  let t = _tex.get(shape); if (t) return t;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.translate(S / 2, S / 2);
  const glow = (r, a0 = 1, a1 = 0, col = '255,255,255') => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `rgba(${col},${a0})`); gr.addColorStop(1, `rgba(${col},${a1})`); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); };
  const spike = (ang, len, w, a = 1) => { g.save(); g.rotate(ang); const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -w); g.lineTo(len, 0); g.lineTo(0, w); g.closePath(); g.fill(); g.restore(); };
  g.globalCompositeOperation = 'lighter';
  if (shape === 'star') { glow(46, 1, 0); for (let i = 0; i < 4; i++) spike(i * Math.PI / 2, 124, 6.5); for (let i = 0; i < 4; i++) spike(i * Math.PI / 2 + Math.PI / 4, 62, 4, 0.8); glow(16, 1, 0.4); }
  else if (shape === 'fan') { glow(70, 0.9, 0); for (let i = -5; i <= 5; i++) spike(i * 0.19 + (i % 2) * 0.05, 118 - Math.abs(i) * 5, 9 - Math.abs(i) * 0.5, 0.9); for (let i = 0; i < 6; i++) spike(Math.PI + (i - 2.5) * 0.4, 52, 5, 0.7); glow(30, 1, 0.3); }
  else if (shape === 'jet') { glow(34, 1, 0); for (let i = 0; i < 6; i++) spike(i * Math.PI / 3 + 0.3, 92 + (i % 2) * 24, 5.5, 0.95); glow(14, 1, 0.5); }
  else if (shape === 'ball') { for (let i = 0; i < 9; i++) { g.save(); g.rotate(i * 2.4); g.translate(30 + (i % 3) * 8, 0); glow(40 + (i % 4) * 8, 0.6, 0); g.restore(); } glow(96, 0.8, 0); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 100, 0, 7); g.stroke(); for (let i = 0; i < 8; i++) spike(i * Math.PI / 4 + 0.2, 126, 7, 0.7); glow(34, 1, 0.5); }
  else { /* ring: lente alargado + aro fino */ glow(30, 1, 0); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 54, 0, 7); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 84, 0, 7); g.stroke(); spike(0, 127, 5); spike(Math.PI, 127, 5); spike(Math.PI / 2, 80, 3, 0.8); spike(-Math.PI / 2, 80, 3, 0.8); glow(12, 1, 0.5); }
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _tex.set(shape, t); return t;
}

const GRAV = 3.2;

export class VMFx {
  constructor(root, halo, q) {
    this.root = root; this.halo = halo;
    // esquirlas / casquillos de cristal (tetraedros instanciados)
    this.nS = q.low ? 10 : q.high ? 28 : 18;
    this.shMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.011, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), this.nS);
    this.shMesh.frustumCulled = false; this.shMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sh = Array.from({ length: this.nS }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: 1 }));
    const c0 = new THREE.Color(0xffffff); for (let i = 0; i < this.nS; i++) this.shMesh.setColorAt(i, c0);
    this.shMesh.count = this.nS; root.add(this.shMesh); this.shI = 0;
    // vapor y chispas (puntos aditivos con tamaño por partícula)
    this.nP = q.low ? 26 : q.high ? 80 : 50;
    const geo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(this.nP * 3); this.pCol = new Float32Array(this.nP * 4); this.pSize = new Float32Array(this.nP);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aCol', new THREE.BufferAttribute(this.pCol, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.pSize, 1).setUsage(THREE.DynamicDrawUsage));
    this.pMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { map: { value: halo }, uScale: { value: 600 } },
      vertexShader: 'attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.0, aSize * uScale / max(0.05, -mv.z)); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec4 vC; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vC.rgb, vC.a * a); }',
    });
    this.points = new THREE.Points(geo, this.pMat); this.points.frustumCulled = false; this.points.renderOrder = 9; root.add(this.points);
    this.pt = Array.from({ length: this.nP }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 0.1, grow: 0, a: 0, col: new THREE.Color(), drag: 1.5, rise: 0 })); this.pI = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._c = new THREE.Color();
  }
  setScale(fovDeg, heightPx) { this.pMat.uniforms.uScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)); }
  shard(p, v, hex, size = 1) {
    const s = this.sh[this.shI++ % this.nS]; s.life = s.max = 0.55 + Math.random() * 0.35; s.p.copy(p); s.v.copy(v); s.s = size;
    s.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); s.w.set((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24);
    this._c.set(hex).lerp(new THREE.Color(0xffffff), 0.25).multiplyScalar(1.3); this.shMesh.setColorAt(this.sh.indexOf(s), this._c); this.shMesh.instanceColor.needsUpdate = true;
  }
  puff(p, v, hex, { size = 0.08, grow = 0.2, life = 0.5, alpha = 0.4, drag = 1.6, rise = 0.15 } = {}) {
    const s = this.pt[this.pI++ % this.nP]; s.life = s.max = life * (0.8 + Math.random() * 0.4); s.p.copy(p); s.v.copy(v); s.s = size; s.grow = grow; s.a = alpha; s.col.set(hex); s.drag = drag; s.rise = rise;
  }
  update(dt) {
    const m = this._m, q = this._q, e = this._e;
    for (let i = 0; i < this.nS; i++) {
      const s = this.sh[i];
      if (s.life > 0) {
        s.life -= dt; s.v.y -= GRAV * dt; s.p.addScaledVector(s.v, dt); s.r.addScaledVector(s.w, dt);
        const k = Math.max(0, s.life / s.max), sc = s.s * Math.min(1, k * 3); q.setFromEuler(e.set(s.r.x, s.r.y, s.r.z)); m.compose(s.p, q, new THREE.Vector3(sc, sc, sc));
      } else m.makeScale(0, 0, 0);
      this.shMesh.setMatrixAt(i, m);
    }
    this.shMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.nP; i++) {
      const s = this.pt[i];
      if (s.life > 0) {
        s.life -= dt; const k = Math.max(0, s.life / s.max); s.v.multiplyScalar(Math.exp(-s.drag * dt)); s.v.y += s.rise * dt; s.p.addScaledVector(s.v, dt);
        this.pPos[i * 3] = s.p.x; this.pPos[i * 3 + 1] = s.p.y; this.pPos[i * 3 + 2] = s.p.z;
        this.pCol[i * 4] = s.col.r; this.pCol[i * 4 + 1] = s.col.g; this.pCol[i * 4 + 2] = s.col.b; this.pCol[i * 4 + 3] = s.a * k * Math.min(1, (1 - k) * 12 + 0.2);
        this.pSize[i] = s.s + s.grow * (1 - k);
      } else this.pCol[i * 4 + 3] = 0;
    }
    const g = this.points.geometry; g.attributes.position.needsUpdate = g.attributes.aCol.needsUpdate = g.attributes.aSize.needsUpdate = true;
  }
  dispose() {
    this.root.remove(this.shMesh, this.points); this.shMesh.geometry.dispose(); this.shMesh.material.dispose(); this.points.geometry.dispose(); this.pMat.dispose();
  }
}
