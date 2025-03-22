// src/client/parseDirectives.ts

import { IStyleDefinition } from '../shared/parseStyles/parseStyles.types';
import { createEmptyStyleDef } from '../shared/parseStyles/parseStylesUtils';
import { parseSingleAbbr } from '../shared/parseStyles/parseSingleAbbr';
/**
 * โครงสร้างเก็บ Directive ที่ parse ได้ (เช่น @scope, @bind)
 */
export interface IParsedDirective {
  name: string;
  value: string;
}

/**
 * โครงสร้างของ block class เช่น .box { ... }
 */
export interface IClassBlock {
  className: string;
  body: string;
}

/**
 * โครงสร้างเก็บข้อมูล @const
 * - name: ชื่อ const
 * - styleDef: partial IStyleDefinition (parse แล้ว แต่ยังไม่ transformVariables)
 */
export interface IConstBlock {
  name: string;
  styleDef: IStyleDefinition;
}

/**
 * ผลลัพธ์จาก parseDirectivesAndClasses:
 * - directives: รวม @scope, @bind (หรือ directive อื่น ๆ แบบบรรทัดเดียว ยกเว้น @use)
 * - classBlocks: เก็บ .className { ... } (ยังไม่ parse ภายใน)
 * - constBlocks: เก็บ @const name { ... } (parse เป็น partial styleDef แล้ว)
 */
export interface IParseResult {
  directives: IParsedDirective[];
  classBlocks: IClassBlock[];
  constBlocks: IConstBlock[];
}

/**
 * parseDirectivesAndClasses:
 * - ดึง @const <name> { ... } ออกมาก่อน (แล้ว parse บรรทัดข้างในเป็น partial styleDef)
 * - ดึง top-level directive (@scope, @bind ฯลฯ) แต่ข้าม @use
 * - ดึง block .classname { ... } (ภายในอาจมี @use)
 */
export function parseDirectivesAndClasses(text: string): IParseResult {
  const directives: IParsedDirective[] = [];
  const classBlocks: IClassBlock[] = [];
  const constBlocks: IConstBlock[] = [];

  let newText = text;

  // -------------------------------------------------
  // 1) หา & parse บล็อก @const
  // -------------------------------------------------
  const constRegex = /^[ \t]*@const\s+([\w-]+)\s*\{([\s\S]*?)\}/gm;
  let constMatch: RegExpExecArray | null;

  while ((constMatch = constRegex.exec(newText)) !== null) {
    const constName = constMatch[1];
    const rawBlock = constMatch[2];

    if (constBlocks.find((c) => c.name === constName)) {
      throw new Error(`[SWD-ERR] Duplicate @const name "${constName}".`);
    }

    if (/(@use|@const|@scope|@bind)/.test(rawBlock)) {
      throw new Error(
        `[SWD-ERR] Not allowed directive (@use/@const/@scope/@bind) inside @const "${constName}".`
      );
    }

    const partialStyleDef = createEmptyStyleDef();
    const lines = rawBlock
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      parseSingleAbbr(line, partialStyleDef, true);
    }

    constBlocks.push({
      name: constName,
      styleDef: partialStyleDef,
    });

    newText = newText.replace(constMatch[0], '').trim();
  }

  // -------------------------------------------------
  // 2) หา directive Top-Level (@scope, @bind) ยกเว้น @use
  // -------------------------------------------------
  const directiveRegex = /^[ \t]*@([\w-]+)\s+([^\r\n]+)/gm;
  let match: RegExpExecArray | null;
  directiveRegex.lastIndex = 0;

  while ((match = directiveRegex.exec(newText)) !== null) {
    const dirName = match[1];
    const dirValue = match[2].trim();

    if (dirName === 'use') {
      // ข้าม
      continue;
    }

    directives.push({ name: dirName, value: dirValue });

    newText = newText.replace(match[0], '').trim();
    directiveRegex.lastIndex = 0;
  }

  // -------------------------------------------------
  // 3) parse block .className { ... }
  // -------------------------------------------------
  const classBlockRegex = /\.([\w-]+)\s*\{([\s\S]*?)\}/g;
  let cbMatch: RegExpExecArray | null;

  while ((cbMatch = classBlockRegex.exec(newText)) !== null) {
    const cName = cbMatch[1];
    const cBody = cbMatch[2].trim();

    classBlocks.push({ className: cName, body: cBody });
  }

  return { directives, classBlocks, constBlocks };
}
