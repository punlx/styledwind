import { parseSingleAbbr } from '../../shared/parseStyles/parseSingleAbbr';
import { IStyleDefinition } from '../../shared/parseStyles/parseStyles.types';
import { createEmptyStyleDef } from '../../shared/parseStyles/parseStylesUtils';
import { IClassBlock } from '../parseDirectives';
import { processOneClass } from '../processOneClass';
import { mergeStyleDef } from './mergeStyleDef';

// src/client/styledUtils/processClassBlocks.ts
export const usedScopeClasses = new Set<string>();

/**
 * processClassBlocks:
 * - วน loop classBlocks => ตรวจซ้ำ => สร้าง styleDef
 * - ตรวจว่าใน body มี '@use constName1 constName2 ...' มั้ย
 * - ถ้ามี => merge partial styleDef จาก constMap
 * - สุดท้าย call processOneClass => ได้ scopeName_className
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

    //=====================================
    // A) แยกบรรทัดใน block.body
    //=====================================
    const lines = block.body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    let usedConstNames: string[] = []; // เก็บชื่อ const จาก @use
    const normalLines: string[] = []; // เก็บบรรทัดปกติ

    for (const line of lines) {
      if (line.startsWith('@use ')) {
        // เช็คว่าถ้ามีการเจอ @use มากกว่า 1 บรรทัด => throw
        if (usedConstNames.length > 0) {
          throw new Error(`[SWD-ERR] Multiple @use lines in class ".${clsName}" are not allowed.`);
        }
        // แยกชื่อ const
        const tokens = line.replace('@use', '').trim().split(/\s+/);
        usedConstNames = tokens;
      } else {
        normalLines.push(line);
      }
    }

    //=====================================
    // B) parse normalLines => styleDef
    //=====================================
    const classStyleDef = createEmptyStyleDef();
    for (const ln of normalLines) {
      parseSingleAbbr(ln, classStyleDef);
    }

    //=====================================
    // C) merge partial styleDef จากแต่ละ const
    //=====================================
    if (usedConstNames.length > 0) {
      for (const cName of usedConstNames) {
        if (!constMap.has(cName)) {
          throw new Error(`[SWD-ERR] @use refers to unknown const "${cName}".`);
        }
        const partialDef = constMap.get(cName)!;
        mergeStyleDef(classStyleDef, partialDef);
      }
    }

    //=====================================
    // D) สร้าง CSS (transform + insert)
    //    ผ่าน processOneClass
    //=====================================
    const displayName = processOneClass(clsName, classStyleDef, scopeName);

    //  ใส่ mapping className => displayName
    resultMap[clsName] = displayName;
  }

  return resultMap;
}
