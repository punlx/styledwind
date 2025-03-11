import { breakpoints } from './constant';
import { generateCSS, injectCSS, setTheme } from './helpers';

// `theme.palette()` ใช้ฟังก์ชันที่สร้างไว้
export const theme = {
  palette: (colors: string[][]) => {
    const modes: string[] = colors[0]; // ['dark', 'light', 'dim']

    injectCSS(generateCSS(colors)); // Inject CSS ทันที

    // ตรวจสอบค่า theme ปัจจุบันใน localStorage
    const savedTheme = localStorage.getItem('styledwind-theme');
    const defaultTheme = savedTheme && modes.indexOf(savedTheme) !== -1 ? savedTheme : 'light'; // ค่าเริ่มต้นเป็น light ถ้าไม่มีค่าใน localStorage

    // ตั้งค่า theme เริ่มต้น
    setTheme(defaultTheme, modes);

    return {
      mode: (mode: string) => {
        setTheme(mode, modes);
      },
    };
  },
  screen: (breakpointList: Record<string, string>) => {
    breakpoints.dict = breakpointList;
  },
};
