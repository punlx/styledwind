import { breakpoints } from './constant';

/**
 * generatePaletteCSS(colors):
 *  รับ Array 2D
 *    แถวแรก: ["dark","light","dim"]
 *    แถวที่เหลือ: ["blue-100","#E3F2FD","#BBDEFB","#90CAF9"]
 *  แล้วสร้างโค้ด .dark { --blue-100:#E3F2FD; } .light { --blue-100:#BBDEFB; } ...
 */
function generatePaletteCSS(colors: string[][]): string {
  const modes = colors[0]; // ex. ["dark","light","dim"]
  const colorRows = colors.slice(1);
  let cssResult = '';

  for (let i = 0; i < modes.length; ++i) {
    const modeName = modes[i]; // "dark" / "light" / "dim"
    let classBody = '';
    for (let j = 0; j < colorRows.length; ++j) {
      const row = colorRows[j];
      const colorName = row[0]; // ex. "blue-100"
      const colorValue = row[i + 1]; // ex. "#E3F2FD"
      classBody += `--${colorName}:${colorValue};`;
    }
    // ใส่ใน selector เช่น html.dark { --blue-100:#E3F2FD; ... }
    // หรือถ้าคุณต้องการ .dark บน body/documentElement ก็ปรับได้
    cssResult += `html.${modeName}{${classBody}}`;
  }
  return cssResult;
}

/**
 * แทนที่จะใช้ constructedSheet,
 * เราจะเขียนลง <style id="styledwind-theme"> ใน <head>
 */
let themeStyleEl: HTMLStyleElement | null = null;

function ensureThemeStyleElement() {
  if (!themeStyleEl) {
    themeStyleEl = document.getElementById('styledwind-theme') as HTMLStyleElement;
    if (!themeStyleEl) {
      themeStyleEl = document.createElement('style');
      themeStyleEl.id = 'styledwind-theme';
      document.head.appendChild(themeStyleEl);
    }
  }
  return themeStyleEl;
}

/**
 * setTheme(mode, modes):
 *  - ลบ class เก่าออกจาก html (หรือ documentElement)
 *  - ใส่ class ใหม่ (theme) เข้าไป
 *  - เก็บค่าใน localStorage ถ้าต้องการ
 */
function setTheme(mode: string, modes: string[]) {
  const htmlEl = document.documentElement;
  htmlEl.classList.remove(...modes);
  htmlEl.classList.add(mode);
  localStorage.setItem('styledwind-theme', mode);
}

/*********************************************
 * สุดท้าย export object theme
 *********************************************/
export const theme = {
  screen(breakpointList: Record<string, string>) {
    breakpoints.dict = breakpointList;
  },

  palette(colors: string[][]) {
    // สร้าง CSS ทั้งหมดของ theme
    const paletteCSS = generatePaletteCSS(colors);

    // เขียนลง <style id="styledwind-theme"> แทน constructedSheet
    const styleEl = ensureThemeStyleElement();
    // replace เนื้อหาเก่า
    styleEl.textContent = paletteCSS;

    // หลัง inject CSS แล้ว setTheme() ตามค่าที่บันทึกไว้
    const modes = colors[0]; // ex. ["dark","light","dim"]
    const savedTheme = localStorage.getItem('styledwind-theme');

    if (savedTheme && modes.indexOf(savedTheme) !== -1) {
      setTheme(savedTheme, modes);
    } else {
      // ค่า default สมมติ index[1] คือ "light"
      setTheme(modes[1] || 'light', modes);
    }

    // คืน object ที่ให้ผู้ใช้เรียก .mode(...) ได้
    return {
      mode: (mode: string) => setTheme(mode, modes),
    };
  },
};
