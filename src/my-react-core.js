export const TEXT_ELEMENT = "TEXT_ELEMENT"

// -----------------------------
// createElement (shared)
// -----------------------------
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
  const flatChildren = children.flat ? children.flat() : children

  const normalizedChildren = flatChildren
    .filter(
      (child) =>
        child !== null && child !== undefined && child !== false
    )
    .map((child) =>
      typeof child === "object" ? child : createTextElement(child)
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
// Generic renderer factory (reconciler + hooks)
// -------------------------------------------------
export function createRenderer(hostConfig) {
  // Renderer-local state
  let wipRoot = null
  let currentRoot = null
  let nextUnitOfWork = null
  let deletions = []

  let wipFiber = null
  let hookIndex = 0
  let pendingEffects = []

  // -----------------------------
  // Public render API
  // -----------------------------
  function render(element, container) {
    wipRoot = {
      type: hostConfig.rootType || "ROOT",
      instance: container, // host root instance (DOM node, canvas wrapper, etc.)
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

  function _rerenderRoot() {
    if (!currentRoot || !currentRoot.instance) return
    wipRoot = {
      type: currentRoot.type,
      instance: currentRoot.instance,
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

  // -----------------------------
  // Work loop (sync for now)
// -----------------------------
  function workLoop() {
    while (nextUnitOfWork != null) {
      nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    }

    if (!nextUnitOfWork && wipRoot) {
      commitRoot()
    }
  }

  // -----------------------------
  // Unit of work
  // -----------------------------
  function performUnitOfWork(fiber) {
    const isFunctionComponent =
      fiber.type instanceof Function &&
      fiber.type !== (hostConfig.rootType || "ROOT")

    if (isFunctionComponent) {
      updateFunctionComponent(fiber)
    } else {
      updateHostComponent(fiber)
    }

    // DFS: child -> sibling -> parent.sibling
    if (fiber.child) return fiber.child

    let next = fiber
    while (next) {
      if (next.sibling) return next.sibling
      next = next.parent
    }

    return null
  }

  function updateFunctionComponent(fiber) {
    wipFiber = fiber
    hookIndex = 0
    wipFiber.hooks = []

    const children = [fiber.type(fiber.props || {})]
    reconcileChildren(fiber, children)
  }

  function updateHostComponent(fiber) {
    // ROOT already has instance = container
    if (!fiber.instance && fiber.type !== (hostConfig.rootType || "ROOT")) {
      if (fiber.type === TEXT_ELEMENT) {
        fiber.instance = hostConfig.createTextInstance(
          fiber.props.nodeValue || ""
        )
      } else {
        fiber.instance = hostConfig.createInstance(
          fiber.type,
          fiber.props || {}
        )
      }
    }

    const elements = (fiber.props && fiber.props.children) || []
    reconcileChildren(fiber, elements)
  }

  // -----------------------------
  // Reconciliation
  // -----------------------------
  function reconcileChildren(wipFiber_, elements) {
    let index = 0
    let oldFiber =
      wipFiber_.alternate && wipFiber_.alternate.child
    let prevSibling = null

    while (index < elements.length || oldFiber != null) {
      const element = elements[index]
      const sameType =
        oldFiber &&
        element &&
        element.type === oldFiber.type

      let newFiber = null

      if (sameType) {
        // UPDATE
        newFiber = {
          type: oldFiber.type,
          props: element.props,
          instance: oldFiber.instance,
          parent: wipFiber_,
          child: null,
          sibling: null,
          alternate: oldFiber,
          hooks: oldFiber.hooks || [],
          effectTag: "UPDATE",
        }
      }

      if (element && !sameType) {
        // PLACEMENT
        newFiber = {
          type: element.type,
          props: element.props,
          instance: null,
          parent: wipFiber_,
          child: null,
          sibling: null,
          alternate: null,
          hooks: [],
          effectTag: "PLACEMENT",
        }
      }

      if (oldFiber && !sameType) {
        // DELETION
        oldFiber.effectTag = "DELETION"
        deletions.push(oldFiber)
      }

      if (oldFiber) {
        oldFiber = oldFiber.sibling
      }

      if (index === 0) {
        wipFiber_.child = newFiber
      } else if (newFiber && prevSibling) {
        prevSibling.sibling = newFiber
      }

      prevSibling = newFiber
      index++
    }
  }

  // -----------------------------
  // Commit phase
  // -----------------------------
  function commitRoot() {
    deletions.forEach(commitWork)
    if (wipRoot && wipRoot.child) {
      commitWork(wipRoot.child)
    }

    currentRoot = wipRoot
    wipRoot = null

    // Optional host hook (e.g., canvas redraw)
    if (hostConfig.finalizeContainer && currentRoot) {
      hostConfig.finalizeContainer(currentRoot.instance)
    }

    flushEffects()
  }

  function commitWork(fiber) {
    if (!fiber) return

    // Find nearest parent with an instance
    let parentFiber = fiber.parent
    while (parentFiber && !parentFiber.instance) {
      parentFiber = parentFiber.parent
    }
    const parentInstance = parentFiber && parentFiber.instance

    if (
      fiber.effectTag === "PLACEMENT" &&
      fiber.instance != null &&
      parentInstance
    ) {
      hostConfig.appendChild(parentInstance, fiber.instance)
    } else if (
      fiber.effectTag === "UPDATE" &&
      fiber.instance != null &&
      fiber.alternate
    ) {
      if (fiber.type === TEXT_ELEMENT) {
        hostConfig.commitTextUpdate(
          fiber.instance,
          fiber.alternate.props.nodeValue,
          fiber.props.nodeValue
        )
      } else {
        hostConfig.commitUpdate(
          fiber.instance,
          fiber.alternate.props || {},
          fiber.props || {}
        )
      }
    } else if (fiber.effectTag === "DELETION") {
      commitDeletion(fiber, parentInstance)
      return
    }

    commitWork(fiber.child)
    commitWork(fiber.sibling)
  }

  function commitDeletion(fiber, parentInstance) {
    if (!fiber) return
    if (fiber.instance) {
      hostConfig.removeChild(parentInstance, fiber.instance)
    } else {
      commitDeletion(fiber.child, parentInstance)
    }
  }

  // -----------------------------
  // Hooks
  // -----------------------------
  function useState(initial) {
    const oldHook =
      wipFiber &&
      wipFiber.alternate &&
      wipFiber.alternate.hooks &&
      wipFiber.alternate.hooks[hookIndex]

    const hook = oldHook || {
      state: initial,
      queue: [],
    }

    if (hook.queue.length > 0) {
      hook.queue.forEach((action) => {
        hook.state =
          typeof action === "function"
            ? action(hook.state)
            : action
      })
      hook.queue = []
    }

    const setState = (action) => {
      hook.queue.push(action)
      _rerenderRoot()
    }

    wipFiber.hooks.push(hook)
    hookIndex++

    return [hook.state, setState]
  }

  function useRef(initialValue) {
    const oldHook =
      wipFiber &&
      wipFiber.alternate &&
      wipFiber.alternate.hooks &&
      wipFiber.alternate.hooks[hookIndex]

    const hook = oldHook || { current: initialValue }

    wipFiber.hooks.push(hook)
    hookIndex++

    return hook
  }

  function useMemo(factory, deps) {
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

  function useCallback(callback, deps) {
    return useMemo(() => callback, deps)
  }

  function useEffect(effect, deps) {
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

  return {
    render,
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
  }
}
