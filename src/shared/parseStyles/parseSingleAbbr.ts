// src/shared/parseStyles/parseSingleAbbr.ts
import { parseBaseStyle } from './parseBaseStyle';
import { parseContainerStyle } from './parseContainerStyle';
import { parsePseudoElementStyle } from './parsePseudoElementStyle';
import { parseScreenStyle } from './parseScreenStyle';
import { parseStateStyle } from './parseStateStyle';
import { IStyleDefinition } from '../parseStyles.types';

export function parseSingleAbbr(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false,
  isQueryBlock: boolean = false
) {
  const trimmed = abbrLine.trim();

  // 1) check @query nested
  if (isQueryBlock && trimmed.startsWith('@query')) {
    throw new Error(`[SWD-ERR] Nested @query is not allowed.`);
  }

  if (isQueryBlock) {
    if (/^--&[\w-]+\[/.test(trimmed)) {
      throw new Error(`[SWD-ERR] Local var not allowed inside @query block. Found: "${trimmed}"`);
    }
    if (/^\$[\w-]+\[/.test(trimmed)) {
      throw new Error(
        `[SWD-ERR] Runtime variable ($var) not allowed inside @query block. Found: "${trimmed}"`
      );
    }
  }

  // 3) check screen(...) / container(...) / before(...) / after(...) / states(...)
  if (trimmed.startsWith('screen(')) {
    parseScreenStyle(trimmed, styleDef, isConstContext);
    return;
  }
  if (trimmed.startsWith('container(')) {
    parseContainerStyle(trimmed, styleDef, isConstContext);
    return;
  }
  if (trimmed.startsWith('before(') || trimmed.startsWith('after(')) {
    parsePseudoElementStyle(trimmed, styleDef, isConstContext);
    return;
  }
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

  // 4) base style
  parseBaseStyle(trimmed, styleDef, isConstContext, isQueryBlock);
}
