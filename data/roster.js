/* ==========================================================================
   ROSTER  —  exec board, active brothers, charter class.
   Add a brother: copy a block, change the fields, save. Nothing to rebuild.

   Fields:
     name    required
     nick    fraternity nickname (optional)
     class   name of crossing class (optional)
     number  fraternity number within the chapter (optional)
     crossed semester crossed, e.g. "F24" / "W25" (optional)
     program academic program (optional)
     family  big-little family / Uji (optional)
     photo   file in assets/img/brothers/ e.g. "jane-doe.jpg" (optional)
     role    exec position — only for the exec board list
   ========================================================================== */
window.LPHIE = window.LPHIE || {};

/* --- Executive board ---------------------------------------------------- */
/* TODO: replace every entry below with your real 2026–27 exec board.        */
window.LPHIE.exec = [
  { role: "President",            name: "TODO — Name", nick: "", crossed: "", program: "", photo: "" },
  { role: "Vice President",       name: "TODO — Name", nick: "", crossed: "", program: "", photo: "" },
  { role: "Treasurer",            name: "TODO — Name", nick: "", crossed: "", program: "", photo: "" },
  { role: "Secretary",            name: "TODO — Name", nick: "", crossed: "", program: "", photo: "" },
  { role: "Rush Chair",           name: "TODO — Name", nick: "", crossed: "", program: "", photo: "" },
  { role: "New Member Educator",  name: "TODO — Name", nick: "", crossed: "", program: "", photo: "" },
  { role: "Philanthropy Chair",   name: "TODO — Name", nick: "", crossed: "", program: "", photo: "" },
  { role: "Social Chair",         name: "TODO — Name", nick: "", crossed: "", program: "", photo: "" },
  { role: "Alumni Relations",     name: "TODO — Name", nick: "", crossed: "", program: "", photo: "" },
  { role: "Media & Marketing",    name: "TODO — Name", nick: "", crossed: "", program: "", photo: "" }
];

/* --- Active brothers ----------------------------------------------------- */
/* TODO: replace these sample rows with the real active roster.              */
window.LPHIE.actives = [
  { name: "TODO — Name", nick: "", class: "TODO — Class Name", crossed: "F25", program: "", family: "" },
  { name: "TODO — Name", nick: "", class: "TODO — Class Name", crossed: "F25", program: "", family: "" },
  { name: "TODO — Name", nick: "", class: "TODO — Class Name", crossed: "W25", program: "", family: "" },
  { name: "TODO — Name", nick: "", class: "TODO — Class Name", crossed: "W25", program: "", family: "" },
  { name: "TODO — Name", nick: "", class: "TODO — Class Name", crossed: "F24", program: "", family: "" },
  { name: "TODO — Name", nick: "", class: "TODO — Class Name", crossed: "F24", program: "", family: "" }
];

/* --- Charter class (verified — do not edit) ------------------------------ */
window.LPHIE.charterClass = [
  "Jason Chan", "Danny Chang", "Perry Cheung", "Daniel Co",
  "Howe Gu", "Kevin Ho", "Chia-Rhum Kwa", "Jarrett Lau",
  "Geoffrey Mo", "Elton Pang", "Richard Wing", "Calvin Yeung"
];

/* --- Big-little families / Uji (from the chapter GIM deck) --------------- */
window.LPHIE.families = [
  { name: "No Limit",      note: "" },
  { name: "Sons of Man",   note: "" },
  { name: "Life Lovers",   note: "" },
  { name: "Clan Curly",    note: "" },
  { name: "Stone Lineage", note: "" },
  { name: "The Firm",      note: "" }
];
