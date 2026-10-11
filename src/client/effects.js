import * as THREE from 'three';

/** Partículas aditivas (Points), trazadores de disparo y ondas expansivas, todo en pools fijos. */
export class Effects {
  constructor(scene, cap = 3000) {
    this.cap = cap; this.n = 0; this.head = 0;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.base = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * 260.0 / max(-mv.z, 1.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vC, a * vA); }`,
    });
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
  }
  burst(p, color, n, speed, life, size) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const k = this.head; this.head = (this.head + 1) % this.cap; this.n = Math.min(this.cap, this.n + 1);
      const d = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
      this.pos.set([p.x, p.y, p.z], k * 3); this.vel.set([d.x, d.y, d.z], k * 3);
      this.col.set([c.r, c.g, c.b], k * 3); this.life[k] = this.max[k] = life * (0.5 + Math.random() * 0.5); this.base[k] = size * (0.6 + Math.random() * 0.8);
    }
  }
  tracer(a, b, color) {
    const m = this.tracers[this.ti]; this.ti = (this.ti + 1) % this.tracers.length;
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
    for (const m of this.tracers) if (m.visible) { m.life -= dt; m.material.opacity = Math.max(0, m.life / 0.12); if (m.life <= 0) m.visible = false; }
    for (const m of this.blasts) if (m.visible) {
      m.life -= dt; const t = 1 - m.life / m.userData.max; m.scale.setScalar(Math.max(0.01, m.userData.r * (0.2 + t * 0.8))); m.material.opacity = Math.max(0, 0.5 * (1 - t));
      if (m.life <= 0) m.visible = false;
    }
  }
}
