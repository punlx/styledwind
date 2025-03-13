// styled.ts
import { parseClassDefinition, IStyleDefinition, convertCSSVariable } from './helpers';
import { generateClassId } from './hash';
import { insertedRulesMap, IInsertedRules } from './constant';
import { insertCSSRules, styleDefMap, rebuildGlobalCSSDebounced } from './insertCSSRules';
import { abbrMap } from './constant';

/*********************************************
 * 1) processOneClass(className, abbrStyle)
 *********************************************/
export function processOneClass(className: string, abbrStyle: string): string {
  // Memo check แบบง่าย
  const key = `${className}:${abbrStyle}`;
  const found = [...insertedRulesMap.values()].find((v) =>
    v.displayName.startsWith(`${className}_`)
  );

  if (found) {
    return found.displayName;
  }

  // parse
  const styleDef = parseClassDefinition(className, abbrStyle);

  // gen displayName
  const uniqueId = generateClassId(key);
  const displayName = `${className}_${uniqueId}`;

  // insert
  insertCSSRules(displayName, styleDef);

  // store in insertedRulesMap
  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(displayName, inserted);

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
  const regex = /\.[\w-]+\s*\{[^}]*\}/g;
  const matches = text.match(regex);

  const resultObj: any = {};

  if (matches) {
    for (const m of matches) {
      const idx = m.indexOf('{');
      const rawClass = m.slice(0, idx).trim(); // ".box1"
      const abbrBody = m.slice(idx + 1, -1).trim(); // เนื้อใน {...}

      let className = rawClass.startsWith('.') ? rawClass.slice(1) : rawClass;
      const displayName = processOneClass(className, abbrBody);
      resultObj[className] = displayName;
    }
  }

  /**
   * ระบบ get(...).set(...)
   *  - จะ update styleDefMap[displayName].base
   *  - แล้ว rebuildGlobalCSSDebounced() อีกครั้ง
   */
  resultObj.get = function <K2 extends keyof T>(className: K2) {
    return {
      set: (props: Partial<Record<any, string>>) => {
        const displayName = resultObj[className as string];
        if (!displayName) {
          console.warn(`No displayName found for class "${String(className)}".`);
          return;
        }

        const styleDef = styleDefMap.get(displayName);
        if (!styleDef) {
          console.warn(`No styleDef found for displayName "${displayName}".`);
          return;
        }

        // update base properties
        // ถ้าต้องการ update state, pseudo, screen => ต้องออกแบบ param หรือ logic เพิ่ม
        for (const abbr in props) {
          const cssProp = abbrMap[abbr as keyof typeof abbrMap];
          if (!cssProp) {
            console.warn(`abbr "${abbr}" not found in abbrMap. skipping`);
            continue;
          }

          const val = props[abbr];
          if (val !== undefined && val !== null) {
            styleDef.base[cssProp] = convertCSSVariable(val);
          }
        }

        // เรียก rebuild (debounced)
        rebuildGlobalCSSDebounced();
      },
    };
  };

  return resultObj as StyledResult<T>;
}
