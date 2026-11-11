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

RAW = RAW_DIR
PROCESSED = PROCESSED_DIR


def load_pdsp(filename: str = "KiDatabase.csv") -> pd.DataFrame:
    """Load the raw PDSP Ki database CSV."""
    df = pd.read_csv(RAW / filename, low_memory=False)
    df.columns = df.columns.str.strip()  # PDSP's export has a stray leading space on some headers
    return df


def clean_pdsp(df: pd.DataFrame) -> pd.DataFrame:
    """Deduplicate, coerce Ki to numeric, and compute pKi."""
    df = df.copy()
    df = df.rename(columns={"Name": "Receptor"})  # PDSP's 'Name' column is actually the receptor name
    # Tidy text: PDSP has stray spaces ("  Adrenaline Alpha1") and UTF-8 text that
    # was decoded as Latin-1 ("Â±"), which would split one receptor/drug into several.
    for col in ["Ligand Name", "Receptor"]:
        df[col] = df[col].astype(str).map(fix_mojibake).str.strip().str.replace(r"\s+", " ", regex=True)
    df["Ki_value"] = pd.to_numeric(df["ki Val"], errors="coerce")
    df = df.dropna(subset=["Ki_value"])
    df = df[df["Ki_value"] > 0]  # drop zero/negative Ki — log10 undefined, likely data errors
    # Median Ki per (ligand, receptor) pair to collapse repeated assays
    df = (
        df.groupby(["Ligand Name", "Receptor"], as_index=False)["Ki_value"]
        .median()
    )
    # pKi: higher = stronger binding
    df["pKi"] = -np.log10(df["Ki_value"] * 1e-9)
    return df


def fix_mojibake(text: str) -> str:
    """Undo UTF-8 bytes mis-read as Latin-1 (e.g. 'Â±' -> '±'); leave clean text alone."""
    try:
        return text.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def load_sider_freq(filename: str = "meddra_freq.tsv.gz") -> pd.DataFrame:
    """Load the SIDER drug-side-effect frequency file."""
    columns = [
        "stitch_id_flat", "stitch_id_stereo", "umls_cui_from_label",
        "placebo", "frequency", "lower", "upper",
        "meddra_type", "umls_cui_from_meddra", "side_effect_name",
    ]
    df = pd.read_csv(RAW / filename, sep="\t", names=columns, compression="gzip")
    return df


def clean_sider(df: pd.DataFrame) -> pd.DataFrame:
    """Keep one MedDRA level and drop placebo-arm rows.

    SIDER lists every side effect twice (LLT and PT); keeping both double-counts.
    Rows marked 'placebo' are the frequency in the placebo group, not the drug.
    """
    df = df[(df["meddra_type"] == "PT") & (df["placebo"].isna())].copy()
    df["side_effect_name"] = df["side_effect_name"].str.lower().str.strip()
    # Exact percentages have lower == upper; word bins ("common" = 1-100%) are too wide to use as a rate.
    df["is_exact"] = df["lower"] == df["upper"]
    return df


if __name__ == "__main__":
    pdsp_raw = load_pdsp()
    pdsp_clean = clean_pdsp(pdsp_raw)
    pdsp_clean.to_csv(PROCESSED / "pdsp_clean.csv", index=False)
    print(f"Saved {len(pdsp_clean)} cleaned PDSP rows.")

    sider = load_sider_freq()
    sider.to_csv(PROCESSED / "sider_freq.csv", index=False)
    print(f"Saved {len(sider)} SIDER frequency rows.")
