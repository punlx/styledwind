export interface IStyleDefinition {
    base: Record<string, string>;
    states: Record<string, Record<string, string>>;
    screens: Array<{
        query: string;
        props: Record<string, string>;
    }>;
    containers: Array<{
        query: string;
        props: Record<string, string>;
    }>;
    pseudos: {
        before?: Record<string, string>;
        after?: Record<string, string>;
    };
    varStates?: {
        [stateName: string]: Record<string, string>;
    };
    varBase?: Record<string, string>;
    varPseudos?: {
        before?: Record<string, string>;
        after?: Record<string, string>;
    };
    rootVars?: Record<string, string>;
}
export declare function createEmptyStyleDef(): IStyleDefinition;
export declare function separateStyleAndProperties(abbr: string): [string, string];
export declare function convertCSSVariable(value: string): string;
export declare function parseBaseStyle(abbrLine: string, styleDef: IStyleDefinition): void;
export declare function parseScreenStyle(abbrLine: string, styleDef: IStyleDefinition): void;
export declare function parseContainerStyle(abbrLine: string, styleDef: IStyleDefinition): void;
export declare function parsePseudoElementStyle(abbrLine: string, styleDef: IStyleDefinition): void;
export declare function parseStateStyle(abbrLine: string, styleDef: IStyleDefinition): void;
export declare function parseSingleAbbr(abbrLine: string, styleDef: IStyleDefinition): void;
export declare function parseClassDefinition(className: string, abbrStyle: string): IStyleDefinition;
