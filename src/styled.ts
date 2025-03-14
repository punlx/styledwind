// styled.ts

import { parseClassDefinition, convertCSSVariable } from './helpers';
import { generateClassId } from './hash';
import { insertedRulesMap, IInsertedRules } from './constant';
import { insertCSSRules, styleDefMap } from './insertCSSRules'; // notice we no longer need rebuildGlobalCSSDebounced
import { abbrMap } from './constant';

/**
 * MemoMap สำหรับกัน parse ซ้ำ
 * key:  className + ':' + abbrStyle
 * val:  displayName
 */
const memoMap = new Map<string, string>();

/*********************************************
 * 1) processOneClass(className, abbrStyle)
 *********************************************/
export function processOneClass(className: string, abbrStyle: string): string {
  // สร้าง key
  const key = `${className}:${abbrStyle}`;

  // 1) check memoMap
  const cachedDisplayName = memoMap.get(key);
  if (cachedDisplayName) {
    // เคย parse + insert แล้ว => คืนได้เลย
    return cachedDisplayName;
  }

  // 2) ยังไม่เคย => parse
  const styleDef = parseClassDefinition(className, abbrStyle);

  // 3) สร้าง displayName จากการ hash key
  const uniqueId = generateClassId(key);
  const displayName = `${className}_${uniqueId}`;

  // 4) insertCSSRules
  insertCSSRules(displayName, styleDef);

  // 5) เก็บใน insertedRulesMap + memoMap
  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(displayName, inserted);
  memoMap.set(key, displayName);

  return displayName;
}

/*********************************************
 * 2) typed StyledResult
 *********************************************/
export type StyledResult<T> = {
  [K in keyof T]: string;
} & {
  get: <K2 extends keyof T>(
    className: K2
  ) => {
    set: (props: Partial<Record<any, string>>) => void;
  };
};

/*********************************************
 * 3) styled(template)
 *********************************************/
export function styled<T extends Record<string, any> = Record<string, never>>(
  template: TemplateStringsArray
): StyledResult<T> {
  const text = template[0];
  // จับ pattern: .className { ... }
  const regex = /\.[\w-]+\s*\{[^}]*\}/g;
  const matches = text.match(regex);

  const resultObj: any = {};

  // สำหรับทุก match => parse & insert
  if (matches) {
    for (const m of matches) {
      const idx = m.indexOf('{');
      const rawClass = m.slice(0, idx).trim(); // เช่น ".box1"
      const abbrBody = m.slice(idx + 1, -1).trim(); // เนื้อภายใน {...}

      // ตัด '.' ข้างหน้าถ้ามี
      const className = rawClass.startsWith('.') ? rawClass.slice(1) : rawClass;

      // parseOneClass => ได้ displayName
      const displayName = processOneClass(className, abbrBody);
      resultObj[className] = displayName;
    }
  }

  /**
   * resultObj.get(...).set(...):
   *  - เฉพาะคีย์ที่ขึ้นต้นด้วย '$' => set CSS Variable
   *  - ถ้าไม่ใช่ => throw error (หรือจะ console.error)
   */
  resultObj.get = function <K2 extends keyof T>(classKey: K2) {
    return {
      set: (props: Partial<Record<any, string>>) => {
        const displayName = resultObj[classKey as string];
        if (!displayName) {
          console.warn(`No displayName found for class "${String(classKey)}".`);
          return;
        }

        // ดึง hash เช่น "box_abc123" => "abc123"
        const underscoreIdx = displayName.indexOf('_');
        const hashPart = underscoreIdx > 0 ? displayName.slice(underscoreIdx + 1) : '';

        // loop props
        for (const abbr in props) {
          let val = props[abbr];
          if (val == null) continue;

          // ถ้าไม่ได้ขึ้นต้นด้วย '$' => error
          if (!abbr.startsWith('$')) {
            // handle error code
            throw new Error(
              `[SWD-ERR] Attempted to set normal property "${abbr}" via .set(). Only $variable is supported now.`
            );
          }

          // ถ้าเป็น $variable => setProperty
          const varName = abbr.slice(1); // "bg"
          const finalVar = `--${varName}-${hashPart}`;

          // ถ้า val มี '--...' => ห่อด้วย var(...)
          val = convertCSSVariable(val);

          // setProperty ที่ :root
          document.documentElement.style.setProperty(finalVar, val);
        }
      },
    };
  };

  return resultObj as StyledResult<T>;
}
