export const abbrMap = {
  ac: 'align-content',
  ai: 'align-items',
  as: 'align-self',
  animate: 'animation',
  bg: 'background-color',
  bd: 'border',
  'bd-l': 'border-left',
  'bd-t': 'border-top',
  'bd-r': 'border-right',
  'bd-b': 'border-bottom',
  round: 'border-radius',
  'bd-img': 'border-image',
  shadow: 'box-shadow',
  sizing: 'box-sizing',
  c: 'color',
  'col-gap': 'column-gap',
  cols: 'columns',
  cursor: 'cursor',
  'container-type': 'container-type',
  container: 'container',
  d: 'display',
  family: 'font-family',
  fs: 'font-size',
  fw: 'font-weight',
  fx: 'flex',
  basis: 'flex-basis',
  direction: 'flex-direction',
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
  outline: 'outline',
  opacity: 'opacity',
  overflow: 'overflow',
  'overflow-x': 'overflow-x',
  'overflow-y': 'overflow-y',
  pointer: 'pointer-events',
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
  'tx-align': 'text-align',
  'tx-decoration': 'text-decoration',
  'tx-indent': 'text-indent',
  'tx-justify': 'text-justify',
  'tx-overflow': 'text-overflow',
  'tx-shadow': 'text-shadow',
  'tx-tf': 'text-transform',
  'tx-wrap': 'text-wrap',
  'tx-underline-pos': 'text-underline-position',
  tsn: 'transition',
  tf: 'transform',
  select: 'user-select',
  z: 'z-index',
};

export const breakpoints: {
  dict: Record<string, string>;
} = {
  dict: {},
};

export const mainStyle = document.createElement('style');
mainStyle.id = 'styledwind';
document.head.appendChild(mainStyle);
interface IInsertedRules {
  baseRuleIndex: number;
  stateRuleIndex: Record<string, number>;
  screenRuleIndex: number[];
  baseProps: Set<string>;
}

export const styleSheet = mainStyle.sheet as CSSStyleSheet;
export const insertedRulesMap = new Map<string, IInsertedRules>();
