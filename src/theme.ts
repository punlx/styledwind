// theme.ts

import { breakpoints, fontDict, abbrMap } from './constant';
import { generateClassId } from './hash'; // <-- import function

let themeStyleEl: HTMLStyleElement | null = null;
let cachedPaletteCSS = '';
let cachedKeyframeCSS = '';
let cachedSpacingCSS = ''; // <--- เพิ่มตัวแปรสำหรับ spacing

function ensureThemeStyleElement() {
  if (!themeStyleEl) {
    themeStyleEl = document.getElementById('styledwind-theme') as HTMLStyleElement;
    if (!themeStyleEl) {
      themeStyleEl = document.createElement('style');
      themeStyleEl.id = 'styledwind-theme';
      document.head.appendChild(themeStyleEl);
    } else {
    }
  }
  return themeStyleEl;
}

function updateThemeStyleContent() {
  const styleEl = ensureThemeStyleElement();
  // ต่อ string ของ palette, spacing, keyframe
  styleEl.textContent = cachedPaletteCSS + cachedSpacingCSS + cachedKeyframeCSS;
}

function setTheme(mode: string, modes: string[]) {
  document.documentElement.classList.remove(...modes);
  document.documentElement.classList.add(mode);
  localStorage.setItem('styledwind-theme', mode);
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

// keyframeRuntimeDict => ให้ user เรียก .set(...)
const keyframeRuntimeDict: Record<string, Record<string, { set: (props: any) => void }>> = {};

/**
 * parseKeyframeString:
 *   - แยก rawStr => หลาย block ex. "0%($bg[red])" => parseKeyframeAbbr => css + var
 *   - ต่อท้าย :root { ... } ถ้ามี defaultVarMap
 *   - ต่อท้าย @keyframes ...
 */
function parseKeyframeString(keyframeName: string, rawStr: string): string {
  const regex = /(\b(?:\d+%|from|to))\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  const blocks: Array<{ label: string; css: string }> = [];

  const defaultVarMap: Record<string, string> = {};

  while ((match = regex.exec(rawStr)) !== null) {
    const label = match[1]; // ex. "0%", "50%", "from", "to"
    const abbrBody = match[2]; // ex. "bg[red]"

    const { cssText, varMap, defaultVars } = parseKeyframeAbbr(
      abbrBody.trim(),
      keyframeName,
      label
    );
    blocks.push({ label, css: cssText });

    // merge defaultVars
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

  // สร้าง :root {} สำหรับตัวแปร defaultVarMap
  let rootVarsBlock = '';
  for (const varName in defaultVarMap) {
    rootVarsBlock += `${varName}:${defaultVarMap[varName]};`;
  }

  let finalCss = '';
  if (rootVarsBlock) {
    finalCss += `:root{${rootVarsBlock}}`;
  }

  // build @keyframes
  let body = '';
  for (const b of blocks) {
    body += `${b.label}{${b.css}}`;
  }
  finalCss += `@keyframes ${keyframeName}{${body}}`;

  return finalCss;
}

/**
 * parseKeyframeAbbr:
 *   return { cssText, varMap, defaultVars }
 *   ex. $bg[red] => background-color: var(--bg-my-move-xxxx)
 *                  defaultVars["--bg-my-move-xxxx"] = "red"
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
  let cssText = '';
  const varMap: Record<string, string> = {};
  const defaultVars: Record<string, string> = {};

  let baseStringForHash = `${keyframeName}${blockLabel}${abbrBody}`;

  const tokens = abbrBody.split(/\s+/);
  for (const tok of tokens) {
    const m = /^([\w\-\$]+)\[(.*)\]$/.exec(tok);
    if (!m) {
      console.warn('parseKeyframeAbbr => invalid token', tok);
      continue;
    }
    let styleAbbr = m[1];
    let propVal = m[2];

    // แปลง --xxx => var(--xxx)
    if (propVal.includes('--')) {
      propVal = propVal.replace(/(--[\w-]+)/g, 'var($1)');
    }

    let isVar = false;
    if (styleAbbr.startsWith('$')) {
      isVar = true;
      styleAbbr = styleAbbr.slice(1); // remove '$'
    }

    const cssProp = abbrMap[styleAbbr as keyof typeof abbrMap];
    if (!cssProp) {
      console.warn(`parseKeyframeAbbr => abbr "${styleAbbr}" not in abbrMap`);
      continue;
    }

    if (isVar) {
      // gen hash
      const hashStr = generateClassId(baseStringForHash + styleAbbr + propVal);
      const finalVarName = `--${styleAbbr}-${keyframeName}-${hashStr}`;
      cssText += `${cssProp}:var(${finalVarName});`;
      varMap[styleAbbr] = finalVarName;
      defaultVars[finalVarName] = propVal;
    } else {
      cssText += `${cssProp}:${propVal};`;
    }
  }

  return { cssText, varMap, defaultVars };
}

function appendKeyframeCSS(css: string) {
  cachedKeyframeCSS += css;
  updateThemeStyleContent();
}

/**
 * สร้าง CSS สำหรับ spacingMap แล้วคืนเป็นสตริง
 * เช่น spacing({ 'spacing-1': '12px' }) => :root { --spacing-1:12px; }
 */
function generateSpacingCSS(spacingMap: Record<string, string>): string {
  let rootBlock = '';
  for (const key in spacingMap) {
    const val = spacingMap[key];
    // ใส่เป็น :root { --spacing-1:12px; } เป็นต้น
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
    const saved = localStorage.getItem('styledwind-theme');
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

  /**
   * keyframe(keyframeMap):
   * 1) parse => finalCSS (มี :root{} + @keyframes ...)
   * 2) append => รวมใน style #styledwind-theme
   * 3) สร้าง runtimeObj => user .set({$bg:'pink'})
   */
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

  /**
   * spacing(spacingMap):
   * แปลง key => value เป็นตัวแปร :root { --<key>:<value>; }
   */
  spacing(spacingMap: Record<string, string>) {
    // สร้างสตริง CSS ของ spacingMap
    cachedSpacingCSS = generateSpacingCSS(spacingMap);
    // อัปเดตลงใน style #styledwind-theme ร่วมกับ palette/keyframe
    updateThemeStyleContent();
  },
};
