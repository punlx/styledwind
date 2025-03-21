// src/shared/parseStyles.ts
import { breakpoints, fontDict } from '../client/theme';
import { abbrMap } from './constant';

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
    [key: string]: Record<string, string> | undefined;
  };

  varStates?: {
    [stateName: string]: Record<string, string>;
  };
  varBase?: Record<string, string>;
  varPseudos?: {
    [key: string]: Record<string, string>;
  };

  rootVars?: Record<string, string>;
}

export function createEmptyStyleDef(): IStyleDefinition {
  return {
    base: {},
    states: {},
    screens: [],
    containers: [],
    pseudos: {},
  };
}

export function separateStyleAndProperties(abbr: string): [string, string] {
  const match = /^([\w\-\$]+)\[(.*)\]$/.exec(abbr.trim());
  if (!match) return ['', ''];
  return [match[1], match[2]];
}

export function convertCSSVariable(value: string) {
  if (value.includes('--')) {
    return value.replace(/(--[\w-]+)/g, 'var($1)');
  }
  return value;
}

function expandFontIfNeeded(abbr: string, propValue: string): string[] {
  return [`${abbr}[${propValue}]`];
}

/**
 * parseBaseStyle:
 * - รับบรรทัด abbr เดี่ยว ๆ (เช่น "bg[red]", "f[tx-content]", "$c[blue]", ...)
 * - ใส่ผลลัพธ์ลงใน styleDef.base
 */
export function parseBaseStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const [styleAbbr, propValue] = separateStyleAndProperties(abbrLine);
  if (!styleAbbr) return;

  // -------------------------------------------------
  // 1) ถ้าเจอ f[...] (เรียกใช้ theme.font)
  //    => ไปดึง object { 'font-size': '22px', 'font-weight': '500', ... }
  //    => ใส่ลง styleDef.base ได้เลย
  // -------------------------------------------------
  if (styleAbbr === 'f') {
    const dictEntry = fontDict.dict[propValue] as Record<string, string> | undefined;
    if (!dictEntry) {
      throw new Error(
        `[SWD-ERR] Font key "${propValue}" not found in theme.font(...) dict. (f[${propValue}])`
      );
    }
    // ใส่แต่ละ prop ลง base
    for (const [cssProp, cssVal] of Object.entries(dictEntry)) {
      // convertCSSVariable() จะ replace '--xxx' ด้วย var(--xxx) ถ้ามี
      styleDef.base[cssProp] = convertCSSVariable(cssVal);
    }
    return;
  }

  // -------------------------------------------------
  // 2) กรณีอื่น ๆ อาจมีการขยาย (expandFontIfNeeded)
  //    (ถ้าไม่ได้ใช้แล้ว สามารถลบส่วนนี้ทิ้งได้)
  // -------------------------------------------------
  const expansions = expandFontIfNeeded(styleAbbr, propValue);
  // ถ้ามี expansions หลายตัว (หรือแตกต่าง) ให้วน parse ซ้ำ
  if (expansions.length > 1 || expansions[0] !== `${styleAbbr}[${propValue}]`) {
    for (const ex of expansions) {
      parseBaseStyle(ex, styleDef);
    }
    return;
  }

  // -------------------------------------------------
  // 3) กรณีเป็น abbr ปกติ (ไม่ใช่ f[...] และไม่ต้องขยาย)
  // -------------------------------------------------
  const isVariable = styleAbbr.startsWith('$');
  const realAbbr = isVariable ? styleAbbr.slice(1) : styleAbbr;

  const cssProp = abbrMap[realAbbr as keyof typeof abbrMap];
  if (!cssProp) {
    throw new Error(`"${realAbbr}" is not defined in abbrMap. (abbrLine=${abbrLine})`);
  }

  const finalVal = convertCSSVariable(propValue);

  if (isVariable) {
    // ถ้าเป็น $variable -> เก็บใน varBase ไว้ใช้ตอน transformVariables
    if (!styleDef.varBase) {
      styleDef.varBase = {};
    }
    styleDef.varBase[realAbbr] = finalVal;
    // ใส่ placeholder ใน base
    styleDef.base[cssProp] = `var(--${realAbbr})`;
  } else {
    // case ปกติ: ใส่ค่าโดยตรง
    styleDef.base[cssProp] = finalVal;
  }
}

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

    // เรียก expandFontIfNeeded
    const expansions = expandFontIfNeeded(abbr, val);
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      // ถ้า abbr2 === 'f' → ไปดึง fontDict
      if (abbr2 === 'f') {
        const dictEntry = fontDict.dict[val2] as Record<string, string> | undefined;
        if (!dictEntry) {
          throw new Error(`"${val2}" not found in theme.font(...) dict (screen).`);
        }
        for (const [cssProp2, cssVal2] of Object.entries(dictEntry)) {
          screenProps[cssProp2] = convertCSSVariable(cssVal2);
        }
      } else {
        const cProp = abbrMap[abbr2 as keyof typeof abbrMap];
        if (!cProp) {
          throw new Error(`"${abbr2}" not found in abbrMap.`);
        }
        screenProps[cProp] = convertCSSVariable(val2);
      }
    }
  }

  styleDef.screens.push({ query: mediaQuery, props: screenProps });
}

export function parseContainerStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const openParenIdx = abbrLine.indexOf('(');
  let inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  const commaIdx = inside.indexOf(',');
  if (commaIdx === -1) {
    throw new Error(`"container" syntax error: ${abbrLine}`);
  }

  let containerPart = inside.slice(0, commaIdx).trim();
  const propsPart = inside.slice(commaIdx + 1).trim();

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

    const expansions = expandFontIfNeeded(abbr, val);
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      // ตรวจ f[...] เช่นกัน
      if (abbr2 === 'f') {
        const dictEntry = fontDict.dict[val2] as Record<string, string> | undefined;
        if (!dictEntry) {
          throw new Error(`"${val2}" not found in theme.font(...) dict (container).`);
        }
        for (const [cssProp2, cssVal2] of Object.entries(dictEntry)) {
          containerProps[cssProp2] = convertCSSVariable(cssVal2);
        }
      } else {
        const cProp2 = abbrMap[abbr2 as keyof typeof abbrMap];
        if (!cProp2) {
          throw new Error(`"${abbr2}" not found in abbrMap.`);
        }
        containerProps[cProp2] = convertCSSVariable(val2);
      }
    }
  }

  styleDef.containers.push({
    query: containerQuery,
    props: containerProps,
  });
}

/**
 * pseudoName = "before" หรือ "after"
 * abbrLine อาจเป็น something แบบ "after(ct['after'] $bg[yellow] c[blue] f[tx-content])"
 */
export function parsePseudoElementStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const openParenIdx = abbrLine.indexOf('(');
  const pseudoName = abbrLine.slice(0, openParenIdx).trim() as 'before' | 'after';
  const inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  // array ของ abbr เช่น ["ct['after']", "$bg[yellow]", "c[blue]", "f[display-1]"]
  const propsInPseudo = inside.split(/ (?=[^\[\]]*(?:\[|$))/);

  // สร้าง result (props ธรรมดา) เช่น { content: 'after', background-color: 'yellow' }
  const result: Record<string, string> = styleDef.pseudos[pseudoName] || {};

  // ถ้าระบบรองรับ varPseudos:
  styleDef.varPseudos = styleDef.varPseudos || {};
  styleDef.varPseudos[pseudoName] = styleDef.varPseudos[pseudoName] || {};

  for (const p of propsInPseudo) {
    const [abbr, val] = separateStyleAndProperties(p);
    if (!abbr) continue;

    // ถ้าเป็น ct[...] => content
    if (abbr === 'ct') {
      result['content'] = `"${val}"`;
      continue;
    }

    // expand
    const expansions = expandFontIfNeeded(abbr, val);
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      const isVariable = abbr2.startsWith('$');
      const realAbbr = isVariable ? abbr2.slice(1) : abbr2;

      // กรณีเจอ f[...] => ดึงจาก fontDict
      if (realAbbr === 'f') {
        const dictEntry = fontDict.dict[val2] as Record<string, string> | undefined;
        if (!dictEntry) {
          throw new Error(
            `[SWD-ERR] Font key "${val2}" not found in theme.font(...) dict for pseudo ${pseudoName}.`
          );
        }
        for (const [cssProp2, cssVal2] of Object.entries(dictEntry)) {
          result[cssProp2] = convertCSSVariable(cssVal2);
        }
        continue;
      }

      // หา property map จาก abbrMap เช่น bg => "background-color", c => "color", ...
      const cProp = abbrMap[realAbbr as keyof typeof abbrMap];
      if (!cProp) {
        throw new Error(`"${realAbbr}" not found in abbrMap for pseudo-element ${pseudoName}.`);
      }

      const finalVal = convertCSSVariable(val2);

      if (isVariable) {
        // เก็บ varPseudos
        styleDef.varPseudos[pseudoName]![realAbbr] = finalVal;
        // ใส่ placeholder เป็น var(--xxx-before/after)
        result[cProp] = `var(--${realAbbr}-${pseudoName})`;
      } else {
        // case ปกติ: ใส่ค่าตรง ๆ
        result[cProp] = finalVal;
      }
    }
  }

  // อัปเดต styleDef
  styleDef.pseudos[pseudoName] = result;
}

export function parseStateStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const openParenIdx = abbrLine.indexOf('(');
  const funcName = abbrLine.slice(0, openParenIdx).trim();
  const inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  const propsInState = inside.split(/ (?=[^\[\]]*(?:\[|$))/);
  const result: Record<string, string> = {};

  for (const p of propsInState) {
    const [abbr, val] = separateStyleAndProperties(p);
    if (!abbr) continue;

    const expansions = expandFontIfNeeded(abbr, val);
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      const isVariable = abbr2.startsWith('$');
      const realAbbr = isVariable ? abbr2.slice(1) : abbr2;

      // ถ้าเจอ f[...] => fontDict
      if (realAbbr === 'f') {
        const dictEntry = fontDict.dict[val2] as Record<string, string> | undefined;
        if (!dictEntry) {
          throw new Error(
            `[SWD-ERR] Font key "${val2}" not found in theme.font(...) dict for state ${funcName}.`
          );
        }
        for (const [cssProp2, cssVal2] of Object.entries(dictEntry)) {
          result[cssProp2] = convertCSSVariable(cssVal2);
        }
        continue;
      }

      const cProp = abbrMap[realAbbr as keyof typeof abbrMap];
      if (!cProp) {
        throw new Error(`"${realAbbr}" not found in abbrMap for state ${funcName}.`);
      }

      const finalVal = convertCSSVariable(val2);

      if (isVariable) {
        if (!styleDef.varStates) {
          styleDef.varStates = {};
        }
        if (!styleDef.varStates[funcName]) {
          styleDef.varStates[funcName] = {};
        }
        styleDef.varStates[funcName][realAbbr] = finalVal;
        result[cProp] = `var(--${realAbbr}-${funcName})`;
      } else {
        result[cProp] = finalVal;
      }
    }
  }

  styleDef.states[funcName] = result;
}

export function parseSingleAbbr(abbrLine: string, styleDef: IStyleDefinition) {
  const trimmed = abbrLine.trim();

  // 1) เช็ค screen(...)
  if (trimmed.startsWith('screen(')) {
    parseScreenStyle(trimmed, styleDef);
    return;
  }

  // 2) เช็ค container(...)
  if (trimmed.startsWith('container(')) {
    parseContainerStyle(trimmed, styleDef);
    return;
  }

  // 3) เช็ค pseudo element before(...), after(...)
  if (trimmed.startsWith('before(') || trimmed.startsWith('after(')) {
    parsePseudoElementStyle(trimmed, styleDef);
    return;
  }

  // 4) เช็ค state (ตัวอย่าง: hover, focus, active, disabled, ...)
  const knownStates = ['hover', 'focus', 'active', 'focus-within', 'focus-visible', 'target'];
  for (const st of knownStates) {
    if (trimmed.startsWith(st + '(')) {
      parseStateStyle(trimmed, styleDef);
      return;
    }
  }

  // 5) ถ้าไม่เข้าเงื่อนไขด้านบน => parse เป็น base style
  //    (รองรับ h[calc(100%-24px)], bg[linear-gradient(...)], ฯลฯ)
  parseBaseStyle(trimmed, styleDef);
}

export function parseClassDefinition(abbrStyle: string): IStyleDefinition {
  const styleDef = createEmptyStyleDef();
  const rowsAbbr = abbrStyle
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const abbr of rowsAbbr) {
    parseSingleAbbr(abbr, styleDef);
  }

  return styleDef;
}
