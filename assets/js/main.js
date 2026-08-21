/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   Shared behaviour: nav, footer, data rendering, reveal-on-scroll.
   Pure vanilla JS. Works from file:// as well as a web server.
   ========================================================================== */
(function () {
  "use strict";

  var C = (window.LPHIE && window.LPHIE.chapter) || {};
  var N = (window.LPHIE && window.LPHIE.national) || {};

  /* ---- helpers --------------------------------------------------------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function isTodo(s) { return /^\s*TODO/i.test(String(s || "")); }
  function initials(name) {
    return String(name || "").trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w.charAt(0); }).join("").toUpperCase() || "ΛΦΕ";
  }
  /* Depth-aware asset prefix so the site works in a subfolder or at root. */
  var PREFIX = (function () {
    var d = document.documentElement.getAttribute("data-root");
    return d === null ? "" : d;
  })();

  /* ---- 1. Navigation --------------------------------------------------- */
  var NAV = [
    { href: "index.html",        label: "Home" },
    { href: "about.html",        label: "About" },
    { href: "brothers.html",     label: "Families" },
    { href: "brotherhood.html",  label: "Brotherhood" },
    { href: "philanthropy.html", label: "Philanthropy" },
    { href: "alumni.html",       label: "Alumni" },
    { href: "media.html",        label: "Media" },
    { href: "contact.html",      label: "Contact" }
  ];

  function currentPage() {
    var p = window.location.pathname.split("/").pop();
    return (!p || p === "") ? "index.html" : p;
  }

  function buildHeader() {
    var host = el("site-header");
    if (!host) return;
    var here = currentPage();

    var links = NAV.map(function (item) {
      var cur = item.href === here ? ' aria-current="page"' : "";
      return '<li><a href="' + PREFIX + item.href + '"' + cur + ">" + esc(item.label) + "</a></li>";
    }).join("");

    host.innerHTML =
      '<nav class="wrap nav" aria-label="Primary">' +
        '<a class="nav__brand" href="' + PREFIX + 'index.html">' +
          '<img class="nav__crest" src="' + PREFIX + 'assets/img/crest-navy.png" alt="" width="40" height="40">' +
          '<span class="nav__brand-text">' +
            '<span class="nav__letters">ΛΦΕ</span>' +
            '<span class="nav__chapter">' +
              '<span class="nav__chapter--full">' + esc(C.designation || "") + " &middot; " + esc(C.school || "") + "</span>" +
              '<span class="nav__chapter--short">' + esc(C.designation || "") + " &middot; U of T</span>" +
            "</span>" +
          "</span>" +
        "</a>" +
        '<button class="nav__toggle" id="nav-toggle" aria-expanded="false" aria-controls="nav-links">Menu</button>' +
        '<ul class="nav__links" id="nav-links">' + links +
          '<li class="nav__theme-item">' +
            '<button class="nav__theme" type="button" data-theme-toggle aria-pressed="false" title="Switch theme">' +
              '<span class="nav__theme-glyph" data-theme-glyph aria-hidden="true">☾</span>' +
              '<span class="visually-hidden" data-theme-label>Dark mode</span>' +
            "</button>" +
          "</li>" +
          '<li><a class="nav__cta" href="' + PREFIX + 'rush.html">Rush ΛΦΕ</a></li>' +
        "</ul>" +
      "</nav>";

    /* theme.js paints the glyph / aria-pressed once the button exists. */
    if (window.LPHIE && window.LPHIE.syncTheme) window.LPHIE.syncTheme();

    var toggle = el("nav-toggle"), list = el("nav-links");
    toggle.addEventListener("click", function () {
      var open = list.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "Close" : "Menu";
    });
    document.addEventListener("click", function (e) {
      if (!list.classList.contains("is-open")) return;
      if (host.contains(e.target)) return;
      list.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "Menu";
    });
  }

  /* ---- 2. Footer -------------------------------------------------------- */
  function buildFooter() {
    var host = el("site-footer");
    if (!host) return;

    var social = [];
    if (C.instagram) social.push('<li><a href="https://instagram.com/' + esc(C.instagram) + '">Instagram &nearr;</a></li>');
    if (C.youtube)   social.push('<li><a href="' + esc(C.youtube) + '">YouTube &nearr;</a></li>');
    if (C.facebook)  social.push('<li><a href="' + esc(C.facebook) + '">Facebook &nearr;</a></li>');
    if (C.linkedin)  social.push('<li><a href="' + esc(C.linkedin) + '">LinkedIn &nearr;</a></li>');
    if (C.email)     social.push('<li><a href="mailto:' + esc(C.email) + '">' + esc(C.email) + "</a></li>");

    host.innerHTML =
      '<div class="wrap">' +
        '<div class="footer-grid">' +
          '<div class="footer-brand">' +
            '<img src="' + PREFIX + 'assets/img/crest.png" alt="" width="56" height="56">' +
            "<div>" +
              '<div class="footer-letters">Λ Φ Ε</div>' +
              "<p><strong>" + esc(C.designation) + " Chapter</strong><br>" + esc(C.school) + "<br>" +
              "Chartered " + esc(C.chartered) + ". The fraternity&rsquo;s first chapter outside the United States.</p>" +
            "</div>" +
          "</div>" +
          "<div><h4>Chapter</h4><ul>" +
            '<li><a href="' + PREFIX + 'about.html">About Alpha Xi</a></li>' +
            '<li><a href="' + PREFIX + 'brothers.html">Families &amp; Charter</a></li>' +
            '<li><a href="' + PREFIX + 'brotherhood.html">Brotherhood</a></li>' +
            '<li><a href="' + PREFIX + 'alumni.html">Alumni</a></li>' +
          "</ul></div>" +
          "<div><h4>Get Involved</h4><ul>" +
            '<li><a href="' + PREFIX + 'rush.html">Rush ΛΦΕ</a></li>' +
            '<li><a href="' + PREFIX + 'philanthropy.html">Philanthropy</a></li>' +
            '<li><a href="' + PREFIX + 'media.html">Media</a></li>' +
            '<li><a href="' + PREFIX + 'contact.html">Contact</a></li>' +
          "</ul></div>" +
          "<div><h4>Connect</h4><ul>" + social.join("") +
            '<li><a href="https://lambdaphiepsilon.org/">National Fraternity &nearr;</a></li>' +
          "</ul></div>" +
        "</div>" +
        '<div class="footer-bottom">' +
          "<span>&copy; " + new Date().getFullYear() + " Lambda Phi Epsilon International Fraternity, Inc. &middot; " + esc(C.designation) + " Chapter.</span>" +
          "<span>" + esc(N.mottoGreek || "") + "</span>" +
        "</div>" +
      "</div>";
  }

  /* ---- 3. Brother cards ------------------------------------------------- */
  function brotherCard(b, showRole) {
    var todo = isTodo(b.name);
    var photo = b.photo
      ? '<img src="' + PREFIX + "assets/img/brothers/" + esc(b.photo) + '" alt="' + esc(b.name) + '" loading="lazy">'
      : esc(initials(todo ? "" : b.name));

    var meta = [];
    if (b.crossed) meta.push("Crossed " + esc(b.crossed));
    if (b.class && !isTodo(b.class)) meta.push(esc(b.class));
    if (b.number) meta.push("#" + esc(b.number));
    if (b.program) meta.push(esc(b.program));
    if (b.family) meta.push(esc(b.family));

    return '<article class="brother">' +
      '<div class="brother__photo">' + photo + "</div>" +
      '<div class="brother__body">' +
        (showRole && b.role ? '<span class="brother__role">' + esc(b.role) + "</span>" : "") +
        '<h3 class="brother__name">' + (todo ? '<span class="tag tag--todo">Add name</span>' : esc(b.name)) + "</h3>" +
        (b.nick ? '<p class="brother__nick">&ldquo;' + esc(b.nick) + "&rdquo;</p>" : "") +
        (meta.length ? '<p class="brother__meta">' + meta.join(" &middot; ") + "</p>" : "") +
      "</div>" +
    "</article>";
  }

  function renderExec() {
    var host = el("exec-grid");
    if (!host) return;
    var list = (window.LPHIE.exec || []);
    host.innerHTML = list.map(function (b) { return brotherCard(b, true); }).join("");
  }

  /* ---- 4. Active roster with filtering ---------------------------------- */
  function renderActives() {
    var host = el("roster-grid");
    if (!host) return;
    var all = (window.LPHIE.actives || []).slice();
    var search = el("roster-search");
    var termSel = el("roster-term");
    var count = el("roster-count");

    var terms = [];
    all.forEach(function (b) { if (b.crossed && terms.indexOf(b.crossed) < 0) terms.push(b.crossed); });
    if (termSel) {
      termSel.innerHTML = '<option value="">All classes</option>' +
        terms.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + "</option>"; }).join("");
    }

    function draw() {
      var q = (search && search.value || "").trim().toLowerCase();
      var t = (termSel && termSel.value) || "";
      var rows = all.filter(function (b) {
        if (t && b.crossed !== t) return false;
        if (!q) return true;
        return [b.name, b.nick, b.class, b.program, b.family]
          .join(" ").toLowerCase().indexOf(q) >= 0;
      });

      /* group by crossing term, newest first by string sort on year */
      var groups = {};
      rows.forEach(function (b) {
        var k = b.crossed || "Unlisted";
        (groups[k] = groups[k] || []).push(b);
      });
      var keys = Object.keys(groups).sort().reverse();

      host.innerHTML = keys.length
        ? keys.map(function (k) {
            var g = groups[k];
            return '<div class="class-heading"><h3>' + esc(k) + "</h3><span>" +
                   g.length + (g.length === 1 ? " brother" : " brothers") + "</span></div>" +
                   '<div class="brother-grid">' + g.map(function (b) { return brotherCard(b, false); }).join("") + "</div>";
          }).join("")
        : '<p class="lede">No brothers match that search.</p>';

      if (count) count.textContent = rows.length + " of " + all.length + " shown";
    }

    if (search) search.addEventListener("input", draw);
    if (termSel) termSel.addEventListener("change", draw);
    draw();
  }

  /* ---- 5. Charter class + families -------------------------------------- */
  function renderCharter() {
    var host = el("charter-list");
    if (!host) return;
    host.innerHTML = (window.LPHIE.charterClass || []).map(function (n) {
      return "<li>Mr. " + esc(n) + "</li>";
    }).join("");
  }

  function renderFamilies() {
    var host = el("families-grid");
    if (!host) return;
    host.innerHTML = (window.LPHIE.families || []).map(function (f) {
      return '<article class="card card--hover"><div class="card__icon">' + esc(initials(f.name)) + "</div>" +
             "<h3>" + esc(f.name) + "</h3>" +
             "<p>" + (f.note ? esc(f.note) : "Uji family line within the chapter.") + "</p></article>";
    }).join("");
  }

  /* ---- 6. Values, alumni, traditions, FAQ, schedule --------------------- */
  function renderValues() {
    var host = el("values-grid");
    if (!host) return;
    host.innerHTML = (N.values || []).map(function (v) {
      return '<div class="value"><h3>' + esc(v.name) + "</h3><p>" + esc(v.text) + "</p></div>";
    }).join("");
  }

  function renderAlumni() {
    var host = el("alumni-grid");
    if (!host) return;
    host.innerHTML = (window.LPHIE.alumni || []).map(function (a) {
      return '<article class="card card--hover">' +
        '<div class="card__icon">' + esc(initials(a.name)) + "</div>" +
        "<h3>" + esc(a.name) + "</h3>" +
        "<p><strong>" + esc(a.title) + "</strong><br>" +
        (isTodo(a.org) ? '<span class="tag tag--todo">Add company</span>' : esc(a.org)) + "</p>" +
        (a.note ? '<p class="brother__meta">' + esc(a.note) + "</p>" : "") +
      "</article>";
    }).join("");

    var sectors = el("alumni-sectors");
    if (sectors) {
      sectors.innerHTML = (window.LPHIE.alumniSectors || []).map(function (s) {
        return '<li><span class="tag">' + esc(s) + "</span></li>";
      }).join("");
    }
  }

  function renderTraditions() {
    var host = el("traditions-grid");
    if (!host) return;
    host.innerHTML = (window.LPHIE.traditions || []).map(function (t) {
      return '<article class="card card--hover">' +
        '<span class="tag">' + esc(t.season) + "</span>" +
        "<h3 style=\"margin-top:.75rem\">" + esc(t.name) + "</h3>" +
        "<p>" + esc(t.text) + "</p></article>";
    }).join("");
  }

  function renderFaq() {
    var host = el("faq-list");
    if (!host) return;
    host.innerHTML = (window.LPHIE.faq || []).map(function (f) {
      return "<details><summary>" + esc(f.q) + "</summary>" +
             '<div class="faq__body"><p>' + f.a + "</p></div></details>";
    }).join("");
  }

  function renderSchedule() {
    var host = el("rush-schedule");
    if (!host) return;
    var label = el("rush-term-label");
    if (label) label.textContent = window.LPHIE.rushTermLabel || "Rush";

    host.innerHTML =
      "<thead><tr><th>Date</th><th>Time</th><th>Event</th><th>Location</th><th>Notes</th></tr></thead><tbody>" +
      (window.LPHIE.rushSchedule || []).map(function (r) {
        function cell(v) { return isTodo(v) ? '<span class="tag tag--todo">' + esc(v) + "</span>" : esc(v); }
        return "<tr><td>" + cell(r.date) + "</td><td>" + cell(r.time) + "</td><td><strong>" +
               esc(r.event) + "</strong></td><td>" + cell(r.location) + "</td><td>" + esc(r.note || "") + "</td></tr>";
      }).join("") + "</tbody>";
  }

  /* ---- 7. Gallery + reveals --------------------------------------------- */
  function renderGallery() {
    var host = el("gallery-grid");
    if (host) {
      host.innerHTML = (window.LPHIE.gallery || []).map(function (g) {
        var body = g.src
          ? '<img src="' + PREFIX + "assets/img/gallery/" + esc(g.src) + '" alt="' + esc(g.caption) + '" loading="lazy">'
          : '<div class="ph">Drop a photo in<br>assets/img/gallery/</div>';
        return "<figure>" + body + "<figcaption>" +
               (isTodo(g.caption) ? '<span class="tag tag--todo">' + esc(g.caption) + "</span>" : esc(g.caption)) +
               "</figcaption></figure>";
      }).join("");
    }

    var rHost = el("reveal-list");
    if (rHost) {
      rHost.innerHTML = (window.LPHIE.reveals || []).map(function (r) {
        return '<article class="card">' +
          "<h3>" + (isTodo(r.className) ? '<span class="tag tag--todo">Add class name</span>' : esc(r.className)) + "</h3>" +
          "<p>" + esc(r.term) + "</p>" +
          (r.url ? '<p><a href="' + esc(r.url) + '">Watch the reveal &nearr;</a></p>'
                 : '<p class="brother__meta">Paste the video URL in data/content.js</p>') +
        "</article>";
      }).join("");
    }

    var ig = el("instagram-embed");
    if (ig && C.instagram) {
      ig.innerHTML = '<a class="btn btn--primary" href="https://instagram.com/' + esc(C.instagram) +
                     '">@' + esc(C.instagram) + " on Instagram &nearr;</a>";
    }
  }

  /* ---- 8. Fill any [data-fill] token ------------------------------------ */
  function fillTokens() {
    var map = {
      designation: C.designation, school: C.school, chartered: C.chartered,
      city: C.city, email: C.email, rushEmail: C.rushEmail,
      motto: N.motto, mottoGreek: N.mottoGreek, mission: N.mission, vision: N.vision,
      founded: N.founded, foundedAt: N.foundedAt, colors: N.colors, mascot: N.mascot,
      lifetimeMembers: (C.stats || {}).lifetimeMembers,
      activeChapters: (C.stats || {}).activeChapters,
      avgGpa: (C.stats || {}).avgGpa,
      yearsActive: String(new Date().getFullYear() - (C.charteredYear || 2004))
    };
    Array.prototype.forEach.call(document.querySelectorAll("[data-fill]"), function (node) {
      var v = map[node.getAttribute("data-fill")];
      if (v != null) node.textContent = v;
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-mailto]"), function (node) {
      node.setAttribute("href", "mailto:" + (C.rushEmail || C.email || ""));
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-rushform]"), function (node) {
      if (C.rushFormUrl) { node.setAttribute("href", C.rushFormUrl); }
      else { node.setAttribute("href", "contact.html"); }
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-instagram]"), function (node) {
      node.setAttribute("href", "https://instagram.com/" + (C.instagram || ""));
    });
  }

  /* ---- 9. Reveal on scroll ---------------------------------------------- */
  function reveal() {
    var nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;
    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(nodes, function (n) { n.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    Array.prototype.forEach.call(nodes, function (n) { io.observe(n); });
  }

  /* ---- 10. Contact form (mailto fallback) ------------------------------- */
  function wireForm() {
    var form = el("contact-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(form);
      var body = [
        "Name: " + (d.get("name") || ""),
        "Email: " + (d.get("email") || ""),
        "Year / Program: " + (d.get("program") || ""),
        "Topic: " + (d.get("topic") || ""),
        "", (d.get("message") || "")
      ].join("\n");
      window.location.href = "mailto:" + (C.email || "") +
        "?subject=" + encodeURIComponent("[Website] " + (d.get("topic") || "Enquiry")) +
        "&body=" + encodeURIComponent(body);
      var note = el("form-note");
      if (note) note.textContent = "Your email client should now be open. If nothing happened, email us directly at " + (C.email || "") + ".";
    });
  }

  /* ---- boot ------------------------------------------------------------- */
  function init() {
    buildHeader(); buildFooter(); fillTokens();
    renderExec(); renderActives(); renderCharter(); renderFamilies();
    renderValues(); renderAlumni(); renderTraditions(); renderFaq();
    renderSchedule(); renderGallery(); wireForm(); reveal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
