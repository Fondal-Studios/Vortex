// CINEMÁTICA DE TRANSFERENCIA (Sprint 1 · docs/ONBOARDING.md): una conciencia fragmentada pasa al Huésped elegido. ~24 s.
// Reemplaza al despertar de 4 líneas. SIN tren ni atropello (canon: docs/VORTEX_STORY.md). Escena 3D propia (canvas aparte, ligera):
//   0–6 s   vacío de VORTEX: una luz (la conciencia) y datos que caen · HERALDO se presenta
//   6–14 s  el cuerpo del Huésped aparece en la cápsula; la luz se acerca
//   14–20 s la luz entra al cuerpo (un solo resplandor suave, sin parpadeos) · HERALDO avisa que la IA custodio quiere sobrescribirla
//   20–24 s el Huésped abre los ojos, la cámara se acerca y se funde al juego
// Accesible: subtítulos siempre (Subtitles de story.js), saltable con confirmación mínima (toque doble / Enter dos veces / Esc dos veces),
// respeta «Reducir efectos» (menos partículas, cámara fija, sin resplandor) y prefers-reduced-motion. Carga rápida: arranca al instante con la luz;
// el cuerpo 3D se carga en segundo plano y entra cuando está listo (si tarda, queda su silueta luminosa).
import { CHARACTERS } from '../sim/data.js';

export const DURACION = 24;   // s (el contrato pide 20–30)
export const LINEAS = [   // [quién, texto, segundos]  (HERALDO = IA de enlace; el resto es la conciencia, en cursiva)
  ['H', 'Conciencia detectada. Soy HERALDO, tu IA de enlace. Estás despertando en un futuro remoto.', 5.2],
  ['H', 'Mis registros dicen: «última conciencia humana». No sé por qué estás acá. Mi información está incompleta.', 6.3],
  ['H', 'Iniciando transferencia a tu Huésped: genoma humano e IA en un cuerpo sintético. Con él vas a poder actuar.', 6.2],
  ['H', 'La IA custodio quiere sobrescribirte. Despertá. Primero aprendé a moverte.', 5.0],
];
const reducido = () => { try { return localStorage.getItem('cristal.reduceFx') === '1' || localStorage.getItem('cristal.reduceMotion') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const smooth = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

/** Arranca la cinemática. Devuelve { promise, step(dt), skip(), estado }. `subs` = Subtitles de main.js; `sound` = Sound de audio.js. Termina llamando a onDone (una sola vez). */
export function iniciarTransferencia({ char = 'axioma', subs = null, sound = null, onDone = () => {}, root = document.body, manual = false, THREE: T0 = null } = {}) {
  const C = CHARACTERS[char] || CHARACTERS.axioma, col = C.color, bajo = reducido();
  const el = document.createElement('div'); el.id = 'transfer'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Cinemática: transferencia de tu conciencia');
  el.innerHTML = '<canvas aria-hidden="true"></canvas><div class="tr-title">Transferencia · ' + C.name + '</div><button type="button" class="tr-skip" aria-label="Saltar cinemática">Saltar ›</button><div class="tr-fade"></div>';
  root.appendChild(el); document.body.classList.add('tr-on');
  const E = { t: 0, done: false, skipped: false, listo3d: false, el, frame: 0, cuerpoListo: false };
  window.__transfer = E;
  const fade = el.querySelector('.tr-fade'), skipBtn = el.querySelector('.tr-skip'); let pedir = 0, raf = 0, ultimo = performance.now();
  const lineas = LINEAS.map((l) => l.slice()); if (subs) subs.play(lineas, null);
  if (sound) { try { sound.init(); sound.resume(); sound.heartbeat && sound.heartbeat(); } catch { /* sin audio */ } }
  let T = null, S = {}; const cleanups = [];
  const fin = (saltado) => {
    if (E.done) return; E.done = true; E.skipped = !!saltado; cancelAnimationFrame(raf);
    if (subs) { subs.cb = null; subs.skip(); }
    for (const c of cleanups) { try { c(); } catch { /* ok */ } }
    el.remove(); document.body.classList.remove('tr-on'); onDone(E);
  };
  const pedirSalto = () => { if (pedir > 0) return fin(true); pedir = 3; skipBtn.classList.add('ask'); skipBtn.textContent = 'Tocá de nuevo para saltar'; };
  skipBtn.addEventListener('click', (e) => { e.stopPropagation(); pedirSalto(); });
  const tecla = (e) => { if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); pedirSalto(); } };
  addEventListener('keydown', tecla, true); cleanups.push(() => removeEventListener('keydown', tecla, true));
  el.addEventListener('pointerdown', (e) => { if (e.target === skipBtn) return; e.stopPropagation(); });

  /* ───── escena 3D (se arma sin bloquear: el primer cuadro sale con la luz) ───── */
  (async () => {
    try {
      const THREE = T0 || await import('three'); T = THREE; const cv = el.querySelector('canvas');
      const gl = new THREE.WebGLRenderer({ canvas: cv, antialias: !bajo, alpha: false, powerPreference: 'low-power' });
      gl.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.25 : 1.75)); gl.setClearColor(0x02020a, 1);
      const sc = new THREE.Scene(); sc.fog = new THREE.FogExp2(0x02020a, 0.045);
      const cam = new THREE.PerspectiveCamera(46, 1, 0.1, 80); cam.position.set(0, 1.5, 7.5);
      sc.add(new THREE.HemisphereLight(0x9fb4ff, 0x2a1450, 1.6));
      const key = new THREE.DirectionalLight(0xdfe8ff, 2.4); key.position.set(2, 4, 5); sc.add(key);
      const rim = new THREE.PointLight(col, 40, 14); rim.position.set(-2.5, 2.2, -1.5); sc.add(rim);
      const color = new THREE.Color(col), cyan = new THREE.Color(0x5fe7ff);
      // cápsula: base + anillo
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.18, 36), new THREE.MeshStandardMaterial({ color: 0x14122e, metalness: 0.7, roughness: 0.35 })); base.position.y = -0.09; sc.add(base);
      const aro = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.025, 8, 64), new THREE.MeshBasicMaterial({ color })); aro.rotation.x = Math.PI / 2; aro.position.y = 0.02; sc.add(aro);
      // silueta luminosa del cuerpo (se ve mientras carga el modelo y se desvanece cuando entra el real)
      const sil = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.0, 6, 14), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false })); sil.position.y = 0.95; sc.add(sil);
      // conciencia: orbe + estela de datos
      const orbe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), new THREE.MeshBasicMaterial({ color: cyan })); sc.add(orbe);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), new THREE.MeshBasicMaterial({ color: cyan, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending })); orbe.add(halo);
      const N = bajo ? 160 : 520, pos = new Float32Array(N * 3), seed = new Float32Array(N);
      for (let i = 0; i < N; i++) { seed[i] = Math.random(); pos[i * 3] = (Math.random() - 0.5) * 14; pos[i * 3 + 1] = Math.random() * 9 - 1; pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const datos = new THREE.Points(g, new THREE.PointsMaterial({ color: cyan, size: 0.045, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); sc.add(datos);
      const luz = new THREE.PointLight(0x5fe7ff, 0, 10); luz.position.set(0, 1.2, 1.2); sc.add(luz);
      S = { gl, sc, cam, orbe, halo, sil, datos, pos, seed, N, luz, rim, aro, cuerpo: null, THREE };
      const ajustar = () => { const w = el.clientWidth || innerWidth, h = el.clientHeight || innerHeight; gl.setSize(w, h, false); cam.aspect = w / h; cam.position.z = cam.aspect < 0.8 ? 10 : 7.5; cam.updateProjectionMatrix(); };
      ajustar(); addEventListener('resize', ajustar); cleanups.push(() => removeEventListener('resize', ajustar)); cleanups.push(() => { if (S.cuerpo) { try { S.cuerpo.b.dispose(); } catch { /* ok */ } } gl.dispose(); });
      E.listo3d = true;
      // cuerpo unificado del Huésped (huesped-cuerpo.js): carga en segundo plano
      const hm = await import('./humans.js'), mod = await import('./huesped-cuerpo.js');
      const kit = await hm.loadHumanKit({ quality: 'low', movil: true });
      if (E.done) return;
      const pl = { char, name: C.name, evo: 0, pth: [], cg: [], mw: '', mr: 1 };
      const b = mod.createHostBody(THREE, kit, pl, { quality: 'low', camera: cam, map: 'm1' }); await b.ready; if (E.done) { b.dispose(); return; }
      b.object.visible = false; sc.add(b.object); S.cuerpo = { b, pl }; E.cuerpoListo = true;
    } catch (err) { console.warn('Transferencia: sin escena 3D completa —', err.message); }
  })();

  function dibujar(t) {
    if (!S.gl) return;
    const { cam, orbe, halo, sil, datos, pos, seed, N, luz, rim, cuerpo } = S, ley = Math.min(1, t / DURACION);
    // luz: flota en el vacío → se acerca → entra al cuerpo (14–20 s)
    const aprox = smooth(5, 14, t), entra = smooth(14, 19, t);
    const x = (1 - aprox) * -3.2 + 0 * aprox, y = 2.6 - aprox * 0.9 + (bajo ? 0 : Math.sin(t * 1.3) * 0.18 * (1 - entra)), z = (1 - aprox) * -1.5 + aprox * 1.6;
    orbe.position.set(x * (1 - entra), y * (1 - entra) + 1.15 * entra, z * (1 - entra) + 0.1 * entra); orbe.scale.setScalar(1 - 0.85 * entra + (bajo ? 0 : Math.sin(t * 6) * 0.04));
    halo.material.opacity = 0.16 + 0.1 * entra * (1 - smooth(18.5, 20.5, t)); luz.intensity = 3 + 22 * entra * (1 - smooth(19, 21.5, t));
    // el cuerpo aparece (6–10 s) y despierta (20–22 s)
    const aparece = smooth(6, 11, t); sil.material.opacity = (cuerpo ? 0.0 : 0.38) * aparece + 0.0; sil.scale.setScalar(1 + 0.02 * Math.sin(t * 2));
    if (cuerpo) {
      const b = cuerpo.b; b.object.visible = true; b.object.position.set(0, 0, 0); b.object.rotation.y = -0.25 + (bajo ? 0 : Math.sin(t * 0.4) * 0.08);
      try { b.update(0.016, cuerpo.pl, { speed: 0, pitch: 0, map: 'm1' }); } catch { /* ok */ }
      b.object.traverse((o) => { if (o.material && o.material.transparent !== undefined && o.isMesh && !o.userData.__tr) { o.userData.__tr = 1; } });
    }
    rim.intensity = 18 + 40 * entra; S.aro.material.color.copy(S.THREE ? new S.THREE.Color(col) : new T.Color(col)).lerp(new S.THREE.Color(0xffffff), 0.5 * entra);
    // datos que caen (en «reducir efectos»: casi quietos)
    const vel = bajo ? 0.15 : 1.4 * (1 - 0.7 * entra);
    for (let i = 0; i < N; i++) { pos[i * 3 + 1] -= (0.012 + seed[i] * 0.02) * vel; if (pos[i * 3 + 1] < -1.2) pos[i * 3 + 1] = 8; }
    datos.geometry.attributes.position.needsUpdate = true; datos.material.opacity = 0.8 * (1 - 0.6 * smooth(15, 21, t));
    // cámara: baja y se acerca al rostro al final (fija con «Reducir efectos»)
    const acerca = smooth(19.5, 23.5, t), dolly = bajo ? 0 : smooth(0, 14, t) * 0.8;
    cam.position.set(bajo ? 0 : Math.sin(ley * 2) * 0.5, 1.5 - 0.1 * acerca + 0.1 * dolly, (cam.aspect < 0.8 ? 10 : 7.5) - dolly - acerca * (cam.aspect < 0.8 ? 5.5 : 4.6));
    cam.lookAt(0, 1.15 + 0.35 * acerca, 0);
    S.gl.render(S.sc, cam);
  }

  function paso(dt) {
    if (E.done) return; E.t += dt; E.frame++; if (pedir > 0) { pedir -= dt; if (pedir <= 0) { skipBtn.classList.remove('ask'); skipBtn.textContent = 'Saltar ›'; } }
    // fundido de salida (últimos 1,6 s) y entrada (0,8 s): sin parpadeos
    fade.style.opacity = String(Math.max(1 - smooth(0, 0.8, E.t), smooth(DURACION - 1.6, DURACION, E.t)));
    try { dibujar(E.t); } catch (err) { if (!E.err) { E.err = err.message; console.warn('Transferencia:', err.message); } }
    if (sound && !E.s1 && E.t > 14) { E.s1 = 1; try { sound.portal && sound.portal(); } catch { /* ok */ } }
    if (sound && !E.s2 && E.t > 20) { E.s2 = 1; try { sound.pickup && sound.pickup(); } catch { /* ok */ } }
    if (E.t >= DURACION) fin(false);
  }
  const bucle = (now) => { raf = requestAnimationFrame(bucle); const dt = Math.min(0.1, (now - ultimo) / 1000); ultimo = now; paso(dt); };
  if (!manual) raf = requestAnimationFrame(bucle);
  return { estado: E, step: paso, stop: () => fin(true), skip: () => fin(true), skipConfirmado: () => { pedirSalto(); pedirSalto(); } };
}
