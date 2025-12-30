// src/my-react.js
// Minimal React-like library with fibers and hooks
// Zero dependencies, browser-only, ES modules.

// -------------------------------------------------
// Element creation (virtual element tree)
// -------------------------------------------------
const TEXT_ELEMENT = "TEXT_ELEMENT"

function createTextElement(text) {
  return {
    type: TEXT_ELEMENT,
    props: {
      nodeValue: String(text),
      children: [],
    },
  }
}

export function createElement(type, props, ...children) {
  // Always store children as an array of elements (including text elements)
  const flatChildren = children.flat ? children.flat() : children

  const normalizedChildren = flatChildren
    .filter((child) => child !== null && child !== undefined && child !== false)
    .map((child) =>
      typeof child === "object"
        ? child
        : createTextElement(child)
    )

  return {
    type,
    props: {
      ...(props || {}),
      children: normalizedChildren,
    },
  }
}

// -------------------------------------------------
// Fiber and render/reconcile globals
// -------------------------------------------------
let wipRoot = null          // Work-in-progress root fiber
let currentRoot = null      // Last committed root fiber
let nextUnitOfWork = null   // Pointer for the work loop
let deletions = []          // Fibers to delete during commit

// -------------------------------------------------
// Hooks globals
// -------------------------------------------------
let wipFiber = null         // Fiber currently being rendered
let hookIndex = 0           // Index of the current hook
let pendingEffects = []     // Hooks to run after commit

// -------------------------------------------------
// Public render API
// -------------------------------------------------
export function render(element, container) {
  wipRoot = {
    type: "ROOT",
    dom: container,
    parent: null,
    child: null,
    sibling: null,
    alternate: currentRoot,
    props: { children: [element] },
    hooks: [],
  }
  deletions = []
  nextUnitOfWork = wipRoot

  workLoop()
}

// Internal helper used by hooks to re-render the whole tree
export function _rerenderRoot() {
  if (!currentRoot || !currentRoot.dom) return
  wipRoot = {
    type: currentRoot.type,
    dom: currentRoot.dom,
    parent: null,
    child: null,
    sibling: null,
    alternate: currentRoot,
    props: currentRoot.props,
    hooks: [],
  }
  deletions = []
  nextUnitOfWork = wipRoot
  workLoop()
}

// -------------------------------------------------
// Work loop (no scheduler, fully synchronous)
// -------------------------------------------------
function workLoop() {
  while (nextUnitOfWork != null) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }
}

// -------------------------------------------------
// Unit of work: build fiber tree
// -------------------------------------------------
function performUnitOfWork(fiber) {
  const isFunctionComponent =
    fiber.type instanceof Function && fiber.type !== "ROOT"

  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  // Return next unit of work (DFS: child -> sibling -> parent.sibling)
  if (fiber.child) return fiber.child

  let next = fiber
  while (next) {
    if (next.sibling) return next.sibling
    next = next.parent
  }

  return null
}

// -------------------------------------------------
// Function components: set up hooks and reconcile children
// -------------------------------------------------
function updateFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []

  const children = [fiber.type(fiber.props || {})]
  reconcileChildren(fiber, children)
}

// -------------------------------------------------
// Host components (div, span, button...) and text
// -------------------------------------------------
function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  const elements = (fiber.props && fiber.props.children) || []
  reconcileChildren(fiber, elements)
}

// -------------------------------------------------
// Create DOM node from a host or text fiber
// -------------------------------------------------
function createDom(fiber) {
  if (fiber.type === "ROOT") {
    return fiber.dom
  }

  if (fiber.type === TEXT_ELEMENT) {
    return document.createTextNode(fiber.props.nodeValue || "")
  }

  const dom = document.createElement(fiber.type)
  updateDom(dom, {}, fiber.props || {})
  return dom
}

// -------------------------------------------------
// Diff props and update DOM
// -------------------------------------------------
const isEvent = (key) => key.startsWith("on")
const isProperty = (key) =>
  key !== "children" && key !== "nodeValue" && !isEvent(key)

function updateDom(dom, prevProps, nextProps) {
  // Text node: just update nodeValue
  if (dom.nodeType === Node.TEXT_NODE) {
    const prevText = prevProps.nodeValue
    const nextText = nextProps.nodeValue
    if (prevText !== nextText) {
      dom.nodeValue = nextText == null ? "" : String(nextText)
    }
    return
  }

  // Remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .forEach((key) => {
      const eventType = key.toLowerCase().substring(2)
      const prevHandler = prevProps[key]
      const nextHandler = nextProps[key]
      if (!nextHandler || prevHandler !== nextHandler) {
        dom.removeEventListener(eventType, prevHandler)
      }
    })

  // Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .forEach((key) => {
      if (!(key in nextProps)) {
        if (key === "style") {
          dom.style = ""
        } else if (key === "className") {
          dom.removeAttribute("class")
        } else {
          dom.removeAttribute(key)
        }
      }
    })

  // Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .forEach((key) => {
      const value = nextProps[key]
      if (key === "style" && typeof value === "object") {
        Object.assign(dom.style, value)
      } else if (key === "className") {
        dom.setAttribute("class", value)
      } else {
        dom.setAttribute(key, value)
      }
    })

  // Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .forEach((key) => {
      const eventType = key.toLowerCase().substring(2)
      const handler = nextProps[key]
      dom.addEventListener(eventType, handler)
    })
}

// -------------------------------------------------
// Reconciliation: build new children fibers based on old fibers
// -------------------------------------------------
function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber =
    wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while (index < elements.length || oldFiber != null) {
    const element = elements[index]
    const sameType =
      oldFiber &&
      element &&
      element.type === oldFiber.type

    let newFiber = null

    if (sameType) {
      // Update existing fiber
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        child: null,
        sibling: null,
        alternate: oldFiber,
        hooks: oldFiber.hooks || [],
        effectTag: "UPDATE",
      }
    }

    if (element && !sameType) {
      // New fiber
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        child: null,
        sibling: null,
        alternate: null,
        hooks: [],
        effectTag: "PLACEMENT",
      }
    }

    if (oldFiber && !sameType) {
      // This old fiber should be deleted
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if (index === 0) {
      wipFiber.child = newFiber
    } else if (newFiber && prevSibling) {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}

// -------------------------------------------------
// Commit phase: apply changes to the DOM
// -------------------------------------------------
function commitRoot() {
  deletions.forEach(commitWork)
  if (wipRoot && wipRoot.child) {
    commitWork(wipRoot.child)
  }

  currentRoot = wipRoot
  wipRoot = null

  // Run effects after DOM is committed
  flushEffects()
}

function commitWork(fiber) {
  if (!fiber) return

  // Find nearest parent with a DOM node
  let parentFiber = fiber.parent
  while (parentFiber && !parentFiber.dom) {
    parentFiber = parentFiber.parent
  }
  const parentDom = parentFiber ? parentFiber.dom : null

  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    parentDom && parentDom.appendChild(fiber.dom)
  } else if (
    fiber.effectTag === "UPDATE" &&
    fiber.dom != null &&
    fiber.alternate
  ) {
    updateDom(fiber.dom, fiber.alternate.props || {}, fiber.props || {})
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, parentDom)
    return
  }

  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitDeletion(fiber, parentDom) {
  if (!fiber) return
  if (fiber.dom) {
    parentDom && parentDom.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, parentDom)
  }
}

// -------------------------------------------------
// Hooks implementation
// -------------------------------------------------
export function useState(initial) {
  const oldHook =
    wipFiber &&
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }

  if (oldHook && oldHook.queue.length > 0) {
    oldHook.queue.forEach((action) => {
      hook.state =
        typeof action === "function"
          ? action(hook.state)
          : action
    })
  }

  const setState = (action) => {
    hook.queue.push(action)
    _rerenderRoot()
  }

  wipFiber.hooks.push(hook)
  hookIndex++

  return [hook.state, setState]
}

export function useRef(initialValue) {
  const oldHook =
    wipFiber &&
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]

  const hook = oldHook
    ? oldHook
    : { current: initialValue }

  wipFiber.hooks.push(hook)
  hookIndex++

  return hook
}

export function useMemo(factory, deps) {
  const oldHook =
    wipFiber &&
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]

  let hasChanged = true

  if (oldHook && oldHook.deps) {
    hasChanged = deps
      ? deps.some(
          (dep, i) => !Object.is(dep, oldHook.deps[i])
        )
      : true
  }

  const hook = hasChanged
    ? {
        value: factory(),
        deps: deps || [],
      }
    : {
        value: oldHook.value,
        deps: oldHook.deps,
      }

  wipFiber.hooks.push(hook)
  hookIndex++

  return hook.value
}

export function useCallback(callback, deps) {
  return useMemo(() => callback, deps)
}

export function useEffect(effect, deps) {
  const oldHook =
    wipFiber &&
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]

  let hasChanged = true

  if (oldHook && oldHook.deps) {
    hasChanged = deps
      ? deps.some(
          (dep, i) => !Object.is(dep, oldHook.deps[i])
        )
      : true
  }

  const hook = {
    effect,
    deps: deps || [],
    cleanup: oldHook && oldHook.cleanup,
  }

  if (hasChanged) {
    pendingEffects.push(hook)
  }

  wipFiber.hooks.push(hook)
  hookIndex++
}

function flushEffects() {
  pendingEffects.forEach((hook) => {
    if (typeof hook.cleanup === "function") {
      hook.cleanup()
    }
    const cleanup = hook.effect()
    hook.cleanup =
      typeof cleanup === "function" ? cleanup : undefined
  })
  pendingEffects = []
}

// -------------------------------------------------
// Default export
// -------------------------------------------------
const myReact = {
  createElement,
  render,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
}

export default myReact
