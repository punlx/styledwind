// /src/server/serverSheet.ts

import { IStyleDefinition } from '../shared/parseStyles';
import { buildCssText } from '../shared/buildCssText';
import { clearServerSheetInstance } from './ServerStyleSheetInstance';

/**
 * คลาสเลียนแบบแนวทาง styled-components:
 * - เก็บ styleDef ผ่าน insertCSSRules (ขณะ SSR)
 * - แปลงทั้งหมดเป็น <style> ผ่าน getStyleTags()
 */
export class ServerStyleSheet {
  private styleDefMap = new Map<string, IStyleDefinition>();

  /**
   * เก็บข้อมูล style (ระหว่าง SSR) แทนการ insertRule ใน DOM
   */
  public insertCSSRules(displayName: string, styleDef: IStyleDefinition) {
    // ถ้าต้องการ transformVariables บน server ก็ใส่ได้ (หรือให้ client handle ก็ได้)
    this.styleDefMap.set(displayName, styleDef);
  }

  /**
   * สร้าง <style> รวม CSS ทั้งหมด สำหรับฝังใน HTML ตอน SSR
   */
  public getCSSText(): string {
    let css = '';
    for (const [displayName, styleDef] of this.styleDefMap.entries()) {
      css += buildCssText(displayName, styleDef);
    }
    clearServerSheetInstance();
    return css;
  }

  /**
   * ล้างค่าใน map กรณีต้องการ reuse sheet instance
   */
  public seal() {
    this.styleDefMap.clear();
  }
}
