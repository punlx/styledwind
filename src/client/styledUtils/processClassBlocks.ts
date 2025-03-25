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
 * - parse บรรทัดปกติ + @use (ระดับ class)
 * - แยก parse @query <selector> { ... } -> styleDef.queries
 * - ภายในแต่ละ query block ก็ parse line + @use (merge styleDef)
 * - เรียก processOneClass -> ได้ displayName = "scopeName_className"
 * - return mapping เช่น { box: "scope_box", ... }
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
    // 1) เช็คซ้ำภายในไฟล์ (local)
    // -----------------------------
    if (localClasses.has(clsName)) {
      throw new Error(
        `[SWD-ERR] Duplicate class ".${clsName}" in scope "${scopeName}" (same file).`
      );
    }
    localClasses.add(clsName);

    // -----------------------------
    // 2) เช็คซ้ำข้ามไฟล์ (global)
    // -----------------------------
    const scopeClassKey = `${scopeName}:${clsName}`;

    if (process.env.NODE_ENV === 'production') {
      // Production -> เตือนปกติหากซ้ำ
      if (usedScopeClasses.has(scopeClassKey)) {
        console.warn(
          `[SWD-ERR] Class ".${clsName}" in scope "${scopeName}" is already used in another file.`
        );
      }
    }
    usedScopeClasses.add(scopeClassKey);
    // Development/HMR -> ไม่เตือนซ้ำเพื่อไม่ให้เกิด warning รก console
    // ถ้าต้องการ log เบาๆ ก็ทำได้ เช่น
    // console.info(`[SWD-DEV] Class ".${clsName}" in scope "${scopeName}" registered.`);

    // -----------------------------
    // 3) สร้าง styleDef ให้คลาสนี้
    // -----------------------------
    const classStyleDef = createEmptyStyleDef();

    // ดึง @query block ออกก่อน
    const { queries, newBody } = extractQueryBlocks(block.body);

    // สร้าง IQueryBlock array
    const realQueryBlocks = queries.map((q) => ({
      selector: q.selector,
      styleDef: createEmptyStyleDef(),
    }));
    classStyleDef.queries = realQueryBlocks;

    // -----------------------------
    // 4) parse line ใน body หลัก (ตัด @query ออกแล้ว)
    // -----------------------------
    const lines = newBody
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    let usedConstNames: string[] = [];
    const normalLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('@use ')) {
        if (usedConstNames.length > 0) {
          throw new Error(`[SWD-ERR] Multiple @use lines in class ".${clsName}" are not allowed.`);
        }
        const tokens = line.replace('@use', '').trim().split(/\s+/);
        usedConstNames = tokens;
      } else {
        normalLines.push(line);
      }
    }

    // parse normalLines ลง classStyleDef
    for (const ln of normalLines) {
      parseSingleAbbr(ln, classStyleDef);
    }

    // ถ้ามี @use => merge const
    if (usedConstNames.length > 0) {
      for (const cName of usedConstNames) {
        if (!constMap.has(cName)) {
          throw new Error(`[SWD-ERR] @use refers to unknown const "${cName}".`);
        }
        const partialDef = constMap.get(cName)!;
        mergeStyleDef(classStyleDef, partialDef);
      }
    }

    // -----------------------------
    // 5) parse detail ภายใน query block
    // -----------------------------
    for (let i = 0; i < realQueryBlocks.length; i++) {
      const qBlock = realQueryBlocks[i];
      const qRawBody = queries[i].rawBody;

      const qLines = qRawBody
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      // handle @use ภายใน query block
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

      // parse line ปกติใน query block
      for (const qLn of normalQueryLines) {
        parseSingleAbbr(qLn, qBlock.styleDef, false, true);
      }

      // merge const ถ้ามี
      for (const cName of usedConstNamesQ) {
        if (!constMap.has(cName)) {
          throw new Error(`[SWD-ERR] @use refers to unknown const "${cName}" inside @query.`);
        }
        const partialDef = constMap.get(cName)!;
        mergeStyleDef(qBlock.styleDef, partialDef);
      }
    }

    // -----------------------------
    // 6) สร้าง CSS -> processOneClass
    // -----------------------------
    const displayName = processOneClass(clsName, classStyleDef, scopeName);

    // เก็บ map ไว้ return
    resultMap[clsName] = displayName;
  }

  // -----------------------------
  // 7) return { className: "scope_className", ... }
  // -----------------------------
  return resultMap;
}
