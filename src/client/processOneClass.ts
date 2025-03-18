import { parseClassDefinition } from '../shared/helpers';
import { generateClassId } from '../shared/hash';
import { insertCSSRules } from './insertCSSRules';
import { insertedRulesMap, IInsertedRules } from './constant';

// ✅ เช็คว่ารันบน Server หรือไม่
const isServer = typeof window === 'undefined';

let sheet: any = null;

// ✅ ถ้ารันบน Server ให้ใช้ ServerStyleSheet
if (isServer) {
  const { ServerStyleSheet } = require('../server/serverStyleSheet');
  sheet = new ServerStyleSheet();
}

export function processOneClass(className: string, abbrStyle: string): string {
  const key = `${className}:${abbrStyle}`;
  const cached = insertedRulesMap.get(key);
  if (cached) return cached.displayName;

  const styleDef = parseClassDefinition(className, abbrStyle);
  const uniqueId = generateClassId(key);
  const displayName = `${className}_${uniqueId}`;

  if (isServer) {
    sheet?.insertCSSRules(displayName, styleDef);
    return displayName; // ✅ ต้อง return className กลับไป เพื่อให้ SSR ตรงกับ Client
  } else {
    insertCSSRules(displayName, styleDef); // ✅ ใช้งานปกติบน CSR
  }

  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(displayName, inserted);
  return displayName;
}
