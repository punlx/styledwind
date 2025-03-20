// src/client/parseDirectives.ts

import { IStyleDefinition, createEmptyStyleDef, parseSingleAbbr } from '../shared/parseStyles';

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
 * - ดึง block .classname { ... } (ภายในอาจมี @use ซึ่งจะให้ logic ตอน parseClassBlocks จัดการ)
 */
export function parseDirectivesAndClasses(text: string): IParseResult {
  const directives: IParsedDirective[] = [];
  const classBlocks: IClassBlock[] = [];
  const constBlocks: IConstBlock[] = [];

  let newText = text; // we'll remove pieces from this as we parse

  // -------------------------------------------------
  // 1) หา & parse บล็อก @const <name> { ... } (multiline)
  // -------------------------------------------------
  const constRegex = /^[ \t]*@const\s+([\w-]+)\s*\{([\s\S]*?)\}/gm;
  let constMatch: RegExpExecArray | null;

  while ((constMatch = constRegex.exec(newText)) !== null) {
    const constName = constMatch[1];
    const rawBlock = constMatch[2]; // เนื้อหาใน { ... }

    // เช็คซ้ำ
    if (constBlocks.find((c) => c.name === constName)) {
      throw new Error(`[SWD-ERR] Duplicate @const name "${constName}".`);
    }

    // ห้ามมี @use/@const/@scope/@bind ซ้อนใน @const
    if (/(@use|@const|@scope|@bind)/.test(rawBlock)) {
      throw new Error(
        `[SWD-ERR] Not allowed directive (@use/@const/@scope/@bind) inside @const "${constName}".`
      );
    }

    // parse บรรทัดใน rawBlock เป็น partial styleDef
    const partialStyleDef = createEmptyStyleDef();
    const lines = rawBlock
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      parseSingleAbbr(line, partialStyleDef);
    }

    // เก็บลง constBlocks
    constBlocks.push({
      name: constName,
      styleDef: partialStyleDef,
    });

    // ตัด @const block ออกจาก newText
    newText = newText.replace(constMatch[0], '').trim();
    // หมายเหตุ: Regex .exec() อาจต้องใช้วิธี reset lastIndex ฯลฯ ถ้า parse หลายบล็อก
  }

  // -------------------------------------------------
  // 2) หา directive Top-Level (เช่น @scope, @bind)
  //    แต่ "ข้าม" @use (ไม่เก็บเป็น directive)
  // -------------------------------------------------
  const directiveRegex = /^[ \t]*@([\w-]+)\s+([^\r\n]+)/gm;
  let match: RegExpExecArray | null;

  // รีเซ็ต regex index กลับ (กันกรณีรันต่อเนื่อง)
  directiveRegex.lastIndex = 0;

  while ((match = directiveRegex.exec(newText)) !== null) {
    const dirName = match[1];
    const dirValue = match[2].trim();

    if (dirName === 'use') {
      // เจอ @use => ข้ามไป เพราะเป็น directive ภายใน block class
      // ไม่ต้อง remove หรือเก็บลง directives
      continue;
    }

    // เก็บลง directives อื่น ๆ (เช่น scope, bind, etc.)
    directives.push({ name: dirName, value: dirValue });

    // ตัดบรรทัดนี้ออกจาก newText
    newText = newText.replace(match[0], '').trim();

    // รีเซ็ต lastIndex ใหม่หลังตัด (กัน parsing ตกหล่น)
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
