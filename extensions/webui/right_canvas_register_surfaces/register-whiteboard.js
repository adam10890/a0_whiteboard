/**
 * a0_whiteboard - Right Canvas surface registration (A0 v1.15-1.17).
 *
 * Mirrors the contract used by built-in _browser / _desktop surfaces:
 * the file lives under extensions/webui/right_canvas_register_surfaces/
 * and is auto-loaded by the right-canvas system. Its default export is
 * invoked with the canvas registrar and calls registerSurface().
 *
 * The Python file at extensions/python/right_canvas_register_surfaces/
 * was a misread of the API and never actually registered anything.
 */
import { store as whiteboardStore } from "/plugins/a0_whiteboard/webui/whiteboard-store.js";

function waitForElement(selector, timeoutMs = 5000) {
  const found = document.querySelector(selector);
  if (found) return Promise.resolve(found);
  return new Promise((resolve) => {
    const timeout = globalThis.setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(selector));
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (!element) return;
      globalThis.clearTimeout(timeout);
      observer.disconnect();
      resolve(element);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

export default async function registerWhiteboardSurface(canvas) {
  canvas.registerSurface({
    id: "whiteboard",
    title: "Whiteboard",
    icon: "draw",
    order: 35,
    modalPath: "/plugins/a0_whiteboard/webui/main.html",
    beginDockHandoff() {
      whiteboardStore.beginSurfaceHandoff?.();
    },
    finishDockHandoff() {
      whiteboardStore.finishSurfaceHandoff?.();
    },
    cancelDockHandoff() {
      whiteboardStore.cancelSurfaceHandoff?.();
    },
    async open(payload = {}) {
      const panel = await waitForElement('[data-surface-id="whiteboard"] .wb-panel');
      if (panel && whiteboardStore?.onOpen) {
        await whiteboardStore.onOpen(panel, { mode: "canvas", ...payload });
      }
    },
    async close() {
      await whiteboardStore.cleanup?.();
    },
  });
}
