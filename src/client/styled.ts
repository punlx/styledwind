// src/client/styled.ts

import { parseDirectivesAndClasses } from './parseDirectives';
import { IStyleDefinition, parseClassDefinition, mergeStyleDef } from '../shared/parseStyles';
import { processOneClass } from './processOneClass';

////////////////////
// Batch var update
////////////////////
const pendingVars: Record<string, string> = {};
let rafScheduled = false;
function flushVars() {
  for (const [varName, val] of Object.entries(pendingVars)) {
    document.documentElement.style.setProperty(varName, val);
  }
  for (const k in pendingVars) {
    delete pendingVars[k];
  }
  rafScheduled = false;
}
function scheduleFlush() {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushVars);
  }
}

// Global sets
const usedScopes = new Set<string>();
const usedScopeClasses = new Set<string>();

export type StyledResult<T> = {
  [K in keyof T]: string;
} & {
  get: <K2 extends keyof T>(
    className: K2
  ) => {
    set: (props: Partial<Record<string, string>>) => void;
  };
};

interface ITemplateInfo {
  styleDef: IStyleDefinition;
}

interface IClassInfo {
  rawName: string;
  styleDef: IStyleDefinition;
  pendingUse: string[];
}

export function styled<T extends Record<string, any> = Record<string, never>>(
  template: TemplateStringsArray
): StyledResult<T> {
  const text = template[0];

  const { directives, classBlocks, templateBlocks } = parseDirectivesAndClasses(text);

  // 1) หา @scope
  let scopeName: string | null = null;
  for (const d of directives) {
    if (d.name === 'scope') {
      if (scopeName) {
        throw new Error(`[SWD-ERR] multiple @scope found in the same styled block.`);
      }
      scopeName = d.value.trim();
    }
  }
  if (!scopeName) {
    throw new Error(`[SWD-ERR] You must provide "@scope <name>" in styled(...) template.`);
  }
  if (usedScopes.has(scopeName)) {
    throw new Error(`[SWD-ERR] scope "${scopeName}" is already used.`);
  }
  usedScopes.add(scopeName);

  // 2) Pass1 parse templateBlocks
  const templateMap: Record<string, ITemplateInfo> = {};
  for (const tb of templateBlocks) {
    if (tb.body.includes('@use')) {
      throw new Error(`[SWD-ERR] template block "${tb.templateName}" must not contain "@use".`);
    }
    const tDef = parseClassDefinition(tb.body);
    templateMap[tb.templateName] = { styleDef: tDef };
  }

  // 3) Pass1 parse classBlocks => classMap
  const localClassSet = new Set<string>();
  const classMap: Record<string, IClassInfo> = {};

  for (const c of classBlocks) {
    const { className, body } = c;
    if (localClassSet.has(className)) {
      throw new Error(`[SWD-ERR] Duplicate class ".${className}" in scope "${scopeName}".`);
    }
    localClassSet.add(className);

    const scopeClassKey = `${scopeName}:${className}`;
    if (usedScopeClasses.has(scopeClassKey)) {
      throw new Error(
        `[SWD-ERR] Class ".${className}" in scope "${scopeName}" is already used globally.`
      );
    }
    usedScopeClasses.add(scopeClassKey);

    // แยก @use
    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const pendingUse: string[] = [];
    let rawBody = '';

    for (const line of lines) {
      if (line.startsWith('@use ')) {
        const tName = line.slice(5).trim();
        pendingUse.push(tName);
      } else {
        rawBody += line + '\n';
      }
    }

    const styleDef = parseClassDefinition(rawBody);

    classMap[className] = {
      rawName: className,
      styleDef,
      pendingUse,
    };
  }

  // (สร้าง resultObj: className => "scopeName_className")
  const resultObj: any = {};
  for (const c of classBlocks) {
    resultObj[c.className] = `${scopeName}_${c.className}`;
  }

  // 4) Handle @bind
  const localBindKeys = new Set<string>();
  for (const d of directives) {
    if (d.name === 'bind') {
      const tokens = d.value.trim().split(/\s+/);
      if (tokens.length < 2) {
        throw new Error(`[SWD-ERR] Invalid @bind syntax: "${d.value}"`);
      }
      const bindKey = tokens[0];
      const refs = tokens.slice(1);

      if (localBindKeys.has(bindKey)) {
        throw new Error(`[SWD-ERR] @bind key "${bindKey}" is already used in this block.`);
      }
      localBindKeys.add(bindKey);

      if (Object.prototype.hasOwnProperty.call(resultObj, bindKey)) {
        throw new Error(
          `[SWD-ERR] @bind key "${bindKey}" conflicts with existing property in scope="${scopeName}".`
        );
      }

      const finalList: string[] = [];
      for (const r of refs) {
        if (!r.startsWith('.')) {
          throw new Error(`[SWD-ERR] @bind usage must reference classes with a dot, got "${r}".`);
        }
        const cname = r.slice(1);
        if (!resultObj[cname]) {
          throw new Error(
            `[SWD-ERR] @bind referencing ".${cname}" but class not found in scope="${scopeName}".`
          );
        }
        finalList.push(resultObj[cname]);
      }
      resultObj[bindKey] = finalList.join(' ');
    }
  }

  // 5) Pass2: merge template -> class => processOneClass
  for (const clsName in classMap) {
    const info = classMap[clsName];
    let mergedDef = info.styleDef;

    if (info.pendingUse.length > 0) {
      // clone styleDef
      mergedDef = JSON.parse(JSON.stringify(mergedDef));
      for (const tName of info.pendingUse) {
        const tmpl = templateMap[tName];
        if (!tmpl) {
          throw new Error(`[SWD-ERR] @use references "${tName}" but no template block found.`);
        }
        mergeStyleDef(tmpl.styleDef, mergedDef);
      }
    }

    // เรียก processOneClass => transform + insert
    // สร้าง key = scopeName:className:<<some string>>
    const bodyKey = JSON.stringify(mergedDef); // or your own method
    const displayName = processOneClass(clsName, bodyKey, scopeName, mergedDef);
  }

  // 6) ใส่ .get(...).set(...)
  resultObj.get = function <K2 extends keyof T>(classKey: K2) {
    return {
      set: (props: Partial<Record<string, string>>) => {
        const displayName = resultObj[classKey as string];
        if (!displayName) {
          console.warn(`[SWD-WARN] no class for key "${String(classKey)}"`);
          return;
        }
        const underscoreIdx = displayName.indexOf('_');
        if (underscoreIdx < 0) return;
        const scope = displayName.slice(0, underscoreIdx);
        const cls = displayName.slice(underscoreIdx + 1);

        for (const abbr in props) {
          let val = props[abbr];
          if (!val) continue;
          if (!abbr.startsWith('$')) {
            throw new Error(`[SWD-ERR] Only $variable is allowed in .set(). Got "${abbr}".`);
          }
          const varNameFull = abbr.slice(1);
          let baseVarName = varNameFull;
          let suffix = '';
          const dashIdx = varNameFull.lastIndexOf('-');
          if (dashIdx > 0) {
            baseVarName = varNameFull.slice(0, dashIdx);
            suffix = varNameFull.slice(dashIdx + 1);
          }
          let finalVar = '';
          if (!suffix) {
            finalVar = `--${baseVarName}-${scope}_${cls}`;
          } else {
            finalVar = `--${baseVarName}-${scope}_${cls}-${suffix}`;
          }
          if (val.includes('--')) {
            val = val.replace(/(--[\w-]+)/g, 'var($1)');
          }
          pendingVars[finalVar] = val;
        }
        scheduleFlush();
      },
    };
  };

  return resultObj as StyledResult<T>;
}
