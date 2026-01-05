# my-react

A minimal React-like library built from scratch with **zero runtime
dependencies**, created for educational purposes.\
This project re-implements the core concepts behind React, including:

- Virtual element creation (`createElement`)
- Fiber architecture
- Reconciliation (diffing old vs. new)
- Commit phase (applying DOM updates)
- Function components
- Hooks (`useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`)

The goal is to deeply understand how React works internally by
rebuilding its essential mechanics step by step.

------------------------------------------------------------------------

## Overview

**my-react** is not intended to be a production-ready library.\
Instead, it is a learning project showing how React itself organizes
rendering:

1. You write components as functions.\
2. Components return a tree of virtual elements.\
3. The library converts these elements into *fibers*.\
4. Fibers are compared with their previous version.\
5. Only the differences are applied to the real DOM.\
6. Hooks store and persist component state between renders.

------------------------------------------------------------------------

## High-Level Architecture

There are **three trees** involved:

------------------------------------------------------------------------

### 1. Virtual Element Tree (Declarative Plan)

Created by `createElement` or JSX-like syntax.\
It is a simple object representation describing:

- The element type (`div`, `p`, `App`, etc.)
- The props (attributes)
- The children

This tree does NOT store state.\
It is just a **blueprint**, like drawing the UI on paper.

------------------------------------------------------------------------

### 2. Fiber Tree (Mutable Execution Structure)

Fibers are the **internal instances of components**.

Each fiber stores:

``` js
{
  type,
  props,
  dom,
  parent,
  child,
  sibling,
  alternate,
  hooks,
  effectTag
}
```

Fibers allow the system to:

- Track previous state (`alternate`)
- Store hook values
- Update DOM minimally
- Represent relationships (parent/child/sibling)
- Mark what needs to change (`PLACEMENT`, `UPDATE`, `DELETION`)

------------------------------------------------------------------------

### 3. DOM Tree (Actual Browser Output)

Represents the final rendered output in the browser.\
Fibers instruct the system **what** to update in the DOM.

------------------------------------------------------------------------

## Render Phase

Triggered when you call:

``` js
render(h(App, null), rootElement)
```

Steps:

1. Create a root fiber.
2. Set `nextUnitOfWork` to the root.
3. Walk the tree in depth-first order.
4. For each fiber:
    - If function component → call it and process hooks.
    - If host component → create DOM if needed.
5. Reconcile children and build child fibers.

This phase **does not touch the DOM yet**.

------------------------------------------------------------------------

## Commit Phase

Once all fibers are processed:

1. Apply effects:
    - `PLACEMENT` → append new DOM node
    - `UPDATE` → patch DOM node
    - `DELETION` → remove DOM node
2. Execute pending effects from `useEffect`
3. Store `currentRoot`

At this point, the DOM reflects the virtual tree.

------------------------------------------------------------------------

## Hooks

### How Hooks Work Internally

Hooks rely on two globals:

``` js
let wipFiber = null
let hookIndex = 0
```

When a component is rendered:

1. `wipFiber` is set to the current fiber.
2. `hookIndex = 0`.
3. Each hook pushes/reads from `fiber.hooks[hookIndex]`.
4. `hookIndex++` after each call.

This ensures hooks run in consistent order.

------------------------------------------------------------------------

### useState

Stores a state value and a queue:

``` js
{
  state,
  queue: []
}
```

On re-render:

- Pending actions in the queue are applied.
- The same hook object is reused.
- `setState` triggers `_rerenderRoot()`.

------------------------------------------------------------------------

### useEffect

Stores:

``` js
{
  effect,
  deps,
  cleanup
}
```

Executed **after** DOM updates in `flushEffects()`.

------------------------------------------------------------------------

### useRef

Returns a persistent object:

``` js
{ current: value }
```

------------------------------------------------------------------------

### useMemo / useCallback

Memoize based on dependency array.\
`useCallback(fn, deps)` is implemented as:

``` js
useMemo(() => fn, deps)
```

------------------------------------------------------------------------

## How State Updates Trigger Re-Renders

`setState` pushes an action into `hook.queue` and calls:

``` js
_rerenderRoot()
```

This:

1. Creates a new `wipRoot`
2. Sets its `alternate` to the current fiber tree
3. Re-runs the entire render phase
4. Hooks reuse old state via `alternate.hooks`

This mimics React's diffing behavior.

------------------------------------------------------------------------

## Child Reconciliation

For each child:

- If old fiber and new child have same `type` → **UPDATE**
- If new child exists but old does not → **PLACEMENT**
- If old exists but new does not → **DELETION**

The result is the new fiber tree with appropriate effect tags.

------------------------------------------------------------------------

## Example Application

``` js
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

  return h("div", null,
    h("h1", null, "my-react hooks demo"),
    h("button", { onClick: increment }, "Count: ", count),
    h("input", { value: text, oninput: e => setText(e.target.value) }),
    h("p", null, "Render count: ", renderCount.current),
    h("p", null, "Computed value: ", computed)
  )
}
```

------------------------------------------------------------------------

## Current Limitations

- No support for keys in lists
- No Context API
- No fragments
- No portals
- No concurrent scheduling
- DOM updates are simplified

