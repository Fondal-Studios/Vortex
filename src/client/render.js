import * as THREE from 'three';
import { MAPS } from '../sim/maps.js';
import { skyMaterial, crystalMaterial, groundMaterial, shellMaterial, zoneMaterial, uTime, uInfect, uBeat, OUT } from './shaders.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GradePass, sceneTarget } from './post.js';
import { loadEnvHDRI, MAP_HDRI } from './ph.js';
const POST_OFF = typeof location !== 'undefined' && /[?&]post=0/.test(location.search); // ?post=0: render directo (diagnóstico)
const INFECT_OVERRIDE = typeof location !== 'undefined' && /[?&]infect=([\d.]+)/.test(location.search) ? Math.min(1, +RegExp.$1) : null;
const HUMAN_HOSTS = typeof location !== 'undefined' && /[?&]cuerpo=humano/.test(location.search); // ?cuerpo=humano: prueba con el cuerpo humano de ARCANUM (host-human.js); por defecto los Huéspedes son almas y bestias (huespedes-limbo.js)
const usesComposer = () => !POST_OFF && !!(cfg().post || cfg().grade);
import { buildMonster, COLORS } from './models.js';
import { bakeProxyGeometry, proxyMaterial } from './proxy-lod.js';
import { Effects } from './effects.js';
import { ObjectsView } from './objects.js';
import { buildMap1 } from './env/map1.js';
import { buildMap2 } from './env/map2.js';
import { Viewmodels, WEAPON_COLORS as WC } from './weapons-vm.js';
import { kit } from './organism.js';
import heraldo from './creatures/heraldo.js';
import { cfg, LEVELS, setCurrent, setClaridad, setClaridadMapa, claridad, initialClaridad } from './quality.js';
import { CHARACTERS, WEAPONS } from '../sim/data.js';
import { createHostFx } from './hostfx.js';
import { createComboFx } from './combo-fx.js';   // golpes del modo Combo: pose del cuerpo, estelas, impacto, hit-stop (docs/HUESPEDES.md)
import { createSingularFx } from './singular-fx.js';   // pozos de gravedad y satélites de Singular (singular-fx.js)
import { EventosFx } from './eventos-fx.js';
import { LuzArenas } from './luz-arenas.js';   // luz propia de cada arena + ciclo día/ocaso/eclipse + luces de los órganos (luz-arenas.js)
import { FaunaFx } from './fauna-fx.js';   // fauna consumible: bichos psicodélicos, rastros y chispas (fauna-fx.js, docs/FAUNA.md)
import { NieblasFx } from './nieblas-fx.js';   // nieblas de colores con función (nieblas-fx.js)
import { FloraFx } from './flora-fx.js';   // flora interactiva y vegetación psicodélica (flora-fx.js)
import { ArenasVivasFx } from './arenas-vivas-fx.js';   // órganos del organismo de cada arena (arenas-vivas-fx.js)
import { createHostBody, isHost } from './host-body.js';
import { blocked } from '../sim/physics.js';
import { settings } from './settings.js';
import { affixInfo, hexCss, lineageOf, lineageStyle } from './mundo-vivo.js';
import { labelSprite } from './objects.js';
const WEAPONS_MAX = WEAPONS.map((w) => w.max);

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const MONSTER_SIZE = { astilla: 0.35, racimo: 0.35, geoda: 0.9, ariete: 0.8, obelisco: 0.6, cuarzo: 0.55 };
import { WEAPON_COLORS, shotEffects } from './shotfx.js';
const WEAPON_IDS = WEAPONS.map((w) => w.id);
const PLAYER_COLORS = [0x66ffee, 0xff66c4, 0xffd23f, 0x9dff5a];

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const GRAV_GIRO = 0.8;   // s: duración fija del giro de cámara en una inversión de gravedad

export class Renderer {
  constructor(canvas, { level = 'high', pixelRatio = null } = {}) {
    setCurrent(level); OUT.linear = usesComposer();
    this.canvas = canvas; this.level = level; this.prOverride = pixelRatio;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
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
    this.barRoot = new THREE.Group(); this.scene.add(this.barRoot); this.barGeo = new THREE.PlaneGeometry(1, 1);
    this.objects = new ObjectsView(this.scene, this.fx);
    this.dyn = []; // objetos del mapa con animación
    this.shake = 0; this.camQ = new THREE.Quaternion(); this.camInit = false;
    this.mapId = null; this.t = 0;
    this.gl.info.autoReset = false; // contamos todas las pasadas del cuadro (post-proceso incluido)
    this.gl.toneMapping = THREE.ACESFilmicToneMapping; this.gl.toneMappingExposure = usesComposer() ? 1.9 : 1.05;
    this.hemi = new THREE.HemisphereLight(0xb9c4ff, 0x2a0f3a, 1.1); this.sun = new THREE.DirectionalLight(0xfff1e0, 2.2); this.sun.position.set(0.4, 1, 0.3);
    this.rim = new THREE.DirectionalLight(0xff66c4, 1.0); this.rim.position.set(-0.6, 0.2, -0.8);
    this.muzzle = new THREE.PointLight(0xffd9a0, 0, 28, 1.6); this.camera.add(this.muzzle); this.muzzle.position.set(0.3, -0.2, -1);
    this.keyLight = new THREE.PointLight(0xffffff, 0, 11, 2); this.keyLight.name = 'luz-relleno-huesped'; // CLARIDAD: luz de relleno que sigue al Huésped propio (quality.js · CLARIDAD)
    this.scene.add(this.hemi, this.sun, this.rim, this.keyLight);
    setClaridad(initialClaridad()); this.clar = claridad();
    this.vm = new Viewmodels(this.camera, this.halo);
    try { this.hostfx = createHostFx(this); } catch (err) { console.warn('Efectos de Huéspedes no disponibles', err.message); this.hostfx = null; } // habilidades y melee de los 5 Huéspedes (hostfx.js)
    try { this.comboFx = createComboFx(this); } catch (err) { console.warn('Efectos de golpes (Combo) no disponibles', err.message); this.comboFx = null; }
    try { this.singularfx = createSingularFx(this); } catch (err) { console.warn('Efectos de Singular no disponibles', err.message); this.singularfx = null; }
    try { this.evfx = new EventosFx(this); } catch (err) { console.warn('Efectos de eventos no disponibles', err.message); this.evfx = null; } // eventos de oleada (eventos-fx.js)
    try { this.avfx = new ArenasVivasFx(this); } catch (err) { console.warn('Arenas vivas no disponibles', err.message); this.avfx = null; } // arenas vivas (arenas-vivas-fx.js)
    try { this.flfx = new FloraFx(this); this.flfx.configure(cfg()); } catch (err) { console.warn('Flora no disponible', err.message); this.flfx = null; } // flora interactiva (flora-fx.js)
    try { this.nfx = new NieblasFx(this); this.nfx.configure(cfg()); } catch (err) { console.warn('Nieblas de colores no disponibles', err.message); this.nfx = null; } // nieblas de colores (nieblas-fx.js)
    try { this.ffx = new FaunaFx(this); this.ffx.configure(cfg()); } catch (err) { console.warn('Fauna no disponible', err.message); this.ffx = null; } // fauna consumible (fauna-fx.js)
    try { this.luz = new LuzArenas(this); this.luz.configure(cfg()); } catch (err) { console.warn('Luz de arenas no disponible', err.message); this.luz = null; }
    this.dying = [];
    this.setupPost();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  /** CLARIDAD «normal» | «alta» (ajuste del jugador): relleno, borde de luz, halos, piso de sombras, niebla y exposición. */
  applyClaridad(id) {
    this.claridadId = id; setClaridad(id); this.clar = claridad(); this.gl.toneMappingExposure = (usesComposer() ? 1.9 : 1.05) * (usesComposer() ? 1 : this.clar.exp);
    if (this.grade) this.grade.clarity(this.clar);
    for (const e of this.ents.mon.values()) { const b = e.object.getObjectByName('beacon'); if (b) b.material.opacity = this.clar.beacon; }
    const hd = this.cache.get('haloDark'); if (hd) hd.opacity = this.clar.beaconDark;
  }
  shared(key, make) { let v = this.cache.get(key); if (!v) { v = make(); this.cache.set(key, v); } return v; }
  halo_(color) { return this.shared('halo' + color, () => new THREE.SpriteMaterial({ map: this.halo, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); }
  pixelRatioFor(level) {
    if (this.prOverride) return this.prOverride;
    const L = level === this.level || !LEVELS[level] ? cfg() : LEVELS[level], dpr = window.devicePixelRatio || 1, k = L.scale || 1;   // k: «Resolución» del menú Gráficos (0,5…1,5 × la del nivel)
    return Math.max(0.4, Math.min(L.maxPR * Math.max(1, k), dpr * L.pixelRatio * k));
  }
  /** Cambia la calidad en caliente: resolución, partículas, aristas, decorado y shaders del cielo. */
  applyQuality(level, { rebuild = true } = {}) {
    if (!LEVELS[level]) return;
    this.level = level; setCurrent(level); OUT.linear = usesComposer(); this.gl.toneMappingExposure = usesComposer() ? 1.9 : 1.05; this.setupPost();
    this.gl.setPixelRatio(this.pixelRatioFor(level)); this.resize();
    this.fx.configure(cfg());
    if (this.ffx) this.ffx.configure(cfg());   // fauna consumible
    if (this.flfx) this.flfx.configure(cfg());   // vegetación: densidad y detalle según el nivel
    if (this.nfx) this.nfx.configure(cfg());   // nieblas de colores (nieblas-fx.js): cantidad de nubes según el nivel
    if (this.luz) this.luz.configure(cfg());   // luces de órganos: una en Baja, dos en Media/Alta
    if (this.clar) this.applyClaridad(this.claridadId || 'normal');
    if (!rebuild) return;   // ajustes «en vivo» del menú Gráficos (resolución, bloom, post, niebla de aire, partículas…): no se reconstruye el mapa
    for (const m of Object.values(this.ents)) { for (const o of m.values()) this.entRoot.remove(o.object || o); m.clear(); }
    const id = this.mapId; this.mapId = null; if (id) this.setMap(id);
  }
  /** Resolución en vivo (menú Gráficos y Automático): sólo cambia el pixelRatio, sin reconstruir nada. */
  applyScale() { this.gl.setPixelRatio(this.pixelRatioFor(this.level)); this.resize(); }
  /** Post-proceso (post.js): escena a un destino HDR con MSAA y profundidad → bloom (Media/Alta) → pasada final de grading
   *  (AO por profundidad, niebla volumétrica falsa, ACES, curvas, viñeta, grano). Baja: sólo la pasada final barata. */
  setupPost() {
    const q = cfg();
    if (this.composer) { this.composer.dispose(); this.composer = null; this.grade && this.grade.dispose(); this.grade = null; }
    if (usesComposer()) {
      const c = new EffectComposer(this.gl, sceneTarget(q.msaa == null ? 4 : q.msaa)); c.setPixelRatio(this.gl.getPixelRatio());
      c.addPass(new RenderPass(this.scene, this.camera));
      if (q.post) { this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), q.bloom || 0.5, 0.55, 0.85); c.addPass(this.bloom); } else this.bloom = null;
      this.grade = new GradePass(this.level, { layers: q.fogLayers }); if (this.mapId) this.grade.preset(this.mapId); this.grade.clarity(this.clar || claridad()); c.addPass(this.grade);
      this.composer = c;
    }
    if (q.env && !this.envTex) { const pm = new THREE.PMREMGenerator(this.gl); this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }
    this.scene.environment = q.env ? (this.hdri || this.envTex) : null; this.scene.environmentIntensity = 0.55;
    this.rim.visible = q.lights >= 3; this.muzzle.visible = q.lights >= 4;
    // sombras proyectadas (Alta): el sol sigue al jugador con una cámara de sombra acotada
    this.gl.shadowMap.enabled = !!q.shadows; this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sun.castShadow = !!q.shadows;
    if (q.shadows) { const sc = this.sun.shadow.camera; sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46; sc.near = 1; sc.far = 220; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04; this.scene.add(this.sun.target); }
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
    this.dyn = []; this.baseFx = null; this.objects.npcLite = null;
    const warm = mapId === 'm2', dream = mapId === 'm3';
    this.hemi.color.setHex(warm ? 0xffb0d8 : dream ? 0xd0b8ff : 0xaab8ff); this.hemi.groundColor.setHex(warm ? 0x3a0a2a : dream ? 0x2a1050 : 0x1a0f3a); this.sun.color.setHex(warm ? 0xffd2c0 : 0xe8f0ff); this.rim.color.setHex(warm ? 0x66ffd8 : 0xff66c4);
    setClaridadMapa(mapId); this.clar = claridad(); if (this.grade) { this.grade.preset(mapId); this.grade.clarity(this.clar); }
    this.useHDRI(mapId);
    this.sunDir = null; // el entorno fija la dirección del sol; luego las sombras la siguen
    if (mapId === 'm3') this.loadMap3(MAPS.m3); else if (mapId === 'm4') this.loadMap4(MAPS.m4); else if (mapId === 'm5' || mapId === 'm6') this.loadLimbo(mapId); else if (mapId === 'base') this.loadBase(); else (mapId === 'm1' ? buildMap1 : buildMap2)(this, MAPS[mapId]);
    if (mapId === 'm1' || mapId === 'm2') import('./env/eyes.js').then((m) => {
      if (this.mapId !== mapId || !m.addCosmicEyes) return; const q = cfg().decor;
      if (mapId === 'm1') m.addCosmicEyes(this, this.mapRoot, { mode: 'sky', count: q ? 40 : 12, radius: 1000, minR: 450, size: 2.6, y0: -150, y1: 700 });
      else m.addCosmicEyes(this, this.mapRoot, { mode: 'shell', shellR: MAPS.m2.R, count: q ? 46 : 12 });
    }).catch(() => { /* sin ojos cósmicos */ });
  }
  /** Luz ambiente y reflejos por imagen: cielo HDRI de Poly Haven (ph.js) por mapa; mientras carga, RoomEnvironment. */
  useHDRI(mapId) {
    const id = MAP_HDRI[mapId]; if (!id || !cfg().env) return;
    loadEnvHDRI(this.gl, id).then((tex) => { if (this.mapId !== mapId || !cfg().env) return; this.hdri = tex; this.scene.environment = tex; }).catch(() => { /* sin HDRI: queda RoomEnvironment */ });
  }
  /** Jardín de Carne (mapa 4): env/map4.js construye suelo de tejido, vegetación reactiva, cielo y niebla (ya incluye los ojos cósmicos). */
  /** Arenas del limbo (mapas 5 y 6: Praga y Sedlec de ARCANUM, muertos): env/map5.js y env/map6.js. */
  loadLimbo(mapId) {
    import(mapId === 'm5' ? './env/map5.js' : './env/map6.js').then((m) => { if (this.mapId === mapId) m.build(this, MAPS[mapId]); }).catch((e) => { console.error('mapa ' + mapId + ':', e); });
  }
  /** La Base · El Santuario (src/sim/base.js + env/base.js): el mapa-hub caminable (docs/BASE.md). */
  loadBase() {
    import('./env/base.js').then((m) => { if (this.mapId === 'base') m.build(this, MAPS.base); }).catch((e) => { console.error('mapa base:', e); });
  }
  loadMap4(map) {
    const mapId = 'm4';
    import('./env/map4.js').then((m) => { if (this.mapId === mapId) m.buildMap4(this, map); }).catch((e) => { console.error('mapa 4:', e); });
  }
  /** Laberinto Celestial: usa env/map3.js si existe; si no, un laberinto básico de cajas. */
  loadMap3(map) {
    const mapId = 'm3';
    import('./env/map3.js').then((m) => { if (this.mapId === mapId) m.buildMap3(this, map); }).catch(() => {
      if (this.mapId !== mapId) return;
      const wallM = new THREE.MeshStandardMaterial({ color: 0x6a4fd8, emissive: 0x2a1580, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2 }), floorM = new THREE.MeshStandardMaterial({ color: 0x2a2060, roughness: 0.6 });
      for (const b of map.solids) { const m = new THREE.Mesh(new THREE.BoxGeometry(b.h.x * 2, b.h.y * 2, b.h.z * 2), b.wall ? wallM : floorM); m.position.set(b.c.x, b.c.y, b.c.z); this.mapRoot.add(m); }
      this.sun.position.set(40, 90, 30); this.sunDir = this.sun.position.clone().normalize();
    });
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
    if (this.comboFx) dt *= this.comboFx.timeScale();   // remate del Combo: cámara lenta VISUAL de 0,12 s (la simulación no se toca)
    this.gl.info.reset(); this.t += dt; uTime.value = this.t;
    this.setMap(state.map);
    { // tejido vivo que avanza con la oleada (uInfect) y latido del mundo (uBeat) que se acelera con la infección y el combate
      const W = state.waveTotal || 7, w = state.wave || 0, ov = INFECT_OVERRIDE, tgt = ov != null ? ov : Math.max(0, Math.min(1, (w - 1) / Math.max(1, W - 2)));
      this.infect = this.infect == null || ov != null ? tgt : this.infect + (tgt - this.infect) * Math.min(1, dt * 0.35); uInfect.value = this.infect;
      let hits = 0; for (const e of state.events) if (e.t === 'hit' || e.t === 'kill' || e.t === 'boom') hits++; this.combatK = Math.min(1, (this.combatK || 0) * Math.exp(-dt * 0.6) + hits * 0.05);
      this.beatPh = (this.beatPh || 0) + dt / (1.55 / (1 + 0.35 * this.infect + 0.5 * this.combatK)); const ph = this.beatPh % 1;
      uBeat.value = Math.exp(-((ph * 10) ** 2)) + 0.65 * Math.exp(-(((ph - 0.27) * 10) ** 2)); if (typeof window !== 'undefined') window.__infect = +this.infect.toFixed(3);
    }
    const me = state.players.find((p) => p.id === myId) || state.players[0];
    for (const f of this.dyn) f(dt, this.t);
    if (this.shellMat) this.shellMat.uniforms.uWarn.value = state.fx && state.fx.warn ? 1 : 0;
    this.syncMonsters(state, dt);
    this.syncProjectiles(state, dt);
    this.syncPickups(state);
    if (this.comboFx) { try { this.comboFx.ingest(state, me); } catch (err) { console.warn('comboFx', err.message); this.comboFx = null; } }   // ANTES de syncPlayers: arranca la pose de cada golpe
    this.syncPlayers(state, myId, dt);
    if ((state.objs || []).some((o) => o.t === 'npc')) { if (!this.humansKit) this.ensureHumans(); if (this.humansKit && this.hm && !this.objects.humans) { this.objects.humans = { kit: this.humansKit, hm: this.hm }; for (const [id, it] of [...this.objects.items]) if (it.t === 'npc') { this.objects.root.remove(it.g); this.objects.items.delete(id); } } }   // (los NPC que se armaron como figura liviana antes de que el kit cargara se rehacen como humanos; en la Base pasa en el primer segundo) // NPC del respiro: humano espectral cuando el kit ya cargó
    this.objects.sync(state, dt, state.map, this.camera.position);
    if (this.baseFx) { try { this.baseFx.update(dt, state, me); } catch (err) { console.warn('baseFx', err.message); this.baseFx = null; } }   // La Base: cubas, capullos, jardín… (base-fx.js)
    this.handleEvents(state, me);
    if (this.hostfx) this.hostfx.update(dt, state, me);
    if (this.comboFx) { try { this.comboFx.update(dt, state, me); } catch (err) { console.warn('comboFx', err.message); this.comboFx = null; } }
    if (this.singularfx) { try { this.singularfx.update(dt, state, me); } catch (err) { console.warn('singularfx', err.message); this.singularfx = null; } }
    if (this.evfx) { try { this.evfx.update(dt, state, me); } catch (err) { console.warn('evfx', err.message); this.evfx = null; } }
    if (this.avfx) { try { this.avfx.update(dt, state); } catch (err) { console.warn('avfx', err.message); this.avfx = null; } }
    if (this.luz) { try { this.luz.update(dt, state); } catch (err) { console.warn('luz', err.message); this.luz = null; } }
    if (this.nfx) { try { this.nfx.update(dt, state, me); } catch (err) { console.warn('nfx', err.message); this.nfx = null; } }
    if (this.flfx) { try { this.flfx.update(dt, state, me); } catch (err) { console.warn('flfx', err.message); this.flfx = null; } }
    if (this.ffx) { try { this.ffx.update(dt, state, me); } catch (err) { console.warn('ffx', err.message); this.ffx = null; } }   // fauna consumible
    this.updateDying(dt); this.updateAvisos(dt); this.updateGuide(dt, me);
    this.fx.update(dt);
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 220); // luz de fogonazo: destello seco (la fija combatfx por arma)
    if (me) this.updateCamera(me, dt, look);
    if (this.lost) return;
    if (this.grade) { this.camera.updateMatrixWorld(); this.grade.frame(this.camera, this.t, { sunDir: this.sunDir || this.sun.position, infect: this.infect || 0, fogR: this.mapId === 'm2' ? MAPS.m2.R : null }); }
    if (this.composer) this.composer.render(); else this.gl.render(this.scene, this.camera);
  }

  updateCamera(me, dt, look) {
    // CÁMARA DIRECTA: la mirada (yaw/pitch) se aplica tal cual, sin suavizado ni inercia (era un slerp de ~70 ms: sensación pesada).
    // Sólo el vector "arriba" se suaviza, y únicamente cuando la gravedad cambia (inversión de gravedad, zonas, marea).
    const up0 = V(me.up);
    if (!this.camInit || !this.upSm) { this.upSm = up0.clone(); this.camInit = true; this.comfort = 0; this.camAge = 0; }
    else {
      // Giro de horizonte CÓMODO. Inversión de gravedad (salto grande del «arriba»): giro de DURACIÓN FIJA ~0,8 s con arranque y frenado suaves,
      // rodando alrededor de la mirada (el horizonte da la vuelta sin que la vista se dispare); mientras dura, viñeta oscura y aviso.
      // Cambios chicos (zonas, marea radial): velocidad angular acotada (≤ 2,2 rad/s, frena al llegar) como siempre.
      const dotv = Math.max(-1, Math.min(1, this.upSm.dot(up0))), ang = Math.acos(dotv);
      if (this.gT > 0) {
        this.gT = Math.max(0, this.gT - dt); const k = 1 - this.gT / GRAV_GIRO, e = k * k * (3 - 2 * k);
        this.upSm.copy(this.gFrom).applyAxisAngle(this.gAxis, this.gAng * e).normalize();
        this.comfort = Math.min(1, this.comfort + (1 - this.comfort) * (1 - Math.exp(-10 * dt)));
      } else if (ang > 1.1) {
        this.gT = GRAV_GIRO; this.gFrom = this.upSm.clone(); this.gAng = ang;
        const cr = new THREE.Vector3().crossVectors(this.upSm, up0), aimV = this.aim && Math.abs(this.aim.dot(this.upSm)) < 0.95 ? this.aim : null;
        this.gAxis = dotv < -0.9 && aimV ? aimV.clone().normalize() : cr; // casi opuestos: rodar alrededor de la mirada
        if (this.gAxis.lengthSq() < 1e-8) this.gAxis.set(1, 0, 0).cross(this.upSm); this.gAxis.normalize();
        if (dotv < -0.9 && aimV && this.gAxis.dot(cr) < -1e-6) this.gAxis.negate();
        if ((this.camAge || 0) > 4) this.gravMsgT = 1.6;   // (no avisar en los primeros segundos de la partida)
      } else if (ang > 1e-3) {
        const step = Math.min(ang, Math.max(0.5, Math.min(2.2, ang * 3)) * dt);
        const axis = new THREE.Vector3().crossVectors(this.upSm, up0); if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0).cross(this.upSm); axis.normalize();
        this.upSm.applyAxisAngle(axis, step).normalize();
      }
      this.camAge = (this.camAge || 0) + dt;
      if (!(this.gT > 0)) this.comfort = this.comfort + ((ang > 0.05 ? Math.min(1, ang / 0.7) : 0) - this.comfort) * (1 - Math.exp(-8 * dt));
    }
    if (!this.comfortEl) { this.comfortEl = document.getElementById('comfort'); this.gravEl = document.getElementById('gravmsg'); }
    if (this.comfortEl) this.comfortEl.style.opacity = String(Math.min(0.7, this.comfort * 0.7));
    if (this.gravEl) { this.gravMsgT = Math.max(0, (this.gravMsgT || 0) - dt); this.gravEl.classList.toggle('on', this.gravMsgT > 0); }
    // La MIRA (adonde apunta y dispara) usa siempre la gravedad real de la simulación: el punto de mira nunca se desfasa.
    const up = up0, h0 = look ? V(look.h) : V(me.h), pitch = look ? look.pitch : me.pitch;
    const h = h0.clone().addScaledVector(up, -h0.dot(up)); if (h.lengthSq() < 1e-6) h.copy(h0); h.normalize();
    const aim = h.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
    const camUp = this.upSm.clone().addScaledVector(aim, -this.upSm.dot(aim)); if (camUp.lengthSq() < 1e-4) camUp.copy(up).addScaledVector(aim, -up.dot(aim)); camUp.normalize();
    const right = new THREE.Vector3().crossVectors(aim, camUp).normalize();
    const m = new THREE.Matrix4().makeBasis(right, camUp, aim.clone().negate());
    this.camQ.setFromRotationMatrix(m);
    this.camera.quaternion.copy(this.camQ);
    // zoom al apuntar (ADS): FOV por arma; transición rápida y fija en el tiempo
    { const W = WEAPONS[me.w], scope = W && (W.range >= 300 || ['cometa', 'lanza'].includes(W.id)), want = me.ads ? (scope ? 30 : (this.third ? 52 : 58)) : (this.third ? (settings().camFov || 78) : 82); this.fovNow = this.fovNow || 82; this.fovNow += (want - this.fovNow) * (1 - Math.exp(-16 * dt)); if (Math.abs(this.camera.fov - this.fovNow) > 0.01) { this.camera.fov = this.fovNow; this.camera.updateProjectionMatrix(); } this.zoomKind = me.ads ? (scope ? 2 : 1) : 0; }
    if (this.third) {
      // CÁMARA SOBRE EL HOMBRO: misma fórmula que la simulación (game.camPos) para que la retícula y el disparo coincidan; se acerca si hay paredes.
      const S = settings(), k = me.ads ? 0.7 : 1, rw = new THREE.Vector3().crossVectors(h, up).normalize();
      const pivot = V(me.pos).addScaledVector(up, 0.6 - (me.cr ? 0.3 : 0));
      if (this.comboFx) pivot.addScaledVector(h, this.comboFx.lead(me.id));   // la cámara acompaña el avance del golpe (el héroe no se escapa de cuadro)
      const ray = new THREE.Vector3().addScaledVector(aim, -(S.camDist || 3.6) * k).addScaledVector(rw, (S.camSide || 1) * 0.8 * k).addScaledVector(up, 0.25);
      const mp = this.collMap || MAPS[this.mapId]; let t = 1;
      if (mp) for (let s2 = 0.1; s2 <= 1.0001; s2 += 0.07) { const pt = pivot.clone().addScaledVector(ray, s2); if (blocked(mp, { x: pt.x, y: pt.y, z: pt.z })) { t = Math.max(0.12, s2 - 0.1); break; } }
      this.camT = this.camT === undefined ? t : (t < this.camT ? t : this.camT + (t - this.camT) * (1 - Math.exp(-5 * dt)));   // se acerca al instante; se aleja suave
      this.camera.position.copy(pivot).addScaledVector(ray, this.camT);
      this.eye = this.camera.position.clone(); this.aim = aim; this.vm.update(dt, { firing: false, hidden: true }); return;
    }
    let eyeH = 0.6 - (me.cr ? 0.3 : 0);
    if (this.wakeT !== undefined && this.wakeT < this.wakeDur) { this.wakeT += dt; const k = Math.min(1, this.wakeT / this.wakeDur), e = 1 - Math.pow(1 - k, 3); this.camera.rotateZ((1 - e) * 1.45); eyeH = 0.6 - 0.45 * (1 - e); }
    const eye = V(me.pos).addScaledVector(up, eyeH);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    if (this.shake > 0) eye.add(new THREE.Vector3().randomDirection().multiplyScalar(this.shake * 0.25));
    this.camera.position.copy(eye);
    this.eye = eye; this.aim = aim;
    if (this.sun.castShadow) { this.sunDir = this.sunDir || this.sun.position.clone().normalize(); this.sun.target.position.copy(V(me.pos)); this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, 90); this.sun.target.updateMatrixWorld(); }
    this.vm.setWeapon(me.w);
    { const ln = lineageOf(me); this.vm.setLineage(ln ? lineageStyle(ln.id) : null); } // Linaje Alba/Ocaso: tinte y brasas en el arma de mano
    const lk = look && look.delta ? look.delta : [0, 0];
    const pm = this.prevMe, spd = pm ? Math.hypot(me.pos[0] - pm[0], me.pos[1] - pm[1], me.pos[2] - pm[2]) / Math.max(dt, 1e-3) : 0; this.prevMe = me.pos; this.vmSpd = (this.vmSpd || 0) + (Math.min(spd, 20) - (this.vmSpd || 0)) * Math.min(1, 8 * dt);
    const am = me.ammo ? me.ammo[me.w] : -1, wmax = WEAPONS_MAX[me.w];
    this.vm.update(dt, { firing: !!this.firing, hidden: me.dead, look: lk, speed: this.vmSpd, ammo: am < 0 ? Infinity : am, maxAmmo: wmax == null || !isFinite(wmax) ? Infinity : wmax });
  }

  /* ───────── sincronización de entidades ───────── */
  orient(obj, u, f) {
    const up = V(u), fw = V(f);
    const right = new THREE.Vector3().crossVectors(up, fw);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize(); const fwd = new THREE.Vector3().crossVectors(right, up).normalize();
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd));
  }

  /** Barra de vida sobre cada criatura herida o élite (siempre mira a la cámara; se ve a través de objetos). */
  updateBar(e, m) {
    const boss = m.k === 'coloso' || m.k === 'madre' || m.k === 'argos';
    const show = !boss && (m.hp < m.mh - 0.5 || m.el) && this.camera.position.distanceTo(V(m.p)) < 75;
    if (!show) { if (e.bar) e.bar.visible = false; return; }
    if (!e.bar) {
      const g = new THREE.Group(), mk = (c, o, ro) => { const mt = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false, depthWrite: false }); const q = new THREE.Mesh(this.barGeo, mt); q.renderOrder = ro; return q; };
      g.userData = { bg: mk(0x05030f, 0.7, 996), fill: mk(0x66ff88, 0.95, 997), edge: mk(0xffffff, 0.0, 995) }; g.add(g.userData.edge, g.userData.bg, g.userData.fill); this.barRoot.add(g); e.bar = g;
    }
    const g = e.bar, u = g.userData, w = Math.max(1.4, Math.min(4.6, m.r * 1.7)), hh = Math.max(0.16, w * 0.085), frac = Math.max(0, Math.min(1, m.hp / m.mh));
    g.visible = true; g.quaternion.copy(this.camera.quaternion);
    g.position.copy(V(m.p)).addScaledVector(V(m.u), m.r * 1.25 + 0.9);
    u.edge.scale.set(w + hh * 0.5, hh * 1.5, 1); u.bg.scale.set(w, hh, 1); u.fill.scale.set(Math.max(0.001, w * frac), hh * 0.8, 1); u.fill.position.set(-w * (1 - frac) / 2, 0, 0.001);
    u.fill.material.color.setHex(m.ef & 4 ? 0xff9a3a : m.ef & 2 ? 0xa6ff4a : frac > 0.6 ? 0x66ff88 : frac > 0.3 ? 0xffd23f : 0xff4a5a);
    u.edge.material.opacity = m.el ? 0.8 : 0; u.edge.material.color.setHex(0xff3a5a);
  }
  /** Afijo de élite (AFFIXES): UN sprite de halo del color del afijo + UNA etiqueta con el nombre (textura compartida por texto). Sólo élites, así que cuesta poco. */
  setAffix(e, af) {
    if (e.affSp) { e.object.remove(e.affSp); e.object.remove(e.affHalo); e.affSp = e.affHalo = null; }
    e.af = af || null; const a = affixInfo(af); if (!a) return;
    const halo = new THREE.Sprite(this.halo_(a.color)); halo.scale.setScalar(5);  halo.name = 'afijo'; e.object.add(halo);
    const lb = labelSprite(a.label, hexCss(a.color)); lb.position.y = 1.9; lb.name = 'afijo-nombre'; e.object.add(lb); e.affSp = lb; e.affHalo = halo;
  }
  syncMonsters(state, dt) {
    const seen = new Set();
    // solo las N criaturas más cercanas tienen modelo completo; el resto, proxy barato (clave para iPhone)
    const cp = this.camera.position, ranked = state.monsters.map((m) => [(m.p[0] - cp.x) ** 2 + (m.p[1] - cp.y) ** 2 + (m.p[2] - cp.z) ** 2, m.id]).sort((a, b) => a[0] - b[0]);
    const full = new Set(ranked.slice(0, cfg().full).map((r) => r[1]));
    for (const m of state.monsters) {
      seen.add(m.id);
      let e = this.ents.mon.get(m.id);
      if (!e) {
        e = buildMonster(m.k); e.kind = m.k; e.born = this.t; e.spd = 0; e.far = false; e.frame = 0;
        e.proxy = new THREE.Mesh(this.shared('lodgeo' + m.k, () => bakeProxyGeometry(m.k) || new THREE.IcosahedronGeometry(0.9, 1)), proxyMaterial()); e.proxy.visible = false; e.object.add(e.proxy); // silueta propia de la especie (ver proxy-lod.js)
        if (cfg().shadows) e.object.traverse((q) => { if (q.isMesh) q.castShadow = true; }); e.object.userData.s = new THREE.Vector3();
        { const bc = COLORS[m.k] || 0xffffff, sp = new THREE.Sprite(this.halo_(bc)); sp.scale.setScalar(m.k === 'coloso' || m.k === 'madre' || m.k === 'argos' ? 3.4 : 4.2); sp.material.opacity = this.clar.beacon; sp.material.depthWrite = false; sp.name = 'beacon'; e.object.add(sp);
          const dk = new THREE.Sprite(this.shared('haloDark', () => new THREE.SpriteMaterial({ map: this.halo, color: 0x04020c, depthWrite: false, transparent: true, opacity: this.clar.beaconDark }))); dk.scale.setScalar(sp.scale.x * 1.25); dk.renderOrder = -1; dk.name = 'beaconDark'; e.object.add(dk); } // ARTE: halo OSCURO bajo el aura: la criatura se recorta también sobre fondos claros (muro ámbar, carne rosa) // aura del color de la criatura: se lee a distancia y sobre el fondo
        this.entRoot.add(e.object); this.ents.mon.set(m.id, e);
        e.object.position.set(...m.p);
      }
      const o = e.object, scale = m.r * (m.k === 'coloso' || m.k === 'madre' || m.k === 'argos' ? 1.4 : 1) * (m.el ? 1.22 : 1) * Math.min(1, 0.2 + (this.t - e.born) * 3);
      if (m.el && !e.elite) { e.elite = true; const sp = new THREE.Sprite(this.halo_(0xff3a5a)); sp.scale.setScalar(3.4); sp.material.opacity = 0.55; sp.name = 'elite'; e.object.add(sp); }
      if ((m.af || null) !== (e.af || null)) this.setAffix(e, m.af); // élite con afijo: halo de color + nombre
      if (e.affSp) { const k = 1 / Math.max(0.2, scale); e.affSp.scale.set(3.6 * k, 0.6 * k, 1); e.affHalo.scale.setScalar(4.6 + 0.5 * Math.sin(this.t * 5 + m.id)); }
      o.position.lerp(V(m.p), 0.6);
      { // IMPACTO: al recibir daño la criatura se aplasta y rebota (resorte amortiguado ~0,35 s): el golpe se SIENTE en el cuerpo
        if (m.h && !e.hPrev) { e.kick = Math.min(1.6, (e.kick || 0) + 1); e.kickT = 0; } e.hPrev = !!m.h;
        if (e.kick > 0.01) { e.kickT += dt; e.kick *= Math.exp(-dt * 7); const w = Math.sin(e.kickT * 38) * e.kick * 0.13; o.scale.set(scale * (1 + w), scale * (1 - w * 1.3), scale * (1 + w)); } else o.scale.setScalar(scale);
      }
      this.orient(o, m.u, m.f);
      this.faro(e, m, state, scale);   // faro de rastreo: rezagadas en acoso y últimas criaturas de la oleada (se ven a través de muros)
      this.updateBar(e, m);
      const boss = m.k === 'coloso' || m.k === 'madre' || m.k === 'argos'; this.tmpV.copy(this.camera.position).sub(o.position); const far = !boss && (this.tmpV.length() > cfg().lod + m.r * 2 || !full.has(m.id));
      if (far !== e.far) { e.far = far; e.object.children[0].visible = !far; e.proxy.visible = far; }
      if (far) continue;
      if ((m.ef || 0) !== (e.ef || 0)) { e.ef = m.ef || 0; if (e.statusSp) { e.object.remove(e.statusSp); e.statusSp = null; } if (e.ef) { const c = e.ef & 4 ? 0xff7a1a : e.ef & 2 ? 0x7dff4a : 0x66b8ff; const sp = new THREE.Sprite(this.halo_(c)); sp.scale.setScalar(2.8); sp.material.opacity = 0.5; e.object.add(sp); e.statusSp = sp; } }
      if (e.statusSp) e.statusSp.material.opacity = 0.35 + 0.2 * Math.sin(this.t * 9);
      const hv = m.h ? 0.7 : 0; if (kit.setWound) kit.setWound(e.mats, Math.max(0, Math.min(1, 1 - m.hp / m.mh)));
      for (const mat of e.mats) { const uh = (mat.userData && mat.userData.u && mat.userData.u.uHurt) || (mat.uniforms && mat.uniforms.uHurt); if (uh) uh.value = hv; }
      this.tmpV.set(this.camera.position.x, this.camera.position.y, this.camera.position.z); o.updateMatrixWorld(); o.worldToLocal(this.tmpV);
      const spd = e.prev ? Math.hypot(m.p[0] - e.prev[0], m.p[1] - e.prev[1], m.p[2] - e.prev[2]) / Math.max(dt, 1e-3) : 0; e.prev = m.p; e.spd += ((spd / Math.max(1, m.r * 6)) - e.spd) * Math.min(1, 6 * dt);
      e.tick(dt, { id: m.id, s: m.s, o: m.o, c: m.c, hp: m.hp / m.mh, sd: m.sd, st: m.st, a: m.a }, this.t, { look: this.tmpV.clone().normalize(), speed: e.spd, dist: this.tmpV.length() });
    }
    for (const [id, e] of this.ents.mon) if (!seen.has(id)) { if (e.bar) { this.barRoot.remove(e.bar); e.bar = null; } this.ents.mon.delete(id); e.dyingT = 0; e.dyingMax = e.kind === 'coloso' || e.kind === 'madre' || e.kind === 'argos' ? 1.8 : 0.5; e.base = e.object.scale.clone(); this.dying.push(e); }
  }
  /** FARO DE RASTREO (política «sin teletransportes», docs/MUNDO_VIVO.md): una columna de luz + halo grande sobre las criaturas en acoso (`m.ac`) y sobre
   *  las últimas de la oleada (≤ 6 sin jefe), dibujados SIN profundidad: se ven a través de paredes y niebla. Magenta = acosando; ámbar = de las últimas. */
  faro(e, m, state, scale) {
    const ultima = state.left <= 6 && !state.boss && !(m.k === 'coloso' || m.k === 'madre' || m.k === 'argos'), on = !!m.ac || ultima;
    if (!on) { if (e.faro) { e.faro.visible = false; } return; }
    if (!e.faro) {
      const g = new THREE.Group(); g.name = 'faro';
      const hm = (c) => this.shared('faro' + c, () => new THREE.SpriteMaterial({ map: this.halo, color: c, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0.8 }));
      const col = new THREE.Sprite(hm(0xffffff)); col.name = 'col'; g.add(col);
      const hal = new THREE.Sprite(hm(0xffffff)); hal.name = 'hal'; g.add(hal);
      col.renderOrder = hal.renderOrder = 998; e.object.add(g); e.faro = g; e.faroC = 0;
    }
    const c = m.ac ? 0xff4fd8 : 0xffc24a;
    if (e.faroC !== c) { e.faroC = c; const mat = this.shared('faro' + c, () => new THREE.SpriteMaterial({ map: this.halo, color: c, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0.8 })); e.faro.getObjectByName('col').material = mat; e.faro.getObjectByName('hal').material = mat; }
    const k = 1 / Math.max(0.2, scale), pul = 0.85 + 0.15 * Math.sin(this.t * 6 + m.id);
    e.faro.visible = true;
    const col = e.faro.getObjectByName('col'), hal = e.faro.getObjectByName('hal');
    col.scale.set(2.2 * k, 46 * k, 1); col.position.set(0, 21 * k, 0);   // columna vertical (hacia arriba del mundo; el objeto está orientado con su «arriba»)
    hal.scale.setScalar(9 * k * pul);
  }
  /** Marcas de aviso en el suelo (nacimientos `omen`, llegada del Pombero `tele`): un anillo que late hasta que se cumple el plazo. */
  updateAvisos(dt) {
    if (!this.avisos || !this.avisos.length) return;
    for (let i = this.avisos.length - 1; i >= 0; i--) {
      const a = this.avisos[i]; a.left -= dt; a.tick -= dt;
      if (a.tick <= 0) { a.tick = 0.32; this.fx.ring(a.p, a.n, a.color, a.r, 0.5, { op: 0.9, lift: 0.08 }); this.fx.flash(a.p.clone().addScaledVector(a.n, 0.6), a.color, 1.4, 0.3, { op: 0.8 }); }
      if (a.left <= 0) this.avisos.splice(i, 1);
    }
  }
  addAviso(p, up, color, r, secs) { (this.avisos = this.avisos || []).push({ p: V(p), n: up ? V(up).normalize() : new THREE.Vector3(0, 1, 0), color, r, left: secs, tick: 0 }); if (this.avisos.length > 24) this.avisos.shift(); }
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
        const col = p.k === 'mina' ? 0xffd23f : p.k === 'nova' ? 0xff9a3c : p.k === 'orb' ? 0xff4fd8 : p.k === 'beam' ? 0x66f0ff : p.k === 'swarm' ? 0xff66c4 : p.k === 'lanza' ? 0xb8f6ff : 0xffe066;
        const g = new THREE.Group(), key = `${p.k}${p.r}`;
        const geo = this.shared('pg' + key, () => { const long = p.k === 'beam' || p.k === 'lanza', q = p.k === 'beam' ? new THREE.CylinderGeometry(0.1, 0.1, 2.6, 5) : p.k === 'lanza' ? new THREE.ConeGeometry(0.25, 3.2, 6) : new THREE.OctahedronGeometry(p.r * 1.1, 0); if (long) q.rotateX(p.k === 'lanza' ? -Math.PI / 2 : Math.PI / 2); return q; });
        g.add(new THREE.Mesh(geo, this.shared('pm' + col, () => new THREE.MeshBasicMaterial({ color: col }))));
        const sp = new THREE.Sprite(this.halo_(col)); sp.scale.setScalar(p.r * 5); g.add(sp);
        e = g; e.userData.col = col; e.position.set(...p.p); this.entRoot.add(g); this.ents.proj.set(p.id, g);
      }
      e.position.set(...p.p);
      if (p.k === 'beam' || p.k === 'lanza') e.lookAt(e.position.clone().add(V(p.v))); else e.rotation.y += 0.2;
      if ((p.k === 'nova' || p.k === 'swarm') && Math.random() < 0.8) this.fx.burst(e.position, 0xffa040, 1, 2, 0.4, 0.5);
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
  async ensureHumans(force = false) {
    if (this.humansKit || this.humansLoading || (cfg().humans === 'low' && !HUMAN_HOSTS && !force)) return; // en Baja sólo para el Huésped con cuerpo humano (host-human.js)
    this.humansLoading = true;
    try { this.hm = await import('./humans.js'); this.humansKit = await this.hm.loadHumanKit({ quality: cfg().humans }); } catch (err) { console.warn('personas 3D no disponibles:', err.message); this.humansFailed = true; }
  }
  simpleAvatar(col) {
    const g = new THREE.Group(), m = crystalMaterial(col, { glow: 0.2 });
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), m); body.scale.y = 1.4; g.add(body);
    const gun = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.2, 5), m); gun.rotation.x = Math.PI / 2; gun.position.set(0.5, 0, 0.7); g.add(gun); return g;
  }
  syncPlayers(state, myId, dt = 0.016) {
    const seen = new Set();
    if (state.players.length > 1) this.ensureHumans();
    if (state.players.some((q) => isHost(q.char))) this.ensureHumans(true); // los Huéspedes usan siempre el cuerpo unificado (huesped-cuerpo.js), también en Baja
    for (const p of state.players) {
      const self = p.id === myId; if (self && !this.third) continue;
      seen.add(p.id);
      let e = this.ents.ply.get(p.id);
      const ch = CHARACTERS[p.char], col = ch ? ch.color : PLAYER_COLORS[(p.id - 1) % 4];
      if (!e) { e = { object: new THREE.Group(), human: null, simple: null, prev: p.pos, spd: 0, col, shotT: 0 }; e.simple = this.simpleAvatar(col); e.object.add(e.simple); this.entRoot.add(e.object); this.ents.ply.set(p.id, e); }
      if (!e.body && !e.noBody && !e.human && isHost(p.char) && (this.humansKit || this.humansFailed)) { // cuerpo UNIFICADO del Huésped (huesped-cuerpo.js): humano de ARCANUM + kit de armadura anclado a los huesos
        try {
          if (this.humansFailed) { e.body = createHostBody(THREE, p, { quality: this.level === 'low' ? 'low' : 'medium' }); e.object.add(e.body.object); e.fallback = true; } // sin el kit humano: cuerpo de bloques
          else if (!this.cuerpoMod) { this.cuerpoMod = 'cargando'; import('./huesped-cuerpo.js').then((m) => { this.cuerpoMod = m; }).catch((err) => { console.warn('cuerpo de Huésped:', err.message); this.cuerpoMod = null; }); }
          else if (this.cuerpoMod.createHostBody) { e.body = this.cuerpoMod.createHostBody(THREE, this.humansKit, p, { quality: this.humansKit.quality, camera: this.camera, map: this.mapId }); e.object.add(e.body.object); }
          else if (this.cuerpoMod === null) { e.body = createHostBody(THREE, p, { quality: this.level === 'low' ? 'low' : 'medium' }); e.object.add(e.body.object); e.fallback = true; } // sin el módulo: cuerpo de bloques
        } catch (err) { console.warn('cuerpo de Huésped:', err.message); e.noBody = true; }
      }
      if (e.body && e.simple && (e.fallback || e.body.isReady)) { e.object.remove(e.simple); e.simple = null; } // el avatar simple sólo se muestra mientras carga el cuerpo
      if (!e.body && !e.human && !isHost(p.char) && this.humansKit && this.hm && cfg().humans !== 'low') { try { e.human = this.hm.createHuman(this.humansKit, ch ? { char: p.char, name: p.name } : { preset: self ? 'pasajero' : 'jugador' + (((p.id - 1) % 4) + 1), color: col, name: p.name, role: p.role }); e.object.add(e.human.object); e.object.remove(e.simple); e.simple = null; } catch (err) { console.warn(err.message); } }
      const dv = [p.pos[0] - e.prev[0], p.pos[1] - e.prev[1], p.pos[2] - e.prev[2]], spd = Math.hypot(...dv) / Math.max(dt, 1e-3); e.prev = p.pos;
      const hv = V(p.h), rv = new THREE.Vector3().crossVectors(hv, V(p.up)), dvv = V(dv), dl = dvv.length() || 1; e.moveDir = { x: dvv.dot(rv) / dl, z: dvv.dot(hv) / dl }; e.spd += (Math.min(spd, 20) - e.spd) * Math.min(1, 6 * dt);
      const base = V(p.pos).addScaledVector(V(p.up), e.human || e.body ? -0.9 : 0);
      e.object.position.copy(base); this.orient(e.object, p.up, p.h); e.object.visible = true;
      if (e.body && self && e.body.isReady && !p.dead) { // luz de relleno: desde atrás-arriba del Huésped (el lado que ve la cámara), con el color de su brillo
        const k = this.keyLight, cam = this.camera.position, c = this.clar, up = V(p.up);
        k.position.copy(base).addScaledVector(up, 2.5); const toCam = cam.clone().sub(base); toCam.addScaledVector(up, -toCam.dot(up)); if (toCam.lengthSq() > 1e-4) k.position.addScaledVector(toCam.normalize(), 1.7);
        k.color.set(0xffffff).lerp(new THREE.Color(col), 0.25); k.intensity = 20 * c.key * (this.luzKey || 1); k.visible = true;
      } else if (self) this.keyLight.intensity = 0;
      if (e.body) {
        for (const ev of state.events) if ((ev.t === 'melee' || ev.t === 'skill') && ev.pid === p.id) e.body.event(ev); else if (ev.t === 'fauna' && ev.pid === p.id && e.body.formaEvent) e.body.formaEvent(ev);   // fauna: la transformación al comer
        e.shotT = Math.max(0, e.shotT - dt); const cx = this.comboFx ? this.comboFx.frameFor(p.id, dt, p, state) : null;   // Combo: pose del golpe, avance visual y hit-stop del cuerpo
        e.body.update(dt, p, { speed: e.spd, moveDir: e.moveDir, pitch: p.pitch, self, shot: e.shotT > 0, map: this.mapId, camDist: self ? this.camera.position.distanceTo(V(p.pos)) : null, ...cx });
      } else if (e.human) {
        e.shotT = Math.max(0, e.shotT - dt);
        const clip = p.dead ? 'death' : e.shotT > 0 ? 'shoot' : e.spd > 6 ? 'sprint' : e.spd > 1.5 ? 'jog' : 'aimIdle';
        if (clip !== e.clip) { e.clip = clip; e.human.play(clip, { fade: 0.2, restart: clip === 'shoot' }); }
        e.human.update(dt, { speed: e.spd, moveDir: e.moveDir, pitch: p.pitch, camera: this.camera });
      } else e.object.visible = !p.dead;
      // etiqueta con nombre; caído: progreso de reanimación
      if (self) { if (e.label) e.label.visible = false; } else if (!e.label) { e.label = new THREE.Sprite(this.label(p.name, '#ffffff')); e.label.scale.set(2.6, 0.65, 1); e.object.add(e.label); }
      if (!self) {
      const txt = p.dead ? `REANIMAR ${Math.round(p.rv / 3 * 100)}%` : `${p.name} ${p.id}`, colr = p.dead ? '#ff7a9a' : '#' + col.toString(16).padStart(6, '0');
      if (e.labelTxt !== txt) { e.labelTxt = txt; e.label.material = this.label(txt, colr); }
      e.label.position.set(0, e.human ? 2.25 : e.body ? (e.body.labelY || 2.9) : 1.8, 0); }
    }
    for (const [id, e] of this.ents.ply) if (!seen.has(id)) { this.entRoot.remove(e.object); if (e.human) e.human.dispose(); if (e.body) e.body.dispose(); this.ents.ply.delete(id); }
  }

  /* ───────── eventos → efectos ───────── */
  handleEvents(state, me) {
    const near = (p) => me ? V(p).distanceTo(V(me.pos)) : 99;
    const bossP = (state.monsters.find((m) => m.k === 'coloso' || m.k === 'madre' || m.k === 'argos') || {}).p;
    const C = this.fx.combat; C.frame(this, state, me); // efectos de combate: estelas, estados sobre criaturas, objetos
    const OWN = new Set(['pulsar', 'arc', 'beam', 'tshot', 'well', 'minePlace', 'skill']); // eventos que ahora dibuja combatfx.js (el dibujo viejo de objects.js se omite)
    if (this.singularfx && state.events.length) for (const e of state.events) this.singularfx.onEvent(e, me, state);   // pozos / satélites de Singular: avisa sin consumir el evento
    let evs = state.events; if (this.hostfx && evs.length) { evs = []; for (const e of state.events) if (!this.hostfx.onEvent(e, me, state)) evs.push(e); } // hostfx.js resuelve las habilidades / melee de los Huéspedes
    for (const e of evs) {
      if (e.t === 'flora') { if (this.flfx) this.flfx.onEvent(e, me, state); continue; }   // flora interactiva: cura, picadura, esporas… (flora-fx.js); el sonido y los carteles los pone main.js
      if (e.t === 'fauna') { if (this.ffx) this.ffx.onEvent(e, me, state); continue; }   // fauna consumible: chispas al comer / rematar (fauna-fx.js); el sonido y los carteles los pone main.js
      if (!OWN.has(e.t)) this.objects.onEvent(e, this.fx, bossP);
      if (e.t === 'shot') for (const [pid, pe] of this.ents.ply) if (pid === e.pid) pe.shotT = 0.25;
      switch (e.t) {
        case 'shot': {
          const col = WEAPON_COLORS[e.w] || 0xffffff, mine = e.pid === (me && me.id);
          { const pe = this.ents.ply.get(e.pid); if (pe) pe.shotT = 0.35; }
          if (mine) this.vm.shoot(); // (la luz de fogonazo, el destello de pantalla y la patada de cámara los dispara combatfx.firstPerson)
          shotEffects(this, e, mine && this.aim && !this.third ? C.muzzleWorld(this) : V(e.o), WEAPON_IDS); void col;
          break;
        }
        case 'hit': case 'splat': case 'blink': case 'pulsar': case 'arc': case 'beam': case 'tshot': case 'well': case 'minePlace': case 'skill': C.event(e); break;
        case 'kill': { C.event(e); const boss = e.k === 'coloso' || e.k === 'madre' || e.k === 'argos'; if (boss) this.shake = C.reduced ? 0.4 : 2; break; }
        case 'boom': C.event(e); this.shake = Math.max(this.shake, Math.min(1, 12 / (near(e.p) + 4)) * (C.reduced ? 0.2 : 1)); break;
        case 'portal': this.fx.blast(V(e.p), 0x66ffff, 4, 0.5); break;
        case 'summon': this.fx.blast(V(e.p), 0xff7a45, 6, 0.7); break;
        case 'omen': this.addAviso(e.p, me ? me.up : null, 0xff7a45, 2.6, e.in || 1.1); break;   // aviso de nacimiento: la criatura aparece AHÍ, no salta
        case 'tele': { // el Pombero avisa: marca en el punto de llegada + rastro hasta ahí durante todo el aviso
          this.addAviso(e.p, me ? me.up : null, 0xff5ad0, 2.2, e.in || 0.9);
          const a = V(e.a), b = V(e.p); for (let t = 0; t < 3; t++) this.fx.line(a, b, 0xff5ad0, 0.12, (e.in || 0.9) * (1 - t * 0.25), { a0: 0.7, a1: 0.2 });
          break; }
        case 'acoso': this.fx.blast(V(e.p), 0xff4fd8, 5, 0.6); break;   // empieza a acosarte: faro y flecha de radar
        case 'desint': { const p = V(e.p); this.fx.blast(p, 0x9a7bff, 5, 0.7); this.fx.burst(p, 0xb89cff, 40, 7, 0.9, 0.7); this.fx.flash(p, 0xffffff, 3, 0.25); break; }   // desintegración visible (atascada o fuera del mapa)
        case 'gravity': this.fx.blast(V(e.p), 0x6a7bff, 60, 1.0); break;
        case 'phase': this.shake = 1.5; break;
        case 'bite': break;
        case 'pickup': if (me && e.pid === me.id) this.fx.blast(V(me.pos), 0x9dff5a, 3, 0.4); break;
      }
    }
  }
}
