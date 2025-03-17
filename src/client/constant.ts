export const constructedSheet = new CSSStyleSheet();

let fallbackStyleElement: HTMLStyleElement | null = null;

if ('adoptedStyleSheets' in Document.prototype) {
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, constructedSheet];
} else {
  const styleEl = document.createElement('style');
  styleEl.id = 'styledwind-construct-fallback';
  document.head.appendChild(styleEl);
  fallbackStyleElement = styleEl;
}

export { fallbackStyleElement };

export interface IInsertedRules {
  displayName: string;
}

export const insertedRulesMap = new Map<string, IInsertedRules>();
