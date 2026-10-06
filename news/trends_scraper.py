"""
trends_scraper.py
Google Trends (Thailand) for the dashboard's "ข่าว" tab — moved from SAT_flood, v3.0.

Writes docs/news_data/trends.json. Only real pytrends results are published: the SAT_flood version
filled gaps with canned queries, a made-up timeline and per-phase "need index" scores. Here a failed
fetch (pytrends is unofficial and GitHub runners are often rate-limited) produces status "unavailable"
and empty lists, and the page says so.

Usage: python news/trends_scraper.py [output_dir]      (default: docs/news_data)
"""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):  # Windows console encoding
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "news_data"
TZ_BKK = timezone(timedelta(hours=7))

KEYWORDS = ["น้ำท่วม", "หลังน้ำท่วม", "ระดับน้ำ", "ฝนตกหนัก", "อุทกภัย"]
# pytrends compares at most 5 terms and each related_queries call is rate limited, so ask for the first two.
QUERY_KEYWORDS = KEYWORDS[:2]

# What people are searching for, grouped by intent. A query lands in the first group that matches.
CATEGORIES = [
    ("financial", "เงินเยียวยา/ลงทะเบียน", ["เยียวยา", "ลงทะเบียน", "เงิน", "ทางรัฐ", "จ่าย", "ยื่น", "เช็ค"]),
    ("surveillance", "ติดตามสถานการณ์", ["ระดับน้ำ", "เรดาร์", "ฝน", "เขื่อน", "คลอง", "วัด", "ปิง", "นครสวรรค์"]),
    ("relief_traffic", "ช่วยเหลือ/ทรัพย์สิน", ["ทะเบียน", "ป้าย", "กั้นน้ำ", "กล้อง", "ถุงยังชีพ", "อพยพ", "ตามหา", "หลังน้ำท่วม", "ฟื้นฟู", "ซ่อม"]),
    ("howto_relief", "วิธีการ/ติดต่อ", ["วิธี", "ขั้นตอน", "เบอร์", "ติดต่อ", "เอกสาร", "ขอรับ", "ศูนย์พักพิง", "แจ้ง", "สิทธิ", "สายด่วน", "หลังน้ำลด"]),
]


def categorize(rising):
    """Group rising queries by intent. Returns {category_key: [query dicts]} (only real queries)."""
    groups = {key: [] for key, _, _ in CATEGORIES}
    for q in rising:
        for key, _, words in CATEGORIES:
            if any(w in q["query"] for w in words):
                groups[key].append(q)
                break
    return groups


def fetch_trends(trend_request=None):
    """Return the trends document. `trend_request` is injectable for tests (a pytrends TrendReq)."""
    now = datetime.now(TZ_BKK)
    doc = {
        "generated_at": now.isoformat(timespec="seconds"),
        "status": "ok",
        "error": None,
        "geo": "TH",
        "timeframe": "now 7-d",
        "keywords": KEYWORDS,
        "rising_queries": [],
        "top_queries": [],
        "interest_by_region": [],
        "categories": {key: {"label": label, "queries": []} for key, label, _ in CATEGORIES},
    }
    try:
        if trend_request is None:
            from pytrends.request import TrendReq
            trend_request = TrendReq(hl="th", tz=420, timeout=(10, 25))
        trend_request.build_payload(kw_list=QUERY_KEYWORDS, timeframe=doc["timeframe"], geo="TH")
        for kw, res in (trend_request.related_queries() or {}).items():
            if not res:
                continue
            if res.get("rising") is not None and not res["rising"].empty:
                for _, row in res["rising"].head(10).iterrows():
                    val = str(row["value"])
                    doc["rising_queries"].append({
                        "query": str(row["query"]), "growth": f"+{val}%" if val.isdigit() else val, "keyword": kw})
            if res.get("top") is not None and not res["top"].empty:
                for _, row in res["top"].head(10).iterrows():
                    doc["top_queries"].append({"query": str(row["query"]), "score": int(row["value"]), "keyword": kw})

        region_df = trend_request.interest_by_region(resolution="REGION", inc_low_vol=True, inc_geo_code=False)
        column = QUERY_KEYWORDS[0]
        if region_df is not None and not region_df.empty and column in region_df:
            for name, row in region_df.sort_values(by=column, ascending=False).head(15).iterrows():
                if int(row[column]) > 0:
                    doc["interest_by_region"].append({"region": str(name), "score": int(row[column])})
    except Exception as e:
        doc["status"] = "unavailable"
        doc["error"] = f"{type(e).__name__}: {e}"[:200]
        doc["rising_queries"], doc["top_queries"], doc["interest_by_region"] = [], [], []
        return doc

    for key, queries in categorize(doc["rising_queries"]).items():
        doc["categories"][key]["queries"] = queries
    if not (doc["rising_queries"] or doc["top_queries"] or doc["interest_by_region"]):
        doc["status"] = "unavailable"
        doc["error"] = "Google Trends returned no data"
    return doc


def main(output_dir=None):
    out_dir = Path(output_dir or (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUTPUT_DIR))
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fetch_trends()
    target = out_dir / "trends.json"
    tmp = target.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(target)
    print(f"Google Trends: {doc['status']}" + (f" ({doc['error']})" if doc["error"] else "") + f" → {target}")
    return 0  # an unavailable Trends tab must not fail the deploy; the page shows the status


if __name__ == "__main__":
    sys.exit(main())
