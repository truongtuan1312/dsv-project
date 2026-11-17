# Confirmation view: "The brake–sleepiness link would rarely appear by luck; a gas link easily could" (NOTES)

Owner: TBD

## How to run
```
python3 -m http.server 8001              # from the repo root
# then open http://localhost:8001/viz/#confirmation
```
The view lives in `views/confirmation.js` and uses the shared framework (`shared/`); see `STYLEGUIDE.md`.

## 1. Task and audience
- **Stage:** confirmation. Hypothesis: the more a medicine presses the brake relative to the gas
  (pKi(H1) − pKi(SERT)), the more patients feel sleepy, and the fewer have trouble sleeping.
- **Task:** decide whether the pattern seen in Views 1 and 3 could be luck.
- **Test:** a shuffle (permutation) test, explained to non-experts as *"we shuffled which medicine had which
  rate 5,000 times and counted how often luck alone gave a link this strong"*. It needs no distribution assumptions,
  which suits 16 drugs. It is seeded (`SEED = 42`, same as `src/config.py`), so the numbers don't change between loads.
- **Result at the time of writing (16 drugs):**
  - sleepiness: link strength **0.50**, shuffle share ≈ **0.05**, a borderline pass
  - trouble sleeping: link strength **0.22**, shuffle share ≈ **0.40**, could easily be luck

  The takeaway type (`holds` / `fails`) and the wording are chosen in code from these values. The **title is static**, so
  update it if the data changes the verdict.

## 2. Data → marks and channels
| Data | Type | Mark | Channel |
|---|---|---|---|
| Brake-vs-gas balance | quantitative, diverging around 0 | dot | horizontal position (symmetric axis, same as View 3) |
| % felt sleepy / trouble sleeping | quantitative (ratio) | dot | vertical position from 0 |
| Outcome shown | categorical (2) | dot | colour: purple = sleepy, orange = trouble sleeping |
| Trend | quantitative | dashed line | slope (least squares) |
| Shuffled link strengths | distribution | histogram bars | height; grey, darker where \|ρ\| ≥ real \|ρ\| |
| Real link strength | quantitative | vertical ink line | position on the same −1…+1 axis |
| Share of shuffles that match | quantitative | text | "N in 100" in the right margin |

Why:
- Putting the scatter (the effect) next to the null distribution (luck) makes "is it luck?" something you can
  answer by looking: is the black line out in the tail or in the middle of the grey hill?
- The histogram uses grey only (its bars aren't brake or gas). Lightness, not a new hue, marks the tail.
- The two drugs farthest from the trend are labelled automatically (largest absolute residual) rather than picked by hand.
- Rejected: printing a p-value table (not readable for the audience), and confidence bands (they assume a linear
  model, which the ranked test doesn't).

## 3. Interaction
- `Dash.hoverPin` on the dots: plain-language pedal sentence, the rate `(from n reports)`, how far the drug sits
  from the trend line, then grips and balance in small text.
- Buttons **Felt sleepy / Trouble sleeping**: dots, colour, trend line, labels and the histogram all update with a
  750 ms transition (dots keyed by drug). Each shuffle test is computed once and cached.

## 4. Limitations
- 16 drugs. A small test can miss a real link (low power), and it says nothing about cause.
- One test per outcome is shown. Testing two outcomes slightly raises the chance that one passes by luck, which
  is another reason to call the sleepiness result *borderline*.
- Some rates rest on 1–2 label reports (counted in the caveat). Same drug set and data limits as View 3.
