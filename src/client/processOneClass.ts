// ======================================================
// src/client/processOneClass.ts
// ======================================================
import { insertedRulesMap, IInsertedRules } from './constant';
import { insertCSSRules } from './insertCSSRules';
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
 * - กันซ้ำ
 */
export function processOneClass(
  className: string,
  styleDef: IStyleDefinition,
  scopeName: string
): string {
  const key = `${scopeName}:${className}:${JSON.stringify(styleDef)}`;
  const cached = insertedRulesMap.get(key);
  if (cached) {
    return cached.displayName;
  }

  const displayName = `${scopeName}_${className}`;

  // 1) transformVariables => $var
  transFormVariables(styleDef, scopeName, className);

  // 2) transformLocalVariables => --$xxx
  transformLocalVariables(styleDef, scopeName, className);

  // *** ใหม่: transform ใน queries
  if (styleDef.queries && styleDef.queries.length > 0) {
    for (const qb of styleDef.queries) {
      // ถ้าอยากให้ query block เห็น localVars ของ parent:
      // copy localVars ของ class หลักไปใส่ใน qb.styleDef
      if (!qb.styleDef.localVars) {
        qb.styleDef.localVars = {};
      }
      Object.assign(qb.styleDef.localVars, styleDef.localVars);

      // จากนั้น transform var
      transFormVariables(qb.styleDef, scopeName, className);
      transformLocalVariables(qb.styleDef, scopeName, className);
    }
  }

  // 3) insert CSS (SSR หรือ Client)
  if (isServer) {
    serverStyleSheet().insertCSSRules(displayName, styleDef);
  } else {
    insertCSSRules(displayName, styleDef);
  }

  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(key, inserted);

  return displayName;
}
