// src/client/styledUtils/ensureScopeUnique.ts
export const usedScopes = new Set<string>();

export function ensureScopeUnique(scopeName: string) {
  if (usedScopes.has(scopeName)) {
    console.warn(
      `[SWD-ERR] scope "${scopeName}" is already used in another file. Refresh to check if it is a HMR error.`
    );
  }
  usedScopes.add(scopeName);
}
