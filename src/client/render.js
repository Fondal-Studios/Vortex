import * as THREE from 'three';
import { MAPS } from '../sim/maps.js';
import { skyMaterial, crystalMaterial, groundMaterial, shellMaterial, zoneMaterial, uTime } from './shaders.js';
import { buildMonster, COLORS } from './models.js';
import { Effects } from './effects.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const WEAPON_COLORS = [0x66ffee, 0xff9bd8, 0xffe066, 0xff7a45, 0xb9a4ff];
const PLAYER_COLORS = [0x66ffee, 0xff66c4, 0xffd23f, 0x9dff5a];

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Renderer {
  constructor(canvas, { pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5) } = {}) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.gl.setPixelRatio(pixelRatio);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(82, 1, 0.1, 2000);
    this.scene.add(this.camera);
    this.halo = haloTexture();
    this.cache = new Map(); // geometrías/materiales compartidos de proyectiles y pickups (evita fugas de GPU)
    this.fx = new Effects(this.scene);
    this.mapRoot = new THREE.Group(); this.scene.add(this.mapRoot);
    this.ents = { mon: new Map(), proj: new Map(), pick: new Map(), ply: new Map() };
    this.entRoot = new THREE.Group(); this.scene.add(this.entRoot);
    this.dyn = []; // objetos del mapa con animación
    this.shake = 0; this.camQ = new THREE.Quaternion(); this.camInit = false;
    this.mapId = null; this.t = 0;
    this.buildViewmodel();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  shared(key, make) { let v = this.cache.get(key); if (!v) { v = make(); this.cache.set(key, v); } return v; }
  halo_(color) { return this.shared('halo' + color, () => new THREE.SpriteMaterial({ map: this.halo, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); }
  resize() {
    const w = this.gl.domElement.clientWidth || window.innerWidth, h = this.gl.domElement.clientHeight || window.innerHeight;
    this.gl.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  /* ───────── mapas ───────── */
  setMap(mapId) {
    if (this.mapId === mapId) return;
    this.mapId = mapId;
    for (const c of [...this.mapRoot.children]) { this.mapRoot.remove(c); c.traverse((o) => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose && o.material.dispose(); }); }
    for (const m of Object.values(this.ents)) { for (const o of m.values()) this.entRoot.remove(o.object || o); m.clear(); }
    this.dyn = [];
    (mapId === 'm1' ? this.buildMap1 : this.buildMap2).call(this, MAPS[mapId]);
  }

  buildMap1(map) {
    const root = this.mapRoot;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), skyMaterial({ hue: 0.0, speed: 0.04 })); sky.renderOrder = -10; root.add(sky); this.sky = sky;
    // islas: disco con relieve + cono inferior (o superior si cuelga)
    map.islands.forEach((is, k) => {
      const mat = groundMaterial(k * 0.17, new THREE.Vector3(is.x, 0, is.z));
      const th = is.top - is.y0, body = new THREE.Mesh(new THREE.CylinderGeometry(is.r, is.r * 0.97, th, 40, 1), mat);
      body.position.set(is.x, (is.top + is.y0) / 2, is.z); root.add(body);
      const depth = is.r * 1.3, cone = new THREE.Mesh(new THREE.ConeGeometry(is.r * 0.97, depth, 7, 1), mat);
      if (is.hang) { cone.position.set(is.x, is.top + depth / 2, is.z); } else { cone.rotation.x = Math.PI; cone.position.set(is.x, is.y0 - depth / 2, is.z); }
      root.add(cone);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(is.r, 0.18, 6, 64), zoneMaterial(new THREE.Color().setHSL((k * 0.17) % 1, 1, 0.6), 0));
      rim.rotation.x = Math.PI / 2; rim.position.set(is.x, is.hang ? is.y0 : is.top, is.z); root.add(rim);
    });
    // planetoide
    for (const s of map.solids) if (s.type === 'sph') {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s.r, 2), groundMaterial(0.55, s.c)); m.position.set(s.c.x, s.c.y, s.c.z); root.add(m);
      this.dyn.push((dt) => { m.rotation.y += dt * 0.05; });
    }
    // zonas
    for (const z of map.zones) {
      let m;
      if (z.kind === 'flip') { const h = z.y1 - z.y0; m = new THREE.Mesh(new THREE.CylinderGeometry(z.r, z.r, h, 24, 1, true), zoneMaterial(0x66ffcc, 1)); m.position.set(z.c.x, z.y0 + h / 2, z.c.z); }
      else { m = new THREE.Mesh(new THREE.SphereGeometry(z.r, 28, 18), zoneMaterial(z.kind === 'zero' ? 0xc7a0ff : z.kind === 'well' ? 0x6aa0ff : 0xffb347, 2)); m.position.set(z.c.x, z.c.y, z.c.z); }
      root.add(m);
    }
    // portales
    for (const po of map.portals) for (const end of [po.a, po.b]) {
      const col = new THREE.Color().setHSL(po.hue, 1, 0.6), g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(po.r * 0.85, 0.16, 8, 32), zoneMaterial(col, 0)), disc = new THREE.Mesh(new THREE.CircleGeometry(po.r * 0.8, 24), zoneMaterial(col, 2));
      g.add(ring, disc); g.position.set(end.x, end.y + 1, end.z); g.rotation.y = Math.atan2(end.x, end.z); root.add(g);
      this.dyn.push((dt, t) => { ring.rotation.z = t * 1.5; disc.rotation.z = -t * 2; });
    }
    // escalas imposibles: formas gigantes, simples, lejanas
    const far = [[0x7d5cff, 'ring'], [0xff5ca8, 'ico'], [0x35e0c2, 'oct'], [0xffc14d, 'ring'], [0x5cb8ff, 'ico']];
    far.forEach(([c, kind], i) => {
      const a = i * 1.26 + 0.4, d = 720 + (i % 2) * 120, m = crystalMaterial(c, { alpha: 0.9 });
      const geo = kind === 'ring' ? new THREE.TorusGeometry(190, 12, 8, 40) : kind === 'ico' ? new THREE.IcosahedronGeometry(130, 0) : new THREE.OctahedronGeometry(150, 0);
      const o = new THREE.Mesh(geo, m); o.position.set(Math.cos(a) * d, (i - 2) * 90 + 60, Math.sin(a) * d); root.add(o);
      this.dyn.push((dt) => { o.rotation.x += dt * 0.04 * (i + 1); o.rotation.y += dt * 0.03; });
    });
    for (let i = 0; i < 40; i++) { // rocas cristalinas flotantes (decoración)
      const a = i * 2.399, d = 90 + (i % 7) * 22, o = new THREE.Mesh(new THREE.OctahedronGeometry(1.5 + (i % 5), 0), crystalMaterial(new THREE.Color().setHSL((i * 0.07) % 1, 0.8, 0.6)));
      o.position.set(Math.cos(a) * d, ((i * 37) % 120) - 60, Math.sin(a) * d); o.scale.y = 1.6; root.add(o);
      this.dyn.push((dt, t) => { o.rotation.y += dt * 0.3; o.position.y += Math.sin(t + i) * dt * 0.8; });
    }
  }

  buildMap2(map) {
    const root = this.mapRoot;
    this.shellMat = shellMaterial(0.35);
    root.add(new THREE.Mesh(new THREE.SphereGeometry(map.R, 64, 40), this.shellMat));
    for (const s of map.solids) if (s.type === 'sph') {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s.r, 1), crystalMaterial(new THREE.Color().setHSL((s.c.x * 0.013 + 0.8) % 1, 0.7, 0.55), { glow: 0.12 }));
      m.position.set(s.c.x, s.c.y, s.c.z); root.add(m);
    }
    // espigas de cristal clavadas en el cascarón, apuntando hacia adentro
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 90; i++) {
      const z = 1 - (i + 0.5) / 45, rad = Math.sqrt(Math.max(0, 1 - z * z)), th = i * 2.399963;
      const n = new THREE.Vector3(Math.cos(th) * rad, z, Math.sin(th) * rad);
      if (map.solids.some((s) => s.type === 'sph' && n.clone().multiplyScalar(map.R).distanceTo(new THREE.Vector3(s.c.x, s.c.y, s.c.z)) < s.r + 3)) continue;
      const h = 3 + (i % 5) * 1.6, spike = new THREE.Mesh(new THREE.ConeGeometry(1.1 + (i % 3) * 0.5, h, 5), crystalMaterial(new THREE.Color().setHSL(((i * 0.031) + 0.55) % 1, 0.85, 0.6), { glow: 0.1 }));
      spike.quaternion.setFromUnitVectors(up, n.clone().negate()); spike.position.copy(n.clone().multiplyScalar(map.R - h / 2 + 0.3));
      root.add(spike);
    }
    // polvo cósmico flotando en el volumen
    const N = 400, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(map.R * 0.9 * Math.cbrt(Math.random())); pos.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.5, color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); root.add(dust);
    this.dyn.push((dt) => { dust.rotation.y += dt * 0.02; });
    this.sky = null;
  }

  /* ───────── viewmodel ───────── */
  buildViewmodel() {
    this.vm = new THREE.Group(); this.camera.add(this.vm);
    this.vmMats = WEAPON_COLORS.map((c) => crystalMaterial(c, { glow: 0.1 }));
    this.vmMeshes = [];
    const mk = (i) => {
      const g = new THREE.Group(), m = this.vmMats[i];
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), m); body.scale.set(0.09, 0.09, 0.4); g.add(body);
      const bar = new THREE.Mesh(new THREE.ConeGeometry(1, 2, 6), m); bar.rotation.x = -Math.PI / 2; bar.scale.set(0.045, 0.3, 0.045); bar.position.z = -0.45; g.add(bar);
      if (i === 1) { bar.scale.x = 0.08; bar.scale.z = 0.08; }
      if (i === 3) { bar.scale.set(0.09, 0.4, 0.09); }
      if (i === 4) { bar.scale.set(0.025, 0.6, 0.025); bar.position.z = -0.7; }
      if (i === 2) { const b2 = bar.clone(); b2.position.x = 0.07; g.add(b2); }
      g.scale.setScalar(0.55); g.position.set(0.26, -0.24, -0.6); g.visible = false; this.vm.add(g); return g;
    };
    for (let i = 0; i < WEAPON_COLORS.length; i++) this.vmMeshes.push(mk(i));
    this.kick = 0; this.curW = -1;
  }

  /* ───────── cuadro ───────── */
  render(state, dt, myId, look) {
    this.t += dt; uTime.value = this.t;
    this.setMap(state.map);
    const me = state.players.find((p) => p.id === myId) || state.players[0];
    for (const f of this.dyn) f(dt, this.t);
    if (this.shellMat) this.shellMat.uniforms.uWarn.value = state.fx && state.fx.warn ? 1 : 0;
    this.syncMonsters(state, dt);
    this.syncProjectiles(state, dt);
    this.syncPickups(state);
    this.syncPlayers(state, myId);
    this.handleEvents(state, me);
    this.fx.update(dt);
    if (me) this.updateCamera(me, dt, look);
    this.gl.render(this.scene, this.camera);
  }

  updateCamera(me, dt, look) {
    const up = V(me.up), h = look ? V(look.h) : V(me.h), pitch = look ? look.pitch : me.pitch;
    const aim = h.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
    const right = new THREE.Vector3().crossVectors(h, up).normalize();
    const camUp = new THREE.Vector3().crossVectors(right, aim).normalize();
    const m = new THREE.Matrix4().makeBasis(right, camUp, aim.clone().negate());
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    if (!this.camInit) { this.camQ.copy(q); this.camInit = true; } else this.camQ.slerp(q, 1 - Math.exp(-14 * dt));
    this.camera.quaternion.copy(this.camQ);
    const eye = V(me.pos).addScaledVector(up, 0.6);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    if (this.shake > 0) eye.add(new THREE.Vector3().randomDirection().multiplyScalar(this.shake * 0.25));
    this.camera.position.copy(eye);
    this.eye = eye; this.aim = aim;
    // viewmodel
    if (this.curW !== me.w) { this.vmMeshes.forEach((g, i) => { g.visible = i === me.w && !me.dead; }); this.curW = me.w; }
    this.kick = Math.max(0, this.kick - dt * 6);
    const g = this.vmMeshes[me.w]; if (g) { g.position.z = -0.6 + this.kick * 0.1; g.rotation.x = this.kick * 0.15 + Math.sin(this.t * 1.7) * 0.004; g.visible = !me.dead; }
  }

  /* ───────── sincronización de entidades ───────── */
  orient(obj, u, f) {
    const up = V(u), fw = V(f);
    const right = new THREE.Vector3().crossVectors(up, fw);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize(); const fwd = new THREE.Vector3().crossVectors(right, up).normalize();
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd));
  }

  syncMonsters(state, dt) {
    const seen = new Set();
    for (const m of state.monsters) {
      seen.add(m.id);
      let e = this.ents.mon.get(m.id);
      if (!e) {
        e = buildMonster(m.k); e.kind = m.k; e.born = this.t; e.object.userData.s = new THREE.Vector3();
        this.entRoot.add(e.object); this.ents.mon.set(m.id, e);
        e.object.position.set(...m.p);
      }
      const o = e.object, scale = m.r * (m.k === 'coloso' || m.k === 'madre' ? 0.8 : 1) * Math.min(1, 0.2 + (this.t - e.born) * 3);
      o.position.lerp(V(m.p), 0.6); o.scale.setScalar(scale);
      this.orient(o, m.u, m.f);
      for (const mat of e.mats) if (mat.uniforms.uHurt) mat.uniforms.uHurt.value = m.h ? 0.7 : 0;
      e.tick(dt, { id: m.id, s: m.s, o: m.o, c: m.c }, this.t);
    }
    for (const [id, e] of this.ents.mon) if (!seen.has(id)) { this.entRoot.remove(e.object); e.mats.forEach((m) => m.dispose()); this.ents.mon.delete(id); }
  }

  syncProjectiles(state) {
    const seen = new Set();
    for (const p of state.projectiles) {
      seen.add(p.id);
      let e = this.ents.proj.get(p.id);
      if (!e) {
        const col = p.k === 'nova' ? 0xff9a3c : p.k === 'orb' ? 0xff4fd8 : p.k === 'beam' ? 0x66f0ff : 0xffe066;
        const g = new THREE.Group(), key = `${p.k}${p.r}`;
        const geo = this.shared('pg' + key, () => { const q = p.k === 'beam' ? new THREE.CylinderGeometry(0.1, 0.1, 2.6, 5) : new THREE.OctahedronGeometry(p.r * 1.1, 0); if (p.k === 'beam') q.rotateX(Math.PI / 2); return q; });
        g.add(new THREE.Mesh(geo, this.shared('pm' + col, () => new THREE.MeshBasicMaterial({ color: col }))));
        const sp = new THREE.Sprite(this.halo_(col)); sp.scale.setScalar(p.r * 5); g.add(sp);
        e = g; e.userData.col = col; e.position.set(...p.p); this.entRoot.add(g); this.ents.proj.set(p.id, g);
      }
      e.position.set(...p.p);
      if (p.k === 'beam') e.lookAt(e.position.clone().add(V(p.v))); else e.rotation.y += 0.2;
      if (p.k === 'nova' && Math.random() < 0.8) this.fx.burst(e.position, 0xffa040, 1, 2, 0.4, 0.5);
    }
    for (const [id, g] of this.ents.proj) if (!seen.has(id)) { this.entRoot.remove(g); this.ents.proj.delete(id); }
  }

  syncPickups(state) {
    const seen = new Set();
    for (const k of state.pickups) {
      seen.add(k.id);
      let e = this.ents.pick.get(k.id);
      if (!e) {
        const hp = k.t === 'hp', col = hp ? 0x7dffa0 : WEAPON_COLORS[k.w] || 0xffcc44;
        const g = new THREE.Group(), mat = this.shared('pk' + col, () => crystalMaterial(col, { glow: 0.5 }));
        if (hp) { g.add(new THREE.Mesh(this.shared('pkb1', () => new THREE.BoxGeometry(0.9, 0.3, 0.3)), mat)); g.add(new THREE.Mesh(this.shared('pkb2', () => new THREE.BoxGeometry(0.3, 0.9, 0.3)), mat)); }
        else g.add(new THREE.Mesh(this.shared('pko', () => new THREE.OctahedronGeometry(0.6, 0)), mat));
        const sp = new THREE.Sprite(this.halo_(col)); sp.scale.setScalar(3); g.add(sp);
        e = g; this.entRoot.add(g); this.ents.pick.set(k.id, g);
      }
      e.position.set(k.p[0], k.p[1], k.p[2]); e.rotation.y = this.t * 2;
    }
    for (const [id, g] of this.ents.pick) if (!seen.has(id)) { this.entRoot.remove(g); this.ents.pick.delete(id); }
  }

  syncPlayers(state, myId) {
    const seen = new Set();
    for (const p of state.players) {
      if (p.id === myId) continue;
      seen.add(p.id);
      let e = this.ents.ply.get(p.id);
      if (!e) {
        const col = PLAYER_COLORS[(p.id - 1) % 4], g = new THREE.Group(), m = this.shared('pl' + col, () => crystalMaterial(col, { glow: 0.2 }));
        const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), m); body.scale.y = 1.4; g.add(body);
        const gun = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.2, 5), m); gun.rotation.x = Math.PI / 2; gun.position.set(0.5, 0, 0.7); g.add(gun);
        e = { object: g }; this.entRoot.add(g); this.ents.ply.set(p.id, e);
      }
      e.object.position.set(...p.pos); this.orient(e.object, p.up, p.h); e.object.visible = !p.dead;
    }
    for (const [id, e] of this.ents.ply) if (!seen.has(id)) { this.entRoot.remove(e.object); this.ents.ply.delete(id); }
  }

  /* ───────── eventos → efectos ───────── */
  handleEvents(state, me) {
    const near = (p) => me ? V(p).distanceTo(V(me.pos)) : 99;
    for (const e of state.events) {
      switch (e.t) {
        case 'shot': {
          const o = V(e.o), col = WEAPON_COLORS[e.w] || 0xffffff;
          if (e.pid === (me && me.id)) { this.kick = 1; }
          if (e.to) for (const t of e.to) this.fx.tracer(e.pid === (me && me.id) && this.aim ? this.camera.localToWorld(new THREE.Vector3(0.3, -0.25, -1.2)) : o, V(t), col);
          break;
        }
        case 'hit': this.fx.burst(V(e.p), e.arm ? 0x9999ff : 0xffffff, e.arm ? 3 : 6, 7, 0.4, 0.6); break;
        case 'kill': { const c = COLORS[e.k] || 0xffffff; this.fx.burst(V(e.p), c, e.k === 'coloso' || e.k === 'madre' ? 400 : 40, 14, 1.0, 1.0); if (e.k === 'coloso' || e.k === 'madre') { this.shake = 2; this.fx.blast(V(e.p), c, 40, 1.6); } break; }
        case 'boom': this.fx.blast(V(e.p), 0xffa24a, e.r, 0.6); this.fx.burst(V(e.p), 0xffd080, 30, e.r * 2.5, 0.8, 1); this.shake = Math.max(this.shake, Math.min(1, 12 / (near(e.p) + 4))); break;
        case 'splat': this.fx.burst(V(e.p), 0xff9ae8, 8, 6, 0.4, 0.6); break;
        case 'portal': this.fx.blast(V(e.p), 0x66ffff, 4, 0.5); break;
        case 'blink': this.fx.burst(V(e.p), 0xcfe9ff, 25, 9, 0.5, 0.8); break;
        case 'summon': this.fx.blast(V(e.p), 0xff7a45, 6, 0.7); break;
        case 'gravity': this.fx.blast(V(e.p), 0x6a7bff, 60, 1.0); break;
        case 'phase': this.shake = 1.5; break;
        case 'bite': break;
        case 'pickup': if (me && e.pid === me.id) this.fx.blast(V(me.pos), 0x9dff5a, 3, 0.4); break;
      }
    }
  }
}
