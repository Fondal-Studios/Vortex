// EFECTOS DE SINGULAR (docs/HUESPEDES.md → «Singular»): dibuja lo que la simulación (src/sim/singular.js) tiene como objetos y estados, y avisa de sus eventos.
//   · POZOS gravitatorios (objetos 't:"pozo"' del snapshot): esfera negra + disco de acreción oblicuo que gira + anillo que marca el alcance + polvo que cae en espiral hacia el centro.
//     Normal / chico (mini) / de la habilidad (hab) / enorme de la Supernova (big, sigue al jugador). Pool fijo de 6 (nada se crea por cuadro).
//   · SATÉLITES (campo `so` = [cantidad, fase] y `sm` del jugador): rocas con veta violeta en la MISMA órbita que calcula la simulación (misma fórmula que orbPos) + un aro tenue que
//     marca la órbita. Una InstancedMesh (1 llamada) para todos los jugadores. La fase se avanza localmente y se corrige con cada snapshot.
//   · Eventos: pozo (apertura), pozoend (implosión), reflujo (onda hacia afuera), orbburst (los satélites estallan), horizonte (la Marea no lo invierte), skill honda / supernova.
// API (igual que hostfx.js): const sfx = createSingularFx(renderer); sfx.onEvent(e, me, state) · sfx.update(dt, state, me) · sfx.clear() · sfx.dispose() · sfx.stats()
import * as THREE from 'three';

const TAU = Math.PI * 2;
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const upOf = (p, mapId) => { const a = p && p.up; if (Array.isArray(a) && a.length === 3 && typeof a[0] === 'number') return new THREE.Vector3(a[0], a[1], a[2]); if (mapId === 'm2' && p && p.pos) return new THREE.Vector3(-p.pos[0], -p.pos[1], -p.pos[2]).normalize(); return new THREE.Vector3(0, 1, 0); };
const wrapPi = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
const ORO = 0xffc23a, VIO = 0xb26bff, VIO_L = 0xd8b8ff;
const POZOS = 6, SATS = 32;
// misma fórmula que singular.js (SING.orbR/orbW y modificadores)
const orbR = (p) => 3.4 * (p.sm ? 1.2 : 1) * (p.ui === 'supernova' ? 1.4 : 1);
const orbW = (p) => 2.4 * ((p.pth || []).includes('velocidad') ? 1.4 : 1) * (p.ui === 'supernova' ? 1.3 : 1) * (p.sm ? 1.2 : 1);

const DISC_VS = 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const DISC_FS = `uniform float uT, uO; uniform vec3 uC1, uC2; varying vec2 vP;
void main(){ float r = length(vP); if (r > 1.0 || r < 0.22) discard; float ang = atan(vP.y, vP.x), k = (r - 0.22) / 0.78;
  float arms = 0.5 + 0.5 * sin(ang * 3.0 - k * 9.0 - uT * 2.4), hot = pow(1.0 - k, 1.7);
  float a = (hot * (0.35 + 0.9 * arms) + 0.06) * smoothstep(0.22, 0.3, r) * smoothstep(1.0, 0.82, r);
  vec3 c = mix(uC2, uC1, pow(1.0 - k, 1.4)); gl_FragColor = vec4(c * 1.4, clamp(a, 0.0, 1.0) * uO); }`;
const RANGE_FS = `uniform float uT, uO; uniform vec3 uC1; varying vec2 vP;
void main(){ float r = length(vP); float ring = smoothstep(0.015, 0.0, abs(r - 0.98)); float ang = atan(vP.y, vP.x); float dash = step(0.0, sin(ang * 24.0 - uT * 1.5));
  gl_FragColor = vec4(uC1 * 1.2, ring * (0.35 + 0.5 * dash) * uO); }`;
const DUST_VS = `attribute float aS; uniform float uT, uR; varying float vA;
void main(){ float u = fract(aS * 13.7 - uT * (0.16 + 0.12 * fract(aS * 5.3))); float r = uR * (0.12 + 0.88 * u), a = aS * 94.0 + uT * (1.2 + 3.0 * (1.0 - u)) + u * 5.0;
  vec3 p = vec3(cos(a) * r, (fract(aS * 7.1) - 0.5) * uR * 0.18 * u, sin(a) * r); vA = smoothstep(0.0, 0.12, u) * (1.0 - smoothstep(0.85, 1.0, u)) * (0.3 + 0.7 * (1.0 - u));
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (2.0 + 3.0 * fract(aS * 9.1)) * 38.0 / max(1.0, -mv.z) * (0.6 + 0.8 * (1.0 - u)); gl_Position = projectionMatrix * mv; }`;
const DUST_FS = 'uniform vec3 uC1; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uC1 * 1.6, smoothstep(0.5, 0.0, d) * vA); }';

export function createSingularFx(renderer) {
  const fx = renderer.fx, scene = renderer.scene;
  const root = new THREE.Group(); root.name = 'singularfx'; scene.add(root);
  const low = () => (fx && fx.tier != null ? fx.tier : 2) === 0;
  let T = 0, lastState = null;
  const disposables = [];
  const safe = (f) => { try { f(); } catch { /* el efecto es decoración: nunca rompe el cuadro */ } };

  /* ───────── pozos ───────── */
  const discGeo = new THREE.RingGeometry(0.0001, 1, 64, 1).rotateX(-Math.PI / 2), coreGeo = new THREE.SphereGeometry(1, 20, 14), planeGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const dustGeo = (() => { const n = low() ? 90 : 180, g = new THREE.BufferGeometry(), s = new Float32Array(n); for (let i = 0; i < n; i++) s[i] = (i + 0.5) / n; g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1)); return g; })();
  disposables.push(discGeo, coreGeo, planeGeo, dustGeo);
  const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 }); disposables.push(blackMat);
  const pool = [];
  for (let i = 0; i < POZOS; i++) {
    const g = new THREE.Group(); g.visible = false; root.add(g);
    const core = new THREE.Mesh(coreGeo, blackMat), tilt = new THREE.Group(); core.frustumCulled = false;
    const dm = new THREE.ShaderMaterial({ ...ADD, uniforms: { uT: { value: 0 }, uO: { value: 1 }, uC1: { value: new THREE.Color(0xfff0b0) }, uC2: { value: new THREE.Color(0x7a38d8) } }, vertexShader: DISC_VS, fragmentShader: DISC_FS }), disc = new THREE.Mesh(planeGeo, dm); disc.frustumCulled = false;
    const rm = new THREE.ShaderMaterial({ ...ADD, uniforms: { uT: { value: 0 }, uO: { value: 1 }, uC1: { value: new THREE.Color(ORO) } }, vertexShader: DISC_VS, fragmentShader: RANGE_FS }), range = new THREE.Mesh(planeGeo, rm); range.frustumCulled = false;
    const dmat = new THREE.ShaderMaterial({ ...ADD, uniforms: { uT: { value: 0 }, uR: { value: 1 }, uC1: { value: new THREE.Color(VIO_L) } }, vertexShader: DUST_VS, fragmentShader: DUST_FS }), dust = new THREE.Points(dustGeo, dmat); dust.frustumCulled = false;
    disposables.push(dm, rm, dmat);
    tilt.add(disc, core); tilt.rotation.set(0.5, 0, 0.25); g.add(tilt, range, dust);
    pool.push({ g, core, tilt, disc, dm, rm, dmat, id: -1, seen: 0, life0: 0, o: 0 });
  }
  const byId = new Map();
  function pozosUpdate(dt, state) {
    const want = new Set(); let n = 0;
    for (const o of state.objs || []) {
      if (o.t !== 'pozo') continue; if (++n > POZOS) break; want.add(o.id);
      let it = byId.get(o.id);
      if (!it) { it = pool.find((q) => !q.g.visible); if (!it) continue; it.id = o.id; it.life0 = Math.max(0.5, o.l || 1); it.o = 0; it.g.visible = true; byId.set(o.id, it); }
      it.life0 = Math.max(it.life0, o.l || 0);
      const R = o.r || 8, big = o.nk === 'big', mini = o.nk === 'mini', core = (big ? 0.2 : 0.17) * R * (mini ? 0.8 : 1);   // tamaño visual: proporcional al alcance
      it.g.position.set(o.p[0], o.p[1], o.p[2]);
      const fade = Math.min(1, it.o + dt * 3), end = Math.min(1, (o.l || 0) / 0.5);   // aparece en 0,3 s y se apaga en el último medio segundo
      it.o = fade; const a = fade * end;
      it.core.scale.setScalar(core * (0.9 + 0.1 * a)); it.disc.scale.setScalar(core * 3.4); it.tilt.rotation.y += dt * (big ? 0.5 : 0.8);
      it.dm.uniforms.uT.value = T; it.dm.uniforms.uO.value = a * (mini ? 0.7 : 1);
      it.rm.uniforms.uT.value = T; it.rm.uniforms.uO.value = a * (mini ? 0.5 : 0.9);
      it.dmat.uniforms.uT.value = T; it.dmat.uniforms.uR.value = R * 0.55;
      it.g.children[1].scale.setScalar(R); it.g.children[1].position.y = 0.05;   // anillo de alcance (en el plano del suelo)
    }
    for (const [id, it] of byId) if (!want.has(id)) { it.g.visible = false; byId.delete(id); }
  }

  /* ───────── satélites ───────── */
  const rockGeo = new THREE.IcosahedronGeometry(0.5, 1); { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.22 * Math.sin(x * 9 + y * 7) * Math.cos(z * 8); p.setXYZ(i, x * k, y * k * 0.92, z * k); } rockGeo.computeVertexNormals(); }
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a3c5e, roughness: 0.92, metalness: 0.05, flatShading: true, emissive: 0x2a0c50, emissiveIntensity: 0.7 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, SATS); rocks.frustumCulled = false; rocks.count = 0; root.add(rocks);
  const glowMat = new THREE.MeshBasicMaterial({ color: VIO, ...ADD, opacity: 0.22 }), glows = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 10, 8), glowMat, SATS); glows.frustumCulled = false; glows.count = 0; root.add(glows);
  const orbitGeo = new THREE.RingGeometry(0.985, 1, 72, 1).rotateX(-Math.PI / 2), orbitMat = new THREE.MeshBasicMaterial({ color: ORO, ...ADD, opacity: 0.16 });
  const orbits = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(orbitGeo, orbitMat); m.visible = false; m.frustumCulled = false; root.add(m); orbits.push(m); }
  disposables.push(rockGeo, rockMat, rocks, glowMat, glows.geometry, orbitGeo, orbitMat);
  const phases = new Map(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _u = new THREE.Vector3(), _ref = new THREE.Vector3(), _bq = new THREE.Quaternion(), _bm = new THREE.Matrix4();
  function satsUpdate(dt, state) {
    let k = 0, oi = 0; const mapId = renderer.mapId;
    for (const p of state.players || []) {
      if (p.char !== 'singular' || !p.so || p.dead) continue;
      const n = p.so[0] | 0, target = p.so[1]; let ph = phases.get(p.id);
      if (!ph) { ph = { a: target, last: target }; phases.set(p.id, ph); }
      ph.a += dt * orbW(p); if (target !== ph.last) { ph.a += wrapPi(target - ph.a) * 0.5; ph.last = target; }   // fase local + corrección en cada snapshot
      _u.copy(upOf(p, mapId)); _ref.set(0, 1, 0); if (Math.abs(_u.y) > 0.9) _ref.set(1, 0, 0);
      _e1.crossVectors(_u, _ref).normalize(); _e2.crossVectors(_u, _e1);
      const R = orbR(p), pos = V(p.pos);
      for (let i = 0; i < n && k < SATS; i++, k++) {
        const a = ph.a + (i * TAU) / n, h = 1.1 + 0.45 * Math.sin(2 * a + ph.a * 0.5), c = Math.cos(a) * R, s2 = Math.sin(a) * R;
        _p.copy(pos).addScaledVector(_u, h).addScaledVector(_e1, c).addScaledVector(_e2, s2);
        _e.set(T * 0.9 + i, T * 0.7 + i * 2, 0); _q.setFromEuler(_e); const sz = 0.55 + 0.14 * (i % 3);
        _m.compose(_p, _q, _s.set(sz, sz * 0.9, sz)); rocks.setMatrixAt(k, _m);
        _m.compose(_p, _q, _s.set(sz * 1.5, sz * 1.5, sz * 1.5)); glows.setMatrixAt(k, _m);
      }
      if (oi < orbits.length) { const o = orbits[oi++]; o.visible = true; o.position.copy(pos).addScaledVector(_u, 1.1); _bm.makeBasis(_e1, _u, _e2); _bq.setFromRotationMatrix(_bm); o.quaternion.copy(_bq); o.scale.setScalar(R); orbitMat.opacity = 0.14 + 0.05 * Math.sin(T * 2); }
    }
    for (let j = oi; j < orbits.length; j++) orbits[j].visible = false;
    rocks.count = glows.count = k; rocks.instanceMatrix.needsUpdate = glows.instanceMatrix.needsUpdate = true;
    for (const id of [...phases.keys()]) if (!(state.players || []).some((q) => q.id === id)) phases.delete(id);
  }

  /* ───────── eventos ───────── */
  const ring = (p, n, c, r, life, o) => safe(() => fx.ring(V(p), n ? V(n) : null, c, r, life, o));
  const flash = (p, c, s, life, o) => safe(() => fx.flash(V(p), c, s, life, o));
  const sparks = (p, c, n, sp, life, o) => safe(() => fx.sparks(V(p), c, low() ? Math.ceil(n / 2) : n, sp, life, o));
  function onEvent(e, me, state) {
    if (state) lastState = state;
    switch (e.t) {
      case 'pozo': ring(e.p, [0, 1, 0], e.kind === 'mini' ? VIO : ORO, (e.r || 8) * 0.5, 0.55, { th: 0.12 }); flash(e.p, VIO_L, 3, 0.25, { burst: true }); break;
      case 'pozoend': ring(e.p, [0, 1, 0], ORO, e.r || 8, 0.5, { th: 0.2 }); ring(e.p, null, VIO, (e.r || 8) * 0.7, 0.45, { th: 0.14 }); flash(e.p, 0xffffff, (e.r || 8) * 0.5, 0.18, { burst: true }); sparks(e.p, ORO, 18, 22, 0.6, { c2: VIO }); break;
      case 'reflujo': ring(e.p, [0, 1, 0], VIO, 12, 0.5, { th: 0.18 }); flash(e.p, VIO_L, 5, 0.2, { burst: true }); break;
      case 'orbburst': ring(e.p, [0, 1, 0], ORO, e.r || 7, 0.45, { th: 0.14 }); sparks(e.p, ORO, 10, 16, 0.5, { c2: VIO }); break;
      case 'horizonte': ring(e.p, [0, 1, 0], ORO, 4, 0.6, { th: 0.08 }); sparks(e.p, VIO_L, 8, 8, 0.5); break;
      case 'skill': if (e.id === 'honda') { ring(e.p, [0, 1, 0], VIO, 3, 0.4, { th: 0.1 }); sparks(e.p, ORO, 8, 14, 0.4); } else if (e.id === 'supernova') { ring(e.p, [0, 1, 0], ORO, 16, 0.8, { th: 0.25 }); flash(e.p, 0xffffff, 12, 0.3, { burst: true }); sparks(e.p, ORO, 24, 26, 0.7, { c2: VIO }); } break;
      default: break;
    }
    return false;   // nunca consume el evento: hostfx / sonido siguen su camino
  }
  function update(dt, state) {
    dt = Math.min(dt, 0.1); T += dt; if (!state) return; lastState = state;
    pozosUpdate(dt, state); satsUpdate(dt, state);
  }
  function clear() { for (const it of pool) it.g.visible = false; byId.clear(); phases.clear(); rocks.count = glows.count = 0; for (const o of orbits) o.visible = false; }
  function dispose() { clear(); scene.remove(root); for (const d of disposables) if (d && d.dispose) d.dispose(); }
  function stats() { return { pozos: byId.size, satelites: rocks.count, estado: !!lastState }; }
  return { onEvent, update, clear, dispose, stats };
}
