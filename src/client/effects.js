import * as THREE from 'three';
import { finish } from './shaders.js';

/** Partículas aditivas (Points), trazadores de disparo y ondas expansivas, todo en pools fijos. */
export class Effects {
  constructor(scene, cap = 3000, q = {}) {
    this.cap = 3000; this.limit = Math.min(cap, 3000); this.n = 0; this.head = 0; this.scene = scene;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.base = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = finish(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * 260.0 / max(-mv.z, 1.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vC, a * vA); }`,
    }));
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; scene.add(this.points);
    this.geo = g;
    // trazadores
    this.tracers = []; const tg = new THREE.CylinderGeometry(0.035, 0.035, 1, 4); tg.rotateX(Math.PI / 2); tg.translate(0, 0, 0.5);
    for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; m.life = 0; scene.add(m); this.tracers.push(m); }
    this.ti = 0;
    // ondas
    this.blasts = []; const bg = new THREE.SphereGeometry(1, 16, 10);
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: i % 2 === 0 })); m.visible = false; m.life = 0; scene.add(m); this.blasts.push(m); }
    this.bi = 0;
    // esquirlas sólidas (cristal / quitina) con física simple
    this.chunks = []; this.ci = 0; const cg = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.5, transparent: true })); m.visible = false; m.life = 0; m.vel = new THREE.Vector3(); m.spin = new THREE.Vector3(); scene.add(m); this.chunks.push(m); }
    this.configure(q);
  }
  /** Ajusta los pools a la calidad actual. */
  configure(q = {}) {
    this.limit = Math.min(this.cap, q.particles || 3000); this.head = 0;
    this.nTracers = Math.min(this.tracers.length, q.tracers || 40); this.nChunks = Math.min(this.chunks.length, q.shards || 18);
    for (const m of this.tracers) m.visible = false; for (const m of this.chunks) m.visible = false;
    this.life.fill(0);
  }
  /** Muerte de una criatura: trozos sólidos que giran y caen + fluido luminoso (ícor), sin gore. */
  shatter(p, color, { size = 0.5, n = 8, speed = 9 } = {}) {
    const c = new THREE.Color(color);
    for (let i = 0; i < Math.min(n, this.nChunks); i++) {
      const m = this.chunks[this.ci]; this.ci = (this.ci + 1) % this.nChunks;
      m.position.copy(p); m.scale.setScalar(size * (0.4 + Math.random() * 0.8)); m.material.color.copy(c); m.material.emissive.copy(c); m.material.opacity = 1;
      m.vel.set(0, 0, 0).add(new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.4 + Math.random()))); m.spin.randomDirection().multiplyScalar(6); m.life = 1.4; m.visible = true;
    }
    this.burst(p, color, Math.round(n * 3), speed * 0.8, 1.1, size * 1.4);
  }
  burst(p, color, n, speed, life, size) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const k = this.head; this.head = (this.head + 1) % this.limit; this.n = Math.min(this.limit, this.n + 1);
      const d = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
      this.pos.set([p.x, p.y, p.z], k * 3); this.vel.set([d.x, d.y, d.z], k * 3);
      this.col.set([c.r, c.g, c.b], k * 3); this.life[k] = this.max[k] = life * (0.5 + Math.random() * 0.5); this.base[k] = size * (0.6 + Math.random() * 0.8);
    }
  }
  tracer(a, b, color) {
    const m = this.tracers[this.ti]; this.ti = (this.ti + 1) % this.nTracers;
    m.position.copy(a); m.lookAt(b); m.scale.set(1, 1, a.distanceTo(b)); m.material.color.set(color); m.life = 0.12; m.visible = true;
  }
  blast(p, color, radius, life) {
    const m = this.blasts[this.bi]; this.bi = (this.bi + 1) % this.blasts.length;
    m.position.copy(p); m.material.color.set(color); m.userData = { r: radius, max: life }; m.life = life; m.visible = true;
  }
  update(dt) {
    for (let k = 0; k < this.cap; k++) {
      if (this.life[k] <= 0) { this.alpha[k] = 0; this.size[k] = 0; continue; }
      this.life[k] -= dt; const t = Math.max(0, this.life[k] / this.max[k]);
      this.pos[k * 3] += this.vel[k * 3] * dt; this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      const damp = 1 - Math.min(1, 2.2 * dt); this.vel[k * 3] *= damp; this.vel[k * 3 + 1] *= damp; this.vel[k * 3 + 2] *= damp;
      this.alpha[k] = t; this.size[k] = this.base[k] * (0.4 + t);
    }
    this.geo.attributes.position.needsUpdate = this.geo.attributes.alpha.needsUpdate = this.geo.attributes.size.needsUpdate = this.geo.attributes.color.needsUpdate = true;
    for (const m of this.chunks) if (m.visible) { m.life -= dt; m.vel.multiplyScalar(1 - 0.8 * dt); m.vel.y -= 9 * dt; m.position.addScaledVector(m.vel, dt); m.rotation.x += m.spin.x * dt; m.rotation.y += m.spin.y * dt; m.material.opacity = Math.min(1, m.life * 1.5); if (m.life <= 0) m.visible = false; }
    for (const m of this.tracers) if (m.visible) { m.life -= dt; m.material.opacity = Math.max(0, m.life / 0.12); if (m.life <= 0) m.visible = false; }
    for (const m of this.blasts) if (m.visible) {
      m.life -= dt; const t = 1 - m.life / m.userData.max; m.scale.setScalar(Math.max(0.01, m.userData.r * (0.2 + t * 0.8))); m.material.opacity = Math.max(0, 0.5 * (1 - t));
      if (m.life <= 0) m.visible = false;
    }
  }
}
