// helpers.ts

import { abbrMap, breakpoints } from './constant';
import { fontDict } from './constant'; // สำคัญ: import fontDict เพื่อ lookup

export type StateName = {
  [varName: string]: string;
};

// interface หลักเก็บ style
export interface IStyleDefinition {
  base: Record<string, string>;
  states: Record<string, Record<string, string>>;
  screens: Array<{
    query: string;
    props: Record<string, string>;
  }>;
  containers: Array<{
    query: string;
    props: Record<string, string>;
  }>;
  pseudos: {
    before?: Record<string, string>;
    after?: Record<string, string>;
  };

  varStates?: {
    [stateName: string]: StateName;
  };
  varBase?: Record<string, string>;
  varPseudos?: {
    before?: Record<string, string>;
    after?: Record<string, string>;
  };

  rootVars?: Record<string, string>;
}

/************************************************************
 * ฟังก์ชัน parse base / screen / container / pseudo ฯลฯ
 ************************************************************/

/** ฟังก์ชันแยก abbr + value จากรูปแบบ "bg[red]" => ["bg","red"] */
export function separateStyleAndProperties(abbr: string): [string, string] {
  const match = /^([\w\-\$]+)\[(.*)\]$/.exec(abbr.trim());
  if (!match) return ['', ''];
  return [match[1], match[2]];
}

/** ถ้าเจอ var(--xxx) หรือ --xxx => ทำเป็น var(--xxx) */
export function convertCSSVariable(value: string) {
  if (value.includes('--')) {
    return value.replace(/(--[\w-]+)/g, 'var($1)');
  }
  return value;
}

/**
 * ฟังก์ชันช่วย:
 * ถ้า abbr === 'f' => expand fontDict
 *    เช่น f[display-1] => "fs[22px] fw[500]" => ["fs[22px]", "fw[500]"]
 * ถ้า abbr !== 'f' => คืน array 1 ตัว => [abbr[val]]
 */
function expandFontIfNeeded(abbr: string, propValue: string): string[] {
  if (abbr !== 'f') {
    // ไม่ใช่ฟอนต์ => คืน abbr[val] เดียว เช่น ["bg[red]"]
    return [`${abbr}[${propValue}]`];
  }
  // abbr === 'f' => lookup fontDict
  const expansion = fontDict.dict[propValue];
  if (!expansion) {
    throw new Error(`[SWD] Font key "${propValue}" not found in theme.font(...) dict.`);
  }
  // ex. expansion = "fs[22px] fw[500]"
  const tokens = expansion.split(' ');

  // กันไม่ให้มี screen(...), container(...), pseudo(...) ฯลฯ แทรกอยู่
  // ถ้าคุณอยากให้ไม่ Error ก็ลบ check นี้ออก
  for (const t of tokens) {
    if (t.includes('(')) {
      throw new Error(`[SWD] Not allowed nested syntax in font expansion: ${t}`);
    }
  }

  // คืน array ของ token ex. ["fs[22px]", "fw[500]"]
  return tokens;
}

/********************************************
 * parseBaseStyle
 ********************************************/
export function parseBaseStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const [styleAbbr, propValue] = separateStyleAndProperties(abbrLine);
  if (!styleAbbr) return;

  // ===> ขยาย font ถ้าจำเป็น
  const expansions = expandFontIfNeeded(styleAbbr, propValue);

  // ถ้า expansions ยาวกว่า 1 => loop parseBaseStyle()
  if (expansions.length > 1 || expansions[0] !== `${styleAbbr}[${propValue}]`) {
    // parse each
    for (const ex of expansions) {
      parseBaseStyle(ex, styleDef);
    }
    return;
  }

  // 1) ถ้าเจอ f[...] => lookup fontDict
  if (styleAbbr === 'f') {
    // เช่น propValue = 'display-1'
    const expansion = fontDict.dict[propValue];
    if (!expansion) {
      throw new Error(`[SWD] Font key "${propValue}" not found in theme.font(...) dict.`);
    }
    // expansion เช่น "fs[22px] fw[500] fm[Sarabun-Bold]"
    // split => ["fs[22px]", "fw[500]", "fm[Sarabun-Bold]"]
    const tokens = expansion.split(' ');

    // ตรวจสอบว่าไม่มี token แปลก เช่น screen(...) หรือ container(...)
    // ถ้าอยากให้ error ถ้าเจอ screen(...) ก็เช็ค token
    for (const t of tokens) {
      if (t.startsWith('screen(') || t.startsWith('container(')) {
        throw new Error(`[SWD] Not allowed screen/container in font expansion: ${t}`);
      }
    }

    // แล้ว parseBaseStyle() แต่ละ token
    for (const t of tokens) {
      parseBaseStyle(t, styleDef);
    }
    return; // อย่าลืม return ไม่ให้ผ่าน logic ปกติข้างล่าง
  }

  // 2) ปกติ
  const isVariable = styleAbbr.startsWith('$');
  const realAbbr = isVariable ? styleAbbr.slice(1) : styleAbbr;

  const cssProp = abbrMap[realAbbr as keyof typeof abbrMap];
  if (!cssProp) {
    throw new Error(`"${realAbbr}" is not defined in abbrMap. (abbrLine=${abbrLine})`);
  }

  const finalVal = convertCSSVariable(propValue);

  if (isVariable) {
    if (!styleDef.varBase) {
      styleDef.varBase = {};
    }
    styleDef.varBase[realAbbr] = finalVal;
    styleDef.base[cssProp] = `var(--${realAbbr})`;
  } else {
    styleDef.base[cssProp] = finalVal;
  }
}

/********************************************
 * parseScreenStyle / parseContainerStyle
 ********************************************/
export function parseScreenStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const openParenIdx = abbrLine.indexOf('(');
  let inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  if (!(inside.startsWith('min') || inside.startsWith('max'))) {
    const [bp] = inside.split(', ');
    if (breakpoints.dict[bp]) {
      inside = inside.replace(bp, breakpoints.dict[bp]);
    }
  }

  const commaIdx = inside.indexOf(',');
  if (commaIdx === -1) {
    throw new Error(`"screen" syntax error: ${abbrLine}`);
  }

  const screenPart = inside.slice(0, commaIdx).trim();
  const propsPart = inside.slice(commaIdx + 1).trim();

  const bracketOpen = screenPart.indexOf('[');
  const bracketClose = screenPart.indexOf(']');
  if (bracketOpen === -1 || bracketClose === -1) {
    throw new Error(`"screen" must contain something like min-w[600px]. Got ${screenPart}`);
  }

  const screenAbbr = screenPart.slice(0, bracketOpen).trim();
  const screenValue = screenPart.slice(bracketOpen + 1, bracketClose).trim();

  const screenProp = abbrMap[screenAbbr as keyof typeof abbrMap];
  if (!screenProp) {
    throw new Error(`"${screenAbbr}" not found in abbrMap or not min-w/max-w`);
  }

  const mediaQuery = `(${screenProp}:${screenValue})`;

  const styleList = propsPart.split(/ (?=[^\[\]]*(?:\[|$))/);
  const screenProps: Record<string, string> = {};
  for (const p of styleList) {
    const [abbr, val] = separateStyleAndProperties(p);
    if (!abbr) continue;

    // ===> ขยาย font
    const expansions = expandFontIfNeeded(abbr, val);
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      const cProp = abbrMap[abbr2 as keyof typeof abbrMap];
      if (!cProp) {
        throw new Error(`"${abbr2}" not found in abbrMap.`);
      }
      screenProps[cProp] = convertCSSVariable(val2);
    }
  }

  styleDef.screens.push({ query: mediaQuery, props: screenProps });
}

/** container(max-w[600px], bg[red]) */
export function parseContainerStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const openParenIdx = abbrLine.indexOf('(');
  let inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  const commaIdx = inside.indexOf(',');
  if (commaIdx === -1) {
    throw new Error(`"container" syntax error: ${abbrLine}`);
  }

  let containerPart = inside.slice(0, commaIdx).trim();
  const propsPart = inside.slice(commaIdx + 1).trim();

  // ถ้าเป็น key bp dict
  if (!(containerPart.startsWith('min') || containerPart.startsWith('max'))) {
    const [bp] = containerPart.split(', ');
    if (breakpoints.dict[bp]) {
      containerPart = containerPart.replace(bp, breakpoints.dict[bp]);
    }
  }

  const bracketOpen = containerPart.indexOf('[');
  const bracketClose = containerPart.indexOf(']');
  if (bracketOpen === -1 || bracketClose === -1) {
    throw new Error(`"container" must contain something like min-w[600px]. Got ${containerPart}`);
  }

  const cAbbr = containerPart.slice(0, bracketOpen).trim();
  const cValue = containerPart.slice(bracketOpen + 1, bracketClose).trim();

  const cProp = abbrMap[cAbbr as keyof typeof abbrMap];
  if (!cProp) {
    throw new Error(`"${cAbbr}" not found in abbrMap for container`);
  }

  const containerQuery = `(${cProp}:${cValue})`;

  const propsList = propsPart.split(/ (?=[^\[\]]*(?:\[|$))/);
  const containerProps: Record<string, string> = {};
  for (const p of propsList) {
    const [abbr, val] = separateStyleAndProperties(p);
    if (!abbr) continue;
    // ===> ขยาย font
    const expansions = expandFontIfNeeded(abbr, val);
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      const cProp2 = abbrMap[abbr2 as keyof typeof abbrMap];
      if (!cProp2) {
        throw new Error(`"${abbr2}" not found in abbrMap.`);
      }
      containerProps[cProp2] = convertCSSVariable(val2);
    }
  }

  styleDef.containers.push({
    query: containerQuery,
    props: containerProps,
  });
}

/** before(content['xxx']) / after(...) */
export function parsePseudoElementStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const openParenIdx = abbrLine.indexOf('(');
  const funcName = abbrLine.slice(0, openParenIdx).trim() as 'before' | 'after';
  const inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  const propsInPseudo = inside.split(/ (?=[^\[\]]*(?:\[|$))/);
  const result: Record<string, string> = {};

  for (const p of propsInPseudo) {
    const [abbr, val] = separateStyleAndProperties(p);
    if (!abbr) continue;

    // ===> ขยาย font
    const expansions = expandFontIfNeeded(abbr, val);
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      const isVariable = abbr2.startsWith('$');
      const realAbbr = isVariable ? abbr2.slice(1) : abbr2;
      const cProp = abbrMap[realAbbr as keyof typeof abbrMap];
      if (!cProp) {
        throw new Error(`"${realAbbr}" not found in abbrMap for pseudo-element ${funcName}.`);
      }
      if (realAbbr === 'content' && val2 === '') {
        throw new Error(`Pseudo-element content[] must not be empty.`);
      }

      const finalVal = convertCSSVariable(val2);
      // NOTE: ถ้าคุณอยากรองรับ varState / varPseudos => ต้องเขียน logic คล้าย state
      // แต่ตอนนี้ pseudo-element ปกติ => ใส่ result ตรง ๆ
      result[cProp] = finalVal;
    }
  }

  styleDef.pseudos[funcName] = result;
}

/** hover(bg[red]) / focus(fs[20px]) */
export function parseStateStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const openParenIdx = abbrLine.indexOf('(');
  const funcName = abbrLine.slice(0, openParenIdx).trim(); // เช่น "hover"
  const inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  const propsInState = inside.split(/ (?=[^\[\]]*(?:\[|$))/);
  const result: Record<string, string> = {};

  for (const p of propsInState) {
    const [abbr, val] = separateStyleAndProperties(p);
    if (!abbr) continue;

    // ===> ขยาย font ถ้าจำเป็น
    const expansions = expandFontIfNeeded(abbr, val);
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      const isVariable = abbr2.startsWith('$');
      const realAbbr = isVariable ? abbr2.slice(1) : abbr2;
      const cProp = abbrMap[realAbbr as keyof typeof abbrMap];
      if (!cProp) {
        throw new Error(`"${realAbbr}" not found in abbrMap for state ${funcName}.`);
      }

      const finalVal = convertCSSVariable(val2);

      if (isVariable) {
        // เก็บ varStates ถ้าไม่มีให้สร้าง
        if (!styleDef.varStates) {
          styleDef.varStates = {};
        }
        if (!styleDef.varStates[funcName]) {
          styleDef.varStates[funcName] = {};
        }
        // เก็บค่า raw
        // ตัวอย่าง: styleDef.varStates["hover"]["bg"] = "blue"
        styleDef.varStates[funcName][realAbbr] = finalVal;

        // ใน result ใส่เป็น var(--bg-hover) หรือ var(--bg) ดี?
        // แนะนำใส่ suffix เพื่อกันสับสน
        result[cProp] = `var(--${realAbbr}-${funcName})`;
      } else {
        result[cProp] = finalVal;
      }
    }
  }

  styleDef.states[funcName] = result;
}

/********************************************
 * parseSingleAbbr
 ********************************************/
export function parseSingleAbbr(abbrLine: string, styleDef: IStyleDefinition) {
  const openParenIdx = abbrLine.indexOf('(');
  if (openParenIdx === -1) {
    parseBaseStyle(abbrLine, styleDef);
    return;
  }

  const funcName = abbrLine.slice(0, openParenIdx).trim();
  if (funcName === 'screen') {
    parseScreenStyle(abbrLine, styleDef);
  } else if (funcName === 'container') {
    parseContainerStyle(abbrLine, styleDef);
  } else if (funcName === 'before' || funcName === 'after') {
    parsePseudoElementStyle(abbrLine, styleDef);
  } else {
    // ถือว่าเป็น state
    parseStateStyle(abbrLine, styleDef);
  }
}
/********************************************
 * parseClassDefinition
 ********************************************/
export function parseClassDefinition(className: string, abbrStyle: string): IStyleDefinition {
  const styleDef: IStyleDefinition = {
    base: {},
    states: {},
    screens: [],
    containers: [],
    pseudos: {},
  };

  const lines = abbrStyle
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    parseSingleAbbr(line, styleDef);
  }

  return styleDef;
}
