"""Shared configuration constants."""

from pathlib import Path

SEED = 42

# Anchor all paths to this file's location (src/), then go up one level
# to the repo root. This makes paths work correctly regardless of the
# current working directory — PowerShell, Code Runner, or Jupyter notebooks.
REPO_ROOT = Path(__file__).resolve().parent.parent

RAW_DIR = REPO_ROOT / "data" / "raw"
PROCESSED_DIR = REPO_ROOT / "data" / "processed"

# Receptors of primary interest for the sedation-vs-insomnia question.
# H1 = histamine H1 receptor (sedation); SERT = serotonin transporter (alertness).
KEY_RECEPTORS = ["H1", "SERT", "M1", "5-HT2A", "D2", "alpha1"]