import { insertedRulesMap, IInsertedRules } from './constant';
import { insertCSSRules, removeStyleRulesByDisplayName } from './insertCSSRules';
import { isServer } from '../server/constant';
import { serverStyleSheet } from '../server/ServerStyleSheetInstance';
import { transFormVariables } from './transFormVariables';
import { transformLocalVariables } from './transformLocalVariables';
import { IStyleDefinition } from '../shared/parseStyles/parseStyles.types';

/**
 * processOneClass:
 * - สร้าง displayName = "scopeName_className"
 * - transformVariables($var) + transformLocalVariables(--$xxx)
 * - insert CSS
 * - กันซ้ำ (สำหรับ production) แต่อนุญาตให้ HMR สามารถอัปเดตได้
 */
export function processOneClass(
  className: string,
  styleDef: IStyleDefinition,
  scopeName: string
): string {
  const key = `${scopeName}_${className}`;

  // ----------------------------------------------
  // 1) Handle Cache แตกต่างระหว่าง Dev กับ Production
  // ----------------------------------------------
  if (process.env.NODE_ENV === 'production') {
    // Production: ถ้าเคย insert ไปแล้ว ก็ไม่ต้อง insert ใหม่
    const cached = insertedRulesMap.get(key);
    if (cached) {
      return cached.displayName;
    }
  } else {
    // Dev/HMR: ลบของเก่าออกก่อน แล้วค่อย insert ใหม่
    const old = insertedRulesMap.get(key);
    if (old) {
      // remove rule ที่เคย insert ไ
      // ว้
      removeStyleRulesByDisplayName(old.displayName);
      // ลบออกจาก Map
      insertedRulesMap.delete(key);
    }
  }

  // ----------------------------------------------
  // 2) สร้าง displayName
  // ----------------------------------------------
  const displayName = `${scopeName}_${className}`;

  // ----------------------------------------------
  // 3) Transform variables
  // ----------------------------------------------
  transFormVariables(styleDef, scopeName, className);
  transformLocalVariables(styleDef, scopeName, className);

  // *** ถ้ามี styleDef.queries => loop transform var ใน query block ด้วย
  if (styleDef.queries && styleDef.queries.length > 0) {
    for (const qb of styleDef.queries) {
      // copy localVars ของ class หลักไปใส่ใน query block (ถ้าต้องการ)
      if (!qb.styleDef.localVars) {
        qb.styleDef.localVars = {};
      }
      Object.assign(qb.styleDef.localVars, styleDef.localVars);
      // transform var
      transFormVariables(qb.styleDef, scopeName, className);
      transformLocalVariables(qb.styleDef, scopeName, className);
    }
  }

  // ----------------------------------------------
  // 4) Insert CSS (SSR หรือ Client)
  // ----------------------------------------------
  if (isServer) {
    serverStyleSheet().insertCSSRules(displayName, styleDef);
  } else {
    insertCSSRules(displayName, styleDef);
  }

  // ----------------------------------------------
  // 5) เก็บลง Map
  // ----------------------------------------------
  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(key, inserted);

  // ----------------------------------------------
  // 6) Return
  // ----------------------------------------------
  return displayName;
}
