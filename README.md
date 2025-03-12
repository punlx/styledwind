# Styledwind

**Styledwind** is a `CSS-in-JS` library that combines ideas from **Tailwind**-like shorthands and dynamic style injection (similar to **styled-components**). It provides features such as theme/palette management, breakpoints, container queries, pseudo-classes, pseudo-elements, and runtime style updates via an intuitive API.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Detailed Usage](#detailed-usage)
  - [1. Basic Shorthand & Class Injection](#1-basic-shorthand--class-injection)
  - [2. Dynamic Style Update](#2-dynamic-style-update)
  - [3. Theme & Palette](#3-theme--palette)
  - [4. Responsive](#4-Responsive)
  - [5. Pseudo-Classes & Pseudo-Elements](#5-pseudo-classes--pseudo-elements)
- [VSCode Extension: Styledwind Generator](#vscode-extension-styledwind-generator)
- [Known Issues & Limitations](#known-issues--limitations)
- [Contribution](#contribution)
- [License](#license)

---

## Features

- **Tailwind-like Shorthand**: Use abbreviations such as `bg[red]`, `c[white]`, `p[10px]`, and more.
- **Dynamic Style Injection**: Update specific style properties at runtime via `.get("className").set(...)`.
- **Theme & Palette**: Manage color sets via CSS variables; easily switch between modes.
- **Breakpoints (screen)**: Write media queries using an intuitive `screen(...)` DSL.
- **Container Queries (container)**: Use `container(...)` to create `@container` rules.
- **Pseudo-classes**: `hover(...)`, `focus(...)`, etc.
- **Pseudo-elements**: `before(...)`, `after(...)` with `content[...]`.
- **TypeScript Friendly**: Supports generating types to reduce mistakes with the help of an optional VSCode Extension.
- **Lightweight Library**: It is very lightweight, the library file is only 8kB in size.

---

## Installation

```sh
npm install styledwindjs
# or
yarn add styledwindjs
```

---

## Quick Start

1. **Create a `.css.ts` file** (for example, `App.css.ts`):

   ```tsx
   // App.css.ts
   import { styled } from 'styledwindjs';

   export const appCss = styled`
      .box {
        bg[red]
        c[white]
        hover(bg[pink] c[blue])
      }
   `;
   ```

2. **Use the className** in your component (React example shown, but works similarly in other frameworks):

   ```tsx
   // App.tsx
   import React from 'react';
   import { appCss } from './App.css.ts';

   function App() {
     return <div className={appCss.box}>Hello Styledwind!</div>;
   }

   export default App;
   ```

3. You will see an injected class like **`.box_abc123`** in the DOM with the proper styles:

   ```css
   .box_abc123 {
     background: red;
     color: white;
   }
   .box_abc123:hover {
     background: pink;
     color: blue;
   }
   ```

if you want to use a **CSS Variable**, you can do this.

```tsx
// App.css.ts
import { styled } from 'styledwindjs';

export const appCss = styled`
    .box {
      bg[--primary-500]
      c[--white-200]
    }
 `;
```

**CSS in the DOM** will look like this.

```css
.box_abc123 {
  background: var(--primary-500);
  color: var(--white-200);
}
```

---

## Detailed Usage

### 1. Basic Shorthand & Class Injection

```tsx
export const myCss = styled`
  .header {
    d[flex]
    jc[center]
    ai[center]
    bg[#f5f5f5]
    c[#333]
  }
  .title {
    fs[2rem]
    fw[bold]
    active(bg[red] c[white])
  }
`;
```

Use in your component:

```tsx
<div className={myCss.header}>
  <h1 className={myCss.title}>Styledwind Example</h1>
</div>
```

---

### 2. Dynamic Style Update

```tsx
import { appCss } from './App.css.ts';

function changeBackground() {
  // Suppose .box has bg[green] and c[white] initially.
  appCss.get('box').set({ bg: 'black' });
  // This updates .box_abc123 in the stylesheet to have background: black
}
```

---

### 3. Theme & Palette

**Styledwind** allows you to define multiple color modes (e.g., `dark`, `light`, `dim`) using CSS variables. This makes it easy to switch themes on the fly and keep user preferences in localStorage. Below is an example and a breakdown of how it works under the hood.

```tsx
// theme.ts
import { theme } from 'styledwindjs';

export const palette = theme.palette([
  // First row: the mode names you want to support
  ['dark', 'light', 'dim'],
  ['blue-100', '#1E88E5', '#BBDEFB', '#90CAF9'],
  ['blue-200', '#1565C0', '#42A5F5', '#64B5F6'],
]);
// Subsequent rows: [variable-name, dark-color, light-color, dim-color]
```

```tsx
// App.css.ts
import './theme.ts';
// ⚠️ import "./theme.ts" Must be on the first line of the root app.
```

In the DOM, you might see something like:

```css
.dark {
  --blue-100: #1e88e5;
  --blue-200: #1565c0;
  ...;
}
.light {
  --blue-100: #bbdefb;
  --blue-200: #42a5f5;
  ...;
}
.dim {
  --blue-100: #90caf9;
  --blue-200: #64b5f6;
  ...;
}
```

**Switching Mode**

```tsx
import { palette } from "./theme,ts

function switchTheme() {
    palette.mode('dark');
}
```

**Using Theme Variables in Your DSL**

```tsx
// App.css.ts
import { styled } from 'styledwindjs';

export const appCss = styled`
  .box {
    // Directly reference the custom property:
    bg[--blue-100]
    c[white]
  }
`;
```

When the current mode is **dark**, `--blue-100` will resolve to `#1E88E5`. In light mode, it will resolve to `#BBDEFB`. Hence your `.box` automatically adjusts color based on the active `theme`.

---

### 4. Responsive

Styledwind offers two primary ways to handle responsive design in a single DSL:

1. **Media Queries** via `screen(...)`
2. **Container Queries** via `container(...)`

Both can leverage **breakpoints** set up in `theme.screen({ ... })` for more concise syntax. Below are examples showing how the final DOM elements and injected CSS look.

---

#### 4.1 Media Query (screen)

```tsx
// App.css.ts
import { styled } from 'styledwindjs';

export const appCss = styled`
      .container {
        w[600px]
        bg[#f0f0f0]
        screen(max-w[600px], bg[red])
      }
`;
```

Final DOM

```html
<div class="container_abc123">Content</div>
```

```css
.container_abc123 {
  width: 600px;
  background: #f0f0f0;
}
@media only screen and (max-width: 600px) {
  .container_abc123 {
    background: red;
  }
}
```

**Using a breakpoint**

```tsx
// theme.ts
import { theme } from 'styledwindjs';

theme.screen({
  sm: 'max-w[600px]',
  md: 'min-w[900px]',
});
```

If you set `theme.screen({ sm: 'max-w[600px]' })` in your `theme.ts`, you can write:

```tsx
import { theme } from 'styledwindjs';

theme.screen({
  sm: 'max-w[600px]',
});
```

```tsx
// App.css.ts
import { styled } from 'styledwindjs';

export const appCss = styled`
    .container {
      screen(sm, bg[red] c[white])
    }
`;
```

and `sm` will expand to `(max-width:600px)` under the hood.

---

#### 4.2 Container Query (container)

```tsx
// App.css.ts
import { styled } from 'styledwindjs';

export const appCss = styled`
      .box {
        bg[#fafafa]
        container-type[inline-size]
        container(max-w[600px], bg[green])
      }
    `;
```

Final DOM

```html
<div class="box_xyz456">Content</div>
```

```css
.box_xyz456 {
  container-type: inline-size;
  background: #fafafa;
}
@container (max-width:600px) {
  .box_xyz456 {
    background: green;
  }
}
```

**Using a breakpoint**
If you have `sm: 'max-w[600px]'` in `theme.screen(...)`, you can do:

```tsx
    .box {
      container(sm, bg[green])
    }
```

Which expands to the same `@container (max-width:600px)` query. Whenever the container’s inline-size is at most `600px`, its background becomes green.

---

### 5. Pseudo-Classes & Pseudo-Elements

#### Pseudo-Classes (states)

```tsx
.box {
  bg[#fff]
  c[#000]
  hover(bg[#eee] c[#333])
}
```

#### Pseudo-Elements (before, after)

```tsx
export const appCss = styled`
  .message {
    c[black]
    before(content['Hello'] bg[pink] c[white])
    after(content['World'] bg[#333] c[yellow])
  }
`;
```

---

## VSCode Extension: Styledwind Generator

### For TypeScript autocompletion.

⚠️This extension only works with **.css.ts** files.

1. Install **“Styledwind Generator”** extension in VSCode.
2. Open a `.css.ts` file containing `styled`.
3. Use **"Generate Styledwind Types"** from the **Command Palette**.
4. It will update `<{ ... }>` automatically in your styled declaration.

```tsx
// From
export const appCss = styled`
  .box {
    bg[green]
    c[white]
  }
`;
```

```tsx
// to
export const appCss = styled<{ box: ['bg', 'c'] }>`
  .box {
    bg[green]
    c[white]
  }
`;
```

It will help you to know what `classes` are contained in the `variable`.

---

## Known Issues & Limitations

- **SSR**: Server-Side Rendering is not fully supported.
- **Autoprefixer**: No built-in autoprefixing.
- **Performance**: Updating a large number of CSS rules in **real-time** may affect performance.
- **Still Beta**: Should not be used in production.

---

## Contribution

```sh
npm install
# or
yarn
```

Fork the repository, create a branch, make changes, and open a pull request.

---

## License

Styledwind is licensed under the [MIT License](./LICENSE).
(C) 2025 PUNLX
