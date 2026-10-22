// Flechas en el borde de la pantalla hacia las criaturas que no se ven (las 6 más cercanas) + aviso de las últimas.
// Así nunca hay que salir a «buscar bichos» por un mapa difícil de entender.
import * as THREE from 'three';
const N = 8;   // 6 cercanas + hasta 2 de margen (al final de la oleada se marcan TODAS las últimas, ≤ 6)
export function createRadar(host) {
  const root = document.createElement('div'); root.id = 'radar'; host.appendChild(root);
  const arrows = []; for (let i = 0; i < N; i++) { const a = document.createElement('div'); a.className = 'rd-arrow'; a.innerHTML = '<i>➤</i><span></span>'; root.appendChild(a); arrows.push(a); }
  const v = new THREE.Vector3(), cam = new THREE.Vector3();
  return {
    /** `falsos`: ecos falsos de la niebla magenta ([x,y,z]…): se dibujan como criaturas más (no existen). */
    update(state, me, camera, falsos = null) {
      if (!state || !me || me.dead || !camera) { for (const a of arrows) a.style.display = 'none'; return; }
      camera.getWorldPosition(cam);
      const ultimas = state.left <= 6 && !state.boss;   // últimas criaturas de la oleada: SIEMPRE marcadas (incluso camufladas), con distancia
      const list = state.monsters.filter((m) => ultimas || !m.c).concat((ultimas ? [] : falsos || []).map((f) => ({ p: f }))).map((m) => ({ m, d: Math.hypot(m.p[0] - me.pos[0], m.p[1] - me.pos[1], m.p[2] - me.pos[2]) })).sort((a, b) => a.d - b.d);
      let k = 0; const W = innerWidth, H = innerHeight, few = ultimas || list.length <= 4;
      for (const { m, d } of list) {
        if (k >= N) break;
        v.set(m.p[0], m.p[1], m.p[2]).project(camera);
        const behind = v.z > 1, on = !behind && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.88;
        if (on && !few) continue;   // las que se ven no necesitan flecha (salvo las últimas: siempre marcadas)
        let x = v.x, y = v.y; if (behind) { x = -x; y = -y; }
        if (on) { const a = arrows[k++]; a.style.display = ''; a.classList.add('in'); a.classList.toggle('ult', ultimas); a.classList.toggle('ac', !!m.ac); a.style.transform = `translate(${(x * 0.5 + 0.5) * W}px, ${(-y * 0.5 + 0.5) * H - 34}px)`; a.querySelector('i').style.transform = 'rotate(90deg)'; a.querySelector('span').textContent = `${Math.round(d)} m`; continue; }
        const ang = Math.atan2(y, x), s = Math.min(0.9 / Math.abs(Math.cos(ang) || 1e-6), 0.82 / Math.abs(Math.sin(ang) || 1e-6));
        const px = (Math.cos(ang) * s * 0.5 + 0.5) * W, py = (-Math.sin(ang) * s * 0.5 + 0.5) * H;
        const a = arrows[k++]; a.style.display = ''; a.classList.remove('in'); a.classList.toggle('ult', ultimas); a.classList.toggle('ac', !!m.ac); a.style.transform = `translate(${px}px, ${py}px)`; a.querySelector('i').style.transform = `rotate(${-ang}rad)`; a.querySelector('span').textContent = `${Math.round(d)} m`;
      }
      for (; k < N; k++) arrows[k].style.display = 'none';
    },
  };
}
