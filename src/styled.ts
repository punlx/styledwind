// styled.ts
import { abbrMap } from './constant';
import { generateClassId } from './hash';

// 1) AbbrKey และ InferAbbr ตามที่กล่าว
export type AbbrKey = keyof typeof abbrMap;
type InferAbbr<T> = T extends AbbrKey
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
interface IInsertedRules {
  baseRuleIndex: number;
  stateRuleIndex: Record<string, number>;
  screenRuleIndex: number[];
  baseProps: Set<string>;
}

const mainStyle = document.createElement('style');
mainStyle.id = 'styledwind';
document.head.appendChild(mainStyle);

const styleSheet = mainStyle.sheet as CSSStyleSheet;
const insertedRulesMap = new Map<string, IInsertedRules>();

function separateClass(styleText: TemplateStringsArray) {
  const regex = /\.[\w-]+\s*\{[^}]*\}/g;
  const text: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(styleText[0])) !== null) {
    text.push(match[0]);
  }
  return text;
}
function separateText(classBlock: string) {
  const idx = classBlock.indexOf('{');
  const classNamePart = classBlock.slice(0, idx).trim();
  let abbrStyle = classBlock.slice(idx + 1).trim();
  if (abbrStyle.endsWith('}')) {
    abbrStyle = abbrStyle.slice(0, -1).trim();
  }
  const className = classNamePart.startsWith('.') ? classNamePart.slice(1).trim() : classNamePart;
  return [className, abbrStyle] as const;
}

function separateStyleAndProperties(abbr: string): [string, string] {
  const match = /^(\w+)\[(.*)\]$/.exec(abbr.trim());
  if (!match) {
    return ['', ''];
  }

  return [match[1], match[2]];
}

function parseSingleAbbr(abbrLine: string, styleDef: IStyleDefinition) {
  const openParenIdx = abbrLine.indexOf('(');
  if (openParenIdx === -1) {
    // base
    const [styleAbbr, propValue] = separateStyleAndProperties(abbrLine);
    console.log('styled.ts:88 |styleAbbr| : ', styleAbbr);
    console.log('styled.ts:89 |propValue| : ', propValue);
    if (!styleAbbr) return;
    //@ts-ignore
    const cssProp = abbrMap[styleAbbr];
    if (!cssProp) {
      throw `Property abbr "${styleAbbr}" is not defined in abbrMap.`;
    }
    const finalVal = propValue.startsWith('--') ? `var(${propValue})` : propValue;
    console.log('styled.ts:95 |finalVal| : ', finalVal);
    styleDef.base[cssProp] = finalVal;
    return;
  }
  // ถ้ามี '(' => screen หรือ pseudo
  const funcName = abbrLine.slice(0, openParenIdx).trim();
  const insideParen = abbrLine.slice(openParenIdx + 1, -1).trim();

  if (funcName === 'screen') {
    const commaIndex = insideParen.indexOf(',');
    if (commaIndex === -1) {
      throw `"screen" syntax must have something like: screen(min-w[600px], bg[red])`;
    }
    const screenPart = insideParen.slice(0, commaIndex).trim();
    const propsPart = insideParen.slice(commaIndex + 1).trim();
    const bracketOpen = screenPart.indexOf('[');
    const bracketClose = screenPart.indexOf(']');
    if (bracketOpen === -1 || bracketClose === -1) {
      throw `"screen" must contain something like min-w[600px]. Got ${screenPart}`;
    }
    const screenAbbr = screenPart.slice(0, bracketOpen).trim();
    const screenValue = screenPart.slice(bracketOpen + 1, bracketClose).trim();
    //@ts-ignore
    const screenProp = abbrMap[screenAbbr];
    if (!screenProp || (screenProp !== 'min-width' && screenProp !== 'max-width')) {
      throw `"screen" need "min-w"/"max-w" but got "${screenAbbr}"`;
    }
    const mediaQuery = `(${screenProp}:${screenValue})`;
    const styleInScreenList = propsPart.split(/ (?=[^\[\]]*(?:\[|$))/);
    const screenProps: Record<string, string> = {};
    for (let i = 0; i < styleInScreenList.length; i++) {
      const p = styleInScreenList[i];
      const [stAbbr, stVal] = separateStyleAndProperties(p);
      if (!stAbbr) continue;
      //@ts-ignore
      const stProp = abbrMap[stAbbr];
      if (!stProp) {
        throw `Property abbr "${stAbbr}" is not defined in abbrMap.`;
      }
      const finalVal = stVal.startsWith('--') ? `var(${stVal})` : stVal;
      screenProps[stProp] = finalVal;
    }
    styleDef.screens.push({ query: mediaQuery, props: screenProps });
  } else {
    // pseudo
    const propsInState = insideParen.split(/ (?=[^\[\]]*(?:\[|$))/);
    const result: Record<string, string> = {};
    for (let i = 0; i < propsInState.length; i++) {
      const [stAbbr, stVal] = separateStyleAndProperties(propsInState[i]);
      if (!stAbbr) continue;
      //@ts-ignore
      const stProp = abbrMap[stAbbr];
      if (!stProp) {
        throw `Property abbr "${stAbbr}" is not defined in abbrMap.`;
      }
      const finalVal = stVal.startsWith('--') ? `var(${stVal})` : stVal;
      result[stProp] = finalVal;
    }
    styleDef.states[funcName] = result;
  }
}

function processOneClass(className: string, abbrStyle: string): string {
  const styleDef: IStyleDefinition = {
    base: {},
    states: {},
    screens: [],
  };
  const lines = abbrStyle
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; ++i) {
    parseSingleAbbr(lines[i], styleDef);
  }
  console.log('styled.ts:170 |styleDef| : ', styleDef);
  const uniqueId = generateClassId(className + abbrStyle);
  const displayName = className + '_' + uniqueId;

  // insert base rule
  const baseRuleIndex = styleSheet.insertRule(`.${displayName}{}`, styleSheet.cssRules.length);
  const baseRule = styleSheet.cssRules[baseRuleIndex] as CSSStyleRule;
  const basePropsSet = new Set<string>();

  // fill base
  for (const prop in styleDef.base) {
    const val = styleDef.base[prop];
    baseRule.style.setProperty(prop, val);
    basePropsSet.add(prop);
  }
  // states
  const stateRuleIndex: Record<string, number> = {};
  for (const st in styleDef.states) {
    console.log('styled.ts:187 |st| : ', st);

    const idx = styleSheet.insertRule(`.${displayName}:${st}{}`, styleSheet.cssRules.length);
    const stRule = styleSheet.cssRules[idx] as CSSStyleRule;
    const propsObj = styleDef.states[st];
    for (const p in propsObj) {
      stRule.style.setProperty(p, propsObj[p]);
    }
    stateRuleIndex[st] = idx;
  }

  // screens
  const screenRuleIndex: number[] = [];
  for (let i = 0; i < styleDef.screens.length; i++) {
    const scr = styleDef.screens[i];
    const mediaIndex = styleSheet.insertRule(
      `@media only screen and ${scr.query}{}`,
      styleSheet.cssRules.length
    );
    const mediaRule = styleSheet.cssRules[mediaIndex] as CSSMediaRule;
    const insideIdx = mediaRule.insertRule(`.${displayName}{}`, 0);
    const insideRule = mediaRule.cssRules[insideIdx] as CSSStyleRule;
    for (const p in scr.props) {
      insideRule.style.setProperty(p, scr.props[p]);
    }
    screenRuleIndex.push(mediaIndex);
  }

  insertedRulesMap.set(displayName, {
    baseRuleIndex,
    stateRuleIndex,
    screenRuleIndex,
    baseProps: basePropsSet,
  });

  return displayName;
}

function mapStyle(classes: string[]) {
  const result: Record<string, string> = {};
  for (let i = 0; i < classes.length; i++) {
    const [className, abbrStyle] = separateText(classes[i]);
    const displayName = processOneClass(className, abbrStyle);
    result[className] = displayName;
  }
  return result;
}

function setStyle(className: string, props: Record<string, string>) {
  const info = insertedRulesMap.get(className);
  if (!info) throw `Class "${className}" is not found in insertedRulesMap.`;
  const { baseRuleIndex, baseProps } = info;
  const baseRule = styleSheet.cssRules[baseRuleIndex] as CSSStyleRule;
  for (const abbr in props) {
    //@ts-ignore
    const cssProp = abbrMap[abbr];
    if (!cssProp) {
      throw `"${abbr}" is not found in abbrMap.`;
    }
    if (!baseProps.has(cssProp)) {
      throw `"${abbr}" (${cssProp}) does not exist in class "${className}".`;
    }
    baseRule.style.setProperty(cssProp, props[abbr]);
  }
}

// สุดท้าย ฟังก์ชัน styled (Generic)
export function styled<
  T extends Record<string, AbbrKey | AbbrKey[] | ReadonlyArray<AbbrKey>> = Record<string, never>
>(styleText: TemplateStringsArray): StyledResult<T> {
  // parse
  const classes = separateClass(styleText);
  // map => hashedName
  const styleSheetObj = mapStyle(classes);

  // ผูกเมธอด get(...)
  (styleSheetObj as StyledResult<T>)['get'] = <K extends keyof T>(className: K) => ({
    set: (props: Partial<Record<InferAbbr<T[K]>, string>>) => {
      // จาก "box" -> "box_abc123"
      const hashedName = styleSheetObj[className as string];
      setStyle(hashedName, props as Record<string, string>);
    },
  });

  return styleSheetObj as StyledResult<T>;
}
