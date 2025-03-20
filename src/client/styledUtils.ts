////////////////////
// Helper Functions
////////////////////

import { IParsedDirective } from './parseDirectives';
import { processOneClass } from './processOneClass';

/**
 * แยก scope กับ cls ออกจาก displayName เช่น "app_box"
 * return { scope: "app", cls: "box" }
 */
export function parseDisplayName(displayName: string): { scope: string; cls: string } {
  const underscoreIdx = displayName.indexOf('_');
  if (underscoreIdx < 0) {
    throw new Error(`[SWD-ERR] Invalid displayName "${displayName}". Must contain underscore.`);
  }
  return {
    scope: displayName.slice(0, underscoreIdx), // เช่น "app"
    cls: displayName.slice(underscoreIdx + 1), // เช่น "box"
  };
}

/**
 * แยก "$bg-hover" => { baseVarName: "bg", suffix: "hover" }
 * ถ้าไม่มี dash เช่น "$bg" => { baseVarName: "bg", suffix: "" }
 */
export function parseVariableAbbr(abbr: string): { baseVarName: string; suffix: string } {
  if (!abbr.startsWith('$')) {
    throw new Error(`[SWD-ERR] Only $variable is supported. Got "${abbr}"`);
  }
  const varNameFull = abbr.slice(1); // เช่น "bg-hover"
  let baseVarName = varNameFull;
  let suffix = '';

  const dashIdx = varNameFull.lastIndexOf('-');
  if (dashIdx > 0) {
    baseVarName = varNameFull.slice(0, dashIdx);
    suffix = varNameFull.slice(dashIdx + 1);
  }
  return { baseVarName, suffix };
}

/**
 * ประกอบชื่อ CSS variable ตรงกับที่เราใช้ใน transformVariables
 * - ถ้า suffix = "" => "--baseVarName-scope_cls"
 * - ถ้า suffix != "" => "--baseVarName-scope_cls-suffix"
 */
export function buildVariableName(
  baseVarName: string,
  scope: string,
  cls: string,
  suffix: string
): string {
  if (!suffix) {
    return `--${baseVarName}-${scope}_${cls}`;
  }
  return `--${baseVarName}-${scope}_${cls}-${suffix}`;
}

/**
 * ส่วนสำคัญ: Queue + rAF
 *   - pendingVars เก็บ { [finalVarName]: value }
 *   - rafScheduled ไว้กันการ schedule rAF ซ้ำ
 */
const pendingVars: Record<string, string> = {};
let rafScheduled = false;

export function flushVars() {
  // เซ็ต property ทั้งหมดลง DOM
  for (const [varName, val] of Object.entries(pendingVars)) {
    document.documentElement.style.setProperty(varName, val);
  }
  // เคลียร์
  for (const key in pendingVars) {
    delete pendingVars[key];
  }
  rafScheduled = false;
}

export function scheduleFlush() {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushVars);
  }
}

/** เก็บชื่อ scope ที่ถูกใช้งานแล้ว (กันซ้ำข้ามไฟล์) */
export const usedScopes = new Set<string>();

/** เก็บ "scope:className" ที่ถูกใช้งานแล้ว (กันซ้ำข้ามไฟล์) */
export const usedScopeClasses = new Set<string>();

////////////////////
// New Pure Functions for styled()
////////////////////

/**
 * extractScope(directives):
 * - หา directive ชื่อ '@scope' แล้ว return ค่า
 * - ถ้าเจอหลายอันหรือไม่เจอ ให้ throw error
 */
export function extractScope(directives: IParsedDirective[]): string {
  let scopeName: string | null = null;

  for (const d of directives) {
    if (d.name === 'scope') {
      if (scopeName) {
        throw new Error(`[SWD-ERR] multiple @scope found in the same styled block.`);
      }
      scopeName = d.value; // เช่น "app"
    }
  }

  if (!scopeName) {
    throw new Error(`[SWD-ERR] You must provide "@scope <name>" in styled(...) template.`);
  }

  return scopeName;
}

/**
 * ensureScopeUnique(scopeName):
 * - ตรวจสอบว่า scopeName นี้ถูกใช้ไปแล้วหรือยัง
 * - ถ้าเคยใช้แล้ว ให้ throw error
 * - มิฉะนั้น add ลง usedScopes
 */
export function ensureScopeUnique(scopeName: string) {
  if (usedScopes.has(scopeName)) {
    console.warn(
      `[SWD-ERR] scope "${scopeName}" is already used in another file. Refresh to check if it is a HMR error.`
    );
    // throw new Error(`[SWD-ERR] scope "${scopeName}" is already used in another file.`);
  }
  usedScopes.add(scopeName);
}

/**
 * processClassBlocks(scopeName, classBlocks):
 * - วน loop classBlocks => ตรวจซ้ำ => call processOneClass => สร้าง mapping
 * - return { [className]: scope_className }
 */
export function processClassBlocks(
  scopeName: string,
  classBlocks: Array<{ className: string; body: string }>
): Record<string, string> {
  const localClasses = new Set<string>();
  const resultMap: Record<string, string> = {};

  for (const block of classBlocks) {
    const clsName = block.className;

    // 1) กันซ้ำในไฟล์เดียวกัน
    if (localClasses.has(clsName)) {
      throw new Error(
        `[SWD-ERR] Duplicate class ".${clsName}" in scope "${scopeName}" (same file).`
      );
    }
    localClasses.add(clsName);

    // 2) กันซ้ำข้ามไฟล์ (global)
    const scopeClassKey = `${scopeName}:${clsName}`;
    if (usedScopeClasses.has(scopeClassKey)) {
      console.warn(
        `[SWD-ERR] Class ".${clsName}" in scope "${scopeName}" is already used in another file. Refresh to check if it is a HMR error.`
      );
      // throw new Error(
      //   `[SWD-ERR] Class ".${clsName}" in scope "${scopeName}" is already used in another file.`
      // );
    }
    usedScopeClasses.add(scopeClassKey);

    // 3) สร้าง CSS (เรียก processOneClass)
    processOneClass(clsName, block.body, scopeName);

    // 4) ใส่ใน resultMap (className -> "scopeName_className")
    resultMap[clsName] = `${scopeName}_${clsName}`;
  }
  return resultMap;
}

type InterimResult<T> = {
  [K in keyof T]: string;
} & {
  // เปิดช่องให้มี property ชื่ออื่น (เป็น string)
  [key: string]: string | undefined;
} & {
  // เพิ่ม get(...) ได้
  get?: <K2 extends keyof T>(
    classKey: K2
  ) => {
    set: (props: Partial<Record<string, string>>) => void;
  };
};

/**
 * attachGetMethod(resultObj):
 * - ใส่เมธอด resultObj.get(...).set(...) เพื่อปรับเปลี่ยนค่า variable runtime
 */
export function attachGetMethod<T extends Record<string, any>>(resultObj: InterimResult<T>): void {
  resultObj.get = function <K2 extends keyof T>(classKey: K2) {
    return {
      set: (props: Partial<Record<string, string>>) => {
        const displayName = resultObj[classKey as string];
        if (!displayName) return;

        const { scope, cls } = parseDisplayName(displayName);

        for (const abbr in props) {
          let val = props[abbr];
          if (!val) continue;

          // แยก varName / suffix
          const { baseVarName, suffix } = parseVariableAbbr(abbr);
          // ประกอบชื่อ
          const finalVar = buildVariableName(baseVarName, scope, cls, suffix);

          // ถ้า value มี --xxx => replace เป็น var(--xxx)
          if (val.includes('--')) {
            val = val.replace(/(--[\w-]+)/g, 'var($1)');
          }
          // เก็บลง pendingVars
          pendingVars[finalVar] = val;
        }
        // schedule rAF เพื่อ flush
        scheduleFlush();
      },
    };
  };
}

/**
 * handleBindDirectives(scopeName, directives, resultObj):
 * - หลังจากสร้าง class mapping แล้ว จึง parse @bind
 * - เช่น @bind boxWrap .box .box2
 * - สุดท้าย resultObj[boxWrap] = "app_box app_box2"
 */
export function handleBindDirectives(
  scopeName: string,
  directives: IParsedDirective[],
  resultObj: Record<string, string>
) {
  const localBindKeys = new Set<string>();

  for (const d of directives) {
    if (d.name === 'bind') {
      // d.value = "wrapbox .box .box2"
      // 1) split => ["wrapbox", ".box", ".box2"]
      const tokens = d.value.trim().split(/\s+/);
      if (tokens.length < 2) {
        throw new Error(`[SWD-ERR] Invalid @bind syntax: "${d.value}"`);
      }
      const bindKey = tokens[0]; // "wrapbox"
      const classRefs = tokens.slice(1); // [".box", ".box2"]

      // 2) ห้ามซ้ำ bindKey ในไฟล์
      if (localBindKeys.has(bindKey)) {
        throw new Error(`[SWD-ERR] @bind key "${bindKey}" is already used in this file.`);
      }
      localBindKeys.add(bindKey);

      // 3) เช็คว่าภายใน resultObj มี property ชื่อ bindKey อยู่แล้วไหม
      if (Object.prototype.hasOwnProperty.call(resultObj, bindKey)) {
        throw new Error(
          `[SWD-ERR] @bind key "${bindKey}" conflicts with existing property in styled with scope "${scopeName}".`
        );
      }

      // 4) แปลงชื่อคลาส
      const finalClassList: string[] = [];
      for (const ref of classRefs) {
        // เช่น ".box" => "box"
        if (!ref.startsWith('.')) {
          throw new Error(`[SWD-ERR] @bind usage must reference classes with a dot, got "${ref}"`);
        }
        const refName = ref.slice(1); // "box"
        if (!resultObj[refName]) {
          throw new Error(
            `[SWD-ERR] @bind referencing ".${refName}" but that class is not defined.`
          );
        }
        finalClassList.push(resultObj[refName]); // เช่น "app_box"
      }

      // 5) join => "app_box app_box2"
      const joined = finalClassList.join(' ');
      // 6) set resultObj[bindKey] = joined
      resultObj[bindKey] = joined;
    }
  }
}
