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
# Grading follows the source dashboard of the data owner ("ต้นทางข้อมูล", 7 dimensions, 32 items), whose per-item levels
# agree with แนวทางจัดระดับศพพ.docx except where noted. Every item answers ใช่/ไม่ใช่ (or a level wording) and earns
# ดี (GOOD) / พอใช้ (FAIR) / ต้องปรับปรุง (POOR); the source dashboard calls them ผ่าน / ติดตาม / ต้องปรับปรุง.
# Rows: (dimension, sheet column, item no., title, {answer: level}, counts_in_dimension_level)
# - "พบปัญหา..." (Q08) is asked as a problem, so its answers map the other way round.
# - Q16 and Q18: the source dashboard shows "ไม่ใช่" as ต้องปรับปรุง, the docx table says พอใช้; we follow the source.
# - counts_in_dimension_level=False: the item is graded and shown, but the source's per-dimension totals do not count
#   it. This was inferred from the source's counts (dimension 1 shows no "ติดตาม" although 47% lack soap, dimension 4
#   ignores Q12, dimension 5 ignores Q19/Q21); confirm with the owner of the source dashboard.
ITEMS = [
    (1, 'Q01_Result', '1.1', 'ห้องส้วมมีจำนวนเพียงพอ', {YES: GOOD, NO: FAIR}, True),
    (1, 'Q01_Cleanliness', '1.2', 'ห้องส้วมสะอาดและถูกสุขลักษณะ', {YES: GOOD, NO: POOR}, True),
    (1, 'Q02_Result', '2', 'ห้องอาบน้ำมีจำนวนเพียงพอ', {YES: GOOD, NO: FAIR}, True),
    (1, 'Q03_Water_Result', '3.1', 'มีน้ำชำระล้างเพียงพอ', {YES: GOOD, NO: POOR}, True),
    (1, 'Q03_Soap_Result', '3.2', 'มีสบู่สำหรับล้างมือ', {YES: GOOD, NO: FAIR}, False),
    (1, 'Q04_Result', '4', 'มีบ่อเกรอะ/บ่อซึมรองรับสิ่งปฏิกูล ไม่แตก รั่ว ซึม', {YES: GOOD, NO: FAIR}, False),
    (1, 'Q05_Result', '5', 'มีการจัดการสิ่งปฏิกูลเหมาะสม', {YES: GOOD, NO: POOR}, True),
    (2, 'Q06_Result', '6', 'ทางระบายน้ำทิ้งใช้งานได้ดี', {YES: GOOD, NO: FAIR}, True),
    (2, 'Q07_Result', '7', 'มีถังบำบัดน้ำเสีย/ถังเกรอะ', {YES: GOOD, NO: FAIR}, True),
    (2, 'Q08_Result', '8', 'พบปัญหาน้ำท่วมขังหรือน้ำเสียเอ่อล้น', {NO: GOOD, YES: POOR}, True),
    (3, 'Q09_Level', '9', 'ระดับปริมาณมูลฝอยสะสม', {}, True),  # graded by wording, see level_of()
    (3, 'Q10_Sufficient_Result', '10.1', 'ภาชนะ/ถังรองรับขยะเพียงพอ', {YES: GOOD, NO: FAIR}, True),
    (3, 'Q10_Closed_Result', '10.2', 'ภาชนะรองรับขยะมีฝาปิดมิดชิด', {YES: GOOD, NO: FAIR}, True),
    (3, 'Q11_Separation_Result', '11.1', 'มีจุดแยกขยะเป็นสัดส่วน', {YES: GOOD, NO: POOR}, True),
    (3, 'Q11_Storage_Result', '11.2', 'มีพื้นที่พักรวมขยะและสะอาด', {YES: GOOD, NO: FAIR}, True),
    (4, 'Q12_Result', '12', 'ไม่พบสัตว์และแมลงพาหะนำโรค', {YES: GOOD, NO: FAIR}, False),
    (4, 'Q13_Result', '13', 'มีกิจกรรม/มาตรการกำจัดพาหะนำโรค', {YES: GOOD, NO: FAIR}, True),
    (4, 'Q14_Result', '14', 'จัดระเบียบและทำความสะอาดพื้นที่', {YES: GOOD, NO: FAIR}, True),
    (5, 'Q15_Result', '15', 'มีอาหารสะอาด ปลอดภัย', {YES: GOOD, NO: POOR}, True),
    (5, 'Q16_Result', '16', 'สถานที่ประกอบปรุงอาหารสะอาดถูกสุขลักษณะ', {YES: GOOD, NO: POOR}, True),
    (5, 'Q17_Result', '17', 'จัดเก็บอาหารถูกสุขลักษณะและป้องกันพาหะ', {YES: GOOD, NO: FAIR}, True),
    (5, 'Q18_Result', '18', 'มีน้ำใช้สะอาด เพียงพอ', {YES: GOOD, NO: POOR}, True),
    (5, 'Q19_Chlorine_Result', '19.1', 'มีการเติมคลอรีนในแหล่งน้ำใช้', {YES: GOOD, NO: FAIR}, False),
    (5, 'Q19_Test_Result', '19.2', 'มีผลตรวจคลอรีนอิสระคงเหลือ', {YES: GOOD, NO: FAIR}, False),
    (5, 'Q19_PPM', '19.2', 'ผลคลอรีนอิสระคงเหลือ', {}, False),  # graded by wording, see level_of()
    (5, 'Q20_Result', '20', 'น้ำดื่มสะอาดปลอดภัยและเพียงพอ', {YES: GOOD, NO: POOR}, True),
    (5, 'Q21_Result', '21', 'มีการใช้อุปกรณ์/ชุดทดสอบความสะอาดเบื้องต้น', {YES: GOOD, NO: FAIR}, False),
    (6, 'Q22_Result', '22', 'พื้นที่พักพิงไม่หนาแน่นแออัด', {YES: GOOD, NO: FAIR}, True),
    (6, 'Q23_Result', '23', 'อาคาร/เต็นท์มีการระบายอากาศที่ดี', {YES: GOOD, NO: FAIR}, True),
    (7, 'Q24_Result', '24', 'มีกิจกรรมสื่อสารความรู้ด้านสุขาภิบาลสิ่งแวดล้อมและสุขภาพ', {YES: GOOD, NO: FAIR}, True),
    (7, 'Q25_Area_Result', '25.1', 'มีพื้นที่/บริการ/สิ่งอำนวยความสะดวกสำหรับกลุ่มเปราะบาง', {YES: GOOD, NO: FAIR}, True),
    (7, 'Q25_Care_Result', '25.2', 'มีการดูแลสุขภาพกลุ่มเปราะบางอย่างเหมาะสม', {YES: GOOD, NO: FAIR}, True),
]
DIM_NAMES = {1: 'การจัดการสุขาภิบาลห้องน้ำห้องส้วม สิ่งปฏิกูล', 2: 'การจัดการน้ำเสียและสุขาภิบาลสิ่งแวดล้อม',
             3: 'การจัดการขยะมูลฝอย', 4: 'สัตว์และแมลงพาหะนำโรค', 5: 'สุขาภิบาลอาหารและน้ำดื่มน้ำใช้',
             6: 'การจัดการคุณภาพอากาศและที่พักอาศัย', 7: 'การส่งเสริมสุขภาพและสุขอนามัย'}
# Free-text / numeric columns kept only as supporting information (never graded): (column, label)
SUPPLEMENTARY = [
    ('Q01_Toilet_Count', 'จำนวนห้องส้วม'), ('Q02_Shower_Count', 'จำนวนห้องอาบน้ำ'),
    ('Q05_Methods', 'วิธีจัดการสิ่งปฏิกูล'), ('Q05_Other', 'วิธีจัดการสิ่งปฏิกูล (อื่น ๆ)'),
    ('Q12_Vectors', 'ชนิดพาหะที่พบ'), ('Q12_Other', 'ชนิดพาหะ (อื่น ๆ)'),
    ('Q13_Methods', 'มาตรการกำจัดพาหะที่ดำเนินการ'), ('Q13_Other', 'มาตรการกำจัดพาหะ (อื่น ๆ)'),
    ('Q15_Sources', 'แหล่งอาหาร'), ('Q15_Other', 'แหล่งอาหาร (อื่น ๆ)'),
    ('Q18_Sources', 'แหล่งน้ำใช้'), ('Q18_Other', 'แหล่งน้ำใช้ (อื่น ๆ)'),
    ('Q24_Activity', 'รายละเอียดกิจกรรมสื่อสารความรู้'),
]
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
    return [it[1] for it in ITEMS] + PROBLEM_KEYS + ['Recommendation', 'Support_Request']


def level_of(key, answer, mapping):
    """Level (GOOD/FAIR/POOR) one answer earns, or None when blank/unrecognised."""
    answer = (answer or '').strip()
    if key == 'Q19_PPM':  # "0.2–0.5 PPM (มาตรฐาน)" passes, "< 0.2 PPM" needs follow-up
        if 'มาตรฐาน' in answer:
            return GOOD
        return FAIR if answer.startswith('<') else None
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
    """answers: {column: raw answer}. Returns item levels, dimension levels, shelter level and the share of items rated GOOD.
    A dimension is graded by its worst answered item among those that count (see ITEMS); the shelter by its worst dimension."""
    items = {it[1]: level_of(it[1], answers.get(it[1]), it[4]) for it in ITEMS}
    dims = {d: combine([items[it[1]] for it in ITEMS if it[0] == d and it[5]]) for d in DIM_NAMES}
    n = sum(1 for v in items.values() if v is not None)
    y = sum(1 for v in items.values() if v == GOOD)
    return {'levels': items, 'dim_levels': dims, 'level': combine(dims.values()),
            'score': {'y': y, 'n': n, 'p': round(y / n * 100) if n else None}}


def annotate(recs, today):
    """Follow-up fields: items to fix, days since assessment, and a priority score (higher = look first)."""
    labels = {it[1]: it[3] for it in ITEMS}
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
        rec['answers'] = {it[1]: q.get(it[1], '') for it in ITEMS}
        rec['problems'] = [q[k] for k in PROBLEM_KEYS if q.get(k)]
        for out_key, src in (('ppm', 'Q19_PPM'), ('garbage', 'Q09_Level'), ('vectors', 'Q12_Vectors'),
                             ('recommend', 'Recommendation'), ('support', 'Support_Request')):
            rec[out_key] = q.get(src, '')
        rec.update(grade(rec['answers']))
        rec['extra'] = {k: q.get(k, '') for k, _ in SUPPLEMENTARY}  # supporting info, never graded
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
               'dims': [{'id': d, 'name': n, 'qs': [{'key': it[1], 'no': it[2], 'label': it[3], 'in_level': it[5]}
                                                    for it in ITEMS if it[0] == d]} for d, n in DIM_NAMES.items()],
               'extras': [{'key': k, 'label': l} for k, l in SUPPLEMENTARY],
               'records': recs}
    out = ROOT / 'docs'
    out.mkdir(exist_ok=True)
    (out / 'doh_shelter.json').write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
    print('Wrote docs/doh_shelter.json:', len(recs), 'assessments,', len({r['shelter_id'] for r in recs}), 'shelters')


if __name__ == '__main__':
    main()
