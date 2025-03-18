// src/shared/hash.ts
// เอาออกใน release 2 (ใช้ scope แทน)
const CHARS_LENGTH = 52;
const SEED = 5381;

function getAlphabeticChar(code: number): string {
  return String.fromCharCode(code < 26 ? code + 97 : code + 39);
}

function generateAlphabeticName(code: number): string {
  let name = '';
  let x = code;
  while (x > CHARS_LENGTH) {
    const remainder = x % CHARS_LENGTH;
    name = getAlphabeticChar(remainder) + name;
    x = (x / CHARS_LENGTH) | 0;
  }
  name = getAlphabeticChar(x % CHARS_LENGTH) + name;
  return name;
}

function hash(str: string): number {
  let h = SEED;
  for (let i = str.length - 1; i >= 0; i--) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

export function generateClassId(str: string): string {
  return generateAlphabeticName(hash(str));
}
