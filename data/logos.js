/* ==========================================================================
   COMPANY LOGOS  —  the marquee band on index.html
   Companies Alpha Xi alumni have gone on to work at, transcribed from the
   chapter's screenshot (left-to-right, top-to-bottom).

   HOW TO ADD A REAL LOGO
   ----------------------
   1. Drop the file into  assets/img/logos/  (SVG preferred, transparent PNG
      is fine). Give it a plain lowercase filename, e.g. "td.svg".
   2. Put JUST THE FILENAME in "src" below — the site resolves it relative to
      assets/img/logos/ on its own. Do not paste a full http:// URL: the site
      is built to work offline and from file://, and a remote URL breaks that.
   3. That's it. No build step, no other file to edit.

   WHILE "src" IS EMPTY (or if the image file is missing) the band renders the
   company name as a letter-spaced navy wordmark instead. That is a deliberate,
   working design — the row looks finished with zero logo files present, so
   there is no rush, and logos can be added one at a time.

   "href" is optional and empty everywhere for now. Add a company URL and that
   entry becomes a link that opens in a new tab; leave it empty and the entry
   renders as plain, unclickable content.

   NOTE ON TRADEMARKS: these are third-party marks. Only add logo files the
   chapter is comfortable displaying, and use each company's official asset.

   WHERE THE CURRENT FILES CAME FROM
   ---------------------------------
   The SVGs in assets/img/logos/ were taken from Wikimedia Commons in August
   2026. They are the companies' own marks, shown here only to describe where
   alumni work — nominative use. If a company asks the chapter to stop showing
   its mark, blank that entry's "src" and it falls back to a plain wordmark.

   Three entries have no logo file and render as wordmarks: Purpose Investments
   and PushPress (privately held, no public logo file), and Bank of China (the
   only file available was BOC Hong Kong (Holdings) Limited, a different legal
   entity, so it was deliberately not used).
   ========================================================================== */
window.LPHIE = window.LPHIE || {};

window.LPHIE.logos = [
  { name: "JPMorgan Chase & Co.", src: "jpmorgan-chase.svg",  href: "" },
  { name: "Purpose Investments",  src: "",                    href: "" },  /* privately held, no public logo file — wordmark */
  { name: "Onex",                 src: "onex.svg",            href: "" },
  { name: "BlackRock",            src: "blackrock.svg",       href: "" },
  { name: "TD",                   src: "td.svg",              href: "" },
  { name: "Scotiabank",           src: "scotiabank.svg",      href: "" },
  { name: "BMO",                  src: "bmo.svg",             href: "" },
  { name: "Microsoft",            src: "microsoft.svg",       href: "" },
  { name: "Amazon",               src: "amazon.svg",          href: "" },
  { name: "Citibank",             src: "citibank.svg",        href: "" },
  { name: "Bank of America",      src: "bank-of-america.svg", href: "" },
  { name: "Bank of China",        src: "",                    href: "" },  /* only the HK holdings entity was available — wordmark */
  { name: "PwC",                  src: "pwc.svg",             href: "" },
  { name: "EY",                   src: "ey.svg",              href: "" },
  { name: "KPMG",                 src: "kpmg.svg",            href: "" },
  { name: "Deloitte",             src: "deloitte.svg",        href: "" },
  { name: "Strategy&",            src: "strategy-and.svg",    href: "" },
  { name: "PushPress",            src: "",                    href: "" },  /* privately held, no public logo file — wordmark */
  { name: "Qualcomm",             src: "qualcomm.svg",        href: "" },
  { name: "AMD",                  src: "amd.svg",             href: "" },
  { name: "Rogers",               src: "rogers.svg",          href: "" },
  { name: "Bell",                 src: "bell.svg",            href: "" }
];
