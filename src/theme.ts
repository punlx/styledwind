// theme.ts
import { constructedSheet, fallbackStyleElement, breakpoints } from './constant';

function generatePaletteCSS(colors: string[][]): string {
  const modes = colors[0]; // เช่น ["dark","light","dim"]
  const colorRows = colors.slice(1);
  let cssResult = '';

  // สร้างสตริง .dark{ --xxx }, .light{ --xxx }
  for (let i = 0; i < modes.length; i++) {
    const modeName = modes[i];
    let classBody = '';
    for (let j = 0; j < colorRows.length; j++) {
      const row = colorRows[j];
      const colorName = row[0];
      const colorValue = row[i + 1];
      classBody += `--${colorName}:${colorValue};`;
    }
    cssResult += `.${modeName}{${classBody}}`;
  }
  return cssResult;
}

/**
 * setTheme(mode, modes):
 *  - ลบ class เก่า
 *  - ใส่ class ใหม่
 *  - บันทึก localStorage ถ้าต้องการ
 */
function setTheme(mode: string, modes: string[]) {
  document.body.classList.remove(...modes);
  document.body.classList.add(mode);
  localStorage.setItem('styledwind-theme', mode);
}

export const theme = {
  screen(breakpointList: Record<string, string>) {
    breakpoints.dict = breakpointList;
  },

  palette(colors: string[][]) {
    // generate CSS ของทุกโหมด
    const paletteCSS = generatePaletteCSS(colors);

    // append/replace sync
    if ('replaceSync' in constructedSheet) {
      const oldCss =
        (constructedSheet as CSSStyleSheet).cssRules.length > 0
          ? Array.from((constructedSheet as CSSStyleSheet).cssRules)
              .map((rule) => rule.cssText)
              .join('')
          : '';
      const newCss = oldCss + paletteCSS;
      (constructedSheet as CSSStyleSheet).replaceSync(newCss);
    } else if (fallbackStyleElement) {
      fallbackStyleElement.textContent = (fallbackStyleElement.textContent || '') + paletteCSS;
    }

    // หลังจาก inject CSS ตัวผู้ใช้ก็อาจเรียก setTheme(...) ตามต้องการ
    // เช่น (options) เช็ค localStorage ว่ามีธีมเก่าไหม
    const modes = colors[0];
    const savedTheme = localStorage.getItem('styledwind-theme');
    if (savedTheme && modes.includes(savedTheme)) {
      setTheme(savedTheme, modes);
    } else {
      // ค่า default
      setTheme(modes[1] || 'light', modes); // สมมติ index[1] คือ "light"
    }

    return {
      mode: (mode: string) => setTheme(mode, modes),
    };
  },
};
