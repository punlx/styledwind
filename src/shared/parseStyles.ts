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

  // ฟิลด์ใหม่สำหรับ local var
  localVars?: Record<string, string>;
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
    // เช่น "--$xxx" หรือ "--global-var"
    return value.replace(/(--[\w-]+)/g, 'var($1)');
  }
  return value;
}

/**
 * parseSingleAbbr:
 * - parse directive "screen(...)", "container(...)", "hover(...)" ฯลฯ
 * - ถ้าไม่เข้า => parseBaseStyle
 */
export function parseSingleAbbr(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {

  const trimmed = abbrLine.trim();

  // 1) screen(...)
  if (trimmed.startsWith('screen(')) {
    parseScreenStyle(trimmed, styleDef, isConstContext);
    return;
  }

  // 2) container(...)
  if (trimmed.startsWith('container(')) {
    parseContainerStyle(trimmed, styleDef, isConstContext);
    return;
  }

  // 3) pseudo element before(...), after(...)
  if (trimmed.startsWith('before(') || trimmed.startsWith('after(')) {
    parsePseudoElementStyle(trimmed, styleDef, isConstContext);
    return;
  }

  // 4) state
  const knownStates = [
    'hover',
    'focus',
    'active',
    'focus-within',
    'focus-visible',
    'target',
    'disabled',
  ];
  for (const st of knownStates) {
    if (trimmed.startsWith(st + '(')) {
      parseStateStyle(trimmed, styleDef, isConstContext);
      return;
    }
  }

  // 5) base style
  parseBaseStyle(trimmed, styleDef, isConstContext);
}

// ---------------------------------------------------------
// parseBaseStyle
// ---------------------------------------------------------
export function parseBaseStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {

  const [styleAbbr, propValue] = separateStyleAndProperties(abbrLine);
  if (!styleAbbr) return;

  // 1) f[...] => theme.font
  if (styleAbbr === 'f') {
    const dictEntry = fontDict.dict[propValue] as Record<string, string> | undefined;
    if (!dictEntry) {
      throw new Error(`[SWD-ERR] Font key "${propValue}" not found in theme.font(...) dict.`);
    }
    for (const [cssProp, cssVal] of Object.entries(dictEntry)) {
      styleDef.base[cssProp] = convertCSSVariable(cssVal);
    }
    return;
  }

  const expansions = [`${styleAbbr}[${propValue}]`];
  const [abbr2, val2] = expansions[0].split(/\[|]/).map((s) => s.trim());


  // ประกาศ local var => --$xxx[..]
  if (abbr2.startsWith('--$')) {
    if (isConstContext) {
      throw new Error(`[SWD-ERR] Local var "${abbr2}" not allowed inside @const block.`);
    }
    if (!styleDef.localVars) {
      styleDef.localVars = {};
    }
    const localVarName = abbr2.slice(3);
    if (styleDef.localVars[localVarName] != null) {
      throw new Error(`[SWD-ERR] local var "${localVarName}" is already declared in this class.`);
    }
    styleDef.localVars[localVarName] = convertCSSVariable(val2);
    return;
  }

  // อ้างอิง local var => val2 = --$xxx
  if (val2.startsWith('--$')) {
    const cProp = abbrMap[abbr2 as keyof typeof abbrMap];
    if (!cProp) {
      throw new Error(`"${abbr2}" is not in abbrMap.`);
    }
    const localVarRefName = val2.slice(3);
    styleDef.base[cProp] = `LOCALVAR(${localVarRefName})`;
    return;
  }

  // กรณี $variable หรือ abbr ปกติ
  const isVariable = abbr2.startsWith('$');
  const realAbbr = isVariable ? abbr2.slice(1) : abbr2;
  const cssProp = abbrMap[realAbbr as keyof typeof abbrMap];
  if (!cssProp) {
    throw new Error(`"${realAbbr}" not defined in abbrMap. (abbrLine=${abbrLine})`);
  }
  const finalVal = convertCSSVariable(val2);

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

// ---------------------------------------------------------
// parseScreenStyle
// ---------------------------------------------------------
export function parseScreenStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {

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

    const expansions = [`${abbr}[${val}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

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

        // >>> เพิ่ม logic ตรวจ --$ (local var)
        if (val2.startsWith('--$')) {
          const localVarRefName = val2.slice(3);
          screenProps[cProp] = `LOCALVAR(${localVarRefName})`;
        } else {
          screenProps[cProp] = convertCSSVariable(val2);
        }
      }
    }
  }

  styleDef.screens.push({ query: mediaQuery, props: screenProps });
}

// ---------------------------------------------------------
// parseContainerStyle
// ---------------------------------------------------------
export function parseContainerStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {

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

    const expansions = [`${abbr}[${val}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

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

        // >>> เพิ่ม logic ตรวจ --$ (local var)
        if (val2.startsWith('--$')) {
          const localVarRefName = val2.slice(3);
          containerProps[cProp2] = `LOCALVAR(${localVarRefName})`;
        } else {
          containerProps[cProp2] = convertCSSVariable(val2);
        }
      }
    }
  }

  styleDef.containers.push({
    query: containerQuery,
    props: containerProps,
  });
}

// ---------------------------------------------------------
// parsePseudoElementStyle
// ---------------------------------------------------------
export function parsePseudoElementStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {

  const openParenIdx = abbrLine.indexOf('(');
  const pseudoName = abbrLine.slice(0, openParenIdx).trim() as 'before' | 'after';
  const inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  const propsInPseudo = inside.split(/ (?=[^\[\]]*(?:\[|$))/);

  const result: Record<string, string> = styleDef.pseudos[pseudoName] || {};
  styleDef.varPseudos = styleDef.varPseudos || {};
  styleDef.varPseudos[pseudoName] = styleDef.varPseudos[pseudoName] || {};

  for (const p of propsInPseudo) {
    const [abbr, val] = separateStyleAndProperties(p);
    if (!abbr) continue;

    if (abbr === 'ct') {
      result['content'] = `"${val}"`;
      continue;
    }

    const expansions = [`${abbr}[${val}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      const isVariable = abbr2.startsWith('$');
      const realAbbr = isVariable ? abbr2.slice(1) : abbr2;

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

      const cProp = abbrMap[realAbbr as keyof typeof abbrMap];
      if (!cProp) {
        throw new Error(`"${realAbbr}" not found in abbrMap for pseudo-element ${pseudoName}.`);
      }

      // convertCSSVariable
      const finalVal = convertCSSVariable(val2);

      // case $variable => varPseudos
      if (isVariable) {
        styleDef.varPseudos[pseudoName]![realAbbr] = finalVal;
        result[cProp] = `var(--${realAbbr}-${pseudoName})`;
      }
      // >>> เพิ่มตรวจสอบ local var reference (--$xxx) <<<
      else if (val2.startsWith('--$')) {
        const localVarRefName = val2.slice(3);
        result[cProp] = `LOCALVAR(${localVarRefName})`;
      } else {
        // ปกติ
        result[cProp] = finalVal;
      }
    }
  }

  styleDef.pseudos[pseudoName] = result;
}

// ---------------------------------------------------------
// parseStateStyle
// ---------------------------------------------------------
export function parseStateStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {
  const openParenIdx = abbrLine.indexOf('(');
  const funcName = abbrLine.slice(0, openParenIdx).trim();
  const inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  const propsInState = inside.split(/ (?=[^\[\]]*(?:\[|$))/);
  const result: Record<string, string> = {};

  for (const p of propsInState) {
    const [abbr, val] = separateStyleAndProperties(p);
    if (!abbr) continue;

    const expansions = [`${abbr}[${val}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      const isVariable = abbr2.startsWith('$');
      const realAbbr = isVariable ? abbr2.slice(1) : abbr2;

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

      // convertCSSVariable
      let finalVal = convertCSSVariable(val2);

      if (isVariable) {
        if (!styleDef.varStates) {
          styleDef.varStates = {};
        }
        if (!styleDef.varStates[funcName]) {
          styleDef.varStates[funcName] = {};
        }
        styleDef.varStates[funcName][realAbbr] = finalVal;
        result[cProp] = `var(--${realAbbr}-${funcName})`;
      }
      // >>> เพิ่ม logic local var reference (--$xxx) <<<
      else if (val2.startsWith('--$')) {
        const localVarRefName = val2.slice(3);
        result[cProp] = `LOCALVAR(${localVarRefName})`;
      } else {
        result[cProp] = finalVal;
      }
    }
  }

  styleDef.states[funcName] = result;
}
