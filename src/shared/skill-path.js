// Two host powers, identical in both combat modes. No paid unlocks.
export const SUPPORT = Object.freeze({ axioma: 'esp', vesper: 's3', micelio: 'esp', umbra: 'esp', seraf: 'esp', colmena: 'esp', danzante: 's3', singular: 'esp' });
export const cleanSkillLevel = n => Number.isInteger(n) && n >= 0 && n <= 2 ? n : 0;
export const earnedSkillLevel = wave => wave >= 3 ? 2 : wave >= 1 ? 1 : 0;
export function gateSkills(input, char, level) {
  const support = !!input.support, ult = !!input.ult;
  for (const k of ['mov','esp','s3','hab','ability','ult']) input[k] = false;
  if (level >= 1 && SUPPORT[char]) input[SUPPORT[char]] = support;
  input.ult = level >= 2 && ult;
  return input;
}
