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

export function parsePseudoElementStyle(abbrLine: string, styleDef: IStyleDefinition) {
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

    const expansions = [`${abbr}[${val}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      const isVariable = abbr2.startsWith('$');
      const realAbbr = isVariable ? abbr2.slice(1) : abbr2;
      const cProp = abbrMap[realAbbr as keyof typeof abbrMap];
      if (!cProp) {
        throw new Error(`"${realAbbr}" not found in abbrMap for pseudo-element ${pseudoName}.`);
      }
      const finalVal = convertCSSVariable(val2);

      if (isVariable) {
        styleDef.varPseudos[pseudoName]![realAbbr] = finalVal;
        result[cProp] = `var(--${realAbbr}-${pseudoName})`;
      } else {
        result[cProp] = finalVal;
      }
    }
  }

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
    // base style
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

/**
 * mergeStyleDef:
 *   เอา source (template) ไปใส่ใน target (class) ถ้าเจอ prop ซ้ำ => throw
 */
export function mergeStyleDef(source: IStyleDefinition, target: IStyleDefinition): void {
  // base
  for (const prop in source.base) {
    if (target.base[prop]) {
      throw new Error(`[SWD-ERR] base prop collision "${prop}".`);
    }
    target.base[prop] = source.base[prop];
  }
  // varBase
  if (source.varBase) {
    target.varBase = target.varBase || {};
    for (const vName in source.varBase) {
      if (target.varBase[vName]) {
        throw new Error(`[SWD-ERR] varBase collision "$${vName}".`);
      }
      target.varBase[vName] = source.varBase[vName];
    }
  }
  // states
  for (const st in source.states) {
    if (!target.states[st]) {
      target.states[st] = {};
    } else {
      for (const prop in source.states[st]) {
        if (target.states[st][prop]) {
          throw new Error(`[SWD-ERR] state:${st} collision prop "${prop}".`);
        }
      }
    }
    Object.assign(target.states[st], source.states[st]);
  }
  // varStates
  if (source.varStates) {
    target.varStates = target.varStates || {};
    for (const st in source.varStates) {
      if (!target.varStates[st]) {
        target.varStates[st] = {};
      } else {
        for (const vName in source.varStates[st]) {
          if (target.varStates[st][vName]) {
            throw new Error(`[SWD-ERR] varState:${st} collision "$${vName}".`);
          }
        }
      }
      Object.assign(target.varStates[st], source.varStates[st]);
    }
  }
  // pseudos
  for (const pName in source.pseudos) {
    if (!target.pseudos[pName]) {
      target.pseudos[pName] = {};
    } else {
      for (const prop in source.pseudos[pName]!) {
        if (target.pseudos[pName]![prop]) {
          throw new Error(`[SWD-ERR] pseudo:${pName} collision prop "${prop}".`);
        }
      }
    }
    Object.assign(target.pseudos[pName], source.pseudos[pName]);
  }
  // varPseudos
  if (source.varPseudos) {
    target.varPseudos = target.varPseudos || {};
    for (const pName in source.varPseudos) {
      if (!target.varPseudos[pName]) {
        target.varPseudos[pName] = {};
      } else {
        for (const vName in source.varPseudos[pName]!) {
          if (target.varPseudos[pName]![vName]) {
            throw new Error(`[SWD-ERR] varPseudo:${pName} collision "$${vName}".`);
          }
        }
      }
      Object.assign(target.varPseudos[pName], source.varPseudos[pName]);
    }
  }
  // screens
  for (const sObj of source.screens) {
    target.screens.push(sObj);
  }
  // containers
  for (const cObj of source.containers) {
    target.containers.push(cObj);
  }
}
