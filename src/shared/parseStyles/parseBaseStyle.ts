// src/shared/parseStyles/parseBaseStyle.ts

import { typographyDict } from '../../client/theme';
import { abbrMap } from '../constant';
import { IStyleDefinition } from '../parseStyles.types';
import {
  convertCSSVariable,
  separateStyleAndProperties,
  detectImportantSuffix,
} from './parseStylesUtils';

/** เพิ่ม import globalDefineMap & mergeStyleDef */
import { globalDefineMap } from '../../client/theme';
import { mergeStyleDef } from '../../client/styledUtils/mergeStyleDef';

export function parseBaseStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false,
  isQueryBlock: boolean = false
) {
  // ตรวจสอบ !important
  const { line: abbrLineNoBang, isImportant } = detectImportantSuffix(abbrLine);
  if (isConstContext && isImportant) {
    throw new Error(
      `[SWD-ERR] !important is not allowed in @const (or theme.define) block. Found: "${abbrLine}"`
    );
  }

  const [styleAbbr, propValue] = separateStyleAndProperties(abbrLineNoBang);
  if (!styleAbbr) {
    return;
  }

  // ----------------------------------------------------------------
  // 0) ตรวจกรณีชนกันทั้งใน abbrMap และ globalDefineMap
  // ----------------------------------------------------------------
  // เดิมเคยเขียน if (abbrMap[styleAbbr] && globalDefineMap[styleAbbr]) {
  // แต่ TS จะ error => แก้เป็นใช้ in operator แทน
  if (styleAbbr in abbrMap && styleAbbr in globalDefineMap) {
    throw new Error(
      `[SWD-ERR] "${styleAbbr}" is defined in both abbrMap and theme.define(...) - name collision not allowed.`
    );
  }

  // ----- กรณีเป็น local var (--&xxx) -----
  if (styleAbbr.startsWith('--&')) {
    if (isConstContext) {
      throw new Error(
        `[SWD-ERR] Local var "${styleAbbr}" not allowed inside @const/theme.define block.`
      );
    }
    if (isQueryBlock) {
      throw new Error(`[SWD-ERR] Local var "${styleAbbr}" not allowed inside @query block.`);
    }
    if (isImportant) {
      throw new Error(`[SWD-ERR] !important is not allowed with local var "${styleAbbr}".`);
    }

    if (styleDef.localVars == null) {
      styleDef.localVars = {};
    }
    const localVarName = styleAbbr.slice(3); // ตัด "--&"
    if (styleDef.localVars[localVarName] != null) {
      throw new Error(`[SWD-ERR] local var "${localVarName}" is already declared in this class.`);
    }
    styleDef.localVars[localVarName] = convertCSSVariable(propValue);
    return;
  }

  // ----- กรณีเป็น $variable -----
  // ถ้าอยู่ใน isQueryBlock => ไม่อนุญาต
  const isVariable = styleAbbr.startsWith('$');
  if (isVariable && isQueryBlock) {
    throw new Error(
      `[SWD-ERR] Runtime variable ($var) not allowed inside @query block. Found: "${abbrLine}"`
    );
  }

  // ----------------------------------------------------------------
  // 1) ถ้า abbr ไม่อยู่ใน abbrMap => ลองเช็คใน globalDefineMap
  // ----------------------------------------------------------------
  if (!(styleAbbr in abbrMap)) {
    // abbr ไม่อยู่ใน abbrMap
    if (styleAbbr in globalDefineMap) {
      // มีใน globalDefineMap => parse subKey
      const tokens = propValue.split(/\s+/).filter(Boolean);
      if (tokens.length > 1) {
        // ไม่อนุญาตหลาย subKey
        throw new Error(
          `[SWD-ERR] Multiple subKey not allowed. Found: "${styleAbbr}[${propValue}]"`
        );
      }
      const subK = tokens[0];
      if (!subK) {
        throw new Error(`[SWD-ERR] Missing subKey for "${styleAbbr}[...]"`);
      }
      const partialDef = globalDefineMap[styleAbbr][subK];
      if (!partialDef) {
        throw new Error(`[SWD-ERR] "${styleAbbr}[${subK}]" not found in theme.define(...)`);
      }
      mergeStyleDef(styleDef, partialDef);
      return;
    } else {
      // ไม่อยู่ใน abbrMap และไม่อยู่ใน globalDefineMap => error
      throw new Error(
        `"${styleAbbr}" not defined in abbrMap or theme.define(...) (abbrLine=${abbrLine})`
      );
    }
  }

  // ----------------------------------------------------------------
  // 2) ถ้า abbr อยู่ใน abbrMap => ทำ logic แบบเดิม
  // ----------------------------------------------------------------

  // เดิม: if (styleAbbr === 'ty') => typography
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

  // check variable
  if (isVariable) {
    // สมมติ $bg => varBase
    const realAbbr = styleAbbr.slice(1); // ตัด '$'
    const expansions = [`${realAbbr}[${propValue}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      // ใช้ as เพื่อให้ TS ยอม: abbr2 might be string
      const cssProp = abbrMap[abbr2 as keyof typeof abbrMap];
      if (!cssProp) {
        throw new Error(`"${abbr2}" not defined in abbrMap. (abbrLine=${abbrLine})`);
      }
      const finalVal = convertCSSVariable(val2);

      if (!styleDef.varBase) {
        styleDef.varBase = {};
      }
      styleDef.varBase[realAbbr] = finalVal;

      styleDef.base[cssProp] = `var(--${realAbbr})${isImportant ? ' !important' : ''}`;
    }
  } else {
    // กรณีปกติ (ไม่ใช่ $variable)
    // เช่น bg[red], w[100px], ...
    const expansions = [`${styleAbbr}[${propValue}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      const cssProp = abbrMap[abbr2 as keyof typeof abbrMap];
      if (!cssProp) {
        throw new Error(`"${abbr2}" not defined in abbrMap. (abbrLine=${abbrLine})`);
      }
      const finalVal = convertCSSVariable(val2);
      if (val2.includes('--&')) {
        // replace --&xxx => LOCALVAR(xxx)
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
