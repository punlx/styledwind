import { parseBaseStyle } from './parseBaseStyle';
import { parseContainerStyle } from './parseContainerStyle';
import { parsePseudoElementStyle } from './parsePseudoElementStyle';
import { parseScreenStyle } from './parseScreenStyle';
import { parseStateStyle } from './parseStateStyle';
import { IStyleDefinition } from '../parseStyles.types';
const supportedPseudos = [
  'before',
  'after',
  'placeholder',
  'selection',
  'file-selector-button',
  'first-letter',
  'first-line',
  'marker',
  'backdrop',
  'spelling-error',
  'grammar-error',
];
const knownStates = [
  'hover',
  'focus',
  'active',
  'focus-within',
  'focus-visible',
  'target',
  'disabled',
  'enabled',
  'read-only',
  'read-write',
  'required',
  'optional',
  'checked',
  'indeterminate',
  'valid',
  'invalid',
  'in-range',
  'out-of-range',
  'placeholder-shown',
  'default',
  'link',
  'visited',
  'user-invalid',
];
export function parseSingleAbbr(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false,
  isQueryBlock: boolean = false
) {
  const trimmed = abbrLine.trim();
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
  if (!styleDef.hasRuntimeVar && /\$[\w-]+\[/.test(trimmed)) {
    styleDef.hasRuntimeVar = true;
  }
  const openParenIndex = trimmed.indexOf('(');
  if (openParenIndex === -1) {
    parseBaseStyle(trimmed, styleDef, isConstContext, isQueryBlock);
    return;
  }
  const prefix = trimmed.slice(0, openParenIndex);
  if (knownStates.includes(prefix)) {
    parseStateStyle(trimmed, styleDef, isConstContext);
    return;
  }
  if (supportedPseudos.includes(prefix)) {
    parsePseudoElementStyle(trimmed, styleDef, isConstContext);
    return;
  }
  if (prefix === 'screen') {
    parseScreenStyle(trimmed, styleDef, isConstContext);
    return;
  }
  if (prefix === 'container') {
    parseContainerStyle(trimmed, styleDef, isConstContext);
    return;
  }
  parseBaseStyle(trimmed, styleDef, isConstContext, isQueryBlock);
}
