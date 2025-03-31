// src/shared/parseStyles/parseBaseStyle.ts

import { typographyDict } from '../../client/theme';
import { abbrMap } from '../constant';
import { IStyleDefinition } from '../parseStyles.types';
import {
  convertCSSVariable,
  separateStyleAndProperties,
  detectImportantSuffix,
} from './parseStylesUtils';

export function parseBaseStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false,
  isQueryBlock: boolean = false
) {
  // ตรวจสอบ !important
  const { line: abbrLineNoBang, isImportant } = detectImportantSuffix(abbrLine);
  if (isConstContext && isImportant) {
    throw new Error(`[SWD-ERR] !important is not allowed in @const block. Found: "${abbrLine}"`);
  }

  const [styleAbbr, propValue] = separateStyleAndProperties(abbrLineNoBang);
  if (!styleAbbr) {
    return;
  }

  // -----
  // เดิม: if (styleAbbr === 'f') => ดึงจาก fontDict
  // ใหม่: if (styleAbbr === 'ty') => ดึงจาก typographyDict
  // -----
  if (styleAbbr === 'ty') {
    const dictEntry = typographyDict.dict[propValue];
    if (!dictEntry) {
      throw new Error(
        `[SWD-ERR] Typography key "${propValue}" not found in theme.typography(...) dict.`
      );
    }
    for (const [cssProp, cssVal] of Object.entries(dictEntry)) {
      styleDef.base[cssProp] = convertCSSVariable(cssVal) + (isImportant ? ' !important' : '');
    }
    return;
  }

  // ตรวจ local var
  if (styleAbbr.startsWith('--&')) {
    if (isConstContext) {
      throw new Error(`[SWD-ERR] Local var "${styleAbbr}" not allowed inside @const block.`);
    }
    if (isQueryBlock) {
      throw new Error(`[SWD-ERR] Local var "${styleAbbr}" not allowed inside @query block.`);
    }
    if (isImportant) {
      throw new Error(`[SWD-ERR] !important is not allowed with local var "${styleAbbr}".`);
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

  // check $variable
  const isVariable = styleAbbr.startsWith('$');
  const realAbbr = isVariable ? styleAbbr.slice(1) : styleAbbr;
  const expansions = [`${realAbbr}[${propValue}]`];
  if (isVariable && isQueryBlock) {
    throw new Error(`[SWD-ERR] $variable ("${styleAbbr}") not allowed inside @query block.`);
  }

  for (const ex of expansions) {
    const [abbr2, val2] = separateStyleAndProperties(ex);
    if (!abbr2) continue;

    const cssProp = abbrMap[abbr2 as keyof typeof abbrMap];
    if (!cssProp) {
      throw new Error(`"${abbr2}" not defined in abbrMap. (abbrLine=${abbrLine})`);
    }
    const finalVal = convertCSSVariable(val2);

    if (isVariable) {
      if (val2.startsWith('--&')) {
        throw new Error(
          `[SWD-ERR] Local var (--&xxx) is not allowed inside $variable usage. Got "${val2}"`
        );
      }
      if (!styleDef.varBase) {
        styleDef.varBase = {};
      }
      styleDef.varBase[realAbbr] = finalVal;

      styleDef.base[cssProp] = `var(--${realAbbr})${isImportant ? ' !important' : ''}`;
    } else {
      // replace '--&' if exist
      if (val2.includes('--&')) {
        const replaced = val2.replace(/--&([\w-]+)/g, (_, varName) => {
          return `LOCALVAR(${varName})`;
        });
        styleDef.base[cssProp] = replaced + (isImportant ? ' !important' : '');
      } else {
        styleDef.base[cssProp] = finalVal + (isImportant ? ' !important' : '');
      }
    }
  }
}
