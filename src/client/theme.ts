// src/client/theme.ts
import { breakpoints, fontDict } from '../../src/shared/constant';
import { generateClassId } from '../../src/shared/hash';
import { isServer } from '../server/constant';
import { serverStyleSheet } from '../server/ServerStyleSheetInstance';

let themeStyleEl: HTMLStyleElement | null = null;
let cachedPaletteCSS = '';
let cachedKeyframeCSS = '';
let cachedSpacingCSS = '';

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

  let baseStringForHash = `${keyframeName}${blockLabel}${abbrBody}`;

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

    // ในตัวอย่างนี้ยังไม่ได้ map prop => ใช้ styleAbbr เป็น key ตรงๆ
    // ถ้าอยากเชื่อมกับ abbrMap ก็สามารถ
    const finalProp = styleAbbr;

    if (isVar) {
      const hashStr = generateClassId(baseStringForHash + styleAbbr + propVal);
      const finalVarName = `--${styleAbbr}-${keyframeName}-${hashStr}`;
      cssText += `${finalProp}:var(${finalVarName});`;
      varMap[styleAbbr] = finalVarName;
      defaultVars[finalVarName] = propVal;
    } else {
      cssText += `${finalProp}:${propVal};`;
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

export const theme = {
  screen(breakpointList: Record<string, string>) {
    breakpoints.dict = breakpointList;
  },

  palette(colors: string[][]) {
    cachedPaletteCSS = generatePaletteCSS(colors);
    updateThemeStyleContent();

    const modes = colors[0];
    let saved = '';
    try {
      saved = localStorage.getItem('styledwind-theme') || '';
    } catch {}

    if (saved && modes.indexOf(saved) !== -1) {
      setTheme(saved, modes);
    } else {
      setTheme(modes[1] || 'light', modes);
    }
    return {
      mode: (mode: string) => setTheme(mode, modes),
    };
  },

  font(fontMap: Record<string, string>) {
    fontDict.dict = fontMap;
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
