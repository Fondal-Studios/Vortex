// VISOR 3D DEL LABORATORIO (EH-06/07/08, docs/EDITOR_HUESPEDES.md §4.2). El cuerpo REAL del juego (huesped-cuerpo.js, `char: 'laboratorio'`) en un escenario con órbita, zoom,
// puntos de ancla que se tocan, zonas del cuerpo que se arrastran para cambiar su tamaño y un gizmo (mover / girar / escalar) acotado.
//   const V = await crearVisor(host, { calidad, eventos }); V.setBuild(build); V.setModo('cuerpo'|'piezas'); V.camara('tres_cuartos'); V.dispose();
// Eventos (opts.eventos): tapAncla(ancla, lado) · tapPieza(i) · tapVacio() · regionHover(r) · deformar(region, dyPx, fase) · gizmo(tipo, dato, fase) · tope(texto)
// Todo se libera en dispose() (geometrías, materiales, esqueleto). El renderer y el kit humano se reutilizan entre aperturas.
import * as THREE from 'three';
import { loadHumanKit } from './humans.js';
import { createHostBody } from './huesped-cuerpo.js';
import { loadEnvHDRI } from './ph.js';
import { tickMenuBeat } from './shaders.js';
import { ANCLAS, PARTES } from '../shared/host-build-catalogo.js';

export const CAMARAS = {
  frente: { n: 'Frente', yaw: 0, pitch: 0.05, y: 0.52, d: 1 }, tres_cuartos: { n: '3/4', yaw: 0.75, pitch: 0.12, y: 0.52, d: 1 }, perfil: { n: 'Perfil', yaw: Math.PI / 2, pitch: 0.05, y: 0.52, d: 1 },
  espalda: { n: 'Espalda', yaw: Math.PI, pitch: 0.08, y: 0.52, d: 1 }, cabeza: { n: 'Cabeza', yaw: 0.4, pitch: 0.06, y: 0.86, d: 0.3 }, manos: { n: 'Manos', yaw: 0.6, pitch: 0.3, y: 0.6, d: 0.45, x: 0.3 }, pies: { n: 'Pies', yaw: 0.5, pitch: 0.3, y: 0.08, d: 0.45 },
};
export const CAMARA_IDS = Object.keys(CAMARAS);
/** Dónde se dibuja el punto de cada ancla (hueso + desplazamiento hacia la superficie, m del modelo, lado izquierdo +x) y hacia dónde «mira» (para atenuar los de atrás). */
const PUNTO = {
  cabeza: ['head', [0, 0.2, 0.04], [0, 1, 0]], cuello: ['neck02', [0, 0, 0.06], [0, 0, 1]], hombros: ['upperarm01', [0, 0.07, 0], [1, 1, 0]], pecho: ['spine01', [0, 0.03, 0.17], [0, 0, 1]],
  espalda: ['spine03', [0, 0.15, -0.11], [0, 0, -1]], cintura: ['spine04', [0, -0.02, 0.11], [0, 0, 1]], antebrazos: ['lowerarm01', [0.03, -0.03, 0.05], [1, 0, 0]], manos: ['wrist', [0.02, -0.04, 0.05], [1, 0, 0]],
  muslos: ['upperleg01', [0.02, -0.2, 0.09], [0, 0, 1]], cola: ['spine05', [0, -0.03, -0.1], [0, 0, -1]],
};
const REGIONES = {
  cabeza: { n: 'Cabeza', k: 'cabeza', segs: [['head_h', null, 0.125, [0, 0.19, 0.03]]] }, torso: { n: 'Torso', k: 'torso', segs: [['spine05_h', 'spine04_h', 0.15], ['spine04_h', 'spine01_h', 0.17]] },
  hombros: { n: 'Hombros', k: 'hombros', lados: true, segs: [['clavicle_#_h', 'upperarm01_#_h', 0.07]] }, brazos: { n: 'Brazos', k: 'brazos', lados: true, segs: [['upperarm01_#_h', 'lowerarm01_#_h', 0.055], ['lowerarm01_#_h', 'wrist_#_h', 0.05]] },
  manos: { n: 'Manos', k: 'manos', lados: true, segs: [['wrist_#_h', 'finger3-1_#_h', 0.055]] }, piernas: { n: 'Piernas', k: 'piernas', lados: true, segs: [['upperleg01_#_h', 'lowerleg01_#_h', 0.1], ['lowerleg01_#_h', 'foot_#_h', 0.07]] },
  pies: { n: 'Pies', k: 'pies', lados: true, segs: [['foot_#_h', 'toe1-1_#_h', 0.06]] },
};
const CLIPS_V = { idle: [0, 'idle'], caminar: [1.2, 'walk'], trotar: [3.2, 'jog'], correr: [6.5, 'sprint'], saltar: [0, 'jump'], golpear: [0, 'punch'], hechizo: [0, 'cast'], herida: [0, 'hit'], caer: [0, 'death'] };
export const CLIP_ES = { idle: 'Quieto', caminar: 'Caminar', trotar: 'Trotar', correr: 'Correr', saltar: 'Saltar', golpear: 'Golpear', hechizo: 'Hechizo', herida: 'Herida', caer: 'Caer' };
let kitP = null, kitQ = '';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hexN = (h) => parseInt(String(h).replace('#', ''), 16);

export async function crearVisor(host, opts = {}) {
  const calidad = opts.calidad || 'low', ev = opts.eventos || {}, reducir = !!opts.reducirMovimiento;
  const canvas = host.querySelector('canvas') || host.appendChild(document.createElement('canvas'));
  const gl = new THREE.WebGLRenderer({ canvas, antialias: calidad !== 'low', alpha: true, powerPreference: 'low-power' });
  gl.setClearColor(0x000000, 0); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.2;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  scene.add(new THREE.HemisphereLight(0xd4daff, 0x4a2a70, 2.1)); const key = new THREE.DirectionalLight(0xfff1e0, 3.4), rim = new THREE.DirectionalLight(0xa8ccff, 4.5), kick = new THREE.DirectionalLight(0xff8a50, 2.6), fill = new THREE.DirectionalLight(0xdfd0ff, 2.2);
  key.position.set(2.2, 3.4, 4); rim.position.set(-3, 2.4, -3.5); kick.position.set(3.5, 0.6, -2); fill.position.set(-3, 1.2, 3.2); scene.add(key, rim, kick, fill);
  const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
  const pad = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), new THREE.MeshBasicMaterial({ color: 0xff7a22, ...add, opacity: 0.16 })), ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.14, 64), new THREE.MeshBasicMaterial({ color: 0xff7a22, ...add, opacity: 0.7 }));
  pad.rotation.x = ring.rotation.x = -Math.PI / 2; pad.position.y = 0.004; ring.position.y = 0.008; scene.add(pad, ring);
  loadEnvHDRI(gl, 'small_cathedral_02').then((t) => { if (!muerto) { scene.environment = t; scene.environmentIntensity = 1.2; } }).catch(() => { /* sin cielo: luces simples */ });
  let muerto = false, body = null, buildAct = null, claveGeo = '', timerGeo = 0, modo = 'piezas', sel = { ancla: null, i: -1 }, gizmoModo = 'mover', regionHover = null, regionDrag = null, creando = 0;
  const kitQual = calidad;
  if (!kitP || kitQ !== kitQual) { kitQ = kitQual; kitP = loadHumanKit({ quality: kitQual, movil: calidad === 'low' }); }
  const kit = await kitP; if (muerto) return null;

  /* ───── cámara orbital ───── */
  const O = { yaw: 0.75, pitch: 0.12, dist: 5, ty: 0.9, tx: 0, tz: 0, a: null, t: 0 };
  let escalaY = 1, aspect = 1;
  const alto = () => 1.75 * escalaY;
  function objetivoCam(nombre) {
    const c = CAMARAS[nombre] || CAMARAS.tres_cuartos, H = alto(), fov = THREE.MathUtils.degToRad(cam.fov), fitV = (H * 1.06) / 2 / Math.tan(fov / 2), fitH = (1.9 * escalaY) / 2 / (Math.tan(fov / 2) * aspect);
    const full = Math.max(fitV, fitH), d = c.d >= 1 ? full : Math.max(0.7, full * c.d + 0.2);
    return { yaw: c.yaw, pitch: c.pitch, dist: d, ty: c.y * H, tx: (c.x || 0) * escalaY * (c.yaw > 0 ? 1 : 1), tz: 0 };
  }
  function irCam(nombre, instante) { const t = objetivoCam(nombre); if (instante || reducir) { Object.assign(O, t, { a: null }); } else O.a = { de: { yaw: O.yaw, pitch: O.pitch, dist: O.dist, ty: O.ty, tx: O.tx }, a: t, t: 0 }; }
  function aplicarCam() {
    const cp = Math.cos(O.pitch); cam.position.set(O.tx + O.dist * Math.sin(O.yaw) * cp, O.ty + O.dist * Math.sin(O.pitch), O.tz + O.dist * Math.cos(O.yaw) * cp); cam.lookAt(O.tx, O.ty, O.tz);
  }
  function resize() { const w = Math.max(8, host.clientWidth), h = Math.max(8, host.clientHeight); gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, calidad === 'low' ? 1.5 : 2)); gl.setSize(w, h, false); aspect = w / h; cam.aspect = aspect; cam.updateProjectionMatrix(); }
  const ro = new ResizeObserver(() => { const antes = aspect; resize(); if (Math.abs(antes - aspect) > 0.05 && !O.usuario) irCam(O.nombre || 'tres_cuartos', true); }); ro.observe(host); resize();
  O.nombre = 'tres_cuartos'; irCam('tres_cuartos', true);

  /* ───── puntos de ancla (1 sola llamada de dibujo) ───── */
  const puntos = []; for (const a of Object.keys(PUNTO)) { const lados = ANCLAS[a].lados === 2 ? ['izq', 'der'] : ['c']; for (const l of lados) puntos.push({ ancla: a, lado: l }); }
  const pg = new THREE.BufferGeometry(), N = puntos.length;
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); pg.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); pg.setAttribute('aSz', new THREE.BufferAttribute(new Float32Array(N), 1)); pg.setAttribute('aAl', new THREE.BufferAttribute(new Float32Array(N), 1));
  const pm = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, uniforms: { uPx: { value: Math.min(window.devicePixelRatio || 1, 2) } },
    vertexShader: 'attribute vec3 aCol; attribute float aSz, aAl; uniform float uPx; varying vec3 vC; varying float vA; void main(){ vC = aCol; vA = aAl; gl_PointSize = aSz * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float ring = smoothstep(0.62, 0.7, d) * (1.0 - smoothstep(0.88, 0.98, d)); float dot_ = 1.0 - smoothstep(0.34, 0.42, d); float a = max(ring, dot_ * 0.85) * vA; gl_FragColor = vec4(vC, a); }' });
  const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; pts.renderOrder = 998; pts.visible = false; scene.add(pts);

  /* ───── resaltado de región y gizmo ───── */
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffd45a, ...add, opacity: 0.32, depthTest: false }), hlGeo = new THREE.CapsuleGeometry(1, 1, 4, 10), hl = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(hlGeo, hlMat); m.visible = false; m.renderOrder = 997; m.frustumCulled = false; scene.add(m); return m; });
  const gz = new THREE.Group(); gz.visible = false; scene.add(gz);
  const gmats = {}; const gm = (c) => gmats[c] || (gmats[c] = new THREE.MeshBasicMaterial({ color: c, depthTest: false, depthWrite: false, transparent: true, opacity: 0.95, toneMapped: false }));
  const ghit = new THREE.MeshBasicMaterial({ visible: false }), gobj = [], geos = [hlGeo];
  const COL = [0xff5a5a, 0x5aff7a, 0x6aa8ff];
  function armarGizmo() {
    while (gz.children.length) { const c = gz.children[0]; gz.remove(c); }
    gobj.length = 0; for (const g of geos.splice(1)) g.dispose();
    const mk = (geo, mat, o = {}) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); m.renderOrder = 1000; Object.assign(m.userData, o); m.frustumCulled = false; return m; };
    const dirs = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    if (gizmoModo === 'mover') for (let k = 0; k < 3; k++) {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirs[k]);
      const sh = mk(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), gm(COL[k]), { eje: k }), cone = mk(new THREE.ConeGeometry(0.04, 0.1, 12), gm(COL[k]), { eje: k }), hit = mk(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 6), ghit, { eje: k, hit: 1 });
      sh.position.y = 0.13; cone.position.y = 0.29; hit.position.y = 0.22; const g = new THREE.Group(); g.quaternion.copy(q); g.add(sh, cone, hit); gz.add(g); gobj.push(hit);
    }
    if (gizmoModo === 'girar') for (let k = 0; k < 3; k++) {
      const t = mk(new THREE.TorusGeometry(0.2, 0.011, 6, 40), gm(COL[k]), { eje: k }), hit = mk(new THREE.TorusGeometry(0.2, 0.05, 6, 24), ghit, { eje: k, hit: 1 });
      if (k === 0) { t.rotation.y = hit.rotation.y = Math.PI / 2; } if (k === 1) { t.rotation.x = hit.rotation.x = Math.PI / 2; } gz.add(t, hit); gobj.push(hit);
    }
    if (gizmoModo === 'escalar') { const c = mk(new THREE.BoxGeometry(0.1, 0.1, 0.1), gm(0xffd45a), { eje: 3 }), hit = mk(new THREE.SphereGeometry(0.14, 8, 6), ghit, { eje: 3, hit: 1 }), st = mk(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), gm(0xffd45a), {}); c.position.y = 0.26; hit.position.y = 0.2; st.position.y = 0.13; gz.add(c, st, hit); gobj.push(hit); }
  }
  armarGizmo();

  /* ───── cuerpo ───── */
  const plBase = () => ({ char: 'laboratorio', name: 'Híbrido', evo: 0, pth: [], cg: [], mw: '', mr: 1, eq: '', dead: false });
  async function crearCuerpo(b) {
    const tok = ++creando;
    if (body) { scene.remove(body.object); body.dispose(); body = null; }
    const nb = createHostBody(THREE, kit, plBase(), { quality: calidad, camera: cam, lab: b });
    scene.add(nb.object); await nb.ready; if (muerto || tok !== creando) { scene.remove(nb.object); nb.dispose(); return; }
    body = nb; claveGeo = JSON.stringify([b.base.preset, b.pal, b.partes]); marcarSel(); actualizarEsc(); if (buildAct && buildAct !== b) setBuild(buildAct, { inmediato: true }); opts.alListo && opts.alListo();
  }
  function actualizarEsc() { escalaY = body && body.lab ? body.lab.prop.altura : (buildAct ? buildAct.prop.altura : 1); }
  function setBuild(b, { inmediato = false } = {}) {
    buildAct = b; actualizarEsc();
    const col = hexN(b.pal.emisivo); for (const m of [pad, ring]) m.material.color.setHex(col);
    if (!body) { if (!creando) crearCuerpo(b); return; }
    const clave = JSON.stringify([b.base.preset, b.pal, b.partes]);
    if (b.base.preset !== body.lab.base.preset) { crearCuerpo(b); return; }
    if (clave === claveGeo) { body.setLab(b); return; }   // sólo proporciones (u otros campos que no dibujan): al instante, sin reconstruir
    body.setLab({ ...b, partes: body.lab.partes, pal: body.lab.pal });   // las proporciones no esperan
    const hacer = () => { timerGeo = 0; if (muerto || !body) return; claveGeo = JSON.stringify([buildAct.base.preset, buildAct.pal, buildAct.partes]); body.setLab(buildAct); marcarSel(); opts.alListo && opts.alListo(); };
    clearTimeout(timerGeo); if (inmediato) hacer(); else timerGeo = setTimeout(hacer, 120);   // las piezas reconstruyen con un respiro de 120 ms
  }
  function marcarSel() {
    if (!body) return;
    for (const p of body.proxies) { const m = p.mesh.material, s = p.i === sel.i; m.visible = s; if (s) { m.wireframe = true; m.color.setHex(hexN(buildAct ? buildAct.pal.emisivo : '#ffffff')).lerp(new THREE.Color(0xffffff), 0.5); m.transparent = true; m.opacity = 0.35; m.depthTest = false; } }
  }
  const proxyDe = (i) => { if (!body) return null; const l = body.proxies.filter((p) => p.i === i); return l.find((p) => p.lado !== 'izq') || l[0] || null; };

  /* ───── utilidades de cuadro ───── */
  const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), ray = new THREE.Raycaster();
  const hueso = (n) => (body && body.person.bones[n]) || null;
  const mundo = (n, off, out) => { const b = hueso(n); if (!b) return null; return b.localToWorld(out.set(...(off || [0, 0, 0]))); };
  function lado(n, l) { return n.replace('#', l); }
  function posPunto(p, out) {
    const [h, off] = PUNTO[p.ancla], dos = ANCLAS[p.ancla].lados === 2, s = p.lado === 'der' ? 'R' : 'L';
    const b = hueso(dos ? `${h}_${s}_h` : `${h}_h`); if (!b) return null;
    b.updateWorldMatrix(true, false); out.setFromMatrixPosition(b.matrixWorld); const H = body.holder.scale;
    // el desplazamiento está en el marco del modelo (sin giro de hueso): se aplica en el mundo con la escala del contenedor
    _a.set(p.lado === 'der' ? -off[0] : off[0], off[1], off[2]).multiply(H).applyQuaternion(body.object.getWorldQuaternion(new THREE.Quaternion())); return out.add(_a);
  }
  function actualizarPuntos(dt, t) {
    const P = pg.attributes.position, C = pg.attributes.aCol, S = pg.attributes.aSz, A = pg.attributes.aAl, ocup = new Set(); if (buildAct) for (const e of buildAct.partes) ocup.add(e.a);
    const touch = matchMedia('(pointer: coarse)').matches, base = touch ? 20 : 15, em = hexN(buildAct ? buildAct.pal.emisivo : '#ff7a22'), c = new THREE.Color();
    cam.getWorldPosition(_c);
    puntos.forEach((p, k) => {
      if (!posPunto(p, _v)) { A.setX(k, 0); return; }
      P.setXYZ(k, _v.x, _v.y, _v.z); const nrm = PUNTO[p.ancla][2]; _b.set(p.lado === 'der' ? -nrm[0] : nrm[0], nrm[1], nrm[2]).normalize(); _a.copy(_c).sub(_v).normalize();
      const cara = _b.dot(_a), vis = clamp(0.55 + cara * 1.2, 0.3, 1), esSel = sel.ancla === p.ancla;
      c.setHex(esSel ? 0xffffff : ocup.has(p.ancla) ? em : 0x9fe8ff); C.setXYZ(k, c.r, c.g, c.b); S.setX(k, base * (esSel ? 1.35 + (reducir ? 0 : 0.08 * Math.sin(t * 5)) : 1)); A.setX(k, vis * (esSel ? 1 : 0.9));
    });
    P.needsUpdate = C.needsUpdate = S.needsUpdate = A.needsUpdate = true; void dt;
  }
  function segmentosRegion(nombre, out) {
    const R = REGIONES[nombre], res = []; if (!R || !body) return res; const H = body.holder.scale;
    for (const l of R.lados ? ['L', 'R'] : [null]) for (const [a, b, r, off] of R.segs) {
      const A = new THREE.Vector3(), B = new THREE.Vector3(), na = l ? lado(a, l) : a, nb = b ? (l ? lado(b, l) : b) : null; if (!mundo(na, null, A)) continue;
      if (nb) { if (!mundo(nb, null, B)) continue; } else mundo(na, off, B);
      res.push({ a: A, b: B, r: r * Math.max(H.x, H.y) }); }
    void out; return res;
  }
  function distRayoSeg(o, d, p0, p1) { // distancia mínima rayo ↔ segmento (y parámetro a lo largo del rayo)
    const u = _a.copy(p1).sub(p0), w = _b.copy(o).sub(p0), a = d.dot(d), bb = d.dot(u), c = u.dot(u), dd = d.dot(w), e = u.dot(w), den = a * c - bb * bb;
    let s = den > 1e-8 ? (bb * e - c * dd) / den : 0, t = c > 1e-8 ? (e + bb * s) / c : 0; if (s < 0) s = 0; t = clamp(t, 0, 1); s = Math.max(0, (bb * t - dd) / a);
    const q1 = _c.copy(o).addScaledVector(d, s), q2 = _v.copy(p0).addScaledVector(u, t); return q1.distanceTo(q2);
  }
  function regionEn(ray0) {
    let mejor = null, mejorK = 1e9;
    for (const nombre of Object.keys(REGIONES)) for (const s of segmentosRegion(nombre)) { const d = distRayoSeg(ray0.ray.origin, ray0.ray.direction, s.a, s.b), k = d / (s.r * 1.25); if (k < 1 && k < mejorK) { mejorK = k; mejor = nombre; } }
    return mejor;
  }
  function ndc(e) { const r = canvas.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
  const aPx = (v) => { const r = canvas.getBoundingClientRect(), p = v.clone().project(cam); return { x: (p.x * 0.5 + 0.5) * r.width, y: (-p.y * 0.5 + 0.5) * r.height }; };
  function puntoMasCerca(e, limite = 0) {
    if (!pts.visible) return null; const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, P = pg.attributes.position, touch = e.pointerType === 'touch', lim = limite || (touch ? 30 : 20); let mejor = null, md = lim;
    puntos.forEach((p, k) => { if (pg.attributes.aAl.getX(k) < 0.25) return; const s = aPx(_v.set(P.getX(k), P.getY(k), P.getZ(k))), d = Math.hypot(s.x - mx, s.y - my); if (d < md) { md = d; mejor = p; } });
    return mejor;
  }

  /* ───── gizmo: colocación y arrastre ───── */
  let gdrag = null;
  function ejeModelo(inst, k) { // dirección en el MODELO del eje k de t.pos / rot
    if (k === 0) return new THREE.Vector3(inst.lado === 'izq' ? 1 : -1, 0, 0); return k === 1 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  }
  function ubicarGizmo() {
    const px = sel.i >= 0 ? proxyDe(sel.i) : null; gz.visible = !!px && modo === 'piezas'; if (!gz.visible) return;
    px.mesh.getWorldPosition(_v); gz.position.copy(_v); const dist = cam.position.distanceTo(_v), s = dist * 0.17 * (matchMedia('(pointer: coarse)').matches ? 1.25 : 1); gz.scale.setScalar(s);
    // orientación: la del cuerpo (los ejes del modelo), con el espejo del lado derecho en x
    gz.quaternion.copy(body.object.getWorldQuaternion(new THREE.Quaternion())); if (gizmoModo !== 'escalar') gz.scale.x *= px.lado === 'izq' ? 1 : -1;
  }
  function gizmoHit(e) { if (!gz.visible) return null; ray.setFromCamera(ndc(e), cam); const h = ray.intersectObjects(gobj, false); return h.length ? h[0].object.userData.eje : null; }
  function iniciarGizmo(e, eje) {
    const px = proxyDe(sel.i); if (!px) return; const inst = { lado: px.lado }, H = body.holder.scale; px.mesh.getWorldPosition(_v); const o = _v.clone();
    gdrag = { eje, x: e.clientX, y: e.clientY, modo: gizmoModo, o, esc: (H.x + H.y + H.z) / 3, inst };
    if (gizmoModo === 'mover') { const d = ejeModelo(inst, eje).applyQuaternion(body.object.getWorldQuaternion(new THREE.Quaternion())).multiply(H).normalize(), a = aPx(o), b = aPx(o.clone().addScaledVector(d, 0.1)); gdrag.px = { x: (b.x - a.x) / 0.1, y: (b.y - a.y) / 0.1 }; gdrag.l2 = gdrag.px.x ** 2 + gdrag.px.y ** 2; }
    ev.gizmo && ev.gizmo(gizmoModo, { eje }, 'inicio');
  }
  function moverGizmo(e) {
    if (!gdrag) return; const dx = e.clientX - gdrag.x, dy = e.clientY - gdrag.y; let dato;
    if (gdrag.modo === 'mover') { const m = gdrag.l2 > 1 ? ((dx * gdrag.px.x + dy * gdrag.px.y) / gdrag.l2) / gdrag.esc : 0; dato = { eje: gdrag.eje, delta: m }; }
    else if (gdrag.modo === 'girar') dato = { eje: gdrag.eje, grados: dx * 0.5 }; else dato = { factor: Math.exp(-dy * 0.006) };
    ev.gizmo && ev.gizmo(gdrag.modo, dato, 'mover');
  }

  /* ───── puntero ───── */
  const ptrs = new Map(); let gesto = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gesto = { tipo: 'pellizco', d: Math.hypot(a.x - b.x, a.y - b.y), dist: O.dist, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, ty: O.ty }; if (gdrag || regionDrag) cancelarArrastres(); return; }
    if (ptrs.size > 2) return; O.a = null;
    const g = gizmoHit(e); if (g !== null && g !== undefined) { iniciarGizmo(e, g); gesto = { tipo: 'gizmo' }; e.preventDefault(); return; }
    let reg = null; if (modo === 'cuerpo' && body) { ray.setFromCamera(ndc(e), cam); reg = regionEn(ray); }
    gesto = { tipo: reg ? 'region' : 'orbita', x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), mov: 0, reg };
    if (reg) { regionDrag = reg; ev.deformar && ev.deformar(reg, 0, 'inicio'); }
  });
  function cancelarArrastres() { if (gdrag) { ev.gizmo && ev.gizmo(gdrag.modo, {}, 'fin'); gdrag = null; } if (regionDrag) { ev.deformar && ev.deformar(regionDrag, 0, 'fin'); regionDrag = null; } }
  canvas.addEventListener('pointermove', (e) => {
    const prev = ptrs.get(e.pointerId); if (prev) { prev.x = e.clientX; prev.y = e.clientY; }
    if (!gesto) { // sin botón: resaltar lo que se puede tocar
      if (e.pointerType === 'mouse' && body) { let r = null; if (modo === 'cuerpo') { ray.setFromCamera(ndc(e), cam); r = regionEn(ray); } if (r !== regionHover) { regionHover = r; ev.regionHover && ev.regionHover(r); } canvas.style.cursor = r ? 'ns-resize' : (gizmoHit(e) !== null || puntoMasCerca(e)) ? 'pointer' : 'grab'; }
      return;
    }
    if (gesto.tipo === 'pellizco' && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); O.dist = clamp(gesto.dist * gesto.d / Math.max(20, d), 0.7, 14); O.ty = clamp(gesto.ty + ((a.y + b.y) / 2 - gesto.cy) * 0.004 * O.dist * 0.4, 0.1, 2.6); O.usuario = true; return; }
    if (gesto.tipo === 'gizmo') { moverGizmo(e); return; }
    const dx = e.clientX - gesto.x, dy = e.clientY - gesto.y; gesto.mov += Math.abs(dx) + Math.abs(dy); gesto.x = e.clientX; gesto.y = e.clientY;
    if (gesto.tipo === 'region') { if (gesto.mov > 4) ev.deformar && ev.deformar(gesto.reg, -dy, 'mover'); }
    else if (gesto.tipo === 'orbita') { O.yaw -= dx * 0.0085; O.pitch = clamp(O.pitch + dy * 0.006, -0.25, 1.25); O.usuario = true; }
  });
  const fin = (e) => {
    ptrs.delete(e.pointerId); if (!gesto) return;
    if (gesto.tipo === 'pellizco') { if (ptrs.size < 2) gesto = ptrs.size ? { tipo: 'nada' } : null; return; }
    const g = gesto; gesto = null;
    if (g.tipo === 'gizmo') { ev.gizmo && ev.gizmo(gdrag.modo, {}, 'fin'); gdrag = null; return; }
    if (g.tipo === 'region') { ev.deformar && ev.deformar(g.reg, 0, 'fin'); regionDrag = null; if (g.mov < 6) { ev.tapRegion && ev.tapRegion(g.reg); } return; }
    if (g.tipo === 'orbita' && g.mov < 8 && performance.now() - g.t0 < 600 && e.type === 'pointerup') tocar(e);
  };
  canvas.addEventListener('pointerup', fin); canvas.addEventListener('pointercancel', fin);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); O.dist = clamp(O.dist * Math.exp(e.deltaY * 0.0012), 0.7, 14); O.usuario = true; O.a = null; }, { passive: false });
  function tocar(e) {
    if (!body) return;
    const punto = modo === 'piezas' ? puntoMasCerca(e) : null; ray.setFromCamera(ndc(e), cam);
    const h = modo === 'piezas' ? ray.intersectObjects(body.proxies.map((p) => p.mesh), false) : [];
    const ocupada = punto && buildAct && buildAct.partes.some((x) => x.a === punto.ancla);
    // una pieza tocada gana, salvo que el toque caiga justo sobre un punto de ancla todavía vacío (se quiere elegir el ancla)
    const exacto = h.length && punto && !ocupada ? puntoMasCerca(e, 9) : null;   // un punto de ancla vacío justo bajo el dedo gana sobre la pieza
    if (h.length && !exacto) { ev.tapPieza && ev.tapPieza(h[0].object.userData.lab.i); return; }
    if (punto) { ev.tapAncla && ev.tapAncla(punto.ancla, punto.lado); return; }
    if (modo === 'cuerpo') { const r = regionEn(ray); if (r) { ev.tapRegion && ev.tapRegion(r); return; } }
    ev.tapVacio && ev.tapVacio();
  }

  /* ───── bucle ───── */
  let raf = 0, last = performance.now(), tt = 0, pausado = false, velClip = 0, clipAct = 'idle';
  function cuadro(now) {
    raf = requestAnimationFrame(cuadro); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (pausado || muerto || !host.isConnected || host.clientWidth < 8) return;
    tt += dt; tickMenuBeat(tt);
    if (O.a) { O.a.t = Math.min(1, O.a.t + dt / 0.38); const k = O.a.t * O.a.t * (3 - 2 * O.a.t), d = O.a.de, a = O.a.a; let dy = a.yaw - d.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); O.yaw = d.yaw + dy * k; O.pitch = d.pitch + (a.pitch - d.pitch) * k; O.dist = d.dist + (a.dist - d.dist) * k; O.ty = d.ty + (a.ty - d.ty) * k; O.tx = d.tx + (a.tx - d.tx) * k; if (O.a.t >= 1) O.a = null; }
    if (body) { body.update(dt, plBase(), { speed: velClip, moveDir: { x: 0, z: 1 }, pitch: 0, viewH: host.clientHeight }); actualizarPuntos(dt, tt); ubicarGizmo(); resaltar(); }
    ring.rotation.z += reducir ? 0 : dt * 0.25; aplicarCam(); gl.render(scene, cam);
  }
  function resaltar() {
    const r = regionDrag || regionHover || (opts.regionFoco && opts.regionFoco()); let k = 0;
    if (r && modo === 'cuerpo') for (const s of segmentosRegion(r)) { if (k >= hl.length) break; const m = hl[k++]; m.visible = true; m.position.copy(s.a).lerp(s.b, 0.5); const d = _v.copy(s.b).sub(s.a), len = Math.max(0.001, d.length()); m.quaternion.setFromUnitVectors(_a.set(0, 1, 0), d.normalize()); m.scale.set(s.r, Math.max(0.001, len - 0), s.r); }
    for (; k < hl.length; k++) hl[k].visible = false;
  }
  raf = requestAnimationFrame(cuadro);

  const api = {
    get body() { return body; }, get renderer() { return gl; }, get scene() { return scene; }, get camaraActual() { return O.nombre; }, get listo() { return !!body && body.isReady; },
    setBuild, setModo(m) { modo = m; pts.visible = m === 'piezas'; if (m !== 'piezas') gz.visible = false; hl.forEach((x) => { x.visible = false; }); },
    seleccionar(s) { sel = { ancla: s.ancla ?? null, i: s.i ?? -1 }; if (sel.i < 0) gz.visible = false; marcarSel(); },
    setGizmo(m) { if (m === gizmoModo) return; gizmoModo = m; armarGizmo(); },
    camara(n, instante = false) { O.nombre = n; O.usuario = false; irCam(n, instante); },
    reproducir(n) { const c = CLIPS_V[n] || CLIPS_V.idle; clipAct = n; velClip = c[0]; if (!body) return; if (['golpear', 'hechizo'].includes(n)) { body.event({ t: n === 'golpear' ? 'melee' : 'skill' }); return; } body.person.play(c[1], { fade: 0.16, restart: true }); },
    get clip() { return clipAct; },
    /** Triángulos y llamadas REALES de las piezas del jugador (el cuerpo base no cuenta). */
    medida() { if (!body || !body.kit) return null; const s = body.stats(), cuerpo = s.meshes.find((m) => m[0] === 'kit-cuerpo'); return { tris: Math.round(s.tris - (cuerpo ? cuerpo[1] : 0)), llamadas: s.meshes.length - (cuerpo ? 1 : 0), total: { tris: s.tris, llamadas: s.calls } }; },
    info() { return { geometrias: gl.info.memory.geometries, texturas: gl.info.memory.textures, llamadas: gl.info.render.calls, tris: gl.info.render.triangles }; },
    pausar(v) { pausado = !!v; }, regionPunto(n) { return segmentosRegion(n); },
    render() { aplicarCam(); gl.render(scene, cam); },
    /** Centro en pantalla (px relativos al canvas) de cada asa del gizmo (para pruebas y para el modo teclado). */
    get gizmoVisible() { return gz.visible; },
    gizmoPx() { if (!gz.visible) return []; const c = canvas.getBoundingClientRect(); return gobj.map((m) => { const p = aPx(m.getWorldPosition(new THREE.Vector3())); return { eje: m.userData.eje, x: p.x + c.left, y: p.y + c.top }; }); },
    /** Centro en pantalla (px de la ventana) de una región del cuerpo o de un punto de ancla. */
    regionPx(n) { const c = canvas.getBoundingClientRect(), s = segmentosRegion(n)[0]; if (!s) return null; const p = aPx(s.a.clone().lerp(s.b, 0.5)); return { x: p.x + c.left, y: p.y + c.top }; },
    puntoPx(ancla, lado = null) { const k = puntos.findIndex((p) => p.ancla === ancla && (!lado || p.lado === lado)); if (k < 0) return null; const P = pg.attributes.position, c = canvas.getBoundingClientRect(), q = aPx(new THREE.Vector3(P.getX(k), P.getY(k), P.getZ(k))); return { x: q.x + c.left, y: q.y + c.top }; },
    /** Qué hay bajo un punto de la ventana (para pruebas): { pieza: índice|null, ancla: nombre|null }. */
    hitTest(x, y) { if (!body) return null; const e = { clientX: x, clientY: y, pointerType: 'mouse' }; ray.setFromCamera(ndc(e), cam); const h = ray.intersectObjects(body.proxies.map((p) => p.mesh), false), pu = puntoMasCerca(e); return { pieza: h.length ? h[0].object.userData.lab.i : null, ancla: pu ? pu.ancla : null, modo }; },
    proyectar(v) { return aPx(v); }, get proxies() { return body ? body.proxies : []; }, get puntos() { return puntos; }, posicionPunto(p) { const o = new THREE.Vector3(); return posPunto(p, o) ? o : null; },
    dispose() {
      muerto = true; cancelAnimationFrame(raf); clearTimeout(timerGeo); ro.disconnect(); creando++;
      if (body) { scene.remove(body.object); body.dispose(); body = null; }
      for (const g of geos) g.dispose(); pg.dispose(); pm.dispose(); hlMat.dispose(); ghit.dispose(); for (const m of Object.values(gmats)) m.dispose();
      for (const m of [pad, ring]) { m.geometry.dispose(); m.material.dispose(); }
      gl.dispose(); gl.forceContextLoss && gl.forceContextLoss();
    },
  };
  void PARTES; return api;
}
