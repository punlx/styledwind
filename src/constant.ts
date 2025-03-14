// constant.ts

/**********************************************
 * 1) คำย่อ -> ชื่อ CSS property
 **********************************************/
export const abbrMap = {
  /********************************************
   * Alignment, Box, and Display
   ********************************************/
  ac: 'align-content',
  ai: 'align-items',
  as: 'align-self',
  d: 'display',
  '-webkit-d': '-webkit-display', // (ไม่ค่อยพบว่าได้ใช้ แต่ใส่เผื่อ)

  /********************************************
   * Animation
   ********************************************/
  ani: 'animation',
  '-webkit-ani': '-webkit-animation',
  '-moz-ani': '-moz-animation',
  '-ms-ani': '-ms-animation',
  'ani-delay': 'animation-delay',
  'ani-dir': 'animation-direction',
  'ani-dur': 'animation-duration',
  'ani-fill': 'animation-fill-mode',
  'ani-count': 'animation-iteration-count',
  'ani-name': 'animation-name',
  'ani-play': 'animation-play-state',
  'ani-timefun': 'animation-timing-function',

  /********************************************
   * Background
   ********************************************/
  bg: 'background-color',
  'bg-pos': 'background-position',
  'bg-size': 'background-size',
  'bg-repeat': 'background-repeat',
  'bg-clip': 'background-clip',
  'bg-origin': 'background-origin',
  'bg-blend': 'background-blend-mode',

  /********************************************
   * Border / Outline
   ********************************************/
  bd: 'border',
  bdl: 'border-left',
  bdt: 'border-top',
  bdr: 'border-right',
  bdb: 'border-bottom',
  'bd-spacing': 'border-spacing',
  'bd-collapse': 'border-collapse',
  'bd-img': 'border-image',
  rd: 'border-radius',
  '-webkit-rd': '-webkit-border-radius',
  '-moz-rd': '-moz-border-radius',
  outl: 'outline',
  'outl-width': 'outline-width',
  'outl-color': 'outline-color',
  'outl-style': 'outline-style',
  'outl-offset': 'outline-offset',

  /********************************************
   * Box Shadow / Sizing
   ********************************************/
  sd: 'box-shadow',
  '-webkit-sd': '-webkit-box-shadow',
  '-moz-sd': '-moz-box-shadow',
  siz: 'box-sizing',
  'siz-webkit': '-webkit-box-sizing',
  'siz-moz': '-moz-box-sizing',

  /********************************************
   * Color, Cursor
   ********************************************/
  c: 'color',
  curs: 'cursor',

  /********************************************
   * Container Query
   ********************************************/
  'ct-type': 'container-type',
  ct: 'container',
  'ct-name': 'container-name',

  /********************************************
   * Columns / Gap
   ********************************************/
  cols: 'columns',
  'col-gap': 'column-gap',
  'row-gap': 'row-gap',
  gap: 'gap',

  /********************************************
   * Flex / Grid
   ********************************************/
  fx: 'flex',
  '-webkit-fx': '-webkit-flex',
  '-moz-fx': '-moz-flex',
  'fx-basis': 'flex-basis',
  basis: 'flex-basis', // (สำรอง ถ้าอยากใช้ basis[...] ตรง ๆ)
  wrap: 'flex-wrap',
  direc: 'flex-direction',
  flow: 'flex-flow',
  grow: 'flex-grow',
  shrink: 'flex-shrink',

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

  /********************************************
   * Justify / Align / Place
   ********************************************/
  jc: 'justify-content',
  ji: 'justify-items',
  js: 'justify-self',
  pc: 'place-content',
  pi: 'place-items',
  ps: 'place-self',

  /********************************************
   * Font / Text
   ********************************************/
  fm: 'font-family',
  fs: 'font-size',
  fw: 'font-weight',
  fst: 'font-style',
  fv: 'font-variant',
  ffs: 'font-feature-settings',
  lh: 'line-height',
  'let-sp': 'letter-spacing',
  'word-sp': 'word-spacing',

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

  'tx-adj': 'text-size-adjust',
  'tx-adj-webkit': '-webkit-text-size-adjust',
  'tx-adj-moz': '-moz-text-size-adjust',
  'tx-adj-ms': '-ms-text-size-adjust',

  'tx-decor-line': 'text-decoration-line',
  'tx-decor-color': 'text-decoration-color',
  'tx-decor-style': 'text-decoration-style',
  'tx-decor-skip': 'text-decoration-skip-ink',

  /********************************************
   * Filter / Blend / Backdrop
   ********************************************/
  fil: 'filter',
  '-webkit-fil': '-webkit-filter',
  bf: 'backdrop-filter',
  '-webkit-bf': '-webkit-backdrop-filter',
  mbm: 'mix-blend-mode',
  '-webkit-bg-blend': '-webkit-background-blend-mode', // อาจไม่ได้ใช้จริง

  /********************************************
   * Dimensions / Spacing
   ********************************************/
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

  p: 'padding',
  pl: 'padding-left',
  pt: 'padding-top',
  pr: 'padding-right',
  pb: 'padding-bottom',

  /********************************************
   * Position
   ********************************************/
  pos: 'position',
  l: 'left',
  t: 'top',
  r: 'right',
  b: 'bottom',
  z: 'z-index',

  /********************************************
   * Object
   ********************************************/
  'obj-fit': 'object-fit',
  'obj-pos': 'object-position',

  /********************************************
   * Aspect Ratio
   ********************************************/
  ar: 'aspect-ratio',

  /********************************************
   * Overflow / Scroll Behavior
   ********************************************/
  ovf: 'overflow',
  'ovf-x': 'overflow-x',
  'ovf-y': 'overflow-y',
  'scr-beh': 'scroll-behavior',
  'ovscr-beh': 'overscroll-behavior',
  'ovscr-beh-x': 'overscroll-behavior-x',
  'ovscr-beh-y': 'overscroll-behavior-y',
  rs: 'resize',

  /********************************************
   * Opacity, Pointer Events, Cursor
   ********************************************/
  ptr: 'pointer-events',

  /********************************************
   * Transform / Transition / Will-change
   ********************************************/
  tf: 'transform',
  '-webkit-tf': '-webkit-transform',
  '-moz-tf': '-moz-transform',
  '-ms-tf': '-ms-transform',
  'tf-origin': 'transform-origin',
  'tf-box': 'transform-box',
  'tf-style': 'transform-style',
  per: 'perspective',
  'per-origin': 'perspective-origin',
  'backface-vis': 'backface-visibility',

  tsn: 'transition',
  '-webkit-tsn': '-webkit-transition',
  '-moz-tsn': '-moz-transition',
  '-ms-tsn': '-ms-transition',
  'tsn-delay': 'transition-delay',
  'tsn-dur': 'transition-duration',
  'tsn-prop': 'transition-property',
  'tsn-fn': 'transition-timing-function',
  wc: 'will-change',

  /********************************************
   * Mask / Clip
   ********************************************/
  mask: 'mask',
  'mask-img': 'mask-image',
  '-webkit-mask': '-webkit-mask',
  '-webkit-mask-img': '-webkit-mask-image',
  'clip-path': 'clip-path',
  '-webkit-clip-path': '-webkit-clip-path',

  /********************************************
   * Appearance / User-select
   ********************************************/
  app: 'appearance',
  '-webkit-app': '-webkit-appearance',
  '-moz-app': '-moz-appearance',

  sel: 'user-select',
  '-webkit-sel': '-webkit-user-select',
  '-moz-sel': '-moz-user-select',
  '-ms-sel': '-ms-user-select',

  /********************************************
   * Misc
   ********************************************/
  iso: 'isolation',
  content: 'content',
} as const;

/**********************************************
 * 2) Breakpoints dictionary
 **********************************************/
export const breakpoints = {
  dict: {} as Record<string, string>,
};

export const fontDict = {
  dict: {} as Record<string, string>,
};

/**********************************************
 * 3) ConstructedStylesheet + fallback
 **********************************************/
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

/**********************************************
 * 4) IInsertedRules + insertedRulesMap
 **********************************************/
export interface IInsertedRules {
  displayName: string;
}

export const insertedRulesMap = new Map<string, IInsertedRules>();
