/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   BlurText — vanilla port of the React Bits component of the same name.
   No dependencies (the motion is CSS keyframes, not a rAF timeline).
   Works from file:// as well as a web server.

   Mount:  <h2 data-blur-text='{}'>Rush is free</h2>

   OPT-IN ONLY. There is no default sweep: this component touches exactly the
   elements an author has marked with data-blur-text, the same contract every
   other component in this folder keeps. An earlier draft swept a selector
   list (.section h2, .hero__title, …) and that was wrong three ways — it
   re-enabled hidden-until-scroll body content on a site whose style.css says
   in as many words that "motion is intentionally absent"; it revealed only
   the two middle elements of the seven stacked in .hero__inner, so the
   masthead read as a hole rather than as a block; and it laid the shared
   data-lphie-mounted claim across ~40 headings per site, including ones it
   then declined to animate. A sweep is still available deliberately, per
   page, via window.LPHIE.blurTextTargets or <html data-blur-text-targets>
   (§9); SUGGESTED_TARGETS below is the vetted list to start from.

   Differences from the React original, all deliberate:
   — The reference is handed a `text` prop and renders a flex row of motion
     spans. Here the text already lives in the HTML, so this component walks
     the element's own child NODES and wraps words in place (§4). Nothing is
     rebuilt from a string: <em>, <br> and the site's runtime-filled spans
     keep their identity, so the accessible text and the authored line breaks
     survive. display:flex is NOT used — it would kill text wrapping and the
     inherited typography this site is built on. Pieces are inline-block
     inside the normal flow instead.
   — animateBy:"letters" is accepted and DEGRADED TO WORDS. A per-character
     split makes every glyph its own shaping run, which throws away exactly
     what style.css:197 turns on — EB Garamond's kern pairs and its fi/fl/ffi
     ligatures — and then re-shapes the line when the split is undone, so the
     heading visibly changes width after it has finished animating. The
     mitigations a letters mode needs (an aria-label so a screen reader does
     not spell the word out) are themselves unsound here: the label is built
     from textContent, which drops <br>, and two plausible hosts are <p>,
     whose role prohibits an accessible name. Kerning and the accessible name
     are worth more to this site than a per-letter reveal, so there is no
     letters mode and NOTHING in this file reads or writes aria-label.
   — Travel, blur and stagger are all pulled back hard from the demo's values
     (50px / 10px / 200ms down to 10px / 6px / 70ms), and the whole reveal is
     held under ~0.85s so a heading is fully inked while it is still on
     screen for a reader who is scrolling at speed.
   — An element that is ALREADY ON SCREEN when the script runs is left alone
     (§5). The site's scripts are non-deferred tags at the end of <body>, so
     the document above them is laid out and paintable before they execute;
     arming a painted element would draw it, blank it, and re-draw it. Off
     the bottom of the viewport there is nothing painted to flash, which is
     the only place this effect is honest. Pass requireOffscreen:false to
     override, with that flash as the price.
   — It composes with, and never touches, main.js's own .reveal pass: no
     query for .reveal, no read or write of "is-in", no shared observer, and
     nothing at all set on the host's own opacity/transform/filter — only the
     generated piece spans move. An ancestor fade would compose with this
     rather than fight it.
   — When the reveal is over the split is UNDONE and the shared mount claim is
     RELEASED (§7), so the settled page is the authored DOM exactly: no
     leftover inline-block, will-change, stacking context or attribute, and
     any component that wants the element afterwards can have it.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Configuration -------------------------------------------------- */

  /* The reference's props keep their names. The four that carry the house
     restraint — delay, travel, overshoot, blurRadius — are quieter than the
     demo's; the guards (staggerCap, maxPieces, maxChars, requireOffscreen)
     have no counterpart in the reference and exist so this can be pointed at
     anything on the site without a surprise. */
  var DEFAULTS = {
    delay: 70,             /* ms between pieces — reference is 200          */
    animateBy: "words",    /* "words"; "letters" is accepted and degraded   */
    direction: "top",      /* "top" | "bottom"                              */
    threshold: 0,          /* IntersectionObserver threshold — any pixel    */
    rootMargin: "0px 0px 12% 0px", /* start just BEFORE the element enters  */
    stepDuration: 0.3,     /* seconds per step; a piece runs 2 x this       */
    travel: 10,            /* px the piece arrives from — reference is 50   */
    overshoot: 2,          /* px it passes through at step 1 — ref is 5     */
    blurRadius: 6,         /* px of blur at rest — reference is 10          */
    easing: "ease-out",    /* keyword, or a cubic-bezier(...) string        */
    staggerCap: 240,       /* ms ceiling on the whole stagger, 0 = none     */
    maxPieces: 60,         /* past this the element animates as one unit    */
    maxChars: 400,         /* longer than this and the element is skipped   */
    requireOffscreen: true,/* never arm something already painted on screen */
    onEnd: null
  };

  /* No sweep by default. See the header: this component animates the
     elements an author marked, and nothing else. */
  var DEFAULT_TARGETS = [];

  /* The vetted list, for a page that wants a sweep on purpose. Each entry is
     a self-contained block — one heading that stands alone — so a sweep can
     never leave half of a stacked group inked and the other half blank. The
     hero is deliberately absent: only two of its seven stacked elements are
     even eligible (.hero__sub holds a component host, .ornament is
     decorative, the buttons are <a>, the band is [data-count-up]), so a hero
     reveal is a hole by construction. Published on the mount function as
     .suggestedTargets:
         window.LPHIE.blurTextTargets =
           window.LPHIE.components.blurText.suggestedTargets; */
  var SUGGESTED_TARGETS = [
    ".section h2:not([data-masked-heading])",
    ".cta-band h2"
  ];

  /* The shared, cross-component ownership flag. Every sibling in this folder
     reads it and bails on seeing it, so it is a claim and not a note: this
     file stamps it only on an element it has actually taken (§5, AFTER every
     eligibility test), and takes it off again the moment the element is
     handed back (§7). */
  var CLAIM = "data-lphie-mounted";

  /* Anything below disqualifies a candidate whether it matches the element
     itself, one of its ancestors, or one of its descendants (§3). Three
     families are in here: hosts another component owns and rebuilds, hosts
     main.js overwrites at runtime, and prose whose typography or semantics a
     word split would damage. */
  var SKIP_SELECTOR = [
    /* Component-owned hosts and the markup they generate. */
    "[data-fold-text]", "[data-masked-heading]", "[data-count-up]",
    "[data-accordion-gallery]", "[data-logo-loop]", "[data-drift-wall]",
    "[data-morph-slider]", "[data-depth-carousel]", "[data-gradual-blur]",
    "[data-border-glow]", "[data-strands]",
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

  /* This component's own two attributes are held apart from the list above.
     The candidate itself carries data-blur-text (it is the opt-in), and §5
     stamps CLAIM on it before the split — so neither may disqualify the very
     element being mounted; the element's own claim is tested once, directly,
     at the top of mount(). On an ANCESTOR or a DESCENDANT either one means
     the subtree already belongs to somebody, and the candidate is abandoned. */
  var SKIP_OWNED = "[" + CLAIM + "],[data-blur-text]";
  var SKIP_AROUND = SKIP_SELECTOR + "," + SKIP_OWNED;

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
  var EASINGS = { ease: 1, "ease-in": 1, "ease-out": 1, "ease-in-out": 1, linear: 1 };
  var BEZIER_RE = /^cubic-bezier\(\s*[-0-9.,\s]+\)$/;

  /* Slack on the settle timer so the last piece has certainly painted its
     final frame before the split is undone. */
  var SETTLE_SLACK = 120;

  /* An observer that never reports is the one way armed text could stay
     hidden. IntersectionObserver delivers an initial callback within a frame
     or two of observe(), for elements off screen as much as on, so silence
     past this mark means the mechanism is broken — settle immediately and
     leave plain, readable text behind. */
  var OBSERVER_PROBE_MS = 1500;

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

  /* Is any part of this element inside the viewport right now? An element
     with no box at all (display:none, or a subtree not yet laid out) counts
     as off screen: there is nothing painted, so there is nothing to flash. */
  function onScreen(el) {
    if (!el.getBoundingClientRect) return false;
    var vh = window.innerHeight ||
      (document.documentElement && document.documentElement.clientHeight) || 0;
    var vw = window.innerWidth ||
      (document.documentElement && document.documentElement.clientWidth) || 0;
    if (!vh || !vw) return false;
    var r;
    try { r = el.getBoundingClientRect(); } catch (e) { return false; }
    if (!r || (!r.width && !r.height)) return false;
    return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
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

  /* The single gate, run inside mount() on every element however it was
     selected, so a hand-written data-blur-text is held to exactly the same
     standard as a configured sweep. Nothing outside mount() decides. */
  function eligible(root, maxChars) {
    if (!root || root.nodeType !== 1) return false;
    /* Already claimed by a sibling component — or by an earlier pass of this
       one. Tested here rather than through SKIP_AROUND because SKIP_AROUND is
       about the neighbourhood, and this is about the element itself. */
    if (root.getAttribute(CLAIM)) return false;
    /* An id is how main.js finds its render targets, so an element that has
       one is never split — even when the id looks harmless today. */
    if (root.id) return false;
    if (matches(root, SKIP_SELECTOR)) return false;
    if (hasAncestor(root, SKIP_AROUND)) return false;
    if (hasDescendant(root, SKIP_AROUND)) return false;
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
     did — and so the text still copies and pastes as one string. `records`
     remembers every substitution so §7 can put the original Text nodes back
     verbatim. Words, never characters: see the header on kerning. */
  function splitText(doc, textNode, state) {
    var raw = textNode.nodeValue;
    var parent = textNode.parentNode;
    if (!parent) return true;
    /* A run of pure whitespace between two elements carries line-breaking
       information and no words — it is left completely alone. */
    if (!raw || !/\S/.test(raw)) return true;

    var parts = raw.split(/(\s+)/);
    var inserted = [];
    var i, part, span;

    for (i = 0; i < parts.length; i++) {
      part = parts[i];
      if (!part) continue;

      if (/^\s+$/.test(part)) {
        inserted.push(doc.createTextNode(part));
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
    /* Contract: under reduced motion there is no split, no claim and no
       animation at all. The DOM is never touched and the text was visible the
       whole time, so there is nothing to undo and nothing to observe. */
    if (mq && mq.matches) return noop;

    var maxChars = Math.max(1, num(opts.maxChars, DEFAULTS.maxChars));
    if (!eligible(root, maxChars)) return noop;

    /* The no-flash rule. Everything above the fold has already been laid out
       and very likely painted by the time these end-of-body scripts run, so
       arming it would blank text the reader is looking at. */
    if (opts.requireOffscreen !== false && onScreen(root)) return noop;

    /* --- 5a. Claim -------------------------------------------------------- */
    /* Past this line the element is ours, and every exit below — settle,
       teardown, or the one remaining bail — goes through release(). */
    var claimed = true;
    root.setAttribute(CLAIM, "1");
    function release() {
      if (!claimed) return;
      claimed = false;
      root.removeAttribute(CLAIM);
    }

    /* --- resolved settings --- */
    var direction = DIRECTIONS[opts.direction] ? opts.direction : "top";
    var easing = (EASINGS[opts.easing] || BEZIER_RE.test(String(opts.easing)))
      ? String(opts.easing)
      : DEFAULTS.easing;
    var step = Math.max(0.05, num(opts.stepDuration, DEFAULTS.stepDuration));
    var travel = Math.max(0, num(opts.travel, DEFAULTS.travel));
    var overshoot = Math.max(0, num(opts.overshoot, DEFAULTS.overshoot));
    var blurRadius = Math.max(0, num(opts.blurRadius, DEFAULTS.blurRadius));
    var staggerCap = Math.max(0, num(opts.staggerCap, DEFAULTS.staggerCap));
    var maxPieces = Math.max(1, Math.floor(num(opts.maxPieces, DEFAULTS.maxPieces)));
    var threshold = clamp(num(opts.threshold, DEFAULTS.threshold), 0, 1);
    var rootMargin = opts.rootMargin == null ? DEFAULTS.rootMargin : String(opts.rootMargin);
    var delay = Math.max(0, num(opts.delay, DEFAULTS.delay));

    /* --- 5b. Split -------------------------------------------------------- */
    var state = { pieces: [], records: [], maxPieces: maxPieces };

    var unitNode = null;
    var ok = splitNode(doc, root, state);

    if (!ok || !state.pieces.length) {
      /* Over the cap, or nothing splittable. Undo whatever was done and fall
         back to moving the element's contents as a single block piece — the
         children are only re-parented, never rebuilt, so <br> and every
         inline element still work. */
      restoreRecords(doc, state.records);
      state.pieces.length = 0;
      if (!/\S/.test(root.textContent || "")) { release(); return noop; }
      unitNode = doc.createElement("span");
      unitNode.className = "blur-text__unit blur-text__piece";
      while (root.firstChild) unitNode.appendChild(root.firstChild);
      root.appendChild(unitNode);
      state.pieces.push(unitNode);
    }

    var pieces = state.pieces;
    var count = pieces.length;

    /* The whole stagger is capped, so the last word of a long heading does
       not land after a reader scrolling at speed has already carried it off
       the top of the screen. Cap plus step keeps every reveal under ~0.85s. */
    if (count > 1 && staggerCap > 0 && delay * (count - 1) > staggerCap) {
      delay = staggerCap / (count - 1);
    }

    var totalMs = (count > 1 ? delay * (count - 1) : 0) + step * 2000;

    /* --- 5c. Arm ---------------------------------------------------------- */
    /* Nothing here writes opacity, transform or filter onto the host: only
       the generated pieces move, so style.css's `.reveal { opacity: 1 }` can
       never be in a cascade fight with this, and a future .reveal fade on an
       ancestor would compose with it instead. Nothing here writes aria-label
       either — see the header. */
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

    for (var i = 0; i < count; i++) {
      pieces[i].style.animationDelay = round(i * delay) + "ms";
    }

    /* ---- 6. Timeline ----------------------------------------------------- */

    var io = null;
    var timer = 0;
    var probe = 0;
    var sawObserver = false;
    var played = false;
    var settled = false;
    var destroyed = false;

    function play() {
      if (played || settled || destroyed) return;
      played = true;
      root.classList.add("is-revealing");
      timer = window.setTimeout(settle, totalMs + SETTLE_SLACK);
    }

    /* ---- 7. Settle: undo the split, hand the element back ---------------- */

    /* Dropping the classes first snaps every piece to its finished state in
       the same frame the spans are unwrapped, so there is no flash between
       the two — and what is left afterwards is the authored DOM: no
       inline-block, no will-change, no filter stacking context, no inline
       custom properties, and no mount claim. */
    function settle() {
      if (timer) { window.clearTimeout(timer); timer = 0; }
      if (probe) { window.clearTimeout(probe); probe = 0; }
      if (settled) return;
      settled = true;
      if (io) { io.disconnect(); io = null; }
      unhookMotion();
      root.classList.remove("is-revealing");
      root.classList.remove("blur-text--armed");
      root.classList.remove("blur-text");
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
      /* The element is authored markup again, so the claim is over: any
         component mounted after this point gets a clean element. */
      release();
      if (typeof opts.onEnd === "function") opts.onEnd();
    }

    /* ---- 8. Trigger, reduced-motion changes, teardown -------------------- */

    /* One private observer per element. It is never main.js's observer and it
       never reads or writes "is-in". Unlike main.js's .reveal pass it stays
       connected until the reveal is over, for the one case that matters on a
       phone: a reader flicking past at speed. Entering starts the reveal;
       leaving again before it has finished means there is no longer anyone
       watching it, so the split is undone at once and the heading is plain
       readable text the moment they scroll back. */
    function onIntersect(entries) {
      sawObserver = true;
      var last = entries && entries.length ? entries[entries.length - 1] : null;
      if (!last) return;
      if (last.isIntersecting) { play(); return; }
      if (played && !settled) settle();
    }

    if (!("IntersectionObserver" in window)) {
      play();
    } else {
      try {
        io = new IntersectionObserver(onIntersect, { rootMargin: rootMargin, threshold: threshold });
      } catch (err) {
        io = null;
      }
      if (io) {
        io.observe(root);
        /* Armed text is hidden text. If the observer never reports, put the
           words back rather than leave a blank heading on the page. */
        probe = window.setTimeout(function () {
          probe = 0;
          if (!sawObserver && !played && !settled) settle();
        }, OBSERVER_PROBE_MS);
      } else {
        play();
      }
    }

    /* Motion can be switched off mid-reveal — settle outright rather than
       leave a half-played frame on the page. */
    function onMotionChange() {
      if (mq && mq.matches && !settled) settle();
    }

    function unhookMotion() {
      if (!mq) return;
      if (mq.removeEventListener) mq.removeEventListener("change", onMotionChange);
      else if (mq.removeListener) mq.removeListener(onMotionChange);
    }

    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", onMotionChange);
      else if (mq.addListener) mq.addListener(onMotionChange);
    }

    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      /* settle() clears the timers, disconnects the observer, unhooks the
         media query, puts the original Text nodes back and releases the
         claim — so teardown at any point in the timeline restores the
         element exactly. */
      settle();
    };
  }

  mount.suggestedTargets = SUGGESTED_TARGETS;
  window.LPHIE.components.blurText = mount;

  /* ---- 9. Auto-init ------------------------------------------------------ */

  /* Every element mounted here keeps its teardown handle, so destroy() is
     reachable: window.LPHIE.components.blurText.destroyAll() puts every
     element back at once. */
  var handles = [];

  mount.destroyAll = function () {
    while (handles.length) {
      var fn = handles.pop();
      try { fn(); } catch (e) {}
    }
  };

  /* There is no sweep unless a page asks for one, either with
     window.LPHIE.blurTextTargets (array or comma string) or with
     <html data-blur-text-targets="h2, .lede">. Shared options for the sweep
     go in window.LPHIE.blurText. */
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

  /* mount() alone decides whether an element is taken, and stamps the shared
     claim itself if it is — so this may be called on anything, twice, in any
     order, and nothing is marked that was not actually mounted. */
  function mountNode(node, opts) {
    var destroy = mount(node, opts);
    /* A handle is only worth keeping for an element mount() actually took,
       and the claim it stamps is the honest signal that it did. */
    if (destroy && node.getAttribute(CLAIM)) handles.push(destroy);
  }

  function autoInit() {
    /* Nothing is claimed at all under reduced motion. */
    var mq = motionQuery();
    if (mq && mq.matches) return;

    var explicit = document.querySelectorAll("[data-blur-text]");
    Array.prototype.forEach.call(explicit, function (node) {
      var raw = node.getAttribute("data-blur-text");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mountNode(node, opts);
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

  /* Every candidate is read inside autoInit, never at module-evaluation
     time, and the exclusion gate in §3 assumes the page has finished being
     assembled. Script ORDER is therefore not left to a comment in an HTML
     file that nobody can enforce: the pass is queued as a task AFTER
     DOMContentLoaded, and main.js and all eleven sibling components do their
     work inside DOMContentLoaded handlers, so their subtrees exist and their
     claims are stamped by the time this runs — wherever the tag is placed. */
  function schedule() {
    window.setTimeout(autoInit, 0);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  else schedule();
})();
