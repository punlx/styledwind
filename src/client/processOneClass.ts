// src/client/processOneClass.ts

import { parseClassDefinition } from '../shared/parseStyles';
import { generateClassId } from '../shared/hash';
import { insertCSSRules } from './insertCSSRules';
import { insertedRulesMap, IInsertedRules } from './constant';

export function processOneClass(className: string, abbrStyle: string): string {
  const key = `${className}:${abbrStyle}`;
  const cached = insertedRulesMap.get(key);
  if (cached) return cached.displayName;

  const styleDef = parseClassDefinition(abbrStyle);
  const uniqueId = generateClassId(key);
  const displayName = `${className}_${uniqueId}`;

  insertCSSRules(displayName, styleDef);

  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(key, inserted);

  return displayName;
}
