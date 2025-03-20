// src/client/styled.ts

import { parseDirectivesAndClasses } from './parseDirectives';
import {
  attachGetMethod,
  ensureScopeUnique,
  extractScope,
  handleBindDirectives,
  processClassBlocks,
} from './styledUtils';

export type StyledResult<T extends Record<string, string[]>> = {
  [K in keyof T]: string; // map className -> final string e.g. "scope_class"
} & {
  get: <K2 extends keyof T>(
    className: K2
  ) => {
    set: (props: Partial<Record<T[K2][number], string>>) => void;
  };
};

////////////////////
// Main Function: styled()
////////////////////

/**
 * ฟังก์ชันหลัก styled()
 * - parse directive (โดยเฉพาะ @scope, @bind) + parse block .class { ... }
 * - สร้างคลาสตาม scopeName_className
 * - return object สำหรับเข้าถึงชื่อคลาส + .get(...).set(...) แก้ตัวแปร
 */
export function styled<T extends Record<string, string[]>>(
  template: TemplateStringsArray
): StyledResult<T> {
  // 1) ได้ text จาก template (ปัจจุบันสมมติว่าใช้ template[0] อย่างเดียว)
  let text = template[0];

  // 2) parse directives + class blocks
  const { directives, classBlocks } = parseDirectivesAndClasses(text);

  // 3) หา scope (@scope)
  const scopeName = extractScope(directives);

  // 4) เช็คว่า scope นี้ซ้ำหรือไม่
  ensureScopeUnique(scopeName);

  // 5) ประมวลผล class blocks => ได้ map ของ { className: "scope_className" }
  const classMapping = processClassBlocks(scopeName, classBlocks);

  // 6) สร้าง resultObj (ใส่ mapping className -> scope_className ลงไป)
  const resultObj: Record<string, any> = { ...classMapping };

  // 7) attach get(...).set(...) method
  attachGetMethod(resultObj);

  // 8) จัดการ @bind directive
  handleBindDirectives(scopeName, directives, resultObj);

  // 9) return result
  return resultObj as StyledResult<T>;
}
