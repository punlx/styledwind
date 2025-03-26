// src/shared/parseStyles/parseStateStyle.ts
import { fontDict } from '../../client/theme';
import { abbrMap } from '../constant';
import { IStyleDefinition } from '../parseStyles.types';
import { convertCSSVariable, separateStyleAndProperties } from './parseStylesUtils';

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
      } else if (val2.includes('--&')) {
        // partial replace
        const replaced = val2.replace(/--&([\w-]+)/g, (_, varName) => {
          return `LOCALVAR(${varName})`;
        });
        result[cProp] = replaced;
      } else {
        result[cProp] = finalVal;
      }
    }
  }
  styleDef.states[funcName] = result;
}
