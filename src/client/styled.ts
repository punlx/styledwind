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

////////////////////////////////////////
// Global sets for scope / class
////////////////////////////////////////
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
  styleDef: IStyleDefinition; // ดิบ (ยังไม่ transform)
}

interface IClassInfo {
  rawName: string;
  styleDef: IStyleDefinition;
  pendingUse: string[];
}

/**
 * ฟังก์ชันย่อย: handleScopeDirective
 * - หาว่าใน directives[] มี @scope หรือไม่
 * - ถ้าไม่มี => throw error
 * - ถ้ามี => เช็คซ้ำกับ usedScopes
 */
function handleScopeDirective(directives: Array<{ name: string; value: string }>): string {
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
  return scopeName;
}

/**
 * ฟังก์ชันย่อย: buildTemplateMap
 * - parse แต่ละ template block => ได้ styleDef ดิบ
 * - ใส่ลง map: templateName => { styleDef }
 * - ถ้าเจอ @use ใน template block => throw error
 */
function buildTemplateMap(
  templateBlocks: Array<{ templateName: string; body: string }>
): Record<string, ITemplateInfo> {
  const templateMap: Record<string, ITemplateInfo> = {};
  for (const tb of templateBlocks) {
    if (tb.body.includes('@use')) {
      throw new Error(`[SWD-ERR] template block "${tb.templateName}" must not contain "@use".`);
    }
    const tDef = parseClassDefinition(tb.body);
    templateMap[tb.templateName] = { styleDef: tDef };
  }
  return templateMap;
}

/**
 * ฟังก์ชันย่อย: buildClassMap
 * - parse body ของ .class { ... }
 * - แยก @use lines => pendingUse
 * - parse ที่เหลือ => styleDef
 * - เช็ค dup class
 * - เก็บลง classMap[className] = { ... }
 */
function buildClassMap(
  classBlocks: Array<{ className: string; body: string }>,
  scopeName: string
): Record<string, IClassInfo> {
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
  return classMap;
}

/**
 * ฟังก์ชันย่อย: buildResultObj
 * - จาก classBlocks => สร้าง object: { [className]: "scopeName_className" }
 */
function buildResultObj(
  classBlocks: Array<{ className: string; body: string }>,
  scopeName: string
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const c of classBlocks) {
    obj[c.className] = `${scopeName}_${c.className}`;
  }
  return obj;
}

/**
 * ฟังก์ชันย่อย: handleBindDirective
 * - จาก directives => ถ้าเจอ @bind => parse => สร้าง property ใหม่ (key=bindKey) => join class
 */
function handleBindDirective(
  directives: Array<{ name: string; value: string }>,
  scopeName: string,
  resultObj: Record<string, string>
) {
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
}

/**
 * ฟังก์ชันย่อย: pass2MergeAndInsert
 * - loop classMap => ถ้ามี pendingUse => clone + merge template => processOneClass
 */
function pass2MergeAndInsert(
  classMap: Record<string, IClassInfo>,
  templateMap: Record<string, ITemplateInfo>,
  scopeName: string
) {
  for (const clsName in classMap) {
    const info = classMap[clsName];
    let mergedDef = info.styleDef;

    if (info.pendingUse.length > 0) {
      mergedDef = JSON.parse(JSON.stringify(mergedDef)); // clone
      for (const tName of info.pendingUse) {
        const tmpl = templateMap[tName];
        if (!tmpl) {
          throw new Error(`[SWD-ERR] @use references "${tName}" but no template block found.`);
        }
        mergeStyleDef(tmpl.styleDef, mergedDef);
      }
    }

    // สร้าง key => scopeName:className:<<some string>>
    const bodyKey = JSON.stringify(mergedDef);
    processOneClass(clsName, bodyKey, scopeName, mergedDef);
  }
}

/**
 * ฟังก์ชัน: buildGetMethod
 * - สร้าง .get(...).set(...) สำหรับ resultObj
 */
function buildGetMethod<T extends Record<string, any>>(resultObj: Record<string, string>) {
  return function <K2 extends keyof T>(classKey: K2) {
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
}

/**
 * ฟังก์ชันหลัก styled():
 * - parse directive + block
 * - handle scope
 * - build templateMap, classMap
 * - build resultObj
 * - handle @bind
 * - pass2 merge + insert
 * - add .get(...).set(...)
 */
export function styled<T extends Record<string, any> = Record<string, never>>(
  template: TemplateStringsArray
): StyledResult<T> {
  const text = template[0];

  // 1) parse directive + block
  const { directives, classBlocks, templateBlocks } = parseDirectivesAndClasses(text);

  // 2) handle scope
  const scopeName = handleScopeDirective(directives);

  // 3) build templateMap
  const templateMap = buildTemplateMap(templateBlocks);

  // 4) build classMap
  const classMap = buildClassMap(classBlocks, scopeName);

  // 5) build resultObj
  const resultObj: any = buildResultObj(classBlocks, scopeName);

  // 6) handle @bind
  handleBindDirective(directives, scopeName, resultObj);

  // 7) pass2 merge + insert
  pass2MergeAndInsert(classMap, templateMap, scopeName);

  // 8) add .get(...).set(...)
  resultObj.get = buildGetMethod<T>(resultObj);

  return resultObj as StyledResult<T>;
}
