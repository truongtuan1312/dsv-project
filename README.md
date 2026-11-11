# Beyond the Heatmap: Predicting Sedation vs. Insomnia from Receptor Binding

**Question:** Can we predict whether a psychiatric medicine will make a patient sleepy or sleepless, just from the receptors it binds?

The core idea: medicines bind to receptor "locks" in the brain. Binding H1 tends to cause sedation (the brake); binding the serotonin transporter (SERT) tends to cause alertness/insomnia (the gas). Most drugs press both pedals to different degrees — this project measures how hard each medicine presses each pedal, then checks whether that explains what patients actually report.

## Data Sources

| Source | Used for | Link |
|---|---|---|
| **PDSP Ki Database** | Receptor binding affinities (Ki values) for each medicine at each receptor (H1, SERT, and others) | https://pdspdb.unc.edu/databases/kiDownload |
| **SIDER 4.1** (Side Effect Resource) | Reported side effects (sedation, insomnia) and their frequency per drug | https://zenodo.org/records/7877720 (archived mirror; original: http://sideeffects.embl.de) |
| **PubChem** | CID lookup used to join PDSP (CAS/SMILES) and SIDER (STITCH/CID) records to the same drug | https://pubchem.ncbi.nlm.nih.gov |

Terms of use: both PDSP and SIDER are public-domain / free-for-academic-research resources. See each source's site for exact terms; retrieval date and version are logged in `data/raw/README.md` once downloaded.

## Repo Structure

```
├── data/
│   ├── raw/          # original downloaded files (not committed — see .gitignore)
│   └── processed/    # cleaned, joined datasets used in analysis
├── notebooks/        # exploration, confirmation, and visualization notebooks
├── src/              # reusable data-processing / scoring functions
├── figures/          # exported charts for the report/slides
├── requirements.txt
└── README.md
```

## Setup

```bash
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Pipeline

1. **Acquire** — download PDSP Ki CSV and SIDER `meddra_freq.tsv.gz` into `data/raw/` (see links above).
2. **Process** — clean, convert Ki → pKi (`src/load_data.py`), then build one row per drug with pKi at the key receptors and sedation/insomnia rates (`python3 src/join_data.py` → `data/processed/drug_sleep_profile.csv`).
3. **Confirm** — test whether H1/SERT affinity predicts sedation/insomnia reports (`notebooks/02_confirmation.ipynb`).
4. **Visualize** — build the three design views: development scatter, confirmation scatter, communication chart.
   All three views live in one D3 v7 dashboard in `viz/`. From the repo root, run `python3 -m http.server 8001`,
   then open http://localhost:8001/viz/. **Teammates: read `viz/STYLEGUIDE.md` before building a view.**

## Random Seed

A fixed seed (`SEED = 42`) is used wherever randomness is involved (e.g., any sampling), set in `src/config.py`.

## Status

Project proposal stage — data acquisition and processing in progress.
