// src/client/theme.ts
import { abbrMap } from '../shared/constant';
import { isServer } from '../server/constant';
import { serverStyleSheet } from '../server/ServerStyleSheetInstance';
import { separateStyleAndProperties } from '../shared/parseStyles/parseStylesUtils';

/* --------------------------------------------------------------------------
   เก็บ CSS ส่วน global (palette, keyframe, variable) ไว้ใน <style> (#styledwind-theme)
   หรือฝั่ง SSR ก็เก็บเป็น text
-------------------------------------------------------------------------- */
let themeStyleEl: HTMLStyleElement | null = null;
let cachedPaletteCSS = '';
let cachedKeyframeCSS = '';
let cachedVariableCSS = '';

/* --------------------------------------------------------------------------
   Store สำหรับ breakpoint, typography
-------------------------------------------------------------------------- */
export const breakpoints = {
  dict: {} as Record<string, string>,
};

export const typographyDict = {
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
  const cssText = cachedPaletteCSS + cachedVariableCSS + cachedKeyframeCSS;
  if (isServer) {
    const sheet = serverStyleSheet();
    sheet.setThemeCSSText(cssText);
  } else {
    const styleEl = ensureThemeStyleElement();
    styleEl.textContent = cssText;
  }
}

/** ตั้ง theme mode (เช่น dark/light) */
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

/* -----------------------------------------
   Runtime store สำหรับ keyframe 
----------------------------------------- */
const keyframeRuntimeDict: Record<string, Record<string, { set: (props: any) => void }>> = {};

/**
 * Parse keyframe shorthand (ex: "0%( bg[red] ) 100%( bg[blue] )")
 */
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
      styleAbbr = styleAbbr.slice(1);
    }

    // จะ map abbr -> CSS prop หรือไม่ก็ตามปกติ (แต่ใน keyframe อาจ parse เอง)
    // simplified
    if (isVar) {
      // ถ้าเป็น $xxx -> เป็น cssVar
      const finalVarName = `--${styleAbbr}-${keyframeName}-${blockLabel.replace('%', '')}`;
      cssText += `${styleAbbr}:var(${finalVarName});`; // สมมติเรายังใช้ชื่อ abbr เป็น prop
      varMap[styleAbbr] = finalVarName;
      defaultVars[finalVarName] = propVal;
    } else {
      // สมมติ mapping คร่าว ๆ
      cssText += `${styleAbbr}:${propVal};`;
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

/* --------------------------------------------------------------------------
   สร้าง CSS variable (ของเดิม spacing) => เปลี่ยนชื่อเป็น variable()
-------------------------------------------------------------------------- */
function generateVariableCSS(variableMap: Record<string, string>): string {
  let rootBlock = '';
  for (const key in variableMap) {
    const val = variableMap[key];
    rootBlock += `--${key}:${val};`;
  }
  return rootBlock ? `:root{${rootBlock}}` : '';
}

/* --------------------------------------------------------------------------
   parseTypographyDefinition: ของเดิม parseFontDefinition => เปลี่ยนชื่อ
---------------------------------------------------------------------------*/
function parseTypographyDefinition(def: string): Record<string, string> {
  // เดิมใช้ separateStyleAndProperties => "fs[16px] fw[700]" ...
  // แล้ว map => { font-size: '16px', font-weight: '700', ... }
  const tokens = def.split(/\s+/).filter(Boolean);
  const result: Record<string, string> = {};

  for (const token of tokens) {
    const [abbr, rawVal] = separateStyleAndProperties(token);
    if (!abbr) continue;

    // ไม่อนุญาต $variable ใน typography
    if (abbr.startsWith('$')) {
      throw new Error(`[SWD-ERR] $variable is not allowed in theme.typography: "${token}"`);
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

/* --------------------------------------------------------------------------
   theme object (แก้ชื่อฟังก์ชันตาม requirement)
-------------------------------------------------------------------------- */
export const theme = {
  breakpoint(breakpointList: Record<string, string>) {
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

  typography(typoMap: Record<string, string>) {
    const processed: Record<string, Record<string, string>> = {};
    for (const key in typoMap) {
      const definition = typoMap[key];
      processed[key] = parseTypographyDefinition(definition);
    }
    typographyDict.dict = processed;
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

  variable(variableMap: Record<string, string>) {
    cachedVariableCSS = generateVariableCSS(variableMap);
    updateThemeStyleContent();
  },
};
