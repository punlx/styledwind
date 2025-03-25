// src/client/styledUtils/ensureScopeUnique.ts
export const usedScopes = new Set<string>();

/**
 * ensureScopeUnique:
 * - ป้องกัน scopeName ซ้ำข้ามไฟล์
 * - production: ใช้เตือนปกติ
 * - dev: ไม่เตือนซ้ำเมื่อ HMR reload (หรือเตือนแบบลดระดับ)
 */
export function ensureScopeUnique(scopeName: string) {
  if (process.env.NODE_ENV === 'production') {
    // Production: เตือนว่าซ้ำตามปกติ
    if (usedScopes.has(scopeName)) {
      console.warn(`[SWD-ERR] scope "${scopeName}" is already used in another file.`);
    }
  } 
  usedScopes.add(scopeName);
}
