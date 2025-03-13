// constant.ts

/**********************************************
 * 1) คำย่อ -> ชื่อ CSS property
 **********************************************/
export const abbrMap = {
  ac: 'align-content',
  ai: 'align-items',
  as: 'align-self',
  ani: 'animation',
  bg: 'background-color',
  'bg-pos': 'background-position',
  'bg-size': 'background-size',
  'bg-repeat': 'background-repeat',
  'bg-clip': 'background-clip',
  'bg-origin': 'background-origin',
  bd: 'border',
  bdl: 'border-left',
  bdt: 'border-top',
  bdr: 'border-right',
  bdb: 'border-bottom',
  'bd-spacing': 'border-spacing',
  'bd-collapse': 'border-collapse',
  rd: 'border-radius',
  'bd-img': 'border-image',
  sd: 'box-shadow',
  siz: 'box-sizing',
  c: 'color',
  'col-gap': 'column-gap',
  'row-gap': 'row-gap',
  cols: 'columns',
  content: 'content',
  curs: 'cursor',
  'ct-type': 'container-type',
  ct: 'container',
  d: 'display',
  family: 'font-family',
  fs: 'font-size',
  fw: 'font-weight',
  fx: 'flex',
  basis: 'flex-basis',
  wrap: 'flex-wrap',
  direc: 'flex-direction',
  flow: 'flex-flow',
  grow: 'flex-grow',
  shrink: 'flex-shrink',
  gap: 'gap',
  gd: 'grid',
  'gd-area': 'grid-area',
  'gd-auto-cols': 'grid-auto-columns',
  'gd-auto-flow': 'grid-auto-flow',
  'gd-auto-rows': 'grid-auto-rows',
  'gd-col': 'grid-column',
  'gd-col-end': 'grid-column-end',
  'gd-col-gap': 'grid-column-gap',
  'gd-col-start': 'grid-column-start',
  'gd-gap': 'grid-gap',
  'gd-row': 'grid-row',
  'gd-row-end': 'grid-row-end',
  'gd-row-gap': 'grid-row-gap',
  'gd-row-start': 'grid-row-start',
  'gd-temp': 'grid-template',
  'gd-temp-areas': 'grid-template-areas',
  'gd-temp-cols': 'grid-template-columns',
  'gd-temp-rows': 'grid-template-rows',
  jc: 'justify-content',
  ji: 'justify-items',
  js: 'justify-self',
  lh: 'line-height',
  w: 'width',
  'max-w': 'max-width',
  'min-w': 'min-width',
  h: 'height',
  'max-h': 'max-height',
  'min-h': 'min-height',
  m: 'margin',
  ml: 'margin-left',
  mt: 'margin-top',
  mr: 'margin-right',
  mb: 'margin-bottom',
  outl: 'outline',
  opa: 'opacity',
  ovf: 'overflow',
  'ovf-x': 'overflow-x',
  'ovf-y': 'overflow-y',
  ptr: 'pointer-events',
  p: 'padding',
  pl: 'padding-left',
  pt: 'padding-top',
  pr: 'padding-right',
  pb: 'padding-bottom',
  pos: 'position',
  l: 'left',
  t: 'top',
  r: 'right',
  b: 'bottom',
  'tx-ali': 'text-align',
  'tx-decor': 'text-decoration',
  'tx-ind': 'text-indent',
  'tx-jtf': 'text-justify',
  'tx-ovf': 'text-overflow',
  'tx-sd': 'text-shadow',
  'tx-tf': 'text-transform',
  'tx-wrap': 'text-wrap',
  'tx-unde-pos': 'text-underline-position',
  'tx-break': 'word-break',
  'tx-ws': 'white-space',
  tsn: 'transition',
  tf: 'transform',
  sel: 'user-select',
  z: 'z-index',
} as const;

/**********************************************
 * 2) Breakpoints dictionary
 **********************************************/
export const breakpoints = {
  dict: {} as Record<string, string>,
};

/**********************************************
 * 3) ConstructedStylesheet + fallback
 **********************************************/
export const constructedSheet = new CSSStyleSheet();

let fallbackStyleElement: HTMLStyleElement | null = null;

if ('adoptedStyleSheets' in Document.prototype) {
  // ถ้ารองรับ adoptedStyleSheets
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, constructedSheet];
} else {
  // fallback
  const styleEl = document.createElement('style');
  styleEl.id = 'styledwind-construct-fallback';
  document.head.appendChild(styleEl);
  fallbackStyleElement = styleEl;
}

export { fallbackStyleElement };

/**********************************************
 * 4) แผนที่เก็บข้อมูล rule ที่ insert แล้ว
 **********************************************/
export interface IInsertedRules {
  displayName: string;
  // ใส่ข้อมูลเพิ่มเติมได้ เช่น index, props, etc.
}

export const insertedRulesMap = new Map<string, IInsertedRules>();
