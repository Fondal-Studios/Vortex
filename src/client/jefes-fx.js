// JEFES (cliente): dibuja lo que la simulación decide en src/sim/jefe-mec.js y src/sim/jefe-ia.js (docs/JEFES.md → «Cliente»).
//  · MARCAS DE TELEGRAFÍA en el suelo (snapshot boss.mc.tg): aros que se llenan hasta que cae el golpe, líneas de picada, haces giratorios, refugio del
//    «reparto». TRES InstancedMesh (aro, disco, barra) + una esfera de escudo + un halo del núcleo = 6 llamadas de dibujo y ≈ 2 200 triángulos como MÁXIMO,
//    con cualquier cantidad de marcas (presupuesto: Baja ≤ 16 llamadas y ≤ 6 000 triángulos de efectos de jefe; tests/jefes-render.test.js).
//  · BARRA DEL JEFE: nombre, fases (muescas al 75/50/25 %), POSTURA actual (icono + texto corto + fuerza), el estilo que «lee» de vos y avisos de ventana.
//  · BANNERS de fase / adaptación / momento único, consejos de contrajuego y sonidos mínimos (audio.js → jefe()).
//  · Cámara cinematográfica breve en la presentación de cada jefe (barras de cine + título). Se apaga con «Reducir efectos» (la cámara; el título queda).
// Todo es visual: no toca el estado del juego ni g.rng.
import * as THREE from 'three';
import { JEFES, POSTURAS, ESTILOS, REPERTORIO, COLOR_MARCA, FASE_UMBRALES } from '../sim/jefe-data.js';
import { settings } from './settings.js';

const MAXM = 16;
const Z = new THREE.Vector3(0, 0, 1), UPY = new THREE.Vector3(0, 1, 0);
export const CONSEJO = {
  nova: 'Alejate del círculo del jefe', zonas: 'Salí de las marcas del suelo', barrido: 'Saltá el haz o cubrite detrás de algo', carga: 'Corré al costado de la línea roja',
  reflejo: 'Se cubre de tus disparos: usá el puño o una habilidad', espinas: 'Coraza de espinas: no lo golpees de cerca', silencio: 'Salí del aro violeta: te silencia',
  voladores: 'Vienen almas voladoras', reparto: '¡Todos al círculo amarillo!', arena: 'El campo responde: cuidado con los órganos y la niebla', trampas: 'Mirá dónde pisás',
  descenso: '¡Va a caer! Saltá la onda y después pegale al núcleo', parto: 'Rompé los huevos antes de que nazcan', raices: 'Salí del círculo: te atrapa',
  mirada_total: 'Cubrite detrás de un muro', floracion: 'Rompé los ojos que brotan', campanadas: 'Seguí el reloj y esquivá las marcas', procesion: 'Salí de la fila de marcas',
};
const NOMBRE = { descenso: 'CAÍDA', nova: 'ONDA', zonas: 'ZONAS', barrido: 'ASPAS', carga: 'PICADA', reflejo: 'REFLEJOS', espinas: 'ESPINAS', silencio: 'SILENCIO', voladores: 'VUELO', reparto: 'JUNTOS',
  arena: 'EL CAMPO', trampas: 'TRAMPAS', parto: 'EL PARTO', raices: 'RAÍCES', mirada_total: 'MIRADA TOTAL', floracion: 'FLORACIÓN', campanadas: 'CAMPANADAS', procesion: 'PROCESIÓN' };
const hex = (n) => new THREE.Color(n);
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

const CSS = `
body.jf #bossmech{top:168px}
@media (pointer: coarse){body.jf #bossmech{top:104px}}
#jfboss{margin-top:5px;display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;font-size:12px;letter-spacing:.04em}
#bossbar>div{position:relative}
#bossbar .jftk{position:absolute;top:-2px;bottom:-2px;width:2px;background:#fff;opacity:.85;box-shadow:0 0 4px #000}
#jfph{font-weight:700;opacity:.95}
#jfpos{display:inline-flex;align-items:center;gap:7px;padding:3px 10px;border-radius:10px;background:rgba(14,6,26,.72);border:1px solid var(--pc,#ffffff66);color:var(--pc,#fff);transition:border-color .3s,color .3s}
#jfpos .ic{font-size:15px;line-height:1}
#jfpos .lv{display:inline-block;width:38px;height:4px;border-radius:2px;background:#ffffff26;overflow:hidden}
#jfpos .lv i{display:block;height:100%;background:var(--pc,#fff);width:0%;transition:width .3s}
#jfpos.nuevo{animation:jfpulse .9s ease-out 2}
@keyframes jfpulse{0%{transform:scale(1.25);box-shadow:0 0 18px var(--pc,#fff)}100%{transform:scale(1);box-shadow:none}}
#jfread{opacity:.8;font-size:11px}
#jfwin{font-weight:800;color:#ffe14a;text-shadow:0 0 8px #ff9a2a}
#jfwin.enr{color:#ff5a5a;text-shadow:0 0 8px #f00}
#jfcine{position:fixed;inset:0;z-index:30;pointer-events:none;opacity:0}
#jfcine i{position:absolute;left:0;right:0;height:0;background:#000;transition:height .5s ease-out}
#jfcine i:first-child{top:0}#jfcine i:last-child{bottom:0}
#jfcine.on{opacity:1}#jfcine.on i{height:9vh}
#jfcine b{position:absolute;left:0;right:0;bottom:14vh;text-align:center;font-size:clamp(20px,5vw,44px);letter-spacing:.14em;color:#fff;text-shadow:0 0 18px var(--jc,#f80);opacity:0;transition:opacity .6s}
#jfcine b em{display:block;font-style:normal;font-size:.38em;letter-spacing:.2em;opacity:.8;margin-top:6px}
#jfcine.on b{opacity:1}
#jfdark{position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;transition:opacity .8s;background:radial-gradient(ellipse at 50% 50%,rgba(30,0,40,0) 25%,rgba(10,0,20,.72) 100%)}
#jfdark.on{opacity:1}
@media (max-width:700px){#jfboss{font-size:10px}#jfpos .lv{width:26px}#jfcine b{bottom:12vh}}
`;

export class JefesFx {
  constructor(renderer) {
    this.r = renderer; this.t = 0; this.cine = null; this.boss = null; this.postura = ''; this.fase = 0; this.mapId = '';
    this.root = new THREE.Group(); this.root.name = 'jefes-fx'; renderer.scene.add(this.root);
    const mat = (op) => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const inst = (geo, op, name, ro) => { const m = new THREE.InstancedMesh(geo, mat(op), MAXM); m.count = 0; m.frustumCulled = false; m.renderOrder = ro; m.name = name; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, hex(0xffffff)); this.root.add(m); return m; };
    this.ring = inst(new THREE.RingGeometry(0.92, 1, 48), 0.95, 'jefe-aro', 8);        // 96 triángulos por marca
    this.disc = inst(new THREE.CircleGeometry(1, 28), 0.5, 'jefe-disco', 7);           // 28
    this.bar = inst(new THREE.PlaneGeometry(1, 1), 0.55, 'jefe-barra', 7);             // 2
    this.shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x6ad8ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide }));
    this.shield.visible = false; this.shield.name = 'jefe-escudo'; this.shield.renderOrder = 9; this.root.add(this.shield);           // 80
    const halo = renderer.halo || null;
    this.core = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xffd060, transparent: true, opacity: 0, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending }));
    this.core.visible = false; this.core.name = 'jefe-nucleo'; this.core.renderOrder = 10; this.root.add(this.core);                  // 2
    this.q = new THREE.Quaternion(); this.m4 = new THREE.Matrix4(); this.v = new THREE.Vector3(); this.v2 = new THREE.Vector3(); this.s = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0); this.col = new THREE.Color();
    if (typeof document !== 'undefined') {
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      this.dark = document.createElement('div'); this.dark.id = 'jfdark'; document.body.appendChild(this.dark);
      this.cineEl = document.createElement('div'); this.cineEl.id = 'jfcine'; this.cineEl.innerHTML = '<i></i><b></b><i></i>'; document.body.appendChild(this.cineEl);
    }
  }
  get reducido() { return !!settings().reducirGravedad || lsGet('cristal.reduceFx') === '1'; }

  /* ───────── marcas de suelo ───────── */
  update(dt, state, me) {
    this.t += dt;
    const b = state && state.boss, mc = b && b.mc; this.boss = b || null; this.mapId = state ? state.map : '';
    const bm = b && state.monsters.find((m) => m.k === 'coloso' || m.k === 'madre' || m.k === 'argos'); this.bm = bm || null;
    this.hud(b, state);
    if (!mc) { this.ring.count = this.disc.count = this.bar.count = 0; this.shield.visible = false; this.core.visible = false; if (this.dark) this.dark.classList.remove('on'); return; }
    const esfera = state.map === 'm2'; let nr = 0, nd = 0, nb = 0;
    const R = this.ring, D = this.disc, B = this.bar;
    for (const k of mc.tg) {
      const [tipo, x, y, z, r, t, T, ci, ex] = k;
      if (tipo === 'o') continue;                                   // el escudo se dibuja aparte
      const prog = T > 0 ? Math.max(0, Math.min(1, 1 - t / T)) : 1, col = COLOR_MARCA[ci % COLOR_MARCA.length], pul = 0.7 + 0.3 * Math.sin(this.t * (6 + 10 * prog));
      this.up.set(0, 1, 0); if (esfera) { this.up.set(x, y, z).multiplyScalar(-1).normalize(); }
      if (tipo === 'c' || tipo === 'h') {
        if (nr >= MAXM) continue;
        this.q.setFromUnitVectors(Z, this.up); this.v.set(x, y, z).addScaledVector(this.up, 0.12);
        const persistente = tipo === 'h';
        this.s.set(r, r, 1); this.m4.compose(this.v, this.q, this.s); R.setMatrixAt(nr, this.m4); R.setColorAt(nr, this.col.copy(hex(col)).multiplyScalar(persistente ? 0.7 : pul)); nr++;
        const f = Math.max(0.02, persistente ? 1 : prog), rr = r * f; this.s.set(rr, rr, 1); this.m4.compose(this.v, this.q, this.s); D.setMatrixAt(nd, this.m4); D.setColorAt(nd, this.col.copy(hex(col)).multiplyScalar(persistente ? 0.25 : 0.35 + 0.55 * prog)); nd++;
      } else if (tipo === 'l' && Array.isArray(ex)) {
        if (nb >= MAXM) continue;
        this.v.set(x, y, z); this.v2.set(ex[0], ex[1], ex[2]); const L = this.v.distanceTo(this.v2); if (L < 0.5) continue;
        const dir = this.v2.clone().sub(this.v).normalize(), side = new THREE.Vector3().crossVectors(this.up, dir).normalize();
        this.m4.makeBasis(dir, side, this.up); this.q.setFromRotationMatrix(this.m4); const mid = this.v.clone().add(this.v2).multiplyScalar(0.5).addScaledVector(this.up, 0.14);
        this.s.set(L, r * 2, 1); this.m4.compose(mid, this.q, this.s); B.setMatrixAt(nb, this.m4); B.setColorAt(nb, this.col.copy(hex(col)).multiplyScalar(0.25 + 0.6 * prog)); nb++;
      } else if (tipo === 'b' && Array.isArray(ex)) {
        const [ang, n, w, fino] = ex, ancho = fino ? 0.5 : 3.4;
        for (let i = 0; i < n && nb < MAXM; i++) {
          const a = ang + (i * Math.PI * 2) / n, dir = this.v2.set(Math.cos(a), 0, Math.sin(a));
          this.v.set(x, y, z); const side = new THREE.Vector3().crossVectors(this.up, dir).normalize(); this.m4.makeBasis(dir.clone(), side, this.up); this.q.setFromRotationMatrix(this.m4);
          const mid = this.v.clone().addScaledVector(dir, r / 2).addScaledVector(this.up, 0.14); this.s.set(r, ancho, 1); this.m4.compose(mid, this.q, this.s);
          B.setMatrixAt(nb, this.m4); B.setColorAt(nb, this.col.copy(hex(col)).multiplyScalar(w ? 0.85 : 0.3 + 0.4 * prog)); nb++;
        }
      }
    }
    for (const [M, n] of [[R, nr], [D, nd], [B, nb]]) { M.count = n; M.instanceMatrix.needsUpdate = true; if (M.instanceColor) M.instanceColor.needsUpdate = true; }
    // escudo (reflejo / espinas) y aviso de que se prepara
    const prep = mc.tg.some((k) => k[0] === 'o');
    if (bm && (mc.rf > 0 || mc.sp > 0 || prep)) {
      this.shield.visible = true; this.shield.position.set(bm.p[0], bm.p[1], bm.p[2]); const s0 = bm.r * 1.4 + 3; this.shield.scale.setScalar(s0 * (1 + 0.03 * Math.sin(this.t * 9)));
      this.shield.material.color.setHex(mc.sp > 0 ? 0xff6a3a : 0x6ad8ff); this.shield.material.opacity = prep ? 0.1 + 0.12 * Math.abs(Math.sin(this.t * 12)) : 0.24;
    } else this.shield.visible = false;
    // núcleo expuesto / ventana de vulnerabilidad
    if (bm && (mc.nu > 0 || mc.bj > 0)) { this.core.visible = true; this.core.position.set(bm.p[0], bm.p[1], bm.p[2]); this.core.scale.setScalar((bm.r * 2.0) * (1 + 0.08 * Math.sin(this.t * 7))); this.core.material.opacity = mc.nu > 0 ? 0.5 : 0.28; this.core.material.color.setHex(mc.nu > 0 ? 0xffd060 : 0xff9a5a); }
    else this.core.visible = false;
    if (this.dark) this.dark.classList.toggle('on', mc.dk > 0 && !this.reducido);
  }

  /* ───────── barra del jefe: fases, postura, ventana ───────── */
  hud(b, state) {
    if (typeof document === 'undefined') return;
    const bar = document.getElementById('bossbar'); if (!bar) return;
    if (!this.boxEl) {
      const bx = document.createElement('div'); bx.id = 'jfboss';
      bx.innerHTML = '<div id="jfph"></div><div id="jfpos"><span class="ic"></span><span class="tx"></span><span class="lv"><i></i></span></div><div id="jfread"></div><div id="jfwin"></div>';
      document.body.classList.add('jf'); bar.appendChild(bx); this.boxEl = bx; this.phEl = bx.querySelector('#jfph'); this.posEl = bx.querySelector('#jfpos'); this.readEl = bx.querySelector('#jfread'); this.winEl = bx.querySelector('#jfwin');
      const fill = bar.querySelector('div'); if (fill) for (const f of FASE_UMBRALES) { const tk = document.createElement('i'); tk.className = 'jftk'; tk.style.left = `${f * 100}%`; fill.appendChild(tk); }
    }
    if (!b || !b.mc) { this.boxEl.style.display = 'none'; return; }
    this.boxEl.style.display = '';
    const J = JEFES[b.mc.mj] || JEFES.m1, ia = b.ia || {}, P = POSTURAS[ia.st] || POSTURAS.neutro;
    const nm = document.getElementById('bossname'); if (nm) nm.textContent = J.nombre;
    this.phEl.textContent = `FASE ${b.mc.f}/4 · ${J.fases[b.mc.f - 1]}`;
    this.posEl.style.setProperty('--pc', ia.st === 'neutro' || !ia.st ? '#9aa4c8' : ia.st === 'antimele' ? '#ff7a4a' : ia.st === 'antidist' ? '#6ad8ff' : ia.st === 'antihab' ? '#b98cff' : '#ffd23f');
    this.posEl.querySelector('.ic').textContent = P.icono; this.posEl.querySelector('.tx').textContent = P.corto;
    this.posEl.querySelector('.lv i').style.width = `${Math.round((ia.lv || 0) * 100)}%`;
    if (ia.st !== this.postura) { this.postura = ia.st; this.posEl.classList.remove('nuevo'); void this.posEl.offsetWidth; this.posEl.classList.add('nuevo'); }
    const E = ESTILOS[ia.es] || ESTILOS.mixed;
    this.readEl.textContent = ia.lg > 0 || ia.ds > 0 ? 'Desconcertado: tarda en readaptarse' : `Te lee: ${E.icono} ${E.nombre}`;
    let w = '';
    if (ia.en > 0) w = '¡ENFURECIDO!'; else if (b.mc.nu > 0) w = `NÚCLEO EXPUESTO ${Math.ceil(b.mc.nu)} s`; else if (b.mc.bj > 0) w = `EXPUESTO ${Math.ceil(b.mc.bj)} s · ¡daño ×${b.mc.vl}!`; else if (b.mc.rf > 0) w = 'REFLEJA TUS DISPAROS'; else if (b.mc.sp > 0) w = 'COSTRA DE ESPINAS';
    this.winEl.textContent = w; this.winEl.classList.toggle('enr', ia.en > 0);
    void state;
  }
  /** Mensaje del panel de mecánica: ataque que se está preparando + consejo; si no hay, devuelve `base`. */
  mech(b, base) {
    const mc = b && b.mc; if (!mc) return base;
    if (mc.ac && CONSEJO[mc.ac]) {
      const k = mc.tg.filter((t) => t[0] !== 'h').reduce((a, t) => (t[5] > 0 && (a === 0 || t[5] < a) ? t[5] : a), 0);   // lo que falta para el primer golpe
      return `${NOMBRE[mc.ac] || mc.ac.toUpperCase()}${k > 0 ? ` en ${Math.max(0.1, k).toFixed(1)} s` : ''} · ${CONSEJO[mc.ac]}`;
    }
    if (mc.nu > 0) return `NÚCLEO EXPUESTO ${Math.ceil(mc.nu)} s · ¡pegale con todo!`;
    if (mc.br > 0) return `${mc.br} OJOS BROTADOS · rompelos antes de que revienten`;
    if (mc.cr > 0) return `${mc.cr} HUEVOS de la Madre · rompelos todos`;
    return base;
  }

  /* ───────── eventos: banners, sonidos, cine ───────── */
  event(e, c) {
    const J = (this.boss && JEFES[this.boss.mc && this.boss.mc.mj]) || JEFES[this.mapId] || JEFES.m1, nom = J.nombre, s = c.sound;
    switch (e.t) {
      case 'phase':
        if (e.n === 1) this.empezarCine(J);
        else { c.banner(`FASE ${e.n}/4 · ${e.nm || ''}`, 2400); c.flash(); }
        s.jefe('fase', null); break;
      case 'jia':
        if (e.k === 'adapt') { const P = POSTURAS[e.st]; if (P) { c.banner(P.aviso.replace('{jefe}', nom), 3600); s.jefe('adapt', null); } }
        else if (e.k === 'desc') { c.banner(`¡Lo desconcertaste! ${nom} tarda en readaptarse`, 2800); s.jefe('desc', null); }
        else if (e.k === 'enr') { c.banner(`¡${nom.toUpperCase()} ENFURECIDO! Cada vez golpea más fuerte`, 3200); s.jefe('enrage', null); c.flash(); }
        else if (e.k === 'unico') { c.banner(`${e.nm} · ${e.tx}`, 4200); s.jefe('unico', null); c.flash(); }
        else if (e.k === 'recuerda') c.banner(`${nom} recuerda cómo peleaste la vez anterior`, 3000);
        else if (e.k === 'silencio' && e.pid === c.pid) { c.banner('¡SILENCIADO! Sin habilidades unos segundos', 1800); s.jefe('silencio', null); }
        break;
      case 'jatk': {
        const k = e.k, at = e.p || null;
        if (k === 'tel') s.jefe('tel', null);
        else if (k === 'impacto') { s.jefe('impacto', at); this.r.shake = Math.max(this.r.shake || 0, this.reducido ? 0.2 : 1); }
        else if (k === 'nova' || k === 'zona' || k === 'raiz' || k === 'reparto') s.jefe('golpe', at);
        else if (k === 'campana') s.jefe('campana', at);
        else if (k === 'mirada' || k === 'barrido' || k === 'carga' || k === 'caida') s.jefe('barrido', at);
        else if (k === 'devuelve' || k === 'espina') s.jefe('rebote', at);
        else if (k === 'reflejo' || k === 'espinas') s.jefe('escudo', at);
        else if (k === 'silencio') s.jefe('silencio', at);
        else if (k === 'cansado' || k === 'cria_rota') { c.banner('¡Quedó expuesto! Pegale ahora', 1600); s.jefe('unico', null); }
        break; }
      default: break;
    }
  }
  empezarCine(J) {
    if (!this.cineEl) return;
    this.cineEl.style.setProperty('--jc', J.color); this.cineEl.querySelector('b').innerHTML = `${J.nombre.toUpperCase()}<em>${J.desc}</em>`;
    this.cineEl.classList.add('on'); this.cine = { t: 0, T: this.reducido ? 2.4 : 3.8 };
  }
  /** Se llama DESPUÉS de colocar la cámara del jugador: durante la presentación la gira hacia el jefe y la sube un poco (la mira real no cambia). */
  postCamera(dt) {
    const c = this.cine; if (!c) return;
    c.t += dt; const k = Math.min(1, c.t / c.T);
    if (c.t >= c.T) { this.cine = null; if (this.cineEl) this.cineEl.classList.remove('on'); return; }
    if (this.reducido || !this.bm) return;
    const cam = this.r.camera, bell = Math.sin(Math.PI * k) ** 2, to = new THREE.Vector3(this.bm.p[0], this.bm.p[1], this.bm.p[2]);
    const m = new THREE.Matrix4().lookAt(cam.position, to, cam.up), qt = new THREE.Quaternion().setFromRotationMatrix(m);
    cam.quaternion.slerp(qt, bell * 0.82); cam.position.addScaledVector(cam.up, 1.4 * bell);
  }
  dispose() { this.root.removeFromParent(); }
}
export { REPERTORIO };
