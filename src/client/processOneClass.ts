// src/client/processOneClass.ts

import { parseClassDefinition, IStyleDefinition } from '../shared/parseStyles';
import { insertedRulesMap, IInsertedRules } from './constant';
import { insertCSSRules } from './insertCSSRules';
import { isServer } from '../server/constant';
import { serverStyleSheet } from '../server/ServerStyleSheetInstance';
import { transformVariables } from './transFormVariables';

/**
 * processOneClass:
 * - parse abbrBody -> styleDef
 * - สร้าง displayName = scopeName_className
 * - transformVariables (ใช้ --varName-scopeName_className)
 * - insert DOM หรือ SSR
 * - กันซ้ำใน insertedRulesMap ด้วย key = scopeName:className:body
 */
export function processOneClass(className: string, abbrStyle: string, scopeName: string): string {
  // สร้าง key กันซ้ำ
  const key = `${scopeName}:${className}:${abbrStyle}`;
  const cached = insertedRulesMap.get(key);
  if (cached) {
    return cached.displayName;
  }

  // parse abbr -> styleDef
  const styleDef: IStyleDefinition = parseClassDefinition(abbrStyle);

  // displayName = scopeName_className
  const displayName = `${scopeName}_${className}`;

  // transform variable
  transformVariables(styleDef, scopeName, className);

  // แยก SSR หรือ CSR
  if (isServer) {
    const sheet = serverStyleSheet();
    sheet.insertCSSRules(displayName, styleDef);
  } else {
    insertCSSRules(displayName, styleDef);
  }

  // กันซ้ำ
  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(key, inserted);

  return displayName;
}
