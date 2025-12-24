// src/my-react.js

// -----------------------------
// Types (for mental model only)
// -----------------------------
// MyReactElement = {
//   type: string | Function,
//   props: { [key: string]: any, children?: any }
// }

export function createElement(type, props, ...children) {
  const normalizedChildren =
    children.length === 1 ? children[0] : children

  return {
    type,
    props: {
      ...(props || {}),
      children: normalizedChildren,
    },
  }
}

// Internal helper to convert our virtual node into real DOM
function createDomNode(node) {
  if (node == null || typeof node === "boolean") {
    return null
  }

  // Primitive value -> Text node
  if (typeof node === "string" || typeof node === "number") {
    return document.createTextNode(String(node))
  }

  // Function component
  if (typeof node.type === "function") {
    const componentResult = node.type(node.props || {})
    return createDomNode(componentResult)
  }

  // Host element (div, span, button, etc.)
  const el = document.createElement(node.type)

  const { children, ...rest } = node.props || {}

  // Very naive prop handling
  Object.keys(rest).forEach((key) => {
    const value = rest[key]

    if (key === "style" && typeof value === "object") {
      Object.assign(el.style, value)
    } else if (key.startsWith("on") && typeof value === "function") {
      const eventName = key.slice(2).toLowerCase()
      el.addEventListener(eventName, value)
    } else if (key === "className") {
      el.setAttribute("class", value)
    } else {
      el.setAttribute(key, value)
    }
  })

  // Children
  if (Array.isArray(children)) {
    children.forEach((child) => {
      const childNode = createDomNode(child)
      if (childNode) el.appendChild(childNode)
    })
  } else if (children != null) {
    const childNode = createDomNode(children)
    if (childNode) el.appendChild(childNode)
  }

  return el
}

// We keep the last root element and container in memory.
// This will be important later for re-renders with hooks.
let rootElement = null
let rootContainer = null

export function render(element, container) {
  rootElement = element
  rootContainer = container

  // Very naive: drop everything and rebuild
  container.innerHTML = ""
  const dom = createDomNode(element)
  if (dom) {
    container.appendChild(dom)
  }
}

// (Future) internal API: used later by hooks to trigger a re-render
export function _rerenderRoot() {
  if (!rootElement || !rootContainer) return
  render(rootElement, rootContainer)
}

// Default export-like object if you prefer
const myReact = {
  createElement,
  render,
}

export default myReact
