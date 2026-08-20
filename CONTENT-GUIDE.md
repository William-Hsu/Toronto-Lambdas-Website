# Content Guide — for whoever inherits this site

Written for the next media chair. You do not need to know how to code.

## The 15-minute handover

1. Open `data/chapter.js`. Fix the email, Instagram handle and rush form link. **Do this first** —
   these appear on every page.
2. Open `data/roster.js`. Replace the exec board `TODO` entries with the real board.
3. Open `data/content.js`. Update `rushTermLabel` and the rush schedule for this term.
4. Save. Refresh the browser. Done.

## Rules for editing data files

Each entry looks like this:

```js
{ name: "Jane Doe", nick: "Nickname", crossed: "F26" },
```

- Keep the **quotes** around text and the **comma** at the end of each line
- The last entry before a `]` does not need a trailing comma (but one is harmless)
- To leave a field blank, use `""` — do not delete the field
- If the page goes blank after an edit, you have a typo. Press **F12** in the browser,
  read the red error in the Console tab, and it will tell you the line number.

**Always work on a copy or a branch if you are nervous.** Git keeps every previous version:
`git log` shows the history, `git checkout <commit> -- data/roster.js` restores an old one.

## Termly checklist

- [ ] Update `rushTermLabel` and the rush schedule in `data/content.js`
- [ ] Add the new class to `window.LPHIE.actives` in `data/roster.js`
- [ ] Add the class reveal video to `window.LPHIE.reveals`
- [ ] Refresh the chapter GPA in `data/chapter.js`
- [ ] Add 4–6 event photos to `assets/img/gallery/` and list them in `data/content.js`
- [ ] Update the exec board after elections
- [ ] Run `grep -rn "TODO" data/` and clear anything stale

## Yearly checklist

- [ ] Add graduating brothers to the alumni page if they want to be listed
- [ ] Review the FAQ — has anything changed about the process?
- [ ] Check every external link still resolves
- [ ] Compress and archive old gallery photos so the repo stays small

## Writing tone

The copy on this site is deliberately plain and direct. Rushees have read a lot of fraternity
websites that sound identical. Some principles worth keeping:

- **Answer the question that was actually asked.** "Do I have to be Asian?" gets a direct "No"
  in the first word, not three sentences of context first.
- **Say the awkward part.** The registry page mentions the needle. The rush page mentions the GPA
  minimum. Being upfront reads as confidence.
- **Do not oversell.** "One event. That's all we're asking" converts better than superlatives.
- **Never write anything about the new member process that you would not want a parent to read.**

## Things to be careful about

- **Photos of people.** Get consent before putting someone's face on a public website, especially
  rushees who did not end up joining. Remove a photo promptly if asked.
- **Personal contact details.** Use the chapter email, never a brother's personal phone number.
- **The marks.** The crest and letters are trademarks of the international fraternity. Do not
  restyle, recolour or stretch them.
- **Hazing.** Nothing on this site should ever imply the chapter does anything prohibited, even
  as a joke. Screenshots outlive the joke.
