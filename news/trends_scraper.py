"""
trends_scraper.py
Google Trends (Thailand) for the dashboard's "ข่าว" tab — moved from SAT_flood, v3.0.

Writes docs/news_data/trends.json. Only real pytrends results are published: the SAT_flood version
filled gaps with canned queries, a made-up timeline and per-phase "need index" scores. Here a failed
fetch (pytrends is unofficial and GitHub runners are often rate-limited) produces status "unavailable"
and empty lists, and the page says so.

The document has independent parts (related queries, interest by province, a 7-day interest timeline and the
top query of the leading provinces). Each part is fetched on its own so one rate-limited call does not drop the
others; `parts` says which succeeded. The page derives the 3-phase index from `timeline` with a formula it prints.

Usage: python news/trends_scraper.py [output_dir]      (default: docs/news_data)
"""

import json
import sys
import time
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

# One representative search term per intent, fetched together so Google scales them against each other (0-100).
TIMELINE_TERMS = ["ระดับน้ำ", "เรดาร์ฝน", "ศูนย์พักพิง", "เงินเยียวยา", "ลงทะเบียนเยียวยา"]
# Which terms and which query groups describe each stage of a flood. The page averages the terms' recent interest
# per stage and lists the rising queries of the stage's groups; no number here is made up.
PHASES = [
    {"key": "watch", "label": "ระยะ 1: เฝ้าระวัง & เตรียมรับมือ", "terms": ["ระดับน้ำ", "เรดาร์ฝน"], "categories": ["surveillance"]},
    {"key": "crisis", "label": "ระยะ 2: วิกฤต & ช่วยเหลือเร่งด่วน", "terms": ["ศูนย์พักพิง"], "categories": ["relief_traffic", "howto_relief"]},
    {"key": "recovery", "label": "ระยะ 3: ฟื้นฟู & ยื่นเยียวยา", "terms": ["เงินเยียวยา", "ลงทะเบียนเยียวยา"], "categories": ["financial"]},
]
TOP_REGION_QUERIES = 5     # provinces for which the top related query is looked up (one Google call each)
CALL_PAUSE_SECONDS = 2.0   # pause between Google calls; pytrends is unofficial and easily rate limited
RETRY_WAIT_SECONDS = 25    # wait before retrying the timeline call after an error such as HTTP 429

# ISO 3166-2:TH codes, used as `geo` for per-province queries. Names match news/provinces.py.
PROVINCE_GEO = {
    "กรุงเทพมหานคร": "TH-10", "สมุทรปราการ": "TH-11", "นนทบุรี": "TH-12", "ปทุมธานี": "TH-13", "พระนครศรีอยุธยา": "TH-14",
    "อ่างทอง": "TH-15", "ลพบุรี": "TH-16", "สิงห์บุรี": "TH-17", "ชัยนาท": "TH-18", "สระบุรี": "TH-19", "ชลบุรี": "TH-20",
    "ระยอง": "TH-21", "จันทบุรี": "TH-22", "ตราด": "TH-23", "ฉะเชิงเทรา": "TH-24", "ปราจีนบุรี": "TH-25", "นครนายก": "TH-26",
    "สระแก้ว": "TH-27", "นครราชสีมา": "TH-30", "บุรีรัมย์": "TH-31", "สุรินทร์": "TH-32", "ศรีสะเกษ": "TH-33",
    "อุบลราชธานี": "TH-34", "ยโสธร": "TH-35", "ชัยภูมิ": "TH-36", "อำนาจเจริญ": "TH-37", "บึงกาฬ": "TH-38",
    "หนองบัวลำภู": "TH-39", "ขอนแก่น": "TH-40", "อุดรธานี": "TH-41", "เลย": "TH-42", "หนองคาย": "TH-43", "มหาสารคาม": "TH-44",
    "ร้อยเอ็ด": "TH-45", "กาฬสินธุ์": "TH-46", "สกลนคร": "TH-47", "นครพนม": "TH-48", "มุกดาหาร": "TH-49", "เชียงใหม่": "TH-50",
    "ลำพูน": "TH-51", "ลำปาง": "TH-52", "อุตรดิตถ์": "TH-53", "แพร่": "TH-54", "น่าน": "TH-55", "พะเยา": "TH-56",
    "เชียงราย": "TH-57", "แม่ฮ่องสอน": "TH-58", "นครสวรรค์": "TH-60", "อุทัยธานี": "TH-61", "กำแพงเพชร": "TH-62", "ตาก": "TH-63",
    "สุโขทัย": "TH-64", "พิษณุโลก": "TH-65", "พิจิตร": "TH-66", "เพชรบูรณ์": "TH-67", "ราชบุรี": "TH-70", "กาญจนบุรี": "TH-71",
    "สุพรรณบุรี": "TH-72", "นครปฐม": "TH-73", "สมุทรสาคร": "TH-74", "สมุทรสงคราม": "TH-75", "เพชรบุรี": "TH-76",
    "ประจวบคีรีขันธ์": "TH-77", "นครศรีธรรมราช": "TH-80", "กระบี่": "TH-81", "พังงา": "TH-82", "ภูเก็ต": "TH-83",
    "สุราษฎร์ธานี": "TH-84", "ระนอง": "TH-85", "ชุมพร": "TH-86", "สงขลา": "TH-90", "สตูล": "TH-91", "ตรัง": "TH-92",
    "พัทลุง": "TH-93", "ปัตตานี": "TH-94", "ยะลา": "TH-95", "นราธิวาส": "TH-96",
}


def categorize(rising):
    """Group rising queries by intent. Returns {category_key: [query dicts]} (only real queries)."""
    groups = {key: [] for key, _, _ in CATEGORIES}
    for q in rising:
        for key, _, words in CATEGORIES:
            if any(w in q["query"] for w in words):
                groups[key].append(q)
                break
    return groups


def timeline_points(df, terms):
    """Hourly pytrends frame -> ([terms], [{"t": ISO time in Bangkok, "v": [value per term]}]). The newest, still
    incomplete hour (isPartial) is dropped so it cannot drag the latest average down."""
    cols = [c for c in terms if c in df.columns]
    if "isPartial" in df.columns:
        df = df[~df["isPartial"].astype(bool)]
    idx = df.index
    if getattr(idx, "tz", None) is None:       # pytrends returns UTC without a zone
        idx = idx.tz_localize("UTC")
    idx = idx.tz_convert(TZ_BKK)
    points = [{"t": t.isoformat(timespec="minutes"), "v": [int(v) for v in row]}
              for t, row in zip(idx, df[cols].to_numpy())]
    return cols, points


def fetch_trends(trend_request=None, sleep=time.sleep, pause=CALL_PAUSE_SECONDS):
    """Return the trends document. `trend_request` (a pytrends TrendReq) and `sleep` are injectable for tests."""
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
        "region_top_query": {},
        "timeline": None,
        "phases": PHASES,
        "parts": {},
        "categories": {key: {"label": label, "queries": []} for key, label, _ in CATEGORIES},
    }
    errors = []

    def part(name, fn, retries=0):
        for attempt in range(retries + 1):
            try:
                fn()
                doc["parts"][name] = "ok"
                return
            except Exception as e:   # a rate limited / failed call must not take the other parts down
                doc["parts"][name] = f"{type(e).__name__}: {e}"[:160]
                if attempt < retries:
                    sleep(RETRY_WAIT_SECONDS)   # Google answers 429 for a while; one patient retry is usually enough
        errors.append(doc["parts"][name])

    try:
        if trend_request is None:
            from pytrends.request import TrendReq
            trend_request = TrendReq(hl="th", tz=420, timeout=(10, 25))
    except Exception as e:
        doc["status"] = "unavailable"
        doc["error"] = f"{type(e).__name__}: {e}"[:200]
        return doc

    def related():
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

    def regions():
        region_df = trend_request.interest_by_region(resolution="REGION", inc_low_vol=True, inc_geo_code=False)
        column = QUERY_KEYWORDS[0]
        if region_df is not None and not region_df.empty and column in region_df:
            for name, row in region_df.sort_values(by=column, ascending=False).head(15).iterrows():
                if int(row[column]) > 0:
                    doc["interest_by_region"].append({"region": str(name), "score": int(row[column])})

    def timeline():
        trend_request.build_payload(kw_list=TIMELINE_TERMS, timeframe=doc["timeframe"], geo="TH")
        df = trend_request.interest_over_time()
        if df is None or df.empty:
            raise ValueError("interest_over_time returned no rows")
        terms, points = timeline_points(df, TIMELINE_TERMS)
        if not points:
            raise ValueError("interest_over_time had only incomplete hours")
        doc["timeline"] = {"terms": terms, "points": points, "timeframe": doc["timeframe"]}

    def region_queries():
        wanted = [r["region"] for r in doc["interest_by_region"] if r["region"] in PROVINCE_GEO][:TOP_REGION_QUERIES]
        if not wanted:
            raise ValueError("no leading province with a known geo code")
        failures = 0
        for name in wanted:
            sleep(pause)
            try:
                trend_request.build_payload(kw_list=[QUERY_KEYWORDS[0]], timeframe=doc["timeframe"], geo=PROVINCE_GEO[name])
                res = (trend_request.related_queries() or {}).get(QUERY_KEYWORDS[0]) or {}
                top = res.get("top")
                if top is not None and not top.empty:
                    # The strongest related query is the keyword itself ("น้ำ ท่วม"); report the first one that adds something.
                    own = QUERY_KEYWORDS[0].replace(" ", "")
                    for _, row in top.iterrows():
                        if str(row["query"]).replace(" ", "") != own:
                            doc["region_top_query"][name] = {"query": str(row["query"]), "score": int(row["value"])}
                            break
            except Exception:
                failures += 1
        if not doc["region_top_query"]:
            raise ValueError(f"no top query returned for {len(wanted)} provinces ({failures} failed)")

    part("related", related)
    sleep(pause)
    part("regions", regions)
    sleep(pause)
    part("timeline", timeline, retries=1)
    if doc["interest_by_region"]:
        part("region_queries", region_queries)
    else:
        doc["parts"]["region_queries"] = "skipped: no province ranking"

    for key, queries in categorize(doc["rising_queries"]).items():
        doc["categories"][key]["queries"] = queries
    has_data = bool(doc["rising_queries"] or doc["top_queries"] or doc["interest_by_region"] or doc["timeline"])
    if not has_data:
        doc["status"] = "unavailable"
        doc["error"] = (errors[0] if errors else "Google Trends returned no data")[:200]
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
