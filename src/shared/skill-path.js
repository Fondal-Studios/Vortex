// Three curated powers: movement/defence from start, support after wave 1, ultimate after wave 3.
export const SUPPORT = Object.freeze({ axioma: 'esp', vesper: 's3', micelio: 'esp', umbra: 'esp', seraf: 'esp', colmena: 'esp', danzante: 's3', singular: 'esp', laboratorio: 'esp' });
export const cleanSkillLevel = n => Number.isInteger(n) && n >= 0 && n <= 2 ? n : 0;
export const earnedSkillLevel = wave => wave >= 3 ? 2 : wave >= 1 ? 1 : 0;
export function gateSkills(input, char, level) {
  const support = !!input.support, ult = !!input.ult, mov = !!input.mov;
  for (const k of ['mov','esp','s3','hab','ability','ult']) input[k] = false;
  if (level >= 1 && SUPPORT[char]) input[SUPPORT[char]] = support;
  input.mov = mov;
  input.ult = level >= 2 && ult;
  return input;
}
