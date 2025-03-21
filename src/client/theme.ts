// src/client/theme.ts
import { abbrMap } from '../../src/shared/constant';
import { isServer } from '../server/constant';
import { serverStyleSheet } from '../server/ServerStyleSheetInstance';
import { separateStyleAndProperties } from '../shared/parseStyles';

let themeStyleEl: HTMLStyleElement | null = null;
let cachedPaletteCSS = '';
let cachedKeyframeCSS = '';
let cachedSpacingCSS = '';

// Breakpoints dict
export const breakpoints = {
  dict: {} as Record<string, string>,
};

// Font dict
export const fontDict = {
  dict: {} as Record<string, Record<string, string>>,
};

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

function updateThemeStyleContent() {
  const cssText = cachedPaletteCSS + cachedSpacingCSS + cachedKeyframeCSS;
  if (isServer) {
    const sheet = serverStyleSheet();
    sheet.setThemeCSSText(cssText);
  } else {
    const styleEl = ensureThemeStyleElement();
    styleEl.textContent = cssText;
  }
}

function setTheme(mode: string, modes: string[]) {
  if (typeof window !== 'undefined') {
    document.documentElement.classList.remove(...modes);
    document.documentElement.classList.add(mode);
    try {
      localStorage.setItem('styledwind-theme', mode);
    } catch {}
  }
}

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
    cssResult += `html.${modeName}{${classBody}}`;
  }
  return cssResult;
}

const keyframeRuntimeDict: Record<string, Record<string, { set: (props: any) => void }>> = {};

function parseKeyframeAbbr(
  abbrBody: string,
  keyframeName: string,
  blockLabel: string
): {
  cssText: string;
  varMap: Record<string, string>;
  defaultVars: Record<string, string>;
} {
  const regex = /([\w\-\$]+)\[(.*?)\]/g;
  let match: RegExpExecArray | null;

  let cssText = '';
  const varMap: Record<string, string> = {};
  const defaultVars: Record<string, string> = {};

  while ((match = regex.exec(abbrBody)) !== null) {
    let styleAbbr = match[1];
    let propVal = match[2];

    if (propVal.includes('--')) {
      propVal = propVal.replace(/(--[\w-]+)/g, 'var($1)');
    }

    let isVar = false;
    if (styleAbbr.startsWith('$')) {
      isVar = true;
      styleAbbr = styleAbbr.slice(1); // ตัด '$'
    }

    // เพิ่มการ map abbr -> CSS property (เช่น bg -> background-color, c -> color)
    const mappedProp = abbrMap[styleAbbr as keyof typeof abbrMap] || styleAbbr;

    if (isVar) {
      // คือ case $bg หรือ $c
      const finalVarName = `--${styleAbbr}-${keyframeName}-${blockLabel.replace('%', '')}`;
      // เปลี่ยนให้ใช้ mappedProp ด้วย
      cssText += `${mappedProp}:var(${finalVarName});`;

      varMap[styleAbbr] = finalVarName;
      defaultVars[finalVarName] = propVal;
    } else {
      // ต้องเปลี่ยนเป็น mappedProp เพื่อให้กลายเป็น background-color หรือ color
      cssText += `${mappedProp}:${propVal};`;
    }
  }

  return { cssText, varMap, defaultVars };
}

function parseKeyframeString(keyframeName: string, rawStr: string): string {
  const regex = /(\b(?:\d+%|from|to))\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  const blocks: Array<{ label: string; css: string }> = [];
  const defaultVarMap: Record<string, string> = {};

  while ((match = regex.exec(rawStr)) !== null) {
    const label = match[1];
    const abbrBody = match[2];

    const { cssText, varMap, defaultVars } = parseKeyframeAbbr(
      abbrBody.trim(),
      keyframeName,
      label
    );
    blocks.push({ label, css: cssText });
    Object.assign(defaultVarMap, defaultVars);

    if (!keyframeRuntimeDict[keyframeName]) {
      keyframeRuntimeDict[keyframeName] = {};
    }
    if (!keyframeRuntimeDict[keyframeName][label]) {
      keyframeRuntimeDict[keyframeName][label] = {
        set: (props: Record<string, string>) => {
          for (const k in props) {
            if (!k.startsWith('$')) {
              console.error(`Only $var is allowed. got key="${k}"`);
              continue;
            }
            const shortAbbr = k.slice(1);
            const finalVarName = varMap[shortAbbr];
            if (!finalVarName) {
              console.warn(`No var for ${k} in block "${label}" of keyframe "${keyframeName}"`);
              continue;
            }
            document.documentElement.style.setProperty(finalVarName, props[k]);
          }
        },
      };
    }
  }

  let rootVarsBlock = '';
  for (const varName in defaultVarMap) {
    rootVarsBlock += `${varName}:${defaultVarMap[varName]};`;
  }

  let finalCss = '';
  if (rootVarsBlock) {
    finalCss += `:root{${rootVarsBlock}}`;
  }

  let body = '';
  for (const b of blocks) {
    body += `${b.label}{${b.css}}`;
  }
  finalCss += `@keyframes ${keyframeName}{${body}}`;

  return finalCss;
}

function appendKeyframeCSS(css: string) {
  cachedKeyframeCSS += css;
  updateThemeStyleContent();
}

function generateSpacingCSS(spacingMap: Record<string, string>): string {
  let rootBlock = '';
  for (const key in spacingMap) {
    const val = spacingMap[key];
    rootBlock += `--${key}:${val};`;
  }
  return rootBlock ? `:root{${rootBlock}}` : '';
}

/**
 * parseFontDefinition:
 *  - รับสตริง เช่น "fs[22px] fw[500] fm[Sarabun-Bold]"
 *  - แตกเป็น token แล้ว mapping เป็นรูป { "font-size": "22px", "font-weight": "500", ... }
 *  - ถ้าเจอ $variable → throw error (ตามเงื่อนไข)
 */
function parseFontDefinition(def: string): Record<string, string> {
  // แยกเป็น token: ["fs[22px]", "fw[500]", "fm[Sarabun-Bold]"]
  const tokens = def.split(/\s+/).filter(Boolean);
  const result: Record<string, string> = {};

  for (const token of tokens) {
    const [abbr, rawVal] = separateStyleAndProperties(token);
    if (!abbr) continue;

    // ไม่อนุญาตให้ใช้ $variable ใน font
    if (abbr.startsWith('$')) {
      throw new Error(`[SWD-ERR] $variable is not allowed in theme.font: "${token}"`);
    }

    // map abbr -> CSS property (เช่น fs -> "font-size", fw -> "font-weight", ฯลฯ)
    const mappedProp = abbrMap[abbr as keyof typeof abbrMap];
    if (!mappedProp) {
      throw new Error(`[SWD-ERR] Unknown font abbr "${abbr}" in theme.font(...) definition.`);
    }
    // เก็บเป็น key-value ตรง ๆ
    result[mappedProp] = rawVal;
  }
  return result;
}

export const theme = {
  screen(breakpointList: Record<string, string>) {
    breakpoints.dict = breakpointList;
  },

  palette(colors: string[][]) {
    cachedPaletteCSS = generatePaletteCSS(colors);
    updateThemeStyleContent();

    const modes = colors[0];
    let saved = '';
    let currentMode = '';
    try {
      saved = localStorage.getItem('styledwind-theme') || '';
    } catch {}

    if (saved && modes.indexOf(saved) !== -1) {
      setTheme(saved, modes);
      currentMode = saved;
    } else {
      currentMode = modes[0] || 'light';
      setTheme(currentMode, modes);
    }
    return {
      swtich: (mode: string) => setTheme(mode, modes),
      modes,
      getCurrentMode: () => localStorage.getItem('styledwind-theme'),
    };
  },

  font(fontMap: Record<string, string>) {
    /**
     * theme.font() (ใหม่):
     *  - รับ fontMap: { "tx-content": "fs[22px] fw[500] fm[Sarabun-Bold]", ... }
     *  - แปลงล่วงหน้าเป็น { "font-size": "22px", "font-weight": "500", ... } แล้วเก็บใน fontDict
     */
    const processed: Record<string, Record<string, string>> = {};
    for (const key in fontMap) {
      const definition = fontMap[key];
      // parse ล่วงหน้า → ได้ object ของ CSS props
      processed[key] = parseFontDefinition(definition);
    }
    // เก็บลง fontDict (type เป็น Record<string, Record<string, string>>)
    fontDict.dict = processed;
  },

  keyframe(keyframeMap: Record<string, string>) {
    const resultObj: Record<string, Record<string, { set: (props: any) => void }>> = {};
    for (const keyName in keyframeMap) {
      const rawStr = keyframeMap[keyName];
      const finalCSS = parseKeyframeString(keyName, rawStr);
      appendKeyframeCSS(finalCSS);

      if (!keyframeRuntimeDict[keyName]) {
        keyframeRuntimeDict[keyName] = {};
      }
      resultObj[keyName] = keyframeRuntimeDict[keyName];
    }
    return resultObj;
  },

  spacing(spacingMap: Record<string, string>) {
    cachedSpacingCSS = generateSpacingCSS(spacingMap);
    updateThemeStyleContent();
  },
};
