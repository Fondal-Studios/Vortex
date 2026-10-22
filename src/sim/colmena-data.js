// COLMENA — el sexto Huésped (invocador / enjambre). Sólo DATOS puros (sin importar nada): data.js los registra en CHARACTERS, COMBO_SETS, HABILIDADES, etc.
// La lógica (zánganos, nidos, la Reina) vive en src/sim/enjambre.js. Contrato y balance: docs/HUESPEDES.md → «Colmena».
// Folclore del limbo: las abejas de un colmenar quemado que no se fueron: aprendieron a pensar juntas y ahora son una sola voz con miles de alas.

const M = (id, name, seq, o = {}) => ({ id, name, seq, evo: 0, w: 'l', dmg: 1, rng: 1, arc: 1, cdr: 1, hits: 1, kind: 'light', ...o });

export const COLMENA = {
  /** Entrada de CHARACTERS (host:true). `starter:false` + `unlock`: se COMPRA en la tienda (núcleos del perfil); `req` es una condición opcional que la tienda puede mostrar/exigir. */
  char: {
    team: 'ingeniero', name: 'Colmena', title: 'La Soberana del Enjambre', role: 'invocador', host: true, starter: false,
    unlock: { precio: 600, req: { rango: 3, texto: 'Llegá al rango 3 de maestría con cualquier otro Huésped.' } },
    preset: 'jugador3', seed: null, color: 0xf0384e, hp: 0.9, speed: 1, slots: [17, 9, 19, 13],
    desc: 'Invocadora. Cría un enjambre de zánganos que atacan solos, planta nidos que disparan y manda sobre el campo sin moverse demasiado. Sola es frágil; acompañada, no hay quien la pare.',
    story: 'Una conciencia humana enlazada con una IA distribuida entre drones biológicos. Cada criatura del enjambre es una extensión del mismo Huésped.',
    stats: { dano: 6, resistencia: 4, movilidad: 6, control: 7, utilidad: 8, dificultad: 7 },
    melee: { light: { dmg: 28, range: 3.4, arc: 0.55, cd: 0.4 }, heavy: { dmg: 85, range: 4, arc: 0.5, cd: 0.9, knock: 8 } },
    mov: { id: 'zumbido', name: 'Zumbido', cd: 6, desc: 'Un salto zumbante hacia donde mirás, con 0,3 s de invulnerabilidad. Al arrancar nace un zángano.' },
    esp: { id: 'cria', name: 'Criar enjambre', cd: 11, desc: 'Tres zánganos brotan delante tuyo y atacan solos durante 20 s. Con el límite lleno, renueva el tiempo del más viejo.' },
    s3: { id: 'nido', name: 'Nido-torreta', cd: 16, desc: 'Un nido orgánico brota en el suelo y dispara a todo lo que se acerque durante 14 s (máx. 2 a la vez).' },
    ult: { id: 'marabunta', name: 'Marabunta', cd: 0, charge: 100, desc: '10 s: el enjambre entra en frenesí (ataca al doble de rápido), nace un zángano por segundo y recibís 20 % menos de daño.' },
    passive: { id: 'cria_viva', name: 'Cría viva', desc: 'Cada 6 s nace un zángano gratis (hasta 2) y cada zángano vivo (máx. 5) te da +3 % de daño.' },
  },
  /** Caminos de evolución PROPIOS (4 niveles × 2 excluyentes). Las ids son nuevas: el resto del juego las ignora si no las conoce. */
  paths: [
    null,
    [{ id: 'criador', name: 'Criador', vis: 'larvas', desc: '+2 al límite de zánganos y la Cría viva nace un 40 % más rápido.' },
     { id: 'aguijon', name: 'Aguijón', vis: 'aguijones', desc: 'Tus zánganos pegan un 40 % más y su picadura envenena.' }],
    [{ id: 'nidos', name: 'Nidos vivos', vis: 'nidos', desc: 'Cada 12 s brota solo un nido-torreta junto a vos (hasta 2).' },
     { id: 'nube', name: 'Nube de aguijones', vis: 'nube', desc: 'Cada picadura de zángano daña en área y ralentiza.' }],
    [{ id: 'cohabita', name: 'Cohabitación', vis: 'simbionte', desc: 'Simbiosis: cada zángano vivo te da +3 % de daño y −3 % de daño recibido (hasta 6); se posan en tus hombros.' },
     { id: 'detonador', name: 'Zánganos kamikaze', vis: 'detonador', desc: 'Cuando se les acaba el tiempo, cada zángano estalla en área (daño y empuje).' }],
    [{ id: 'reina', name: 'La Reina', vis: 'reina', desc: 'Una Reina nace a tu lado: dispara fuerte y todo el enjambre pega un 25 % más.' },
     { id: 'plaga', name: 'Plaga', vis: 'plaga', desc: '+4 al límite de zánganos y cada baja tuya cría uno gratis.' }],
  ],
  /** Modo Combo: 8 golpes. fx 'orden' = el enjambre ataca junto con el golpe; 'nube' = nube de aguijones en área; 'cria' = brotan zánganos. */
  combo: [
    M('picotazo', 'Picotazo', ['a1'], { dmg: 0.55, hits: 2, fx: 'orden' }),
    M('doble_aguijon', 'Doble aguijón', ['a1', 'a1'], { dmg: 0.6, hits: 2, fx: 'orden', cdr: 1.05 }),
    M('aguijonada', 'Aguijonada de enjambre', ['a1', 'a1', 'a1'], { w: 'h', dmg: 1.4, kind: 'heavy', fx: 'orden+nube', cdr: 1.5 }),
    M('barrido_alas', 'Barrido de alas', ['a2'], { w: 'h', dmg: 1.1, arc: 1.6, kind: 'heavy', fx: 'nube' }),
    M('brote_crias', 'Brote de crías', ['a1', 'a2'], { evo: 1, dmg: 1.0, fx: 'cria', cdr: 0.9 }),
    M('torbellino_alas', 'Torbellino de alas', ['a1', 'a1', 'a2'], { evo: 2, w: 'h', dmg: 1.1, arc: 2, kind: 'spin', fx: 'orden+nube', cdr: 1.2 }),
    M('lluvia_aguijones', 'Lluvia de aguijones', ['a1', 'a1', 'a1', 'a1'], { evo: 3, dmg: 0.45, hits: 3, arc: 2, kind: 'spin', fx: 'orden', cdr: 1.3 }),
    M('llamado_reina', 'Llamado de la Reina', ['a1', 'a1', 'a1', 'a2'], { evo: 4, w: 'h', dmg: 1.8, arc: 2, kind: 'air', fx: 'orden+nube+cria', cdr: 1.5 }),
  ],
  hab: { id: 'llamado', name: 'Llamado del enjambre', cd: 17, wind: 0.35, r: 9, rol: 'invocación', desc: 'Tras una breve llamada brotan zánganos (hasta el límite) y TODO el enjambre entra en frenesí 6 s: ataca al doble de rápido y se lanza sobre lo que tengas cerca.' },
  tune: 0.42,
  native: 'aguijon',
  affinity: ['daga', 'lanza'],
};
