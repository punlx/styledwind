// insertCSSRules.ts
import { constructedSheet, fallbackStyleElement, insertedRulesMap } from './constant';
import { IStyleDefinition } from './helpers';

/**
 * styleDefMap:
 *  เก็บ mapping: displayName => IStyleDefinition
 *  เพื่อให้เวลาจะ update properties ใน set(...) ทำได้
 */
export const styleDefMap = new Map<string, IStyleDefinition>();

/**
 * ตัวแปรควบคุมการ "debounce" rebuild
 */
let pending = false;
let dirty = false;

/**
 * buildCssText():
 *  สร้างสตริง CSS สำหรับ 1 className (displayName) และ styleDef
 */
function buildCssText(displayName: string, styleDef: IStyleDefinition): string {
  let cssText = '';

  // 1) Base
  const baseObj = styleDef.base;
  if (Object.keys(baseObj).length > 0) {
    const baseProps = Object.entries(baseObj)
      .map(([prop, val]) => `${prop}:${val};`)
      .join('');
    cssText += `.${displayName}{${baseProps}}`;
  }

  // 2) States (hover, focus, etc.)
  for (const state in styleDef.states) {
    const obj = styleDef.states[state];
    const props = Object.entries(obj)
      .map(([p, v]) => `${p}:${v};`)
      .join('');
    cssText += `.${displayName}:${state}{${props}}`;
  }

  // 3) Screens
  for (const scr of styleDef.screens) {
    const props = Object.entries(scr.props)
      .map(([p, v]) => `${p}:${v};`)
      .join('');
    cssText += `@media only screen and ${scr.query}{.${displayName}{${props}}}`;
  }

  // 4) Container
  for (const ctnr of styleDef.containers) {
    const props = Object.entries(ctnr.props)
      .map(([p, v]) => `${p}:${v};`)
      .join('');
    cssText += `@container ${ctnr.query}{.${displayName}{${props}}}`;
  }

  // 5) Pseudos (before/after)
  if (styleDef.pseudos.before) {
    const beforeProps = Object.entries(styleDef.pseudos.before)
      .map(([p, v]) => `${p}:${v};`)
      .join('');
    cssText += `.${displayName}::before{${beforeProps}}`;
  }
  if (styleDef.pseudos.after) {
    const afterProps = Object.entries(styleDef.pseudos.after)
      .map(([p, v]) => `${p}:${v};`)
      .join('');
    cssText += `.${displayName}::after{${afterProps}}`;
  }

  return cssText;
}

/**
 * rebuildGlobalCSSDebounced():
 *  - ถ้าไม่มีการเรียกใช้อยู่, เริ่ม requestAnimationFrame
 *  - ถ้ามีการเรียกซ้ำระหว่างนี้, set dirty = true เพื่อบอกว่าหลังจบ frame นี้ค่อยทำอีกรอบ
 */
export function rebuildGlobalCSSDebounced() {
  // ถ้ามีรอบ pending อยู่แล้ว => แค่ set dirty
  if (pending) {
    dirty = true;
    return;
  }

  // ถ้าไม่มีรอบ pending => ตั้งค่าว่าเรากำลังรอ
  pending = true;
  dirty = false;

  requestAnimationFrame(() => {
    // เริ่ม build CSS
    let newGlobalCss = '';
    for (const [displayName, styleDef] of styleDefMap.entries()) {
      newGlobalCss += buildCssText(displayName, styleDef);
    }

    // commit ลง constructedSheet หรือ fallback
    if ('replaceSync' in constructedSheet) {
      (constructedSheet as CSSStyleSheet).replaceSync(newGlobalCss);
    } else if (fallbackStyleElement) {
      fallbackStyleElement.textContent = newGlobalCss;
    }

    // จบ frame นี้แล้ว
    pending = false;
    // ถ้ามีการเรียกซ้ำในระหว่างนี้ => dirty = true
    if (dirty) {
      rebuildGlobalCSSDebounced();
    }
  });
}

/**
 * insertCSSRules(displayName, styleDef):
 *  - เก็บ styleDef ลง map
 *  - แล้ว rebuild (debounced)
 */
export function insertCSSRules(displayName: string, styleDef: IStyleDefinition) {
  styleDefMap.set(displayName, styleDef);

  // ก็เรียก debounced rebuild
  rebuildGlobalCSSDebounced();
}
