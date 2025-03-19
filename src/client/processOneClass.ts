// src/client/processOneClass.ts

import { parseClassDefinition, IStyleDefinition } from '../shared/parseStyles';
import { insertedRulesMap, IInsertedRules } from './constant';
import { insertCSSRules } from './insertCSSRules';
import { isServer } from '../server/constant';
import { serverStyleSheet } from '../server/ServerStyleSheetInstance';
import { transformVariables } from './transformVariables';

/**
 * processOneClass:
 * - parse abbrBody -> styleDef (ถ้าไม่มี styleDef มา)
 * - สร้าง displayName = scopeName_className
 * - transformVariables -> insert DOM/SSR
 * - กันซ้ำ insertedRulesMap
 */
export function processOneClass(
  className: string,
  abbrStyle: string, // ใช้เป็นส่วนหนึ่งของ key กันซ้ำ
  scopeName: string,
  styleDef?: IStyleDefinition // ใหม่
): string {
  const key = `${scopeName}:${className}:${abbrStyle}`;
  const cached = insertedRulesMap.get(key);
  if (cached) {
    return cached.displayName;
  }

  let finalDef: IStyleDefinition;
  if (styleDef) {
    finalDef = styleDef;
  } else {
    finalDef = parseClassDefinition(abbrStyle);
  }

  const displayName = `${scopeName}_${className}`;

  transformVariables(finalDef, scopeName, className);

  if (isServer) {
    const sheet = serverStyleSheet();
    sheet.insertCSSRules(displayName, finalDef);
  } else {
    insertCSSRules(displayName, finalDef);
  }

  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(key, inserted);

  return displayName;
}
