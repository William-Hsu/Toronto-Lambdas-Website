/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   MaskedHeading — vanilla port of the React Bits component of the same name.
   No dependencies (no GSAP, no React). Works from file:// as well as a server.

   The heading text becomes a clip-path window onto a photo (or, until the exec
   board supplies one, an animated brand-navy gradient) that drifts and
   parallaxes behind the letterforms.

   Mount:  <h2 data-masked-heading='{}'>Asian-interest.<br>Never Asian-exclusive.</h2>
   The heading text is read OUT OF THE DOM (a <br> counts as a line break), so
   the markup still renders as an ordinary heading if this script never runs.

   ---- LEGIBILITY IS THE COMPONENT'S JOB, NOT THE PHOTOGRAPH'S -------------
   These letters are WINDOWS: what makes them legible is the contrast between
   what is inside them and the ground behind the page. That used to be handled
   by ASKING for it — supply a dark photograph for the light impression, a
   bright one for the dark impression, and let a CSS brightness crank cover the
   case where only one was supplied. Every part of that was a hope, and each
   part could fail on its own: a crank aimed at a dark frame clips a bright one
   to white paste; a frame picked for its whole-frame average can be nothing
   like the narrow band this heading actually shows; and the wiring can simply
   be done the other way round by whoever edits the markup next.

   It is now a property of the component. A tint layer composites the whole
   media box toward one ink, with mix-blend-mode:

     light ground — multiply toward #365A93. multiply(a, t) <= t per channel,
                    so no pixel can come out lighter than that ink: worst case
                    5.80:1 against the plate this heading sits on.
     dark ground  — screen toward #A89A75. screen(a, t) >= t per channel, so no
                    pixel can come out darker than that gilt: worst case 5.18:1.

   Both are floors for EVERY pixel, not averages — measured over all eleven
   candidate photographs in assets/img at both extremes of the drift envelope:
   0.0% of pixels below 3:1 on either ground, against 4.5%-92% for the raw
   frames. Tonal variation survives (sd of CIE L* 5.9-11.2, from 17-28 raw), so
   the letterforms still read as a photograph and not as flat fill.

   The ground those numbers are measured against is READ OFF THE DOM at mount
   and on every theme change, not assumed: index.html mounts this heading
   inside <section class="section--navy">, whose ground is --plate-bg
   (#F0EBDC light / #17294B dark), not the page's #FBF9F3 / #0A0F1C.

   ---- src / srcDark -------------------------------------------------------
   Two photographs, one per impression, are now a REFINEMENT rather than a
   legibility mechanism. srcDark is optional; leave it out and there is one
   photograph, one request, and nothing to swap. Supply it and the two are
   crossfaded live whenever theme.js flips <html data-theme> — separate
   elements, each decoded before it is shown, so the drift never restarts and
   the letterforms never flash empty. Both are still shown at their best when
   `src` is the darker frame and `srcDark` the brighter one, because the
   duotone then compresses less; neither choice can make the heading illegible.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  var SVG_NS = "http://www.w3.org/2000/svg";

  /* useId() does not exist outside React — one counter per page instead, so
     several MaskedHeadings on one page never collide on a clip-path id. */
  var uid = 0;

  /* ---- Defaults ---------------------------------------------------------
     Every prop from the React reference, same names. Values marked TUNED
     differ from the reference because this heading has to sit beside the
     site's ordinary <h2>s (font-size: clamp(1.9rem, 3.6vw, 2.75rem)) in the
     left column of a two-column grid on white.
     ---------------------------------------------------------------------- */
  var DEFAULTS = {
    /* Text. Empty means "read it from the DOM"; a string here overrides,
       and "\n" (or a literal <br>) marks a line break. */
    text: "",

    /* Media. The exec board drops a WIDE chapter photo (roughly 3:1, at least
       1600px across, JPEG) at assets/img/masked-heading.jpg and it appears
       here with no other change. Until that file exists — or if the path is
       wrong, or the file will not decode — the gradient floor shows instead,
       and it is a finished treatment, not a placeholder.

       NB when choosing a frame: this heading is about 5.5:1 and object-fit is
       cover, so a portrait file shows a horizontal SLIVER of itself — roughly
       5% of a 462x1000 frame, dead centre. Letterbox bars, sky and floor never
       appear, and a whole-frame average says nothing about what lands inside
       the letters. Legibility does not depend on the choice (see the header),
       but framing does.

       src     — the photograph shown on a light ground. A darker frame
                 compresses least there. The only photograph if srcDark is
                 absent, and then it serves both impressions.
       srcDark — OPTIONAL second photograph, shown on a dark ground. A brighter
                 frame compresses least there. Absent (the default "") means
                 "one photograph, both grounds" — the second file is never
                 fetched and nothing is ever swapped. */
    mediaType: "image",             /* "image" | "video" */
    src: "assets/img/masked-heading.jpg",
    srcDark: "",
    poster: "",

    fillScale: 1.25,                /* TUNED — reference 1.25, kept */
    parallax: 26,
    drift: 18,

    /* These three ride on the media box, i.e. they are applied to the result
       of the duotone rather than to the raw photograph. At their defaults they
       are a no-op; moving them is the one way to spend the contrast floor the
       component otherwise guarantees, so treat 1 / 1 as the sane values. */
    brightness: 1,
    saturation: 1,
    grayscale: false,

    reveal: "rise",                 /* "rise" | "wipe" | "fade" | "none" */
    duration: 1.1,
    stagger: 0.09,
    trigger: "view",                /* "view" | "hover" | "mount" */

    align: "left",                  /* TUNED — reference "center"; this site's headings are left-aligned */
    weight: 600,                    /* TUNED — reference 700; matches h1..h4 { font-weight: 600 } */
    tracking: -0.01,                /* TUNED — reference -0.03; matches h1..h4 { letter-spacing: -0.01em } */
    lineHeight: 1.06,

    /* TUNED — reference 0.115 (a number).
       "css" means: do not size the heading at all; let the stylesheet do it.

       The reference scales the heading off its CONTAINER width. This site
       sizes headings off the VIEWPORT — h2 { font-size: clamp(1.9rem, 3.6vw,
       2.75rem) } — and the two cannot track each other. .grid--2 is
       repeat(auto-fit, minmax(320px, 1fr)), so below ~736px viewport it
       collapses to one column: the container jumps to nearly the full
       viewport width while a sibling h2 is still pinned at its 30.4px floor.
       Any fixed ratio is then wrong by up to +72% in that band and -18% at
       375px, and no clamp repairs it because the error is in the middle, not
       at the ends.

       In "css" mode sync() simply skips the font-size assignment. The h2
       keeps the stylesheet's clamp(), the measuring span inherits it, and
       sync() copies the RESULTING computed font off the measuring span onto
       the SVG <text> nodes exactly as it always did — so the clip geometry
       tracks the site's own type scale at every width, by construction.

       Pass a number to restore the reference's container-relative behaviour
       (e.g. {"textScale": 0.115}). minFontSize/maxFontSize apply only then. */
    textScale: "css",

    /* The reference's clamp on the computed size — numeric textScale only. */
    minFontSize: 20,
    maxFontSize: 200
  };

  /* ---- Small helpers ----------------------------------------------------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function hasOwn(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }

  function merge(base, extra) {
    var out = {}, k;
    for (k in base) { if (hasOwn(base, k)) out[k] = base[k]; }
    if (extra) {
      for (k in extra) {
        if (hasOwn(extra, k) && extra[k] !== null && extra[k] !== undefined) out[k] = extra[k];
      }
    }
    return out;
  }

  function now() {
    return (window.performance && window.performance.now) ? window.performance.now() : (new Date()).getTime();
  }

  /* Depth-aware asset prefix, same rule main.js uses. */
  function prefix() {
    var d = document.documentElement.getAttribute("data-root");
    return d === null ? "" : d;
  }

  function resolveSrc(src) {
    if (!src) return "";
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(src)) return src;
    return prefix() + src;
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /* GSAP easing equivalents. */
  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }          /* power4.out  — rise */
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }          /* power3.out  — fade */
  function easeInOutCubic(t) {                                          /* power3.inOut — wipe */
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* Read the heading text out of the DOM, treating <br> as a newline. */
  function readText(node) {
    var out = "";
    var kids = node.childNodes;
    for (var i = 0; i < kids.length; i += 1) {
      var n = kids[i];
      if (n.nodeType === 3) { out += n.nodeValue; }
      else if (n.nodeType === 1) {
        if (n.nodeName.toLowerCase() === "br") out += "\n";
        else out += readText(n);
      }
    }
    return out;
  }

  /* "Asian-interest.\nNever Asian-exclusive." -> [["Asian-interest."], ["Never","Asian-exclusive."]] */
  function parseLines(text) {
    var raw = String(text === null || text === undefined ? "" : text)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/\r\n?/g, "\n")
      .split("\n");
    var out = [];
    for (var i = 0; i < raw.length; i += 1) {
      var parts = raw[i].replace(/\s+/g, " ").replace(/^ | $/g, "").split(" ");
      var line = [];
      for (var j = 0; j < parts.length; j += 1) { if (parts[j]) line.push(parts[j]); }
      if (line.length) out.push(line);
    }
    return out;
  }

  /* clip-path: url(#id) is the whole component. If the browser cannot do it,
     leave the plain heading alone rather than blanking it out. */
  function clipPathSupported() {
    if (!window.CSS || typeof window.CSS.supports !== "function") return true;
    return window.CSS.supports("clip-path", "url(#mh)") ||
           window.CSS.supports("-webkit-clip-path", "url(#mh)");
  }

  /* ---- mount ------------------------------------------------------------- */
  function mount(root, options) {
    if (!root || !root.nodeType) return function () {};
    if (!clipPathSupported()) return function () {};

    var o = merge(DEFAULTS, options);
    var lines = parseLines((typeof o.text === "string" && o.text) ? o.text : readText(root));
    if (!lines.length) return function () {};

    /* Sizing mode. A finite number = the reference's container-relative
       scaling; anything else ("css", the default) leaves font-size to the
       stylesheet. See the textScale note in DEFAULTS. */
    var scaleIsNumeric = (typeof o.textScale === "number") &&
                         isFinite(o.textScale) && o.textScale > 0;

    /* -- 1. Build the DOM ------------------------------------------------- */
    var clipId = "mh-clip-" + (++uid);

    var measure = document.createElement("span");
    measure.className = "masked-heading__measure";

    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "masked-heading__defs");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var defs = document.createElementNS(SVG_NS, "defs");
    var clipPath = document.createElementNS(SVG_NS, "clipPath");
    clipPath.setAttribute("id", clipId);
    clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");

    var wordBoxes = [];   /* measuring spans — drive offsetLeft */
    var baseMarks = [];   /* zero-size <i> sitting on each baseline — drives offsetTop */
    var glyphs = [];      /* SVG <text> nodes inside the clipPath */

    for (var li = 0; li < lines.length; li += 1) {
      if (li > 0) measure.appendChild(document.createElement("br"));
      var line = lines[li];
      for (var wi = 0; wi < line.length; wi += 1) {
        var word = line[wi];

        var box = document.createElement("span");
        box.className = "masked-heading__word";
        box.appendChild(document.createTextNode(word));

        var mark = document.createElement("i");
        mark.className = "masked-heading__baseline";
        box.appendChild(mark);

        measure.appendChild(box);
        /* A REAL space between the word boxes, not the reference's
           `.word:not(:last-child)::after { content: " " }`. Two reasons:
           the accessible text then actually contains the spaces, and the
           words regain a soft-wrap opportunity (adjacent inline-blocks with
           only pseudo-content between them can never break, so a long line
           would overflow instead of wrapping). If a line does wrap, the
           measuring spans report the new offsets and the clip geometry
           follows on its own — same mechanism the <br> uses. */
        if (wi < line.length - 1) measure.appendChild(document.createTextNode(" "));

        /* NB createElementNS — a document.createElement("text") would sit in
           the DOM and never render, which is the classic silent failure here. */
        var glyph = document.createElementNS(SVG_NS, "text");
        glyph.textContent = word;
        clipPath.appendChild(glyph);

        wordBoxes.push(box);
        baseMarks.push(mark);
        glyphs.push(glyph);
      }
    }

    defs.appendChild(clipPath);
    svg.appendChild(defs);

    var layer = document.createElement("span");
    layer.className = "masked-heading__reveal";
    layer.setAttribute("aria-hidden", "true");

    var clipBox = document.createElement("span");
    clipBox.className = "masked-heading__clip";
    clipBox.style.clipPath = "url(#" + clipId + ")";
    clipBox.style.webkitClipPath = "url(#" + clipId + ")";

    var media = document.createElement("span");
    media.className = "masked-heading__media";

    clipBox.appendChild(media);
    layer.appendChild(clipBox);

    root.className = root.className ? (root.className + " masked-heading") : "masked-heading";
    root.style.textAlign = o.align;
    root.style.fontWeight = String(o.weight);
    root.style.letterSpacing = o.tracking + "em";
    root.style.lineHeight = String(o.lineHeight);

    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(measure);
    root.appendChild(svg);
    root.appendChild(layer);

    /* -- 2. Media: three layers, and a fill that cannot go illegible --------

       Inside .masked-heading__media, bottom to top:

         1. the GRADIENT FLOOR — always present, never removed. While a
            photograph is still arriving, or has failed, or a <video> is
            re-buffering, this is what the letterforms show. The clip window
            therefore never shows the page ground through the letters at any
            point in the component's life, which is the one property the old
            "swap the src on a single element" design could not offer.
         2. one ELEMENT PER PHOTOGRAPH — created once, `src` assigned exactly
            once, shown and hidden by opacity. Nothing ever reassigns a src,
            so nothing is ever reset to a blank frame. (An <img>'s
            current/pending-request model hides that cost; HTMLMediaElement
            does not — .load() drops the presented frame, resets readyState to
            HAVE_NOTHING and re-fetches from the network. A themed <video>
            swap used to blank the letters for the whole of that fetch.)
         3. the TINT — one flat colour composited over everything beneath it
            with mix-blend-mode. See "THE DUOTONE" below.

       ---- THE DUOTONE ----------------------------------------------------
       These letters are windows, and a window is legible only if what is
       inside it runs opposite the ground behind the page. The component used
       to obtain that by ASKING: pick a dark photograph for `src`, a bright one
       for `srcDark`, and crank brightness in CSS when only one was supplied.
       Every part of that was a hope. A brightness crank aimed at a dark frame
       clips a bright one to white paste; a "dark" photograph chosen from its
       whole-frame mean can be bright in the narrow band this heading actually
       shows (object-fit: cover into a ~5.5:1 box, then fillScale, leaves ~5%
       of a portrait frame on screen — letterbox padding and all the sky can
       sit entirely outside it); and any of it can be wired the wrong way round
       by whoever edits the markup next.

       So legibility is no longer a property of the photograph. The tint layer
       composites the whole media box toward one ink:

         light ground — multiply toward #365A93 (royal-blue ink).
                        multiply(a, t) <= t per channel, so NO pixel can come
                        out lighter than the ink. The ink itself is the worst
                        case: 5.80:1 on the plate this heading is mounted on.
         dark ground  — screen toward #A89A75 (gilt).
                        screen(a, t) >= t per channel, so NO pixel can come out
                        darker than the gilt. Worst case 5.18:1 on the plate.

       Both are floors, not averages, and they hold for every pixel of every
       frame — measured over the eleven candidate photographs in assets/img,
       at both extremes of the drift envelope: worst single pixel 5.80:1
       (light) and 5.18:1 (dark), 0.0% of pixels below 3:1 on either. The raw
       frames score 1.49:1 to 8.13:1 with up to 92% of pixels below 3:1, which
       is the measurement the old "just pick the right photo" rule was making
       by eye. Tonal variation survives the compression (sd of CIE L* runs
       5.9-11.2 against 17-28 raw), so the letterforms still read as a
       photograph rather than as flat fill — a duotone print, which is what
       this site's whole idiom is anyway.

       `src` and `srcDark` are therefore no longer a legibility mechanism, only
       a refinement: two frames, one per impression, if the exec board has two
       worth using. One is fine. Neither is fine — the gradient floor takes
       over and is tinted by the same rule.

       ---- THE GROUND -----------------------------------------------------
       All of that is decided against the colour this heading is ACTUALLY
       painted on, read off the DOM at mount and on every theme change. It is
       not the page ground: index.html mounts this inside
       <section class="section--navy">, whose background is --plate-bg —
       #F0EBDC in the light impression and #17294B in the dark one, against the
       page's own #FBF9F3 / #0A0F1C. #17294B is five times brighter than
       #0A0F1C, so a component calibrated against the page ground would be
       calibrated against a colour it never touches.
       ---------------------------------------------------------------------- */
    var alive = true;

    /* Every pending timer, so destroy() leaves nothing running. */
    var timers = [];
    function later(fn, ms) {
      var id = window.setTimeout(function () {
        var at = timers.indexOf(id);
        if (at >= 0) timers.splice(at, 1);
        if (alive) fn();
      }, ms);
      timers.push(id);
      return id;
    }

    /* ---- Colour ---------------------------------------------------------- */
    function parseColor(v) {
      var m = /^rgba?\(([^)]+)\)$/i.exec(String(v === null || v === undefined ? "" : v).replace(/^\s+|\s+$/g, ""));
      if (!m) return null;
      var raw = m[1].replace(/\//g, " ").split(/[\s,]+/);
      var p = [];
      for (var i = 0; i < raw.length; i += 1) { if (raw[i]) p.push(parseFloat(raw[i])); }
      if (p.length < 3) return null;
      for (i = 0; i < 3; i += 1) { if (!isFinite(p[i])) return null; }
      var a = (p.length > 3 && isFinite(p[3])) ? p[3] : 1;
      return { r: p[0], g: p[1], b: p[2], a: a };
    }

    function channelL(c) {
      c = c / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }

    function luminance(c) {
      return 0.2126 * channelL(c.r) + 0.7152 * channelL(c.g) + 0.0722 * channelL(c.b);
    }

    function contrastOf(a, b) {
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }

    /* Relative luminance of the two tints in masked-heading.css §8. Keep the
       two files in step: these numbers are the whole guarantee. */
    var INK_TINT_L = 0.1020;    /* #365A93 — the light-ground duotone's ceiling */
    var GILT_TINT_L = 0.3272;   /* #A89A75 — the dark-ground duotone's floor    */

    /* The first ancestor that actually paints something is the ground. */
    function groundLuminance() {
      var el = root, guard = 48, c;
      while (el && el.nodeType === 1 && guard > 0) {
        guard -= 1;
        c = parseColor(window.getComputedStyle(el).backgroundColor);
        if (c && c.a >= 0.5) return luminance(c);
        el = el.parentNode;
      }
      return -1;    /* everything transparent — fall back to the theme flag */
    }

    function darkThemeActive() {
      return document.documentElement.getAttribute("data-theme") === "dark";
    }

    /* Which duotone reads better on that ground. Each polarity's worst case is
       its own tint (multiply can never exceed it, screen can never fall below
       it), so choosing the polarity is choosing the higher guaranteed floor —
       which also does the right thing on a ground neither impression predicted. */
    var polarity = "";

    function syncPolarity() {
      var g = groundLuminance();
      var next;
      if (g < 0) next = darkThemeActive() ? "dark" : "light";
      else next = (contrastOf(INK_TINT_L, g) >= contrastOf(GILT_TINT_L, g)) ? "light" : "dark";
      if (next === polarity) return;
      polarity = next;
      if (next === "light") {
        root.classList.add("masked-heading--on-light");
        root.classList.remove("masked-heading--on-dark");
      } else {
        root.classList.add("masked-heading--on-dark");
        root.classList.remove("masked-heading--on-light");
      }
    }

    /* ---- Sources --------------------------------------------------------- */
    var lightUrl = resolveSrc(typeof o.src === "string" ? o.src : "");
    var darkUrl = resolveSrc(typeof o.srcDark === "string" ? o.srcDark : "");

    /* TWO DISTINCT files is what arms the second fetch. The same string twice
       is one photograph, so it stays on the cheap path: one element, one
       request, nothing to swap. */
    var dualSource = !!(darkUrl && darkUrl !== lightUrl);

    /* Chosen by the measured GROUND, not by the theme attribute: the pairing
       is "dark frame for a light ground, bright frame for a dark one", and the
       ground is the thing that statement is about. */
    function urlForTheme() {
      return (dualSource && polarity === "dark") ? darkUrl : lightUrl;
    }

    /* How long a theme flip waits for a photograph before it stops holding the
       decision open. Nothing goes illegible when it expires — the outgoing
       photograph is still up and the duotone has already followed the new
       ground — so this only bounds the WAIT, never the request: the same
       waiter still fires and upgrades if the file lands afterwards. */
    var SWAP_DEADLINE = 1200;

    /* Layer 1 — the floor. First child, and it is never removed. */
    var fillEl = document.createElement("span");
    fillEl.className = "masked-heading__layer masked-heading__fill";
    media.appendChild(fillEl);

    /* Layer 3 — the duotone, appended last so every photograph AND the floor
       composite through it. */
    var tintEl = document.createElement("span");
    tintEl.className = "masked-heading__layer masked-heading__tint";
    media.appendChild(tintEl);

    var loads = {};             /* url -> record; also the "already asked for" set */
    var shownUrl = "";          /* the photograph currently at full opacity */
    var wantedUrl = "";         /* what the most recent ground decision asked for */
    var preloadQueued = false;
    var idleHandle = 0;

    function settleLoad(rec, ok) {
      if (rec.state !== "pending") return;
      rec.state = ok ? "ok" : "fail";
      if (!ok && rec.el && rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
      var list = rec.waiting;
      rec.waiting = [];
      for (var i = 0; i < list.length; i += 1) list[i](ok);
    }

    function hasFailed(url) { return !!(loads[url] && loads[url].state === "fail"); }

    /* Build the element that will BE on screen, hidden, and let it be its own
       preloader: one element per url, one request per url, src assigned once.
       (The old code decoded a throwaway probe and then set the same url on a
       different element, which for <video> shares no buffer at all and made
       the live element start over from the network.) */
    function createResource(url) {
      var rec = { url: url, state: "pending", el: null, waiting: [], onReady: null, onError: null };
      loads[url] = rec;

      rec.onError = function () { settleLoad(rec, false); };

      var el;
      if (o.mediaType === "video") {
        el = document.createElement("video");
        el.className = "masked-heading__layer masked-heading__source is-hidden";
        el.setAttribute("muted", "");
        el.setAttribute("loop", "");
        el.setAttribute("playsinline", "");
        el.setAttribute("webkit-playsinline", "");
        el.setAttribute("preload", "auto");
        el.muted = true;
        el.loop = true;
        el.playsInline = true;
        if (o.poster) el.setAttribute("poster", resolveSrc(o.poster));
        /* loadeddata, not canplaythrough: one decoded frame is all a swap
           needs, and canplaythrough can go unfired on a throttled connection. */
        rec.onReady = function () { settleLoad(rec, true); };
        el.addEventListener("loadeddata", rec.onReady);
        el.addEventListener("error", rec.onError);
        rec.el = el;
        media.insertBefore(el, tintEl);
        el.setAttribute("src", url);          /* set last, after the listeners */
        return rec;
      }

      el = document.createElement("img");
      el.className = "masked-heading__layer masked-heading__source is-hidden";
      el.setAttribute("alt", "");
      el.setAttribute("draggable", "false");
      el.setAttribute("decoding", "async");
      rec.onReady = function () {
        /* The bytes arrived; they still have to RASTER. A frame that is too
           large for the device fires `load` and then fails to decode, firing
           NO error — the one case that used to be banked as a success and
           committed to the live element, where it painted an empty window with
           no recovery path. decode() is the only thing that separates the two.
           Nothing ever reassigns this element's src, so the "superseded
           request" rejection that once excused ignoring it cannot arise here:
           a rejection means the file is undecodable, and it is treated as the
           failure it is. */
        if (typeof el.decode !== "function") { settleLoad(rec, true); return; }
        el.decode().then(function () { settleLoad(rec, true); },
                         function () { settleLoad(rec, false); });
      };
      el.addEventListener("load", rec.onReady);
      el.addEventListener("error", rec.onError);
      rec.el = el;
      media.insertBefore(el, tintEl);
      el.setAttribute("src", url);            /* set last, after the listeners */
      return rec;
    }

    /* A url whose state is already known answers SYNCHRONOUSLY, which is what
       makes the second flip of the theme instant. `done` may be called twice
       when a deadline is given: once with false on expiry, once for real. */
    function loadResource(url, done, deadline) {
      var rec = loads[url] || createResource(url);
      if (rec.state !== "pending") { if (done) done(rec.state === "ok"); return; }
      if (!done) return;
      rec.waiting.push(done);
      if (deadline > 0) {
        later(function () { if (rec.state === "pending") done(false); }, deadline);
      }
    }

    /* Show one photograph, hide every other. The floor is under all of them,
       so showPhoto("") IS the whole fallback path — there is no state in which
       the clip window shows the page ground through the letters. */
    function showPhoto(url) {
      var k, rec, el, played;
      for (k in loads) {
        if (!hasOwn(loads, k)) continue;
        rec = loads[k];
        el = rec.el;
        if (!el) continue;
        if (k === url) {
          el.classList.remove("is-hidden");
          if (o.mediaType === "video") {
            played = el.play ? el.play() : null;
            if (played && typeof played["catch"] === "function") played["catch"](function () {});
          }
        } else {
          el.classList.add("is-hidden");
          /* A hidden <video> keeps its decoded buffer — that is the point of
             keeping it — but it must not go on costing frames. */
          if (o.mediaType === "video" && el.pause) { try { el.pause(); } catch (e) {} }
        }
      }
      shownUrl = url || "";
    }

    /* The wanted photograph is unavailable (broken, or still in flight past the
       deadline). Whatever is on screen is legible under EITHER duotone — that
       is what the tint bought — so the outgoing frame is left up rather than
       dropped, and only a window with no photograph at all falls back to the
       floor. A failed srcDark therefore costs the dark impression its second
       frame, not its legibility. */
    function keepWhatIsUp() {
      if (shownUrl && loads[shownUrl] && loads[shownUrl].state === "ok") return;
      showPhoto("");
    }

    /* Called at mount and on every ground change. Decode first, commit second. */
    function applySource() {
      var url = urlForTheme();
      wantedUrl = url;
      if (!url) { showPhoto(""); return; }        /* empty src — no failed request */
      if (shownUrl === url) return;               /* already on screen */
      if (hasFailed(url)) { keepWhatIsUp(); return; }

      loadResource(url, function (ok) {
        /* A visitor can flip the toggle twice before a file lands; only the
           newest decision is allowed to paint. */
        if (!alive || wantedUrl !== url) return;
        if (ok) { showPhoto(url); preloadOther(); return; }
        keepWhatIsUp();
      }, SWAP_DEADLINE);
    }

    /* The second photograph is worth having in cache before the visitor reaches
       the toggle — but not at the expense of the one on screen, so it waits for
       the visible source to settle and then goes on idle time. With srcDark
       absent there is no second url and this issues NO request. */
    function preloadOther() {
      if (!dualSource || preloadQueued) return;
      var other = (urlForTheme() === darkUrl) ? lightUrl : darkUrl;
      if (!other || loads[other]) return;
      preloadQueued = true;
      var run = function () { idleHandle = 0; if (alive) loadResource(other, null, 0); };
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(run, { timeout: 2000 });
      } else {
        later(run, 600);
      }
    }

    /* First paint: the polarity class is on the root before anything can be
       shown, and createResource() sets the src synchronously inside this call,
       so the initial request still starts on the same tick it always did. What
       changed is that the element stays hidden until it has decoded — the
       floor covers that gap, and there is no half-painted frame. */
    syncPolarity();
    applySource();

    /* theme.js writes data-theme on <html> and fires no event, so the attribute
       itself is what gets watched (same idiom as strands.js). The observer is
       wired in §7, and now unconditionally: the DUOTONE follows the theme even
       when there is only one photograph, and the old code left it uncreated in
       exactly that case. */
    var themeAttr = document.documentElement.getAttribute("data-theme") || "";

    function onThemeChange() {
      if (!alive) return;
      var next = document.documentElement.getAttribute("data-theme") || "";
      if (next === themeAttr) return;
      themeAttr = next;
      /* Polarity first, then the photograph. The tint is a class on the root
         and takes effect on the same frame as the ground it answers, so the
         window in which the new ground was showing the old ground's treatment
         — which used to last for the whole of the second file's download, and
         forever on a stalled request — no longer exists. */
      syncPolarity();
      applySource();
    }

    /* -- 3. place() — drift/parallax transform, clamped so the scaled-up
           media can never expose an edge. ---------------------------------- */
    var off = { x: 0, y: 0, tx: 0, ty: 0 };

    function place() {
      var W = root.clientWidth;
      var H = root.clientHeight;
      var maxX = Math.max(0, ((o.fillScale - 1) / 2) * W);
      var maxY = Math.max(0, ((o.fillScale - 1) / 2) * H);
      media.style.transform =
        "translate3d(" + clamp(off.x, -maxX, maxX).toFixed(2) + "px, " +
        clamp(off.y, -maxY, maxY).toFixed(2) + "px, 0) scale(" + o.fillScale + ")";
      media.style.filter =
        "brightness(" + o.brightness + ") saturate(" + o.saturation + ")" +
        (o.grayscale ? " grayscale(1)" : "");
    }

    /* -- 4. sync() — THE CRITICAL STEP. Copy each measuring span's
           offsetLeft / baseline offsetTop and computed font styles onto the
           matching SVG <text>, so the clip path lands exactly on the layout.
           The <br> in the measuring markup is what makes the second line work:
           its words simply report a larger offsetTop and the geometry follows.
           ------------------------------------------------------------------ */
    function sync() {
      var w = root.clientWidth;
      if (!w) return;

      /* Container-relative sizing only when textScale is a number. In "css"
         mode we deliberately never touch root.style.fontSize, so the site's
         own h2 { font-size: clamp(...) } governs and everything below reads
         back whatever it produced. */
      if (scaleIsNumeric) {
        var size = clamp(w * o.textScale, o.minFontSize, o.maxFontSize).toFixed(1) + "px";
        if (root.style.fontSize !== size) root.style.fontSize = size;
      }

      var cs = window.getComputedStyle(measure);
      for (var i = 0; i < glyphs.length; i += 1) {
        var box = wordBoxes[i], base = baseMarks[i], glyph = glyphs[i];
        if (!box || !base || !glyph) continue;
        glyph.setAttribute("x", String(box.offsetLeft));
        glyph.setAttribute("y", String(base.offsetTop));
        glyph.style.fontFamily = cs.fontFamily;
        glyph.style.fontSize = cs.fontSize;
        glyph.style.fontWeight = cs.fontWeight;
        glyph.style.fontStyle = cs.fontStyle;
        glyph.style.letterSpacing = cs.letterSpacing;
      }
      place();
    }

    /* -- 5. Reveal ---------------------------------------------------------- */
    var revealRaf = 0;
    var revealCleanup = null;

    function stopReveal() {
      if (revealRaf) { cancelAnimationFrame(revealRaf); revealRaf = 0; }
    }

    function setGlyphY(i, y) {
      glyphs[i].setAttribute("transform", "translate(0," + y.toFixed(2) + ")");
    }

    function setLayerClip(v) {
      layer.style.clipPath = v;
      layer.style.webkitClipPath = v;
    }

    function riseDistance() {
      return (parseFloat(window.getComputedStyle(root).fontSize) || 48) * 1.15;
    }

    function settle() {
      for (var i = 0; i < glyphs.length; i += 1) setGlyphY(i, 0);
      layer.style.opacity = "1";
      layer.style.transform = "none";
      setLayerClip("inset(0% 0% 0% 0%)");
    }

    function rest() {
      var i;
      if (o.reveal === "rise") {
        var d = riseDistance();
        for (i = 0; i < glyphs.length; i += 1) setGlyphY(i, d);
      } else if (o.reveal === "wipe") {
        setLayerClip("inset(0% 100% 0% 0%)");
      } else if (o.reveal === "fade") {
        layer.style.opacity = "0";
        layer.style.transform = "scale(1.08)";
      }
    }

    function play() {
      stopReveal();
      if (o.reveal === "none" || reducedMotion()) { settle(); return; }

      var dur = Math.max(10, o.duration * 1000);
      var start = -1;
      var i;

      if (o.reveal === "rise") {
        layer.style.opacity = "1";
        layer.style.transform = "none";
        setLayerClip("inset(0% 0% 0% 0%)");
        var dist = riseDistance();
        var stagger = Math.max(0, o.stagger) * 1000;
        /* Apply the from-state synchronously so "mount"/"hover" never paint a
           single frame of the settled heading before the tween's first tick. */
        for (i = 0; i < glyphs.length; i += 1) setGlyphY(i, dist);

        revealRaf = requestAnimationFrame(function riseFrame(t) {
          if (start < 0) start = t;
          var elapsed = t - start;
          var done = true;
          for (i = 0; i < glyphs.length; i += 1) {
            var p = (elapsed - i * stagger) / dur;
            if (p < 0) p = 0;
            if (p < 1) done = false; else p = 1;
            setGlyphY(i, dist * (1 - easeOutQuart(p)));
          }
          revealRaf = done ? 0 : requestAnimationFrame(riseFrame);
        });
        return;
      }

      if (o.reveal === "wipe") {
        for (i = 0; i < glyphs.length; i += 1) setGlyphY(i, 0);
        layer.style.opacity = "1";
        layer.style.transform = "none";
        setLayerClip("inset(0% 100% 0% 0%)");

        revealRaf = requestAnimationFrame(function wipeFrame(t) {
          if (start < 0) start = t;
          var p = clamp((t - start) / dur, 0, 1);
          setLayerClip("inset(0% " + (100 * (1 - easeInOutCubic(p))).toFixed(2) + "% 0% 0%)");
          revealRaf = p >= 1 ? 0 : requestAnimationFrame(wipeFrame);
        });
        return;
      }

      /* fade */
      for (i = 0; i < glyphs.length; i += 1) setGlyphY(i, 0);
      setLayerClip("inset(0% 0% 0% 0%)");
      layer.style.opacity = "0";
      layer.style.transform = "scale(1.08)";
      revealRaf = requestAnimationFrame(function fadeFrame(t) {
        if (start < 0) start = t;
        var p = clamp((t - start) / dur, 0, 1);
        var e = easeOutCubic(p);
        layer.style.opacity = String(e);
        layer.style.transform = "scale(" + (1.08 + (1 - 1.08) * e).toFixed(4) + ")";
        if (p >= 1) { layer.style.transform = "none"; revealRaf = 0; return; }
        revealRaf = requestAnimationFrame(fadeFrame);
      });
    }

    function setupReveal() {
      if (revealCleanup) { revealCleanup(); revealCleanup = null; }
      stopReveal();
      if (!glyphs.length) return;

      if (o.reveal === "none" || reducedMotion()) { settle(); return; }

      if (o.trigger === "hover") {
        settle();
        root.addEventListener("pointerenter", play);
        revealCleanup = function () { root.removeEventListener("pointerenter", play); };
        return;
      }

      if (o.trigger === "view") {
        settle();
        rest();
        if (!("IntersectionObserver" in window)) { play(); return; }
        var io = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i += 1) {
            if (entries[i].isIntersecting) { play(); io.disconnect(); return; }
          }
        }, { threshold: 0.25 });
        io.observe(root);
        revealCleanup = function () { io.disconnect(); };
        return;
      }

      play();
    }

    /* -- 6. Ambient drift + damped pointer parallax ------------------------ */
    var raf = 0;
    var running = false;
    var last = 0;
    var clock = 0;

    function frame(t) {
      var dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      clock += dt;

      var dx = Math.sin(clock * 0.21) * o.drift;
      var dy = Math.cos(clock * 0.17) * o.drift * 0.6;

      var ease = 1 - Math.exp(-dt / 0.18);
      off.x += (off.tx + dx - off.x) * ease;
      off.y += (off.ty + dy - off.y) * ease;

      place();
      raf = requestAnimationFrame(frame);
    }

    function startLoop() {
      if (running || reducedMotion()) return;
      running = true;
      last = now();
      root.classList.remove("is-paused");
      raf = requestAnimationFrame(frame);
    }

    function stopLoop() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      root.classList.add("is-paused");
    }

    function onMove(e) {
      if (o.parallax <= 0) return;
      var r = root.getBoundingClientRect();
      var nx = ((e.clientX - r.left) / (r.width || 1)) * 2 - 1;
      var ny = ((e.clientY - r.top) / (r.height || 1)) * 2 - 1;
      off.tx = clamp(nx, -1, 1) * -o.parallax;
      off.ty = clamp(ny, -1, 1) * -o.parallax;
    }

    function onLeave() { off.tx = 0; off.ty = 0; }

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);

    /* -- 7. Observers ------------------------------------------------------ */
    sync();
    setupReveal();

    /* Re-measure on resize. The window listener runs IN ADDITION to the
       ResizeObserver, not as a fallback for it: in "css" mode the heading's
       font-size comes from a vw-based clamp(), and there is a band where the
       viewport changes the computed font-size while the root's own box does
       NOT change (viewport 1180-1222px — .wrap is already capped at 1180, so
       the column stays 542px wide). A ResizeObserver alone can miss that and
       the clip would drift out of alignment against the layout. rAF-throttled
       so a drag-resize coalesces to one sync per frame. */
    var ro = null;
    var resizeRaf = 0;
    function onResize() {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(function () { resizeRaf = 0; sync(); });
    }
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(sync);
      ro.observe(root);
    }
    window.addEventListener("resize", onResize);

    /* Watch the theme. Wired whether or not there are two photographs to
       choose between: the DUOTONE follows the theme on its own, and a heading
       with a single photograph needs the polarity flipped just as much as one
       with two. (This observer used to be created only in the dual-source
       case, which is precisely the case index.html does NOT use.) */
    var themeObserver = null;
    if ("MutationObserver" in window) {
      themeObserver = new MutationObserver(onThemeChange);
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"]
      });
    }

    /* The site loads Cormorant Garamond from Google Fonts — the clip geometry
       is measured against the fallback serif until it lands, so re-measure.
       (`alive` is declared up in §2, where the async media loads need it.) */
    var loadFallback = false;
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
      document.fonts.ready.then(function () {
        if (alive) sync();
      })["catch"](function () {});
    } else {
      loadFallback = true;
      window.addEventListener("load", sync);
    }

    /* Pause the rAF loop (and the gradient's CSS animation) while the heading
       is off-screen, and while the whole tab is hidden. inView is tracked
       separately from the observer callback so that a tab which loads in the
       background still starts the loop when it is finally brought forward. */
    var inView = false;
    var pauseIo = null;

    function refreshLoop() {
      if (inView && !document.hidden) startLoop(); else stopLoop();
    }

    if ("IntersectionObserver" in window) {
      pauseIo = new IntersectionObserver(function (entries) {
        var visible = false;
        for (var i = 0; i < entries.length; i += 1) { if (entries[i].isIntersecting) visible = true; }
        inView = visible;
        refreshLoop();
      }, { threshold: 0 });
      pauseIo.observe(root);
    } else {
      inView = true;
      refreshLoop();
    }

    function onVisibility() { refreshLoop(); }
    document.addEventListener("visibilitychange", onVisibility);

    /* Reduced motion, including live changes to the setting. */
    var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    function onMotionChange() {
      if (reducedMotion()) {
        stopLoop();
        off.x = 0; off.y = 0; off.tx = 0; off.ty = 0;
        place();
        settle();
      } else {
        setupReveal();
        refreshLoop();
      }
    }
    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", onMotionChange);
      else if (mq.addListener) mq.addListener(onMotionChange);
    }
    if (reducedMotion()) { settle(); place(); }

    /* -- 8. destroy -------------------------------------------------------- */
    return function destroy() {
      alive = false;
      stopLoop();
      stopReveal();
      if (revealCleanup) { revealCleanup(); revealCleanup = null; }
      if (ro) ro.disconnect();
      if (pauseIo) pauseIo.disconnect();
      if (themeObserver) { themeObserver.disconnect(); themeObserver = null; }
      if (resizeRaf) { cancelAnimationFrame(resizeRaf); resizeRaf = 0; }
      window.removeEventListener("resize", onResize);
      if (loadFallback) window.removeEventListener("load", sync);
      document.removeEventListener("visibilitychange", onVisibility);
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", onMotionChange);
        else if (mq.removeListener) mq.removeListener(onMotionChange);
      }
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);

      /* Media: every timer, the idle callback and every listener on every
         element this component ever created — one per url, not one in total. */
      for (var t = 0; t < timers.length; t += 1) window.clearTimeout(timers[t]);
      timers.length = 0;
      if (idleHandle && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      idleHandle = 0;
      for (var url in loads) {
        if (!hasOwn(loads, url)) continue;
        var rec = loads[url];
        if (!rec.el) continue;
        if (rec.onError) rec.el.removeEventListener("error", rec.onError);
        if (rec.onReady) {
          rec.el.removeEventListener(o.mediaType === "video" ? "loadeddata" : "load", rec.onReady);
        }
        if (o.mediaType === "video" && rec.el.pause) { try { rec.el.pause(); } catch (e) {} }
        rec.waiting.length = 0;
      }
    };
  }

  window.LPHIE.components.maskedHeading = mount;

  /* ---- auto-init --------------------------------------------------------- */
  function autoInit() {
    var nodes = document.querySelectorAll("[data-masked-heading]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-masked-heading");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
