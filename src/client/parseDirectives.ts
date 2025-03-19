// src/client/parseDirectives.ts

/**
 * โครงสร้างเก็บ Directive ที่ parse ได้
 * name: ชื่อ directive เช่น 'scope'
 * value: ค่าด้านหลัง เช่น 'app'
 */
export interface IParsedDirective {
  name: string;
  value: string;
}

/**
 * โครงสร้างของ block class เช่น .box { ... }
 */
interface IClassBlock {
  className: string;
  body: string;
}

interface IParseResult {
  directives: IParsedDirective[];
  classBlocks: IClassBlock[];
}

/**
 * parseDirectivesAndClasses:
 * - แยก directive @scope, @bind, @mix (หรืออื่น ๆ)
 * - แยก block .classname { ... }
 */
export function parseDirectivesAndClasses(text: string): IParseResult {
  const directives: IParsedDirective[] = [];
  const classBlocks: IClassBlock[] = [];

  // 1) หา directive ด้วย regex
  //    สมมติ directive อยู่ต้นบรรทัดรูปแบบ: @xxx yyy (ไม่รวม { } ไว้ใน directive)
  //    หากต้องการซับซ้อนกว่านี้ สามารถขยาย regex หรือ logic ได้
  //    ตอนนี้เอาง่าย ๆ: จับ /^@[a-zA-Z0-9_-]+\s+([^\r\n]+)/
  //    วนหาแบบ global multi-line
  const directiveRegex = /^[ \t]*@([\w-]+)\s+([^\r\n]+)/gm;
  let match: RegExpExecArray | null;

  // เก็บ text ใหม่ เพื่อจะตัด directive ออก
  let newText = text;

  while ((match = directiveRegex.exec(text)) !== null) {
    const dirName = match[1]; // เช่น 'scope'
    const dirValue = match[2].trim(); // เช่น 'app'

    // เก็บลง list
    directives.push({ name: dirName, value: dirValue });

    // ตัดมันออกจาก newText
    // match[0] = '@scope app' ทั้งบรรทัด
    newText = newText.replace(match[0], '').trim();
  }

  // 2) parse block .classname { ... } จาก newText
  //    regex ประมาณ /\.[\w-]+\s*\{([^}]*)\}/g
  const classBlockRegex = /\.([\w-]+)\s*\{([^}]*)\}/g;
  let cbMatch: RegExpExecArray | null;

  while ((cbMatch = classBlockRegex.exec(newText)) !== null) {
    const cName = cbMatch[1]; // เช่น 'box'
    const cBody = cbMatch[2].trim(); // เนื้อหาใน {}
    classBlocks.push({ className: cName, body: cBody });
  }

  return { directives, classBlocks };
}
