**release 1**: general use (abbr style in .css.ts, extension ex. generator and intellisense)

---

**release 2**: new features @scope, @mix, @bind

```tsx
export const appCss = styled<{ box: [] }>`
	@scope app // done

	.box {
		@use boxd // <--todo
		bg[#f00]
		c[#fff]
		hover(bg[#0f0] c[#000])
	}
	
	
	@bind boxAll .box // <-- in progress
	@mix boxd .box5 .box6 // <- todo
`;
```

---
