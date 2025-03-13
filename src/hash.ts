// hash.ts
const AD_REPLACER_R = /(a)(d)/gi;
const charsLength = 52;

function getAlphabeticChar(code: number) {
  return String.fromCharCode(code + (code > 25 ? 39 : 97));
}

function generateAlphabeticName(code: number) {
  let name = '';
  let x;
  for (x = Math.abs(code); x > charsLength; x = (x / charsLength) | 0) {
    name = getAlphabeticChar(x % charsLength) + name;
  }
  return (getAlphabeticChar(x % charsLength) + name).replace(AD_REPLACER_R, '$1-$2');
}

export const SEED = 5381;

export function phash(h: number, x: string): number {
  let i = x.length;
  while (i) {
    h = (h * 33) ^ x.charCodeAt(--i);
  }
  return h;
}

export function hash(x: string): number {
  return phash(SEED, x) >>> 0;
}

export function generateClassId(str: string): string {
  return generateAlphabeticName(hash(str));
}
