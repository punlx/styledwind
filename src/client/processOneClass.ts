// src/client/processOneClass.ts

import { IStyleDefinition } from '../shared/parseStyles';
import { insertedRulesMap, IInsertedRules } from './constant';
import { insertCSSRules } from './insertCSSRules';
import { isServer } from '../server/constant';
import { serverStyleSheet } from '../server/ServerStyleSheetInstance';
import { transformVariables } from './transformVariables';

/**
 * processOneClass:
 * - รับ className + styleDef (parse+merge แล้ว) + scopeName
 * - สร้าง displayName = "scopeName_className"
 * - เรียก transformVariables เพื่อแทนที่ $variable
 * - insert CSS (adoptedStyleSheets หรือ fallback <style>)
 * - กันซ้ำด้วย insertedRulesMap
 */
export function processOneClass(
  className: string,
  styleDef: IStyleDefinition,
  scopeName: string
): string {
  // สร้าง key สำหรับกันซ้ำ (deduplicate) ใน insertedRulesMap
  // ใช้ JSON.stringify(styleDef) เพื่อให้ไม่ซ้ำ (production อาจ optimize หรือแฮชแทนก็ได้)
  const key = `${scopeName}:${className}:${JSON.stringify(styleDef)}`;

  // ถ้ามีใน insertedRulesMap อยู่แล้ว => คืน displayName เดิม
  const cached = insertedRulesMap.get(key);
  if (cached) {
    return cached.displayName;
  }

  // สร้างชื่อ class สุดท้าย
  const displayName = `${scopeName}_${className}`;

  // transformVariables => แทนที่ $variable => var(--xxx-scope_class)
  transformVariables(styleDef, scopeName, className);

  // Insert CSS: ถ้า SSR => serverStyleSheet, ถ้า CSR => insertCSSRules
  if (isServer) {
    serverStyleSheet().insertCSSRules(displayName, styleDef);
  } else {
    insertCSSRules(displayName, styleDef);
  }

  // กันซ้ำ (cache) ลงใน insertedRulesMap
  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(key, inserted);

  return displayName;
}
