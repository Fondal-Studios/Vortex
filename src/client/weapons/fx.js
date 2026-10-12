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
  else if (shape === 'bolt') { let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647; glow(40, 1, 0);
    for (let b = 0; b < 7; b++) { let a = b * 0.9 + 0.3, x = 0, y = 0; for (const [w, al] of [[9, 0.25], [3.5, 0.95]]) { x = 0; y = 0; a = b * 0.9 + 0.3; r = 7 + b * 13; g.lineWidth = w; g.strokeStyle = `rgba(255,255,255,${al})`; g.lineJoin = 'round'; g.beginPath(); g.moveTo(0, 0);
      for (let i = 0; i < 6; i++) { a += (rnd() - 0.5) * 1.5; x += Math.cos(a) * 21; y += Math.sin(a) * 21; g.lineTo(x, y); } g.stroke(); } }
    glow(18, 1, 0.4); }
  else if (shape === 'frost') { glow(60, 0.85, 0); for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * Math.PI / 3); spike(0, 124, 7, 1); for (const o of [44, 80]) for (const sg of [-1, 1]) { g.save(); g.translate(o, 0); g.rotate(sg * 0.9); spike(0, 36, 3.5, 0.9); g.restore(); } g.restore(); }
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.stroke(); glow(20, 1, 0.4); }
  else if (shape === 'blob') { let r = 3; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647; glow(70, 0.7, 0);
    for (let i = 0; i < 12; i++) { const a = rnd() * 6.28, d = 20 + rnd() * 60; g.save(); g.translate(Math.cos(a) * d, Math.sin(a) * d); glow(10 + rnd() * 22, 0.9, 0); g.restore(); }
    for (let i = 0; i < 7; i++) { const a = rnd() * 6.28; g.save(); g.rotate(a); g.translate(70 + rnd() * 40, 0); glow(5 + rnd() * 5, 1, 0.5); g.restore(); } glow(32, 1, 0.3); }
  else if (shape === 'ember') { glow(70, 0.8, 0); for (let i = -4; i <= 4; i++) { g.save(); g.rotate(-Math.PI / 2 + i * 0.28); const len = 110 - Math.abs(i) * 14 + (i % 2) * 14, gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -13); g.quadraticCurveTo(len * 0.55, -22, len, 0); g.quadraticCurveTo(len * 0.55, 22, 0, 13); g.closePath(); g.fill(); g.restore(); } glow(34, 1, 0.3); }
  else if (shape === 'saw') { glow(36, 1, 0); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 58, 0, 7); g.stroke(); for (let i = 0; i < 18; i++) { g.save(); g.rotate(i * Math.PI / 9); g.translate(58, 0); g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.moveTo(0, -7); g.lineTo(34, 0); g.lineTo(0, 7); g.closePath(); g.fill(); g.restore(); } glow(14, 1, 0.5); }
  else if (shape === 'pulse') { glow(40, 1, 0); for (const [rr, w] of [[30, 6], [58, 4.5], [88, 3.2], [116, 2]]) { g.strokeStyle = `rgba(255,255,255,${1.1 - rr / 140})`; g.lineWidth = w; g.beginPath(); g.arc(0, 0, rr, 0, 7); g.stroke(); } glow(16, 1, 0.5); }
  else if (shape === 'quad') { glow(34, 1, 0); for (const y of [-26, 0, 26]) { g.save(); g.translate(0, y); spike(0, 128, 6, 1); spike(Math.PI, 40, 5, 0.7); g.restore(); } for (let i = 0; i < 4; i++) spike(Math.PI / 2 + i * Math.PI / 2 * 0.5, 46, 4, 0.6); glow(14, 1, 0.5); }
  else if (shape === 'scythe') { glow(44, 0.8, 0); g.lineCap = 'round'; for (const [w, a] of [[22, 0.18], [12, 0.45], [5, 1]]) { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = w; g.beginPath(); g.arc(-30, 0, 96, -1.15, 1.15); g.stroke(); } for (let i = 0; i < 4; i++) spike(i * 1.57 + 0.4, 70, 4, 0.7); glow(16, 1, 0.5); }
  else if (shape === 'chaos') { let r = 11; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647; glow(54, 0.9, 0); for (let i = 0; i < 7; i++) spike(rnd() * 6.28, 70 + rnd() * 60, 4 + rnd() * 5, 0.9); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3; g.beginPath(); g.arc(8, -6, 52, 0, 7); g.stroke(); for (let i = 0; i < 6; i++) { g.save(); g.translate((rnd() - 0.5) * 130, (rnd() - 0.5) * 130); glow(6 + rnd() * 12, 1, 0); g.restore(); } glow(22, 1, 0.4); }
  else { /* ring: lente alargado + aro fino */ glow(30, 1, 0); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 54, 0, 7); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 84, 0, 7); g.stroke(); spike(0, 127, 5); spike(Math.PI, 127, 5); spike(Math.PI / 2, 80, 3, 0.8); spike(-Math.PI / 2, 80, 3, 0.8); glow(12, 1, 0.5); }
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _tex.set(shape, t); return t;
}

const GRAV = 3.2;

/** Haz del disparo: dos cintas cruzadas (siempre se ven de frente) que salen de la boca hacia -Z y se desvanecen. Escala (ancho, ancho, largo). */
export function makeBeam(hex) {
  const P = [], U = [], I = [];
  for (const ax of [0, 1]) { const o = P.length / 3; for (const [a, z, u, v] of [[-0.5, 0, 0, 0], [0.5, 0, 1, 0], [-0.5, -1, 0, 1], [0.5, -1, 1, 1]]) { P.push(ax ? 0 : a, ax ? a : 0, z); U.push(u, v); } I.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  const c = new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.35);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uC: { value: c }, uI: { value: 0 } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uC; uniform float uI; varying vec2 vU; void main(){ float x = abs(vU.x - 0.5) * 2.0; float core = pow(1.0 - x, 2.0), fade = pow(1.0 - vU.y, 1.6); vec3 col = mix(uC, vec3(1.0), core * 0.7); gl_FragColor = vec4(col * (core * 1.4 + 0.15) * fade * uI, 1.0); }',
  });
  const me = new THREE.Mesh(g, m); me.frustumCulled = false; return me;
}

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
  /** Oculta las mallas de partículas cuando no hay nada vivo (ahorra llamadas de dibujo en reposo). */
  setLive() { this.shMesh.visible = this.sh.some((s) => s.life > 0); this.points.visible = this.pt.some((s) => s.life > 0); }
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
