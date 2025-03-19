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

/**
 * โครงสร้างของ template block เช่น template-a { ... }
 */
interface ITemplateBlock {
  templateName: string;
  body: string;
}

/**
 * ผลลัพธ์รวมจากการ parse
 */
interface IParseResult {
  directives: IParsedDirective[];
  classBlocks: IClassBlock[];
  templateBlocks: ITemplateBlock[];
}

/**
 * parseDirectivesAndClasses:
 * - หา directive (@scope, @bind, ...) เฉพาะ top-level (ยกเว้น @use)
 * - หา templateBlock (เช่น templateName { ... }) ไม่ขึ้นต้นด้วย '.'
 * - หา classBlock (.className { ... })
 */
export function parseDirectivesAndClasses(text: string): IParseResult {
  // Debug ลองพิมพ์ค่า text

  const directives: IParsedDirective[] = [];
  const classBlocks: IClassBlock[] = [];
  const templateBlocks: ITemplateBlock[] = [];

  // สำเนาข้อความมาเก็บ เพื่อจะตัด directive บรรทัดบนสุด (ยกเว้น @use)
  let newText = text;

  // 1) หา directive top-level (เช่น @scope, @bind) แต่ถ้า dirName==='use' ให้ข้าม
  const directiveRegex = /^[ \t]*@([\w-]+)\s+([^\r\n]+)/gm;
  let match: RegExpExecArray | null;

  while ((match = directiveRegex.exec(text)) !== null) {
    const dirName = match[1]; // เช่น 'scope', 'bind', 'use'
    const dirValue = match[2].trim();

    if (dirName === 'use') {
      // ถ้าเป็น @use => ไม่เอาเป็น directive ระดับบน
      // => ไม่ลบออกจาก newText => parser จะเจอ @use ใน body class/block
    } else {
      // อื่น ๆ เช่น @scope, @bind => เก็บลง directives[]
      directives.push({ name: dirName, value: dirValue });
      // ตัด match[0] ออกจาก newText
      newText = newText.replace(match[0], '').trim();
    }
  }

  // 2) parse template block (^\w+ {...}) (ไม่ขึ้นต้นด้วย '.')
  //    ถ้าเจอ "template-a { ... }" => templateBlocks.push(...)
  const templateBlockRegex = /^[ \t]*([\w-]+)\s*\{([^}]*)\}/gm;
  let tm: RegExpExecArray | null;

  while ((tm = templateBlockRegex.exec(newText)) !== null) {
    const nameCandidate = tm[1];
    if (nameCandidate.startsWith('.')) {
      // แปลว่า class block
      continue;
    }
    const tBody = tm[2].trim();
    templateBlocks.push({ templateName: nameCandidate, body: tBody });
    newText = newText.replace(tm[0], '').trim();
  }

  // 3) parse class block (.xxx { ... })
  const classRegex = /\.([\w-]+)\s*\{([^}]*)\}/gm;
  let cbm: RegExpExecArray | null;

  while ((cbm = classRegex.exec(newText)) !== null) {
    const cName = cbm[1];
    const cBody = cbm[2].trim();
    classBlocks.push({ className: cName, body: cBody });
    newText = newText.replace(cbm[0], '').trim();
  }


  return { directives, classBlocks, templateBlocks };
}
