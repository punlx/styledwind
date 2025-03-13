// helpers.ts
import { abbrMap, breakpoints } from './constant';

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
}

/************************************************************
 * ฟังก์ชัน parse base / screen / container / pseudo ฯลฯ
 ************************************************************/

/** แยก "bg[pink]" => ["bg","pink"] */
export function separateStyleAndProperties(abbr: string): [string, string] {
  const match = /^([\w-]+)\[(.*)\]$/.exec(abbr.trim());
  if (!match) return ['', ''];
  return [match[1], match[2]];
}

/** ถ้าเจอ var(--xxx) หรือ --xxx ก็แทนด้วย var(--xxx) */
export function convertCSSVariable(value: string) {
  if (value.includes('--')) {
    return value.replace(/(--[\w-]+)/g, 'var($1)');
  }
  return value;
}

export function parseBaseStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const [styleAbbr, propValue] = separateStyleAndProperties(abbrLine);
  if (!styleAbbr) return;
  const cssProp = abbrMap[styleAbbr as keyof typeof abbrMap];
  if (!cssProp) {
    throw new Error(`"${styleAbbr}" is not defined in abbrMap.`);
  }
  styleDef.base[cssProp] = convertCSSVariable(propValue);
}

/** screen(min-w[600px], bg[red]) */
export function parseScreenStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const openParenIdx = abbrLine.indexOf('(');
  let inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  // ถ้าไม่ใช่ min/max อาจเป็น key breakpoint
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
    const cProp = abbrMap[abbr as keyof typeof abbrMap];
    if (!cProp) throw new Error(`"${abbr}" not found in abbrMap.`);
    screenProps[cProp] = convertCSSVariable(val);
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
    const cProp2 = abbrMap[abbr as keyof typeof abbrMap];
    if (!cProp2) throw new Error(`"${abbr}" not found in abbrMap.`);
    containerProps[cProp2] = convertCSSVariable(val);
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

    const cProp = abbrMap[abbr as keyof typeof abbrMap];
    if (!cProp) throw new Error(`"${abbr}" not found in abbrMap.`);
    if (abbr === 'content' && val === '') {
      throw new Error(`Pseudo-element content[] must not be empty.`);
    }
    result[cProp] = convertCSSVariable(val);
  }

  styleDef.pseudos[funcName] = result;
}

/** hover(bg[red]) / focus(fs[20px]) */
export function parseStateStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const openParenIdx = abbrLine.indexOf('(');
  const funcName = abbrLine.slice(0, openParenIdx).trim();
  const inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  const propsInState = inside.split(/ (?=[^\[\]]*(?:\[|$))/);
  const result: Record<string, string> = {};

  for (const p of propsInState) {
    const [abbr, val] = separateStyleAndProperties(p);
    if (!abbr) continue;
    const cProp = abbrMap[abbr as keyof typeof abbrMap];
    if (!cProp) throw new Error(`"${abbr}" not found in abbrMap.`);
    result[cProp] = convertCSSVariable(val);
  }

  styleDef.states[funcName] = result;
}

/************************************************************
 * parseSingleAbbr => dispatch ไปยัง parser ย่อย
 ************************************************************/
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

/************************************************************
 * รวมเป็น parseClassDefinition()
 ************************************************************/
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
