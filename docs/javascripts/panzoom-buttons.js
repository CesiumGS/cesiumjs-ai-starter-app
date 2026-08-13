// Adds explicit zoom-in/zoom-out buttons to mkdocs-panzoom-plugin's diagram
// toolbar. The plugin only ships reset/maximize/info buttons and drives zoom
// via scroll-wheel + a modifier key — this dispatches synthetic `wheel`
// events (matching the modifier the plugin is configured with, read from
// each box's own `data-key` attribute) at the diagram element, going through
// the exact same code path a real scroll already uses.
(function () {
  const ZOOM_STEP_DELTA_Y = 100;

  function dispatchZoomWheel(target, deltaY, key) {
    // Zoom toward the element's own center — an unset clientX/clientY
    // defaults to viewport (0,0), which makes repeated zoom-ins drag the
    // diagram's focal point off-screen instead of zooming in place.
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
        cancelable: true,
        altKey: key === "alt",
        ctrlKey: key === "ctrl",
        shiftKey: key === "shift",
      }),
    );
  }

  function makeZoomButton(label, title, deltaY, box, key) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "panzoom-button panzoom-zoom-btn";
    button.title = title;
    button.setAttribute("aria-label", title);
    button.textContent = label;
    button.addEventListener("click", () => {
      // Re-query rather than capturing the element once: Material's mermaid
      // integration renders into a detached copy and then swaps it in via
      // `oldNode.replaceWith(newNode)`, so a reference captured before that
      // swap would dispatch onto a node that's no longer in the document.
      const target = box.querySelector(".mermaid, .d2, img");
      if (target) dispatchZoomWheel(target, deltaY, key);
    });
    return button;
  }

  function addZoomButtons(box) {
    if (box.dataset.zoomButtonsAdded) return;
    const nav = box.querySelector(".panzoom-nav");
    const reset = box.querySelector(".panzoom-reset");
    const max = box.querySelector(".panzoom-max");
    const target = box.querySelector(".mermaid, .d2, img");
    if (!nav || !reset || !target) return;

    box.dataset.zoomButtonsAdded = "true";
    const key = box.dataset.key || "alt";
    nav.insertBefore(makeZoomButton("−", "Zoom out", ZOOM_STEP_DELTA_Y, box, key), reset);
    nav.insertBefore(makeZoomButton("+", "Zoom in", -ZOOM_STEP_DELTA_Y, box, key), reset);

    // mkdocs-panzoom-plugin's own maximize handler only toggles the
    // fullscreen class — it never resets pan/zoom. Any pan/zoom applied (or
    // restored from localStorage) while the diagram was small carries over
    // unchanged into fullscreen, so the diagram can open already panned/
    // zoomed away from fitting the new, much larger viewport. Reset on
    // every maximize so it always opens fitted to the fullscreen view.
    if (max) {
      max.addEventListener("click", () => reset.click());
    }
  }

  function scan() {
    document.querySelectorAll(".panzoom-box").forEach(addZoomButtons);
  }

  // mkdocs-panzoom-plugin itself polls for `.panzoom-box` elements for up to
  // 5s after navigation (see its own zoompan.js) — mirror that window here
  // so our buttons appear once the plugin has finished wrapping diagrams.
  const interval = setInterval(scan, 100);
  setTimeout(() => clearInterval(interval), 6000);

  if (window.document$) {
    // Material's instant-navigation observable — re-scan on every page swap.
    window.document$.subscribe(scan);
  } else {
    document.addEventListener("DOMContentLoaded", scan);
  }
})();
