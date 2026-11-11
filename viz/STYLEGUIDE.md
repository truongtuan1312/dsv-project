# Dashboard style guide (read before building your view)

The dashboard has **three views on one page**: 1 · Development, 2 · Confirmation, 3 · Communication.
They share one data load, one colour key, one layout and one interaction pattern, so the page reads as
one product rather than three separate charts. You only write **one file: `viz/views/<your-view>.js`**.

## 1. Run it
```bash
cd dsv-project            # the REPO ROOT, not viz/
python3 -m http.server 8001
```
Then open http://localhost:8001/viz/. If port 8001 is busy, use another number.
If your change doesn't show up, the browser is using an old copy: hard-refresh with **Cmd+Shift+R** (Windows: Ctrl+F5).
Don't double-click `index.html`, because the browser blocks loading the data from `file://`.
If you change the pipeline, rebuild the data with `python3 src/join_data.py`.

## 2. Files
```
viz/
├── index.html            # page shell: header, shared key, nav. Don't edit except to add a <script> line
├── shared/
│   ├── dashboard.css     # ALL colours, fonts, spacing. Don't add CSS in your view
│   └── dashboard.js      # Dash.*: data, colours, layout, svg(), hoverPin(), buttons(), spearman()
├── views/
│   ├── _template.js      # a working scatter: copy from here
│   ├── development.js    # View 1 (placeholder: replace)
│   ├── confirmation.js   # View 2 (placeholder: replace)
│   └── communication.js  # View 3 (done; a full real example)
├── lib/d3.v7.min.js      # offline fallback
├── STYLEGUIDE.md
└── NOTES-communication.md
```
**Only edit your own `views/*.js`.** If you need something in `shared/`, ask in the group chat first,
because a change there affects all three views.

## 3. How to build your view (step by step)
1. Open `views/_template.js` and copy everything inside `Dash.register({ ... })` into your file.
2. Fill in the fields at the top (table below). Keep your `id` and `order`.
3. Write `render()` and remove `status: "todo"`.
4. Return 3–5 **takeaway lines** in plain language (section 7).
5. Check everything in section 8, then open a pull request.

| Field | What to write | Example |
|---|---|---|
| `title` | The **claim** the chart proves, in everyday words, ≤ 12 words. Not a topic. | ✓ "Medicines that press the brake harder make more people sleepy"  ✗ "H1 vs sedation" |
| `question` | One everyday question the reader can answer by looking | "Do medicines that press the brake harder leave more people sleepy?" |
| `howToRead` | 2–4 chips: `["bold label", "plain words"]` | `["Across", "how hard it presses the brake"]` |
| `source` | Datasets and any filtering | "PDSP K<sub>i</sub>, SIDER 4.1" |
| `owner` | Name (student ID) | |

**Every view gets the same section skeleton, built automatically:** kicker → title → question →
how-to-read chips → controls → chart → takeaway list → source and owner. Don't add your own headings,
paragraphs or legends outside it.

## 4. Colour (the most important rule)
| Colour | Means | Use |
|---|---|---|
| Purple `Dash.COLORS.brake` | H1 / **sleepiness** | only for these |
| Orange `Dash.COLORS.gas` | SERT / **sleeplessness** | only for these |
| Grey `Dash.COLORS.neutral` | anything else (other receptors, all drugs) | default |

- Never use purple or orange for anything else. A reader learns the key once, in the header.
- No other hues. To separate more groups, use shape, position or small multiples, not new colours.
- Use colour for meaning only, never just for decoration.

## 5. Layout and axes
- Always use `Dash.svg(chart, innerHeight, ariaLabel)`. It sets the same width (1000) and margins
  (`left: 120` for labels, `right: 170` for annotations) in every view.
- Every axis gets a plain label that says the direction (`"presses the brake harder →"`, `"↑ patients out of 100 who felt sleepy"`). Use classes
  `axis`, `grid` and `axis-label`.
- Rates (%) start at **0**. Grip axes may use `.nice()` around the data.
- Use the shared number formats: `Dash.fmt.pKi` (1 decimal), `Dash.fmt.pct`, `Dash.fmt.signed`, `Dash.fmt.rho`.
- Label the 2–3 most important points directly on the chart (class `annot`), not every point.

## 6. Interaction (same in every view)
- `Dash.hoverPin(selection, d => html)`: hover shows the tooltip, click pins it, Esc unpins. Don't write your
  own tooltip.
- Tooltip order: **name (bold) → plain sentence(s) → rates with `(from n reports)` → technical numbers last, in a small `<span class="sci">`**.
- Controls: `Dash.buttons(controls, "Label:", [{key, label}], onPick)`. When marks move, use a keyed join
  (`d => d.drug`) and a ~750 ms transition so each drug stays trackable.

## 7. Takeaways (line by line, in plain language)
Return `{ takeaways: [...] }` from `render()`. They appear under the chart as a list titled **"What this shows"**.
Each item has a **category tag**, **one short headline sentence**, and then **one bullet per supporting fact**.
Don't pack two ideas into one sentence; split them into bullets.

```js
{ type: "holds",
  text: "Medicines that press the brake make people sleepier.",           // headline: the point
  points: ["<b>31%</b> of patients on Olanzapine, Quetiapine or Clozapine felt sleepy, while only <b>13%</b> on Fluvoxamine, Sertraline or Paroxetine did."],
  stat: "link strength 0.50 on a 0-to-1 scale" }                        // optional, shown small
```

Renders as:

> **✓ WHAT WE FOUND**   **Medicines that press the brake make people sleepier.**
> • **31%** of patients on Olanzapine, Quetiapine or Clozapine felt sleepy, while only **13%** on Fluvoxamine, Sertraline or Paroxetine did.

| `type` | Tag shown | Use for |
|---|---|---|
| `holds` | ✓ What we found | what the data shows |
| `fails` | ✗ What we didn't find | what we expected but the data does *not* show |
| `exception` | ! Exceptions | named medicines that break the pattern (one bullet each) |
| `caveat` | ⚠ Keep in mind | how much data, and its limits |

- Write 3–5 lines per view, and always include one `caveat`.
- **Compute every number from `data`** inside `render()`. Never type a number in by hand.
- Section 7b explains how to word them.

## 7b. Write for someone who knows nothing about medicine
Picture a classmate from another major, or a patient. If they'd have to look a word up, change it.
**Every visible word counts:** the title, question, chips, axis labels, legend, buttons, tooltip and takeaways.
Only the small source line ("For experts. …") may be technical.

**Use the same words as everyone else on the team:**

| Don't write | Write instead |
|---|---|
| receptor, target, binding site | (docking) spot |
| H1 | the brake (you may add "(scientific name: H1)" once, small) |
| SERT | the gas |
| pKi, Ki, affinity, binding | grip, or "how hard it presses" |
| H1 − SERT balance | brake vs gas, or "which pedal it presses harder" |
| sedation, somnolence | feeling sleepy |
| insomnia, sleeplessness | trouble sleeping |
| drug, ligand, compound | medicine |
| % reporting, incidence, frequency | "**31%** of patients felt sleepy" (whole numbers) |
| ρ, r, correlation | "link strength 0.50 on a 0-to-1 scale" (put it in `stat`, small) |
| p-value, significant | "could be luck" / "unlikely to be luck" |
| n = 16 | "16 medicines" |
| 5-HT2A, alpha1, M1, dopamine … | "other calming spots" / "a different brain chemical" |
| x / y axis (in chips) | Across / Up |

**Checks:**
- Can you read the sentence aloud to a friend without stopping to explain a word?
- Are numbers whole percentages ("31%", not 30.97%)?
- Is the headline one idea, with the details in bullets?
- Does each line make sense on its own, without the chart?
- ✓ Headline "Medicines that press the brake make people sleepier." + bullet "**31%** of patients on … felt sleepy, while only **13%** on … did."
- ✗ "Mean sedation_pct for top-3 H1−SERT = 31.0 vs 12.8; ρ = 0.50"

## 8. Checklist before you open a PR
- [ ] Only `views/<mine>.js` changed (plus `NOTES-<mine>.md` if you write notes).
- [ ] The title is a claim, and the question is one sentence.
- [ ] No medical or statistics terms anywhere a reader will see (section 7b word list).
- [ ] Only purple, orange and grey are used, with the meanings above.
- [ ] Axes are labelled with units, and rates start at 0.
- [ ] Hover, click-pin and Esc work, and the tooltip shows `(n reports)`.
- [ ] There are 3–5 takeaway lines in plain language, including a caveat, and no hard-coded numbers.
- [ ] The console shows `[your-id] N of 32 drugs have …` and no errors.
- [ ] The page still works after you scroll through all three views.

## 9. Git workflow
```bash
git checkout -b view/<your-id>       # e.g. view/confirmation
# ...work...
git add viz/views/<your-id>.js
git commit -m "Add <your-id> view"
git push -u origin view/<your-id>    # then open a PR and ask the Visualisation lead to review
```
