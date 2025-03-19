// src/client/styled.ts

import { processOneClass } from './processOneClass';
import { parseDirectivesAndClasses, IParsedDirective } from './parseDirectives';

////////////////////
// Helper Functions
////////////////////
/**
 * แยก scope กับ cls ออกจาก displayName เช่น "app_box"
 * return { scope: "app", cls: "box" }
 */
function parseDisplayName(displayName: string): { scope: string; cls: string } {
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
function parseVariableAbbr(abbr: string): { baseVarName: string; suffix: string } {
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
function buildVariableName(
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

function flushVars() {
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

function scheduleFlush() {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushVars);
  }
}

/** เก็บชื่อ scope ที่ถูกใช้งานแล้ว (กันซ้ำข้ามไฟล์) */
const usedScopes = new Set<string>();

/** เก็บ "scope:className" ที่ถูกใช้งานแล้ว (กันซ้ำข้ามไฟล์) */
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

/**
 * ฟังก์ชันหลัก styled()
 * - parse directive (โดยเฉพาะ @scope, @bind) + parse block .class { ... }
 * - สร้างคลาสตาม scopeName_className
 * - return object สำหรับเข้าถึงชื่อคลาส + .get(...).set(...) แก้ตัวแปร
 */
export function styled<T extends Record<string, any> = Record<string, never>>(
  template: TemplateStringsArray
): StyledResult<T> {
  let text = template[0];

  // 1) เรียก parser เพื่อแยก directive + class blocks
  const { directives, classBlocks } = parseDirectivesAndClasses(text);

  // 2) หา @scope
  let scopeName: string | null = null;
  for (const d of directives) {
    if (d.name === 'scope') {
      if (scopeName) {
        throw new Error(`[SWD-ERR] multiple @scope found in the same styled block.`);
      }
      scopeName = d.value; // เช่น "app"
    }
    // ยังไม่ handle @bind ตรงนี้ รอไป handle หลังสร้าง classBlocks
  }

  // บังคับว่าต้องมี @scope
  if (!scopeName) {
    throw new Error(`[SWD-ERR] You must provide "@scope <name>" in styled(...) template.`);
  }

  // เช็ค global scope ซ้ำ
  if (usedScopes.has(scopeName)) {
    throw new Error(`[SWD-ERR] scope "${scopeName}" is already used in another file.`);
  }
  usedScopes.add(scopeName);

  // 3) เช็ค classBlocks + processOneClass
  //    กัน className ซ้ำในไฟล์เดียวกัน
  const localClasses = new Set<string>();

  for (const block of classBlocks) {
    const clsName = block.className;
    if (localClasses.has(clsName)) {
      throw new Error(
        `[SWD-ERR] Duplicate class ".${clsName}" in scope "${scopeName}" (same file).`
      );
    }
    localClasses.add(clsName);

    // เช็ค global scope+className
    const scopeClassKey = `${scopeName}:${clsName}`;
    if (usedScopeClasses.has(scopeClassKey)) {
      throw new Error(
        `[SWD-ERR] Class ".${clsName}" in scope "${scopeName}" is already used in another file.`
      );
    }
    usedScopeClasses.add(scopeClassKey);

    // สร้าง CSS
    processOneClass(clsName, block.body, scopeName);
  }

  // 4) สร้าง result object สำหรับ return
  //    ใส่ mapping className -> "scopeName_className"
  const resultObj: any = {};
  for (const block of classBlocks) {
    resultObj[block.className] = `${scopeName}_${block.className}`;
  }

  // 5) ใส่เมธอด get(...).set(...)
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

  // 6) จัดการ @bind directive - ต้องทำ "หลัง" เราสร้างคลาสแล้ว
  //    เก็บ bind key ทั้งหมด เพื่อป้องกันซ้ำ (ภายในไฟล์เดียวกัน)
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
      //    เช่น user ใช้ @bind box ... แต่ก็มี resultObj.box อยู่แล้ว
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
        // เช็คว่าใน resultObj มีมั้ย
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

  // 7) คืน resultObj
  return resultObj as StyledResult<T>;
}
