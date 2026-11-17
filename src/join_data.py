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
  4. Build ONE ROW PER DRUG: median pKi per key receptor + sedation/insomnia rates.

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

from config import (RAW_DIR, PROCESSED_DIR, KEY_RECEPTORS, RECEPTOR_ALIASES,
                    SEDATION_TERMS, INSOMNIA_TERMS)
from load_data import clean_sider, fix_mojibake

RAW = RAW_DIR
PROCESSED = PROCESSED_DIR
CACHE_FILE = PROCESSED / "cid_cache.json"

# same_connectivity also returns salts/stereo forms of the same molecule, which
# is how SIDER often stores a drug (sertraline is 5203 there, 68617 by name).
PUBCHEM_NAME_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{name}/cids/JSON"
PUBCHEM_CONN_URL = PUBCHEM_NAME_URL + "?cids_type=same_connectivity"

# CIDs SIDER uses that PubChem no longer links to the name (checked by hand:
# SIDER CID 4585 = olanzapine, 2818 = clozapine).
LEGACY_CIDS = {"olanzapine": [4585], "clozapine": [2818]}

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


# PDSP spellings that differ from the standard name.
NAME_ALIASES = {"doxepine": "doxepin", "valproic acid": "valproate",
                "dextroamphetamine": "amphetamine", "d-amphetamine": "amphetamine"}

# Stereo prefixes like "(+)-", "(-)-", "(±)-", "(R)-" in front of the drug name.
STEREO_PREFIX = re.compile(r"^\((?:\+|-|±|\+/-|[RS])\)-?\s*", flags=re.IGNORECASE)


def canonical_drug_name(ligand: str) -> str | None:
    """Return the RELEVANT_DRUGS name this PDSP ligand *is*, or None.

    Exact match after cleaning — not substring search. Substring search made
    'Amphetamine' match MDMA and ~20 other amphetamine analogues, 'Sertraline'
    match its metabolite desmethylsertraline, and 'Lithium' match a lithium salt
    of an unrelated lab reagent.
    """
    name = clean_ligand_name(str(ligand)).lower()
    name = STEREO_PREFIX.sub("", name).strip()
    name = NAME_ALIASES.get(name, name)
    lookup = {d.lower(): d for d in RELEVANT_DRUGS}
    return lookup.get(name)


def filter_to_relevant_drugs(pdsp_df: pd.DataFrame, name_col: str = "Ligand Name") -> pd.DataFrame:
    """Restrict PDSP data to the curated drug list and add a 'drug' column."""
    df = pdsp_df.copy()
    df["drug"] = df[name_col].map(canonical_drug_name)
    filtered = df.dropna(subset=["drug"])
    missing = sorted(set(RELEVANT_DRUGS) - set(filtered["drug"]))
    print(f"Filtered {len(pdsp_df)} rows -> {len(filtered)} rows "
          f"({filtered['drug'].nunique()} of {len(RELEVANT_DRUGS)} drugs found)")
    if missing:
        print("Not in PDSP (no binding data):", ", ".join(missing))
    return filtered


def _get_cids(url: str, pause: float) -> list[int] | None:
    try:
        resp = requests.get(url, timeout=15)
        time.sleep(pause)  # be polite to the free API
    except requests.RequestException:
        return None  # network failure: don't cache, retry next run
    if resp.status_code != 200:
        return []
    return resp.json().get("IdentifierList", {}).get("CID", [])


def lookup_cid(name: str, cache: dict, pause: float = 0.2) -> dict:
    """Look up a drug's PubChem CIDs, using/populating a cache.

    Returns {"primary": [CIDs for this exact name], "related": [all CIDs with the
    same connectivity: salts and stereo forms]}. 'primary' keeps citalopram and
    escitalopram apart; 'related' finds SIDER's records when SIDER stored a salt
    (sertraline is 5203 there, 68617 by name).
    """
    key = name.lower().strip()
    if isinstance(cache.get(key), dict):
        return cache[key]
    query = clean_ligand_name(name)
    primary = _get_cids(PUBCHEM_NAME_URL.format(name=query), pause)
    related = _get_cids(PUBCHEM_CONN_URL.format(name=query), pause)
    if primary is None or related is None:
        return {"primary": [], "related": []}
    legacy = LEGACY_CIDS.get(key, [])
    entry = {"primary": primary + legacy, "related": sorted(set(related) | set(legacy))}
    cache[key] = entry
    return entry


def add_pubchem_cids(pdsp_df: pd.DataFrame, name_col: str = "drug") -> pd.DataFrame:
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
    pdsp_df["pubchem_cids"] = pdsp_df[name_col].str.lower().str.strip().map(cache)
    return pdsp_df


def add_pubchem_cid_to_sider(sider_df: pd.DataFrame) -> pd.DataFrame:
    """Convert SIDER's STITCH IDs into plain PubChem CIDs.

    stitch_id_flat "CID100002771" -> 2771 (stereo collapsed: citalopram AND escitalopram)
    stitch_id_stereo "CID000146570" -> 146570 (the exact compound: escitalopram)
    Keep both so a drug can be matched on its exact CID first.
    """
    sider_df = sider_df.copy()
    sider_df["cid_flat"] = sider_df["stitch_id_flat"].str.slice(3).astype("Int64") - 100_000_000
    sider_df["cid_stereo"] = sider_df["stitch_id_stereo"].str.slice(3).astype("Int64")
    return sider_df


def sleep_rates(sider_df: pd.DataFrame, cids: dict) -> dict:
    """Sedation / insomnia rate (%) for one drug from SIDER.

    SIDER has one row per (term, source label/trial) with an exact % or a word
    bin. For each term take the median exact % across sources, then the largest
    matching term (e.g. somnolence 12% vs sedation 3% -> 12%).
    Exact-compound (stereo) CIDs are tried first so escitalopram is not mixed
    with citalopram, which shares the same stereo-collapsed (flat) CID.
    """
    rows = sider_df[sider_df["cid_stereo"].isin(cids["primary"])]
    if rows.empty:
        rows = sider_df[sider_df["cid_flat"].isin(cids["related"])]
    out = {"in_sider": not rows.empty,
           "sider_cid": int(rows["cid_flat"].iloc[0]) if not rows.empty else None}
    for outcome, terms in [("sedation", SEDATION_TERMS), ("insomnia", INSOMNIA_TERMS)]:
        hit = rows[rows["side_effect_name"].isin(terms)]
        exact = hit[hit["is_exact"]]
        out[f"{outcome}_pct"] = (round(float(exact.groupby("side_effect_name")["lower"].median().max()) * 100, 1)
                                 if not exact.empty else None)
        out[f"{outcome}_n"] = len(exact)          # number of % reports behind the rate
        out[f"{outcome}_listed"] = not hit.empty  # listed at any frequency
    return out


def build_drug_table(pdsp_df: pd.DataFrame, sider_df: pd.DataFrame) -> pd.DataFrame:
    """One row per drug: pKi at each key receptor + sedation/insomnia rates.

    Replaces the old row-level inner join, which multiplied every receptor row
    by every side-effect row (a many-to-many blow-up).
    """
    pdsp = add_pubchem_cids(filter_to_relevant_drugs(pdsp_df))
    alias_to_key = {a: k for k, aliases in RECEPTOR_ALIASES.items() for a in aliases}
    pdsp["key_receptor"] = pdsp["Receptor"].map(alias_to_key)
    wide = (pdsp.dropna(subset=["key_receptor"])
                .groupby(["drug", "key_receptor"])["pKi"].median()
                .unstack())
    wide = wide.reindex(columns=KEY_RECEPTORS).add_prefix("pKi_")
    cids = pdsp.groupby("drug")["pubchem_cids"].first()
    sider = add_pubchem_cid_to_sider(sider_df)
    rates = pd.DataFrame([{"drug": d, **sleep_rates(sider, c)} for d, c in cids.items()])
    table = wide.join(rates.set_index("drug")).reset_index()

    # "Brake minus gas": H1 pull minus SERT pull, in log units. Missing affinity
    # = not measured, so the balance is only computed when both are known.
    table["h1_minus_sert"] = (table["pKi_H1"] - table["pKi_SERT"]).round(2)
    return table.sort_values("h1_minus_sert", ascending=False)


if __name__ == "__main__":
    pdsp_clean = pd.read_csv(PROCESSED / "pdsp_clean.csv")
    for col in ["Ligand Name", "Receptor"]:  # same tidy-up as load_data.clean_pdsp
        pdsp_clean[col] = (pdsp_clean[col].astype(str).map(fix_mojibake)
                           .str.strip().str.replace(r"\s+", " ", regex=True))
    sider = clean_sider(pd.read_csv(PROCESSED / "sider_freq.csv"))

    table = build_drug_table(pdsp_clean, sider)
    out_path = PROCESSED / "drug_sleep_profile.csv"
    table.to_csv(out_path, index=False)
    print(f"Saved {len(table)} drugs -> {out_path}")
    print(table[["drug", "pKi_H1", "pKi_SERT", "h1_minus_sert",
                 "sedation_pct", "insomnia_pct", "in_sider"]].to_string(index=False))
