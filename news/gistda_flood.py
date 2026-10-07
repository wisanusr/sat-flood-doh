"""
gistda_flood.py
Fetches satellite flood-extent polygons (last 3 days) from the GISTDA API Gateway and writes
docs/news_data/flood_extent.json: a per-subdistrict (tambon) summary, not the raw polygons.

The raw layer is ~130k polygons (hundreds of MB), too big to publish, so each polygon is folded into
its tambon: flooded area, affected rice area, population, buildings, hospitals, schools, road length
and an area-weighted centre point for the map.

The API key is read from the GISTDA_API_KEY environment variable, or from a local .env file
(which is git-ignored). It is never written to the output file.

Usage: python news/gistda_flood.py [output_dir]      (default: docs/news_data)
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

if hasattr(sys.stdout, 'reconfigure'):  # Windows console encoding
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_DIR = ROOT / "docs" / "news_data"
TZ_BKK = timezone(timedelta(hours=7))

API_URL = "https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/3days"
PAGE_SIZE = 1000
MAX_PAGES = 400
TIMEOUT = 90
SUM_FIELDS = ("rice_area", "population", "building", "hospital", "school", "length_road")


def load_api_key():
    key = os.environ.get("GISTDA_API_KEY")
    if key:
        return key.strip()
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            name, _, value = line.partition("=")
            if name.strip() == "GISTDA_API_KEY":
                return value.strip().strip('"').strip("'")
    return None


def iter_pages(api_key):
    """Yield the feature list of each page of the layer, following offset paging."""
    session = requests.Session()
    for page in range(MAX_PAGES):
        resp = session.get(
            API_URL,
            params={"api_key": api_key, "limit": PAGE_SIZE, "offset": page * PAGE_SIZE},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        batch = resp.json().get("features", [])
        yield batch
        if len(batch) < PAGE_SIZE:
            return


def _first_point(geometry):
    """A representative [lon, lat] of a (Multi)Polygon: its first vertex."""
    coords = geometry["coordinates"]
    while isinstance(coords[0], list):
        coords = coords[0]
    return coords


def summarize(pages):
    """Fold polygons into one row per tambon. Returns (rows, polygon_count)."""
    tambons = {}
    total = 0
    for batch in pages:
        for feature in batch:
            props = feature.get("properties") or {}
            total += 1
            key = props.get("tb_idn")
            row = tambons.get(key)
            if row is None:
                row = tambons[key] = {
                    "province": props.get("pv_tn"), "district": props.get("ap_tn"),
                    "subdistrict": props.get("tb_tn"), "provinceCode": props.get("pv_idn"),
                    "polygons": 0, "floodAreaM2": 0.0, "lastPass": None,
                    **{f: 0.0 for f in SUM_FIELDS}, "_lonA": 0.0, "_latA": 0.0,
                }
            area = props.get("f_area") or 0
            row["polygons"] += 1
            row["floodAreaM2"] += area
            for f in SUM_FIELDS:
                row[f] += props.get(f) or 0
            # file_name looks like rd2_20261004_1823 (satellite pass date and time)
            parts = str(props.get("file_name") or "").split("_")
            if len(parts) >= 3 and (row["lastPass"] is None or "_".join(parts[1:]) > row["lastPass"]):
                row["lastPass"] = "_".join(parts[1:])
            try:
                lon, lat = _first_point(feature["geometry"])[:2]
            except (KeyError, IndexError, TypeError):
                continue
            row["_lonA"] += lon * area
            row["_latA"] += lat * area
    rows = []
    for row in tambons.values():
        a = row["floodAreaM2"]
        lon, lat = row.pop("_lonA"), row.pop("_latA")
        row["lon"] = round(lon / a, 5) if a else None
        row["lat"] = round(lat / a, 5) if a else None
        for f in ("floodAreaM2",) + SUM_FIELDS:
            row[f] = round(row[f], 1)
        rows.append(row)
    rows.sort(key=lambda r: r["floodAreaM2"], reverse=True)
    return rows, total


def build_output(rows, polygons):
    return {
        "source": "GISTDA flood extent (3 days)",
        "fetchedAt": datetime.now(TZ_BKK).isoformat(timespec="seconds"),
        "polygons": polygons,
        "tambons": len(rows),
        "floodAreaM2": round(sum(r["floodAreaM2"] for r in rows), 1),
        "rows": rows,
    }


def main(output_dir=None):
    out_dir = Path(output_dir) if output_dir else DEFAULT_OUTPUT_DIR
    api_key = load_api_key()
    if not api_key:
        print("GISTDA_API_KEY is not set; skipping flood extent.")
        return 1
    try:
        rows, polygons = summarize(iter_pages(api_key))
    except requests.RequestException as exc:
        # Never print the exception text: it contains the request URL and therefore the key.
        print(f"GISTDA request failed ({type(exc).__name__}).")
        return 1
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "flood_extent.json"
    out_file.write_text(json.dumps(build_output(rows, polygons), ensure_ascii=False), encoding="utf-8")
    print(f"{polygons} flood polygons in {len(rows)} tambons -> {out_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else None))
