// Política de presentación: cuatro acciones, más pausa. No altera el protocolo.
export function essentialActions(mode, context = {}) {
  return ['fire', 'jump', context.use ? 'use' : mode === 'combo' ? 's3' : 'esp', 'mode', 'pause'];
}
export const thirdForMode = (mode) => mode === 'combo';
