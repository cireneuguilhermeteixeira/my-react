# ARCHITECTURE.md

## Overview

This document describes the internal architecture of **my-react**, a
minimal React-like library built from scratch with zero runtime
dependencies.\
It explains how virtual elements are transformed into fibers, how
reconciliation works, how DOM updates are applied, and how hooks persist
state across renders.

The goal is to provide a clear mental model of how rendering flows
through the system, from the initial `createElement` call to the final
DOM updates.

------------------------------------------------------------------------

## Core Rendering Model

my-react is built around three major structures:

1. **Virtual Element Tree**\
2. **Fiber Tree**\
3. **DOM Tree**

------------------------------------------------------------------------

## 1. Virtual Element Tree

Created by:

``` js
createElement(type, props, ...children)
```

A virtual element is a plain JavaScript object:

``` js
{
  type: "div" or ComponentFunction or TEXT_ELEMENT,
  props: {
    ...attributes,
    children: [...]
  }
}
```

Characteristics:

- Immutable
- Describes what the UI should look like
- Contains no state
- Contains no DOM references

------------------------------------------------------------------------

## 2. Fiber Tree

Fibers are the internal, mutable structures representing component
instances.

A fiber contains:

``` js
{
  type,
  props,
  dom,
  parent,
  child,
  sibling,
  alternate,   // previous fiber
  hooks,       // useState/useEffect/useMemo/etc
  effectTag    // PLACEMENT, UPDATE, DELETION
}
```

Fibers allow the system to:

- Maintain component state between renders
- Compare old vs. new tree (diffing)
- Determine minimal DOM updates
- Organize the work of rendering into discrete units

------------------------------------------------------------------------

## Fiber Links: Parent / Child / Sibling

The fiber tree uses a non-recursive traversal pattern:

    parent
     └─ child
          └─ sibling
               └─ sibling

This allows efficient depth-first walking without recursion.

------------------------------------------------------------------------

## 3. DOM Tree

Real browser nodes created from fiber instructions.

Fibers generate:

- `document.createElement(...)`
- `document.createTextNode(...)`
- node removal
- event listeners
- property/attribute updates

The DOM is updated only during the **commit phase**.

------------------------------------------------------------------------

## Render Cycle

The render process has two phases:

------------------------------------------------------------------------

### Phase 1: Render (Reconciliation)

Executed by:

``` js
performUnitOfWork(fiber)
```

This phase:

1. Processes each fiber
2. For function components:
    - Calls the component function
    - Executes hooks
    - Generates child elements
3. For host components:
    - Creates the DOM node (if needed)
4. Compares fiber with its `alternate`
5. Assigns `effectTag` to describe changes

No DOM operations occur during this phase.

------------------------------------------------------------------------

### Phase 2: Commit

Executed by:

``` js
commitRoot()
```

This phase:

- Applies DOM updates
- Appends new nodes
- Removes deleted nodes
- Updates props and events
- Executes queued `useEffect` callbacks

This phase **cannot be interrupted** because DOM must remain consistent.

------------------------------------------------------------------------

## Hooks Architecture

Hooks rely on two global values:

``` js
let wipFiber = null
let hookIndex = 0
```

When rendering a function component:

- `wipFiber` points to the current fiber
- `hookIndex` resets to zero
- Each hook call uses and stores values in `fiber.hooks[hookIndex]`
- The order of hook calls must remain consistent

------------------------------------------------------------------------

### useState Mechanism

``` js
const hook = oldHook || { state: initial, queue: [] }
```

- Updates are queued
- On render, actions in `queue` are applied to `state`
- `setState` triggers `_rerenderRoot()`

------------------------------------------------------------------------

### useEffect Mechanism

Effects are stored during render:

``` js
{ effect, deps, cleanup }
```

After commit:

1. Cleanup is executed if deps changed
2. New effect runs
3. Return value becomes next cleanup

------------------------------------------------------------------------

### useMemo / useCallback

Memo hook stores:

``` js
{ value, deps }
```

Recomputed only when dependencies change.

------------------------------------------------------------------------

### useRef

Stores a persistent object:

``` js
{ current: value }
```

Never replaced across renders.

------------------------------------------------------------------------

## Reconciliation Algorithm

Child reconciliation compares:

- New virtual elements
- Old fibers (`alternate.child`)

Rules:

### If `type` matches → UPDATE

Reuse DOM node, update props.

### If `type` does not match but child exists → DELETION

Mark fiber for removal.

### If new child exists but no old fiber → PLACEMENT

Create new fiber and DOM node.

------------------------------------------------------------------------

## DOM Update Logic

DOM differences are applied only in commit phase:

- Remove obsolete event listeners
- Add new event listeners
- Remove outdated attributes
- Apply new/changed attributes
- Update text nodes directly

------------------------------------------------------------------------

## Limitations of the Current Architecture

- No keyed diffing for dynamic lists
- No Context API
- No Fragments
- No Portals
- No scheduler (work is fully synchronous)
- Basic DOM handling for controlled components

------------------------------------------------------------------------

## Future Enhancements

### Keyed Diffing

Implement `key` support in reconciliation.

### Context API

Add:

``` js
createContext()
useContext()
Provider
```

### Concurrent Rendering

Use `requestIdleCallback()` to chunk fiber work.

### Fragment Support

Fiber type representing multiple children without DOM wrapper.

------------------------------------------------------------------------

## Conclusion

This architecture recreates the fundamental internal concepts of React:

- Virtual elements describe intent.
- Fibers track execution and store state.
- Reconciliation produces a minimal set of changes.
- Commit phase updates the DOM efficiently.
- Hooks rely on deterministic ordering stored inside fibers.

Understanding these pieces gives insight into how React achieves both
declarative UI and efficient rendering.
