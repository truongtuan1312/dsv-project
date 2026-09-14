"""Shared configuration constants."""

SEED = 42

RAW_DIR = "data/raw"
PROCESSED_DIR = "data/processed"

# Receptors of primary interest for the sedation-vs-insomnia question.
# H1 = histamine H1 receptor (sedation); SERT = serotonin transporter (alertness).
KEY_RECEPTORS = ["H1", "SERT", "M1", "5-HT2A", "D2", "alpha1"]
