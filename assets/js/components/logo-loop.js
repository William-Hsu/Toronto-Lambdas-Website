/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   LogoLoop — vanilla port of the React Bits component of the same name.
   No dependencies. Works from file:// as well as a web server.

   An infinite horizontal marquee of company logos that eases down to a slow
   crawl on hover. Reads its items from window.LPHIE.logos (data/logos.js).
   Items with no image render as typographic wordmarks — see buildWordmark.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Constants + defaults ------------------------------------------ */

  /* Straight from the reference's ANIMATION_CONFIG — do not tune these
     casually, they are what makes the hover slow-down feel elastic. */
  var SMOOTH_TAU = 0.25;
  var MIN_COPIES = 2;
  var COPY_HEADROOM = 2;

  var IMG_BASE = "assets/img/logos/";

  var DEFAULTS = {
    logos: null,          /* null => window.LPHIE.logos */
    speed: 55,
    direction: "left",    /* "left" | "right" | "up" | "down" */
    width: "100%",
    logoHeight: 30,
    gap: 68,
    pauseOnHover: null,   /* null == "not specified", see resolveHoverSpeed */
    hoverSpeed: 14,       /* slow to a crawl on hover; a dead stop reads broken */
    fadeOut: true,
    fadeOutColor: "",     /* empty => the CSS default, var(--paper) */
    scaleOnHover: true,
    ariaLabel: "Companies where Alpha Xi alumni work",
    className: ""
  };

  /* Depth-aware asset prefix, same rule as assets/js/main.js. */
  var PREFIX = (function () {
    var d = document.documentElement.getAttribute("data-root");
    return d === null ? "" : d;
  })();

  /* ---- 2. Helpers ------------------------------------------------------- */

  function assign(target, source) {
    if (!source) return target;
    for (var k in source) {
      if (!Object.prototype.hasOwnProperty.call(source, k)) continue;
      if (source[k] === undefined) continue;
      target[k] = source[k];
    }
    return target;
  }

  function toCssLength(value) {
    if (typeof value === "number") return value + "px";
    if (typeof value === "string" && value !== "") return value;
    return "";
  }

  function isTodo(s) { return /^\s*TODO/i.test(String(s || "")); }

  /* Mirrors the reference's effectiveHoverSpeed memo. Returns null for the
     reference's `undefined` case, i.e. "do not react to hover at all". */
  function resolveHoverSpeed(opts) {
    if (typeof opts.hoverSpeed === "number") return opts.hoverSpeed;
    if (opts.pauseOnHover === true) return 0;
    if (opts.pauseOnHover === false) return null;
    return 0;
  }

  /* ---- 3. Item rendering ------------------------------------------------ */

  /* The chapter has no logo files yet and these are third-party trademarks,
     so the default rendering is a typographic wordmark: the company name in
     the site's own type, uppercase, letter-spaced, in a muted navy, boxed to
     the same height a real logo would occupy so the row keeps one baseline.
     Three optical sizes keep "TD" and "JPMorgan Chase & Co." in balance. */
  function buildWordmark(name) {
    var label = String(name == null ? "" : name);
    var len = label.replace(/\s+/g, " ").length;
    var cls = "logoloop__wordmark";

    if (len <= 4) cls += " logoloop__wordmark--short";
    else if (len >= 16) cls += " logoloop__wordmark--long";
    if (isTodo(label)) cls += " logoloop__wordmark--todo";

    var span = document.createElement("span");
    span.className = cls;
    span.textContent = label;
    return span;
  }

  /* eager: true for the first (measured) sequence only — lazy images there
     could stay unloaded and the strip would measure zero-width. */
  function buildItem(item, eager, onImageFail) {
    var li = document.createElement("li");
    li.className = "logoloop__item";
    li.setAttribute("role", "listitem");

    var name = (item && item.name) ? String(item.name) : "";
    var src = (item && item.src) ? String(item.src) : "";
    var href = (item && item.href) ? String(item.href) : "";
    var content;

    if (src) {
      var img = document.createElement("img");
      /* Filenames only — resolved against assets/img/logos/ so the site keeps
         working offline and from file://. See data/logos.js. */
      img.setAttribute("src", PREFIX + IMG_BASE + src);
      img.setAttribute("alt", name);
      img.setAttribute("loading", eager ? "eager" : "lazy");
      img.setAttribute("decoding", "async");
      img.setAttribute("draggable", "false");
      img.addEventListener("error", function () {
        /* A missing file must never look broken — fall back to the wordmark. */
        if (li.getAttribute("data-fallback")) return;
        li.setAttribute("data-fallback", "1");
        if (img.parentNode) img.parentNode.replaceChild(buildWordmark(name), img);
        if (onImageFail) onImageFail();
      });
      content = img;
    } else {
      content = buildWordmark(name);
    }

    if (href) {
      var a = document.createElement("a");
      a.className = "logoloop__link";
      a.setAttribute("href", href);
      a.setAttribute("aria-label", name || "logo link");
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noreferrer noopener");
      a.appendChild(content);
      li.appendChild(a);
    } else {
      li.appendChild(content);
    }

    return li;
  }

  /* Reference's useImageLoader: measure only once every <img> in the first
     sequence has fired load or error. The zero-image case resolves at once —
     wordmark-only rows hit this path. */
  function waitForImages(node, onReady) {
    var images = node.querySelectorAll("img");
    if (images.length === 0) { onReady(); return function () {}; }

    var remaining = images.length;
    var attached = [];

    function handle() {
      remaining -= 1;
      if (remaining === 0) onReady();
    }

    Array.prototype.forEach.call(images, function (img) {
      if (img.complete) { handle(); return; }
      img.addEventListener("load", handle);
      img.addEventListener("error", handle);
      attached.push(img);
    });

    return function detach() {
      for (var i = 0; i < attached.length; i++) {
        attached[i].removeEventListener("load", handle);
        attached[i].removeEventListener("error", handle);
      }
    };
  }

  /* ---- 4. Mount --------------------------------------------------------- */

  function mount(root, options) {
    if (!root) return function () {};

    var opts = assign(assign({}, DEFAULTS), options);
    var logos = (opts.logos && opts.logos.length)
      ? opts.logos
      : ((window.LPHIE && window.LPHIE.logos) || []);

    var isVertical = opts.direction === "up" || opts.direction === "down";
    var hoverVelocity = resolveHoverSpeed(opts);

    /* targetVelocity, transcribed from the reference memo. */
    var magnitude = Math.abs(opts.speed);
    var directionMultiplier;
    if (isVertical) directionMultiplier = opts.direction === "up" ? 1 : -1;
    else directionMultiplier = opts.direction === "left" ? 1 : -1;
    var speedMultiplier = opts.speed < 0 ? -1 : 1;
    var targetVelocity = magnitude * directionMultiplier * speedMultiplier;

    var motionQuery = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    var reduced = !!(motionQuery && motionQuery.matches);

    var destroyed = false;
    var seqWidth = 0;
    var seqHeight = 0;
    var offset = 0;
    var velocity = 0;
    var rafId = null;
    var lastTimestamp = null;
    var isHovered = false;
    var visible = true;
    var running = false;
    var seq = null;

    /* -- 4a. Take over the element, keeping the no-JS content for destroy -- */
    var originalClass = root.className;
    var originalNodes = document.createDocumentFragment();
    while (root.firstChild) originalNodes.appendChild(root.firstChild);

    var classes = ["logoloop", isVertical ? "logoloop--vertical" : "logoloop--horizontal"];
    if (opts.fadeOut) classes.push("logoloop--fade");
    if (opts.scaleOnHover) classes.push("logoloop--scale-hover");
    if (opts.className) classes.push(opts.className);
    root.className = (originalClass ? originalClass + " " : "") + classes.join(" ");

    root.style.setProperty("--logoloop-gap", opts.gap + "px");
    root.style.setProperty("--logoloop-logoHeight", opts.logoHeight + "px");
    if (opts.fadeOutColor) root.style.setProperty("--logoloop-fadeColor", opts.fadeOutColor);
    var widthValue = toCssLength(opts.width);
    if (widthValue) root.style.width = widthValue;

    root.setAttribute("role", "region");
    if (opts.ariaLabel) root.setAttribute("aria-label", opts.ariaLabel);

    var track = document.createElement("div");
    track.className = "logoloop__track";
    root.appendChild(track);

    /* -- 4b. Sequence copies: only the first is measured + readable -------- */
    var copyCount = reduced ? 1 : MIN_COPIES;

    function buildList(copyIndex) {
      var ul = document.createElement("ul");
      ul.className = "logoloop__list";
      ul.setAttribute("role", "list");
      if (copyIndex > 0) ul.setAttribute("aria-hidden", "true");
      for (var i = 0; i < logos.length; i++) {
        ul.appendChild(buildItem(logos[i], copyIndex === 0, handleImageFail));
      }
      return ul;
    }

    function renderCopies(count) {
      while (track.childNodes.length > count) track.removeChild(track.lastChild);
      while (track.childNodes.length < count) track.appendChild(buildList(track.childNodes.length));
    }

    function setCopyCount(next) {
      var wanted = reduced ? 1 : next;
      if (wanted === copyCount) return;
      copyCount = wanted;
      renderCopies(copyCount);
    }

    function handleImageFail() { updateDimensions(); }

    /* -- 4c. Measurement, transcribed from updateDimensions ---------------- */
    function updateDimensions() {
      if (destroyed || !seq) return;

      var containerWidth = root.clientWidth || 0;
      var rect = seq.getBoundingClientRect ? seq.getBoundingClientRect() : null;
      var sequenceWidth = rect ? rect.width : 0;
      var sequenceHeight = rect ? rect.height : 0;
      var copiesNeeded;

      if (isVertical) {
        var parentHeight = (root.parentElement && root.parentElement.clientHeight) || 0;
        if (parentHeight > 0) {
          var targetHeight = Math.ceil(parentHeight);
          if (root.style.height !== targetHeight + "px") root.style.height = targetHeight + "px";
        }
        if (sequenceHeight > 0) {
          seqHeight = Math.ceil(sequenceHeight);
          var viewportHeight = root.clientHeight || parentHeight || sequenceHeight;
          copiesNeeded = Math.ceil(viewportHeight / sequenceHeight) + COPY_HEADROOM;
          setCopyCount(Math.max(MIN_COPIES, copiesNeeded));
        }
      } else if (sequenceWidth > 0) {
        seqWidth = Math.ceil(sequenceWidth);
        copiesNeeded = Math.ceil(containerWidth / sequenceWidth) + COPY_HEADROOM;
        setCopyCount(Math.max(MIN_COPIES, copiesNeeded));
      }
    }

    /* -- 4d. Animation loop ------------------------------------------------ */
    function paint() {
      var seqSize = isVertical ? seqHeight : seqWidth;
      if (seqSize <= 0) return;
      offset = ((offset % seqSize) + seqSize) % seqSize;
      track.style.transform = isVertical
        ? "translate3d(0, " + (-offset) + "px, 0)"
        : "translate3d(" + (-offset) + "px, 0, 0)";
    }

    function animate(timestamp) {
      if (lastTimestamp === null) lastTimestamp = timestamp;
      var deltaTime = Math.max(0, timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      var target = (isHovered && hoverVelocity !== null) ? hoverVelocity : targetVelocity;

      /* Exponential smoothing toward the target velocity — this is what makes
         the hover slow-down feel elastic rather than abrupt. */
      var easingFactor = 1 - Math.exp(-deltaTime / SMOOTH_TAU);
      velocity += (target - velocity) * easingFactor;

      var seqSize = isVertical ? seqHeight : seqWidth;
      if (seqSize > 0) {
        var nextOffset = offset + velocity * deltaTime;
        nextOffset = ((nextOffset % seqSize) + seqSize) % seqSize;
        offset = nextOffset;
        track.style.transform = isVertical
          ? "translate3d(0, " + (-offset) + "px, 0)"
          : "translate3d(" + (-offset) + "px, 0, 0)";
      }

      rafId = window.requestAnimationFrame(animate);
    }

    function start() {
      if (running || reduced || destroyed || !visible) return;
      running = true;
      lastTimestamp = null;
      paint();
      rafId = window.requestAnimationFrame(animate);
    }

    function stop() {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      rafId = null;
      lastTimestamp = null;
      running = false;
    }

    /* -- 4e. Hover / focus ------------------------------------------------- */
    function onEnter() { if (hoverVelocity !== null) isHovered = true; }
    function onLeave() { if (hoverVelocity !== null) isHovered = false; }

    track.addEventListener("mouseenter", onEnter);
    track.addEventListener("mouseleave", onLeave);
    /* Keyboard parity: tabbing into a logo link slows the strip too. */
    track.addEventListener("focusin", onEnter);
    track.addEventListener("focusout", onLeave);

    /* -- 4f. Observers ----------------------------------------------------- */
    renderCopies(copyCount);
    seq = track.firstChild;

    var resizeObserver = null;
    var onWindowResize = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(function () { updateDimensions(); });
      resizeObserver.observe(root);
      if (seq) resizeObserver.observe(seq);
    } else {
      onWindowResize = function () { updateDimensions(); };
      window.addEventListener("resize", onWindowResize);
    }

    /* Pause the rAF loop while the band is off-screen — several animated
       components share this page and must not all burn CPU at once. */
    var intersectionObserver = null;
    if (window.IntersectionObserver) {
      visible = false;
      intersectionObserver = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) visible = entries[i].isIntersecting;
        if (visible) start(); else stop();
      }, { rootMargin: "120px 0px" });
      intersectionObserver.observe(root);
    }

    var onMotionChange = function () {
      reduced = !!motionQuery.matches;
      if (reduced) {
        stop();
        offset = 0;
        velocity = 0;
        track.style.transform = "";
        if (copyCount !== 1) { copyCount = 1; renderCopies(1); }
      } else {
        copyCount = MIN_COPIES;
        renderCopies(copyCount);
        updateDimensions();
        start();
      }
    };
    if (motionQuery) {
      if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotionChange);
      else if (motionQuery.addListener) motionQuery.addListener(onMotionChange);
    }

    var detachImages = waitForImages(seq, updateDimensions);
    updateDimensions();

    /* Wordmark widths shift once Inter arrives — re-measure then. */
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () { updateDimensions(); });
    }

    if (!reduced) start();

    /* -- 4g. Teardown ------------------------------------------------------ */
    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();

      if (resizeObserver) resizeObserver.disconnect();
      if (intersectionObserver) intersectionObserver.disconnect();
      if (onWindowResize) window.removeEventListener("resize", onWindowResize);
      if (detachImages) detachImages();

      track.removeEventListener("mouseenter", onEnter);
      track.removeEventListener("mouseleave", onLeave);
      track.removeEventListener("focusin", onEnter);
      track.removeEventListener("focusout", onLeave);

      if (motionQuery) {
        if (motionQuery.removeEventListener) motionQuery.removeEventListener("change", onMotionChange);
        else if (motionQuery.removeListener) motionQuery.removeListener(onMotionChange);
      }

      while (root.firstChild) root.removeChild(root.firstChild);
      root.className = originalClass;
      root.style.width = "";
      root.style.height = "";
      root.style.removeProperty("--logoloop-gap");
      root.style.removeProperty("--logoloop-logoHeight");
      root.style.removeProperty("--logoloop-fadeColor");
      root.removeAttribute("role");
      root.removeAttribute("aria-label");
      root.removeAttribute("data-lphie-mounted");
      root.appendChild(originalNodes);
    };
  }

  window.LPHIE.components.logoLoop = mount;

  /* ---- 5. Auto-init ----------------------------------------------------- */

  function autoInit() {
    var nodes = document.querySelectorAll("[data-logo-loop]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-logo-loop");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
