import * as THREE from 'three';
import { MAPS } from '../sim/maps.js';
import { skyMaterial, crystalMaterial, groundMaterial, shellMaterial, zoneMaterial, uTime, OUT } from './shaders.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMonster, COLORS } from './models.js';
import { Effects } from './effects.js';
import { Viewmodels, WEAPON_COLORS as WC } from './weapons-vm.js';
import { kit } from './organism.js';
import heraldo from './creatures/heraldo.js';
import { cfg, LEVELS, setCurrent } from './quality.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const MONSTER_SIZE = { astilla: 0.35, racimo: 0.35, geoda: 0.9, ariete: 0.8, obelisco: 0.6, cuarzo: 0.55 };
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
  constructor(canvas, { level = 'high', pixelRatio = null } = {}) {
    setCurrent(level); OUT.linear = !!cfg().post;
    this.canvas = canvas; this.level = level; this.prOverride = pixelRatio;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.gl.setPixelRatio(this.pixelRatioFor(level));
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; const m = this.mapId; this.mapId = null; this.setMap(m); });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(82, 1, 0.1, 2000);
    this.scene.add(this.camera);
    this.halo = haloTexture();
    this.cache = new Map(); // geometrías/materiales compartidos de proyectiles y pickups (evita fugas de GPU)
    this.fx = new Effects(this.scene, cfg().particles, cfg());
    this.tmpV = new THREE.Vector3();
    this.mapRoot = new THREE.Group(); this.scene.add(this.mapRoot);
    this.ents = { mon: new Map(), proj: new Map(), pick: new Map(), ply: new Map() };
    this.entRoot = new THREE.Group(); this.scene.add(this.entRoot);
    this.dyn = []; // objetos del mapa con animación
    this.shake = 0; this.camQ = new THREE.Quaternion(); this.camInit = false;
    this.mapId = null; this.t = 0;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping; this.gl.toneMappingExposure = cfg().post ? 1.9 : 1.05;
    this.hemi = new THREE.HemisphereLight(0xb9c4ff, 0x2a0f3a, 1.1); this.sun = new THREE.DirectionalLight(0xfff1e0, 2.2); this.sun.position.set(0.4, 1, 0.3);
    this.rim = new THREE.DirectionalLight(0xff66c4, 1.0); this.rim.position.set(-0.6, 0.2, -0.8);
    this.muzzle = new THREE.PointLight(0xffd9a0, 0, 28, 1.6); this.camera.add(this.muzzle); this.muzzle.position.set(0.3, -0.2, -1);
    this.scene.add(this.hemi, this.sun, this.rim);
    this.vm = new Viewmodels(this.camera, this.halo);
    this.dying = [];
    this.setupPost();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  shared(key, make) { let v = this.cache.get(key); if (!v) { v = make(); this.cache.set(key, v); } return v; }
  halo_(color) { return this.shared('halo' + color, () => new THREE.SpriteMaterial({ map: this.halo, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); }
  pixelRatioFor(level) {
    if (this.prOverride) return this.prOverride;
    const L = LEVELS[level], dpr = window.devicePixelRatio || 1;
    return Math.max(0.5, Math.min(L.maxPR, dpr * L.pixelRatio));
  }
  /** Cambia la calidad en caliente: resolución, partículas, aristas, decorado y shaders del cielo. */
  applyQuality(level) {
    if (!LEVELS[level]) return;
    this.level = level; setCurrent(level); OUT.linear = !!cfg().post; this.gl.toneMappingExposure = cfg().post ? 1.9 : 1.05; this.setupPost();
    this.gl.setPixelRatio(this.pixelRatioFor(level)); this.resize();
    this.fx.configure(cfg());
    for (const m of Object.values(this.ents)) { for (const o of m.values()) this.entRoot.remove(o.object || o); m.clear(); }
    const id = this.mapId; this.mapId = null; if (id) this.setMap(id);
  }
  /** Bloom + tonemapping ACES (Media/Alta) y reflejos PBR por entorno. En Baja: render directo. */
  setupPost() {
    const q = cfg();
    if (this.composer) { this.composer.dispose(); this.composer = null; }
    if (q.post) {
      const c = new EffectComposer(this.gl); c.setPixelRatio(this.gl.getPixelRatio());
      c.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), q.bloom || 0.5, 0.7, 0.8); c.addPass(this.bloom); c.addPass(new OutputPass());
      this.composer = c;
    }
    if (q.env && !this.envTex) { const pm = new THREE.PMREMGenerator(this.gl); this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }
    this.scene.environment = q.env ? this.envTex : null; this.scene.environmentIntensity = 0.55;
    this.rim.visible = q.lights >= 3; this.muzzle.visible = q.lights >= 4;
  }
  resize() {
    const w = this.gl.domElement.clientWidth || window.innerWidth, h = this.gl.domElement.clientHeight || window.innerHeight;
    this.gl.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.gl.getPixelRatio()); this.composer.setSize(w, h); }
  }

  /* ───────── mapas ───────── */
  setMap(mapId) {
    if (this.mapId === mapId) return;
    this.mapId = mapId;
    for (const c of [...this.mapRoot.children]) { this.mapRoot.remove(c); c.traverse((o) => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose && o.material.dispose(); }); }
    for (const m of Object.values(this.ents)) { for (const o of m.values()) this.entRoot.remove(o.object || o); m.clear(); }
    this.dyn = [];
    const warm = mapId === 'm2';
    this.hemi.color.setHex(warm ? 0xffb0d8 : 0xaab8ff); this.hemi.groundColor.setHex(warm ? 0x3a0a2a : 0x1a0f3a); this.sun.color.setHex(warm ? 0xffd2c0 : 0xe8f0ff); this.rim.color.setHex(warm ? 0x66ffd8 : 0xff66c4);
    (mapId === 'm1' ? this.buildMap1 : this.buildMap2).call(this, MAPS[mapId]);
  }

  buildMap1(map) {
    const root = this.mapRoot;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), skyMaterial({ hue: 0.0, speed: 0.04, iters: cfg().skyIters })); sky.renderOrder = -10; root.add(sky); this.sky = sky;
    // islas: disco con relieve + cono inferior (o superior si cuelga)
    const rock = (r, th, hang, seed) => { // cilindro + cono de roca con ruido (relieve de acantilado y estalactitas)
      const g = new THREE.CylinderGeometry(r, r * 0.9, th, cfg().decor ? 48 : 24, cfg().decor ? 5 : 2, true); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = Math.sin(x * 0.9 + seed) * Math.cos(z * 0.8 - seed) * 0.5 + Math.sin(y * 1.7 + x * 0.3) * 0.25; const k = 1 + n * 0.07 * (1 - Math.abs(y) / (th / 2 + 0.01) * 0.2); p.setX(i, x * k); p.setZ(i, z * k); p.setY(i, y + n * 0.12); }
      g.computeVertexNormals(); return g;
    };
    const spire = (r, depth, seed) => { // cono de roca irregular (isla colgante)
      const g = new THREE.ConeGeometry(r * 0.92, depth, cfg().decor ? 14 : 7, cfg().decor ? 6 : 2, true); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = Math.sin(x * 1.3 + seed + y * 0.5) * Math.cos(z * 1.1 - seed) * 0.5 + 0.0; const k = 1 + n * 0.22; p.setX(i, x * k); p.setZ(i, z * k); p.setY(i, y + n * 0.8); }
      g.computeVertexNormals(); return g;
    };
    const crystalMat = (k) => this.shared('isl' + k, () => crystalMaterial(new THREE.Color().setHSL((k * 0.17 + 0.5) % 1, 0.85, 0.6), { glow: 0.5 }));
    map.islands.forEach((is, k) => {
      const mat = groundMaterial(k * 0.17, new THREE.Vector3(is.x, 0, is.z));
      const th = is.top - is.y0, body = new THREE.Mesh(rock(is.r, th, is.hang, k * 3.1), mat);
      body.position.set(is.x, (is.top + is.y0) / 2, is.z); root.add(body);
      const cap = new THREE.Mesh(new THREE.CircleGeometry(is.r, cfg().decor ? 48 : 24), mat); cap.rotation.x = is.hang ? Math.PI / 2 : -Math.PI / 2; cap.position.set(is.x, is.hang ? is.y0 + 0.01 : is.top, is.z); root.add(cap);
      const depth = is.r * 1.5, cone = new THREE.Mesh(spire(is.r, depth, k * 1.7), mat);
      if (is.hang) { cone.position.set(is.x, is.top + depth / 2, is.z); } else { cone.rotation.x = Math.PI; cone.position.set(is.x, is.y0 - depth / 2, is.z); }
      root.add(cone);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(is.r, 0.18, 6, 64), zoneMaterial(new THREE.Color().setHSL((k * 0.17) % 1, 1, 0.6), 0));
      rim.rotation.x = Math.PI / 2; rim.position.set(is.x, is.hang ? is.y0 : is.top, is.z); root.add(rim);
      if (cfg().decor) { // racimos de cristal y hongos bioluminiscentes en el borde de la isla
        const geoC = this.shared('cg', () => { const c = new THREE.ConeGeometry(1, 2, 6); c.translate(0, 1, 0); return c; }), geoM = this.shared('mg', () => new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2));
        const mushM = this.shared('mush' + k, () => new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((k * 0.17 + 0.1) % 1, 1, 0.65) }));
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + k, rr = is.r * (0.78 + 0.18 * Math.sin(i * 3.7 + k)), sgn = is.hang ? -1 : 1, y0 = is.hang ? is.y0 : is.top;
          const px = is.x + Math.cos(a) * rr, pz = is.z + Math.sin(a) * rr;
          const cl = new THREE.Group(); for (let j = 0; j < 3; j++) { const c = new THREE.Mesh(geoC, crystalMat(k)); const h = 1.2 + ((i * 7 + j * 3) % 5) * 0.45; c.scale.set(0.28, h, 0.28); c.rotation.set(Math.sin(j * 2 + i) * 0.35, 0, Math.cos(j * 2 + i) * 0.35); c.position.set(Math.cos(j * 2.1) * 0.35, 0, Math.sin(j * 2.1) * 0.35); cl.add(c); }
          cl.position.set(px, y0, pz); cl.scale.y = sgn; root.add(cl);
          const m = new THREE.Mesh(geoM, mushM); m.scale.set(0.5, 0.4, 0.5); m.position.set(is.x + Math.cos(a + 0.35) * rr * 0.97, y0, is.z + Math.sin(a + 0.35) * rr * 0.97); m.scale.y *= sgn; root.add(m);
        }
      }
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
    { // sol lejano: fuente de brillo para el bloom
      const sun = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff0d0 })); sun.position.set(380, 300, -700); root.add(sun);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.halo, color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); halo.scale.setScalar(520); halo.position.copy(sun.position); root.add(halo);
      this.sun.position.copy(sun.position).normalize();
    }
    this.addMotes(root, 220, 38);
    if (!cfg().decor) return;
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

  /** Polvo cósmico que flota alrededor de la cámara (sensación de volumen y de gravedad cambiante). */
  addMotes(root, n, radius) {
    const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(radius * Math.cbrt(Math.random())); pos.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.18, color: 0xc8d8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); m.frustumCulled = false; root.add(m);
    this.dyn.push((dt, t) => { m.position.copy(this.camera.position); m.rotation.y = t * 0.02; m.rotation.x = Math.sin(t * 0.1) * 0.1; });
  }

  buildMap2(map) {
    const root = this.mapRoot;
    this.shellMat = shellMaterial(0.35, cfg().shellIters);
    root.add(new THREE.Mesh(new THREE.SphereGeometry(map.R, 64, 40), this.shellMat));
    for (const s of map.solids) if (s.type === 'sph') {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s.r, 1), crystalMaterial(new THREE.Color().setHSL((s.c.x * 0.013 + 0.8) % 1, 0.7, 0.55), { glow: 0.12 }));
      m.position.set(s.c.x, s.c.y, s.c.z); root.add(m);
    }
    // espigas de cristal clavadas en el cascarón, apuntando hacia adentro
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < (cfg().decor ? 90 : 40); i++) {
      const z = 1 - (i + 0.5) / (cfg().decor ? 45 : 20), rad = Math.sqrt(Math.max(0, 1 - z * z)), th = i * 2.399963;
      const n = new THREE.Vector3(Math.cos(th) * rad, z, Math.sin(th) * rad);
      if (map.solids.some((s) => s.type === 'sph' && n.clone().multiplyScalar(map.R).distanceTo(new THREE.Vector3(s.c.x, s.c.y, s.c.z)) < s.r + 3)) continue;
      const h = 3 + (i % 5) * 1.6, spike = new THREE.Mesh(new THREE.ConeGeometry(1.1 + (i % 3) * 0.5, h, 5), crystalMaterial(new THREE.Color().setHSL(((i * 0.031) + 0.55) % 1, 0.85, 0.6), { glow: 0.1 }));
      spike.quaternion.setFromUnitVectors(up, n.clone().negate()); spike.position.copy(n.clone().multiplyScalar(map.R - h / 2 + 0.3));
      root.add(spike);
    }
    // polvo cósmico flotando en el volumen
    const N = cfg().decor ? 400 : 120, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(map.R * 0.9 * Math.cbrt(Math.random())); pos.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.5, color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); root.add(dust);
    this.dyn.push((dt) => { dust.rotation.y += dt * 0.02; });
    this.addMotes(root, 160, 26); this.sun.position.set(0.2, 1, 0.1);
    this.sky = null;
  }

  /* ───────── narrativa: el Heraldo y el despertar ───────── */
  setGuide(on) {
    if (on && !this.guide) { const b = heraldo(kit), g = new THREE.Group(); g.add(b.root); g.scale.setScalar(1.15); g.userData.arrive = 0; this.entRoot.add(g); this.guide = { g, b, talk: 0 }; }
    else if (!on && this.guide) { this.fx.burst(this.guide.g.position, 0xffa6e8, 60, 9, 1.2, 0.9); this.fx.blast(this.guide.g.position, 0x7dfff0, 5, 0.8); this.entRoot.remove(this.guide.g); this.guide.b.mats.forEach((m) => m.dispose()); this.guide = null; }
  }
  setThird(on) { this.third = !!on; this.vm.root.visible = !on; if (on) this.ensureHumans(); }
  startWake(secs = 4) { this.wakeT = 0; this.wakeDur = secs; }
  updateGuide(dt, me) {
    if (!this.guide || !me) return; const G = this.guide; G.g.userData.arrive = Math.min(1, G.g.userData.arrive + dt * 0.5);
    const up = V(me.up), h = V(me.h), right = new THREE.Vector3().crossVectors(h, up).normalize(), a = G.g.userData.arrive;
    const target = V(me.pos).addScaledVector(h, 4.6 + (1 - a) * 6).addScaledVector(up, 1.5 + (1 - a) * 3).addScaledVector(right, 1.3);
    G.g.position.lerp(target, Math.min(1, 3 * dt)); this.orient(G.g, me.up, [me.pos[0] - G.g.position.x, me.pos[1] - G.g.position.y, me.pos[2] - G.g.position.z]);
    G.g.updateMatrixWorld(); this.tmpV.copy(this.camera.position); G.g.worldToLocal(this.tmpV);
    G.b.tick(dt, { id: 1, talk: this.guideTalk || 0 }, this.t, { look: this.tmpV.clone().normalize() });
  }
  label(text, color = '#ffffff') {
    return this.shared('lb' + text + color, () => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.font = '700 30px "Trebuchet MS", system-ui'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = '#000c'; g.strokeText(text, 128, 42); g.fillStyle = color; g.fillText(text, 128, 42);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); sp.scale.set(2.6, 0.65, 1); sp.renderOrder = 10; return sp.material;
    });
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
    this.syncPlayers(state, myId, dt);
    this.handleEvents(state, me);
    this.updateDying(dt); this.updateGuide(dt, me);
    this.fx.update(dt);
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 60);
    if (me) this.updateCamera(me, dt, look);
    if (this.lost) return;
    if (this.composer) this.composer.render(); else this.gl.render(this.scene, this.camera);
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
    if (this.third) { const cpos = V(me.pos).addScaledVector(aim, -5.2).addScaledVector(up, 2.1).addScaledVector(right, 1.0); this.camera.position.copy(cpos); this.camera.up.copy(up); this.camera.lookAt(V(me.pos).addScaledVector(aim, 14).addScaledVector(up, 0.9)); this.eye = cpos; this.aim = aim; this.vm.update(dt, { firing: false, hidden: true }); return; }
    let eyeH = 0.6;
    if (this.wakeT !== undefined && this.wakeT < this.wakeDur) { this.wakeT += dt; const k = Math.min(1, this.wakeT / this.wakeDur), e = 1 - Math.pow(1 - k, 3); this.camera.rotateZ((1 - e) * 1.45); eyeH = 0.6 - 0.45 * (1 - e); }
    const eye = V(me.pos).addScaledVector(up, eyeH);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    if (this.shake > 0) eye.add(new THREE.Vector3().randomDirection().multiplyScalar(this.shake * 0.25));
    this.camera.position.copy(eye);
    this.eye = eye; this.aim = aim;
    this.vm.setWeapon(me.w);
    const lk = look && look.delta ? look.delta : [0, 0];
    this.vm.update(dt, { firing: !!this.firing, hidden: me.dead, look: lk });
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
        e = buildMonster(m.k); e.kind = m.k; e.born = this.t; e.spd = 0; e.object.userData.s = new THREE.Vector3();
        this.entRoot.add(e.object); this.ents.mon.set(m.id, e);
        e.object.position.set(...m.p);
      }
      const o = e.object, scale = m.r * (m.k === 'coloso' || m.k === 'madre' ? 1.15 : 1) * Math.min(1, 0.2 + (this.t - e.born) * 3);
      o.position.lerp(V(m.p), 0.6); o.scale.setScalar(scale);
      this.orient(o, m.u, m.f);
      const hv = m.h ? 0.7 : 0;
      for (const mat of e.mats) { const uh = (mat.userData && mat.userData.u && mat.userData.u.uHurt) || (mat.uniforms && mat.uniforms.uHurt); if (uh) uh.value = hv; }
      this.tmpV.set(this.camera.position.x, this.camera.position.y, this.camera.position.z); o.updateMatrixWorld(); o.worldToLocal(this.tmpV);
      const spd = e.prev ? Math.hypot(m.p[0] - e.prev[0], m.p[1] - e.prev[1], m.p[2] - e.prev[2]) / Math.max(dt, 1e-3) : 0; e.prev = m.p; e.spd += ((spd / Math.max(1, m.r * 6)) - e.spd) * Math.min(1, 6 * dt);
      e.tick(dt, { id: m.id, s: m.s, o: m.o, c: m.c, hp: m.hp / m.mh, sd: m.sd, st: m.st, a: m.a }, this.t, { look: this.tmpV.clone().normalize(), speed: e.spd, dist: this.tmpV.length() });
    }
    for (const [id, e] of this.ents.mon) if (!seen.has(id)) { this.ents.mon.delete(id); e.dyingT = 0; e.dyingMax = e.kind === 'coloso' || e.kind === 'madre' ? 1.8 : 0.5; e.base = e.object.scale.clone(); this.dying.push(e); }
  }
  /** Muerte: la criatura se desploma y se desinfla mientras salen esquirlas (ver evento 'kill'). */
  updateDying(dt) {
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const e = this.dying[i]; e.dyingT += dt; const k = Math.min(1, e.dyingT / e.dyingMax), o = e.object;
      o.scale.set(e.base.x * (1 + 0.35 * k), e.base.y * Math.max(0.05, 1 - 0.95 * k * k), e.base.z * (1 + 0.35 * k));
      for (const mat of e.mats) { const uh = mat.userData && mat.userData.u && mat.userData.u.uHurt; if (uh) uh.value = 1 - k * 0.5; }
      if (k >= 1) { this.entRoot.remove(o); e.mats.forEach((m) => m.dispose()); if (e.halo) e.halo.material.dispose(); this.dying.splice(i, 1); }
    }
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

  /** Carga perezosa del kit de personas (Arcanum NPC Factory). En calidad Baja no se usa: avatares livianos. */
  async ensureHumans() {
    if (this.humansKit || this.humansLoading || cfg().humans === 'low') return;
    this.humansLoading = true;
    try { this.hm = await import('./humans.js'); this.humansKit = await this.hm.loadHumanKit({ quality: cfg().humans }); } catch (err) { console.warn('personas 3D no disponibles:', err.message); }
  }
  simpleAvatar(col) {
    const g = new THREE.Group(), m = crystalMaterial(col, { glow: 0.2 });
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), m); body.scale.y = 1.4; g.add(body);
    const gun = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.2, 5), m); gun.rotation.x = Math.PI / 2; gun.position.set(0.5, 0, 0.7); g.add(gun); return g;
  }
  syncPlayers(state, myId, dt = 0.016) {
    const seen = new Set();
    if (state.players.length > 1) this.ensureHumans();
    for (const p of state.players) {
      const self = p.id === myId; if (self && !this.third) continue;
      seen.add(p.id);
      let e = this.ents.ply.get(p.id);
      const col = PLAYER_COLORS[(p.id - 1) % 4];
      if (!e) { e = { object: new THREE.Group(), human: null, simple: null, prev: p.pos, spd: 0, col, shotT: 0 }; e.simple = this.simpleAvatar(col); e.object.add(e.simple); this.entRoot.add(e.object); this.ents.ply.set(p.id, e); }
      if (!e.human && this.humansKit && this.hm) { try { e.human = this.hm.createHuman(this.humansKit, { preset: self ? 'pasajero' : 'jugador' + (((p.id - 1) % 4) + 1), color: col, name: p.name }); e.object.add(e.human.object); e.object.remove(e.simple); e.simple = null; } catch (err) { console.warn(err.message); } }
      const spd = Math.hypot(p.pos[0] - e.prev[0], p.pos[1] - e.prev[1], p.pos[2] - e.prev[2]) / Math.max(dt, 1e-3); e.prev = p.pos; e.spd += (Math.min(spd, 20) - e.spd) * Math.min(1, 6 * dt);
      const base = V(p.pos).addScaledVector(V(p.up), e.human ? -0.9 : 0);
      e.object.position.copy(base); this.orient(e.object, p.up, p.h); e.object.visible = true;
      if (e.human) {
        e.shotT = Math.max(0, e.shotT - dt);
        const clip = p.dead ? 'death' : e.shotT > 0 ? 'shoot' : e.spd > 6 ? 'sprint' : e.spd > 1.5 ? 'jog' : 'aimIdle';
        if (clip !== e.clip) { e.clip = clip; e.human.play(clip, { fade: 0.2, restart: clip === 'shoot' }); }
        e.human.update(dt, { speed: e.spd, camera: this.camera });
      } else e.object.visible = !p.dead;
      // etiqueta con nombre; caído: progreso de reanimación
      if (self) { if (e.label) e.label.visible = false; } else if (!e.label) { e.label = new THREE.Sprite(this.label(p.name, '#ffffff')); e.label.scale.set(2.6, 0.65, 1); e.object.add(e.label); }
      if (!self) {
      const txt = p.dead ? `REANIMAR ${Math.round(p.rv / 3 * 100)}%` : `${p.name} ${p.id}`, colr = p.dead ? '#ff7a9a' : '#' + col.toString(16).padStart(6, '0');
      if (e.labelTxt !== txt) { e.labelTxt = txt; e.label.material = this.label(txt, colr); }
      e.label.position.set(0, e.human ? 2.25 : 1.8, 0); }
    }
    for (const [id, e] of this.ents.ply) if (!seen.has(id)) { this.entRoot.remove(e.object); if (e.human) e.human.dispose(); this.ents.ply.delete(id); }
  }

  /* ───────── eventos → efectos ───────── */
  handleEvents(state, me) {
    const near = (p) => me ? V(p).distanceTo(V(me.pos)) : 99;
    for (const e of state.events) {
      switch (e.t) {
        case 'shot': {
          const o = V(e.o), col = WEAPON_COLORS[e.w] || 0xffffff;
          { const pe = this.ents.ply.get(e.pid); if (pe) pe.shotT = 0.35; }
          if (e.pid === (me && me.id)) { this.vm.shoot(); this.muzzle.intensity = 18; this.muzzle.color.setHex(col); }
          if (e.to) for (const t of e.to) this.fx.tracer(e.pid === (me && me.id) && this.aim ? this.camera.localToWorld(new THREE.Vector3(0.3, -0.25, -1.2)) : o, V(t), col);
          break;
        }
        case 'hit': this.fx.burst(V(e.p), e.arm ? 0x9999ff : 0xffffff, e.arm ? 3 : 6, 7, 0.4, 0.6); break;
        case 'kill': { const c = COLORS[e.k] || 0xffffff, boss = e.k === 'coloso' || e.k === 'madre'; this.fx.shatter(V(e.p), c, { size: boss ? 1.6 : (MONSTER_SIZE[e.k] || 0.5), n: boss ? 24 : 10, speed: boss ? 16 : 9 }); if (boss) { this.shake = 2; this.fx.blast(V(e.p), c, 40, 1.6); } break; }
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
