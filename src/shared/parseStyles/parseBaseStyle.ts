/**
 * parseSingleAbbr:
 * - parse directive "screen(...)", "container(...)", "hover(...)" ฯลฯ
 * - ถ้าไม่เข้า => parseBaseStyle
 */

import { fontDict } from '../../client/theme';
import { abbrMap } from '../constant';
import { IStyleDefinition } from './parseStyles.types';
import { convertCSSVariable, separateStyleAndProperties } from './parseStylesUtils';

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
