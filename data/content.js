/* ==========================================================================
   EDITABLE PAGE CONTENT — rush schedule, FAQ, events, media.
   ========================================================================== */
window.LPHIE = window.LPHIE || {};

/* --- Rush schedule ------------------------------------------------------- */
/* TODO: update every term. Set `rushTermLabel` to the current term.          */
window.LPHIE.rushTermLabel = "Fall 2026 Rush";
window.LPHIE.rushSchedule = [
  { date: "TODO: Date", time: "TODO", event: "Information Night",       location: "TODO: Room", note: "Meet the brothers, hear what ΛΦΕ is about. Come as you are." },
  { date: "TODO: Date", time: "TODO", event: "Games & Social Night",    location: "TODO: Room", note: "Low-key, no formal dress." },
  { date: "TODO: Date", time: "TODO", event: "Athletic Event",          location: "TODO",        note: "Basketball, volleyball, or spikeball. No experience needed." },
  { date: "TODO: Date", time: "TODO", event: "Professional Night",      location: "TODO: Room", note: "Alumni panel and networking." },
  { date: "TODO: Date", time: "TODO", event: "Brotherhood Night",       location: "Invite only", note: "" },
  { date: "TODO: Date", time: "TODO", event: "Interviews",              location: "Invite only", note: "" }
];

/* --- Rush FAQ ------------------------------------------------------------ */
window.LPHIE.faq = [
  {
    q: "Do I have to be Asian to join?",
    a: "No. Lambda Phi Epsilon is <strong>Asian-interest and open to all</strong>. We were founded to build a home for Asian-American men on campus, and that heritage is central to who we are. Membership has never been closed by ethnicity, and our chapter's brothers come from a wide range of backgrounds. If our values resonate with you, rush."
  },
  {
    q: "What actually is rush?",
    a: "Rush is a week of open events where you get to meet the brothers and we get to meet you. Info night, a social, something athletic, a professional night. You show up, hang out, ask questions. That's it."
  },
  {
    q: "Is rushing binding? Does it cost anything?",
    a: "Rush is <strong>free and completely non-binding</strong>. Coming to events commits you to nothing. Plenty of people rush, decide it is not for them, and we are still glad they came. Dues only ever come up after you have accepted a bid."
  },
  {
    q: "What is a bid?",
    a: "A bid is a formal invitation to join the chapter as a new member. Bids go out after rush ends. Receiving one places you under no obligation; you choose whether to accept."
  },
  {
    q: "Is there a GPA requirement?",
    a: "Yes. Academics come first, and the chapter maintains a minimum GPA for new members and actives alike. Our chapter has historically averaged well above it. If you are worried about where you stand, talk to our rush chair. We would rather help you plan than have you stay away."
  },
  {
    q: "How much of a time commitment is it?",
    a: "The new member period is the busiest stretch, with several evenings a week for roughly one semester. After crossing, the commitment is what you make of it: chapter meetings, philanthropy events, and whatever you choose to lead."
  },
  {
    q: "What happens after I accept a bid?",
    a: "You begin the new member education process alongside your class. You'll learn the fraternity's history and values, get paired with a big brother, and cross into the chapter with your class at the end of the term."
  },
  {
    q: "I'm not a first-year. Can I still rush?",
    a: "Yes. We take students at every year of study, including upper years and graduate students. Some of our strongest brothers rushed in third year."
  },
  {
    q: "What if I can't make every rush event?",
    a: "Come to what you can. We know people have labs, jobs and commutes. Email our rush chair if you're going to miss something and we'll make sure you don't fall behind."
  },
  {
    q: "Does ΛΦΕ haze?",
    a: "No. Hazing is prohibited by the international fraternity, by the University of Toronto, and by law. Any conduct concern can be raised with the chapter's executive board or reported directly to the international fraternity."
  }
];

/* --- Recurring chapter events ------------------------------------------- */
window.LPHIE.traditions = [
  { name: "NMDP Registry Drive",   season: "Annual",       text: "Our flagship philanthropy: swabbing students onto the stem cell registry in memory of Evan Chen." },
  { name: "Brotherhood Retreat",   season: "Each term",    text: "A weekend off campus with the whole chapter, the thing brothers cite most when asked what made them stay." },
  { name: "Class Reveal",          season: "End of term",  text: "New members are revealed to the campus with their class name and letters for the first time." },
  { name: "Interchapter Visits",   season: "Year-round",   text: "Trips to and from other Lambda chapters across Ontario and the northeast." },
  { name: "International Convention", season: "Summer",   text: "Delegates represent Alpha Xi at the fraternity's annual convention." },
  { name: "Alumni Banquet",        season: "Annual",       text: "Two decades of Alpha Xi brothers back in one room." },
  { name: "Cultural Programming",  season: "Year-round",   text: "Lunar New Year, Asian Heritage Month, and collaborations across U of T's cultural clubs." }
];

/* --- Media / gallery ----------------------------------------------------- */
/* Drop images into assets/img/gallery/ and reference them by filename.       */
window.LPHIE.gallery = [
  { src: "", caption: "TODO: Charter anniversary" },
  { src: "", caption: "TODO: Brotherhood retreat" },
  { src: "", caption: "TODO: NMDP registry drive" },
  { src: "", caption: "TODO: Class reveal" },
  { src: "", caption: "TODO: Alumni banquet" },
  { src: "", caption: "TODO: Interchapter visit" },
  { src: "", caption: "TODO: Convention delegates" }
];

/* Class reveal videos — paste YouTube URLs. */
window.LPHIE.reveals = [
  { term: "TODO: Term", className: "TODO: Class Name", url: "" },
  { term: "TODO: Term", className: "TODO: Class Name", url: "" }
];
