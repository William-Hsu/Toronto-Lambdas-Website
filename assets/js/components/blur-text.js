/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   BlurText — vanilla port of the React Bits component of the same name.
   No dependencies (the motion is CSS keyframes, not a rAF timeline).
   Works from file:// as well as a web server.

   Mount:  <h2 data-blur-text='{}'>Rush is free</h2>
   or nothing at all — §9 also sweeps a conservative default selector list, so
   the mastheads and section headings need no per-element markup.

   Differences from the React original, all deliberate:
   — The reference is handed a `text` prop and renders a flex row of motion
     spans. Here the text already lives in the HTML, so this component walks
     the element's own child NODES and wraps words in place (§4). Nothing is
     rebuilt from a string: <em>, <br> and the site's runtime-filled spans
     keep their identity, so the accessible text and the authored line breaks
     survive. display:flex is NOT used — it would kill text wrapping and the
     inherited typography this site is built on. Pieces are inline-block
     inside the normal flow instead.
   — Travel, blur and stagger are all pulled back hard from the demo's values
     (50px / 10px / 200ms down to 10px / 6px / 90ms). This is a printed page;
     the intent is ink settling, not a scroll-reveal template.
   — It composes with, and never touches, main.js's own .reveal pass: no
     query for .reveal, no read or write of "is-in", no shared observer, and
     nothing at all set on the host's own opacity/transform/filter — only the
     generated piece spans move. An ancestor fade would compose with this
     rather than fight it.
   — When the reveal is over the split is UNDONE (§7), so the settled page is
     the authored DOM exactly, with no leftover inline-block, will-change or
     stacking contexts on ~30 elements per page.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Configuration -------------------------------------------------- */

  /* The reference's props keep their names. The four that carry the house
     restraint — delay, travel, overshoot, blurRadius — are quieter than the
     demo's; the guards (staggerCap, maxPieces, maxLetters, maxChars) have no
     counterpart in the reference and exist so this can run on every page. */
  var DEFAULTS = {
    delay: 90,             /* ms between pieces — reference is 200         */
    animateBy: "words",    /* "words" | "letters"                          */
    direction: "top",      /* "top" | "bottom"                             */
    threshold: 0.1,        /* IntersectionObserver threshold               */
    rootMargin: "0px",     /* IntersectionObserver rootMargin              */
    stepDuration: 0.35,    /* seconds per step; a piece runs 2 x this      */
    travel: 10,            /* px the piece arrives from — reference is 50  */
    overshoot: 2,          /* px it passes through at step 1 — ref is 5    */
    blurRadius: 6,         /* px of blur at rest — reference is 10         */
    easing: "ease-out",    /* keyword, or a cubic-bezier(...) string       */
    staggerCap: 420,       /* ms ceiling on the whole stagger, 0 = none    */
    maxPieces: 60,         /* past this the element animates as one unit   */
    maxLetters: 48,        /* past this "letters" degrades to "words"      */
    maxChars: 400,         /* longer than this and the element is skipped  */
    onEnd: null
  };

  /* The default sweep. Deliberately narrow: mastheads, the home title block
     and one heading per section, which is roughly one event per scroll-screen
     on a site whose style.css states that motion is intentionally absent from
     its body copy. .lede, .eyebrow and card headings are NOT in here — they
     are available by hand with data-blur-text, or by overriding this list. */
  var DEFAULT_TARGETS = [
    ".page-head__inner > h1",
    ".page-head__inner > p:not(.breadcrumb)",
    ".hero__school",
    ".hero__title",
    ".section h2:not([data-masked-heading])",
    ".cta-band h2"
  ];

  /* Anything below disqualifies a candidate whether it matches the element
     itself, one of its ancestors, or one of its descendants (§3). Three
     families are in here: hosts another component owns and rebuilds, hosts
     main.js overwrites at runtime, and prose whose typography or semantics a
     word split would damage. */
  var SKIP_SELECTOR = [
    /* Component-owned hosts and the markup they generate. */
    "[data-lphie-mounted]",
    "[data-fold-text]", "[data-masked-heading]", "[data-count-up]",
    "[data-accordion-gallery]", "[data-logo-loop]", "[data-drift-wall]",
    "[data-morph-slider]", "[data-depth-carousel]", "[data-gradual-blur]",
    "[data-border-glow]", "[data-blur-text]",
    ".fold-text", ".count-up__value", ".count-up__sr",
    ".masked-heading__measure", ".masked-heading__word",
    ".masked-heading__clip", ".masked-heading__media",
    ".accordion-gallery", ".ag-panel",
    ".logoloop__track", ".logoloop__list", ".logoloop__item",
    ".drift-wall", ".morph-slider", ".depth-carousel",
    ".gradual-blur", ".gradual-blur__layer", ".edge-light",
    /* main.js writes these wholesale, by id, on DOMContentLoaded. */
    "#site-header", "#site-footer", "#values-grid", "#alumni-grid",
    "#alumni-sectors", "#traditions-grid", "#faq-list", "#charter-list",
    "#families-grid", "#rush-schedule", "#gallery-grid", "#reveal-list",
    "#instagram-embed", "#form-note", "#roster-grid", "#exec-grid",
    "[data-fill]",
    /* Prose and chrome a split would spoil. */
    ".breadcrumb", ".skip", ".dropcap", ".ornament", ".hero__sub",
    ".callout", ".timeline", ".tag", ".btn", ".field__hint",
    ".card__num", ".card__icon", ".stat__value", ".stat__label",
    ".footer-letters", ".nav__letters", ".timeline__year",
    ".brother__name", ".brother__meta", ".class-heading",
    /* Structures whose intrinsic sizing or semantics inline-blocks disturb. */
    "form", "table", "thead", "tbody", "tr", "th", "td",
    "details", "summary", "code", "pre", "label", "button",
    "input", "select", "textarea", "a", "svg", "canvas", "iframe", "video"
  ].join(",");

  /* Inline elements safe to step INSIDE of: the element node itself, its
     attributes and its place in the tree are left exactly as authored, and
     only the text nodes hanging off it are split. Everything else in a
     subtree — <a>, <code>, a component host — disqualifies the whole
     element in §3, so the walker never has to make that judgement. */
  var RECURSE = {
    EM: 1, I: 1, STRONG: 1, B: 1, SPAN: 1, SMALL: 1, SUP: 1, SUB: 1,
    U: 1, S: 1, ABBR: 1, CITE: 1, Q: 1, MARK: 1, VAR: 1, TIME: 1,
    BDI: 1, BDO: 1, INS: 1, DEL: 1
  };

  var DIRECTIONS = { top: 1, bottom: 1 };
  var SPLITS = { words: 1, letters: 1 };
  var EASINGS = { ease: 1, "ease-in": 1, "ease-out": 1, "ease-in-out": 1, linear: 1 };
  var BEZIER_RE = /^cubic-bezier\(\s*[-0-9.,\s]+\)$/;

  /* Slack on the settle timer so the last piece has certainly painted its
     final frame before the split is undone. */
  var SETTLE_SLACK = 120;

  /* ---- 2. Helpers -------------------------------------------------------- */

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function num(value, fallback) {
    var n = parseFloat(value);
    return isFinite(n) ? n : fallback;
  }

  function round(value) { return Math.round(value * 10) / 10; }

  function assign(target, source) {
    if (!source) return target;
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
    }
    return target;
  }

  function motionQuery() {
    return window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  }

  /* Split into characters without tearing surrogate pairs apart. */
  function toChars(text) {
    return text.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g) || [];
  }

  /* Element.matches has three spellings still in the wild, and an unknown
     selector token throws rather than returning false — both are handled
     here so one bad entry in SKIP_SELECTOR can never take the page down. */
  function matches(el, selector) {
    if (!el || el.nodeType !== 1) return false;
    var fn = el.matches || el.msMatchesSelector || el.webkitMatchesSelector;
    if (!fn) return false;
    try { return !!fn.call(el, selector); } catch (e) { return false; }
  }

  function hasAncestor(el, selector) {
    var node = el.parentNode;
    while (node && node.nodeType === 1) {
      if (matches(node, selector)) return true;
      node = node.parentNode;
    }
    return false;
  }

  function hasDescendant(el, selector) {
    if (!el.querySelector) return false;
    try { return !!el.querySelector(selector); } catch (e) { return false; }
  }

  /* ---- 3. Eligibility ---------------------------------------------------- */

  /* A child element is only walkable when it is inert markup: no id and no
     data-* attribute, because both are how main.js and every sibling
     component address the nodes they own and overwrite. */
  function inertElement(el) {
    if (el.id) return false;
    var attrs = el.attributes;
    if (!attrs) return true;
    for (var i = 0; i < attrs.length; i++) {
      if (attrs[i].name.indexOf("data-") === 0) return false;
    }
    return true;
  }

  /* Every element in the subtree must be a <br> we can step over, or an
     inert inline element we can step into. One unexpected node — an <a>, a
     <code>, a component host another agent adds next week — and the whole
     candidate is abandoned untouched. */
  function walkableSubtree(node) {
    var child = node.firstChild;
    while (child) {
      if (child.nodeType === 1) {
        if (child.nodeName !== "BR") {
          if (!RECURSE[child.nodeName]) return false;
          if (!inertElement(child)) return false;
          if (!walkableSubtree(child)) return false;
        }
      }
      child = child.nextSibling;
    }
    return true;
  }

  /* The single gate. Run again inside mount() on every element, however it
     was selected, so a hand-written data-blur-text is held to exactly the
     same standard as the default sweep. */
  function eligible(root, maxChars) {
    if (!root || root.nodeType !== 1) return false;
    /* An id is how main.js finds its render targets, so an element that has
       one is never split — even when the id looks harmless today. */
    if (root.id) return false;
    if (matches(root, SKIP_SELECTOR)) return false;
    if (hasAncestor(root, SKIP_SELECTOR)) return false;
    if (hasDescendant(root, SKIP_SELECTOR)) return false;
    if (!walkableSubtree(root)) return false;
    var text = root.textContent || "";
    if (!/\S/.test(text)) return false;
    if (text.length > maxChars) return false;
    return true;
  }

  /* ---- 4. The text-node walker ------------------------------------------- */

  /* THE ONE RULE: innerHTML is never read or written, and no element is ever
     created around, moved past or rebuilt from an existing element. Only
     Text nodes are replaced, and each is replaced by exactly the words it
     contained plus the exact whitespace runs that separated them, so the
     line still wraps, collapses and hyphenates the way the authored markup
     did. `records` remembers every substitution so §7 can put the original
     Text nodes back verbatim. */
  function splitText(doc, textNode, state) {
    var raw = textNode.nodeValue;
    var parent = textNode.parentNode;
    if (!parent) return true;
    /* A run of pure whitespace between two elements carries line-breaking
       information and no words — it is left completely alone. */
    if (!raw || !/\S/.test(raw)) return true;

    var parts = raw.split(/(\s+)/);
    var inserted = [];
    var i, j, part, span, group, chars;

    for (i = 0; i < parts.length; i++) {
      part = parts[i];
      if (!part) continue;

      if (/^\s+$/.test(part)) {
        inserted.push(doc.createTextNode(part));
        continue;
      }

      if (state.letters) {
        /* The word still gets a box of its own so it cannot break across
           lines mid-word; the characters inside it are the pieces. */
        group = doc.createElement("span");
        group.className = "blur-text__word blur-text__group";
        chars = toChars(part);
        for (j = 0; j < chars.length; j++) {
          span = doc.createElement("span");
          span.className = "blur-text__char blur-text__piece";
          span.textContent = chars[j];
          group.appendChild(span);
          state.pieces.push(span);
          if (state.pieces.length > state.maxPieces) return false;
        }
        inserted.push(group);
        continue;
      }

      span = doc.createElement("span");
      span.className = "blur-text__word blur-text__piece";
      span.textContent = part;
      state.pieces.push(span);
      inserted.push(span);
      if (state.pieces.length > state.maxPieces) return false;
    }

    if (!inserted.length) return true;

    var frag = doc.createDocumentFragment();
    for (i = 0; i < inserted.length; i++) frag.appendChild(inserted[i]);
    parent.replaceChild(frag, textNode);
    state.records.push({ parent: parent, nodes: inserted, text: raw });
    return true;
  }

  function splitNode(doc, node, state) {
    var child = node.firstChild;
    var next;
    while (child) {
      /* Held before the split, because replaceChild detaches `child`. */
      next = child.nextSibling;
      if (child.nodeType === 3) {
        if (!splitText(doc, child, state)) return false;
      } else if (child.nodeType === 1 && child.nodeName !== "BR" && RECURSE[child.nodeName]) {
        if (!splitNode(doc, child, state)) return false;
      }
      child = next;
    }
    return true;
  }

  /* Put every replaced Text node back exactly as it was, in reverse order so
     no record's anchor has been removed by an earlier one. */
  function restoreRecords(doc, records) {
    var i, j, rec, first, node;
    for (i = records.length - 1; i >= 0; i--) {
      rec = records[i];
      first = rec.nodes[0];
      if (!first || first.parentNode !== rec.parent) continue;
      rec.parent.insertBefore(doc.createTextNode(rec.text), first);
      for (j = 0; j < rec.nodes.length; j++) {
        node = rec.nodes[j];
        if (node.parentNode === rec.parent) rec.parent.removeChild(node);
      }
    }
    records.length = 0;
  }

  /* ---- 5. Mount ---------------------------------------------------------- */

  function mount(root, options) {
    function noop() {}
    if (!root || root.nodeType !== 1) return noop;

    var opts = assign(assign({}, DEFAULTS), options);
    var doc = root.ownerDocument || document;

    var mq = motionQuery();
    /* Contract: under reduced motion there is no split and no animation at
       all. The DOM is never touched and the text was visible the whole time,
       so there is nothing to undo and nothing to observe. */
    if (mq && mq.matches) return noop;

    var maxChars = Math.max(1, num(opts.maxChars, DEFAULTS.maxChars));
    if (!eligible(root, maxChars)) return noop;

    /* --- resolved settings --- */
    var direction = DIRECTIONS[opts.direction] ? opts.direction : "top";
    var animateBy = SPLITS[opts.animateBy] ? opts.animateBy : "words";
    var easing = (EASINGS[opts.easing] || BEZIER_RE.test(String(opts.easing)))
      ? String(opts.easing)
      : DEFAULTS.easing;
    var step = Math.max(0.05, num(opts.stepDuration, DEFAULTS.stepDuration));
    var travel = Math.max(0, num(opts.travel, DEFAULTS.travel));
    var overshoot = Math.max(0, num(opts.overshoot, DEFAULTS.overshoot));
    var blurRadius = Math.max(0, num(opts.blurRadius, DEFAULTS.blurRadius));
    var staggerCap = Math.max(0, num(opts.staggerCap, DEFAULTS.staggerCap));
    var maxPieces = Math.max(1, Math.floor(num(opts.maxPieces, DEFAULTS.maxPieces)));
    var maxLetters = Math.max(1, Math.floor(num(opts.maxLetters, DEFAULTS.maxLetters)));
    var threshold = clamp(num(opts.threshold, DEFAULTS.threshold), 0, 1);
    var rootMargin = opts.rootMargin == null ? DEFAULTS.rootMargin : String(opts.rootMargin);
    var delay = Math.max(0, num(opts.delay, DEFAULTS.delay));

    /* A long run of body copy is never spelled out letter by letter — that is
       where the DOM explodes and where the effect stops being restrained. */
    var textLength = (root.textContent || "").replace(/\s+/g, " ").length;
    if (animateBy === "letters" && textLength > maxLetters) animateBy = "words";

    /* --- 5a. Split -------------------------------------------------------- */
    var state = {
      letters: animateBy === "letters",
      pieces: [],
      records: [],
      maxPieces: maxPieces
    };

    var unitNode = null;
    var ok = splitNode(doc, root, state);

    if (!ok || !state.pieces.length) {
      /* Over the cap, or nothing splittable. Undo whatever was done and fall
         back to moving the element's contents as a single block piece — the
         children are only re-parented, never rebuilt, so <br> and every
         inline element still work. */
      restoreRecords(doc, state.records);
      state.pieces.length = 0;
      if (!/\S/.test(root.textContent || "")) return noop;
      unitNode = doc.createElement("span");
      unitNode.className = "blur-text__unit blur-text__piece";
      while (root.firstChild) unitNode.appendChild(root.firstChild);
      root.appendChild(unitNode);
      state.pieces.push(unitNode);
    }

    var pieces = state.pieces;
    var count = pieces.length;

    /* The whole stagger is capped, so a long lede's last word does not land
       after the reader has already finished reading it. */
    if (count > 1 && staggerCap > 0 && delay * (count - 1) > staggerCap) {
      delay = staggerCap / (count - 1);
    }

    var totalMs = (count > 1 ? delay * (count - 1) : 0) + step * 2000;

    /* --- 5b. Arm ---------------------------------------------------------- */
    /* Nothing here writes opacity, transform or filter onto the host: only
       the generated pieces move, so style.css's `.reveal { opacity: 1 }` can
       never be in a cascade fight with this, and a future .reveal fade on an
       ancestor would compose with it instead. */
    var y0 = (direction === "bottom" ? travel : -travel) + "px";
    var y1 = (direction === "bottom" ? -overshoot : overshoot) + "px";

    root.style.setProperty("--bt-blur", blurRadius + "px");
    root.style.setProperty("--bt-blur-mid", round(blurRadius / 2) + "px");
    root.style.setProperty("--bt-y0", y0);
    root.style.setProperty("--bt-y1", y1);
    root.style.setProperty("--bt-step", step + "s");
    root.style.setProperty("--bt-ease", easing);

    root.classList.add("blur-text");
    root.classList.add("blur-text--armed");
    if (state.letters) {
      root.classList.add("blur-text--letters");
      /* Per-character spans can make a screen reader spell the word out, so
         the finished string is pinned as the accessible name for the second
         or so that the split exists. §7 takes it off again. */
      root.setAttribute("aria-label", (root.textContent || "").replace(/\s+/g, " "));
    }

    for (var i = 0; i < count; i++) {
      pieces[i].style.animationDelay = round(i * delay) + "ms";
    }

    /* ---- 6. Timeline ----------------------------------------------------- */

    var io = null;
    var timer = 0;
    var played = false;
    var settled = false;
    var destroyed = false;

    function play() {
      if (played || settled || destroyed) return;
      played = true;
      if (io) { io.disconnect(); io = null; }
      root.classList.add("is-revealing");
      timer = window.setTimeout(settle, totalMs + SETTLE_SLACK);
    }

    /* ---- 7. Settle: undo the split --------------------------------------- */

    /* Dropping the classes first snaps every piece to its finished state in
       the same frame the spans are unwrapped, so there is no flash between
       the two — and what is left afterwards is the authored DOM, with no
       inline-block, will-change or filter stacking context anywhere. */
    function settle() {
      if (timer) { window.clearTimeout(timer); timer = 0; }
      if (settled) return;
      settled = true;
      root.classList.remove("is-revealing");
      root.classList.remove("blur-text--armed");
      root.classList.remove("blur-text--letters");
      root.classList.remove("blur-text");
      root.removeAttribute("aria-label");
      root.style.removeProperty("--bt-blur");
      root.style.removeProperty("--bt-blur-mid");
      root.style.removeProperty("--bt-y0");
      root.style.removeProperty("--bt-y1");
      root.style.removeProperty("--bt-step");
      root.style.removeProperty("--bt-ease");
      if (root.getAttribute("style") === "") root.removeAttribute("style");
      if (unitNode && unitNode.parentNode === root) {
        while (unitNode.firstChild) root.insertBefore(unitNode.firstChild, unitNode);
        root.removeChild(unitNode);
        unitNode = null;
      }
      restoreRecords(doc, state.records);
      pieces.length = 0;
      if (typeof opts.onEnd === "function") opts.onEnd();
    }

    /* ---- 8. Trigger, reduced-motion changes, teardown -------------------- */

    /* One private observer per element, one-shot and unobserved on fire —
       the same contract main.js's .reveal pass uses, deliberately, so the
       page settles once and stops rather than re-firing on every scroll.
       It is never main.js's observer and it never reads or writes "is-in". */
    if (!("IntersectionObserver" in window)) {
      play();
    } else {
      try {
        io = new IntersectionObserver(function (entries) {
          for (var e = 0; e < entries.length; e++) {
            if (entries[e].isIntersecting) { play(); return; }
          }
        }, { rootMargin: rootMargin, threshold: threshold });
      } catch (err) {
        io = null;
      }
      if (io) io.observe(root);
      else play();
    }

    /* Motion can be switched off mid-reveal — settle outright rather than
       leave a half-played frame on the page. */
    function onMotionChange() {
      if (mq && mq.matches && !settled && !destroyed) {
        if (io) { io.disconnect(); io = null; }
        settle();
      }
    }

    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", onMotionChange);
      else if (mq.addListener) mq.addListener(onMotionChange);
    }

    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (timer) { window.clearTimeout(timer); timer = 0; }
      if (io) { io.disconnect(); io = null; }
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", onMotionChange);
        else if (mq.removeListener) mq.removeListener(onMotionChange);
      }
      /* settle() is what puts the original Text nodes back, so teardown at
         any point in the timeline restores the element exactly. */
      settle();
      root.removeAttribute("data-lphie-mounted");
    };
  }

  window.LPHIE.components.blurText = mount;

  /* ---- 9. Auto-init ------------------------------------------------------ */

  /* The default sweep is overridable without touching this file, either with
     window.LPHIE.blurTextTargets (array or comma string, [] to switch the
     sweep off) or with <html data-blur-text-targets="h2, .lede">. Shared
     options for the sweep go in window.LPHIE.blurText. */
  function targetList() {
    var el = document.documentElement;
    var attr = el ? el.getAttribute("data-blur-text-targets") : null;
    var configured = window.LPHIE.blurTextTargets;
    var raw = attr != null ? attr : configured;
    if (raw == null) return DEFAULT_TARGETS;
    if (typeof raw === "string") {
      if (!/\S/.test(raw)) return [];
      return raw.split(",");
    }
    if (Object.prototype.toString.call(raw) === "[object Array]") return raw;
    return DEFAULT_TARGETS;
  }

  function mountNode(node, opts) {
    if (node.getAttribute("data-lphie-mounted")) return;
    node.setAttribute("data-lphie-mounted", "1");
    mount(node, opts);
  }

  function autoInit() {
    /* Nothing is claimed at all under reduced motion, so no element ever
       carries a mount flag it did not earn. */
    var mq = motionQuery();
    if (mq && mq.matches) return;

    var explicit = document.querySelectorAll("[data-blur-text]");
    Array.prototype.forEach.call(explicit, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-blur-text");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });

    var shared = window.LPHIE.blurText || null;
    var selectors = targetList();
    for (var i = 0; i < selectors.length; i++) {
      var selector = selectors[i];
      if (!selector || !/\S/.test(selector)) continue;
      var nodes;
      try { nodes = document.querySelectorAll(selector); } catch (e) { continue; }
      Array.prototype.forEach.call(nodes, function (node) { mountNode(node, shared); });
    }
  }

  /* NB: every candidate is read inside autoInit, never at module-evaluation
     time, and the exclusion gate in §3 assumes the page has finished being
     assembled. This script tag MUST come after assets/js/main.js AND after
     every other component, so the subtrees they rebuild already exist. */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
