// src/client/processOneClass.ts
import { insertedRulesMap, IInsertedRules } from './constant';
import { insertCSSRules, scheduleRemoveDisplayNames } from './insertCSSRules';
import { isServer } from '../server/constant';
import { serverStyleSheet } from '../server/ServerStyleSheetInstance';
import { transFormVariables } from './transFormVariables';
import { transformLocalVariables } from './transformLocalVariables';
import { IStyleDefinition } from '../shared/parseStyles.types';

/**
 * processOneClass:
 * - สร้าง displayName = "scopeName_className"
 * - transformVariables + insert CSS
 * - Dev/HMR จะลบ rule เก่า (ถ้ามี) แล้วสร้างใหม่
 */
export function processOneClass(
  className: string,
  styleDef: IStyleDefinition,
  scopeName: string
): string {
  const key = `${scopeName}_${className}`;

  // Production: ใช้ cache ปกติ
  if (process.env.NODE_ENV === 'production') {
    const cached = insertedRulesMap.get(key);
    if (cached) {
      return cached.displayName;
    }
  } else {
    // Dev/HMR: ลบ rule เก่าก่อน
    const old = insertedRulesMap.get(key);
    if (old) {
      // <<< เปลี่ยนจาก removeStyleRulesByDisplayName เป็น batch removal >>>
      scheduleRemoveDisplayNames([old.displayName]);
      insertedRulesMap.delete(key);
    }
  }

  // สร้าง displayName
  const displayName = `${scopeName}_${className}`;

  // transform variables
  transFormVariables(styleDef, scopeName, className);
  transformLocalVariables(styleDef, scopeName, className);

  // ถ้ามี styleDef.queries => transform ใน query block ด้วย
  if (styleDef.queries && styleDef.queries.length > 0) {
    for (const qb of styleDef.queries) {
      if (!qb.styleDef.localVars) {
        qb.styleDef.localVars = {};
      }
      Object.assign(qb.styleDef.localVars, styleDef.localVars);

      transFormVariables(qb.styleDef, scopeName, className);
      transformLocalVariables(qb.styleDef, scopeName, className);
    }
  }

  // Insert CSS (SSR หรือ Client)
  if (isServer) {
    serverStyleSheet().insertCSSRules(displayName, styleDef);
  } else {
    insertCSSRules(displayName, styleDef);
  }

  // เก็บลง Map
  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(key, inserted);

  return displayName;
}
