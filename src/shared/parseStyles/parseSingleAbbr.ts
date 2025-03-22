// src/shared/parseStyles/parseSingleAbbr.ts

import { parseBaseStyle } from './parseBaseStyle';
import { parseContainerStyle } from './parseContainerStyle';
import { parsePseudoElementStyle } from './parsePseudoElementStyle';
import { parseScreenStyle } from './parseScreenStyle';
import { parseStateStyle } from './parseStateStyle';
import { IStyleDefinition } from './parseStyles.types';

/**
 * parseSingleAbbr:
 * - parse directive "screen(...)", "container(...)", "hover(...)" ฯลฯ
 * - ถ้าไม่เข้า => parseBaseStyle
 */
export function parseSingleAbbr(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {
  const trimmed = abbrLine.trim();

  // 1) screen(...)
  if (trimmed.startsWith('screen(')) {
    parseScreenStyle(trimmed, styleDef, isConstContext);
    return;
  }

  // 2) container(...)
  if (trimmed.startsWith('container(')) {
    parseContainerStyle(trimmed, styleDef, isConstContext);
    return;
  }

  // 3) pseudo element before(...), after(...)
  if (trimmed.startsWith('before(') || trimmed.startsWith('after(')) {
    parsePseudoElementStyle(trimmed, styleDef, isConstContext);
    return;
  }

  // 4) state
  const knownStates = [
    'hover',
    'focus',
    'active',
    'focus-within',
    'focus-visible',
    'target',
    'disabled',
  ];
  for (const st of knownStates) {
    if (trimmed.startsWith(st + '(')) {
      parseStateStyle(trimmed, styleDef, isConstContext);
      return;
    }
  }

  // 5) base style
  parseBaseStyle(trimmed, styleDef, isConstContext);
}
