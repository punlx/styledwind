// src/server/serverStyleSheet.ts
import { IStyleDefinition } from '../../src/shared/parseStyles';
import { buildCssText } from '../shared/buildCssText';

export class ServerStyleSheet {
  private styleDefMap = new Map<string, IStyleDefinition>();

  public insertCSSRules(displayName: string, styleDef: IStyleDefinition) {
    // Note: ถ้าอยาก transformVariables บน server ให้ copy logic จาก client
    // หรือไม่ transform -> แล้วให้ client transform ภายหลัง
    this.styleDefMap.set(displayName, styleDef);
  }

  public getStyleTags(): string {
    let css = '';
    for (const [displayName, styleDef] of this.styleDefMap.entries()) {
      css += buildCssText(displayName, styleDef);
    }
    return `<style data-styledwind="ssr">${css}</style>`;
  }

  public collectStyles(app: any) {
    // ทำเหมือน styled-components: user จะเรียก sheet.collectStyles(<App/>)
    return app;
  }

  public seal() {
    this.styleDefMap.clear();
  }
}
