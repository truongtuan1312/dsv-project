"""Shared configuration constants."""

from pathlib import Path

SEED = 42

# Anchor all paths to this file's location (src/), then go up one level
# to the repo root. This makes paths work correctly regardless of the
# current working directory — PowerShell, Code Runner, or Jupyter notebooks.
REPO_ROOT = Path(__file__).resolve().parent.parent

RAW_DIR = REPO_ROOT / "data" / "raw"
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
VIZ_DIR = REPO_ROOT / "viz"

# Receptors of primary interest for the sedation-vs-insomnia question.
# H1 = histamine H1 receptor (sedation); SERT = serotonin transporter (alertness).
KEY_RECEPTORS = ["H1", "SERT", "M1", "5-HT2A", "D2", "alpha1"]

# PDSP spells the same receptor many ways ("H1", "HISTAMINE H1", "hH1" ...).
# Each key receptor maps to the exact PDSP labels that mean it. Exact labels
# (not substring search) so e.g. "Pim-1 oncogene" never counts as M1 and
# "GABA A alpha1" never counts as adrenergic alpha1.
RECEPTOR_ALIASES = {
    "H1": ["H1", "HISTAMINE H1", "hH1"],
    "SERT": ["SERT", "Serotonin Transporter (SERT)", "5-HT Transporter",
             "Serotonin uptake"],
    "M1": ["Muscarinic M1", "Cholinergic, muscarinic M1", "hM1"],
    "5-HT2A": ["5-HT2A", "Serotonin 5-HT2A", "h5-HT2A"],
    "D2": ["D2", "DOPAMINE D2", "D2L", "D2S", "DOPAMINE D2 Long",
           "DOPAMINE D2 Short", "hD2L", "rD2", "Dopamine D2A"],
    "alpha1": ["Adrenaline Alpha1", "Adrenaline alpha1", "Adrenergic alpha1A/B",
               "adrenergic Alpha1", "adrenergic Alpha1A", "adrenergic Alpha1B",
               "adrenergic Alpha1D", "Alpha 1 Adrenergic Receptor", "alpha1",
               "alpha1A", "alpha1-Adrenocepter", "halpha1B-adrenergic",
               "noradrenaline-alpha1"],
}

# MedDRA Preferred Terms (lower-case) that count as each outcome.
SEDATION_TERMS = {"somnolence", "sedation", "drowsiness", "hypersomnia",
                  "excessive daytime sleepiness", "oversedation"}
INSOMNIA_TERMS = {"insomnia", "initial insomnia", "middle insomnia",
                  "terminal insomnia", "sleep disorder"}
