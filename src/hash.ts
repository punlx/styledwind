// hash.ts
const AD_REPLACER_R = /(a)(d)/gi;
const CHARS_LENGTH = 52;
const SEED = 5381;

/**
 * คืนอักขระ a-z, A-Z ตามโค้ด 0..51
 *   0..25 => 'a'..'z'   (code + 97)
 *   26..51 => 'A'..'Z' (code + 39)
 */
function getAlphabeticChar(code: number): string {
  return String.fromCharCode(code < 26 ? code + 97 : code + 39);
}

/**
 * สร้างชื่อแบบ alphabetic จากโค้ดจำนวนเต็ม
 * และแทนที่ "ad" ด้วย "a-d" เพื่อป้องกันปัญหา (เช่น selector "ad")
 */
function generateAlphabeticName(code: number): string {
  let name = '';
  let x = code;

  // แปลงโค้ดเป็นชุดตัวอักษร a-z, A-Z
  while (x > CHARS_LENGTH) {
    const remainder = x % CHARS_LENGTH;
    name = getAlphabeticChar(remainder) + name;
    x = (x / CHARS_LENGTH) | 0; // เทียบเท่ากับ floor(x / CHARS_LENGTH)
  }

  // เติมอักขระตัวสุดท้าย (เมื่อ x <= CHARS_LENGTH)
  name = getAlphabeticChar(x % CHARS_LENGTH) + name;

  // แทนที่ ad => a-d
  return name.replace(AD_REPLACER_R, '$1-$2');
}

/**
 * ฟังก์ชันแฮชสไตล์ DJB2 (ดัดแปลงให้ XOR charCode)
 * เพื่อให้ได้ hash ที่สั้นและกระจายตัวได้ดี
 */
function hash(str: string): number {
  let h = SEED;
  // เดินจากท้ายไปต้นเพื่อคงผลลัพธ์แบบเดิม
  for (let i = str.length - 1; i >= 0; i--) {
    // (h * 33) ^ charCodeAt(i)
    // สามารถเขียนเป็น (h << 5) + h เพื่อแทน h * 33 ได้
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  // >>> 0 เพื่อ ensure เป็น unsigned int (0 ถึง 2^32 - 1)
  return h >>> 0;
}

/**
 * สร้าง className จาก string โดยใช้ hash + แปลงโค้ดเป็นตัวอักษร
 */
export function generateClassId(str: string): string {
  return generateAlphabeticName(hash(str));
}
