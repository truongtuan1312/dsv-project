"""
Load and lightly clean PDSP Ki data and SIDER side-effect data.

Expected raw files (place in data/raw/ after manual download — see README):
  - PDSP: KiDatabase.csv (from https://pdspdb.unc.edu/databases/kiDownload)
  - SIDER: meddra_freq.tsv.gz (from https://zenodo.org/records/7877720)
"""

import pandas as pd
import numpy as np
from pathlib import Path
from config import RAW_DIR, PROCESSED_DIR

RAW = Path(RAW_DIR)
PROCESSED = Path(PROCESSED_DIR)


def load_pdsp(filename: str = "KiDatabase.csv") -> pd.DataFrame:
    """Load the raw PDSP Ki database CSV."""
    df = pd.read_csv(RAW / filename, low_memory=False)
    return df


def clean_pdsp(df: pd.DataFrame) -> pd.DataFrame:
    """Deduplicate, coerce Ki to numeric, and compute pKi."""
    df = df.copy()
    df["Ki_value"] = pd.to_numeric(df.get("Ki (nM)", df.get("ki_val")), errors="coerce")
    df = df.dropna(subset=["Ki_value"])
    # Median Ki per (ligand, receptor) pair to collapse repeated assays
    df = (
        df.groupby(["Ligand Name", "Receptor"], as_index=False)["Ki_value"]
        .median()
    )
    # pKi: higher = stronger binding
    df["pKi"] = -np.log10(df["Ki_value"] * 1e-9)
    return df


def load_sider_freq(filename: str = "meddra_freq.tsv.gz") -> pd.DataFrame:
    """Load the SIDER drug-side-effect frequency file."""
    columns = [
        "stitch_id_flat", "stitch_id_stereo", "umls_cui_from_label",
        "placebo", "frequency", "lower", "upper",
        "meddra_type", "umls_cui_from_meddra", "side_effect_name",
    ]
    df = pd.read_csv(RAW / filename, sep="\t", names=columns, compression="gzip")
    return df


if __name__ == "__main__":
    pdsp_raw = load_pdsp()
    pdsp_clean = clean_pdsp(pdsp_raw)
    pdsp_clean.to_csv(PROCESSED / "pdsp_clean.csv", index=False)
    print(f"Saved {len(pdsp_clean)} cleaned PDSP rows.")

    sider = load_sider_freq()
    sider.to_csv(PROCESSED / "sider_freq.csv", index=False)
    print(f"Saved {len(sider)} SIDER frequency rows.")
