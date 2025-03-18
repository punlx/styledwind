**release 1**: general use (abbr style in .css.ts, extension ex. generator and intellisense)

---

**release 2**: new features @scope, @mix, @bind

```tsx
export const css = styled<{ base: ['$c']; box1: []; box2: []; box: [] }>`
	@scope:app // สร้าง scope ให้แต่ละ styled *เปลียนไม่ใช้ hash แล้ว เพราะติดปัญหาใน next เรื่อง mismatch
	// เมื่อแสดงผลก็จะได้ .app_base, .app_box1, .app_box2 ทำให้ debug ง่ายขึ้น

	.base {
		$c[red]
		bg[blue]
	}

	.box1 {
		@mix[.base] // 	เอา style จาก .base มา mix ใน .box1 และตัวแปร $c จะอยู่ในสโคปของ .box1 เท่านั้น
		// intellisense update: เอา @mix ขึ้นบนสุดของ .box1 { ... }
		jc[center]
	}

	.box2 {
		@mix[.base] // 	เอา style จาก .base มา mix ใน .box2 และตัวแปร $c จะอยู่ในสโคปของ .box2 เท่านั้น
		// intellisense update: เอา @mix ขึ้นบนสุดของ .box2 { ... }
		jc[center]
	}

	@bind:box[.box1 .box2] // ทำการสร้าง object {"box":".box1_hash .box2_hash"} เพื่อใช้งานได้สะดวกมากขึ้น
    // intellisense update: เอา @bind ล่างสุดของ styled
`;
```

---

**release 3**: Full support SSR (ปัจจุบันกำลังพัฒนาอยู๋ ตอนนี้ใช้ได้แล้วเป็นการทดสอบก่อน แต่ยังต้องทำเพิ่ม เช่น theme), รอ release 2 เพื่อนำ @scope มาใช้งาน ป้องกันปัญหา mismatch
