"""
Merge PDSP (receptor binding) and SIDER (side effects) on PubChem CID.

PDSP identifies drugs by name/CAS number — no PubChem CID out of the box.
SIDER identifies drugs by "STITCH" compound IDs, which are just PubChem CIDs
with a fixed offset for the "flat" (stereo-collapsed) version:
    stitch_id_flat = "CID" + zero-padded(real_CID + 100000000)

So the plan is:
  1. Filter PDSP down to a curated, manageable list of psychiatric/psychoactive
     drugs (instead of looking up all ~15,000 ligands, which would take hours).
  2. Look up each remaining PDSP ligand name -> PubChem CID, once, via the
     PubChem PUG REST API (name search), with local caching so re-runs are
     fast and don't hammer the API.
  3. Convert SIDER's stitch_id_flat -> plain CID.
  4. Inner-join PDSP (now with CID) and SIDER (now with CID) on that CID.

NOTE ON NETWORK ACCESS:
This script calls pubchem.ncbi.nlm.nih.gov, so it must be run on a machine
with normal internet access. Run it once — after the first run, cid_cache.json
means you won't need to hit the network again unless you add new drug names.
"""

import json
import time
import re
from pathlib import Path

import pandas as pd
import requests

from config import RAW_DIR, PROCESSED_DIR

RAW = RAW_DIR
PROCESSED = PROCESSED_DIR
CACHE_FILE = PROCESSED / "cid_cache.json"

PUBCHEM_NAME_URL = (
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{name}/cids/JSON"
)

# Strip common salt/form suffixes that trip up PubChem's exact-name search.
SALT_SUFFIXES = re.compile(
    r"\b(hydrochloride|hcl|sulfate|maleate|besylate|tartrate|citrate|"
    r"fumarate|succinate|mesylate|acetate|sodium|hydrobromide)\b",
    flags=re.IGNORECASE,
)

# A curated list of well-known psychiatric/psychoactive medicines relevant
# to the sedation-vs-insomnia question. Filtering to this list — instead of
# looking up all ~15,000 PDSP ligands — cuts the PubChem lookup from hours
# to seconds. Add/remove names as needed for your project.
RELEVANT_DRUGS = [
    "Diphenhydramine", "Doxylamine", "Hydroxyzine", "Mirtazapine",
    "Trazodone", "Quetiapine", "Olanzapine", "Amitriptyline",
    "Doxepin", "Clomipramine", "Fluoxetine", "Sertraline",
    "Paroxetine", "Citalopram", "Escitalopram", "Venlafaxine",
    "Duloxetine", "Bupropion", "Fluvoxamine", "Desvenlafaxine",
    "Vortioxetine", "Vilazodone", "Risperidone", "Aripiprazole",
    "Ziprasidone", "Haloperidol", "Clozapine", "Diazepam",
    "Lorazepam", "Alprazolam", "Zolpidem", "Buspirone",
    "Modafinil", "Methylphenidate", "Amphetamine", "Atomoxetine",
    "Lithium", "Lamotrigine", "Valproate", "Carbamazepine",
]


def _load_cache() -> dict:
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text())
    return {}


def _save_cache(cache: dict) -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, indent=2))


def clean_ligand_name(name: str) -> str:
    """Strip salt suffixes and extra whitespace for a cleaner PubChem query."""
    name = SALT_SUFFIXES.sub("", name)
    return re.sub(r"\s+", " ", name).strip(" ,")


def filter_to_relevant_drugs(pdsp_df: pd.DataFrame, name_col: str = "Ligand Name") -> pd.DataFrame:
    """Restrict PDSP data to a curated, manageable substance list before CID lookup."""
    pattern = "|".join(RELEVANT_DRUGS)
    mask = pdsp_df[name_col].str.contains(pattern, case=False, na=False, regex=True)
    filtered = pdsp_df[mask].copy()
    print(f"Filtered {len(pdsp_df)} rows -> {len(filtered)} rows "
          f"({filtered[name_col].nunique()} unique ligands)")
    return filtered


def lookup_cid(name: str, cache: dict, pause: float = 0.2) -> int | None:
    """Look up a single drug name's PubChem CID, using/populating a cache."""
    key = name.lower().strip()
    if key in cache:
        return cache[key]

    query_name = clean_ligand_name(name)
    try:
        resp = requests.get(PUBCHEM_NAME_URL.format(name=query_name), timeout=10)
        time.sleep(pause)  # be polite to the free API
        if resp.status_code == 200:
            cids = resp.json().get("IdentifierList", {}).get("CID", [])
            cid = cids[0] if cids else None
        else:
            cid = None
    except requests.RequestException:
        cid = None

    cache[key] = cid
    return cid


def add_pubchem_cids(pdsp_df: pd.DataFrame, name_col: str = "Ligand Name") -> pd.DataFrame:
    """Add a PubChem CID column to the PDSP dataframe, looking up each unique name once."""
    cache = _load_cache()
    unique_names = pdsp_df[name_col].dropna().unique()

    print(f"Looking up PubChem CIDs for {len(unique_names)} unique ligand names...")
    for i, name in enumerate(unique_names, 1):
        lookup_cid(name, cache)
        if i % 25 == 0:
            print(f"  ...{i}/{len(unique_names)} done")
            _save_cache(cache)  # checkpoint periodically

    _save_cache(cache)

    pdsp_df = pdsp_df.copy()
    pdsp_df["pubchem_cid"] = pdsp_df[name_col].str.lower().str.strip().map(cache)
    return pdsp_df


def add_pubchem_cid_to_sider(sider_df: pd.DataFrame) -> pd.DataFrame:
    """Convert SIDER's stitch_id_flat into a plain PubChem CID."""
    sider_df = sider_df.copy()
    # stitch_id_flat looks like "CID100000085" -> strip "CID" prefix (3 chars) -> 100000085
    # -> subtract the flat-ID offset (1e8) -> real PubChem CID = 85
    sider_df["pubchem_cid"] = (
        sider_df["stitch_id_flat"].str.slice(3).astype("Int64") - 100_000_000
    )
    return sider_df


def merge_pdsp_sider(pdsp_df: pd.DataFrame, sider_df: pd.DataFrame) -> pd.DataFrame:
    """Inner-join the two datasets on PubChem CID."""
    pdsp_with_cid = add_pubchem_cids(pdsp_df)
    sider_with_cid = add_pubchem_cid_to_sider(sider_df)

    merged = pdsp_with_cid.merge(
        sider_with_cid,
        on="pubchem_cid",
        how="inner",
        suffixes=("_pdsp", "_sider"),
    )
    return merged


if __name__ == "__main__":
    pdsp_clean = pd.read_csv(PROCESSED / "pdsp_clean.csv")
    sider_freq = pd.read_csv(PROCESSED / "sider_freq.csv")

    pdsp_clean = filter_to_relevant_drugs(pdsp_clean)

    merged = merge_pdsp_sider(pdsp_clean, sider_freq)
    out_path = PROCESSED / "merged_receptor_side_effects.csv"
    merged.to_csv(out_path, index=False)

    print(f"Merged dataset: {len(merged)} rows -> {out_path}")
    print(f"Unique drugs matched: {merged['pubchem_cid'].nunique()}")