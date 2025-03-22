// src/client/styledUtils/extractScope.ts
//======================
// Extract / Ensure scope
//======================

import { IParsedDirective } from '../parseDirectives';

export function extractScope(directives: IParsedDirective[]): string {
  let scopeName: string | null = null;
  for (const d of directives) {
    if (d.name === 'scope') {
      if (scopeName) {
        throw new Error(`[SWD-ERR] multiple @scope found in the same styled block.`);
      }
      scopeName = d.value;
    }
  }
  if (!scopeName) {
    throw new Error(`[SWD-ERR] You must provide "@scope <name>" in styled(...) template.`);
  }
  return scopeName;
}
