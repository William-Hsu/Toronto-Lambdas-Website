/* ==========================================================================
   PILLARS  —  the four pillars strip on the home page (accordion gallery).

   Order here is the order shown on the page, left to right.

   Fields:
     label   pillar name, shown on the panel and used as the link's aria-label
     letter  Greek initial drawn large behind the label when there is no photo
     link    page the panel opens — same targets as the pillar cards
     image   file in assets/img/gallery/ e.g. "brotherhood-retreat.jpg"
             OPTIONAL. Leave it "" and the panel draws a navy gradient
             placeholder with the Greek letter instead. Drop a photo into
             assets/img/gallery/ and put its filename here to use it — nothing
             to rebuild. If the file is missing the placeholder comes back.
   ========================================================================== */
window.LPHIE = window.LPHIE || {};

window.LPHIE.pillarsGallery = [
  { label: "Brotherhood",  letter: "Β", link: "brotherhood.html",        image: "pillar-brotherhood.jpg" },
  { label: "Academics",    letter: "Α", link: "alumni.html",             image: "pillar-academics.jpg" },
  { label: "Philanthropy", letter: "Φ", link: "philanthropy.html",       image: "pillar-philanthropy.jpg" },
  { label: "Social",       letter: "Σ", link: "brotherhood.html#social", image: "pillar-social.jpg" }
];
