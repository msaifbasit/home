/* ============================================================
   scene-worker.js — runs the 3D background inside a Web Worker.
   All rendering happens off the main thread, so page animations
   (typing, scrolling) never stutter. main.js transfers the
   canvas here as an OffscreenCanvas and forwards input events.
   ============================================================ */

import { initScene } from "./bg-scene.js";

let api = null;

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    api = initScene(m.canvas, m.params);
    self.postMessage({ type: "ready" });
    return;
  }
  if (!api) return;
  if (m.type === "pointer") api.pointer(m.x, m.y);
  else if (m.type === "scroll") api.scroll(m.y);
  else if (m.type === "resize") api.resize(m.width, m.height, m.pixelRatio);
  else if (m.type === "visibility") api.setPaused(m.hidden);
};
