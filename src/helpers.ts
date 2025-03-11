import { abbrMap, breakpoints, insertedRulesMap, styleSheet } from './constant';
import { generateClassId } from './hash';

// 1) AbbrKey และ InferAbbr ตามที่กล่าว
export type AbbrKey = keyof typeof abbrMap;
export type InferAbbr<T> = T extends AbbrKey
  ? T
  : T extends ReadonlyArray<infer U>
  ? U extends AbbrKey
    ? U
    : never
  : T extends Array<infer U>
  ? U extends AbbrKey
    ? U
    : never
  : never;

// 2) รูปแบบ return
export type StyledResult<T extends Record<string, AbbrKey | AbbrKey[] | ReadonlyArray<AbbrKey>>> = {
  [K in keyof T]: string;
} & {
  get: <K extends keyof T>(
    className: K
  ) => {
    set: (props: Partial<Record<InferAbbr<T[K]>, string>>) => void;
  };
};

// ------ โค้ดภายใน (IStyleDefinition, insertedRulesMap, parse) -------

interface IStyleDefinition {
  base: Record<string, string>;
  states: Record<string, Record<string, string>>;
  screens: Array<{
    query: string;
    props: Record<string, string>;
  }>;
}

export function separateClass(styleText: TemplateStringsArray) {
  const regex = /\.[\w-]+\s*\{[^}]*\}/g;
  const text: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(styleText[0])) !== null) {
    text.push(match[0]);
  }
  return text;
}
export function separateText(classBlock: string) {
  const idx = classBlock.indexOf('{');
  const classNamePart = classBlock.slice(0, idx).trim();
  let abbrStyle = classBlock.slice(idx + 1).trim();
  if (abbrStyle.endsWith('}')) {
    abbrStyle = abbrStyle.slice(0, -1).trim();
  }
  const className = classNamePart.startsWith('.') ? classNamePart.slice(1).trim() : classNamePart;
  return [className, abbrStyle] as const;
}

export function separateStyleAndProperties(abbr: string): [string, string] {
  const match = /^([\w-]+)\[(.*)\]$/.exec(abbr.trim());
  if (!match) {
    return ['', ''];
  }

  return [match[1], match[2]];
}

export function convertCSSVariable(value: string): string {
  return value.includes('--') ? value.replace(/(--[\w-]+)/g, 'var($1)') : value;
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
  } else {
    parseStateStyle(abbrLine, styleDef);
  }
}

export function parseBaseStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const [styleAbbr, propValue] = separateStyleAndProperties(abbrLine);
  if (!styleAbbr) return;
  const cssProp = abbrMap[styleAbbr as keyof typeof abbrMap];
  if (!cssProp) {
    throw `Property abbr "${styleAbbr}" is not defined in abbrMap.`;
  }
  const finalVal = convertCSSVariable(propValue);
  styleDef.base[cssProp] = finalVal;
}

export function parseScreenStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const openParenIdx = abbrLine.indexOf('(');
  let insideParen = abbrLine.slice(openParenIdx + 1, -1).trim();

  /**
   * breakpoint value ของ user ใน theme.screen
   */
  if (!(insideParen.startsWith('min') || insideParen.startsWith('max'))) {
    const [bp] = insideParen.split(', ');
    insideParen = insideParen.replace(bp, breakpoints.dict[bp]);
  }

  const commaIndex = insideParen.indexOf(',');
  if (commaIndex === -1) {
    throw `"screen" syntax must have something like: screen(min-w[600px], bg[red])`;
  }

  const screenPart = insideParen.slice(0, commaIndex).trim();
  const propsPart = insideParen.slice(commaIndex + 1).trim();
  const bracketOpen = screenPart.indexOf('[');
  const bracketClose = screenPart.indexOf(']');
  // ScreenSizes ใช้เพื่อนำมาเข็คได้ไหม
  if (bracketOpen === -1 || bracketClose === -1) {
    throw `"screen" must contain something like min-w[600px]. Got ${screenPart}`;
  }

  const screenAbbr = screenPart.slice(0, bracketOpen).trim();
  const screenValue = screenPart.slice(bracketOpen + 1, bracketClose).trim();

  const screenProp = abbrMap[screenAbbr as keyof typeof abbrMap];
  if (!screenProp || (screenProp !== 'min-width' && screenProp !== 'max-width')) {
    throw `"screen" needs "min-w"/"max-w" but got "${screenAbbr}"`;
  }

  const mediaQuery = `(${screenProp}:${screenValue})`;
  const styleInScreenList = propsPart.split(/ (?=[^\[\]]*(?:\[|$))/);
  const screenProps: Record<string, string> = {};

  for (let i = 0; i < styleInScreenList.length; i++) {
    const p = styleInScreenList[i];
    const [stAbbr, stVal] = separateStyleAndProperties(p);
    if (!stAbbr) continue;

    const stProp = abbrMap[stAbbr as keyof typeof abbrMap];
    if (!stProp) {
      throw `Property abbr "${stAbbr}" is not defined in abbrMap.`;
    }

    const finalVal = convertCSSVariable(stVal);
    screenProps[stProp] = finalVal;
  }

  styleDef.screens.push({ query: mediaQuery, props: screenProps });
}

export function parseStateStyle(abbrLine: string, styleDef: IStyleDefinition) {
  const openParenIdx = abbrLine.indexOf('(');
  const funcName = abbrLine.slice(0, openParenIdx).trim();
  const insideParen = abbrLine.slice(openParenIdx + 1, -1).trim();

  const propsInState = insideParen.split(/ (?=[^\[\]]*(?:\[|$))/);
  const result: Record<string, string> = {};

  for (let i = 0; i < propsInState.length; i++) {
    const [stAbbr, stVal] = separateStyleAndProperties(propsInState[i]);
    if (!stAbbr) continue;

    const stProp = abbrMap[stAbbr as keyof typeof abbrMap];
    if (!stProp) {
      throw `Property abbr "${stAbbr}" is not defined in abbrMap.`;
    }

    const finalVal = convertCSSVariable(stVal);
    result[stProp] = finalVal;
  }

  styleDef.states[funcName] = result;
}

export function processOneClass(className: string, abbrStyle: string): string {
  const styleDef = parseClassDefinition(className, abbrStyle);
  const uniqueId = generateClassId(className + abbrStyle);
  const displayName = `${className}_${uniqueId}`;

  insertCSSRules(displayName, styleDef);
  registerInsertedClass(displayName, styleDef);

  return displayName;
}

export function parseClassDefinition(className: string, abbrStyle: string): IStyleDefinition {
  const styleDef: IStyleDefinition = { base: {}, states: {}, screens: [] };
  const lines = abbrStyle
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    parseSingleAbbr(lines[i], styleDef);
  }
  return styleDef;
}

export function insertCSSRules(displayName: string, styleDef: IStyleDefinition) {
  // Base rule
  const baseRuleIndex = styleSheet.insertRule(`.${displayName}{}`, styleSheet.cssRules.length);
  const baseRule = styleSheet.cssRules[baseRuleIndex] as CSSStyleRule;

  for (const prop in styleDef.base) {
    baseRule.style.setProperty(prop, styleDef.base[prop]);
  }

  // State rules (hover, focus, etc.)
  for (const state in styleDef.states) {
    const idx = styleSheet.insertRule(`.${displayName}:${state}{}`, styleSheet.cssRules.length);
    const stateRule = styleSheet.cssRules[idx] as CSSStyleRule;
    const propsObj = styleDef.states[state];

    for (const prop in propsObj) {
      stateRule.style.setProperty(prop, propsObj[prop]);
    }
  }

  // Screen (Media Queries)
  for (const screen of styleDef.screens) {
    const mediaIdx = styleSheet.insertRule(
      `@media only screen and ${screen.query} {}`,
      styleSheet.cssRules.length
    );
    const mediaRule = styleSheet.cssRules[mediaIdx] as CSSMediaRule;
    const insideIdx = mediaRule.insertRule(`.${displayName}{}`, 0);
    const insideRule = mediaRule.cssRules[insideIdx] as CSSStyleRule;

    for (const prop in screen.props) {
      insideRule.style.setProperty(prop, screen.props[prop]);
    }
  }
}

export function registerInsertedClass(displayName: string, styleDef: IStyleDefinition) {
  insertedRulesMap.set(displayName, {
    baseRuleIndex: styleSheet.cssRules.length - 1,
    stateRuleIndex: {},
    screenRuleIndex: [],
    baseProps: new Set(Object.keys(styleDef.base)),
  });
}

export function mapStyle(classes: string[]) {
  const result: Record<string, string> = {};
  for (let i = 0; i < classes.length; i++) {
    const [className, abbrStyle] = separateText(classes[i]);
    const displayName = processOneClass(className, abbrStyle);
    result[className] = displayName;
  }
  return result;
}

export function setStyle(className: string, props: Record<string, string>) {
  const info = insertedRulesMap.get(className);
  if (!info) throw `Class "${className}" is not found in insertedRulesMap.`;

  const { baseRuleIndex, baseProps } = info;
  const baseRule = styleSheet.cssRules[baseRuleIndex] as CSSStyleRule;

  for (const abbr in props) {
    if (!abbrMap.hasOwnProperty(abbr)) {
      throw `"${abbr}" is not a valid CSS property in abbrMap.`;
    }
    const cssProp = abbrMap[abbr as keyof typeof abbrMap];

    if (!baseProps.has(cssProp)) {
      throw `"${abbr}" (${cssProp}) does not exist in class "${className}".`;
    }
    baseRule.style.setProperty(cssProp, props[abbr]);
  }
}

// Theme

// ฟังก์ชันสร้าง CSS Variables จาก palette
export function generateCSS(colors: string[][]): string {
  const modes = colors[0]; // ['dark', 'light', 'dim']
  const colorRows = colors.slice(1); // ข้อมูลสี

  if (modes.length !== 3)
    throw new Error('Invalid palette format: modes row should have exactly 3 columns.');

  let css = '';

  for (let modeIndex = 0; modeIndex < modes.length; ++modeIndex) {
    const mode = modes[modeIndex];
    let cssVariables = `.${mode} {\n`;

    for (let index = 0; index < colorRows.length; ++index) {
      const row = colorRows[index];
      let colorName = row[0]; // เช่น "blue-100"
      let colorValue = row[modeIndex + 1]; // ค่าสีของ mode ปัจจุบัน

      cssVariables += `    --${colorName}: ${colorValue};\n`;
    }

    cssVariables += '}\n';
    css += cssVariables;
  }

  return css;
}

// Constructed Stylesheet
const themeSheet = new CSSStyleSheet();

// ใช้ Constructed Stylesheet แทน <style>
export function injectCSS(cssString: string) {
  themeSheet.replaceSync(cssString);
  document.adoptedStyleSheets = [themeSheet];
}

// ฟังก์ชันสลับธีม
export function setTheme(mode: string, modes: string[]) {
  if (modes.indexOf(mode) === -1) {
    throw new Error(`Invalid mode: ${mode} is not defined in palette`);
  }

  document.body.classList.remove(...modes);
  document.body.classList.add(mode);
  localStorage.setItem('styledwind-theme', mode);
}
