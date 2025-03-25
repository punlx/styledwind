// src/shared/parseStyles/parseStylesUtils.ts

import { IStyleDefinition } from '../parseStyles.types';

export function createEmptyStyleDef(): IStyleDefinition {
  return {
    base: {},
    states: {},
    screens: [],
    containers: [],
    pseudos: {},
  };
}

export function separateStyleAndProperties(abbr: string): [string, string] {
  const match = /^([\w\-\$\&]+)\[(.*)\]$/.exec(abbr.trim());
  if (!match) return ['', ''];
  return [match[1], match[2]];
}

export function convertCSSVariable(value: string) {
  if (value.includes('--')) {
    // เช่น "--&xxx" หรือ "--global-var"
    return value.replace(/(--[\w-]+)/g, 'var($1)');
  }
  return value;
}
