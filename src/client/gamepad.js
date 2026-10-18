// Soporte de mando (DualSense / Xbox, mapeo estándar): menús y juego.
// Juego: LB hab.1 · RB hab.2 · cruceta ↑ hab.3 · cruceta ↓ definitiva · B/○ melee · A/✕ salto · RT dispara · LT apunta · X/□ recargar · Y/△ usar
//  · Select/Back = cambiar de modo Disparo ↔ Melé · Select + LB = habilidad de equipo. En Melé: RT ataque 1 · B o LT ataque 2 (docs/CONTROLES.md).
const DZ = 0.16;
const dz = (v) => (Math.abs(v) < DZ ? 0 : (v - Math.sign(v) * DZ) / (1 - DZ));

export class Pad {
  constructor() { this.prev = {}; this.connected = false; this.repeat = {}; addEventListener('gamepadconnected', () => { this.connected = true; }); addEventListener('gamepaddisconnected', () => { this.connected = false; }); }
  get gp() { const l = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of l) if (g && g.connected) return g; return null; }
  /** Estado analógico para el juego. */
  read(dt) {
    const g = this.gp; if (!g) return null; this.connected = true;
    const b = (i) => (g.buttons[i] ? g.buttons[i].value : 0);
    return { mx: dz(g.axes[0] || 0), mz: -dz(g.axes[1] || 0), dyaw: dz(g.axes[2] || 0) * dt * 3.6, dpitch: -dz(g.axes[3] || 0) * dt * 2.6,
      fire: b(7) > 0.3 || b(5) > 0.5 && false, jump: b(0) > 0.5, dash: b(10) > 0.5, ads: b(6) > 0.3, crouch: b(1) > 0.5 && false, prev: b(14) > 0.5, next: b(15) > 0.5, mov: b(4) > 0.5, esp: b(5) > 0.5, melee: b(1) > 0.5, s3: b(12) > 0.5, ult: b(13) > 0.5, pause: b(9) > 0.5, ability: b(8) > 0.5 && b(4) > 0.5, mode: b(8) > 0.5 && b(4) < 0.5, interact: b(3) > 0.5, ping: b(11) > 0.5, reload: b(2) > 0.5 };
  }
  /** Eventos discretos para menús: devuelve lista de 'up'|'down'|'left'|'right'|'ok'|'back' con repetición al mantener. */
  menuEvents(dt) {
    const g = this.gp; if (!g) return []; const out = []; const now = performance.now();
    const down = { up: g.buttons[12]?.pressed || (g.axes[1] || 0) < -0.6, down: g.buttons[13]?.pressed || (g.axes[1] || 0) > 0.6, left: g.buttons[14]?.pressed || (g.axes[0] || 0) < -0.6, right: g.buttons[15]?.pressed || (g.axes[0] || 0) > 0.6, ok: g.buttons[0]?.pressed || g.buttons[9]?.pressed, back: g.buttons[1]?.pressed };
    for (const k of Object.keys(down)) {
      if (down[k]) { if (!this.prev[k]) { out.push(k); this.repeat[k] = now + 380; } else if ((k !== 'ok' && k !== 'back') && now > this.repeat[k]) { out.push(k); this.repeat[k] = now + 110; } }
      this.prev[k] = down[k];
    }
    return out;
  }
  rumble(ms = 80, strong = 0.5) { const g = this.gp; if (g && g.vibrationActuator && g.vibrationActuator.playEffect) g.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: strong * 0.6 }).catch(() => {}); }
}
