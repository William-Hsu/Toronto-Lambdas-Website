/* ==========================================================================
   DRIFT WALL  —  the drifting photo band on the home page.
   Add a photo: drop the file into  assets/img/gallery/  then put the file
   name in the matching "image" field below and save. Nothing to rebuild.

   Fields:
     image   file in assets/img/gallery/ e.g. "retreat-2025.jpg" (optional).
             Leave "" and the tile draws a navy gradient placeholder with the
             title in it — the band still looks finished with no photos at all.
             If the value contains a "/" it is used as-is, so you can also
             point at a rooted path ("/assets/img/brothers/x.jpg") or a full
             URL if you ever host photos elsewhere.
     title   short caption. Shown inside the placeholder and read by screen
             readers. Keep it to two or three words.
     href    optional link — a page on this site ("brotherhood.html") or a
             full URL. Leave "" for a plain, non-clickable photo tile.

   Landscape crops look best (roughly 3:2). About 15 entries is right: fewer
   than 12 and the columns start to repeat visibly.
   ========================================================================== */
window.LPHIE = window.LPHIE || {};

window.LPHIE.driftWall = [
  { image: "convertible-drive.jpg",      title: "Golden hour drive",        href: "" },
  { image: "reveal-night.jpg",           title: "Reveal night",             href: "brotherhood.html" },
  { image: "stem-cell-drive.jpg",        title: "Stem cell registry drive", href: "philanthropy.html" },
  { image: "family-line-dinner.jpg",     title: "Family line dinner",       href: "" },
  { image: "pool-party.jpg",             title: "Summer pool party",        href: "" },
  { image: "convention-weekend.jpg",     title: "Convention weekend",       href: "" },
  { image: "mahjong-night.jpg",          title: "Mahjong night",            href: "" },
  { image: "sporting-life-10k.jpg",      title: "Sporting Life 10K",        href: "" },
  { image: "charter-class-throwback.jpg", title: "Charter class throwback", href: "alumni.html" },
  { image: "hotpot-night.jpg",           title: "Hotpot night",             href: "" },
  { image: "mixer-night.jpg",            title: "Mixer night",              href: "" },
  { image: "interchapter-formal.jpg",    title: "Interchapter formal",      href: "" },
  { image: "alumni-banquet.jpg",         title: "Alumni banquet",           href: "alumni.html" },
  { image: "retreat-after-dark.jpg",     title: "Retreat after dark",       href: "" },
  { image: "alumni-homecoming.jpg",      title: "Alumni homecoming",        href: "alumni.html" },
  { image: "summer-in-the-city.jpg",     title: "Summer in the city",       href: "" },
  { image: "house-social.jpg",           title: "House social",             href: "" },
  { image: "late-nights.jpg",            title: "Late nights",              href: "" },
  { image: "rooftop-pool.jpg",           title: "Rooftop, downtown",        href: "" },
  { image: "sunset-formal.jpg",          title: "Sunset, formal night",     href: "" },
  { image: "robes-night.jpg",            title: "Regalia",                  href: "" },
  { image: "late-night-walk.jpg",        title: "Late-night walk",          href: "" },
  { image: "archive-house-2000s.jpg",    title: "The chapter, mid-2000s",   href: "" }
];
