---
hide:
  - navigation
  - toc
---

<div class="hero">
  <div class="hero-copy">
    <h1 class="hero-title">CesiumJS <span class="hero-title-accent">AI Starter App</span></h1>
    <p class="hero-subtitle">
      A ready-to-run starter pairing a <a href="https://cesium.com/platform/cesiumjs/">CesiumJS</a>
      3D globe with an LLM chat interface that drives it via tool calls (e.g.
      <em>"fly to Paris"</em>) — with the <strong>API key kept server-side</strong>.
    </p>
    <div class="hero-actions">
      <a class="hero-btn hero-btn--primary" href="getting-started">Get Started</a>
      <a class="hero-btn hero-btn--secondary" href="tutorials/">Check it out tutorials</a>
    </div>
  </div>
</div>

<div class="carousel-panel" id="showcase">
  <div class="carousel-header">
    <p class="carousel-hint">Scroll, swipe, or use the arrows — click a slide for details, including tutorials</p>
  </div>
  <div class="carousel-row">
    <button class="carousel-arrow carousel-arrow--prev" type="button" aria-label="Previous slide" onclick="this.nextElementSibling.scrollBy({left: -this.nextElementSibling.clientWidth * 0.9, behavior: 'smooth'})">‹</button>
    <div class="carousel-track" id="showcase-track">
      <a class="carousel-slide" href="tutorials/cesium-viewer-tools-tutorial">
        <figure>
          <img src="assets/fly-to-palm-jumeirah.png" alt="Chat panel flying the CesiumJS camera to Palm Jumeirah in Dubai" loading="lazy" />
          <figcaption>
            <h3 class="carousel-slide-title">Cesium Viewer Tools Tutorial</h3>
            <p>Ask in plain English — <em>"fly to Palm Jumeirah with altitude 8000"</em> — and the LLM calls the <code>flyTo</code> tool to animate the camera there.</p>
            <span class="carousel-cta">Read the tutorial →</span>
          </figcaption>
        </figure>
      </a>
      <a class="carousel-slide" href="tutorials/codegen-tool-tutorial">
        <figure>
          <img src="assets/codegen-new-york.gif" alt="Generated CesiumJS code adding 3D buildings and flying the camera over New York City" loading="lazy" />
          <figcaption>
            <h3 class="carousel-slide-title">Codegen Tool Tutorial</h3>
            <p>Ask for something not in the tool library — the LLM generates AST-verified CesiumJS code, sandboxed and run only after your approval.</p>
            <span class="carousel-cta">Read the tutorial →</span>
          </figcaption>
        </figure>
      </a>
      <a class="carousel-slide" href="tutorials/mcp-server-tutorial">
        <figure>
          <img src="assets/fire_mcp.gif" alt="Chat panel flying the CesiumJS camera to Palm Jumeirah in Dubai" loading="lazy" />
          <figcaption>
            <h3 class="carousel-slide-title">Adding an MCP Server</h3>
            <p>Connect any Model Context Protocol server via <code>MCP_SERVERS</code> — its tools plug straight into the same agent loop, gated by the same approval flow.</p>
            <span class="carousel-cta">Read the tutorial →</span>
          </figcaption>
        </figure>
      </a>
    </div>
    <button class="carousel-arrow carousel-arrow--next" type="button" aria-label="Next slide" onclick="this.previousElementSibling.scrollBy({left: this.previousElementSibling.clientWidth * 0.9, behavior: 'smooth'})">›</button>
  </div>
</div>

<script>
  (function () {
    var track = document.getElementById("showcase-track");
    if (!track) return;
    var timer = setInterval(function () {
      var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      track.scrollTo({
        left: atEnd ? 0 : track.scrollLeft + track.clientWidth * 0.9,
        behavior: "smooth",
      });
    }, 15000);
    ["pointerdown", "wheel", "touchstart"].forEach(function (eventName) {
      track.addEventListener(
        eventName,
        function () {
          clearInterval(timer);
        },
        { passive: true, once: true },
      );
    });
  })();
</script>

## Want to learn more?

<div class="feature-grid">
  <a class="feature-card" href="architectures/architecture">
    <h3 class="feature-title">Architecture</h3>
    <p class="feature-desc">Component layout, request flow, and Docker topology for the full stack.</p>
    <span class="feature-cta">Read →</span>
  </a>
  <a class="feature-card" href="architectures/architecture-codegen">
    <h3 class="feature-title">Codegen Architecture</h3>
    <p class="feature-desc">How natural-language intents become AST-verified, sandboxed CesiumJS code.</p>
    <span class="feature-cta">Read →</span>
  </a>
  <a class="feature-card" href="architectures/architecture-mcp">
    <h3 class="feature-title">MCP Support Architecture</h3>
    <p class="feature-desc">How Model Context Protocol servers plug external tools into the agent loop.</p>
    <span class="feature-cta">Read →</span>
  </a>
  <a class="feature-card" href="packages/codegen-cesium">
    <h3 class="feature-title">@cesium-ai/codegen-cesium</h3>
    <p class="feature-desc">Intent-to-code generation pipeline: BM25 skill matching, prompt building, and AST verification (server only).</p>
    <span class="feature-cta">Read →</span>
  </a>
  <a class="feature-card" href="packages/codegen-sandbox">
    <h3 class="feature-title">@cesium-ai/codegen-sandbox</h3>
    <p class="feature-desc">QuickJS-wasm sandbox that safely executes AST-verified code against the live Viewer (frontend only).</p>
    <span class="feature-cta">Read →</span>
  </a>
  <a class="feature-card" href="packages/mcp-tools">
    <h3 class="feature-title">@cesium-ai/mcp-tools</h3>
    <p class="feature-desc">Optional MCP client bridge — connect external Model Context Protocol tool servers into the agent loop.</p>
    <span class="feature-cta">Read →</span>
  </a>
</div>

## Source

[github.com/CesiumGS/cesiumjs-ai-starter-app](https://github.com/CesiumGS/cesiumjs-ai-starter-app)
