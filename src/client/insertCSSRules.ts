// src/client/insertCSSRules.ts

import { constructedSheet, fallbackStyleElement } from './constant';
import { IStyleDefinition } from '../shared/helpers'; // เปลี่ยนเส้นทาง import

const styleDefMap = new Map<string, IStyleDefinition>();

let pending = false;
let dirty = false;

function buildCssText(displayName: string, styleDef: IStyleDefinition): string {
  let cssText = '';

  if (styleDef.rootVars) {
    let varBlock = '';
    for (const varName in styleDef.rootVars) {
      varBlock += `${varName}:${styleDef.rootVars[varName]};`;
    }
    if (varBlock) {
      cssText += `:root{${varBlock}}`;
    }
  }

  if (Object.keys(styleDef.base).length > 0) {
    let baseProps = '';
    for (const prop in styleDef.base) {
      baseProps += `${prop}:${styleDef.base[prop]};`;
    }
    cssText += `.${displayName}{${baseProps}}`;
  }

  for (const state in styleDef.states) {
    const obj = styleDef.states[state];
    let props = '';
    for (const p in obj) {
      props += `${p}:${obj[p]};`;
    }
    cssText += `.${displayName}:${state}{${props}}`;
  }

  for (const scr of styleDef.screens) {
    let props = '';
    for (const p in scr.props) {
      props += `${p}:${scr.props[p]};`;
    }
    cssText += `@media only screen and ${scr.query}{.${displayName}{${props}}}`;
  }

  for (const ctnr of styleDef.containers) {
    let props = '';
    for (const p in ctnr.props) {
      props += `${p}:${ctnr.props[p]};`;
    }
    cssText += `@container ${ctnr.query}{.${displayName}{${props}}}`;
  }

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

function transformVariables(styleDef: IStyleDefinition, displayName: string) {
  const idx = displayName.indexOf('_');
  if (idx < 0) return;
  const hashPart = displayName.slice(idx + 1);

  styleDef.rootVars = styleDef.rootVars || {};

  if (styleDef.varBase) {
    for (const varName in styleDef.varBase) {
      const rawValue = styleDef.varBase[varName];
      const finalVarName = `--${varName}-${hashPart}`;
      styleDef.rootVars[finalVarName] = rawValue;

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
      // แก้ type
      const varsOfThatState: Record<string, string> = styleDef.varStates[stName] || {};
      for (const varName in varsOfThatState) {
        const rawValue = varsOfThatState[varName];
        const finalVarName = `--${varName}-${stName}-${hashPart}`;
        styleDef.rootVars[finalVarName] = rawValue;

        for (const cssProp in styleDef.states[stName]) {
          styleDef.states[stName][cssProp] = styleDef.states[stName][cssProp].replace(
            `var(--${varName}-${stName})`,
            `var(${finalVarName})`
          );
        }
      }
    }
  }
}

function rebuildGlobalCSSDebounced() {
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
      constructedSheet.replaceSync(newGlobalCss);
    } else if (fallbackStyleElement) {
      fallbackStyleElement.textContent = newGlobalCss;
    }

    pending = false;
    if (dirty) {
      rebuildGlobalCSSDebounced();
    }
  });
}

export function insertCSSRules(displayName: string, styleDef: IStyleDefinition) {
  transformVariables(styleDef, displayName);
  styleDefMap.set(displayName, styleDef);
  rebuildGlobalCSSDebounced();
}
