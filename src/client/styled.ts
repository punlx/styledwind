// styled.ts

import { isServer } from '../server/constant';
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
  // ตัวแปร abbr เช่น '$bg-hover'
  if (!abbr.startsWith('$')) {
    throw new Error(`[SWD-ERR] Only $variable is supported. Got "${abbr}"`);
  }

  const varNameFull = abbr.slice(1); // "bg-hover" หรือ "bg"
  let baseVarName = varNameFull;
  let suffix = '';

  const dashIdx = varNameFull.lastIndexOf('-');
  if (dashIdx > 0) {
    baseVarName = varNameFull.slice(0, dashIdx); // "bg"
    suffix = varNameFull.slice(dashIdx + 1); // "hover"
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
  // --<baseVarName>-<scope>_<cls>-(suffix?)
  if (!suffix) {
    return `--${baseVarName}-${scope}_${cls}`; // เช่น --bg-app_box
  }
  return `--${baseVarName}-${scope}_${cls}-${suffix}`; // เช่น --bg-app_box-hover
}

/**
 * ส่วนสำคัญ: Queue + rAF
 *   - pendingVars เก็บ { [finalVarName]: value }
 *   - rafScheduled ไว้กันการ schedule rAF ซ้ำ
 */
const pendingVars: Record<string, string> = {}; // เก็บ finalVar -> value
let rafScheduled = false;

function flushVars() {
  // loop เซ็ตทั้งหมดที่ค้างอยู่
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
 * - parse directive (โดยเฉพาะ @scope) + parse block .class { ... }
 * - สร้างคลาสตาม scopeName_className
 * - เก็บลง map ใน processOneClass เพื่อ insert CSS
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
      scopeName = d.value; // ค่าชื่อ scope เช่น "app"
    }
    // อนาคตถ้าเจอ @bind, @mix ค่อย handle ต่อ
  }

  // 3) ถ้าไม่เจอ scope -> throw
  if (!scopeName) {
    throw new Error(`[SWD-ERR] You must provide "@scope <name>" in styled(...) template.`);
  }

  // 4) เช็คว่ามีการใช้ scope นี้มาก่อนหรือยัง (global)
  //    ถ้าซ้ำ -> throw error (ยกเว้นกรณี HMR)
  // const hotReload = isHotReload();
  if (usedScopes.has(scopeName)) {
    throw new Error(`[SWD-ERR] scope "${scopeName}" is already used in another file.`);
  }
  // ถ้ายังไม่เคยใช้ -> จดจำ
  usedScopes.add(scopeName);

  // 5) เตรียม Set กัน className ซ้ำในไฟล์เดียวกัน
  const localClasses = new Set<string>();

  // 6) ประมวลผลแต่ละบล็อก .className {...}
  for (const block of classBlocks) {
    const clsName = block.className;

    // 6.1 เช็คในไฟล์เดียวกัน
    if (localClasses.has(clsName)) {
      throw new Error(
        `[SWD-ERR] Duplicate class ".${clsName}" in scope "${scopeName}" (same file).`
      );
    }
    localClasses.add(clsName);

    // 6.2 เช็ค global scope+className
    const scopeClassKey = `${scopeName}:${clsName}`;
    if (usedScopeClasses.has(scopeClassKey)) {
      throw new Error(
        `[SWD-ERR] Class ".${clsName}" in scope "${scopeName}" is already used in another file.`
      );
    }
    usedScopeClasses.add(scopeClassKey);

    // 6.3 สร้าง CSS
    processOneClass(clsName, block.body, scopeName);
  }

  // 7) สร้าง result object คืน (มี .get() สำหรับ set variable ด้วย)
  const resultObj: any = {};

  // 7.1 ใส่ mapping className -> scopeName_className
  for (const block of classBlocks) {
    resultObj[block.className] = `${scopeName}_${block.className}`;
  }

  // 7.2 ใส่เมธอด get(...).set(...)
  resultObj.get = function <K2 extends keyof T>(classKey: K2) {
    return {
      // จากโค้ดเดิมใน styled.ts หรือที่ใดก็ตาม
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

          // ถ้า value มี --xxx => แทนด้วย var(--xxx)
          if (val.includes('--')) {
            val = val.replace(/(--[\w-]+)/g, 'var($1)');
          }

          // ใส่ลง pendingVars
          pendingVars[finalVar] = val;
        }
        // schedule rAF เพื่อ flush
        scheduleFlush();
      },
    };
  };

  return resultObj as StyledResult<T>;
}
