"""Write docs/doh_shelter.json for the "ศูนย์พักพิง DOH" tab (flood_web/shelter-doh-view.js).

Reads the public Google Sheet tab `doh_shelter` (CSV) and cleans it.
Usage: python doh_shelter/build_doh_shelter.py [--csv local.csv]
Sheet layout: row 1 = Thai headers, row 2 = column keys (Q01_Result ...), data from row 3.
"""
import csv, io, json, re, sys, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHEET = '1RQDU83exQhNpVYjp9JyD5UdocA6JB6GpJeXA-Qe8Pr4'
GID = '479543045'
URL = f'https://docs.google.com/spreadsheets/d/{SHEET}/export?format=csv&gid={GID}'

# columns 0-31 are Thai-labelled in the key row, so they are read by position
POS = {'shelter_id': 2, 'event_id': 3, 'assess_date': 4, 'agency': 5, 'region': 6, 'province': 7, 'district': 8,
       'subdistrict': 9, 'name': 10, 'lat': 11, 'lon': 12, 'size': 13, 'status': 14, 'open_date': 15,
       'close_date': 16, 'days_open': 17, 'capacity': 18, 'occupants': 19, 'male': 20, 'female': 21,
       'vulnerable': 22, 'disabled': 23, 'elderly': 24, 'bedridden': 25, 'pregnant': 26, 'child': 27,
       'dialysis': 28, 'psychiatric': 29}
NUMERIC = ('capacity', 'occupants', 'male', 'female', 'vulnerable', 'disabled', 'elderly', 'bedridden', 'pregnant',
           'child', 'dialysis', 'psychiatric', 'days_open')
YES, NO = 'ใช่', 'ไม่ใช่'
GOOD, FAIR, POOR = 3, 2, 1
LEVEL_LABELS = {GOOD: 'ดี', FAIR: 'พอใช้', POOR: 'ต้องปรับปรุง'}
# Grading criteria from "แนวทางจัดระดับศพพ.docx" (อนามัยสิ่งแวดล้อม 7 มิติ): per item, the level each answer earns.
# Item level = answer's level; dimension level = worst answered item; shelter level = worst answered dimension
# (the document does not say how to combine, so "lowest wins" is our assumption; see combine()).
# Rows: (dimension, sheet column, label, {answer: level}).  Dimension numbers follow the sheet's D1..D7 columns.
# "ไม่พบ..." items are asked as a problem ("พบปัญหา..."), so their answers map the other way round.
CRITERIA = [
    (1, 'Q01_Result', 'ห้องส้วมเพียงพอ', {YES: GOOD, NO: FAIR}),
    (1, 'Q01_Cleanliness', 'ห้องส้วมสะอาด', {YES: GOOD, NO: POOR}),
    (1, 'Q03_Water_Result', 'มีน้ำชำระล้างเพียงพอ', {YES: GOOD, NO: POOR}),
    (1, 'Q03_Soap_Result', 'มีสบู่ล้างมือ', {YES: GOOD, NO: FAIR}),
    (1, 'Q05_Result', 'จัดการสิ่งปฏิกูลเหมาะสม', {YES: GOOD, NO: POOR}),
    (1, 'Q08_Result', 'ไม่พบน้ำเสีย/น้ำเอ่อล้น', {NO: GOOD, YES: POOR}),
    (1, 'Q06_Result', 'ระบบระบายน้ำใช้งานได้ดี', {YES: GOOD, NO: FAIR}),
    (3, 'Q09_Level', 'มูลฝอยสะสม', {}),  # graded by wording, see level_of()
    (3, 'Q11_Separation_Result', 'มีการคัดแยกมูลฝอย', {YES: GOOD, NO: POOR}),
    (3, 'Q10_Closed_Result', 'ถุง/ถังขยะไม่รั่ว มีฝาปิด', {YES: GOOD, NO: FAIR}),
    (3, 'Q11_Storage_Result', 'ที่พักรวมมูลฝอยมิดชิด', {YES: GOOD, NO: FAIR}),
    (4, 'Q12_Result', 'ไม่พบสัตว์/แมลงพาหะ', {YES: GOOD, NO: FAIR}),
    (4, 'Q13_Result', 'มีมาตรการกำจัดพาหะ', {YES: GOOD, NO: FAIR}),
    (4, 'Q14_Result', 'จัดระเบียบ/ทำความสะอาดพื้นที่', {YES: GOOD, NO: FAIR}),
    (5, 'Q20_Result', 'น้ำดื่มสะอาดเพียงพอ', {YES: GOOD, NO: POOR}),
    (5, 'Q18_Result', 'น้ำใช้สะอาดเพียงพอ', {YES: GOOD, NO: FAIR}),
    (5, 'Q15_Result', 'อาหารสะอาดปลอดภัย', {YES: GOOD, NO: POOR}),
    (5, 'Q16_Result', 'ที่ปรุงอาหารถูกสุขลักษณะ', {YES: GOOD, NO: FAIR}),
    (7, 'Q24_Result', 'สื่อสารความรู้สุขาภิบาล', {YES: GOOD, NO: FAIR}),
    (7, 'Q25_Care_Result', 'ดูแลสุขภาพกลุ่มเปราะบาง', {YES: GOOD, NO: FAIR}),
]
DIM_NAMES = {1: '1 ส้วมและสิ่งปฏิกูล', 3: '3 มูลฝอย', 4: '4 สัตว์และแมลงพาหะ', 5: '5 อาหารและน้ำ',
             6: '6 คุณภาพอากาศ', 7: '7 ส่งเสริมสุขภาพ'}
# items in the document that the sheet has no column for, so they cannot be graded
UNMEASURED = [(3, 'พบมูลฝอยอันตราย'), (6, 'พบเชื้อราในอาคารหรือที่พักอาศัย'),
              (6, 'สื่อสารแนวทางกำจัดเชื้อรา คราบสกปรก และฆ่าเชื้อโรค'), (6, 'สื่อสารการระบายอากาศของที่พัก')]
STALE_DAYS = 3  # an open shelter not assessed for this many days needs follow-up
PROBLEM_KEYS = ['D%d_Problem' % i for i in range(1, 8)]


def to_date(s):
    """'2569-10-03', '2026-10-05', '3/10/2569', '2026-10-04 9:36:22' -> ISO date (Buddhist years converted)."""
    s = (s or '').strip()
    m = re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})', s)
    if m:
        y, mo, d = map(int, m.groups())
    else:
        m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', s)
        if not m:
            return ''
        d, mo, y = map(int, m.groups())
    if y > 2400:
        y -= 543
    try:
        return datetime(y, mo, d).strftime('%Y-%m-%d')
    except ValueError:
        return ''


def num(s):
    try:
        return int(float((s or '').replace(',', '').strip()))
    except ValueError:
        return None


def required_keys():
    return [k for _, k, _, _ in CRITERIA] + PROBLEM_KEYS + ['Q19_PPM', 'Recommendation', 'Support_Request']


def level_of(key, answer, mapping):
    """Level (GOOD/FAIR/POOR) one answer earns, or None when blank/unrecognised."""
    answer = (answer or '').strip()
    if key == 'Q09_Level':  # "ไม่มีมูลฝอยสะสม" / "ปริมาณเล็กน้อย (...)" / accumulating a lot
        if answer.startswith('ไม่มี'):
            return GOOD
        if answer.startswith('ปริมาณเล็กน้อย'):
            return FAIR
        return POOR if answer else None
    return mapping.get(answer)


def combine(levels):
    """Worst level among the answered ones; None when nothing was answered."""
    got = [v for v in levels if v is not None]
    return min(got) if got else None


def grade(answers):
    """answers: {column: raw answer}. Returns item levels, dimension levels, shelter level and the share of items rated GOOD."""
    items = {k: level_of(k, answers.get(k), m) for _, k, _, m in CRITERIA}
    dims = {d: combine([items[k] for dd, k, _, _ in CRITERIA if dd == d]) for d in DIM_NAMES}
    n = sum(1 for v in items.values() if v is not None)
    y = sum(1 for v in items.values() if v == GOOD)
    return {'levels': items, 'dim_levels': dims, 'level': combine(dims.values()),
            'score': {'y': y, 'n': n, 'p': round(y / n * 100) if n else None}}


def annotate(recs, today):
    """Follow-up fields: items to fix, days since assessment, and a priority score (higher = look first)."""
    labels = {k: l for _, k, l, _ in CRITERIA}
    for r in recs:
        r['poor'] = [labels[k] for k, v in r['levels'].items() if v == POOR]
        r['fair'] = [labels[k] for k, v in r['levels'].items() if v == FAIR]
        try:
            r['age_days'] = (today - datetime.strptime(r['assess_date'], '%Y-%m-%d').date()).days
        except ValueError:
            r['age_days'] = None
        r['stale'] = r['status'] == 'เปิดให้บริการ' and (r['age_days'] is None or r['age_days'] >= STALE_DAYS)
        r['priority'] = 40 * len(r['poor']) + 10 * len(r['fair']) + (10 if r['stale'] else 0)


def mark_latest(recs):
    """Flag the most recent assessment of each shelter (latest assess_date, later sheet row wins ties)."""
    best = {}
    for i, r in enumerate(recs):
        k = r['shelter_id']
        if k not in best or (r['assess_date'], i) >= (recs[best[k]]['assess_date'], best[k]):
            best[k] = i
    for i, r in enumerate(recs):
        r['is_latest'] = best[r['shelter_id']] == i


def clean_sheet(text):
    rows = list(csv.reader(io.StringIO(text)))
    if len(rows) < 3:
        raise ValueError('sheet has fewer than 3 rows')
    keys, data = rows[1], rows[2:]
    missing = [k for k in required_keys() if k not in keys]
    if missing:
        raise ValueError('sheet row 2 is missing columns: ' + ', '.join(missing))
    out = []
    for r in data:
        r = r + [''] * (len(keys) - len(r))
        if not r[POS['shelter_id']].strip():
            continue
        rec = {k: r[i].strip() for k, i in POS.items()}
        rec['hazard'] = r[31].strip()
        for k in NUMERIC:
            rec[k] = num(rec[k])
        for k in ('assess_date', 'open_date', 'close_date'):
            rec[k] = to_date(rec[k])
        try:
            rec['lat'], rec['lon'] = float(rec['lat']), float(rec['lon'])
            if not (5 < rec['lat'] < 21 and 97 < rec['lon'] < 106):
                rec['lat'] = rec['lon'] = None
        except ValueError:
            rec['lat'] = rec['lon'] = None
        q = {k: v.strip() for k, v in zip(keys, r) if k}
        rec['answers'] = {k: q.get(k, '') for _, k, _, _ in CRITERIA}
        rec['problems'] = [q[k] for k in PROBLEM_KEYS if q.get(k)]
        for out_key, src in (('ppm', 'Q19_PPM'), ('garbage', 'Q09_Level'), ('vectors', 'Q12_Vectors'),
                             ('recommend', 'Recommendation'), ('support', 'Support_Request')):
            rec[out_key] = q.get(src, '')
        rec.update(grade(rec['answers']))
        rec['images'] = [q['Image_Link_%d' % i] for i in range(1, 5) if q.get('Image_Link_%d' % i)]
        out.append(rec)
    mark_latest(out)
    return out


def main():
    if '--csv' in sys.argv:
        text = Path(sys.argv[sys.argv.index('--csv') + 1]).read_text(encoding='utf-8')
    else:
        text = urllib.request.urlopen(URL, timeout=60).read().decode('utf-8')
    recs = clean_sheet(text)
    assert recs, 'no rows read from sheet'
    now = datetime.now(timezone.utc)
    annotate(recs, now.astimezone(timezone(timedelta(hours=7))).date())  # Thailand date
    payload = {'fetched_at': now.isoformat(timespec='seconds'), 'stale_days': STALE_DAYS,
               'level_labels': {str(k): v for k, v in LEVEL_LABELS.items()},
               'dims': [{'id': d, 'name': n, 'qs': [{'key': k, 'label': l} for dd, k, l, _ in CRITERIA if dd == d],
                         'missing': [l for dd, l in UNMEASURED if dd == d]} for d, n in DIM_NAMES.items()],
               'records': recs}
    out = ROOT / 'docs'
    out.mkdir(exist_ok=True)
    (out / 'doh_shelter.json').write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
    print('Wrote docs/doh_shelter.json:', len(recs), 'assessments,', len({r['shelter_id'] for r in recs}), 'shelters')


if __name__ == '__main__':
    main()
