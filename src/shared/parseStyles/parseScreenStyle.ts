// src/shared/parseStyles/parseScreenStyle.ts

import { breakpoints, fontDict } from '../../client/theme';
import { abbrMap } from '../constant';
import { IStyleDefinition } from './parseStyles.types';
import { convertCSSVariable, separateStyleAndProperties } from './parseStylesUtils';

// ---------------------------------------------------------
// parseScreenStyle
// ---------------------------------------------------------
export function parseScreenStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {
  const openParenIdx = abbrLine.indexOf('(');
  let inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  if (!(inside.startsWith('min') || inside.startsWith('max'))) {
    const [bp] = inside.split(', ');
    if (breakpoints.dict[bp]) {
      inside = inside.replace(bp, breakpoints.dict[bp]);
    }
  }

  const commaIdx = inside.indexOf(',');
  if (commaIdx === -1) {
    throw new Error(`"screen" syntax error: ${abbrLine}`);
  }

  const screenPart = inside.slice(0, commaIdx).trim();
  const propsPart = inside.slice(commaIdx + 1).trim();

  const bracketOpen = screenPart.indexOf('[');
  const bracketClose = screenPart.indexOf(']');
  if (bracketOpen === -1 || bracketClose === -1) {
    throw new Error(`"screen" must contain something like min-w[600px]. Got ${screenPart}`);
  }

  const screenAbbr = screenPart.slice(0, bracketOpen).trim();
  const screenValue = screenPart.slice(bracketOpen + 1, bracketClose).trim();

  const screenProp = abbrMap[screenAbbr as keyof typeof abbrMap];
  if (!screenProp) {
    throw new Error(`"${screenAbbr}" not found in abbrMap or not min-w/max-w`);
  }

  const mediaQuery = `(${screenProp}:${screenValue})`;

  const styleList = propsPart.split(/ (?=[^\[\]]*(?:\[|$))/);
  const screenProps: Record<string, string> = {};

  for (const p of styleList) {
    const [abbr, val] = separateStyleAndProperties(p);
    if (!abbr) continue;

    const expansions = [`${abbr}[${val}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      if (abbr2 === 'f') {
        const dictEntry = fontDict.dict[val2] as Record<string, string> | undefined;
        if (!dictEntry) {
          throw new Error(`"${val2}" not found in theme.font(...) dict (screen).`);
        }
        for (const [cssProp2, cssVal2] of Object.entries(dictEntry)) {
          screenProps[cssProp2] = convertCSSVariable(cssVal2);
        }
      } else {
        const cProp = abbrMap[abbr2 as keyof typeof abbrMap];
        if (!cProp) {
          throw new Error(`"${abbr2}" not found in abbrMap.`);
        }

        // >>> เพิ่ม logic ตรวจ --$ (local var)
        if (val2.startsWith('--$')) {
          const localVarRefName = val2.slice(3);
          screenProps[cProp] = `LOCALVAR(${localVarRefName})`;
        } else {
          screenProps[cProp] = convertCSSVariable(val2);
        }
      }
    }
  }

  styleDef.screens.push({ query: mediaQuery, props: screenProps });
}
