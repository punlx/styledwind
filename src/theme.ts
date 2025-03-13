// theme.ts
import { constructedSheet, fallbackStyleElement, breakpoints } from './constant';

/***************************************************
 * 1) ฟังก์ชัน generatePaletteCSS
 *    - รับ colors: string[][]
 *      เช่น [
 *        ["dark","light","dim"],
 *        ["blue-100","#E3F2FD","#BBDEFB","#90CAF9"],
 *        ...
 *      ]
 *    - คืนสตริง CSS ซึ่งสร้าง .dark { --blue-100: ... } .light { --blue-100: ... } ...
 ***************************************************/
function generatePaletteCSS(colors: string[][]): string {
  // แถวแรกของ colors บ่งบอกว่าเป็นโหมดอะไรบ้าง เช่น ["dark","light","dim"]
  const modes = colors[0];
  // แถวอื่นเป็นข้อมูลสี เช่น ["blue-100","#E3F2FD","#BBDEFB","#90CAF9"]
  const colorRows = colors.slice(1);

  let cssResult = '';

  // modes[i] => เช่น "dark","light","dim"
  for (let i = 0; i < modes.length; i++) {
    const modeName = modes[i];
    let classBody = ''; // เก็บ CSS variables ภายในแต่ละโหมด

    for (let j = 0; j < colorRows.length; j++) {
      // colorRows[j][0] => ชื่อสี (เช่น "blue-100")
      // colorRows[j][i+1] => ค่าสีใน mode นั้น
      const row = colorRows[j];
      const colorName = row[0]; // เช่น "blue-100"
      const colorValue = row[i + 1]; // เช่น "#E3F2FD"

      classBody += `--${colorName}:${colorValue};`;
    }

    // ประกอบเป็น block
    cssResult += `.${modeName}{${classBody}}`;
  }

  return cssResult;
}

/***************************************************
 * 2) ฟังก์ชันสำหรับใช้ใน theme
 *    - palette(...)
 *    - screen(...)
 ***************************************************/
export const theme = {
  /**
   * 2.1 screen(...)
   *     ตั้งค่า breakpoints.dict
   */
  screen(breakpointList: Record<string, string>) {
    breakpoints.dict = breakpointList;
  },

  /**
   * 2.2 palette(...)
   *     รับ colors[][] -> generatePaletteCSS ->
   *     -> ใส่ลง constructedSheet.replaceSync(...) หรือ fallback
   */
  palette(colors: string[][]) {
    // สร้าง CSS ของโหมดต่าง ๆ
    const paletteCSS = generatePaletteCSS(colors);

    // adopt
    if ('replaceSync' in constructedSheet) {
      // ถ้า Browser รองรับ Constructed StyleSheet
      // ต้องระวังว่าเรามี globalCSS จาก insertCSSRules หรือยัง
      // ถ้าอยาก "ผสาน" อาจต้องเก็บ globalCSS เพิ่ม
      // หรือใช้ Sheet แยกก็ได้
      // ตัวอย่างนี้จะสมมติว่า "append" ไปท้ายๆ
      // (อาจต้องใช้ตัวแปร globalCSS แยกถ้าอยากเก็บทั้งหมด)
      // นี่เป็นตัวอย่างง่ายๆ: เรียก replaceSync() ทับค่าเดิมทั้งหมด
      // => ถ้าอยากผสานกับของเก่า ให้คุณต่อสตริงเอง
      // หรือประกาศ sheet แยกสำหรับ theme
      const oldCss =
        (constructedSheet as CSSStyleSheet).cssRules.length > 0
          ? Array.from((constructedSheet as CSSStyleSheet).cssRules)
              .map((rule) => rule.cssText)
              .join('')
          : '';
      const newCss = oldCss + paletteCSS;

      (constructedSheet as CSSStyleSheet).replaceSync(newCss);
    } else {
      // fallback
      if (fallbackStyleElement) {
        // เช่น: เอา content เดิม + paletteCSS
        fallbackStyleElement.textContent = (fallbackStyleElement.textContent || '') + paletteCSS;
      }
    }
  },
};
