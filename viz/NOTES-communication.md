# Communication view: "Sleepy or sleepless?" (NOTES)

Owner: Nguyen Thi Khanh Linh (ITDSIU25019), Visualisation lead

## How to run
```
python3 src/join_data.py                 # from the repo root: rebuilds data/processed/drug_sleep_profile.csv
python3 -m http.server 8000              # from the repo root
# then open http://localhost:8000/viz/#communication
```
The server must run from the **repo root**. The view lives in `views/communication.js` and uses the shared
dashboard framework (`shared/`); see `STYLEGUIDE.md`.
Don't double-click `index.html`: the browser blocks `d3.csv` from `file://`, so the chart would be empty.

## 1. Task and audience
- **Audience:** non-experts (classmates, patients). **Task:** *compare* two things per drug: what the chemistry
  predicts and what patients report. It should also show *where the rule breaks*.
- **Message (title):** the H1 "brake" predicts sleepiness, but only partly.
- **Takeaways are a line-by-line list in plain language** (✓ What we found, ✗ What we didn't find, ! Exceptions,
  ⚠ Keep in mind): a one-idea headline, then one bullet per fact, so each point can be read on its own. Technical figures (ρ) appear small in brackets.
  All numbers are computed in `render()`.
- **The intro is split up:** the brake/gas key sits once in the dashboard header (shared by all views), the
  question gets its own line, and "how to read" is a set of short chips.

## 2. Data → marks and channels
| Data | Type | Mark | Channel |
|---|---|---|---|
| Drug | categorical (N) | row | vertical position (sorted) |
| pKi(H1) − pKi(SERT) | quantitative, diverging around 0 | bar | horizontal position/length from a zero baseline |
| Direction (brake vs gas) | categorical, 2 values | bar | colour hue (purple/orange), redundant with direction |
| % sleepiness, % sleeplessness | quantitative (ratio) | dot | horizontal position on one shared 0–50% axis |
| gap between the two rates | quantitative | line (dumbbell) | length |

Why these choices:
- Position on a common scale is the most effective channel for quantities, so both panels use it.
- The balance axis is **symmetric around 0**, so "brake" and "gas" bars are directly comparable.
- The same two hues mean the same thing in both panels (purple = sleep side, orange = awake side).
  That links chemistry and experience without a second legend.
- I used a dumbbell instead of grouped bars: one row per drug keeps the two panels aligned, and the
  connector makes "which is bigger" pre-attentive.
- Rejected options: pie (no comparison across drugs), dual-axis scatter (hard for non-experts), heatmap
  (colour is a weaker channel for exact %).

## 3. Interaction (same pattern as Lab 05)
- `pointerenter` / `pointermove` / `pointerleave` → tooltip with the exact pKi, the rates **and the number of
  reports behind each rate**, so a reader can see when a rate rests on only 2 reports.
- `click` → pin (the hover and pin states are kept separate). `Escape` or a second click → unpin. While a row
  is pinned, the other rows are dimmed.
- Sort buttons: by chemistry, by sleepiness or by sleeplessness. The keyed data join (`d => d.drug`) plus a
  staggered transition keeps each row identifiable while it moves.

## 4. Data fixes made before charting (in `src/`)
1. **Substring drug matching → exact matching.** "Amphetamine" used to pull in MDMA and ~20 analogues,
   "Sertraline" matched desmethylsertraline, and "Lithium" matched a lab reagent's lithium salt.
2. **SIDER double counting:** now keeps MedDRA **PT** only (every effect was listed as both LLT and PT).
3. **Placebo rows removed** (about 38k rows were placebo-arm frequencies being counted as the drug's).
4. **Receptor name variants merged** ("H1", "HISTAMINE H1", "hH1"; "SERT", "5-HT Transporter", …) using exact
   labels, so "GABA A alpha1" no longer counts as adrenergic alpha1.
5. **Many-to-many join replaced** by one row per drug (`drug_sleep_profile.csv`).
6. **CID mismatches fixed:** sertraline, fluvoxamine (salt CIDs), olanzapine and clozapine (old CIDs) now match SIDER.
   Citalopram and escitalopram stay separate.
7. Stray spaces and broken text encoding ("Â±") in PDSP names are cleaned.

## 5. Limitations (said on the page or here)
- 16 drugs qualify (both affinities plus both rates). These are not in PDSP: doxylamine, lamotrigine, lithium, lorazepam,
  modafinil, valproate, vortioxetine. Several drugs have no exact-% sleep reports in SIDER.
- Some rates rest on 2–4 label reports. The ρ values are descriptive (n = 16), not proof.
- "Highest matching term" (e.g. somnolence vs sedation) is a choice. Summing them would double count.
