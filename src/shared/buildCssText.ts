// src/shared/buildCssText.ts

import { IStyleDefinition } from './parseStyles';

/**
 * ฟังก์ชันเดิมที่ใช้สร้าง CSS text ของ class เดียว
 * (จะคืนค่าเป็นสตริง .className { ... } + pseudo + @media ... รวมเป็นก้อนเดียว)
 */
export function buildCssText(displayName: string, styleDef: IStyleDefinition): string {
  let cssText = '';

  // 1) root vars
  if (styleDef.rootVars) {
    let varBlock = '';
    for (const varName in styleDef.rootVars) {
      varBlock += `${varName}:${styleDef.rootVars[varName]};`;
    }
    if (varBlock) {
      cssText += `:root{${varBlock}}`;
    }
  }

  // 2) base
  if (Object.keys(styleDef.base).length > 0) {
    let baseProps = '';
    for (const prop in styleDef.base) {
      baseProps += `${prop}:${styleDef.base[prop]};`;
    }
    cssText += `.${displayName}{${baseProps}}`;
  }

  // 3) states
  for (const state in styleDef.states) {
    const obj = styleDef.states[state];
    let props = '';
    for (const p in obj) {
      props += `${p}:${obj[p]};`;
    }
    cssText += `.${displayName}:${state}{${props}}`;
  }

  // 4) screens (@media)
  for (const scr of styleDef.screens) {
    let props = '';
    for (const p in scr.props) {
      props += `${p}:${scr.props[p]};`;
    }
    cssText += `@media only screen and ${scr.query}{.${displayName}{${props}}}`;
  }

  // 5) containers (@container)
  for (const ctnr of styleDef.containers) {
    let props = '';
    for (const p in ctnr.props) {
      props += `${p}:${ctnr.props[p]};`;
    }
    cssText += `@container ${ctnr.query}{.${displayName}{${props}}}`;
  }

  // 6) pseudos (::before / ::after)
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
