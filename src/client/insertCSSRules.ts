// src/client/insertCSSRules.ts
import { constructedSheet, fallbackStyleElement } from './constant';
import { IStyleDefinition } from '../shared/parseStyles';
import { insertedRulesMap, IInsertedRules } from './constant';
import { buildCssText } from '../shared/buildCssText';
import { isServer } from '../server/constant';
// เก็บสไตล์ที่รอ insert
const pendingStyleDefs = new Map<string, IStyleDefinition>();
let pending = false;
let dirty = false;

/**
 * ตัวช่วย: แยก string (ที่อาจมีหลาย block) ออกเป็น rule ย่อย ๆ
 * เพื่อจะนำไปเรียก insertRule ทีละ rule
 * (วิธีง่าย ๆ: split ด้วย regex จับ pattern "อะไรก็ได้จนเจอ '}'")
 */
function splitCssIntoIndividualRules(cssText: string): string[] {
  // จับทุกอย่างที่ลงท้ายด้วย '}'
  const ruleMatches = cssText.match(/[^}]+}/g) || [];
  return ruleMatches.map((r) => r.trim());
}

/**
 * ฟังก์ชันหลักเรียกแบบ debounce:
 * - สร้าง CSS เฉพาะ batch ที่สะสมอยู่ใน pendingStyleDefs
 * - ใช้ insertRule ทีละ rule (หรือจะ replaceSync ก็ได้)
 */
function flushPendingStyles() {
  // สร้าง buffer ไว้เก็บ rule list ทั้งหมด
  const allRules: string[] = [];

  // loop เอา styleDef แต่ละคลาส มาสร้าง cssText แล้วแตกเป็น rule ย่อย
  for (const [displayName, styleDef] of pendingStyleDefs.entries()) {
    const cssText = buildCssText(displayName, styleDef);
    const ruleList = splitCssIntoIndividualRules(cssText);
    allRules.push(...ruleList);
  }

  if (constructedSheet) {
    allRules.forEach((rule) => {
      try {
        constructedSheet!.insertRule(rule, constructedSheet!.cssRules.length);
      } catch (err) {
        console.warn('insertRule error:', rule, err);
      }
    });
  } else if (fallbackStyleElement) {
    const fallbackSheet = fallbackStyleElement.sheet as CSSStyleSheet;
    allRules.forEach((rule) => {
      try {
        fallbackSheet.insertRule(rule, fallbackSheet.cssRules.length);
      } catch (err) {
        console.warn('fallback insertRule error:', rule, err);
      }
    });
  }

  // เคลียร์
  pendingStyleDefs.clear();
  pending = false;

  // ถ้ามี dirty = true แสดงว่ามี style เพิ่มเข้ามาระหว่างที่กำลัง flush → เรียกอีกครั้ง
  if (dirty) {
    dirty = false;
    scheduleFlush(); // เรียกตัวเองซ้ำ
  }
}

/** เรียกด้วย requestAnimationFrame หรือ setTimeout เพื่อ debounce การ flush */
function scheduleFlush() {
  if (isServer) return;
  // ขอตัดส่วน SSR ออก เพราะเราจะให้ไฟล์นี้ทำงาน เฉพาะตอน hydrate เสร็จแล้ว
  requestAnimationFrame(flushPendingStyles);
}
/**
 * ฟังก์ชันหลัก: insertCSSRules()
 * - เปลี่ยนจากการ "rebuild ทั้งหมด" มาเป็น "insert rule" รายคลาส
 * - มีการป้องกันซ้ำด้วย insertedRulesMap (กันการสร้าง class เดิมซ้ำ)
 */
/**
 * insertCSSRules (แบบ batch + debounce)
 */
export function insertCSSRules(displayName: string, styleDef: IStyleDefinition) {
  // เก็บลง pendingStyleDefs
  pendingStyleDefs.set(displayName, styleDef);

  // Mark inserted
  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(displayName, inserted);

  // Schedule flush
  if (pending) {
    // มีการรอ flush อยู่แล้ว → set dirty
    dirty = true;
  } else {
    pending = true;
    dirty = false;
    scheduleFlush();
  }
}
