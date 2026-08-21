/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   BlurText — vanilla port of the React Bits component of the same name.
   No dependencies (the motion is CSS keyframes, not a rAF timeline).
   Works from file:// as well as a web server.

   Mount:  <h2 data-blur-text='{}'>Rush is free</h2>
   Or a whole masthead:  <div class="hero__inner" data-blur-text='{}'>…</div>

   WHAT IT ANIMATES. Three self-contained title blocks per page by default —
   the home masthead, an interior page head, and the closing band (§1,
   DEFAULT_TARGETS) — plus anything an author marks with data-blur-text.
   Body prose is deliberately NOT swept: style.css says in as many words that
   "motion is intentionally absent", and hiding running text until it is
   scrolled to would contradict that. A page that wants more can ask for it
   through window.LPHIE.blurTextTargets or <html data-blur-text-targets>
   (§9); SUGGESTED_TARGETS is the vetted list to start from.

   A BLOCK REVEALS AS ONE BLOCK. Point this at a container and it does not
   need every child to be a splittable heading: it collects the container's
   leaf blocks as MEMBERS (§5) and gives each one a piece of the timeline, in
   VISUAL order — a member whose words can be split safely animates word by
   word, and one that cannot (a button row, an ornament, a line that hosts
   another component) fades in whole. That is why the seven stacked elements
   of .hero__inner arrive as a single settling block rather than as two
   animated lines with a rectangular hole between them. Members that belong
   to somebody else — a claimed host, a main.js render target, a [data-fill]
   — are never touched at all; they are simply already there when the block
   starts, which composes, where skipping them left a hole.

   NO FLASH, AND NO PERMANENTLY INVISIBLE TEXT (§9a). The site's scripts are
   plain end-of-body tags, so without help the fully inked masthead paints
   and then blinks out when the script arms it. The fix is two-sided and both
   sides are needed:
     — JS: the moment this file is evaluated — before DOMContentLoaded, in the
       same parser pause as the <script> tag — it stamps data-bt-prehide on
       the candidates and one class, bt-prehide, on <html>. Nothing is hidden
       until that class exists, so a page whose JS is off, blocked or missing
       shows plain, fully visible text and always did.
     — CSS: the pre-hide rule carries its OWN expiry (a 1ms animation with a
       2.6s delay that sets visibility back). If this script is evaluated and
       then throws before it can arm anything, the page un-hides itself with
       no script involved at all.
   On top of those, autoInit's finally clause drops the class and every
   attribute at the end of the pass, whatever happened inside it. With JS
   disabled: the class is never added, no rule matches, every heading is
   inked from the first paint, and no observer, split or claim ever happens.

   Differences from the React original, all deliberate:
   — The reference is handed a `text` prop and renders a flex row of motion
     spans. Here the text already lives in the HTML, so this component walks
     the element's own child NODES and wraps words in place (§4). Nothing is
     rebuilt from a string: <em>, <br> and the site's runtime-filled spans
     keep their identity, so the accessible text and the authored line breaks
     survive. display:flex is NOT used — it would kill text wrapping and the
     inherited typography this site is built on. Pieces are inline-block
     inside the normal flow instead.
   — animateBy:"letters" is accepted and DEGRADED TO WORDS, and this is not
     the default for a reason worth writing down. A per-character split makes
     every glyph its own shaping run, which throws away exactly what
     style.css:197 turns on — EB Garamond's kern pairs and its fi/fl/ffi
     ligatures — and then re-shapes the line when the split is undone, so the
     heading visibly changes width after it has finished animating. The
     mitigation a letters mode needs (an aria-label, so a screen reader does
     not spell the word out) is itself unsound here: the label would be built
     from textContent, which drops <br>, and two plausible hosts are <p>,
     whose role prohibits an accessible name. Kerning and the accessible name
     are worth more to this site than a per-letter reveal, so there is no
     letters mode and NOTHING in this file reads or writes aria-label.
   — Travel, blur and stagger are all pulled back hard from the demo's values
     (50px / 10px / 200ms down to 10px / 6px / 50ms), and the trigger is
     early (any pixel, 15% of a viewport before the element arrives) while
     the reveal is short: ~0.72s for a heading, ~0.9s for a whole masthead,
     against the ~1.12s that a reader scrolling at speed never saw at all.
   — It composes with, and never touches, main.js's own .reveal pass: no
     query for .reveal, no read or write of "is-in", no shared observer. The
     only element whose own opacity/filter is ever written is one that could
     not be split into words and is therefore animating as a single piece —
     and even then the transform is dropped if it hosts another component,
     so nothing this file does can move a box another component is measuring.
   — When the reveal is over the split is UNDONE and the shared mount claim is
     RELEASED (§7), so the settled page is the authored DOM exactly: no
     leftover inline-block, no stacking context, no attribute, and any
     component that wants the element afterwards can have it.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Configuration -------------------------------------------------- */

  /* The reference's props keep their names. The ones that carry the house
     restraint — delay, travel, overshoot, blurRadius — are quieter than the
     demo's; the guards (staggerCap, maxPieces, maxWords, maxMembers,
     maxChars, requireOffscreen) have no counterpart in the reference and
     exist so this can be pointed at anything on the site without a surprise. */
  var DEFAULTS = {
    animateBy: "words",    /* "words"; "letters" is accepted and degraded   */
    mode: "auto",          /* "auto" | "element" | "group"                  */
    direction: "top",      /* "top" | "bottom"                              */

    /* Trigger. Any pixel counts, and the root box is grown 15% of a viewport
       downward, so a block starts settling BEFORE it has arrived rather than
       once it is already past the reader's eye. */
    threshold: 0,
    rootMargin: "0px 0px 15% 0px",

    /* Duration. A piece runs 2 x stepDuration; the stagger across pieces is
       capped outright (staggerCap / groupStaggerCap), so a heading is fully
       inked ~0.72s after it triggers and a seven-part masthead ~0.9s —
       inside the time a fast scroll keeps either of them on screen. */
    stepDuration: 0.26,    /* seconds per step; a piece runs 2 x this       */
    delay: 50,             /* ms between words inside one member — ref 200  */
    groupDelay: 80,        /* ms between members of a block                 */
    staggerCap: 200,       /* ms ceiling on a single element's stagger      */
    groupStaggerCap: 380,  /* ms ceiling on a whole block's stagger         */

    /* Motion. */
    travel: 10,            /* px the piece arrives from — reference is 50   */
    overshoot: 2,          /* px it passes through at step 1 — ref is 5     */
    blurRadius: 6,         /* px of blur at rest — reference is 10          */
    easing: "ease-out",    /* keyword, or a cubic-bezier(...) string        */

    /* Guards. */
    maxPieces: 60,         /* hard ceiling on animated boxes per mount      */
    maxWords: 14,          /* longer than this and a member fades as one    */
    maxMembers: 16,        /* leaf blocks taken from a container            */
    maxChars: 400,         /* a single element longer than this is skipped  */
    maxGroupChars: 1400,   /* the same ceiling for a container              */

    /* true  = never arm anything already on screen.
       false = arm it anyway, and accept the blink if it had already painted.
       "auto" (default) = arm it only when §9a hid it before the first paint,
       which is the case for every configured target and every data-blur-text
       in the markup. A hand mount from the console after load is on screen
       and was not pre-hidden, so it is declined rather than blinked. */
    requireOffscreen: "auto",
    onEnd: null
  };

  /* The three self-contained title blocks. Each is a CONTAINER, not a
     heading: §5 finds the leaf blocks inside it, so the whole masthead
     settles together instead of one line of it animating inside a static
     frame. Nothing in running body copy is swept by default. */
  var DEFAULT_TARGETS = [
    ".hero__inner",
    ".page-head__inner",
    ".cta-band > .wrap"
  ];

  /* For a page that wants more, on purpose. Published on the mount function
     as .suggestedTargets:
         window.LPHIE.blurTextTargets =
           window.LPHIE.components.blurText.suggestedTargets; */
  var SUGGESTED_TARGETS = [
    ".section h2:not([data-masked-heading])",
    ".section .eyebrow",
    ".cta-band h2"
  ];

  /* The shared, cross-component ownership flag. Every sibling in this folder
     reads it and bails on seeing it, so it is a claim and not a note: this
     file stamps it only on an element it has actually taken (§6, AFTER every
     eligibility test AND after the pieces exist), and takes it off again the
     moment the element is handed back (§7). It is never stamped on an
     element that was rejected — that would silently block ten other
     components from mounting. */
  var CLAIM = "data-lphie-mounted";

  /* §9a's pre-paint marks. The attribute goes on candidates, the class on
     <html>, and the CSS hides only the intersection of the two — so nothing
     is hidden unless this script has run, and §9's finally clause plus the
     stylesheet's own expiry both un-hide it if anything goes wrong after. */
  var PREHIDE = "data-bt-prehide";
  var PREHIDE_CLASS = "bt-prehide";

  /* The eleven sibling components' opt-in attributes, kept as their own list
     because two questions are asked of it: HARD_SKIP folds it in (never
     touch one of these), and §5b asks whether a member CONTAINS one (fade it
     without moving it). The second question must not wait on the claim flag
     — a component whose script has not loaded on this page leaves its
     attribute in the markup and no claim at all. */
  var COMPONENT_HOSTS = [
    "[data-fold-text]", "[data-masked-heading]", "[data-count-up]",
    "[data-accordion-gallery]", "[data-logo-loop]", "[data-drift-wall]",
    "[data-morph-slider]", "[data-depth-carousel]", "[data-gradual-blur]",
    "[data-border-glow]", "[data-strands]"
  ].join(",");

  /* NEVER TOUCHED, in any mode: not split, not faded, not descended into.
     Three families: hosts another component owns and rebuilds, hosts main.js
     overwrites at runtime, and elements whose semantics or typography this
     has no business inside. An author can add a fourth with
     data-blur-text-skip. */
  var HARD_SKIP = [
    /* Component-owned hosts and the markup they generate. */
    COMPONENT_HOSTS, "[data-blur-text-skip]",
    ".fold-text", ".count-up__value", ".count-up__sr",
    ".masked-heading__measure", ".masked-heading__word",
    ".masked-heading__clip", ".masked-heading__media",
    ".accordion-gallery", ".ag-panel",
    ".logoloop__track", ".logoloop__list", ".logoloop__item",
    ".drift-wall", ".morph-slider", ".depth-carousel",
    ".gradual-blur", ".gradual-blur__layer", ".edge-light",
    ".strands", ".strands__canvas",
    /* main.js writes these wholesale, by id, on DOMContentLoaded. */
    "#site-header", "#site-footer", "#values-grid", "#alumni-grid",
    "#alumni-sectors", "#traditions-grid", "#faq-list", "#charter-list",
    "#families-grid", "#rush-schedule", "#gallery-grid", "#reveal-list",
    "#instagram-embed", "#form-note", "#roster-grid", "#exec-grid",
    "[data-fill]",
    /* A drop cap is a floated ::first-letter: leave the whole paragraph be. */
    ".dropcap", ".skip", ".breadcrumb",
    /* Interactive, replaced and tabular elements. */
    "form", "table", "thead", "tbody", "tr", "th", "td",
    "details", "summary", "code", "pre", "label", "button",
    "input", "select", "textarea", "a", "svg", "canvas", "iframe", "video"
  ].join(",");

  /* MAY FADE IN WHOLE, BUT IS NEVER SPLIT INTO WORDS. Small caps, tracked
     chrome, numerals and pull quotes: a word split changes what the line
     measures, and none of them gain anything from arriving one word at a
     time. They still take part in a block reveal — as one piece. */
  var NO_SPLIT = [
    ".ornament", ".hero__sub", ".callout", ".timeline", ".tag", ".btn",
    ".field__hint", ".card__num", ".card__icon", ".stat__value",
    ".stat__label", ".footer-letters", ".nav__letters", ".timeline__year",
    ".brother__name", ".brother__meta", ".class-heading", ".pull",
    "blockquote", "dl", "dt", "dd", "ul", "ol", "li", "img", "picture",
    "figure", "figcaption"
  ].join(",");

  /* Anything already spoken for. On an ANCESTOR this disqualifies a host
     outright; on a DESCENDANT it decides HOW a member is animated (§5): a
     member that hosts another component fades without moving, so no box any
     other component measures is ever transformed underneath it. */
  var SKIP_OWNED = "[" + CLAIM + "],[data-blur-text]";

  /* Inline elements safe to step INSIDE of: the element node itself, its
     attributes and its place in the tree are left exactly as authored, and
     only the text nodes hanging off it are split. Everything else in a
     subtree — <a>, <code>, a component host — makes the member unsplittable
     in §5, so the walker never has to make that judgement. */
  var RECURSE = {
    EM: 1, I: 1, STRONG: 1, B: 1, SPAN: 1, SMALL: 1, SUP: 1, SUB: 1,
    U: 1, S: 1, ABBR: 1, CITE: 1, Q: 1, MARK: 1, VAR: 1, TIME: 1,
    BDI: 1, BDO: 1, INS: 1, DEL: 1
  };

  var DIRECTIONS = { top: 1, bottom: 1 };
  var EASINGS = { ease: 1, "ease-in": 1, "ease-out": 1, "ease-in-out": 1, linear: 1 };
  var BEZIER_RE = /^cubic-bezier\(\s*[-0-9.,\s]+\)$/;

  /* How deep §5 will descend through structural wrappers looking for the
     leaf blocks of a container. .hero__inner → its flex column → the seven
     stacked elements is two. */
  var MAX_DEPTH = 3;

  /* Two boxes within this many pixels of each other count as the same line
     when the members are put in visual order (§5c). */
  var ROW_TOLERANCE = 4;

  /* Backstop only. The reveal normally ends on the last piece's animationend
     — see §6, the note on why a timer alone leaves a visible weight snap. */
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

  function reduced() {
    var mq = motionQuery();
    return !!(mq && mq.matches);
  }

  /* Element.matches has three spellings still in the wild, and an unknown
     selector token throws rather than returning false — both are handled
     here so one bad entry in HARD_SKIP can never take the page down. */
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

  function hasElementChild(el) {
    var child = el.firstChild;
    while (child) {
      if (child.nodeType === 1) return true;
      child = child.nextSibling;
    }
    return false;
  }

  /* A structural wrapper: element children, and no text of its own. The
     hero's flex column is one; a heading with a stray <em> is not. */
  function isWrapper(el) {
    if (!hasElementChild(el)) return false;
    var child = el.firstChild;
    while (child) {
      if (child.nodeType === 3 && /\S/.test(child.nodeValue || "")) return false;
      child = child.nextSibling;
    }
    return true;
  }

  function wordCount(el) {
    var m = (el.textContent || "").match(/\S+/g);
    return m ? m.length : 0;
  }

  /* Null when there is no box at all — display:none, or a subtree that was
     never laid out. Such an element is neither painted nor animatable, so it
     is left out of the timeline entirely. visibility:hidden (which §9a uses)
     still measures, so pre-hidden candidates report their real geometry. */
  function rectOf(el) {
    if (!el.getBoundingClientRect) return null;
    var r;
    try { r = el.getBoundingClientRect(); } catch (e) { return null; }
    if (!r || (!r.width && !r.height)) return null;
    return r;
  }

  /* Is any part of this element inside the viewport right now? An element
     with no box at all counts as off screen: there is nothing painted, so
     there is nothing to flash. */
  function onScreen(el) {
    var vh = window.innerHeight ||
      (document.documentElement && document.documentElement.clientHeight) || 0;
    var vw = window.innerWidth ||
      (document.documentElement && document.documentElement.clientWidth) || 0;
    if (!vh || !vw) return false;
    var r = rectOf(el);
    if (!r) return false;
    return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
  }

  /* ---- 3. Eligibility ---------------------------------------------------- */

  /* A child element is only walkable when it is inert markup: no id and no
     data-* attribute, because both are how main.js and every sibling
     component address the nodes they own and overwrite. This file's own
     pre-hide mark is not ownership and does not count. */
  function inertElement(el) {
    if (el.id) return false;
    var attrs = el.attributes;
    if (!attrs) return true;
    for (var i = 0; i < attrs.length; i++) {
      var name = attrs[i].name;
      if (name === PREHIDE) continue;
      if (name.indexOf("data-") === 0) return false;
    }
    return true;
  }

  /* Every element in the subtree must be a <br> we can step over, or an
     inert inline element we can step into. One unexpected node — an <a>, a
     <code>, a [data-fill] span, a component host another agent adds next
     week — and the element is not split; it fades as one piece instead. */
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

  /* The gate every host passes, however it was selected, so a hand-written
     data-blur-text is held to exactly the same standard as a configured
     sweep. Nothing outside mount() decides, and nothing is marked before
     this has passed. */
  function eligibleHost(root) {
    if (!root || root.nodeType !== 1) return false;
    /* Already claimed by a sibling component — or by an earlier pass of this
       one. Tested here rather than through the neighbourhood selector
       because that one is about the surroundings, and this is about the
       element itself. */
    if (root.getAttribute(CLAIM)) return false;
    /* An id is how main.js finds its render targets, so an element that has
       one is never taken — even when the id looks harmless today. */
    if (root.id) return false;
    if (matches(root, HARD_SKIP)) return false;
    if (hasAncestor(root, HARD_SKIP + "," + SKIP_OWNED)) return false;
    /* Something has to be there. An empty box with no children is not a
       reveal, it is a no-op with a claim attached. */
    if (!/\S/.test(root.textContent || "") && !hasElementChild(root)) return false;
    return true;
  }

  /* ---- 4. The text-node walker ------------------------------------------- */

  /* THE ONE RULE: innerHTML is never read or written, and no element is ever
     created around, moved past or rebuilt from an existing element. Only
     Text nodes are replaced, and each is replaced by exactly the words it
     contained plus the exact whitespace runs that separated them, so the
     line still wraps and collapses the way the authored markup did — and so
     the text still copies and pastes as one string. `records` remembers
     every substitution so §7 can put the original Text nodes back verbatim.
     Words, never characters: see the header on kerning. */
  function splitText(doc, textNode, out, records, limit) {
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

      if (out.length >= limit) return false;
      span = doc.createElement("span");
      span.className = "blur-text__piece blur-text__word";
      span.textContent = part;
      out.push(span);
      inserted.push(span);
    }

    if (!inserted.length) return true;

    var frag = doc.createDocumentFragment();
    for (i = 0; i < inserted.length; i++) frag.appendChild(inserted[i]);
    parent.replaceChild(frag, textNode);
    records.push({ parent: parent, nodes: inserted, text: raw });
    return true;
  }

  function splitNode(doc, node, out, records, limit) {
    var child = node.firstChild;
    var next;
    while (child) {
      /* Held before the split, because replaceChild detaches `child`. */
      next = child.nextSibling;
      if (child.nodeType === 3) {
        if (!splitText(doc, child, out, records, limit)) return false;
      } else if (child.nodeType === 1 && child.nodeName !== "BR" && RECURSE[child.nodeName]) {
        if (!splitNode(doc, child, out, records, limit)) return false;
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

  /* ---- 5. Members -------------------------------------------------------- */

  /* 5a. What a container is made of.

     A MEMBER is one leaf block of the thing being revealed: a heading, a
     line of small caps, an ornament, a button row, the crest. Structural
     wrappers are seen through, not animated, so a flex column between the
     container and its lines costs nothing. An element that belongs to
     somebody else is passed over silently and stays exactly as authored —
     which is the whole difference between composing with the rest of the
     page and punching a hole in it.

     A wrapper whose children yield NOTHING (a .btn-row of two claimed <a>s,
     say) becomes a member itself, so the row still arrives with the block
     instead of sitting there already inked. */
  function considerMember(el, out, depth, limit) {
    if (out.length >= limit) return;
    if (el.getAttribute(CLAIM)) return;               /* owned by a sibling  */
    if (el.getAttribute("data-blur-text") != null) return; /* its own mount  */
    if (el.id) return;                                 /* a main.js target   */
    if (matches(el, HARD_SKIP)) return;
    if (!rectOf(el)) return;                           /* no box to animate  */

    if (depth < MAX_DEPTH && isWrapper(el)) {
      var before = out.length;
      collectMembers(el, out, depth + 1, limit);
      if (out.length > before) return;                 /* children took it   */
    }
    out.push(el);
  }

  function collectMembers(container, out, depth, limit) {
    var child = container.firstChild;
    while (child) {
      if (child.nodeType === 1) considerMember(child, out, depth, limit);
      child = child.nextSibling;
    }
    return out;
  }

  /* 5b. How a member animates.

     "words"  — the subtree is inert inline markup and short enough to read
                as a line of words settling one after another.
     "unit"   — everything else: it arrives as one box. `still` drops the
                translate as well, for a member that hosts another component:
                a transform changes what getBoundingClientRect reports, and
                fold-text and masked-heading both measure their own boxes.
                Opacity and blur change nothing any of them can measure. */
  function planMember(el, opts) {
    /* Our own opt-in inside would animate twice. */
    if (hasDescendant(el, "[data-blur-text]")) return null;

    var words = wordCount(el);
    var still = hasDescendant(el, SKIP_OWNED + "," + COMPONENT_HOSTS);
    var splittable =
      words > 0 &&
      words <= opts.maxWords &&
      (el.textContent || "").length <= opts.maxChars &&
      !matches(el, NO_SPLIT) &&
      walkableSubtree(el);

    return { el: el, kind: splittable ? "words" : "unit", still: still, words: words };
  }

  /* 5c. Document order is not always reading order. .hero__crest is the LAST
     child of .hero__inner and `order: 1` puts it FIRST on the page, so the
     timeline is built from measured geometry — top to bottom, then left to
     right, with a few pixels of tolerance so one row stays one row. */
  function visualOrder(members) {
    var decorated = [];
    var i, r;
    for (i = 0; i < members.length; i++) {
      r = rectOf(members[i].el);
      decorated.push({
        member: members[i],
        top: r ? r.top : 0,
        left: r ? r.left : 0,
        index: i
      });
    }
    decorated.sort(function (a, b) {
      var dt = a.top - b.top;
      if (Math.abs(dt) > ROW_TOLERANCE) return dt < 0 ? -1 : 1;
      var dl = a.left - b.left;
      if (Math.abs(dl) > ROW_TOLERANCE) return dl < 0 ? -1 : 1;
      return a.index - b.index;
    });
    var sorted = [];
    for (i = 0; i < decorated.length; i++) sorted.push(decorated[i].member);
    return sorted;
  }

  /* ---- 6. Mount ---------------------------------------------------------- */

  function mount(root, options) {
    if (!root || root.nodeType !== 1) return null;

    var opts = assign(assign({}, DEFAULTS), options);
    var doc = root.ownerDocument || document;

    var mq = motionQuery();
    /* Contract: under reduced motion there is no split, no claim, no
       pre-hide and no animation at all. The DOM is never touched and the
       text was visible the whole time, so there is nothing to undo. */
    if (mq && mq.matches) return null;

    /* --- 6a. Resolved settings ------------------------------------------- */
    var direction = DIRECTIONS[opts.direction] ? opts.direction : "top";
    var easing = (EASINGS[opts.easing] || BEZIER_RE.test(String(opts.easing)))
      ? String(opts.easing)
      : DEFAULTS.easing;
    var step = Math.max(0.05, num(opts.stepDuration, DEFAULTS.stepDuration));
    var travel = Math.max(0, num(opts.travel, DEFAULTS.travel));
    var overshoot = Math.max(0, num(opts.overshoot, DEFAULTS.overshoot));
    var blurRadius = Math.max(0, num(opts.blurRadius, DEFAULTS.blurRadius));
    var wordDelay = Math.max(0, num(opts.delay, DEFAULTS.delay));
    var memberDelay = Math.max(0, num(opts.groupDelay, DEFAULTS.groupDelay));
    var maxPieces = Math.max(1, Math.floor(num(opts.maxPieces, DEFAULTS.maxPieces)));
    var maxMembers = Math.max(1, Math.floor(num(opts.maxMembers, DEFAULTS.maxMembers)));
    var threshold = clamp(num(opts.threshold, DEFAULTS.threshold), 0, 1);
    var rootMargin = opts.rootMargin == null ? DEFAULTS.rootMargin : String(opts.rootMargin);
    opts.maxWords = Math.max(1, Math.floor(num(opts.maxWords, DEFAULTS.maxWords)));
    opts.maxChars = Math.max(1, num(opts.maxChars, DEFAULTS.maxChars));

    /* --- 6b. Decide the mode, then the members ---------------------------- */
    /* "element" is a heading that is nothing but words and inline markup.
       "group" is a container of blocks. Auto picks element when the host is
       splittable on its own and group when it is not, which is what makes
       <h2 data-blur-text> and <div class="hero__inner" data-blur-text>
       behave the way an author would expect from each. */
    var mode = opts.mode === "element" || opts.mode === "group" ? opts.mode : "auto";
    if (mode === "auto") {
      mode = (walkableSubtree(root) && wordCount(root) > 0) ? "element" : "group";
    }
    var group = mode === "group";

    if (!eligibleHost(root)) return null;
    if ((root.textContent || "").length > (group ? opts.maxGroupChars : opts.maxChars)) return null;

    /* Never blank text a reader is already looking at — see requireOffscreen
       in §1 for the three settings and why "auto" is the default. */
    var req = opts.requireOffscreen;
    if (req !== false) {
      var prehidden = root.getAttribute(PREHIDE) != null;
      if (req === true && onScreen(root)) return null;
      if (req !== true && !prehidden && onScreen(root)) return null;
    }

    var raw = [];
    if (group) {
      collectMembers(root, raw, 0, maxMembers);
      /* A container whose every child belongs to somebody else — a <p> whose
         only element is a [data-fill] span, say — still reveals: it fades as
         one box rather than being skipped. */
      if (!raw.length) raw = [root];
    } else {
      raw = [root];
    }

    var members = [];
    var i, plan;
    for (i = 0; i < raw.length; i++) {
      plan = planMember(raw[i], opts);
      if (plan) members.push(plan);
    }
    if (!members.length) return null;
    members = visualOrder(members);

    /* --- 6c. Build the pieces --------------------------------------------- */
    /* Only two kinds of box are ever animated: a generated word span, or an
       existing element that could not be split. The second kind is never
       re-parented, wrapped or rebuilt — it is the authored element with two
       classes and one inline animation-delay on it, all four of which come
       straight back off at settle. */
    var pieces = [];
    var records = [];
    var units = [];
    var claimed = false;

    function abandon() {
      restoreRecords(doc, records);
      for (var k = 0; k < units.length; k++) stripUnit(units[k]);
      units.length = 0;
      pieces.length = 0;
      release();
    }

    /* The exact inverse of the three classes and the one inline property
       §6c wrote. Author classes and an author style attribute survive; a
       class or style attribute that only existed because of this component
       is removed outright, so the settled element is byte-for-byte the
       markup that was authored. */
    function stripUnit(el) {
      if (typeof el.className === "string") {
        el.className = el.className
          .replace(/\bblur-text__(piece|unit|still)\b/g, "")
          .replace(/\s+/g, " ")
          .replace(/^ | $/g, "");
        if (!el.className) el.removeAttribute("class");
      }
      if (el.style && el.style.animationDelay) el.style.animationDelay = "";
      if (el.getAttribute("style") === "") el.removeAttribute("style");
    }

    function release() {
      if (!claimed) return;
      claimed = false;
      root.removeAttribute(CLAIM);
    }

    var member, mrec, mout, j;
    for (i = 0; i < members.length; i++) {
      member = members[i];
      member.pieces = [];

      if (member.kind === "words" && pieces.length + member.words <= maxPieces) {
        mrec = [];
        mout = [];
        if (splitNode(doc, member.el, mout, mrec, maxPieces - pieces.length) && mout.length) {
          for (j = 0; j < mout.length; j++) {
            member.pieces.push(mout[j]);
            pieces.push(mout[j]);
          }
          for (j = 0; j < mrec.length; j++) records.push(mrec[j]);
          continue;
        }
        /* Over the cap, or nothing splittable after all: put this member's
           text nodes back and let the whole box fade instead. */
        restoreRecords(doc, mrec);
      }

      if (pieces.length >= maxPieces) break;
      /* A unit piece. The element keeps its identity, its attributes and its
         children — nothing is re-parented or rebuilt; it gains two classes
         (three when it must not be moved) for the length of the reveal. */
      var unitClass = "blur-text__piece blur-text__unit" + (member.still ? " blur-text__still" : "");
      member.el.className = member.el.className
        ? member.el.className + " " + unitClass
        : unitClass;
      units.push(member.el);
      member.pieces.push(member.el);
      pieces.push(member.el);
    }

    if (!pieces.length) { abandon(); return null; }

    /* --- 6d. The timeline -------------------------------------------------
       Words inside one member follow each other closely; members follow each
       other a little further apart, so a masthead reads top to bottom rather
       than as one flat wash. The whole span is then scaled to fit under the
       cap — the shape survives, the total does not grow. */
    var cursor = 0;
    var maxDelay = 0;
    var delays = [];
    for (i = 0; i < members.length; i++) {
      var mp = members[i].pieces;
      for (var p = 0; p < mp.length; p++) {
        var d = cursor + p * wordDelay;
        delays.push({ el: mp[p], at: d });
        if (d > maxDelay) maxDelay = d;
      }
      if (mp.length) cursor += Math.max(memberDelay, mp.length * wordDelay);
    }
    var cap = Math.max(0, num(group ? opts.groupStaggerCap : opts.staggerCap,
      group ? DEFAULTS.groupStaggerCap : DEFAULTS.staggerCap));
    if (cap > 0 && maxDelay > cap) {
      var scale = cap / maxDelay;
      for (i = 0; i < delays.length; i++) delays[i].at = delays[i].at * scale;
      maxDelay = cap;
    }
    for (i = 0; i < delays.length; i++) {
      delays[i].el.style.animationDelay = round(delays[i].at) + "ms";
    }
    var totalMs = maxDelay + step * 2000;

    /* --- 6e. Claim, then arm ---------------------------------------------- */
    /* The claim goes on ONLY now: every test has passed and the pieces
       exist, so the flag means what the other ten components read it to
       mean. §9 keeps the returned handle, so it always comes off again. */
    root.setAttribute(CLAIM, "1");
    claimed = true;

    var y0 = (direction === "bottom" ? travel : -travel) + "px";
    var y1 = (direction === "bottom" ? -overshoot : overshoot) + "px";

    root.style.setProperty("--bt-blur", blurRadius + "px");
    root.style.setProperty("--bt-blur-mid", round(blurRadius / 2) + "px");
    root.style.setProperty("--bt-y0", y0);
    root.style.setProperty("--bt-y1", y1);
    root.style.setProperty("--bt-step", step + "s");
    root.style.setProperty("--bt-ease", easing);

    /* One frame, one paint: the class that hides the pieces goes on in the
       same task as the attribute that un-hides the host, so §9a's pre-hidden
       block hands straight over to the armed state with nothing drawn in
       between — and if any line above had thrown, the host would still be
       carrying the pre-hide attribute for §9's finally clause to clear. */
    root.classList.add("blur-text");
    root.classList.add("blur-text--armed");
    root.removeAttribute(PREHIDE);

    /* ---- 6f. Trigger, settle, teardown ----------------------------------- */

    var io = null;
    var timer = 0;
    var probe = 0;
    var sawObserver = false;
    var played = false;
    var settled = false;
    var destroyed = false;
    var done = 0;

    /* The reveal ends on the LAST piece's animationend, not on a timer that
       runs past it. A composited box that is still filling an animation does
       not rasterise its text the way a plain box does, so a gap between "the
       motion stopped" and "the classes came off" shows up as the letters
       subtly changing weight. animationend closes that gap to a single
       frame; the timer below is only a backstop for the cases where the
       event cannot arrive (a backgrounded tab, an interrupted animation). */
    function onAnimEnd(e) {
      if (!e || !e.animationName || e.animationName.indexOf("blur-text-in") !== 0) return;
      done++;
      if (done >= pieces.length) settle();
    }

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
       inline-block, no filter stacking context, no inline custom properties,
       no generated span and no mount claim. The keyframe's last stop is
       `filter: none; transform: none` rather than blur(0)/translate(0) for
       the same reason the timer is not trusted: the final frame has to be
       the same rendering as the settled element, not an identical-looking
       one drawn on a composited layer. */
    function settle() {
      if (timer) { window.clearTimeout(timer); timer = 0; }
      if (probe) { window.clearTimeout(probe); probe = 0; }
      if (settled) return;
      settled = true;
      if (io) { io.disconnect(); io = null; }
      unhookMotion();
      root.removeEventListener("animationend", onAnimEnd);
      root.classList.remove("is-revealing");
      root.classList.remove("blur-text--armed");
      root.classList.remove("blur-text");
      for (var k = 0; k < units.length; k++) stripUnit(units[k]);
      units.length = 0;
      restoreRecords(doc, records);
      pieces.length = 0;
      /* classList leaves class="" behind on an element that never carried a
         class attribute, which is a difference from the authored markup and
         therefore a difference this component is not allowed to leave. */
      if (root.getAttribute("class") === "") root.removeAttribute("class");
      root.style.removeProperty("--bt-blur");
      root.style.removeProperty("--bt-blur-mid");
      root.style.removeProperty("--bt-y0");
      root.style.removeProperty("--bt-y1");
      root.style.removeProperty("--bt-step");
      root.style.removeProperty("--bt-ease");
      if (root.getAttribute("style") === "") root.removeAttribute("style");
      root.removeAttribute(PREHIDE);
      /* The element is authored markup again, so the claim is over: any
         component mounted after this point gets a clean element. */
      release();
      if (typeof opts.onEnd === "function") {
        try { opts.onEnd(); } catch (e) {}
      }
    }

    /* ---- 8. Observer, reduced-motion changes, teardown ------------------- */

    /* One private observer per element. It is never main.js's observer and it
       never reads or writes "is-in". Unlike main.js's .reveal pass it stays
       connected until the reveal is over, for the one case that matters on a
       phone: a reader flicking past at speed. Entering starts the reveal;
       leaving again before it has finished means there is no longer anyone
       watching it, so the split is undone at once and the block is plain
       readable text the moment they scroll back. */
    function onIntersect(entries) {
      sawObserver = true;
      var last = entries && entries.length ? entries[entries.length - 1] : null;
      if (!last) return;
      if (last.isIntersecting) { play(); return; }
      if (played && !settled) settle();
    }

    root.addEventListener("animationend", onAnimEnd);

    if (!("IntersectionObserver" in window)) {
      play();
    } else {
      try {
        io = new IntersectionObserver(onIntersect, { rootMargin: rootMargin, threshold: threshold });
        io.observe(root);
      } catch (err) {
        if (io) { try { io.disconnect(); } catch (e2) {} }
        io = null;
      }
      if (io) {
        /* Armed text is hidden text. If the observer never reports, put the
           words back rather than leave a blank block on the page. */
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
         media query, strips the unit classes, puts the original Text nodes
         back and releases the claim — so teardown at any point in the
         timeline restores the element exactly. */
      settle();
    };
  }

  mount.suggestedTargets = SUGGESTED_TARGETS;
  window.LPHIE.components.blurText = mount;

  /* ---- 9. Auto-init ------------------------------------------------------ */

  /* Every element mounted here keeps its teardown handle, so destroy() is
     reachable rather than dead code:
        window.LPHIE.components.blurText.destroyAll()
     puts every element on the page back at once. */
  var handles = [];

  mount.destroyAll = function () {
    while (handles.length) {
      var fn = handles.pop();
      try { fn(); } catch (e) {}
    }
  };

  /* There is no sweep beyond DEFAULT_TARGETS unless a page asks for one,
     either with window.LPHIE.blurTextTargets (array or comma string) or with
     <html data-blur-text-targets="h2, .lede">. Either one REPLACES the
     default list; an empty string turns the sweep off and leaves only the
     explicit data-blur-text mounts. Shared options go in
     window.LPHIE.blurText. */
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

  function eachTarget(fn) {
    var seen = [];
    function once(node) {
      for (var k = 0; k < seen.length; k++) if (seen[k] === node) return;
      seen.push(node);
      fn(node);
    }
    var explicit = document.querySelectorAll("[data-blur-text]");
    Array.prototype.forEach.call(explicit, once);
    var selectors = targetList();
    for (var i = 0; i < selectors.length; i++) {
      var selector = selectors[i];
      if (!selector || !/\S/.test(selector)) continue;
      var nodes;
      try { nodes = document.querySelectorAll(selector); } catch (e) { continue; }
      Array.prototype.forEach.call(nodes, once);
    }
  }

  /* ---- 9a. The pre-paint pass -------------------------------------------
     Runs at SCRIPT EVALUATION — the parser is paused on this file's own
     <script> tag, before DOMContentLoaded and before the components below it
     have run — which is the last moment at which a heading can be hidden
     without the reader having seen it inked first.

     What it does NOT do is decide anything: mount() is still the only judge
     of what gets animated. This marks candidates broadly and cheaply, and
     everything it marked is un-marked again at the end of autoInit whether
     it was taken or not. Two independent things un-hide the page if this
     script stops here and never reaches autoInit: the stylesheet's own
     expiry on the pre-hide rule, and — for the ordinary case — the finally
     clause in autoInit. With JS off, the class below is never added and no
     pre-hide rule can match anything. */
  function prehide() {
    if (reduced()) return;
    var docEl = document.documentElement;
    if (!docEl || !document.body) return;
    var marked = 0;
    eachTarget(function (node) {
      if (node.getAttribute(CLAIM)) return;
      if (node.id) return;
      if (matches(node, HARD_SKIP)) return;
      if (hasAncestor(node, HARD_SKIP)) return;
      if (!/\S/.test(node.textContent || "") && !hasElementChild(node)) return;
      node.setAttribute(PREHIDE, "");
      marked++;
    });
    if (marked && docEl.classList) docEl.classList.add(PREHIDE_CLASS);
  }

  /* The class comes off FIRST and on its own line: the pre-hide rule needs
     both marks at once, so with the class gone nothing on the page can still
     be hidden by this component even if the sweep below never completes. */
  function clearPrehide() {
    var docEl = document.documentElement;
    if (docEl && docEl.classList) docEl.classList.remove(PREHIDE_CLASS);
    try {
      var nodes = document.querySelectorAll("[" + PREHIDE + "]");
      Array.prototype.forEach.call(nodes, function (node) {
        node.removeAttribute(PREHIDE);
      });
    } catch (e) {}
  }

  /* mount() alone decides whether an element is taken, and stamps the shared
     claim itself only if it did — so this may be called on anything, twice,
     in any order, and nothing is marked that was not actually mounted. The
     handle is kept for every element that WAS taken. */
  function mountNode(node, opts) {
    var destroy = null;
    try {
      destroy = mount(node, opts);
    } catch (e) {
      destroy = null;
    }
    if (typeof destroy === "function") handles.push(destroy);
    /* Taken or not, this element is no longer waiting on the pre-hide pass:
       an armed one is hidden by .blur-text--armed from here on, and a
       rejected one has nothing left to hide it. */
    if (node.removeAttribute) node.removeAttribute(PREHIDE);
  }

  function autoInit() {
    try {
      /* Nothing is claimed at all under reduced motion. */
      if (reduced()) return;
      var shared = window.LPHIE.blurText || null;
      eachTarget(function (node) {
        var opts = shared;
        var raw = node.getAttribute("data-blur-text");
        if (raw) {
          var parsed = null;
          try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
          if (parsed) opts = assign(assign({}, shared || {}), parsed);
        }
        mountNode(node, opts);
      });
    } finally {
      /* Whatever happened above — a throw in the middle of the sweep
         included — the page is never left hidden by the pre-paint pass. */
      clearPrehide();
    }
  }

  /* Every candidate is READ inside autoInit, never at module-evaluation
     time, and the exclusion gate in §3 assumes the page has finished being
     assembled. Script ORDER is therefore not left to a comment in an HTML
     file that nobody can enforce: the pass is queued as a task AFTER
     DOMContentLoaded, and main.js and all eleven sibling components do their
     work inside DOMContentLoaded handlers, so their subtrees exist and their
     claims are stamped by the time this runs — wherever the tag is placed.
     The pre-paint pass (§9a) is the one thing that must happen sooner, and
     it only ever writes an attribute it later takes back. */
  function schedule() {
    window.setTimeout(autoInit, 0);
  }

  prehide();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      /* A second, harmless pass: covers the case of this file being loaded
         from <head>, where the body did not exist yet at evaluation time. */
      prehide();
      schedule();
    });
  } else {
    schedule();
  }
})();
