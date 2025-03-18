// /src/server/ServerStyleSheetInstance.ts

import { _sheet } from './constant';
import { ServerStyleSheet } from './serverStyleSheet';

// เก็บ instance ของ ServerStyleSheet ไว้ในตัวแปรส่วนกลาง

/**
 * ดึง instance ปัจจุบันของ ServerStyleSheet
 * ถ้ายังไม่มี ก็สร้างใหม่
 */
export function serverStyleSheet(): ServerStyleSheet {
  if (!_sheet.serverStyleSheet) {
    _sheet.serverStyleSheet = new ServerStyleSheet();
  }
  return _sheet.serverStyleSheet;
}

/**
 * เมื่อต้องการจบการใช้งานในแต่ละ request สามารถ call เพื่อ clear
 * หรือสร้าง instance ใหม่ในรอบต่อไป
 */
export function clearServerSheetInstance() {
  if (_sheet.serverStyleSheet) {
    _sheet.serverStyleSheet.seal(); // ล้าง styleDefMap
  }
  _sheet.serverStyleSheet = null;
}
