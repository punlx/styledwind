// src/shared/parseStyles/parseBaseStyle.ts

import { fontDict } from '../../client/theme';
import { abbrMap } from '../constant';
import { IStyleDefinition } from '../parseStyles.types';
import {
  convertCSSVariable,
  separateStyleAndProperties,
  detectImportantSuffix, // [ADDED]
} from './parseStylesUtils';

export function parseBaseStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false,
  isQueryBlock: boolean = false
) {
  // [ADDED] ตรวจสอบ !important ก่อน
  const { line: abbrLineNoBang, isImportant } = detectImportantSuffix(abbrLine);

  // --- (คงของเดิม) ---
  const [styleAbbr, propValue] = separateStyleAndProperties(abbrLineNoBang);
  if (!styleAbbr) {
    return;
  }

  // 1) check font shorthand: f[...]
  if (styleAbbr === 'f') {
    const dictEntry = fontDict.dict[propValue] as Record<string, string> | undefined;
    if (!dictEntry) {
      throw new Error(`[SWD-ERR] Font key "${propValue}" not found in theme.font(...) dict.`);
    }
    for (const [cssProp, cssVal] of Object.entries(dictEntry)) {
      // [ADDED] เติม !important ถ้าจำเป็น
      styleDef.base[cssProp] = convertCSSVariable(cssVal) + (isImportant ? ' !important' : '');
    }
    return;
  }

  // 2) local var declaration: --&xxx[...]
  if (styleAbbr.startsWith('--&')) {
    if (isConstContext) {
      throw new Error(`[SWD-ERR] Local var "${styleAbbr}" not allowed inside @const block.`);
    }
    if (isQueryBlock) {
      throw new Error(`[SWD-ERR] Local var "${styleAbbr}" not allowed inside @query block.`);
    }
    // [ADDED] ห้ามใช้ !important กับ localVar
    if (isImportant) {
      throw new Error(`[SWD-ERR] !important is not allowed with local var "${styleAbbr}".`);
    }

    const localVarName = styleAbbr.slice(3); // ตัด "--&"
    if (!styleDef.localVars) {
      styleDef.localVars = {};
    }
    if (styleDef.localVars[localVarName] != null) {
      throw new Error(`[SWD-ERR] local var "${localVarName}" is already declared in this class.`);
    }
    styleDef.localVars[localVarName] = convertCSSVariable(propValue);
    return;
  }

  // 3) check if it's $variable (varBase)
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
      // case $bg[...] => varBase
      if (val2.startsWith('--&')) {
        throw new Error(
          `[SWD-ERR] Local var (--&xxx) is not allowed inside $variable usage. Got "${val2}"`
        );
      }
      if (!styleDef.varBase) {
        styleDef.varBase = {};
      }
      styleDef.varBase[realAbbr] = finalVal;

      // [ADDED] ใส่ !important ถ้า isImportant
      styleDef.base[cssProp] = `var(--${realAbbr})${isImportant ? ' !important' : ''}`;
    } else {
      // --- แก้เป็น partial replace
      if (val2.includes('--&')) {
        const replaced = val2.replace(/--&([\w-]+)/g, (_, varName) => {
          return `LOCALVAR(${varName})`;
        });
        // [ADDED] + !important
        styleDef.base[cssProp] = replaced + (isImportant ? ' !important' : '');
      } else {
        styleDef.base[cssProp] = finalVal + (isImportant ? ' !important' : '');
      }
    }
  }
}
