// theme.ts

import { breakpoints, fontDict } from './constant';

/**
 * generatePaletteCSS(colors):
 *  สร้าง CSS ธีมสี เช่น html.dark{ --blue-100:#E3F2FD; }...
 */
function generatePaletteCSS(colors: string[][]): string {
  const modes = colors[0];
  const colorRows = colors.slice(1);
  let cssResult = '';

  for (let i = 0; i < modes.length; ++i) {
    const modeName = modes[i];
    let classBody = '';
    for (let j = 0; j < colorRows.length; ++j) {
      const row = colorRows[j];
      const colorName = row[0];
      const colorValue = row[i + 1];
      classBody += `--${colorName}:${colorValue};`;
    }
    // สมมติใช้ html.dark{ ... }
    cssResult += `html.${modeName}{${classBody}}`;
  }
  return cssResult;
}

/**
 * เราแยก CSS theme ไว้ใน <style id="styledwind-theme"> แทน constructedSheet
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
 * setTheme(): เปลี่ยนคลาสบน html
 */
function setTheme(mode: string, modes: string[]) {
  const htmlEl = document.documentElement;
  htmlEl.classList.remove(...modes);
  htmlEl.classList.add(mode);
  localStorage.setItem('styledwind-theme', mode);
}

/*********************************************
 * 1) เพิ่ม fontDict ไว้ที่นี่
 *********************************************/

/*********************************************
 * 2) ฟังก์ชัน screen / palette / font
 *********************************************/
export const theme = {
  screen(breakpointList: Record<string, string>) {
    breakpoints.dict = breakpointList;
  },

  palette(colors: string[][]) {
    const paletteCSS = generatePaletteCSS(colors);

    const styleEl = ensureThemeStyleElement();
    styleEl.textContent = paletteCSS;

    const modes = colors[0];
    const savedTheme = localStorage.getItem('styledwind-theme');
    if (savedTheme && modes.indexOf(savedTheme) !== -1) {
      setTheme(savedTheme, modes);
    } else {
      setTheme(modes[1] || 'light', modes);
    }
    return {
      mode: (mode: string) => setTheme(mode, modes),
    };
  },

  /**
   * font(fontMap): รับ object { 'display-1': 'fs[22px] fw[500]', ... }
   * แล้ว merge ลงใน fontDict
   */
  font(fontMap: Record<string, string>) {
    // รวมค่าเก่า/ใหม่
    fontDict.dict = fontMap;
  },
};
