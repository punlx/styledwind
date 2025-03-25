import { constructedSheet, fallbackStyleElement } from './constant';
import { insertedRulesMap, IInsertedRules } from './constant';
import { buildCssText } from '../shared/buildCssText';
import { isServer } from '../server/constant';
import { IStyleDefinition } from '../shared/parseStyles.types';

// เก็บสไตล์ที่รอ insert
const pendingStyleDefs = new Map<string, IStyleDefinition>();
let pending = false;
let dirty = false;

/**
 * ตัวช่วย: แยก string (ที่อาจมีหลาย block) ออกเป็น rule ย่อย ๆ
 */
function splitCssIntoIndividualRules(cssText: string): string[] {
  // จับทุกอย่างที่ลงท้ายด้วย '}'
  const ruleMatches = cssText.match(/[^}]+}/g) || [];
  return ruleMatches.map((r) => r.trim());
}

/**
 * flushPendingStyles:
 * - สร้าง CSS จากทุก styleDef ใน pendingStyleDefs
 * - insertRule ทีละ rule ลงใน stylesheet
 */
function flushPendingStyles() {
  const allRules: string[] = [];

  // สร้าง rule list ทั้งหมด
  for (const [displayName, styleDef] of pendingStyleDefs.entries()) {
    const cssText = buildCssText(displayName, styleDef);
    const ruleList = splitCssIntoIndividualRules(cssText);
    allRules.push(...ruleList);
  }

  // Insert ลงใน constructedSheet หรือ fallback
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

  // เคลียร์ pending
  pendingStyleDefs.clear();
  pending = false;

  // ถ้ามี dirty = true แปลว่าระหว่างกำลัง flush มีสไตล์เข้ามาใหม่ => flush อีกรอบ
  if (dirty) {
    dirty = false;
    scheduleFlush();
  }
}

/**
 * Schedule flush ด้วย requestAnimationFrame
 * (หรือจะเปลี่ยนเป็น setTimeout 0 ก็ได้ แล้วแต่)
 */
function scheduleFlush() {
  if (isServer) return;
  requestAnimationFrame(flushPendingStyles);
}

/**
 * insertCSSRules:
 * - เก็บ styleDef เข้า pending batch
 * - mark insertedRulesMap
 * - schedule flush (debounce)
 */
export function insertCSSRules(displayName: string, styleDef: IStyleDefinition) {
  pendingStyleDefs.set(displayName, styleDef);

  // ทำเป็นตัวอย่าง: Mark inserted (ถ้าต้องการ)
  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(displayName, inserted);

  if (pending) {
    dirty = true;
  } else {
    pending = true;
    dirty = false;
    scheduleFlush();
  }
}

/**
 * removeStyleRulesByDisplayName:
 * - ลบกฎเก่าที่เคย insert ไป โดยเช็คจาก rule.cssText
 * - ใช้วิธีวนลูป cssRules แล้วหา .includes(displayName)
 */
export function removeStyleRulesByDisplayName(displayName: string) {
  if (isServer) return;

  if (constructedSheet) {
    // ลูปย้อนเพื่อลบ rule ที่ match
    for (let i = constructedSheet.cssRules.length - 1; i >= 0; i--) {
      const rule = constructedSheet.cssRules[i];
      if (rule.cssText.includes(`.${displayName}`) || rule.cssText.includes(displayName)) {
        constructedSheet.deleteRule(i);
      }
    }
  } else if (fallbackStyleElement && fallbackStyleElement.sheet) {
    const fallbackSheet = fallbackStyleElement.sheet as CSSStyleSheet;
    for (let i = fallbackSheet.cssRules.length - 1; i >= 0; i--) {
      const rule = fallbackSheet.cssRules[i];
      if (rule.cssText.includes(`.${displayName}`) || rule.cssText.includes(displayName)) {
        fallbackSheet.deleteRule(i);
      }
    }
  }
}
