// src/client/styledUtils/processClassBlocks.ts

import { IStyleDefinition } from '../../shared/parseStyles.types';
import { createEmptyStyleDef } from '../../shared/parseStyles/parseStylesUtils';
import { parseSingleAbbr } from '../../shared/parseStyles/parseSingleAbbr';
import { mergeStyleDef } from './mergeStyleDef';
import { processOneClass } from '../processOneClass';
import { IClassBlock } from '../parseDirectives';
import { extractQueryBlocks } from './extractQueryBlocks';

/**
 * usedScopeClasses:
 * - เก็บ "scopeName:className" เพื่อกันซ้ำข้ามไฟล์
 */
export const usedScopeClasses = new Set<string>();

/**
 * processClassBlocks:
 * - วน loop classBlocks (แต่ละ .className { ... })
 * - แยกและ parse @use, จากนั้น merge ลง classStyleDef ก่อน
 * - แล้วค่อย parse บรรทัดปกติ (จะ override ได้)
 * - แยก parse @query <selector> { ... } -> styleDef.queries
 * - ภายในแต่ละ query block ก็ parse line + @use (merge styleDef) เช่นเดียวกัน
 * - เรียก processOneClass -> ได้ displayName = "scopeName_className" หรือ ".className" (ถ้า scope=none)
 */
export function processClassBlocks(
  scopeName: string,
  classBlocks: IClassBlock[],
  constMap: Map<string, IStyleDefinition>
): Record<string, string> {
  const localClasses = new Set<string>();
  const resultMap: Record<string, string> = {};

  for (const block of classBlocks) {
    const clsName = block.className;

    // -----------------------------
    // 1) กันซ้ำภายในไฟล์ (local)
    // -----------------------------
    if (localClasses.has(clsName)) {
      throw new Error(
        `[SWD-ERR] Duplicate class ".${clsName}" in scope "${scopeName}" (same file).`
      );
    }
    localClasses.add(clsName);

    // -----------------------------
    // 2) กันซ้ำข้ามไฟล์ (global)
    // -----------------------------
    if (scopeName !== 'none') {
      const scopeClassKey = `${scopeName}:${clsName}`;
      if (process.env.NODE_ENV === 'production') {
        if (usedScopeClasses.has(scopeClassKey)) {
          console.warn(
            `[SWD-ERR] Class ".${clsName}" in scope "${scopeName}" is already used in another file.`
          );
        }
      }
      usedScopeClasses.add(scopeClassKey);
    }
    // ถ้า scopeName === 'none' -> ข้ามการเช็คซ้ำ

    // -----------------------------
    // 3) สร้าง styleDef ของคลาสนี้
    // -----------------------------
    const classStyleDef = createEmptyStyleDef();

    // ดึง @query block ออกมาก่อน
    const { queries, newBody } = extractQueryBlocks(block.body);

    // สร้าง IQueryBlock array
    const realQueryBlocks = queries.map((q) => ({
      selector: q.selector,
      styleDef: createEmptyStyleDef(),
    }));
    classStyleDef.queries = realQueryBlocks;

    // -----------------------------
    // 4) แบ่งบรรทัดใน body หลัก (หลังตัด @query แล้ว)
    // -----------------------------
    const lines = newBody
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    let usedConstNames: string[] = [];
    const normalLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('@use ')) {
        // ถ้าเจอ "@use xxxxx"
        if (usedConstNames.length > 0) {
          // ตัวอย่างโค้ดนี้ไม่อนุญาตให้มี @use ซ้ำหลายบรรทัดภายใน class
          throw new Error(`[SWD-ERR] Multiple @use lines in class ".${clsName}" are not allowed.`);
        }
        const tokens = line.replace('@use', '').trim().split(/\s+/);
        usedConstNames = tokens;
      } else {
        normalLines.push(line);
      }
    }

    // -----------------------------------
    // (A) Merge const ก่อน -> เป็น baseline
    // -----------------------------------
    if (usedConstNames.length > 0) {
      for (const cName of usedConstNames) {
        if (!constMap.has(cName)) {
          throw new Error(`[SWD-ERR] @use refers to unknown const "${cName}".`);
        }
        const partialDef = constMap.get(cName)!;
        mergeStyleDef(classStyleDef, partialDef);
      }
    }

    // -----------------------------------
    // (B) ค่อย parse บรรทัดปกติ -> override
    // -----------------------------------
    for (const ln of normalLines) {
      parseSingleAbbr(ln, classStyleDef);
    }

    // -----------------------------
    // 5) parse ภายใน query block
    // -----------------------------
    for (let i = 0; i < realQueryBlocks.length; i++) {
      const qBlock = realQueryBlocks[i];
      const qRawBody = queries[i].rawBody;

      const qLines = qRawBody
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const usedConstNamesQ: string[] = [];
      const normalQueryLines: string[] = [];

      for (const qLn of qLines) {
        if (qLn.startsWith('@use ')) {
          const tokens = qLn.replace('@use', '').trim().split(/\s+/);
          usedConstNamesQ.push(...tokens);
        } else {
          normalQueryLines.push(qLn);
        }
      }

      // (A) merge const ของ query ก่อน (ถ้ามี)
      for (const cName of usedConstNamesQ) {
        if (!constMap.has(cName)) {
          throw new Error(`[SWD-ERR] @use refers to unknown const "${cName}" inside @query.`);
        }
        const partialDef = constMap.get(cName)!;
        if (partialDef.hasRuntimeVar) {
          throw new Error(
            `[SWD-ERR] @use "${cName}" has $variable, not allowed inside @query block.`
          );
        }
        mergeStyleDef(qBlock.styleDef, partialDef);
      }

      // (B) parse บรรทัดปกติใน query block
      for (const qLn of normalQueryLines) {
        parseSingleAbbr(qLn, qBlock.styleDef, false, true);
      }
    }

    // -----------------------------
    // 6) สร้าง CSS => processOneClass
    // -----------------------------
    const displayName = processOneClass(clsName, classStyleDef, scopeName);

    // เก็บลง map
    resultMap[clsName] = displayName;
  }

  // -----------------------------
  // 7) return {className: "scope_className", ...}
  // -----------------------------
  return resultMap;
}
