import { AbbrKey, StyledResult, separateClass, mapStyle, InferAbbr, setStyle } from './helpers';
// สุดท้าย ฟังก์ชัน styled (Generic)
export function styled<
  T extends Record<string, AbbrKey | AbbrKey[] | ReadonlyArray<AbbrKey>> = Record<string, never>
>(styleText: TemplateStringsArray): StyledResult<T> {
  // parse
  const classes = separateClass(styleText);
  // map => hashedName
  const styleSheetObj = mapStyle(classes);

  // ผูกเมธอด get(...)
  (styleSheetObj as StyledResult<T>)['get'] = <K extends keyof T>(className: K) => ({
    set: (props: Partial<Record<InferAbbr<T[K]>, string>>) => {
      // จาก "box" -> "box_abc123"
      const hashedName = styleSheetObj[className as string];
      setStyle(hashedName, props as Record<string, string>);
    },
  });

  return styleSheetObj as StyledResult<T>;
}
