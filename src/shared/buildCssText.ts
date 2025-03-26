// src/shared/buildCssText.ts
import { IStyleDefinition } from './parseStyles.types';
export function buildCssText(displayName: string, styleDef: IStyleDefinition): string {
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
  let baseProps = '';
  const localVars = (styleDef as any)._resolvedLocalVars as Record<string, string> | undefined;
  if (localVars) {
    for (const localVarName in localVars) {
      baseProps += `${localVarName}:${localVars[localVarName]};`;
    }
  }
  if (Object.keys(styleDef.base).length > 0) {
    for (const prop in styleDef.base) {
      baseProps += `${prop}:${styleDef.base[prop]};`;
    }
  }
  if (baseProps) {
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
  if (styleDef.queries && styleDef.queries.length > 0) {
    for (const q of styleDef.queries) {
      cssText += buildQueryCssText(displayName, q.selector, q.styleDef);
    }
  }
  return cssText;
}
function buildQueryCssText(
  parentDisplayName: string,
  selector: string,
  qDef: IStyleDefinition
): string {
  let out = '';
  let baseProps = '';
  const localVars = (qDef as any)._resolvedLocalVars as Record<string, string> | undefined;
  if (localVars) {
    for (const localVarName in localVars) {
      baseProps += `${localVarName}:${localVars[localVarName]};`;
    }
  }
  if (Object.keys(qDef.base).length > 0) {
    for (const prop in qDef.base) {
      baseProps += `${prop}:${qDef.base[prop]};`;
    }
  }
  if (baseProps) {
    out += `.${parentDisplayName} ${selector}{${baseProps}}`;
  }
  for (const state in qDef.states) {
    const obj = qDef.states[state];
    let props = '';
    for (const p in obj) {
      props += `${p}:${obj[p]};`;
    }
    out += `.${parentDisplayName} ${selector}:${state}{${props}}`;
  }
  for (const scr of qDef.screens) {
    let props = '';
    for (const p in scr.props) {
      props += `${p}:${scr.props[p]};`;
    }
    out += `@media only screen and ${scr.query}{.${parentDisplayName} ${selector}{${props}}}`;
  }
  for (const ctnr of qDef.containers) {
    let props = '';
    for (const p in ctnr.props) {
      props += `${p}:${ctnr.props[p]};`;
    }
    out += `@container ${ctnr.query}{.${parentDisplayName} ${selector}{${props}}}`;
  }
  if (qDef.pseudos.before) {
    let bfProps = '';
    for (const p in qDef.pseudos.before) {
      bfProps += `${p}:${qDef.pseudos.before[p]};`;
    }
    if (bfProps) {
      out += `.${parentDisplayName} ${selector}::before{${bfProps}}`;
    }
  }
  if (qDef.pseudos.after) {
    let afProps = '';
    for (const p in qDef.pseudos.after) {
      afProps += `${p}:${qDef.pseudos.after[p]};`;
    }
    if (afProps) {
      out += `.${parentDisplayName} ${selector}::after{${afProps}}`;
    }
  }
  return out;
}
