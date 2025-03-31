// src/shared/parseStyles/parseSingleAbbr.ts

import { parseBaseStyle } from './parseBaseStyle';
import { parseContainerStyle } from './parseContainerStyle';
import { parsePseudoElementStyle } from './parsePseudoElementStyle';
import { parseScreenStyle } from './parseScreenStyle';
import { parseStateStyle } from './parseStateStyle';
import { IStyleDefinition } from '../parseStyles.types';

// prefix ต่าง ๆ ที่รองรับได้
const supportedPseudos = [
  'before',
  'after',
  'placeholder',
  'selection',
  'file-selector-button',
  'first-letter',
  'first-line',
  'marker',
  'backdrop',
];

const knownStates = [
  // Interaction
  'hover',
  'focus',
  'active',
  'focus-within',
  'focus-visible',
  'target',

  // Form state
  'disabled',
  'read-only',
  'read-write',
  'required',
  'optional',
  'checked',
  'indeterminate',
  'valid',
  'invalid',
  'in-range',
  'out-of-range',
  'placeholder-shown',
  'default',

  // Link
  'link',
  'visited',

  // Other (less common)
  'autofill',
  'user-invalid',
];

/**
 * parseSingleAbbr
 *
 * @param abbrLine string ย่อสไตล์ หรือบรรทัดที่ต้องการ parse
 * @param styleDef ตัวเก็บผลลัพธ์สไตล์ (IStyleDefinition)
 * @param isConstContext เป็น context ที่เป็น const หรือไม่
 * @param isQueryBlock อยู่ใน @query บล็อคหรือไม่
 */
export function parseSingleAbbr(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false,
  isQueryBlock: boolean = false
) {
  const trimmed = abbrLine.trim();

  // 1) check @query nested
  if (isQueryBlock && trimmed.startsWith('@query')) {
    throw new Error(`[SWD-ERR] Nested @query is not allowed.`);
  }

  // ถ้าอยู่ใน @query block ห้ามมี local-var หรือ runtime-var
  if (isQueryBlock) {
    if (/^--&[\w-]+\[/.test(trimmed)) {
      throw new Error(`[SWD-ERR] Local var not allowed inside @query block. Found: "${trimmed}"`);
    }
    if (/^\$[\w-]+\[/.test(trimmed)) {
      throw new Error(
        `[SWD-ERR] Runtime variable ($var) not allowed inside @query block. Found: "${trimmed}"`
      );
    }
  }

  // 2) หา '(' ครั้งแรก (ถ้าไม่มี แสดงว่าเป็น base style)
  const openParenIndex = trimmed.indexOf('(');

  if (openParenIndex === -1) {
    // ไม่มี '(' => เป็น base style
    parseBaseStyle(trimmed, styleDef, isConstContext, isQueryBlock);
    return;
  }

  // 3) ดึง prefix ก่อน '('
  const prefix = trimmed.slice(0, openParenIndex);

  if (knownStates.includes(prefix)) {
    parseStateStyle(trimmed, styleDef, isConstContext);
    return;
  }

  if (supportedPseudos.includes(prefix)) {
    parsePseudoElementStyle(trimmed, styleDef, isConstContext);
    return;
  }

  // 4) เช็ค prefix ว่าตรงกับ case ไหน
  if (prefix === 'screen') {
    parseScreenStyle(trimmed, styleDef, isConstContext);
    return;
  }

  if (prefix === 'container') {
    parseContainerStyle(trimmed, styleDef, isConstContext);
    return;
  }

  // 5) กรณีที่ไม่เข้าเคสใด ๆ => เป็น base style (กรณีเจอ h[calc(...)])
  parseBaseStyle(trimmed, styleDef, isConstContext, isQueryBlock);
}
