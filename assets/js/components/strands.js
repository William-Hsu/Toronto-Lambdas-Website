/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   Strands — vanilla port of the React Bits component of the same name.
   No dependencies. Works from file:// as well as a web server.

   The reference draws a fullscreen quad through OGL and GLSL ES 3.00; this
   port talks to raw WebGL1 and GLSL ES 1.00, but the strand maths is the
   reference's, line for line —

     uResolution uTime uSpeed uAmplitude uWaviness uThickness uGlow uTaper
     uSpread uHueShift uIntensity uSaturation uOpacity uScale
     uCount uColorCount uColors[]

   — plus one uniform of this port's own, uFit, which chooses the envelope
   (below). The reference's uStretch is not implemented and is not claimed.

   — one sine-composited wavy line per strand, brightness falling off as the
   square of an inverse distance, an envelope tapering the band towards the
   left and right edges, a palette sampled by a hue that walks with both the
   strand index and the horizontal position, then a tone map, a saturation
   mix, and premultiplied alpha over a transparent canvas.

   ONE deliberate departure from the reference: the envelope, and it is the
   `fit` prop that chooses which one runs (§2).

     fit: false — the reference's own pow(cos(uv.x * PI * 1.3), taper). That
       curve is PERIODIC in uv.x: alive for half of every period and dead for
       the other half. uv.x is height-normalised, so a full-bleed band six to
       thirty times wider than it is tall spans many periods and the aurora
       comes out as a row of evenly spaced, near-identical blooms — an odd
       number of them, more of them as the window widens. With this site's
       proportions that is 1 lobe on a phone, 3 on a 1440 laptop, 7 at 2560
       and 11 at 4K; on the laptop, 10 of the band's 20 five-percent columns
       carry no ink at all and on the phone 12 of 20 do not. Repetition is the
       loudest thing that can sit behind formal type, which is why it is not
       what this site ships.

     fit: true (the default) — the envelope hangs off the PAGE instead: nx,
       which is -1 at the left edge of the band and +1 at the right whatever
       the width. A cosine fade on nx reaches zero exactly at the two edges
       and nowhere else, and a swell of three sines whose spatial frequencies
       stand in the golden ratio (so their sum has no period) rides on top of
       it and drifts, never falling below 62% of the fade. The band is
       therefore exactly one aurora at every width — no repeat, no dead
       column, no jump as the window is dragged — brightest somewhere near the
       middle, dying to nothing at both ends. Measured the same way, the ink
       per five-percent column runs 0.02 0.09 0.18 0.29 0.40 0.50 0.60 0.70
       0.81 0.90 0.97 1.00 0.95 0.84 0.67 0.49 0.33 0.20 0.09 0.02, and that
       shape is the same on a phone as on a 4K display.

   Because the envelope no longer has anything to do with the zoom, the zoom
   is left alone: uScale, uAmplitude, uThickness and uWaviness go to the GPU
   exactly as configured, so the weave keeps one fixed size in pixels at every
   width and simply has more room to wander on a wider page.

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

  /* Every animated term in the shader is a whole multiple of 0.02 in
     tt = uTime * uSpeed — the strand rates are 0.2·(7 + 6i) and 0.14·(7 + 6i),
     the swell's are 0.22, 0.14 and 0.06 — and the hue's rate is 75/(100·PI) of
     a full palette turn. tt = 100·PI is therefore a point where every one of
     them is exactly back where it started, so uTime can be wound back by
     100·PI/speed there with nothing visible happening. That keeps the phase
     small forever: left alone, a page open for an afternoon feeds numbers
     large enough that float32 quantises the per-frame step and the fastest
     strand starts to judder. */
  var TT_WRAP = 100 * Math.PI;

  /* Theme-independent geometry. Same prop names as the React component. */
  var BASE = {
    count: 5,             /* strands, 1..12                                  */
    speed: 0.18,          /* phase rate; the shader adds 1.4..6.2 per strand */
    amplitude: 0.85,      /* weave height, 40% of the band's half-height     */
    waviness: 0.8,        /* 1.5 long waves across a 1440 page, 4 at 4K      */
    thickness: 0.75,      /* hairline: ~3px of visible line on a 168px band  */
    taper: 2.2,           /* exponent on the edge fade                       */
    spread: 1.0,          /* per-strand phase offset multiplier              */
    hueShift: 0,          /* 0..1, rotates the palette                       */
    intensity: 0.32,      /* 0..1; drives thickness, amplitude and gain      */
    scale: 2.2,           /* zoom; the band is 1/scale tall in uv units      */
    fit: true             /* true = one page-wide aurora; false = reference  */
  };

  /* Theme-dependent light. On near-white paper the composite can only pull the
     ground towards the strand's own colour, so a warm gilt stop would bleach
     into the paper and vanish; the light palette is therefore the navy family
     alone, read as blue ink on laid paper. On the blue-black ground the
     opposite holds — and dark mode is where this needs saying carefully.

     A premultiplied strand composites as col·opacity + ground·(1 - alpha), and
     alpha is small because the band is faint, so most of what lands on screen
     is still the ground. The ground is #0A0F1C: 10 red, 28 blue. Every faint
     pixel therefore gets 18 units of blue back for free, which is very nearly
     the whole red-over-blue lead of a pale gilt like #C9B98E once the tone map
     has compressed it. That is why the previous dark palette measured
     NEUTRAL — #414245, red minus blue -4 of 255 — while claiming to be gilt.
     It was not a dose problem and no amount of opacity fixed it; the stops
     simply did not carry enough chroma to outrun the ground.

     The dark stops below are the chapter gilt with the chroma it needs to
     survive that arithmetic — old gold through gilt to pale gilt, no cool
     stop, so every mix between them is warm too. Dark also runs a far lower
     glow than light for one reason: the tone map 1 - exp(-col·uGlow) drives
     every channel towards 1 as it saturates, and a bleached core is white, not
     gilt. Holding the dark core in the linear part of that curve is what keeps
     warm colour in it, and the saturation lift then puts back what the curve
     still takes out.

     MEASURED, by simulating the shader and the composite over the real page
     ground (1440x112 CSS band, 1.5x backing store, three time samples):

       light  on #FBF9F3  brightest 0.01% #D0E3F6, brightest pixel #CFE3F7;
                          luminance 25 of 255 below the paper, i.e. 10%.
       dark   on #0A0F1C  brightest 0.01% #504630, brightest pixel #584E35;
                          red minus blue +32 of 255, 12.5% — warm, and warm
                          all the way down: +26 over the brightest 0.1%, +16
                          over the brightest 1%, +7 over the brightest 5%.
                          The old palette measured -4, -6, -11, -15: cold.

     Dose, same measurement: 21.6% of the band's pixels shift the ground by
     more than 2 of 255 in luminance, 1.7% by more than 25, and the mean shift
     across the whole band is 1%. Under the old periodic envelope those were
     8.1% and 0.5% — not because the ink was lighter but because half the band
     was dead. Per lit pixel the dose is within a tenth of what it was; what
     changed is how much of the band is lit. */
  var THEMES = {
    light: {
      colors: ["#1B3057", "#24406F", "#2C4C82"],   /* navy-700/600/500 */
      glow: 0.55,
      saturation: 1.20,
      opacity: 0.38
    },
    dark: {
      colors: ["#C89B45", "#DFBB72", "#EFDCAC"],   /* old gold, gilt, pale gilt */
      glow: 0.11,
      saturation: 1.85,
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
    "uniform float uFit;",
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
    /* Height-normalised, centred coordinates, then the zoom. The weave is
       drawn in these, so its size in pixels never changes with the width. */
    "  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;",
    "  uv /= max(uScale, 0.0001);",
    "",
    /* Page-normalised horizontal position: -1 at the left edge, +1 at the
       right, at every width and every height. The envelope hangs off THIS. */
    "  float nx = clamp(gl_FragCoord.x / max(uResolution.x, 1.0) * 2.0 - 1.0, -1.0, 1.0);",
    "",
    "  float e = 0.06 + uIntensity * 0.94;",
    "  float tt = uTime * uSpeed;",
    "  float count = float(uCount);",
    "",
    "  float env;",
    "  float hx;",
    "  if (uFit > 0.5) {",
    /* One aurora, locked to the two page edges. fade is zero at nx = +-1 and
       nowhere else; swell is three sines in the ratio 1 : phi : phi^2, so
       their sum has no period and cannot read as a repeat, drifting at three
       different rates and never dipping below 0.62 so no stretch goes dead. */
    "    float fade = pow(max(cos(nx * PI * 0.5), 0.0), max(uTaper * 0.5, 0.05));",
    "    float swell = 0.62 + 0.19 * (1.0",
    "                + 0.55 * sin(nx * 2.399 + tt * 0.22)",
    "                + 0.30 * sin(nx * 3.882 - tt * 0.14)",
    "                + 0.15 * sin(nx * 6.281 + tt * 0.06));",
    "    env = fade * swell;",
    "    hx = nx;",
    "  } else {",
    /* The reference's own envelope, kept for parity. Periodic in uv.x: on a
       band much wider than it is tall this is a row of repeated blooms. */
    "    env = pow(max(cos(uv.x * PI * 1.3), 0.0), uTaper);",
    "    hx = uv.x;",
    "  }",
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
    /* The hue walks with the strand, with the position along the band and
       with tt — with tt rather than uTime so that speed: 0 is genuinely
       still, and so the wrap in the loop stays invisible. Walking it with hx
       rather than uv.x keeps it to 0.6 of a palette turn across the page at
       any width, so the colour never cycles back on itself either. */
    "    float h = fi / count + hx * 0.30 + tt * 0.2387324 + uHueShift;",
    "    col += paletteColor(h) * g * env;",
    "  }",
    "",
    "  col *= 0.45 + 0.7 * e;",
    "  col = 1.0 - exp(-col * uGlow);",
    "",
    "  float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));",
    /* Clamped at BOTH ends: the saturation lift can push the dominant channel
       past 1, and a premultiplied source with col > alpha is out of gamut for
       the ONE, ONE_MINUS_SRC_ALPHA blend below. */
    "  col = clamp(mix(vec3(gray), col, uSaturation), 0.0, 1.0);",
    "",
    /* Premultiplied: every channel is already scaled by uOpacity, and alpha is
       the brightest channel, so col <= alpha everywhere and the blend is the
       plain source-over of ONE, ONE_MINUS_SRC_ALPHA. */
    "  float alpha = max(max(col.r, col.g), col.b) * uOpacity;",
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
    list = (Array.isArray(o.colors) && o.colors.length) ? o.colors
      : ((Array.isArray(d.colors) && d.colors.length) ? d.colors : THEMES.light.colors);
    o.colors = [];
    for (i = 0; i < list.length && i < MAX_COLORS; i++) o.colors.push(hexToRgb(list[i]));
    if (!o.colors.length) o.colors.push(hexToRgb(THEMES.light.colors[0]));
    return o;
  }

  /* ---- 4. WebGL renderer -------------------------------------------------- */
  /* Returns null when anything at all goes wrong; the caller then leaves the
     host empty. Nothing in here throws upwards. */
  function createGL(canvas) {
    var gl = null, i;
    /* antialias is OFF on purpose. The only primitive is one full-screen
       triangle whose three edges are outside the viewport, so there is no
       geometric edge to sample: multisampling would produce a bit-identical
       image while allocating a multisampled colour buffer and resolving it
       every frame — tens of MB and, on a 4K band, of the order of a GB per
       second of pure memory traffic for nothing. morph-slider.js, the other
       full-screen-triangle shader on this site, is off for the same reason.
       low-power keeps a decorative band on the integrated GPU. */
    var attrs = {
      alpha: true, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, powerPreference: "low-power"
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
    if (!vs || !fs) {
      /* One of the two may still be live; a failed component is no reason to
         leave a shader object behind on the driver. */
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return null;
    }

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, "aPosition");
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    gl.useProgram(program);

    var loc = gl.getAttribLocation(program, "aPosition");
    if (loc < 0) { gl.deleteProgram(program); return null; }

    /* Fullscreen triangle — one primitive, no index buffer. */
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
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
      "uOpacity", "uScale", "uFit", "uCount", "uColorCount"
    ];
    for (i = 0; i < names.length; i++) U[names[i]] = gl.getUniformLocation(program, names[i]);
    U.uColors = gl.getUniformLocation(program, "uColors[0]");

    var cfg = null;
    var palette = new Float32Array(MAX_COLORS * 3);

    /* Every look uniform in one place. None of these depend on the size of
       the band any more — the envelope is normalised to the page inside the
       shader — so this runs on a config change and nowhere else. */
    function pushLook() {
      if (!cfg) return;
      gl.uniform1f(U.uScale, cfg.scale);
      gl.uniform1f(U.uAmplitude, cfg.amplitude);
      gl.uniform1f(U.uThickness, cfg.thickness);
      gl.uniform1f(U.uWaviness, cfg.waviness);
      gl.uniform1f(U.uSpeed, cfg.speed);
      gl.uniform1f(U.uGlow, cfg.glow);
      gl.uniform1f(U.uTaper, cfg.taper);
      gl.uniform1f(U.uSpread, cfg.spread);
      gl.uniform1f(U.uHueShift, cfg.hueShift);
      gl.uniform1f(U.uIntensity, cfg.intensity);
      gl.uniform1f(U.uSaturation, cfg.saturation);
      gl.uniform1f(U.uOpacity, cfg.opacity);
      gl.uniform1f(U.uFit, cfg.fit ? 1 : 0);
      gl.uniform1i(U.uCount, cfg.count);
    }

    var api = {
      kind: "webgl",

      /* Static uniforms only; uTime is the one thing draw() uploads. */
      setConfig: function (next) {
        var j, c, n;
        cfg = next;
        n = cfg.colors.length;
        /* settings() guarantees at least one stop; if a caller ever hands the
           renderer something else, keep the last good palette rather than
           uploading a black one — and push the rest of the look regardless. */
        if (n) {
          for (j = 0; j < MAX_COLORS; j++) {
            c = cfg.colors[j < n ? j : n - 1];
            palette[j * 3] = c[0];
            palette[j * 3 + 1] = c[1];
            palette[j * 3 + 2] = c[2];
          }
          gl.uniform3fv(U.uColors, palette);
          gl.uniform1i(U.uColorCount, n);
        }
        pushLook();
      },

      resize: function (w, h, dpr) {
        var nw = Math.max(1, Math.round(w * dpr));
        var nh = Math.max(1, Math.round(h * dpr));
        if (canvas.width !== nw || canvas.height !== nh) {
          canvas.width = nw;
          canvas.height = nh;
        }
        /* The UA is allowed to hand back a smaller drawing buffer than was
           asked for — a band 5760 device pixels wide is past the maximum
           renderbuffer size of plenty of mobile GPUs. uResolution has to
           describe the buffer that actually exists or every coordinate in
           the shader is wrong, so it is read back rather than assumed. */
        var bw = Math.max(1, gl.drawingBufferWidth || nw);
        var bh = Math.max(1, gl.drawingBufferHeight || nh);
        gl.viewport(0, 0, bw, bh);
        gl.uniform2f(U.uResolution, bw, bh);
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
       and pointer-transparent so it can never eat a click. The markup usually
       carries the class and may carry the attribute already, so remember what
       was actually added here and put back only that much on destroy. */
    var addedClass = !root.classList.contains("strands");
    var addedAria = !root.hasAttribute("aria-hidden");
    if (addedClass) root.classList.add("strands");
    if (addedAria) root.setAttribute("aria-hidden", "true");

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
    /* getBoundingClientRect is a forced layout, so it is something to do on an
       event, never something to do on a schedule. A host with no box yet — a
       display:none ancestor, a stylesheet still landing, a print stylesheet —
       gets a short backoff ladder (~3.4s in six steps) and then nothing at
       all: the ResizeObserver below is what wakes the component when the box
       finally arrives, and it costs nothing while it waits. The loop parks
       rather than re-measuring, which is what it used to do sixty times a
       second for as long as the page was open. */
    var SIZE_RETRIES = [60, 120, 240, 480, 960, 1500];
    var sizeTry = 0;
    var sizeTimer = 0;

    function clearSizeRetry() {
      if (sizeTimer) { window.clearTimeout(sizeTimer); sizeTimer = 0; }
    }

    function scheduleSizeRetry() {
      if (destroyed || sized || sizeTimer || !renderer) return;
      if (sizeTry >= SIZE_RETRIES.length) return;   /* the observers own it now */
      sizeTimer = window.setTimeout(function () {
        sizeTimer = 0;
        if (!measure()) scheduleSizeRetry();
      }, SIZE_RETRIES[sizeTry++]);
    }

    /* The one place that measures. True when the host had a box. */
    function measure() {
      if (destroyed || !renderer) return false;
      var rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;

      var dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      renderer.resize(rect.width, rect.height, dpr);
      clearSizeRetry();

      var first = !sized;
      sized = true;
      if (first) { sizeTry = 0; refreshLoop(); }
      /* When the loop is running it will draw on its own; when it is not —
         off-screen, reduced motion, a hidden tab — this is the one frame. */
      if (!running) renderer.draw(elapsed);
      return true;
    }

    function resize() {
      if (!measure()) scheduleSizeRetry();
    }

    /* Coalesce a drag-resize into one measurement every 120ms. An outside
       signal also earns a fresh ladder, so a host that gets its box back long
       after boot is picked up rather than ignored. */
    function scheduleResize() {
      if (resizeTimer || destroyed) return;
      resizeTimer = window.setTimeout(function () {
        resizeTimer = 0;
        sizeTry = 0;
        clearSizeRetry();
        resize();
      }, 120);
    }

    /* ---- 5c. Loop -------------------------------------------------------- */
    /* dt is accumulated rather than read from the clock, so a loop that has
       been parked for a minute — off-screen, or in a background tab — comes
       back exactly where it left off instead of snapping forward. The per
       frame clamp covers the first frame after a resume and any single long
       stall, and the wrap at TT_WRAP keeps the phase small however long the
       page stays open. */
    function frame(ts) {
      rafId = null;
      if (destroyed || !renderer) return;

      /* Should not happen — refreshLoop will not start an unsized band — but
         if it ever does, park and let an observer restart it. */
      if (!sized) { stopLoop(); scheduleSizeRetry(); return; }

      var t = typeof ts === "number" ? ts : now();
      if (last === 0) last = t;
      var dt = (t - last) / 1000;
      last = t;
      if (dt < 0) dt = 0;
      if (dt > 0.05) dt = 0.05;
      elapsed += dt;
      if (cfg.speed > 0) {
        var wrap = TT_WRAP / cfg.speed;
        if (elapsed >= wrap) elapsed -= wrap;
      }

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
      if (inView && sized && renderer && !document.hidden && !reduced) startLoop();
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

    /* Dragging a window to a display of another density changes
       devicePixelRatio without changing one CSS pixel of the host, so the
       ResizeObserver never fires and the backing store would stay at the old
       density. A resolution media query is the only notice a page gets, and
       it has to be rebuilt around each new ratio. Where the query is not
       understood the list simply never matches, which costs nothing. */
    var dprMq = null;
    function unwatchDpr() {
      if (!dprMq) return;
      if (dprMq.removeEventListener) dprMq.removeEventListener("change", onDprChange);
      else if (dprMq.removeListener) dprMq.removeListener(onDprChange);
      dprMq = null;
    }
    function watchDpr() {
      if (!window.matchMedia || destroyed) return;
      unwatchDpr();
      try {
        dprMq = window.matchMedia("(resolution: " + (window.devicePixelRatio || 1) + "dppx)");
      } catch (e) { dprMq = null; return; }
      if (dprMq.addEventListener) dprMq.addEventListener("change", onDprChange);
      else if (dprMq.addListener) dprMq.addListener(onDprChange);
    }
    function onDprChange() {
      if (destroyed) return;
      watchDpr();
      scheduleResize();
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
      clearSizeRetry();
      if (renderer) { renderer.destroy(); renderer = null; }
      if (canvas) {
        canvas.removeEventListener("webglcontextlost", onContextLost);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
      canvas = null;
      sized = false;
    }
    if (canvas) canvas.addEventListener("webglcontextlost", onContextLost);

    /* ---- 5f. Boot -------------------------------------------------------- */
    /* Measuring the host draws the first frame with it; under reduced motion
       that is the only frame there will ever be — a still engraving. If there
       is no box yet, resize() has already armed the ladder. */
    watchDpr();
    resize();
    if (!io) refreshLoop();

    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      clearSizeRetry();
      if (resizeTimer) { window.clearTimeout(resizeTimer); resizeTimer = 0; }
      document.removeEventListener("visibilitychange", onVisibility);
      if (canvas) canvas.removeEventListener("webglcontextlost", onContextLost);
      if (ro) ro.disconnect(); else window.removeEventListener("resize", scheduleResize);
      if (io) io.disconnect();
      if (themeObserver) themeObserver.disconnect();
      unwatchDpr();
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", onMotionChange);
        else if (mq.removeListener) mq.removeListener(onMotionChange);
      }
      if (renderer) { renderer.destroy(); renderer = null; }
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null;
      if (addedClass) root.classList.remove("strands");
      if (addedAria) root.removeAttribute("aria-hidden");
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
