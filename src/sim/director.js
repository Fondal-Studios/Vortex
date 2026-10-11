// Director de ritmo (estilo Left 4 Dead): mide el estrés del equipo y regula la presión.
import { clamp } from './math.js';
import { PLAYER } from './data.js';

export class Director {
  constructor() { this.stress = 0; this.dmg = 0; this.sinceSpecial = 0; this.sinceRelief = 0; }
  hurt(amount) { this.dmg += amount; }
  update(g, dt) {
    this.dmg *= Math.exp(-dt / 6);
    const ps = g.players, n = Math.max(1, ps.length);
    const downed = ps.filter((p) => p.dead).length / n;
    const hpLow = ps.reduce((a, p) => a + (p.dead ? 1 : 1 - (p.hp + p.shield * 0.5) / (PLAYER.hp + PLAYER.shield * 0.5)), 0) / n;
    const target = clamp(this.dmg / (55 * n) * 0.8 + hpLow * 0.45 + downed * 0.5, 0, 1);
    this.stress += (target - this.stress) * Math.min(1, dt * 0.6);
    this.sinceSpecial += dt; this.sinceRelief += dt;
  }
  /** Multiplicador del intervalo de aparición: con estrés alto, más espaciado */
  gapScale() { return 1 + 0.9 * this.stress; }
  /** ¿Toca soltar un botiquín de alivio? */
  wantsRelief() { if (this.stress > 0.7 && this.sinceRelief > 9) { this.sinceRelief = 0; return true; } return false; }
  /** ¿Toca meter un pelotón de especiales? (equipo cómodo y sin presión) */
  wantsSurge() { if (this.stress < 0.12 && this.sinceSpecial > 26) { this.sinceSpecial = 0; return true; } return false; }
}
