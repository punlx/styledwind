const esbuild = require('esbuild');

esbuild
  .build({
    entryPoints: ['src/index.ts'], // ไฟล์หลัก
    outfile: 'dist/index.js', // ไฟล์ output
    bundle: true, // รวมไฟล์ทั้งหมดเป็นไฟล์เดียว
    minify: true, // บีบอัดไฟล์ให้เล็กที่สุด
    sourcemap: false, // ไม่ต้องสร้าง sourcemap
    format: 'esm', // ใช้ ES Module
    target: ['es6'], // รองรับ ES6 ขึ้นไป
  })
  .catch(() => process.exit(1));
