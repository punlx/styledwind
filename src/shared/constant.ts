/* ------------------------------------------
 * src/shared/constant.ts
 * - เก็บค่าหรือ dictionary ที่ใช้ร่วมกันทั้ง client/server
 * ------------------------------------------ */
export const abbrMap = {
  // Alignment, Box, Display
  ac: 'align-content',
  ai: 'align-items',
  as: 'align-self',
  d: 'display',

  // Animation
  am: 'animation',
  'am-delay': 'animation-delay',
  'am-drt': 'animation-direction',
  'am-dur': 'animation-duration',
  'am-fill': 'animation-fill-mode',
  'am-count': 'animation-iteration-count',
  'am-name': 'animation-name',
  'am-play': 'animation-play-state',
  'am-timefun': 'animation-timing-function',

  // Background
  bg: 'background-color',
  'bg-pos': 'background-position',
  'bg-size': 'background-size',
  'bg-repeat': 'background-repeat',
  'bg-clip': 'background-clip',
  'bg-origin': 'background-origin',
  'bg-blend': 'background-blend-mode',

  // Border / Outline
  bd: 'border',
  bdl: 'border-left',
  bdt: 'border-top',
  bdr: 'border-right',
  bdb: 'border-bottom',
  bdw: 'border-width',
  bdc: 'border-color',
  'bd-spacing': 'border-spacing',
  'bd-collapse': 'border-collapse',
  'bd-img': 'border-image',
  br: 'border-radius',
  ol: 'outline',
  'ol-width': 'outline-width',
  'ol-color': 'outline-color',
  'ol-style': 'outline-style',
  'ol-offset': 'outline-offset',

  // Box Shadow / Sizing
  sd: 'box-shadow',
  sz: 'box-sizing',

  // Color, Cursor
  c: 'color',
  cs: 'cursor',

  // Container Query
  'cn-type': 'container-type',
  cn: 'container',
  'cn-name': 'container-name',

  // Columns / Gap
  cols: 'columns',
  'col-gap': 'column-gap',
  'row-gap': 'row-gap',
  gap: 'gap',

  // Flex / Grid
  fx: 'flex',
  'fx-basis': 'flex-basis',
  basis: 'flex-basis',
  wrap: 'flex-wrap',
  drt: 'flex-direction',
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

  // Justify / Align / Place
  jc: 'justify-content',
  ji: 'justify-items',
  js: 'justify-self',
  pc: 'place-content',
  pi: 'place-items',
  ps: 'place-self',

  // Font / Text
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
  'tx-decor-line': 'text-decoration-line',
  'tx-decor-color': 'text-decoration-color',
  'tx-decor-style': 'text-decoration-style',
  'tx-decor-skip': 'text-decoration-skip-ink',

  // Filter / Blend / Backdrop
  fil: 'filter',
  bf: 'backdrop-filter',
  '-webkit-bf': '-webkit-backdrop-filter',
  mbm: 'mix-blend-mode',

  // Dimensions / Spacing
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

  // Position
  pos: 'position',
  l: 'left',
  t: 'top',
  r: 'right',
  b: 'bottom',
  z: 'z-index',

  // Object
  'obj-fit': 'object-fit',
  'obj-pos': 'object-position',

  // Aspect Ratio
  ar: 'aspect-ratio',

  // Overflow / Scroll Behavior
  ovf: 'overflow',
  'ovf-x': 'overflow-x',
  'ovf-y': 'overflow-y',
  'scr-beh': 'scroll-behavior',
  'ovscr-beh': 'overscroll-behavior',
  'ovscr-beh-x': 'overscroll-behavior-x',
  'ovscr-beh-y': 'overscroll-behavior-y',
  rs: 'resize',

  // Opacity, Pointer Events, Cursor
  pe: 'pointer-events',

  // Transform / Transition / Will-change
  tf: 'transform',
  'tf-origin': 'transform-origin',
  'tf-box': 'transform-box',
  'tf-style': 'transform-style',
  per: 'perspective',
  'per-origin': 'perspective-origin',
  'backface-vis': 'backface-visibility',

  tsn: 'transition',
  'tsn-delay': 'transition-delay',
  'tsn-dur': 'transition-duration',
  'tsn-prop': 'transition-property',
  'tsn-fn': 'transition-timing-function',
  wc: 'will-change',

  // Mask / Clip
  mask: 'mask',
  'mask-img': 'mask-image',
  '-webkit-mask': '-webkit-mask',
  '-webkit-mask-img': '-webkit-mask-image',
  'clip-path': 'clip-path',
  '-webkit-clip-path': '-webkit-clip-path',

  // Appearance / User-select
  app: 'appearance',
  '-webkit-app': '-webkit-appearance',

  us: 'user-select',
  '-webkit-sel': '-webkit-user-select',

  // Misc
  iso: 'isolation',
  ct: 'content',
} as const;
