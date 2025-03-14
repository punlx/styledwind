// insertCSSRules.ts

import { constructedSheet, fallbackStyleElement } from './constant';
import { IStyleDefinition, StateName } from './helpers';

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
/***********************************************
 * buildCssText()
 ***********************************************/
function buildCssText(displayName: string, styleDef: IStyleDefinition): string {
  let cssText = '';

  // ถ้ามี styleDef.rootVars => ใส่ :root {...}
  if (styleDef.rootVars) {
    let varBlock = '';
    for (const varName in styleDef.rootVars) {
      varBlock += `${varName}:${styleDef.rootVars[varName]};`;
    }
    if (varBlock) {
      cssText += `:root{${varBlock}}`;
    }
  }

  // ต่อไปสร้าง .className {...}
  const baseObj = styleDef.base;
  if (Object.keys(baseObj).length > 0) {
    let baseProps = '';
    for (const prop in baseObj) {
      baseProps += `${prop}:${baseObj[prop]};`;
    }
    cssText += `.${displayName}{${baseProps}}`;
  }

  // States
  for (const state in styleDef.states) {
    const obj = styleDef.states[state];
    let props = '';
    for (const p in obj) {
      props += `${p}:${obj[p]};`;
    }
    cssText += `.${displayName}:${state}{${props}}`;
  }

  // Screens
  for (const scr of styleDef.screens) {
    let props = '';
    for (const p in scr.props) {
      props += `${p}:${scr.props[p]};`;
    }
    cssText += `@media only screen and ${scr.query}{.${displayName}{${props}}}`;
  }

  // Container
  for (const ctnr of styleDef.containers) {
    let props = '';
    for (const p in ctnr.props) {
      props += `${p}:${ctnr.props[p]};`;
    }
    cssText += `@container ${ctnr.query}{.${displayName}{${props}}}`;
  }

  // Pseudos
  if (styleDef.pseudos.before) {
    let beforeProps = '';
    for (const p in styleDef.pseudos.before) {
      beforeProps += `${p}:${styleDef.pseudos.before[p]};`;
    }
    cssText += `.${displayName}::before{${beforeProps}}`;
  }
  if (styleDef.pseudos.after) {
    let afterProps = '';
    for (const p in styleDef.pseudos.after) {
      afterProps += `${p}:${styleDef.pseudos.after[p]};`;
    }
    cssText += `.${displayName}::after{${afterProps}}`;
  }

  return cssText;
}

/***********************************************
 * transformVariables()
 * - ใส่ hash ต่อท้าย --xxx => --xxx-<hash>
 * - ใส่ค่า var ลงใน styleDef.rootVars
 * - แก้ styleDef.base ที่เป็น var(--xxx) => var(--xxx-<hash>)
 ***********************************************/
function transformVariables(styleDef: IStyleDefinition, displayName: string) {
  // แยก hash จาก displayName สมมติ 'box_abc123' => 'abc123'
  const idx = displayName.indexOf('_');
  if (idx < 0) return;
  const hashPart = displayName.slice(idx + 1);

  // สร้าง rootVars ถ้ายังไม่มี
  styleDef.rootVars = styleDef.rootVars || {};

  // base
  if (styleDef.varBase) {
    for (const varName in styleDef.varBase) {
      // rawValue เช่น "red"
      const rawValue = styleDef.varBase[varName];
      // ตัวแปรจริง => "--bg-abc123"
      const finalVarName = `--${varName}-${hashPart}`;

      // ใส่ลง rootVars
      styleDef.rootVars[finalVarName] = rawValue;

      // แก้ใน styleDef.base => var(--bg) => var(--bg-abc123)
      for (const cssProp in styleDef.base) {
        styleDef.base[cssProp] = styleDef.base[cssProp].replace(
          `var(--${varName})`,
          `var(${finalVarName})`
        );
      }
    }
  }

  if (styleDef.varStates) {
    for (const stName in styleDef.varStates) {
      const varsOfThatState = styleDef.varStates[stName] as StateName;
      for (const varName in varsOfThatState) {
        const rawValue = varsOfThatState[varName]; // เช่น "blue"
        // finalVarName = --bg-hover-hash
        const finalVarName = `--${varName}-${stName}-${hashPart}`;
        styleDef.rootVars![finalVarName] = rawValue;

        // แล้ว replace ใน styleDef.states[stName].background-color = var(--bg-hover) => var(--bg-hover-hash)
        for (const cssProp in styleDef.states[stName]) {
          styleDef.states[stName][cssProp] = styleDef.states[stName][cssProp].replace(
            `var(--${varName}-${stName})`,
            `var(${finalVarName})`
          );
        }
      }
    }
  }

  // (หากต้องการรองรับ varStates, varPseudos => ทำ logic คล้ายกัน)
}

/***********************************************
 * rebuildGlobalCSSDebounced()
 ***********************************************/
export function rebuildGlobalCSSDebounced() {
  if (pending) {
    dirty = true;
    return;
  }
  pending = true;
  dirty = false;

  requestAnimationFrame(() => {
    let newGlobalCss = '';
    for (const [displayName, styleDef] of styleDefMap.entries()) {
      newGlobalCss += buildCssText(displayName, styleDef);
    }

    if ('replaceSync' in constructedSheet) {
      (constructedSheet as CSSStyleSheet).replaceSync(newGlobalCss);
    } else if (fallbackStyleElement) {
      fallbackStyleElement.textContent = newGlobalCss;
    }

    pending = false;
    if (dirty) {
      rebuildGlobalCSSDebounced();
    }
  });
}

/***********************************************
 * insertCSSRules(displayName, styleDef)
 * - เรียก transformVariables -> set map -> rebuild
 ***********************************************/
export function insertCSSRules(displayName: string, styleDef: IStyleDefinition) {
  // ใส่ hash + สร้าง styleDef.rootVars
  transformVariables(styleDef, displayName);

  styleDefMap.set(displayName, styleDef);

  rebuildGlobalCSSDebounced();
}
