// Efectos y HUD de los EVENTOS DE OLEADA (la simulación está en src/sim/eventos.js; docs/MUNDO_VIVO.md).
// Mínimos pero claros: un tinte de pantalla por evento, halos sobre las criaturas en la Niebla, círculos en el suelo
// (lluvia / rayos), el pilar de la Aurora y una barra con nombre, qué hacer y tiempo restante. Sólo LEE `state.ev`.
import * as THREE from 'three';
import { EVENTOS } from '../sim/data.js';

const CSS = `
#evfx{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0;transition:opacity .6s}
#evbar{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 112px);transform:translateX(-50%);width:min(440px,72vw);padding:6px 12px 8px;border-radius:12px;background:rgba(10,8,28,.78);border:1px solid var(--ec,#9ab);color:#fff;font:600 13px/1.3 system-ui,sans-serif;text-align:center;pointer-events:none;z-index:3;display:none}
#evbar.on{display:block}
#evbar .n{font-size:15px;letter-spacing:.06em;color:var(--ec,#fff)}
#evbar .t{font-weight:500;opacity:.92;margin-top:2px}
#evbar .b{height:6px;margin-top:6px;border-radius:3px;background:#ffffff26;overflow:hidden}
#evbar .b i{display:block;height:100%;width:100%;background:var(--ec,#fff);transform-origin:left}
#evbar .c{font-size:34px;font-weight:800;line-height:1;color:#fff;text-shadow:0 0 12px var(--ec,#fff)}
@media (max-width:700px){#evbar{top:calc(env(safe-area-inset-top,0px) + 78px);font-size:11px;width:min(380px,66vw)}#evbar .n{font-size:13px}#evbar .c{font-size:26px}}
`;
const TINTE = {
  marea_gravedad: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 38%, rgba(100,110,255,.42) 100%)',
  niebla_almas: 'radial-gradient(ellipse at 50% 50%, rgba(190,235,220,.10) 6%, rgba(170,215,200,.80) 70%)',
  lluvia_astillas: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 50%, rgba(255,120,60,.26) 100%)',
  tormenta_ecos: 'radial-gradient(ellipse at 50% 50%, rgba(10,20,50,.18) 30%, rgba(8,18,60,.55) 100%)',
  eclipse: 'radial-gradient(ellipse at 50% 40%, rgba(40,0,22,.38) 20%, rgba(28,0,12,.80) 100%)',
  marea_sangre: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 42%, rgba(255,30,50,.52) 100%)',
  aurora_bendita: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 50%, rgba(255,210,90,.30) 100%)',
  silencio: 'linear-gradient(rgba(120,130,150,.30), rgba(120,130,150,.30))',
};
const Z = new THREE.Vector3(0, 0, 1), _q = new THREE.Quaternion(), _u = new THREE.Vector3();
const orient = (obj, u) => { _u.set(u[0], u[1], u[2]).normalize(); obj.quaternion.copy(_q.setFromUnitVectors(Z, _u)); };

export class EventosFx {
  constructor(renderer) {
    this.r = renderer; this.root = new THREE.Group(); renderer.scene.add(this.root);
    this.marks = []; this.halos = []; this.zona = null; this.key = ''; this.bar = null; this.t = 0;
    this.ring = new THREE.RingGeometry(0.9, 1, 56); this.disc = new THREE.CircleGeometry(1, 40); this.pil = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
    if (typeof document !== 'undefined') {
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      this.ov = document.createElement('div'); this.ov.id = 'evfx'; const c = document.getElementById('c'); if (c && c.parentNode) c.parentNode.insertBefore(this.ov, c.nextSibling); else document.body.appendChild(this.ov);
    }
  }
  mat(color, op, add = false) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }); }
  markObj() {
    const g = new THREE.Group(), fill = new THREE.Mesh(this.disc, this.mat(0xff8a4a, 0.2)), ring = new THREE.Mesh(this.ring, this.mat(0xffb070, 0.9, true)), beam = new THREE.Mesh(this.pil, this.mat(0xbff6ff, 0, true));
    beam.rotation.x = Math.PI / 2; g.add(fill, ring, beam); g.userData = { fill, ring, beam }; this.root.add(g); return g;
  }
  update(dt, state, me) {
    this.t += dt;
    const ev = state && state.ev;
    this.tinte(ev); this.hud(ev);
    this.marcas(ev); this.zonaFx(ev); this.brillo(ev, state);
  }
  /* ───── tinte de pantalla ───── */
  tinte(ev) {
    if (!this.ov) return;
    const id = ev ? ev.id : '';
    if (id !== this.key) { this.key = id; if (id) { this.ov.style.background = TINTE[id] || ''; this.ov.style.backdropFilter = id === 'silencio' ? 'grayscale(.9)' : ''; } }
    let o = 0;
    if (ev) { o = ev.ph === 'aviso' ? 0.3 + 0.12 * Math.sin(this.t * 6) : Math.min(1, ev.t / 1.2); if (ev.ph === 'activo' && id === 'marea_sangre') o *= 0.75 + 0.25 * Math.sin(this.t * 9); }
    const s = String(Math.max(0, Math.min(1, o)).toFixed(2)); if (s !== this.oS) { this.oS = s; this.ov.style.opacity = s; }
  }
  /* ───── barra: nombre, qué pasa y tiempo ───── */
  hud(ev) {
    if (typeof document === 'undefined') return;
    if (!this.bar) {
      const host = document.getElementById('hud'); if (!host) return;
      const b = document.createElement('div'); b.id = 'evbar'; b.innerHTML = '<div class="n"></div><div class="c"></div><div class="t"></div><div class="b"><i></i></div>'; host.appendChild(b);
      this.bar = { el: b, n: b.querySelector('.n'), c: b.querySelector('.c'), t: b.querySelector('.t'), i: b.querySelector('i'), last: '' };
    }
    const B = this.bar, D = ev && EVENTOS[ev.id];
    if (!D) { if (B.last) { B.el.classList.remove('on'); B.last = ''; } return; }
    const aviso = ev.ph === 'aviso', cuenta = !aviso && ev.cd > 0.05 ? Math.ceil(ev.cd) : 0;
    const nombre = aviso ? `${D.icon} ¡Se acerca: ${D.name}!` : `${D.icon} ${D.name}`;
    const texto = aviso ? D.tele : (cuenta ? '¡Agarrate! La gravedad se invierte en…' : D.contra);
    const k = nombre + '|' + texto + '|' + cuenta;
    if (k !== B.last) { B.last = k; B.el.style.setProperty('--ec', D.color); B.n.textContent = nombre; B.t.textContent = texto; B.c.textContent = cuenta ? String(cuenta) : ''; B.c.style.display = cuenta ? '' : 'none'; B.el.classList.add('on'); }
    B.i.style.transform = `scaleX(${Math.max(0, Math.min(1, ev.d > 0 ? ev.t / ev.d : 0)).toFixed(3)})`;
  }
  /* ───── círculos en el suelo (lluvia de astillas / rayos) ───── */
  marcas(ev) {
    const list = ev && ev.mk ? ev.mk : [];
    while (this.marks.length < Math.min(10, list.length)) this.marks.push(this.markObj());
    for (let i = 0; i < this.marks.length; i++) {
      const g = this.marks[i], m = list[i];
      if (!m) { g.visible = false; continue; }
      const [x, y, z, left, r, kind, ux, uy, uz] = m, rayo = kind === 1, total = rayo ? 2.0 : 1.5, k = 1 - Math.min(1, left / total);
      g.visible = true; g.position.set(x - ux * 0.8, y - uy * 0.8, z - uz * 0.8); orient(g, [ux, uy, uz]); g.scale.setScalar(r);
      const U = g.userData, c = rayo ? 0x7feaff : 0xff8a4a;
      U.fill.material.color.setHex(c); U.ring.material.color.setHex(rayo ? 0xe8ffff : 0xffb070);
      U.fill.material.opacity = 0.12 + 0.5 * k; U.ring.material.opacity = 0.5 + 0.5 * Math.abs(Math.sin(this.t * (6 + 12 * k)));
      U.fill.scale.setScalar(0.15 + 0.85 * k); // el relleno crece hasta tocar el borde: ahí cae
      U.beam.visible = rayo; if (rayo) { U.beam.scale.set(0.12 + 0.12 * k, 40, 0.12 + 0.12 * k); U.beam.position.z = 20; U.beam.material.opacity = 0.05 + 0.55 * k * k; }
    }
  }
  /* ───── zona de la Aurora ───── */
  zonaFx(ev) {
    const z = ev && ev.z ? ev.z : null;
    if (!z) { if (this.zona) this.zona.visible = false; return; }
    if (!this.zona) {
      const g = new THREE.Group(), fill = new THREE.Mesh(this.disc, this.mat(0xffd45a, 0.2, true)), ring = new THREE.Mesh(this.ring, this.mat(0xfff0a8, 0.9, true)), pil = new THREE.Mesh(this.pil, this.mat(0xffe08a, 0.14, true));
      pil.rotation.x = Math.PI / 2; g.add(fill, ring, pil); g.userData = { fill, ring, pil }; this.root.add(g); this.zona = g;
    }
    const [x, y, zz, r, pur, ux, uy, uz] = z, g = this.zona, U = g.userData;
    g.visible = true; g.position.set(x - ux * 0.8, y - uy * 0.8, zz - uz * 0.8); orient(g, [ux, uy, uz]); g.scale.setScalar(r);
    const activa = ev.ph === 'activo';
    U.fill.material.opacity = (activa ? 0.12 + 0.2 * pur : 0.06) + 0.04 * Math.sin(this.t * 3);
    U.ring.material.opacity = activa ? 0.35 + 0.55 * pur : 0.5; U.pil.scale.set(0.8, 8, 0.8); U.pil.position.z = 4; U.pil.material.opacity = (activa ? 0.05 + 0.12 * pur : 0.2);
  }
  /* ───── halos de las criaturas en la Niebla ───── */
  brillo(ev, state) {
    const on = !!(ev && ev.id === 'niebla_almas' && state.monsters);
    const mons = on ? state.monsters : [];
    for (let i = 0; i < Math.min(48, mons.length); i++) {
      if (!this.halos[i]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.r.halo, color: 0xbff8e8, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })); sp.renderOrder = 9; this.root.add(sp); this.halos[i] = sp; }
      const sp = this.halos[i], m = mons[i]; sp.visible = true; sp.position.set(m.p[0], m.p[1], m.p[2]); sp.scale.setScalar(Math.max(3, m.r * 3.6)); sp.material.opacity = 0.55 + 0.25 * Math.sin(this.t * 4 + i);
    }
    for (let i = on ? Math.min(48, mons.length) : 0; i < this.halos.length; i++) this.halos[i].visible = false;
  }
}
