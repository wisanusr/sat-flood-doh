"""Tests for build_doh_shelter.py (synthetic sheet, no network): python doh_shelter/test_doh_shelter.py"""
import csv, io, sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_doh_shelter as B

KEYS = ['c%d' % i for i in range(32)] + B.required_keys()


def sheet(rows, keys=KEYS):
    """rows: list of dicts using B.POS names, 'hazard' and question keys."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(['th'] * len(keys))
    w.writerow(keys)
    for r in rows:
        line = [''] * len(keys)
        for name, i in B.POS.items():
            line[i] = str(r.get(name, ''))
        line[31] = r.get('hazard', 'อุทกภัย')
        for k, v in r.items():
            if k in keys[32:]:
                line[keys.index(k)] = v
        w.writerow(line)
    return buf.getvalue()


def row(**kw):
    base = {'shelter_id': 'S1', 'assess_date': '2026-10-05', 'name': 'A', 'province': 'ราชบุรี', 'lat': '13.9', 'lon': '99.7'}
    base.update(kw)
    return base


class DateTests(unittest.TestCase):
    def test_formats(self):
        self.assertEqual(B.to_date('2569-10-03'), '2026-10-03')
        self.assertEqual(B.to_date('2026-10-05'), '2026-10-05')
        self.assertEqual(B.to_date('3/10/2569'), '2026-10-03')
        self.assertEqual(B.to_date('30/9/2569'), '2026-09-30')
        self.assertEqual(B.to_date('2026-10-04 9:36:22'), '2026-10-04')

    def test_invalid(self):
        self.assertEqual(B.to_date(''), '')
        self.assertEqual(B.to_date('31/2/2569'), '')
        self.assertEqual(B.to_date('abc'), '')


class CleanTests(unittest.TestCase):
    def test_skips_rows_without_id_and_bad_coords(self):
        recs = B.clean_sheet(sheet([row(), row(shelter_id=''), row(shelter_id='S2', lat='0', lon='0'),
                                    row(shelter_id='S3', lat='', lon='')]))
        self.assertEqual([r['shelter_id'] for r in recs], ['S1', 'S2', 'S3'])
        self.assertEqual(recs[0]['lat'], 13.9)
        self.assertIsNone(recs[1]['lat'])
        self.assertIsNone(recs[2]['lon'])

    def test_numbers(self):
        r = B.clean_sheet(sheet([row(occupants='1,200', capacity='abc')]))[0]
        self.assertEqual(r['occupants'], 1200)
        self.assertIsNone(r['capacity'])

    def test_missing_column_fails_loudly(self):
        keys = [k for k in KEYS if k != 'Q01_Result']
        with self.assertRaisesRegex(ValueError, 'Q01_Result'):
            B.clean_sheet(sheet([row()], keys))

    def test_no_reporter_name_published(self):
        r = B.clean_sheet(sheet([row()]))[0]
        self.assertNotIn('reporter', r)


class GradeTests(unittest.TestCase):
    def g(self, **answers):
        return B.grade(answers)

    def lv(self, key, answer):
        return B.grade({key: answer})['levels'][key]

    def test_two_level_items(self):
        self.assertEqual(self.lv('Q01_Result', 'ใช่'), B.GOOD)
        self.assertEqual(self.lv('Q01_Result', 'ไม่ใช่'), B.FAIR)
        self.assertEqual(self.lv('Q01_Cleanliness', 'ไม่ใช่'), B.POOR)

    def test_inverted_item(self):  # พบปัญหาน้ำเสีย: ใช่ = ต้องปรับปรุง
        self.assertEqual(self.lv('Q08_Result', 'ไม่ใช่'), B.GOOD)
        self.assertEqual(self.lv('Q08_Result', 'ใช่'), B.POOR)

    def test_follows_source_dashboard_for_q16_q18(self):  # the docx says พอใช้, the source dashboard shows ต้องปรับปรุง
        self.assertEqual(self.lv('Q16_Result', 'ไม่ใช่'), B.POOR)
        self.assertEqual(self.lv('Q18_Result', 'ไม่ใช่'), B.POOR)

    def test_garbage_accumulation_levels(self):
        self.assertEqual(self.lv('Q09_Level', 'ไม่มีมูลฝอยสะสม'), B.GOOD)
        self.assertEqual(self.lv('Q09_Level', 'ปริมาณเล็กน้อย (ยังไม่ส่งผลกระทบ)'), B.FAIR)
        self.assertEqual(self.lv('Q09_Level', 'สะสมมาก'), B.POOR)
        self.assertIsNone(self.lv('Q09_Level', ''))

    def test_chlorine_reading_levels(self):
        self.assertEqual(self.lv('Q19_PPM', '0.2–0.5 PPM (มาตรฐาน)'), B.GOOD)
        self.assertEqual(self.lv('Q19_PPM', '< 0.2 PPM'), B.FAIR)
        self.assertIsNone(self.lv('Q19_PPM', ''))

    def test_blank_and_unknown_answers_have_no_level(self):
        g = self.g(Q01_Result='', Q12_Result='ไม่แน่ใจ')
        self.assertIsNone(g['levels']['Q01_Result'])
        self.assertIsNone(g['levels']['Q12_Result'])

    def test_dimension_is_worst_counted_item(self):
        self.assertEqual(self.g(Q01_Result='ใช่', Q01_Cleanliness='ไม่ใช่')['dim_levels'][1], B.POOR)
        self.assertEqual(self.g(Q01_Result='ไม่ใช่', Q01_Cleanliness='ใช่')['dim_levels'][1], B.FAIR)

    def test_items_not_counted_in_dimension_level_are_still_graded(self):
        g = self.g(Q01_Result='ใช่', Q03_Soap_Result='ไม่ใช่')  # soap: ติดตาม but not counted (matches the source totals)
        self.assertEqual(g['levels']['Q03_Soap_Result'], B.FAIR)
        self.assertEqual(g['dim_levels'][1], B.GOOD)
        self.assertEqual(self.g(Q13_Result='ใช่', Q12_Result='ไม่ใช่')['dim_levels'][4], B.GOOD)
        self.assertEqual(self.g(Q15_Result='ใช่', Q21_Result='ไม่ใช่', Q19_Chlorine_Result='ไม่ใช่')['dim_levels'][5], B.GOOD)

    def test_air_quality_dimension_uses_q22_q23(self):
        self.assertEqual(self.g(Q22_Result='ใช่', Q23_Result='ไม่ใช่')['dim_levels'][6], B.FAIR)
        self.assertIsNone(self.g()['dim_levels'][6])

    def test_shelter_is_worst_dimension(self):
        self.assertEqual(self.g(Q01_Result='ใช่', Q13_Result='ไม่ใช่')['level'], B.FAIR)
        self.assertEqual(self.g(Q01_Result='ใช่', Q13_Result='ใช่')['level'], B.GOOD)
        self.assertEqual(self.g(Q22_Result='ใช่', Q15_Result='ไม่ใช่')['level'], B.POOR)

    def test_nothing_answered(self):
        g = self.g()
        self.assertIsNone(g['level'])
        self.assertIsNone(g['score']['p'])

    def test_share_of_good_items_counts_all_graded_items(self):
        g = self.g(Q01_Result='ใช่', Q03_Soap_Result='ไม่ใช่', Q01_Cleanliness='')
        self.assertEqual(g['score'], {'y': 1, 'n': 2, 'p': 50})

    def test_record_gets_grade(self):
        r = B.clean_sheet(sheet([row(Q01_Result='ใช่', Q01_Cleanliness='ไม่ใช่')]))[0]
        self.assertEqual(r['level'], B.POOR)
        self.assertEqual(r['score']['n'], 2)

    def test_all_32_items_are_required_columns_and_unique(self):
        keys = [it[1] for it in B.ITEMS]
        self.assertEqual(len(keys), 32)
        self.assertEqual(len(set(keys)), 32)
        self.assertTrue(set(keys) <= set(B.required_keys()))
        self.assertEqual({it[0] for it in B.ITEMS}, set(B.DIM_NAMES))


class SupplementaryTests(unittest.TestCase):
    KEYS2 = KEYS + [k for k, _ in B.SUPPLEMENTARY if k not in KEYS]

    def test_no_overlap_with_graded_items(self):
        self.assertFalse({it[1] for it in B.ITEMS} & {k for k, _ in B.SUPPLEMENTARY})

    def test_stored_but_never_graded(self):
        base = B.clean_sheet(sheet([row(Q01_Result='ใช่')], self.KEYS2))[0]
        more = B.clean_sheet(sheet([row(Q01_Result='ใช่', Q05_Methods='สูบเก็บ', Q18_Sources='น้ำบาดาล', Q01_Toilet_Count='10')], self.KEYS2))[0]
        self.assertEqual(more['extra']['Q18_Sources'], 'น้ำบาดาล')
        self.assertEqual(more['extra']['Q01_Toilet_Count'], '10')
        for field in ('level', 'levels', 'dim_levels', 'score'):
            self.assertEqual(base[field], more[field], field)

    def test_missing_supplementary_column_is_tolerated(self):
        r = B.clean_sheet(sheet([row(Q01_Result='ใช่')]))[0]
        self.assertEqual(r['extra']['Q18_Sources'], '')
        self.assertEqual(r['level'], B.GOOD)


class LatestTests(unittest.TestCase):
    def test_latest_by_date_across_calendars(self):
        recs = B.clean_sheet(sheet([row(assess_date='2569-10-03'), row(assess_date='2026-10-06'), row(assess_date='2026-10-02')]))
        self.assertEqual([r['is_latest'] for r in recs], [False, True, False])

    def test_tie_later_row_wins(self):
        recs = B.clean_sheet(sheet([row(), row()]))
        self.assertEqual([r['is_latest'] for r in recs], [False, True])

    def test_one_latest_per_shelter(self):
        recs = B.clean_sheet(sheet([row(), row(shelter_id='S2'), row(assess_date='2026-10-07')]))
        self.assertEqual(sum(r['is_latest'] for r in recs), 2)


class AnnotateTests(unittest.TestCase):
    TODAY = __import__('datetime').date(2026, 10, 7)

    def one(self, **kw):
        recs = B.clean_sheet(sheet([row(status='เปิดให้บริการ', **kw)]))
        B.annotate(recs, self.TODAY)
        return recs[0]

    def test_poor_fair_and_priority(self):
        r = self.one(assess_date='2026-10-07', Q01_Cleanliness='ไม่ใช่', Q08_Result='ใช่', Q03_Soap_Result='ไม่ใช่', Q01_Result='ใช่')
        self.assertEqual(r['poor'], ['ห้องส้วมสะอาดและถูกสุขลักษณะ', 'พบปัญหาน้ำท่วมขังหรือน้ำเสียเอ่อล้น'])
        self.assertEqual(r['fair'], ['มีสบู่สำหรับล้างมือ'])
        self.assertEqual(r['age_days'], 0)
        self.assertFalse(r['stale'])
        self.assertEqual(r['priority'], 40 * 2 + 10)

    def test_stale_only_when_open(self):
        self.assertTrue(self.one(assess_date='2026-10-03')['stale'])
        self.assertFalse(self.one(assess_date='2026-10-05')['stale'])
        closed = B.clean_sheet(sheet([row(status='ปิดให้บริการ', assess_date='2026-09-01')]))
        B.annotate(closed, self.TODAY)
        self.assertFalse(closed[0]['stale'])

    def test_missing_date_is_stale(self):
        r = self.one(assess_date='')
        self.assertIsNone(r['age_days'])
        self.assertTrue(r['stale'])
        self.assertEqual(r['priority'], 10)


if __name__ == '__main__':
    unittest.main()
