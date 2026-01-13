# my-react

A minimal React-like library built from scratch with **zero runtime
dependencies**, created for educational purposes.  
This project re-implements the core concepts behind React, including:

- Virtual element creation (`createElement`)
- Fiber architecture
- Reconciliation (diffing old vs. new)
- Commit phase (applying DOM or canvas updates)
- Function components
- Hooks (`useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`)

The goal is to deeply understand how React works internally by
rebuilding its essential mechanics step by step and applying them to
different render targets (DOM and Canvas).

---

## Overview

**my-react** is not intended to be a production-ready library.  
Instead, it is a learning project showing how React itself organizes
rendering:

1. You write components as functions.  
2. Components return a tree of virtual elements.  
3. The core library converts these elements into *fibers*.  
4. Renderers (DOM or Canvas) walk the fiber tree and decide how to
   apply updates.  
5. Only the differences are applied to the real output (DOM nodes or
   canvas drawing commands).  
6. Hooks store and persist component state between renders.

---

## High-Level Architecture

There are **three conceptual trees** involved:

1. Virtual Element Tree (declarative UI description)  
2. Fiber Tree (mutable execution structure)  
3. Render Target Tree (DOM or logical canvas scene)

The **core** of `my-react` knows nothing about the browser DOM or
canvas APIs. It manages only elements, fibers, and hooks.  
Different renderers (DOM / Canvas) plug into the commit phase.

---

### 1. Virtual Element Tree (Declarative Plan)

Created by `createElement` or JSX-like syntax.  
It is a simple object representation describing:

- The element type (`div`, `p`, `App`, `rect`, `circle`, etc.)
- The props (attributes / drawing properties)
- The children

This tree does NOT store state.  
It is just a **blueprint**, like drawing the UI on paper.

---

### 2. Fiber Tree (Mutable Execution Structure)

Fibers are the **internal instances of components**.

Each fiber stores:

```js
{
  type,
  props,
  dom,        // for DOM renderer: HTMLElement or Text
  parent,
  child,
  sibling,
  alternate,  // previous fiber
  hooks,      // hook state for this component
  effectTag   // PLACEMENT | UPDATE | DELETION
}
```

Fibers allow the system to:

- Track previous state (`alternate`)
- Store hook values
- Update the render target minimally (DOM or canvas scene)
- Represent relationships (parent / child / sibling)
- Mark what needs to change (`PLACEMENT`, `UPDATE`, `DELETION`)

---

### 3. Render Target Tree

This is the concrete output:

- In the **DOM renderer**, the render target is the browser **DOM Tree**.  
- In the **Canvas renderer**, the render target is a logical **Scene
  Graph** of shapes that is flushed into a `<canvas>` using the 2D
  drawing context.

Fibers instruct the renderer **what** to update in the target.

---

## Render Phase (Core)

The render phase is implemented in the **core** and is agnostic to DOM
or Canvas.

Triggered when you call:

```js
render(h(App, null), rootElementOrCanvas)
```

> Here `h` is an alias for `createElement`.

Steps:

1. Create a root fiber for the given container.
2. Set `nextUnitOfWork` to the root.
3. Walk the fiber tree in depth-first order.
4. For each fiber:
   - If function component → call it and process hooks.
   - If host component → prepare it for the renderer (DOM node or shape).
5. Reconcile children and build child fibers.
6. Once no work is left, hand off to the **commit phase**.

This phase **does not touch DOM or canvas directly**.  
It only prepares fibers and effect tags.

---

## Commit Phase (Renderer-Specific)

Once all fibers are processed, the **renderer** takes over.

### In the DOM renderer

The commit phase:

1. Applies effects for each fiber:
   - `PLACEMENT` → append new DOM node
   - `UPDATE` → patch DOM props and event listeners
   - `DELETION` → remove DOM node
2. Executes pending effects from `useEffect`
3. Stores `currentRoot` so the next render can use `alternate`

At this point, the DOM reflects the virtual tree.

### In the Canvas renderer

The commit phase:

1. Clears the canvas (`ctx.clearRect(...)`).
2. Walks the fiber tree and builds a list of drawable nodes
   (`rect`, `circle`, etc.).
3. For each drawable node:
   - Reads drawing props (`x`, `y`, `width`, `height`, `radius`,
     `fill`, etc.).
   - Issues the appropriate 2D context calls:
     - `ctx.fillRect(...)` for rectangles
     - `ctx.arc(...)` / `ctx.fill()` for circles
4. Optionally (future extensions), it could:
   - Support `stroke`, `strokeWidth`, `opacity`
   - Apply transforms (translate / rotate / scale)
   - Batch drawing operations
   - Support layers or z-index-like ordering

Effects (`useEffect`) still run **after** the canvas is committed, just
like in the DOM renderer.

---

## Hooks

### How Hooks Work Internally

Hooks rely on two globals:

```js
let wipFiber = null
let hookIndex = 0
```

When a component is rendered:

1. `wipFiber` is set to the current fiber.  
2. `hookIndex = 0`.  
3. Each hook reads/writes from `fiber.hooks[hookIndex]`.  
4. `hookIndex++` after each call.

This ensures hooks run in a consistent order and are tied to a specific
fiber, independent of the render target (DOM or Canvas).

---

### useState

Stores a state value and a queue:

```js
{
  state,
  queue: []
}
```

On re-render:

- Pending actions in the queue are applied.
- The same hook object is reused.
- `setState` triggers `_rerenderRoot()`.

Works identically for DOM and Canvas renderers.

---

### useEffect

Stores:

```js
{
  effect,
  deps,
  cleanup
}
```

Executed **after** the commit phase in `flushEffects()`.

Effects are agnostic to the renderer: they only know about your
component and state, not about DOM vs canvas.

---

### useRef

Returns a persistent object:

```js
{ current: value }
```

You can use `useRef`:

- To track mutable values across renders.
- To store references to DOM nodes (in the DOM renderer).
- To store references to canvas-related data (in the Canvas renderer).

---

### useMemo / useCallback

Memoize based on dependency array.  
`useCallback(fn, deps)` is implemented as:

```js
useMemo(() => fn, deps)
```

These hooks are also renderer-agnostic and live in the core.

---

## How State Updates Trigger Re-Renders

`setState` pushes an action into `hook.queue` and calls:

```js
_rerenderRoot()
```

This:

1. Creates a new `wipRoot`.  
2. Sets its `alternate` to the current fiber tree.  
3. Re-runs the entire render phase.  
4. Hooks reuse old state via `alternate.hooks`.  
5. The appropriate renderer (DOM or Canvas) commits the changes.

This mimics React's diffing behavior, but lets you choose different
render targets.

---

## Child Reconciliation

For each child:

- If old fiber and new child have same `type` → **UPDATE**  
- If new child exists but old does not → **PLACEMENT**  
- If old exists but new does not → **DELETION**

The result is the new fiber tree with appropriate effect tags.

This logic is shared between DOM and Canvas.  
What changes is **how** each effect tag is applied in the commit phase.

---

## DOM Renderer vs Canvas Renderer

### DOM Renderer (my-react-dom)

- Host types: `"div"`, `"button"`, `"input"`, `"span"`, etc.  
- Props mapped to DOM:
  - Attributes (`className`, `id`, etc.)
  - Styles (`style` object)
  - Events (`onClick`, `onInput`, etc.)
- Commit phase:
  - Creates/updates/removes DOM nodes
  - Attaches/removes event listeners

### Canvas Renderer (my-react-canvas)

- Host types: `"rect"`, `"circle"`, (and potentially `"line"`,
  `"text"`, `"image"`, `"group"`, etc.).  
- Props mapped to drawing properties:
  - Position (`x`, `y`)
  - Size (`width`, `height`, `radius`)
  - Fill color (`fill`)
  - Future: `stroke`, `strokeWidth`, `opacity`, transforms
- Commit phase:
  - Clears canvas
  - Walks the fiber tree to collect drawable shapes
  - Issues 2D context calls to draw the scene

In both cases:

- Components, fibers, hooks, and reconciliation are the same.
- Only the **final rendering backend** changes.

This separation is the key design insight:  
> The core of my-react is renderer-agnostic.  
> Different renderers adapt fibers to different environments.

---

## Possible Extensions for the Canvas Renderer

Some ideas that can be added on top of the current design:

1. **Stroke support**  
   - Props: `stroke`, `strokeWidth`  
   - Use `ctx.strokeStyle` / `ctx.lineWidth` / `ctx.stroke()`.

2. **Opacity / alpha**  
   - Prop: `opacity`  
   - Use `ctx.globalAlpha` or RGBA colors.

3. **Transforms**  
   - Props: `translateX`, `translateY`, `rotation`, `scaleX`, `scaleY`.  
   - Use `ctx.save()` / `ctx.translate()` / `ctx.rotate()` /
     `ctx.scale()` / `ctx.restore()`.

4. **Grouping / nesting**  
   - Special type `"group"` whose children inherit transforms and
     styles.

5. **Hit testing / pointer events**  
   - Map mouse events to scene graph nodes.  
   - Combine with `useState` and `useEffect` for interactive scenes.

6. **Layers or z-order**  
   - Sort shapes before drawing to simulate z-index.

7. **Text rendering**  
   - Type: `"text"`  
   - Props: `text`, `font`, `fill`, `x`, `y`.  
   - Use `ctx.font` and `ctx.fillText(...)`.

These features can be incrementally layered on top of the existing
fiber-based architecture without changing the core.

---

## Example DOM Application

```js
import {
  createElement,
  render,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "./my-react-dom.js"

function App() {
  const [count, setCount] = useState(0)
  const [text, setText] = useState("")
  const renderCount = useRef(0)

  renderCount.current++

  const increment = useCallback(() => {
    setCount(c => c + 1)
  }, [])

  useEffect(() => {
    console.log("Count changed:", count)
  }, [count])

  const computed = useMemo(() => {
    let acc = 0
    for (let i = 0; i < 500000; i++) acc += (count * i) % 7
    return acc
  }, [count])

  return createElement(
    "div",
    { style: { fontFamily: "sans-serif", padding: "16px" } },
    createElement("h1", null, "my-react DOM hooks demo"),
    createElement(
      "button",
      { onClick: increment },
      "Count: ",
      String(count)
    ),
    createElement("input", {
      value: text,
      oninput: e => setText(e.target.value),
      placeholder: "Type something"
    }),
    createElement(
      "p",
      null,
      "Render count: ",
      String(renderCount.current)
    ),
    createElement(
      "p",
      null,
      "Computed value: ",
      String(computed)
    )
  )
}
```

---

## Example Canvas Application

```js
import {
  createElement,
  render,
  useState,
  useEffect,
} from "./my-react-canvas.js"

function App() {
  const [xSquare, setXSquare] = useState(10)
  const [xCircle, setXCircle] = useState(30)

  useEffect(() => {
    const id = setInterval(() => {
      setXSquare(prev => (prev + 5) % 400)
      setXCircle(prev => (prev + 5) % 400)
    }, 100)
    return () => clearInterval(id)
  }, [])

  return createElement(
    "scene",
    null,
    createElement("rect", {
      x: xSquare,
      y: 50,
      width: 50,
      height: 50,
      fill: "red",
    }),
    createElement("circle", {
      x: xCircle,
      y: 150,
      radius: 25,
      fill: "blue",
    })
  )
}

const canvas = document.getElementById("scene")
render(createElement(App, null), canvas)
```

In this example, the **same core** (fibers, reconciliation, hooks) is
used, but the **Canvas renderer** interprets `"rect"` and `"circle"`
types as drawing commands instead of DOM nodes.

---

## Current Limitations

- No support for keys in lists  
- No Context API  
- No fragments  
- No portals  
- No concurrent scheduling  
- DOM updates are simplified  
- Canvas renderer is minimal and focuses on basic shapes

---

## Purpose

The purpose of **my-react** is educational:

- Understand how React organizes rendering.  
- Learn why fibers exist and how they store state.  
- See how virtual elements become real DOM or canvas drawings.  
- Understand hook ordering rules.  
- See how the same core can power different renderers (DOM vs Canvas).  

This project serves as a deep, hands-on learning tool for mastering
modern React internals and building custom renderers.