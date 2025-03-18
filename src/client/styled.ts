// src/client/styled.ts

import { processOneClass } from './processOneClass';

export type StyledResult<T> = {
  [K in keyof T]: string;
} & {
  get: <K2 extends keyof T>(
    className: K2
  ) => {
    set: (props: Partial<Record<string, string>>) => void;
  };
};

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
      const rawClass = m.slice(0, idx).trim();
      const abbrBody = m.slice(idx + 1, -1).trim();

      const className = rawClass.startsWith('.') ? rawClass.slice(1) : rawClass;
      const displayName = processOneClass(className, abbrBody);
      resultObj[className] = displayName;
    }
  }

  resultObj.get = function <K2 extends keyof T>(classKey: K2) {
    return {
      set: (props: Partial<Record<string, string>>) => {
        const displayName = resultObj[classKey as string];
        if (!displayName) {
          console.warn(`No displayName found for class "${String(classKey)}".`);
          return;
        }
        const underscoreIdx = displayName.indexOf('_');
        const hashPart = underscoreIdx > 0 ? displayName.slice(underscoreIdx + 1) : '';

        for (const abbr in props) {
          let val = props[abbr];
          if (!val) continue;
          if (!abbr.startsWith('$')) {
            throw new Error(`[SWD-ERR] Only $variable is supported via .set(). Got "${abbr}".`);
          }
          const varName = abbr.slice(1);
          const finalVar = `--${varName}-${hashPart}`;
          if (val.includes('--')) {
            val = val.replace(/(--[\w-]+)/g, 'var($1)');
          }
          document.documentElement.style.setProperty(finalVar, val);
        }
      },
    };
  };

  return resultObj as StyledResult<T>;
}
