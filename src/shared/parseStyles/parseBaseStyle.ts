// ================================================
// src/shared/parseStyles/parseBaseStyle.ts
// ================================================
import { fontDict } from '../../client/theme';
import { abbrMap } from '../constant';
import { IStyleDefinition } from './parseStyles.types';
import { convertCSSVariable, separateStyleAndProperties } from './parseStylesUtils';
export function parseBaseStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false,
  isQueryBlock: boolean = false
) {
  const [styleAbbr, propValue] = separateStyleAndProperties(abbrLine);
  if (!styleAbbr) {
    return;
  }
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
  if (styleAbbr.startsWith('--$')) {
    if (isConstContext) {
      throw new Error(`[SWD-ERR] Local var "${styleAbbr}" not allowed inside @const block.`);
    }
    if (isQueryBlock) {
      throw new Error(`[SWD-ERR] Local var "${styleAbbr}" not allowed inside @query block.`);
    }
    const localVarName = styleAbbr.slice(3);
    if (!styleDef.localVars) {
      styleDef.localVars = {};
    }
    if (styleDef.localVars[localVarName] != null) {
      throw new Error(`[SWD-ERR] local var "${localVarName}" is already declared in this class.`);
    }
    styleDef.localVars[localVarName] = convertCSSVariable(propValue);
    return;
  }
  const isVariable = styleAbbr.startsWith('$');
  const realAbbr = isVariable ? styleAbbr.slice(1) : styleAbbr;
  const expansions = [`${realAbbr}[${propValue}]`];
  if (isVariable) {
    if (isQueryBlock) {
      throw new Error(`[SWD-ERR] $variable ("${styleAbbr}") not allowed inside @query block.`);
    }
  }
  for (const ex of expansions) {
    const [abbr2, val2] = separateStyleAndProperties(ex);
    if (!abbr2) {
      continue;
    }
    const cssProp = abbrMap[abbr2 as keyof typeof abbrMap];
    if (!cssProp) {
      throw new Error(`"${abbr2}" not defined in abbrMap. (abbrLine=${abbrLine})`);
    }
    const finalVal = convertCSSVariable(val2);
    if (isVariable) {
      if (!styleDef.varBase) {
        styleDef.varBase = {};
      }
      styleDef.varBase[realAbbr] = finalVal;
      styleDef.base[cssProp] = `var(--${realAbbr})`;
    } else {
      if (val2.startsWith('--$')) {
        const localVarRefName = val2.slice(3);
        styleDef.base[cssProp] = `LOCALVAR(${localVarRefName})`;
      } else {
        styleDef.base[cssProp] = finalVal;
      }
    }
  }
}
