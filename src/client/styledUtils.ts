// src/client/styledUtils.ts

import { IParsedDirective, IClassBlock } from './parseDirectives';
import { IStyleDefinition, createEmptyStyleDef, parseSingleAbbr } from '../shared/parseStyles';
import { processOneClass } from './processOneClass';

// (อาจจะแยกเป็นไฟล์ styledVars หรือรวมในไฟล์นี้ก็ได้ ตามของเดิม)

//======================
// Global sets
//======================
export const usedScopes = new Set<string>();
export const usedScopeClasses = new Set<string>();

//======================
// Extract / Ensure scope
//======================

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

export function ensureScopeUnique(scopeName: string) {
  if (usedScopes.has(scopeName)) {
    console.warn(
      `[SWD-ERR] scope "${scopeName}" is already used in another file. Refresh to check if it is a HMR error.`
    );
  }
  usedScopes.add(scopeName);
}

//======================
// processClassBlocks
//======================

/**
 * processClassBlocks:
 * - วน loop classBlocks => ตรวจซ้ำ => สร้าง styleDef
 * - ตรวจว่าใน body มี '@use constName1 constName2 ...' มั้ย
 * - ถ้ามี => merge partial styleDef จาก constMap
 * - สุดท้าย call processOneClass => ได้ scopeName_className
 */
export function processClassBlocks(
  scopeName: string,
  classBlocks: IClassBlock[],
  constMap: Map<string, IStyleDefinition>
): Record<string, string> {
  const localClasses = new Set<string>();
  const resultMap: Record<string, string> = {};

  for (const block of classBlocks) {
    const clsName = block.className;

    // กันซ้ำภายในไฟล์
    if (localClasses.has(clsName)) {
      throw new Error(
        `[SWD-ERR] Duplicate class ".${clsName}" in scope "${scopeName}" (same file).`
      );
    }
    localClasses.add(clsName);

    // กันซ้ำข้ามไฟล์
    const scopeClassKey = `${scopeName}:${clsName}`;
    if (usedScopeClasses.has(scopeClassKey)) {
      console.warn(
        `[SWD-ERR] Class ".${clsName}" in scope "${scopeName}" is already used in another file. Refresh to check if it is a HMR error.`
      );
    }
    usedScopeClasses.add(scopeClassKey);

    //=====================================
    // A) แยกบรรทัดใน block.body
    //=====================================
    const lines = block.body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    let usedConstNames: string[] = []; // เก็บชื่อ const จาก @use
    const normalLines: string[] = []; // เก็บบรรทัดปกติ

    for (const line of lines) {
      if (line.startsWith('@use ')) {
        // เช็คว่าถ้ามีการเจอ @use มากกว่า 1 บรรทัด => throw
        if (usedConstNames.length > 0) {
          throw new Error(`[SWD-ERR] Multiple @use lines in class ".${clsName}" are not allowed.`);
        }
        // แยกชื่อ const
        const tokens = line.replace('@use', '').trim().split(/\s+/);
        usedConstNames = tokens;
      } else {
        normalLines.push(line);
      }
    }

    //=====================================
    // B) parse normalLines => styleDef
    //=====================================
    const classStyleDef = createEmptyStyleDef();
    for (const ln of normalLines) {
      parseSingleAbbr(ln, classStyleDef);
    }

    //=====================================
    // C) merge partial styleDef จากแต่ละ const
    //=====================================
    if (usedConstNames.length > 0) {
      for (const cName of usedConstNames) {
        if (!constMap.has(cName)) {
          throw new Error(`[SWD-ERR] @use refers to unknown const "${cName}".`);
        }
        const partialDef = constMap.get(cName)!;
        mergeStyleDef(classStyleDef, partialDef);
      }
    }

    //=====================================
    // D) สร้าง CSS (transform + insert)
    //    ผ่าน processOneClass
    //=====================================
    const displayName = processOneClass(clsName, classStyleDef, scopeName);

    //  ใส่ mapping className => displayName
    resultMap[clsName] = displayName;
  }

  return resultMap;
}

/**
 * mergeStyleDef(target, source):
 * - เอา source (partial styleDef) มารวมเข้า target
 * - property/state/pseudo ที่ซ้ำกัน => override ด้วย source
 */
function mergeStyleDef(target: IStyleDefinition, source: IStyleDefinition) {
  // base
  for (const prop in source.base) {
    target.base[prop] = source.base[prop];
  }
  // states
  for (const st in source.states) {
    if (!target.states[st]) {
      target.states[st] = {};
    }
    for (const p in source.states[st]) {
      target.states[st][p] = source.states[st][p];
    }
  }
  // screens
  for (const s of source.screens) {
    // naive: push
    target.screens.push({ query: s.query, props: { ...s.props } });
  }
  // containers
  for (const c of source.containers) {
    target.containers.push({ query: c.query, props: { ...c.props } });
  }
  // pseudos
  for (const pName in source.pseudos) {
    if (!target.pseudos[pName]) {
      target.pseudos[pName] = {};
    }
    const fromPseudo = source.pseudos[pName]!;
    for (const prop in fromPseudo) {
      target.pseudos[pName]![prop] = fromPseudo[prop];
    }
  }

  // varBase
  if (source.varBase) {
    if (!target.varBase) {
      target.varBase = {};
    }
    for (const k in source.varBase) {
      target.varBase[k] = source.varBase[k];
    }
  }
  // varStates
  if (source.varStates) {
    if (!target.varStates) {
      target.varStates = {};
    }
    for (const stName in source.varStates) {
      if (!target.varStates[stName]) {
        target.varStates[stName] = {};
      }
      for (const k in source.varStates[stName]) {
        target.varStates[stName][k] = source.varStates[stName][k];
      }
    }
  }
  // varPseudos
  if (source.varPseudos) {
    if (!target.varPseudos) {
      target.varPseudos = {};
    }
    for (const pseudoKey in source.varPseudos) {
      if (!target.varPseudos[pseudoKey]) {
        target.varPseudos[pseudoKey] = {};
      }
      for (const k in source.varPseudos[pseudoKey]) {
        target.varPseudos[pseudoKey]![k] = source.varPseudos[pseudoKey][k];
      }
    }
  }

  // rootVars
  if (source.rootVars) {
    if (!target.rootVars) {
      target.rootVars = {};
    }
    for (const rv in source.rootVars) {
      target.rootVars[rv] = source.rootVars[rv];
    }
  }
}

//=====================================
// attachGetMethod + handleBindDirectives
//=====================================

type InterimResult<T> = {
  [K in keyof T]: string;
} & {
  [key: string]: string | undefined;
} & {
  get?: <K2 extends keyof T>(
    classKey: K2
  ) => {
    set: (props: Partial<Record<string, string>>) => void;
  };
};

export function attachGetMethod<T extends Record<string, any>>(resultObj: InterimResult<T>): void {
  resultObj.get = function <K2 extends keyof T>(classKey: K2) {
    return {
      set: (props: Partial<Record<string, string>>) => {
        const displayName = resultObj[classKey as string];
        if (!displayName) return;

        const { scope, cls } = parseDisplayName(displayName);

        for (const abbr in props) {
          let val = props[abbr];
          if (!val) continue;

          // แยก varName / suffix
          const { baseVarName, suffix } = parseVariableAbbr(abbr);
          // ประกอบชื่อ
          const finalVar = buildVariableName(baseVarName, scope, cls, suffix);

          // ถ้า value มี --xxx => replace เป็น var(--xxx)
          if (val.includes('--')) {
            val = val.replace(/(--[\w-]+)/g, 'var($1)');
          }
          // เก็บลง queue
          pendingVars[finalVar] = val;
        }
        // schedule flush
        scheduleFlush();
      },
    };
  };
}

/**
 * handleBindDirectives(scopeName, directives, resultObj):
 * - parse @bind
 */
export function handleBindDirectives(
  scopeName: string,
  directives: IParsedDirective[],
  resultObj: Record<string, string>
) {
  const localBindKeys = new Set<string>();

  for (const d of directives) {
    if (d.name === 'bind') {
      const tokens = d.value.trim().split(/\s+/);
      if (tokens.length < 2) {
        throw new Error(`[SWD-ERR] Invalid @bind syntax: "${d.value}"`);
      }
      const bindKey = tokens[0];
      const classRefs = tokens.slice(1);

      if (localBindKeys.has(bindKey)) {
        throw new Error(`[SWD-ERR] @bind key "${bindKey}" is already used in this file.`);
      }
      localBindKeys.add(bindKey);

      if (Object.prototype.hasOwnProperty.call(resultObj, bindKey)) {
        throw new Error(
          `[SWD-ERR] @bind key "${bindKey}" conflicts with existing property in styled (scope="${scopeName}").`
        );
      }

      const finalClassList: string[] = [];
      for (const ref of classRefs) {
        if (!ref.startsWith('.')) {
          throw new Error(`[SWD-ERR] @bind usage must reference classes with a dot, got "${ref}"`);
        }
        const refName = ref.slice(1);
        if (!resultObj[refName]) {
          throw new Error(
            `[SWD-ERR] @bind referencing ".${refName}" but that class is not defined.`
          );
        }
        finalClassList.push(resultObj[refName]);
      }

      const joined = finalClassList.join(' ');
      resultObj[bindKey] = joined;
    }
  }
}

//=====================================
// Queue + rAF สำหรับ runtime variable
//=====================================

const pendingVars: Record<string, string> = {};
let rafScheduled = false;

function flushVars() {
  for (const [varName, val] of Object.entries(pendingVars)) {
    document.documentElement.style.setProperty(varName, val);
  }
  for (const key in pendingVars) {
    delete pendingVars[key];
  }
  rafScheduled = false;
}

function scheduleFlush() {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushVars);
  }
}

// stylef varriable
// src/client/styledVars.ts

/**
 * parseDisplayName:
 * - แยก "scope_class" ออกเป็น { scope, cls }
 */
export function parseDisplayName(displayName: string): { scope: string; cls: string } {
  const underscoreIdx = displayName.indexOf('_');
  if (underscoreIdx < 0) {
    throw new Error(`[SWD-ERR] Invalid displayName "${displayName}". Must contain underscore.`);
  }
  return {
    scope: displayName.slice(0, underscoreIdx),
    cls: displayName.slice(underscoreIdx + 1),
  };
}

/**
 * parseVariableAbbr:
 * - แยก "$bg-hover" => { baseVarName: "bg", suffix: "hover" }
 * - ถ้าไม่มี dash => { baseVarName: "bg", suffix: "" }
 */
export function parseVariableAbbr(abbr: string): { baseVarName: string; suffix: string } {
  if (!abbr.startsWith('$')) {
    throw new Error(`[SWD-ERR] Only $variable is supported. Got "${abbr}"`);
  }
  const varNameFull = abbr.slice(1); // ตัด '$'
  let baseVarName = varNameFull;
  let suffix = '';

  const dashIdx = varNameFull.lastIndexOf('-');
  if (dashIdx > 0) {
    baseVarName = varNameFull.slice(0, dashIdx);
    suffix = varNameFull.slice(dashIdx + 1);
  }
  return { baseVarName, suffix };
}

/**
 * buildVariableName:
 * - ประกอบชื่อ CSS variable ตรงกับ transformVariables.ts
 * - เช่น baseVarName="bg", scope="app", cls="box", suffix="hover"
 *   => "--bg-app_box-hover"
 */
export function buildVariableName(
  baseVarName: string,
  scope: string,
  cls: string,
  suffix: string
): string {
  if (!suffix) {
    return `--${baseVarName}-${scope}_${cls}`;
  }
  return `--${baseVarName}-${scope}_${cls}-${suffix}`;
}
