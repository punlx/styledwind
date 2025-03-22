// ======================================================
// src/client/styledUtils/processClassBlocks.ts
// (ปรับปรุงให้รองรับ @use ภายใน @query)
// ======================================================
import { IStyleDefinition } from '../../shared/parseStyles/parseStyles.types';
import { createEmptyStyleDef } from '../../shared/parseStyles/parseStylesUtils';
import { parseSingleAbbr } from '../../shared/parseStyles/parseSingleAbbr';
import { mergeStyleDef } from './mergeStyleDef';
import { processOneClass } from '../processOneClass';
import { IClassBlock } from '../parseDirectives';
import { extractQueryBlocks } from './extractQueryBlocks';

export const usedScopeClasses = new Set<string>();

/**
 * processClassBlocks:
 * - วน loop classBlocks (แต่ละ .className { ... })
 * - parse บรรทัดปกติ + @use (ในระดับ class)
 * - แยก parse @query <selector> { ... } -> styleDef.queries
 * - ภายในแต่ละ query block ก็ parse line + @use (แล้ว merge)
 * - เรียก processOneClass() -> ได้ scopeName_className
 * - return mapping { className: "scope_className" }
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

    // กันซ้ำภายในไฟล์
    if (localClasses.has(clsName)) {
      throw new Error(
        `[SWD-ERR] Duplicate class ".${clsName}" in scope "${scopeName}" (same file).`
      );
    }
    localClasses.add(clsName);

    // กันซ้ำข้ามไฟล์
    const scopeClassKey = `${scopeName}:${clsName}`;
    if (usedScopeClasses.has(scopeClassKey)) {
      console.warn(
        `[SWD-ERR] Class ".${clsName}" in scope "${scopeName}" is already used in another file. Refresh to check if it is a HMR error.`
      );
    }
    usedScopeClasses.add(scopeClassKey);

    // สร้าง styleDef ว่าง
    const classStyleDef = createEmptyStyleDef();

    // 1) แยกบล็อก @query <selector> { ... }
    const { queries, newBody } = extractQueryBlocks(block.body);

    // สร้าง array IQueryBlock (selector + styleDef)
    const realQueryBlocks = queries.map((q) => {
      return {
        selector: q.selector,
        styleDef: createEmptyStyleDef(),
      };
    });
    classStyleDef.queries = realQueryBlocks;

    // 2) parse บรรทัดที่เหลือ (หลังตัด @query ออก) แยก @use (ระดับ class หลัก)
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

    // parse normalLines ลงใน classStyleDef (ใช้ parseSingleAbbr ตามเดิม)
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

    // 3) parse detail ภายในแต่ละ query block
    for (let i = 0; i < realQueryBlocks.length; i++) {
      const qBlock = realQueryBlocks[i];
      const qRawBody = queries[i].rawBody;

      const qLines = qRawBody
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      // *** เพิ่ม logic handle @use ภายใน query block
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

      // ถ้ามี @use => merge const ลงใน query styleDef
      for (const cName of usedConstNamesQ) {
        if (!constMap.has(cName)) {
          throw new Error(`[SWD-ERR] @use refers to unknown const "${cName}" inside @query.`);
        }
        const partialDef = constMap.get(cName)!;
        mergeStyleDef(qBlock.styleDef, partialDef);
      }
    }

    // 4) สร้าง CSS -> processOneClass
    const displayName = processOneClass(clsName, classStyleDef, scopeName);

    resultMap[clsName] = displayName;
  }

  return resultMap;
}
