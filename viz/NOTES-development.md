# Development view: "The brake is not the only spot that goes with feeling sleepy" (NOTES)

Owner: Dang Le Truc Linh (ITDSIU25018)

## How to run
```
python3 -m http.server 8001              # from the repo root
# then open http://localhost:8001/viz/#development
```
The view lives in `views/development.js` and uses the shared framework (`shared/`); see `STYLEGUIDE.md`.

## 1. Task and audience
- **Stage:** exploration. Before testing "brake → sleepy" (View 2) and explaining it (View 3), we check
  which of the six measured docking spots actually go with the two sleep outcomes.
- **Task:** *compare* one relationship (grip vs % of patients) across six spots and spot the strongest.
- **Message (title):** the brake goes with feeling sleepy, but it is not the strongest of the six.
  At the time of writing the brake's link strength with sleepiness was 0.35 (20 drugs). α1 (0.58),
  5-HT2A (0.48) and D2 (0.43) were higher. The takeaways are computed in `render()`, so they update if the data changes.
  If a pipeline change ever makes H1 the top spot, the **title must be rewritten** (it is the only static claim).

## 2. Data → marks and channels
| Data | Type | Mark | Channel |
|---|---|---|---|
| Docking spot | categorical (6) | panel | small multiples (2 × 3 grid), position |
| Grip (pKi) at that spot | quantitative | dot | horizontal position, **one shared axis for all panels** |
| % felt sleepy / trouble sleeping | quantitative (ratio) | dot | vertical position, shared 0–50% axis |
| Brake / gas / other | categorical | dot + panel title | colour: purple, orange, grey (shared key) |
| Link strength (Spearman ρ), n | quantitative | text | panel subtitle |

Why:
- Small multiples with **shared scales** let the reader compare slopes across spots without reading tick labels.
  A single scatter with six colours would break the three-colour rule.
- Only the brake and gas panels are coloured. The four other spots are grey, as the style guide requires.
- Spearman (rank) rather than Pearson: rates are skewed and several grips sit at the 5.0 floor.
- Rejected: a heatmap of ρ (hides the drugs and the floor values), one scatter with a spot dropdown (no
  side-by-side comparison).

## 3. Interaction
- `Dash.hoverPin` on **all dots at once**. Each drug is one data object shared by its dots in every panel,
  so pinning a drug dims every other drug in all six panels and you can follow it across spots.
  The tooltip lists the drug's grip at every spot and the `(from n reports)` count.
- Buttons **Felt sleepy / Trouble sleeping** move the dots with a 750 ms staggered transition (keyed by drug)
  and update each panel's link strength. Drugs without the chosen rate are hidden rather than removed,
  so the hover wiring is kept.

## 4. Limitations
- Each panel has a different set of drugs (16–20), because PDSP doesn't measure every drug at every spot.
- pKi = 5.0 (and 6.0 for some drugs) is usually a "no binding up to 10 µM" floor, not a measurement.
  These dots line up in columns. The caveat line counts how many drugs are affected.
- The spots are correlated: medicines that grip α1 often grip H1 and 5-HT2A too (antipsychotics, tricyclics).
  This view shows association only. It cannot separate the spots from each other.
