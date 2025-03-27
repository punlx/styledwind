// src/shared/parseStyles/parseStateStyle.ts

import { fontDict } from '../../client/theme';
import { abbrMap } from '../constant';
import { IStyleDefinition } from '../parseStyles.types';
import {
  convertCSSVariable,
  separateStyleAndProperties,
  detectImportantSuffix, // ฟังก์ชันจับ '!' ด้านท้าย
} from './parseStylesUtils';

export function parseStateStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {
  const openParenIdx = abbrLine.indexOf('(');
  const funcName = abbrLine.slice(0, openParenIdx).trim(); // "hover"
  const inside = abbrLine.slice(openParenIdx + 1, -1).trim(); // "bg[red]! d[flex]"

  // แยก prop ในวงเล็บ => ["bg[red]!", "d[flex]"]
  const propsInState = inside.split(/ (?=[^\[\]]*(?:\[|$))/);
  const result: Record<string, string> = {};

  for (const p of propsInState) {
    // 1) ตรวจจับ !important ใน token หลัก
    const { line: tokenNoBang, isImportant } = detectImportantSuffix(p);
    // 2) parse เป็น abbr / val e.g. abbr="bg", val="red"
    const [abbr, val] = separateStyleAndProperties(tokenNoBang);
    if (!abbr) continue;

    // expansions เดิม (ส่วนใหญ่ 1 ตัว แต่ไม่แตะ)
    const expansions = [`${abbr}[${val}]`];

    for (const ex of expansions) {
      // **ยกเลิก** detectImportantSuffix(ex) ซ้ำ
      // ใช้ isImportant จาก token หลักแทน

      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      // ถ้าเป็น localVar + ! => throw
      if (abbr2.startsWith('--&') && isImportant) {
        throw new Error(
          `[SWD-ERR] !important is not allowed with local var (${abbr2}) in state ${funcName}.`
        );
      }

      const isVar = abbr2.startsWith('$');
      const realAbbr = isVar ? abbr2.slice(1) : abbr2;

      if (realAbbr === 'f') {
        // font shorthand
        const dictEntry = fontDict.dict[val2] as Record<string, string> | undefined;
        if (!dictEntry) {
          throw new Error(
            `[SWD-ERR] Font key "${val2}" not found in theme.font(...) dict for state ${funcName}.`
          );
        }
        for (const [cssProp2, cssVal2] of Object.entries(dictEntry)) {
          result[cssProp2] = convertCSSVariable(cssVal2) + (isImportant ? ' !important' : '');
        }
        continue;
      }

      const cProp = abbrMap[realAbbr as keyof typeof abbrMap];
      if (!cProp) {
        throw new Error(`"${realAbbr}" not found in abbrMap for state ${funcName}.`);
      }

      let finalVal = convertCSSVariable(val2);

      if (isVar) {
        // varStates
        styleDef.varStates = styleDef.varStates || {};
        styleDef.varStates[funcName] = styleDef.varStates[funcName] || {};
        styleDef.varStates[funcName][realAbbr] = finalVal;

        result[cProp] = `var(--${realAbbr}-${funcName})` + (isImportant ? ' !important' : '');
      } else if (val2.includes('--&')) {
        // partial replace
        const replaced = val2.replace(/--&([\w-]+)/g, (_, varName) => {
          return `LOCALVAR(${varName})`;
        });
        result[cProp] = replaced + (isImportant ? ' !important' : '');
      } else {
        result[cProp] = finalVal + (isImportant ? ' !important' : '');
      }
    }
  }

  styleDef.states[funcName] = result;
}
