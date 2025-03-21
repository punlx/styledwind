// src/client/transformVariables.ts

import { IStyleDefinition } from '../shared/parseStyles';

/**
 * transformVariables:
 * เปลี่ยนตัวแปร $var (เช่น $bg, $c) ให้กลายเป็น var(--bg-scopeName_className)
 * หรือถ้าอยู่ใน state/pseudo (เช่น hover, before, after) ก็เติม -hover / -before / -after ต่อท้าย
 *
 * สมมติ:
 *  - scopeName = 'app'
 *  - className = 'box'
 *  => --bg-app_box
 *  => --c-app_box-hover
 *  => --bg-app_box-after
 */
export function transFormVariables(
  styleDef: IStyleDefinition,
  scopeName: string,
  className: string
): void {
  // -----------------------------
  // 1) Base variables (varBase)
  // -----------------------------
  if (styleDef.varBase) {
    for (const varName in styleDef.varBase) {
      const rawValue = styleDef.varBase[varName];
      // finalVarName => --varName-scope_class
      const finalVarName = `--${varName}-${scopeName}_${className}`;

      // เขียนลง rootVars
      styleDef.rootVars = styleDef.rootVars || {};
      styleDef.rootVars[finalVarName] = rawValue;

      // replace ใน base props
      for (const cssProp in styleDef.base) {
        styleDef.base[cssProp] = styleDef.base[cssProp].replace(
          `var(--${varName})`,
          `var(${finalVarName})`
        );
      }
    }
  }

  // -----------------------------
  // 2) State variables (varStates)
  // -----------------------------
  if (styleDef.varStates) {
    for (const stName in styleDef.varStates) {
      const varsOfThatState: Record<string, string> = styleDef.varStates[stName] || {};
      for (const varName in varsOfThatState) {
        const rawValue = varsOfThatState[varName];
        // ตัวแปรใส่ -scope_class-state
        const finalVarName = `--${varName}-${scopeName}_${className}-${stName}`;

        styleDef.rootVars = styleDef.rootVars || {};
        styleDef.rootVars[finalVarName] = rawValue;

        // replace var(--varName-state) => var(--varName-scope_class-state)
        const stateProps = styleDef.states[stName];
        if (stateProps) {
          for (const cssProp in stateProps) {
            stateProps[cssProp] = stateProps[cssProp].replace(
              `var(--${varName}-${stName})`,
              `var(${finalVarName})`
            );
          }
        }
      }
    }
  }

  // ------------------------------------------------------
  // 3) Pseudo variables (varPseudos.before / varPseudos.after)
  // ------------------------------------------------------
  if (styleDef.varPseudos) {
    for (const pseudoName in styleDef.varPseudos) {
      if (pseudoName === 'before' || pseudoName === 'after') {
        // pseudoVars = { bg: 'yellow', c: 'blue' } สมมติ
        const pseudoVars: Record<string, string> = styleDef.varPseudos[pseudoName] || {};
        for (const varName in pseudoVars) {
          const rawValue = pseudoVars[varName];
          // finalVarName -> --bg-app_box-after
          const finalVarName = `--${varName}-${scopeName}_${className}-${pseudoName}`;

          // เก็บลง rootVars
          styleDef.rootVars = styleDef.rootVars || {};
          styleDef.rootVars[finalVarName] = rawValue;

          // replace ใน styleDef.pseudos[pseudoName]
          const pseudoProps = styleDef.pseudos[pseudoName];
          if (pseudoProps) {
            for (const cssProp in pseudoProps) {
              pseudoProps[cssProp] = pseudoProps[cssProp].replace(
                `var(--${varName}-${pseudoName})`,
                `var(${finalVarName})`
              );
            }
          }
        }
      }
    }
  }
}
