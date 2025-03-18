// src/client/transformVariables.ts
import { IStyleDefinition } from '../shared/parseStyles';

export function transformVariables(styleDef: IStyleDefinition, displayName: string) {
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
