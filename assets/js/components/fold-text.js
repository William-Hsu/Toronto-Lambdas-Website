/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   FoldText — vanilla port of the React Bits component of the same name.
   No dependencies (the GSAP timeline is reproduced by hand on rAF).
   Works from file:// as well as a web server.

   Mount:  <span data-fold-text='{}'>Lambda Phi Epsilon</span>
   The element's own text is read from the DOM first, so the phrase still
   reads normally if this script never runs.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Configuration -------------------------------------------------- */

  /* Every prop from the reference keeps its name. The type props (fontSize,
     fontWeight, color, ...) default to null = "inherit from the parent", so the
     component is typographically invisible inside body copy unless asked. */
  var DEFAULTS = {
    text: null,                 /* null = read the element's own textContent */
    splitBy: "word",            /* "char" | "word" | "line"                  */
    hinge: "top",               /* "top" | "bottom" | "left" | "right"       */
    duration: 0.65,
    stagger: 0.045,
    ease: "power3.out",
    perspective: 700,
    creaseShading: 0.55,
    trigger: "mount",           /* "mount" | "hover" | "scroll" | "loop"     */
    repeatDelay: 0.75,          /* gap between loop passes (GSAP repeatDelay)*/
    ground: "dark",             /* "dark" | "light" — tunes the crease       */
    creaseBlend: null,          /* explicit mix-blend-mode override          */
    preserveWhitespace: false,  /* true = nbsp + pre-wrap, display headlines  */
    fontSize: null,
    fontWeight: null,
    fontFamily: null,
    color: null,
    lineHeight: null,
    letterSpacing: null
  };

  /* Each hinge picks a transform-origin and the axis/direction it folds from. */
  var HINGE_CONFIG = {
    top:    { origin: "50% 0%",   rotateX: -92, rotateY: 0 },
    bottom: { origin: "50% 100%", rotateX: 92,  rotateY: 0 },
    left:   { origin: "0% 50%",   rotateX: 0,   rotateY: 92 },
    right:  { origin: "100% 50%", rotateX: 0,   rotateY: -92 }
  };

  var TRIGGERS = { mount: 1, hover: 1, scroll: 1, loop: 1 };

  /* The reference still runs a short fade under reduced motion. */
  var REDUCED_DURATION = 0.22;
  var REDUCED_STAGGER = 0.02;

  /* ScrollTrigger's "top 82%" — the element's top reaching 82% of viewport. */
  var SCROLL_ROOT_MARGIN = "0px 0px -18% 0px";

  var NBSP = "\u00a0";

  /* ---- 2. Helpers -------------------------------------------------------- */

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function num(value, fallback) {
    var n = parseFloat(value);
    return isFinite(n) ? n : fallback;
  }

  function round(value) { return Math.round(value * 1000) / 1000; }

  function assign(target, source) {
    if (!source) return target;
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
    }
    return target;
  }

  /* GSAP "powerN.out" === 1 - (1 - t)^N. */
  function easeOut(t, exponent) { return 1 - Math.pow(1 - t, exponent); }

  function easeExponent(name) {
    if (name === "linear") return 1;
    if (name === "power1.out") return 1;
    if (name === "power2.out") return 2;
    if (name === "power4.out") return 4;
    return 3; /* power3.out — the reference default */
  }

  function cssLength(value) {
    if (value == null || value === "") return null;
    return typeof value === "number" ? value + "px" : String(value);
  }

  function motionQuery() {
    return window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  }

  /* Split into characters without tearing surrogate pairs apart. */
  function toChars(text) {
    return text.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g) || [];
  }

  /* ---- 3. Markup --------------------------------------------------------- */

  /* MARKUP SHAPE: every segment is
       <span class="fold-text-segment" data-fold-split="word" style="--fold-perspective:700px">
         <span class="fold-text-piece" data-fold-hinge="top" style="transform-origin:50% 0%; --fold-crease:0">X</span>
       </span>
     The outer segment owns the perspective; the inner piece is what rotates. */
  function buildSegment(doc, content, split, hinge, origin, perspective) {
    var segment = doc.createElement("span");
    segment.className = "fold-text-segment";
    segment.setAttribute("data-fold-split", split);
    segment.style.setProperty("--fold-perspective", perspective + "px");

    var piece = doc.createElement("span");
    piece.className = "fold-text-piece";
    piece.setAttribute("data-fold-hinge", hinge);
    piece.style.transformOrigin = origin;
    piece.style.setProperty("--fold-crease", "0");
    piece.textContent = content ? content : NBSP;

    segment.appendChild(piece);
    return segment;
  }

  function appendWhitespace(doc, host, value, preserve) {
    var parts = value.split(/(\n)/);
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part === "\n") {
        host.appendChild(doc.createElement("br"));
      } else if (part) {
        var span = doc.createElement("span");
        span.className = "fold-text-whitespace";
        /* Plain spaces stay real spaces so a mid-sentence phrase can still wrap.
           preserveWhitespace swaps in nbsp the way the reference does. */
        span.textContent = preserve ? part.replace(/ /g, NBSP) : part;
        host.appendChild(span);
      }
    }
  }

  function buildVisual(doc, text, splitBy, hinge, origin, perspective, preserve) {
    var visual = doc.createElement("span");
    visual.className = "fold-text-visual";
    visual.setAttribute("aria-hidden", "true");

    var i;

    if (splitBy === "line") {
      var lines = text.split("\n");
      for (i = 0; i < lines.length; i++) {
        var lineEl = doc.createElement("span");
        lineEl.className = "fold-text-line";
        lineEl.appendChild(buildSegment(doc, lines[i] || NBSP, "line", hinge, origin, perspective));
        visual.appendChild(lineEl);
      }
      return visual;
    }

    if (splitBy === "word") {
      var parts = text.split(/(\s+)/);
      for (i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        if (/^\s+$/.test(parts[i])) appendWhitespace(doc, visual, parts[i], preserve);
        else visual.appendChild(buildSegment(doc, parts[i], "word", hinge, origin, perspective));
      }
      return visual;
    }

    var chars = toChars(text);
    for (i = 0; i < chars.length; i++) {
      if (chars[i] === "\n") visual.appendChild(doc.createElement("br"));
      else visual.appendChild(buildSegment(doc, chars[i] === " " ? NBSP : chars[i], "char", hinge, origin, perspective));
    }
    return visual;
  }

  /* ---- 4. Mount ---------------------------------------------------------- */

  function mount(root, options) {
    function noop() {}
    if (!root || !root.nodeType) return noop;

    var opts = assign(assign({}, DEFAULTS), options);
    var doc = root.ownerDocument || document;

    /* --- text: read from the DOM first --- */
    var originalText = root.textContent;
    var text = opts.text != null ? String(opts.text) : String(originalText == null ? "" : originalText);
    if (!opts.preserveWhitespace) {
      if (opts.splitBy !== "line") text = text.replace(/[^\S\n]*\n[^\S\n]*/g, "\n").replace(/[^\S\n]+/g, " ");
      text = text.replace(/^\s+|\s+$/g, "");
    }
    if (!text) return noop;

    /* --- resolved settings --- */
    var hingeName = HINGE_CONFIG[opts.hinge] ? opts.hinge : "top";
    var hingeConf = HINGE_CONFIG[hingeName];
    var splitBy = opts.splitBy === "char" || opts.splitBy === "line" ? opts.splitBy : "word";
    var trigger = TRIGGERS[opts.trigger] ? opts.trigger : "mount";
    var safeCrease = clamp(num(opts.creaseShading, DEFAULTS.creaseShading), 0, 1);
    var safePerspective = Math.max(120, num(opts.perspective, DEFAULTS.perspective));
    var baseDuration = Math.max(0.01, num(opts.duration, DEFAULTS.duration));
    var baseStagger = Math.max(0, num(opts.stagger, DEFAULTS.stagger));
    var repeatDelay = Math.max(0, num(opts.repeatDelay, DEFAULTS.repeatDelay));
    var baseExponent = easeExponent(opts.ease);

    /* --- root styling: only emit the type custom properties actually given,
           so the phrase inherits the paragraph's typography by default --- */
    root.classList.add("fold-text");
    if (opts.preserveWhitespace) root.classList.add("fold-text--pre");
    if (splitBy === "line") root.classList.add("fold-text--block");
    root.setAttribute("data-fold-ground", opts.ground === "light" ? "light" : "dark");

    function setVar(name, value) { if (value != null) root.style.setProperty(name, value); }
    setVar("--fold-text-font-size", cssLength(opts.fontSize));
    setVar("--fold-text-font-weight", opts.fontWeight == null ? null : String(opts.fontWeight));
    setVar("--fold-text-font-family", opts.fontFamily == null ? null : String(opts.fontFamily));
    setVar("--fold-text-color", opts.color == null ? null : String(opts.color));
    setVar("--fold-text-line-height", opts.lineHeight == null ? null : String(opts.lineHeight));
    setVar("--fold-text-letter-spacing", opts.letterSpacing == null ? null : String(opts.letterSpacing));
    setVar("--fold-crease-blend", opts.creaseBlend == null ? null : String(opts.creaseBlend));

    /* --- markup: accessible copy + aria-hidden folded copy --- */
    while (root.firstChild) root.removeChild(root.firstChild);

    var sr = doc.createElement("span");
    sr.className = "fold-text-sr-only";
    sr.textContent = text;
    root.appendChild(sr);

    var visual = buildVisual(doc, text, splitBy, hingeName, hingeConf.origin, safePerspective, !!opts.preserveWhitespace);
    root.appendChild(visual);

    var pieces = [];
    Array.prototype.forEach.call(visual.querySelectorAll(".fold-text-piece"), function (piece) {
      pieces.push(piece);
    });

    /* ---- 5. Timeline ----------------------------------------------------- */

    var mq = motionQuery();
    var reduce = !!(mq && mq.matches);
    var frame = 0;
    var lastTs = -1;            /* -1 = "no previous frame yet"                */
    var elapsed = 0;
    var wanted = false;         /* the animation should be progressing        */
    var looping = trigger === "loop";
    var scrollIo = null;
    var visibilityIo = null;
    var hoverHandler = null;
    var destroyed = false;

    function activeDuration() { return reduce ? Math.min(baseDuration, REDUCED_DURATION) : baseDuration; }
    function activeStagger() { return reduce ? Math.min(baseStagger, REDUCED_STAGGER) : baseStagger; }
    function activeExponent() { return reduce ? 1 : baseExponent; }
    function totalDuration() { return activeDuration() + Math.max(0, pieces.length - 1) * activeStagger(); }

    /* FROM: folded flat away from the viewer, crease at full strength.
       TO:   upright, opaque, crease gone. */
    function applyProgress(seconds) {
      var duration = activeDuration();
      var stagger = activeStagger();
      var exponent = activeExponent();
      for (var i = 0; i < pieces.length; i++) {
        var piece = pieces[i];
        var t = clamp((seconds - i * stagger) / duration, 0, 1);
        var p = t >= 1 ? 1 : easeOut(t, exponent);
        piece.style.opacity = String(round(p));
        if (reduce || p >= 1) {
          piece.style.transform = "";
        } else {
          piece.style.transform =
            "rotateX(" + round(hingeConf.rotateX * (1 - p)) + "deg) " +
            "rotateY(" + round(hingeConf.rotateY * (1 - p)) + "deg) translateZ(0)";
        }
        piece.style.setProperty("--fold-crease", String(reduce ? 0 : round(safeCrease * (1 - p))));
      }
    }

    function cancelFrame() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      lastTs = -1;
    }

    function requestFrame() {
      if (frame || !wanted || destroyed) return;
      lastTs = -1;
      frame = window.requestAnimationFrame(tick);
    }

    function finish() {
      wanted = false;
      cancelFrame();
      root.classList.remove("is-folding");
      applyProgress(totalDuration());
    }

    function tick(ts) {
      frame = 0;
      if (!wanted) return;
      if (lastTs < 0) lastTs = ts;
      var dt = (ts - lastTs) / 1000;
      lastTs = ts;
      if (!(dt > 0)) dt = 0;
      if (dt > 0.25) dt = 0.25;   /* a backgrounded tab must not jump the loop */
      elapsed += dt;

      var total = totalDuration();
      if (elapsed >= total) {
        if (!looping) { finish(); return; }
        applyProgress(total);
        if (elapsed >= total + repeatDelay) elapsed = 0;
      } else {
        applyProgress(elapsed);
      }
      frame = window.requestAnimationFrame(tick);
    }

    function play() {
      cancelFrame();
      elapsed = 0;
      wanted = true;
      applyProgress(0);
      root.classList.add("is-folding");
      requestFrame();
    }

    /* ---- 6. Triggers ----------------------------------------------------- */

    if (!window.requestAnimationFrame) {
      /* No rAF: render the settled state and stop. */
      reduce = true;
      applyProgress(1e6);
    } else if (reduce && looping) {
      /* Contract: no continuous motion under reduced motion. */
      applyProgress(1e6);
    } else if (trigger === "hover") {
      applyProgress(1e6);
      hoverHandler = function () { play(); };
      root.addEventListener("mouseenter", hoverHandler);
    } else if (trigger === "scroll") {
      applyProgress(0);
      if ("IntersectionObserver" in window) {
        scrollIo = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (!entries[i].isIntersecting) continue;
            if (scrollIo) { scrollIo.disconnect(); scrollIo = null; }
            play();
            return;
          }
        }, { rootMargin: SCROLL_ROOT_MARGIN, threshold: 0 });
        scrollIo.observe(root);
      } else {
        play();
      }
    } else {
      play();
      /* The loop must not burn CPU while the phrase is off-screen. */
      if (looping && "IntersectionObserver" in window) {
        visibilityIo = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting) requestFrame();
            else cancelFrame();
          }
        }, { threshold: 0 });
        visibilityIo.observe(root);
      }
    }

    /* ---- 7. Reduced-motion changes + teardown ---------------------------- */

    function onMotionChange() {
      var next = !!(mq && mq.matches);
      if (next === reduce) return;
      reduce = next;
      if (reduce) { looping = false; finish(); }
    }

    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", onMotionChange);
      else if (mq.addListener) mq.addListener(onMotionChange);
    }

    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      wanted = false;
      cancelFrame();
      if (scrollIo) { scrollIo.disconnect(); scrollIo = null; }
      if (visibilityIo) { visibilityIo.disconnect(); visibilityIo = null; }
      if (hoverHandler) { root.removeEventListener("mouseenter", hoverHandler); hoverHandler = null; }
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", onMotionChange);
        else if (mq.removeListener) mq.removeListener(onMotionChange);
      }
      root.classList.remove("fold-text");
      root.classList.remove("fold-text--pre");
      root.classList.remove("fold-text--block");
      root.classList.remove("is-folding");
      root.removeAttribute("data-fold-ground");
      root.removeAttribute("data-lphie-mounted");
      while (root.firstChild) root.removeChild(root.firstChild);
      root.textContent = originalText;
    };
  }

  window.LPHIE.components.foldText = mount;

  /* ---- 8. Auto-init ------------------------------------------------------ */

  function autoInit() {
    var nodes = document.querySelectorAll("[data-fold-text]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-fold-text");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
