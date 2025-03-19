// /src/client/processOneClass.ts

import { parseClassDefinition } from '../shared/parseStyles';
import { generateClassId } from '../shared/hash';
import { insertedRulesMap, IInsertedRules } from './constant';
import { insertCSSRules } from './insertCSSRules';
import { isServer } from '../server/constant';
import { serverStyleSheet } from '../server/ServerStyleSheetInstance';
import { IStyleDefinition } from '../shared/parseStyles';
import { transformVariables } from './transFormVariables';

/**
 * parse + insert (หรือ collect) rule ของ 1 คลาส
 */
export function processOneClass(className: string, abbrStyle: string): string {
  // สร้าง key กันซ้ำ
  const key = `${className}:${abbrStyle}`;
  const cached = insertedRulesMap.get(key);
  if (cached) {
    return cached.displayName;
  }

  // parse abbr -> styleDef
  const styleDef: IStyleDefinition = parseClassDefinition(abbrStyle);

  // generate uniqueId + displayName
  const uniqueId = generateClassId(key);
  const displayName = `${className}_${uniqueId}`;
  // transform variable
  transformVariables(styleDef, displayName);
  // แยกว่า SSR หรือ CSR
  if (isServer) {
    // SSR path
    const sheet = serverStyleSheet();
    sheet.insertCSSRules(displayName, styleDef);
  } else {
    // CSR path -> insert DOM
    insertCSSRules(displayName, styleDef);
  }

  // กันซ้ำ
  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(key, inserted);

  return displayName;
}
