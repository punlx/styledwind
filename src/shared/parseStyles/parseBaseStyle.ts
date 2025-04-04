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
  // 1) ตรวจ !important + แยก abbr / prop
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

  // 2) ถ้า abbr ซ้ำทั้ง abbrMap และ globalDefineMap => error
  if (styleAbbr in abbrMap && styleAbbr in globalDefineMap) {
    throw new Error(
      `[SWD-ERR] "${styleAbbr}" is defined in both abbrMap and theme.define(...) - name collision not allowed.`
    );
  }

  // 3) เช็คกรณี local var (--&xxx)
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

    if (!styleDef.localVars) {
      styleDef.localVars = {};
    }
    const localVarName = styleAbbr.slice(3); // ตัด "--&"
    if (styleDef.localVars[localVarName] != null) {
      throw new Error(`[SWD-ERR] local var "${localVarName}" is already declared in this class.`);
    }
    styleDef.localVars[localVarName] = convertCSSVariable(propValue);
    return;
  }

  // 4) เช็คกรณี $variable
  const isVariable = styleAbbr.startsWith('$');
  if (isVariable) {
    // ถ้าอยู่ใน @query => ห้าม
    if (isQueryBlock) {
      throw new Error(
        `[SWD-ERR] Runtime variable ($var) not allowed inside @query block. Found: "${abbrLine}"`
      );
    }

    // parse $var
    // ตัวอย่าง: $bg => varBase
    const realAbbr = styleAbbr.slice(1); // ตัด '$'
    const expansions = [`${realAbbr}[${propValue}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      // เช็คว่า abbr2 อยู่ใน abbrMap ไหม
      const cssProp = abbrMap[abbr2 as keyof typeof abbrMap];
      if (!cssProp) {
        // ถ้าไม่เจอ => แสดงว่า $variable นี้ใช้ abbr2 ที่ไม่อยู่ใน abbrMap
        // โค้ดเดิมจะ throw => หรือจะอนุญาต ? => สมมติเราอนุญาตเฉพาะ abbr ที่อยู่ใน abbrMap
        throw new Error(`"${abbr2}" not defined in abbrMap for $variable. (abbrLine=${abbrLine})`);
      }
      const finalVal = convertCSSVariable(val2);

      if (!styleDef.varBase) {
        styleDef.varBase = {};
      }
      styleDef.varBase[realAbbr] = finalVal;

      styleDef.base[cssProp] = `var(--${realAbbr})${isImportant ? ' !important' : ''}`;
    }
    return;
  }

  // 5) ถ้าไม่ใช่ local var และไม่ใช่ $var => เช็ค abbrMap หรือ globalDefineMap
  if (!(styleAbbr in abbrMap)) {
    // ไม่อยู่ใน abbrMap => ลองเช็ค globalDefineMap
    if (styleAbbr in globalDefineMap) {
      // มีใน globalDefineMap => parse subKey
      const tokens = propValue.split(/\s+/).filter(Boolean);
      if (tokens.length > 1) {
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
    }
    // ไม่อยู่ใน abbrMap และไม่อยู่ใน globalDefineMap => throw
    throw new Error(
      `"${styleAbbr}" not defined in abbrMap or theme.define(...) (abbrLine=${abbrLine})`
    );
  }

  // 6) ถ้าอยู่ใน abbrMap => parse แบบปกติ (เช่น bg[red], w[100px])
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
