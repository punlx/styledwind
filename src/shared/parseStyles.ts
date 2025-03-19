// src/shared/parseStyles.ts
import { abbrMap, breakpoints, fontDict } from './constant';

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
    [stateName: string]: Record<string, string>;
  };
  varBase?: Record<string, string>;
  varPseudos?: {
    before?: Record<string, string>;
    after?: Record<string, string>;
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
  if (abbr !== 'f') {
    return [`${abbr}[${propValue}]`];
  }
  const expansion = fontDict.dict[propValue];
  if (!expansion) {
    throw new Error(`[SWD] Font key "${propValue}" not found in theme.font(...) dict.`);
  }
  const tokens = expansion.split(' ');
  for (const t of tokens) {
    if (t.includes('(')) {
      throw new Error(`[SWD] Not allowed nested syntax in font expansion: ${t}`);
    }
  }
  return tokens;
}

export function parseBaseStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const [styleAbbr, propValue] = separateStyleAndProperties(abbrLine);
  if (!styleAbbr) return;

  const expansions = expandFontIfNeeded(styleAbbr, propValue);
  if (expansions.length > 1 || expansions[0] !== `${styleAbbr}[${propValue}]`) {
    for (const ex of expansions) {
      parseBaseStyle(ex, styleDef);
    }
    return;
  }

  if (styleAbbr === 'f') {
    return;
  }

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

/**
 * pseudoName = "before" หรือ "after"
 * abbrLine อาจเป็น something แบบ "after(ct['after'] $bg[yellow] c[blue])"
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
    // แยกเป็น abbr + value จากรูปแบบ abbr[val]
    const [abbr, val] = separateStyleAndProperties(p);
    if (!abbr) continue;

    // เรียก expandFontIfNeeded() เผื่อเจอ f[...] หรือ font key
    // จะได้ array ของ sub-abbr เช่น ["fs[22px]", "fw[500]", ...]
    // ถ้าไม่ใช่ f => ก็จะเป็น [ "bg[red]" ] ธรรมดา
    const expansions = expandFontIfNeeded(abbr, val);

    // วน parse แต่ละ expansion
    for (const ex of expansions) {
      // ex จะเป็นรูป "fs[22px]" หรือ "c[white]" ฯลฯ
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      // เช็คว่าเป็น $variable หรือไม่
      const isVariable = abbr2.startsWith('$');
      const realAbbr = isVariable ? abbr2.slice(1) : abbr2;

      // หา property map จาก abbrMap เช่น fs => "font-size", c => "color", ...
      const cProp = abbrMap[realAbbr as keyof typeof abbrMap];
      if (!cProp) {
        throw new Error(`"${realAbbr}" not found in abbrMap for pseudo-element ${pseudoName}.`);
      }

      // แปลงค่า (ถ้ามี --var)
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
    parseStateStyle(abbrLine, styleDef);
  }
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
