// src/my-react-dom.js
import {
  TEXT_ELEMENT,
  createElement,
  createRenderer,
} from "./my-react-core.js"

// ------------------------------------------
// DOM-specific helpers
// ------------------------------------------
const isEvent = (key) => key.startsWith("on")
const isProperty = (key) =>
  key !== "children" && key !== "nodeValue" && !isEvent(key)

function updateDomProps(dom, prevProps, nextProps) {
  // Text node handled separately
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

// ------------------------------------------
// Host config for DOM
// ------------------------------------------
const domHostConfig = {
  rootType: "ROOT",

  createInstance(type, props) {
    const dom = document.createElement(type)
    updateDomProps(dom, {}, props || {})
    return dom
  },

  createTextInstance(text) {
    return document.createTextNode(text)
  },

  appendChild(parent, child) {
    parent.appendChild(child)
  },

  removeChild(parent, child) {
    if (parent && child && child.parentNode === parent) {
      parent.removeChild(child)
    }
  },

  commitUpdate(instance, oldProps, newProps) {
    updateDomProps(instance, oldProps, newProps)
  },

  commitTextUpdate(textInstance, oldText, newText) {
    if (textInstance.nodeType === Node.TEXT_NODE) {
      textInstance.nodeValue =
        newText == null ? "" : String(newText)
    }
  },

  // DOM renderer não precisa de finalizeContainer
  finalizeContainer(/*rootInstance*/) {
    // no-op
  },
}

// Cria o renderer DOM
const {
  render,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} = createRenderer(domHostConfig)

// Re-export public API
export {
  createElement,
  render,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
}

// Default export style
const MyReactDOM = {
  createElement,
  render,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
}

export default MyReactDOM
