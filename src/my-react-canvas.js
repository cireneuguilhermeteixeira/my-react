import {
  TEXT_ELEMENT,
  createElement,
  createRenderer,
} from "./my-react-core.js"


const canvasHostConfig = {
  rootType: "ROOT_CANVAS",

  createInstance(type, props) {
    return {
      type,
      props: { ...(props || {}) },
      children: [],
    }
  },

  createTextInstance(text) {

    return {
      type: TEXT_ELEMENT,
      text: String(text),
      children: [],
    }
  },

  appendChild(parentInstance, childInstance) {
    if (!parentInstance) return
    if (!parentInstance.children) {
      parentInstance.children = []
    }
    parentInstance.children.push(childInstance)
  },

  removeChild(parentInstance, childInstance) {
    if (!parentInstance || !parentInstance.children) return
    const idx = parentInstance.children.indexOf(childInstance)
    if (idx >= 0) {
      parentInstance.children.splice(idx, 1)
    }
  },

  commitUpdate(instance, oldProps, newProps) {
    instance.props = { ...(newProps || {}) }
  },

  commitTextUpdate(textInstance, oldText, newText) {
    textInstance.text = String(newText)
  },

  // Called after the whole fiber tree is committed
  finalizeContainer(rootInstance) {
    if (!rootInstance) return
    const { canvas, ctx, children } = rootInstance
    if (!canvas || !ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Recursively draw children
    function drawNode(node) {
      if (!node || !node.type) return

      if (node.type === "rect") {
        const {
          x = 0,
          y = 0,
          width = 10,
          height = 10,
          fill = "black",
        } = node.props || {}

        ctx.fillStyle = fill
        ctx.fillRect(x, y, width, height)
      }
      else if (node.type === "circle") {
        const {
            x = 0,
            y = 0,
            radius = 10,
            fill = "black",
        } = node.props || {};

        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
      

      if (Array.isArray(node.children)) {
        node.children.forEach(drawNode)
      }
    }

    if (Array.isArray(children)) {
      children.forEach(drawNode)
    }
  },
}

const {
  render: _renderCanvasInternal,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} = createRenderer(canvasHostConfig)


function render(element, canvas) {
  const ctx = canvas.getContext("2d")
  const rootInstance = {
    canvas,
    ctx,
    children: [],
  }
  _renderCanvasInternal(element, rootInstance)
}

// Re-export API
export {
  createElement,
  render,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
}

const MyReactCanvas = {
  createElement,
  render,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
}

export default MyReactCanvas
