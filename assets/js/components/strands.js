/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   Strands — vanilla port of the React Bits component of the same name.
   No dependencies. Works from file:// as well as a web server.

   The reference draws a fullscreen quad through OGL and GLSL ES 3.00; this
   port talks to raw WebGL1 and GLSL ES 1.00, but the strand maths is the
   reference's, line for line —

     uResolution uTime uSpeed uAmplitude uWaviness uThickness uGlow uTaper
     uSpread uHueShift uIntensity uSaturation uOpacity uScale uCount
     uColorCount uColors[]

   — one sine-composited wavy line per strand, brightness falling off as the
   square of an inverse distance, an envelope tapering the band towards the
   left and right edges, a palette sampled by a hue that walks with both the
   strand index and the horizontal position, then a tone map, a saturation
   mix, and premultiplied alpha over a transparent canvas.

   The reference's optional glass lens pass is omitted deliberately: this house
   style is engraved, not lensed.

   RESTRAINT is the whole point. The chapter's own navy and gilt, low opacity,
   a slow drift — a faint aurora of chapter colour behind the type, never a
   demo reel. The palette is picked per theme and re-picked when the theme
   changes, because an additive glow that reads on midnight stock is invisible
   on near-white paper and the other way about; §1 says why each stop is what
   it is.

   CRITICAL, and the reason no page can be broken by this file: if a WebGL
   context cannot be had, or either shader fails to compile, or the program
   fails to link, the canvas is never added to the document at all. The host is
   left as an empty transparent element of the right height, so the page keeps
   its rhythm and never shows a black rectangle. Nothing is logged, ever.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Defaults ------------------------------------------------------- */
  /* Compile-time ceilings. GLSL ES 1.00 will not index a uniform array with a
     general expression and will not run a loop with a variable bound, so both
     loops in the shader run to these constants and break on the live count —
     exactly as the reference does. */
  var MAX_STRANDS = 12;
  var MAX_COLORS = 8;

  /* The band is decorative, so a 1.5x backing store is plenty; a retina cap of
     2 would double the fill for a glow nobody is inspecting closely. */
  var MAX_DPR = 1.5;

  /* Theme-independent geometry. Same prop names as the React component. */
  var BASE = {
    count: 5,             /* strands, 1..12                                  */
    speed: 0.18,          /* phase rate; the shader adds 1.4..6.2 per strand */
    amplitude: 0.85,      /* weave height, ~40% of the band's half-height    */
    waviness: 0.8,        /* roughly one long wave across the page           */
    thickness: 0.75,      /* hairline core, ~6px on a 168px band             */
    taper: 2.2,           /* exponent on the edge envelope                   */
    spread: 1.0,          /* per-strand phase offset multiplier              */
    hueShift: 0,          /* 0..1, rotates the palette                       */
    intensity: 0.32,      /* 0..1; drives thickness, amplitude and gain      */
    saturation: 1.0,      /* 1 = leave the tone-mapped colour alone          */
    scale: 2.2,           /* reference zoom; see fitScale() for what fit does */
    fit: true             /* snap the zoom so the envelope dies at the edges */
  };

  /* Theme-dependent light. On near-white paper the composite can only darken
     the ground towards the strand's own colour, so a warm gilt stop would
     bleach into the paper and vanish — the light palette is therefore the navy
     family alone, read as blue ink on laid paper. On the blue-black ground the
     opposite holds: gilt lifts off it cleanly, and one lit navy stop keeps the
     band from reading as a single flat wash. Dark also runs a much lower glow,
     because the tone map flattens a bright core towards white and gilt only
     stays gilt while it is held in the linear part of the curve. */
  var THEMES = {
    light: {
      colors: ["#1B3057", "#24406F", "#2C4C82"],   /* navy-700/600/500 */
      glow: 0.55,
      opacity: 0.34
    },
    dark: {
      colors: ["#24406F", "#C9B98E", "#D2C199"],   /* lit navy, gilt, pale gilt */
      glow: 0.25,
      opacity: 0.58
    }
  };

  var NUMERIC = [
    "count", "speed", "amplitude", "waviness", "thickness", "glow", "taper",
    "spread", "hueShift", "intensity", "saturation", "opacity", "scale"
  ];
  var BOOLEAN = ["fit"];

  /* ---- 2. Shaders -------------------------------------------------------- */
  /* No varying: every strand is placed from gl_FragCoord, as in the reference,
     so the vertex stage has nothing to hand across. */
  var VERT = [
    "attribute vec2 aPosition;",
    "void main() {",
    "  gl_Position = vec4(aPosition, 0.0, 1.0);",
    "}"
  ].join("\n");

  var FRAG = [
    /* Not every GL ES 2 fragment stage has highp; ask for it, accept mediump. */
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "",
    "#define MAX_STRANDS " + MAX_STRANDS,
    "#define MAX_COLORS " + MAX_COLORS,
    "",
    "uniform vec2  uResolution;",
    "uniform float uTime;",
    "uniform float uSpeed;",
    "uniform float uAmplitude;",
    "uniform float uWaviness;",
    "uniform float uThickness;",
    "uniform float uGlow;",
    "uniform float uTaper;",
    "uniform float uSpread;",
    "uniform float uHueShift;",
    "uniform float uIntensity;",
    "uniform float uSaturation;",
    "uniform float uOpacity;",
    "uniform float uScale;",
    "uniform int   uCount;",
    "uniform int   uColorCount;",
    "uniform vec3  uColors[MAX_COLORS];",
    "",
    "const float PI = 3.14159265359;",
    "",
    /* --- palette: fract(t) spread across the stops, each mixed into the next,
           the last wrapping back to the first ------------------------------ */
    /* uColors may only be indexed by a constant expression under ES 1.00, and
       a loop index counts as one — hence the sweep rather than two lookups. */
    "vec3 paletteColor(float t) {",
    "  float f = fract(t) * float(uColorCount);",
    "  float base = floor(f);",
    "  float k = f - base;",
    "  int idx = int(base);",
    "  if (idx >= uColorCount) idx = 0;",
    "  int nxt = idx + 1;",
    "  if (nxt >= uColorCount) nxt = 0;",
    "  vec3 a = uColors[0];",
    "  vec3 b = uColors[0];",
    "  for (int i = 0; i < MAX_COLORS; i++) {",
    "    if (i >= uColorCount) break;",
    "    if (i == idx) a = uColors[i];",
    "    if (i == nxt) b = uColors[i];",
    "  }",
    "  return mix(a, b, k);",
    "}",
    "",
    "void main() {",
    /* Height-normalised, centred coordinates, then the zoom. */
    "  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;",
    "  uv /= max(uScale, 0.0001);",
    "",
    "  float e = 0.06 + uIntensity * 0.94;",
    "  float env = pow(max(cos(uv.x * PI * 1.3), 0.0), uTaper);",
    "  float count = float(uCount);",
    "  float tt = uTime * uSpeed;",
    "",
    "  vec3 col = vec3(0.0);",
    "  for (int i = 0; i < MAX_STRANDS; i++) {",
    "    if (i >= uCount) break;",
    "    float fi = float(i);",
    "    float ph = fi * 1.7 * uSpread;",
    "    float freq = (2.0 + fi * 0.35) * uWaviness;",
    "    float spd = 1.4 + fi * 1.2;",
    "    float w = sin(uv.x * freq + tt * spd + ph) * 0.60",
    "            + sin(uv.x * freq * 1.1 - tt * spd * 0.7 + ph * 1.7) * 0.40;",
    "    float amp = (0.1 + 0.02 * e) * env * uAmplitude;",
    "    float y = w * amp;",
    "    float d = abs(uv.y - y);",
    "    float thick = (0.001 + 0.05 * e) * (0.35 + env) * uThickness;",
    "    float g = thick / (d + thick * 0.45);",
    "    g = g * g;",
    "    float h = fi / count + uv.x * 0.30 + uTime * 0.04 + uHueShift;",
    "    col += paletteColor(h) * g * env;",
    "  }",
    "",
    "  col *= 0.45 + 0.7 * e;",
    "  col = 1.0 - exp(-col * uGlow);",
    "",
    "  float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));",
    "  col = max(mix(vec3(gray), col, uSaturation), 0.0);",
    "",
    /* Premultiplied: every channel is already scaled by uOpacity, and alpha is
       the brightest channel, so col <= alpha everywhere and the blend is the
       plain source-over of ONE, ONE_MINUS_SRC_ALPHA. */
    "  float alpha = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0) * uOpacity;",
    "  gl_FragColor = vec4(col * uOpacity, alpha);",
    "}"
  ].join("\n");

  /* ---- 3. Helpers -------------------------------------------------------- */
  function num(v, fallback) {
    var n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function now() {
    return (window.performance && window.performance.now)
      ? window.performance.now() : Date.now();
  }

  /* "#1B3057" -> [r, g, b] in 0..1. Anything unparseable falls back to navy. */
  function hexToRgb(hex) {
    var s = String(hex).trim().replace(/^#/, "");
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    if (!/^[0-9a-fA-F]{6}$/.test(s)) s = "1B3057";
    return [
      parseInt(s.slice(0, 2), 16) / 255,
      parseInt(s.slice(2, 4), 16) / 255,
      parseInt(s.slice(4, 6), 16) / 255
    ];
  }

  /* The site writes data-theme on <html> and flips it at runtime. */
  function themeName() {
    var t = document.documentElement.getAttribute("data-theme");
    return t === "dark" ? "dark" : "light";
  }

  function reducedMotion() {
    return !!(window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function settings(options, theme) {
    var themed = THEMES[theme] || THEMES.light;
    var d = {}, o = {}, k, i, list;

    for (k in BASE) { if (has(BASE, k)) d[k] = BASE[k]; }
    for (k in themed) { if (has(themed, k)) d[k] = themed[k]; }
    for (k in d) { if (has(d, k)) o[k] = d[k]; }

    if (options) {
      for (k in options) {
        if (!has(options, k)) continue;
        if (options[k] === null || options[k] === undefined) continue;
        o[k] = options[k];
      }
    }
    for (i = 0; i < NUMERIC.length; i++) o[NUMERIC[i]] = num(o[NUMERIC[i]], d[NUMERIC[i]]);
    for (i = 0; i < BOOLEAN.length; i++) o[BOOLEAN[i]] = !!o[BOOLEAN[i]];

    o.count = clamp(Math.round(o.count), 1, MAX_STRANDS);
    o.speed = clamp(o.speed, 0, 4);
    o.amplitude = clamp(o.amplitude, 0, 4);
    o.waviness = clamp(o.waviness, 0.05, 6);
    o.thickness = clamp(o.thickness, 0.05, 6);
    o.glow = clamp(o.glow, 0.02, 8);
    o.taper = clamp(o.taper, 0.05, 12);
    o.spread = clamp(o.spread, 0, 8);
    o.intensity = clamp(o.intensity, 0, 1);
    o.saturation = clamp(o.saturation, 0, 2);
    o.opacity = clamp(o.opacity, 0, 1);
    o.scale = clamp(o.scale, 0.05, 40);

    /* A colour list is taken only when it really is a list; anything else
       falls back to the theme's own stops rather than half-parsing. */
    list = (Array.isArray(o.colors) && o.colors.length) ? o.colors : d.colors;
    o.colors = [];
    for (i = 0; i < list.length && i < MAX_COLORS; i++) o.colors.push(hexToRgb(list[i]));
    if (!o.colors.length) o.colors.push(hexToRgb(d.colors[0]));
    return o;
  }

  /* ---- 4. WebGL renderer -------------------------------------------------- */
  /* Returns null when anything at all goes wrong; the caller then leaves the
     host empty. Nothing in here throws upwards. */
  function createGL(canvas) {
    var gl = null, i;
    var attrs = {
      alpha: true, antialias: true, depth: false, stencil: false,
      premultipliedAlpha: true
    };

    try {
      gl = canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
    } catch (e) { gl = null; }
    if (!gl) return null;

    function compile(type, source) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    }

    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, "aPosition");
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);

    /* Fullscreen triangle — one primitive, no index buffer. */
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    /* Transparent ground, premultiplied source-over. The band has to sit on
       whatever colour the page ground happens to be, not paint a plate. */
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    var U = {};
    var names = [
      "uResolution", "uTime", "uSpeed", "uAmplitude", "uWaviness", "uThickness",
      "uGlow", "uTaper", "uSpread", "uHueShift", "uIntensity", "uSaturation",
      "uOpacity", "uScale", "uCount", "uColorCount"
    ];
    for (i = 0; i < names.length; i++) U[names[i]] = gl.getUniformLocation(program, names[i]);
    U.uColors = gl.getUniformLocation(program, "uColors[0]");

    var cfg = null;
    var pw = 1, ph = 1;
    var palette = new Float32Array(MAX_COLORS * 3);

    /* The envelope pow(max(cos(uv.x * PI * 1.3), 0), taper) is periodic: it is
       alive for |uv.x| < 0.385 + 1.538k and dead in the gaps between, and its
       deepest dead points sit at uv.x = (2k + 1) / 1.3. A full-bleed band is
       far wider than the reference's 16:9 frame, so left to itself the page
       edge lands wherever it likes — sometimes mid-lobe, which cuts a strand
       off at full brightness.

       fit therefore picks the zoom that puts a dead point exactly on the page
       edge, choosing whichever odd multiple leaves the zoom nearest the one
       the author asked for. That is a pure zoom, so it would also change the
       weave's height, the hairline's width and the wavelength in pixels: the
       two length-like values are divided back by the change and the frequency,
       being an inverse length, is multiplied by it. The band therefore keeps
       exactly the same proportions at every viewport width and simply shows
       one, three or five lobes of aurora as there is room for them. */
    function pushLook() {
      if (!cfg) return;
      var s = cfg.scale;
      var lengthF = 1;
      var freqF = 1;
      var half, k, fitted;

      if (cfg.fit && ph > 0) {
        half = (pw * 0.5) / ph;
        k = Math.round((half * 1.3 / s - 1) * 0.5);
        k = clamp(k, 0, 12);
        fitted = half * 1.3 / (2 * k + 1);
        if (fitted > 0.0001) {
          lengthF = s / fitted;
          freqF = fitted / s;
          s = fitted;
        }
      }

      gl.uniform1f(U.uScale, s);
      gl.uniform1f(U.uAmplitude, cfg.amplitude * lengthF);
      gl.uniform1f(U.uThickness, cfg.thickness * lengthF);
      gl.uniform1f(U.uWaviness, cfg.waviness * freqF);
      gl.uniform1f(U.uSpeed, cfg.speed);
      gl.uniform1f(U.uGlow, cfg.glow);
      gl.uniform1f(U.uTaper, cfg.taper);
      gl.uniform1f(U.uSpread, cfg.spread);
      gl.uniform1f(U.uHueShift, cfg.hueShift);
      gl.uniform1f(U.uIntensity, cfg.intensity);
      gl.uniform1f(U.uSaturation, cfg.saturation);
      gl.uniform1f(U.uOpacity, cfg.opacity);
      gl.uniform1i(U.uCount, cfg.count);
    }

    var api = {
      kind: "webgl",

      /* Static uniforms only; uTime is the one thing draw() uploads. */
      setConfig: function (next) {
        var j, c, n;
        cfg = next;
        n = cfg.colors.length;
        for (j = 0; j < MAX_COLORS; j++) {
          c = cfg.colors[j < n ? j : n - 1];
          palette[j * 3] = c[0];
          palette[j * 3 + 1] = c[1];
          palette[j * 3 + 2] = c[2];
        }
        gl.uniform3fv(U.uColors, palette);
        gl.uniform1i(U.uColorCount, n);
        pushLook();
      },

      resize: function (w, h, dpr) {
        var nw = Math.max(1, Math.round(w * dpr));
        var nh = Math.max(1, Math.round(h * dpr));
        if (canvas.width !== nw || canvas.height !== nh) {
          canvas.width = nw;
          canvas.height = nh;
        }
        pw = nw;
        ph = nh;
        gl.viewport(0, 0, nw, nh);
        gl.uniform2f(U.uResolution, nw, nh);
        pushLook();
      },

      /* Blending accumulates, so unlike an opaque pass this one must clear. */
      draw: function (t) {
        gl.uniform1f(U.uTime, t);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },

      destroy: function () {
        try {
          gl.deleteBuffer(buffer);
          gl.deleteProgram(program);
          var lose = gl.getExtension("WEBGL_lose_context");
          if (lose) lose.loseContext();
        } catch (e) { /* teardown is best-effort */ }
      }
    };

    return api;
  }

  /* ---- 5. Mount ---------------------------------------------------------- */
  function mount(root, options) {
    if (!root) return function () {};

    var raw = options || {};
    var theme = themeName();
    var reduced = reducedMotion();
    var cfg = settings(raw, theme);

    /* state */
    var canvas = null;
    var renderer = null;
    var rafId = null;
    var resizeTimer = 0;
    var running = false;
    var inView = false;
    var sized = false;           /* a box has been measured at least once    */
    var destroyed = false;
    var elapsed = 0;             /* seconds of animation actually rendered   */
    var last = 0;                /* previous frame stamp; 0 = no frame yet   */

    /* ---- 5a. Skeleton ---------------------------------------------------- */
    /* Purely decorative: hidden from the accessibility tree, never focusable,
       and pointer-transparent so it can never eat a click. */
    root.classList.add("strands");
    root.setAttribute("aria-hidden", "true");

    canvas = document.createElement("canvas");
    canvas.className = "strands__canvas";
    canvas.setAttribute("aria-hidden", "true");

    renderer = createGL(canvas);
    if (!renderer) {
      /* The host keeps its height so the page's rhythm survives, and that is
         all it keeps: no canvas, no plate, no black rectangle. */
      canvas = null;
    } else {
      root.appendChild(canvas);
      renderer.setConfig(cfg);
    }

    /* ---- 5b. Sizing ------------------------------------------------------ */
    function resize() {
      if (destroyed || !renderer) return;
      var rect = root.getBoundingClientRect();
      var dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      if (!rect.width || !rect.height) return;
      renderer.resize(rect.width, rect.height, dpr);
      sized = true;
      if (!running) renderer.draw(elapsed);
    }

    /* Coalesce a drag-resize into one measurement every 120ms. */
    function scheduleResize() {
      if (resizeTimer || destroyed) return;
      resizeTimer = window.setTimeout(function () {
        resizeTimer = 0;
        resize();
      }, 120);
    }

    /* ---- 5c. Loop -------------------------------------------------------- */
    /* dt is accumulated rather than read from the clock, so a loop that has
       been parked for a minute — off-screen, or in a background tab — comes
       back exactly where it left off instead of snapping forward. The per
       frame clamp covers the first frame after a resume and any single long
       stall. */
    function frame(ts) {
      rafId = null;
      if (destroyed || !renderer) return;

      /* A host with no box yet — a display:none ancestor, a stylesheet still
         landing — has no resolution to divide by, so wait rather than draw. */
      if (!sized) {
        resize();
        if (!sized) {
          if (running) rafId = requestAnimationFrame(frame);
          return;
        }
      }

      var t = typeof ts === "number" ? ts : now();
      if (last === 0) last = t;
      var dt = (t - last) / 1000;
      last = t;
      if (dt < 0) dt = 0;
      if (dt > 0.05) dt = 0.05;
      elapsed += dt;

      renderer.draw(elapsed);
      if (running) rafId = requestAnimationFrame(frame);
    }

    function startLoop() {
      if (running || destroyed || reduced || !renderer) return;
      running = true;
      last = 0;
      if (rafId === null) rafId = requestAnimationFrame(frame);
    }

    function stopLoop() {
      running = false;
      last = 0;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    }

    function refreshLoop() {
      if (inView && !document.hidden && !reduced) startLoop();
      else stopLoop();
    }

    /* ---- 5d. Theme ------------------------------------------------------- */
    /* theme.js writes data-theme on <html> and gives no event, so the
       attribute itself is what is watched. */
    function onThemeChange() {
      var next = themeName();
      if (destroyed || next === theme) return;
      theme = next;
      cfg = settings(raw, theme);
      if (renderer) {
        renderer.setConfig(cfg);
        if (!running && sized) renderer.draw(elapsed);
      }
    }

    /* ---- 5e. Wiring ------------------------------------------------------ */
    var ro = null;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(function () { scheduleResize(); });
      ro.observe(root);
    } else {
      window.addEventListener("resize", scheduleResize);
    }

    var io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (entries) {
        var visible = false;
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) visible = true;
        }
        inView = visible;
        refreshLoop();
      }, { threshold: 0 });
      io.observe(root);
    } else {
      inView = true;
    }

    function onVisibility() { refreshLoop(); }
    document.addEventListener("visibilitychange", onVisibility);

    var themeObserver = null;
    if ("MutationObserver" in window) {
      themeObserver = new MutationObserver(onThemeChange);
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"]
      });
    }

    var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    function onMotionChange(e) {
      reduced = !!(e && e.matches);
      if (reduced) {
        stopLoop();
        if (renderer && sized) renderer.draw(elapsed);
      } else {
        refreshLoop();
      }
    }
    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", onMotionChange);
      else if (mq.addListener) mq.addListener(onMotionChange);
    }

    /* A lost context is a one-way trip: the canvas goes, the host stays. */
    function onContextLost(e) {
      e.preventDefault();
      stopLoop();
      if (renderer) { renderer.destroy(); renderer = null; }
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null;
    }
    if (canvas) canvas.addEventListener("webglcontextlost", onContextLost);

    /* ---- 5f. Boot -------------------------------------------------------- */
    /* One frame is drawn immediately either way; under reduced motion it is
       also the only frame there will ever be — a still engraving. */
    resize();
    if (!io) refreshLoop();

    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      if (resizeTimer) { window.clearTimeout(resizeTimer); resizeTimer = 0; }
      document.removeEventListener("visibilitychange", onVisibility);
      if (canvas) canvas.removeEventListener("webglcontextlost", onContextLost);
      if (ro) ro.disconnect(); else window.removeEventListener("resize", scheduleResize);
      if (io) io.disconnect();
      if (themeObserver) themeObserver.disconnect();
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", onMotionChange);
        else if (mq.removeListener) mq.removeListener(onMotionChange);
      }
      if (renderer) { renderer.destroy(); renderer = null; }
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null;
      root.classList.remove("strands");
      root.removeAttribute("aria-hidden");
      root.removeAttribute("data-lphie-mounted");
    };
  }

  window.LPHIE.components.strands = mount;

  /* ---- 6. Auto-init ------------------------------------------------------- */
  function autoInit() {
    var nodes = document.querySelectorAll("[data-strands]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-strands");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
