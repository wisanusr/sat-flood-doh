import unittest
from unittest.mock import patch
import server

class SourceTests(unittest.TestCase):
    def test_bkk_comparison_survives_transform(self):
        raw={name:[] for name in server.SHEETS}
        raw['BKK_water_DB']=[{'water_status_vs_24h_avg':'ลด'},{}]
        result=server.transform(raw)['bkkStations']
        self.assertEqual(result[0]['water_status_vs_24h_avg'],'ลด')
        self.assertIsNone(result[1]['water_status_vs_24h_avg'])

    def test_dates_and_zero(self):
        self.assertEqual(server.normalize('Report_Date','2/10/2569'),'2026-10-02T00:00:00+07:00')
        self.assertEqual(server.normalize('Affected_Subdistricts_Count','0'),0)
        self.assertIsNone(server.normalize('occupied',''))
        with self.assertRaises(ValueError): server.normalize('Report_Date','31/2/2569')

    def test_partial_failure(self):
        def fetch(item):
            if item[0]=='BKK_water_DB': raise RuntimeError('simulated')
            return item[0],[]
        with patch.object(server,'fetch_sheet',side_effect=fetch),patch('traceback.print_exc'):
            result=server.read_data()
        self.assertEqual(result['sourceStatus']['BKK_water_DB']['status'],'error')
        self.assertEqual(result['sourceStatus']['shelter_DB']['status'],'ok')
        self.assertEqual(result['bkkStations'],[])

    def test_all_failed_and_retry(self):
        with patch.object(server,'fetch_sheet',side_effect=RuntimeError('simulated')),patch('traceback.print_exc'):
            result=server.read_data()
        self.assertTrue(all(s['status']=='error' for s in result['sourceStatus'].values()))
        with patch.object(server,'fetch_sheet',return_value=('shelter_DB',[])) as fetch:
            result=server.read_data('shelter_DB')
        fetch.assert_called_once_with(('shelter_DB',server.SHEETS['shelter_DB']))
        self.assertEqual(list(result['sourceStatus']),['shelter_DB'])
        self.assertEqual(result['sourceStatus']['shelter_DB']['status'],'ok')

    def test_bad_data_isolated(self):
        def fetch(item): return item[0],[{'Report_Date':None,'Province':'กรุงเทพมหานคร'}] if item[0]=='Disaster_DB' else []
        with patch.object(server,'fetch_sheet',side_effect=fetch),patch('traceback.print_exc'):
            result=server.read_data()
        self.assertEqual(result['sourceStatus']['Disaster_DB']['status'],'error')
        self.assertEqual(result['sourceStatus']['thai_water_DB']['status'],'ok')

class FloodTabTests(unittest.TestCase):
    def test_new_columns_are_typed(self):
        self.assertEqual(server.normalize('run_at','2026-10-07 15:04'),'2026-10-07T15:04:00+07:00')
        self.assertEqual(server.normalize('forecast_total_mm','224.6'),224.6)
        self.assertEqual(server.normalize('situation_level','5'),5)
        self.assertIsNone(server.normalize('max_overbank_m',''))
        self.assertEqual(server.normalize('forecast_start','2026-10-07'),'2026-10-07T00:00:00+07:00')
        self.assertEqual(server.normalize('forecast_fetched_at','2026-10-07 15:03'),'2026-10-07T15:03:00+07:00')

    def test_flood_tabs_are_optional_and_transformed(self):
        self.assertEqual(server.OPTIONAL,{'flood_risk','flood_wl_critical','flood_waterlogged','flood_waterlogged_district','flood_2p2r_province'})
        self.assertTrue(server.OPTIONAL<=set(server.SHEETS))
        raw={name:[] for name in server.SHEETS}
        raw['flood_risk']=[{'province':'ระนอง','risk_level':'สูง','forecast_daily_mm':'1.9|19.3||69.6','tmd_warning_title':'t'},{'province':'','risk_level':'สูง'}]
        raw['flood_wl_critical']=[{'province':'กรุงเทพมหานคร','station_name':'x','latitude':13.9}]
        out=server.transform(raw)
        self.assertEqual([r['province'] for r in out['floodRisk']],['ระนอง'])
        self.assertEqual(out['floodRisk'][0]['forecast_daily_mm'],'1.9|19.3||69.6')
        self.assertEqual(out['floodRisk'][0]['tmd_warning_title'],'t')
        self.assertIsNone(out['floodRisk'][0]['cap_headlines'])
        self.assertIn('amphoe',out['floodCritical'][0])
        self.assertEqual(out['floodCritical'][0]['latitude'],13.9)
        self.assertIsNone(out['floodCritical'][0]['province_code'])

    def test_flood_tab_failure_is_isolated(self):
        def fetch(item):
            if item[0]=='flood_risk': raise RuntimeError('simulated')
            return item[0],[]
        with patch.object(server,'fetch_sheet',side_effect=fetch),patch('traceback.print_exc'):
            result=server.read_data()
        self.assertEqual(result['sourceStatus']['flood_risk']['status'],'error')
        self.assertEqual(result['sourceStatus']['flood_wl_critical']['status'],'ok')
        self.assertEqual(result['sourceStatus']['Disaster_DB']['status'],'ok')

class WaterloggedTabTests(unittest.TestCase):
    def csv(self, name, rows):
        head = server.REQUIRED[name]
        lines = [','.join(head)] + [','.join('"%s"' % str(r.get(k, '')).replace('"', '""') for k in head) for r in rows]
        return chr(10).join(lines)

    def test_contract_columns(self):
        self.assertEqual(len(server.REQUIRED['flood_waterlogged']), 21)
        self.assertEqual(len(server.REQUIRED['flood_waterlogged_district']), 16)
        self.assertEqual(server.REQUIRED['flood_waterlogged_district'][-1], 'basis')
        self.assertEqual(server.SHEETS['flood_waterlogged'], None)   # read by tab name: no gid was given
        self.assertTrue({'flood_waterlogged', 'flood_waterlogged_district'} <= server.OPTIONAL)

    def test_typed_rows_blank_is_null_not_zero(self):
        text = self.csv('flood_waterlogged', [dict(run_at='2026-10-09 07:30', status='น้ำขัง', province='ชัยนาท', district='เมืองชัยนาท', subdistrict='บ้านกล้วย',
            tb_idn='180101', province_code='18', run_span_days='3.5', run_start='2026-10-06 18:23', image_age_hours='', detections='x', latest_area_km2='1,234.5',
            ddpm_days='4', ddpm_report_date='09/10/2569', latitude='15.2', longitude='')])
        row = server.parse_sheet('flood_waterlogged', text)[0]
        self.assertEqual((row['run_span_days'], row['latest_area_km2'], row['ddpm_days'], row['latitude']), (3.5, 1234.5, 4, 15.2))
        self.assertIsNone(row['image_age_hours']); self.assertIsNone(row['longitude']); self.assertIsNone(row['detections'])
        self.assertEqual(row['tb_idn'], '180101'); self.assertEqual(row['province_code'], '18')
        self.assertEqual(row['run_at'], '2026-10-09T07:30:00+07:00'); self.assertEqual(row['run_start'], '2026-10-06T18:23:00+07:00')
        self.assertEqual(row['ddpm_report_date'], '2026-10-09T00:00:00+07:00')
        raw = {name: [] for name in server.SHEETS}
        raw['flood_waterlogged'] = [row, dict(status='น้ำขัง', province=''), dict(status='', province='ก')]
        raw['flood_waterlogged_district'] = [dict(province='ก', district='ข', waterlogged_tambons=2, confirmed_tambons=None, basis='ภาพดาวเทียม + ปภ.'), dict(province='ก', district='ค', ddpm_days=12, basis='ปภ. (ไม่มีภาพดาวเทียม)'), dict(province='ก', district='')]
        out = server.transform(raw)
        self.assertEqual(len(out['floodWaterlogged']), 1)
        self.assertEqual(list(out['floodWaterlogged'][0]), server.REQUIRED['flood_waterlogged'])
        self.assertEqual(len(out['floodWaterloggedDistrict']), 2)
        self.assertEqual(list(out['floodWaterloggedDistrict'][0]), server.REQUIRED['flood_waterlogged_district'])
        self.assertIsNone(out['floodWaterloggedDistrict'][0]['confirmed_tambons'])
        ddpm_only = out['floodWaterloggedDistrict'][1]
        self.assertEqual(ddpm_only['basis'], 'ปภ. (ไม่มีภาพดาวเทียม)'); self.assertIsNone(ddpm_only['waterlogged_tambons']); self.assertIsNone(ddpm_only['latest_area_km2'])

    def test_wrong_header_and_bad_date_are_errors(self):
        with self.assertRaises(ValueError): server.parse_sheet('flood_waterlogged', 'a,b' + chr(10) + '1,2')
        with self.assertRaises(ValueError): server.parse_sheet('flood_waterlogged', ','.join(server.REQUIRED['flood_waterlogged'][:-1]) + chr(10))   # a column missing
        with self.assertRaises(ValueError): server.parse_sheet('flood_waterlogged', self.csv('flood_waterlogged', [dict(status='น้ำขัง', province='ก', run_at='not a date')]))
        self.assertEqual(server.parse_sheet('flood_waterlogged', self.csv('flood_waterlogged', [])), [])   # empty tab: no rows, not an exception

    def test_read_by_tab_name(self):
        seen = []
        class Resp:
            headers = {'Content-Type': 'text/csv; charset=utf-8'}
            def __enter__(self): return self
            def __exit__(self, *a): pass
            def read(self): return self_outer.csv('flood_waterlogged', []).encode('utf-8')
        self_outer = self
        def fake(req, timeout): seen.append(req.full_url); return Resp()
        with patch.object(server, 'urlopen', side_effect=fake):
            name, rows = server.fetch_sheet(('flood_waterlogged', None))
        self.assertEqual(rows, [])
        self.assertIn('/gviz/tq?', seen[0]); self.assertIn('sheet=flood_waterlogged', seen[0]); self.assertNotIn('gid=', seen[0])

    def test_2p2r_province_tab(self):
        self.assertEqual(len(server.REQUIRED['flood_2p2r_province']), 14)
        self.assertIsNone(server.SHEETS['flood_2p2r_province'])
        text = self.csv('flood_2p2r_province', [dict(run_at='2026-10-12 16:00', province_code='14', province='พระนครศรีอยุธยา', level_code='red', level='แดง', phase='Response', plan='p',
            red_districts='13', orange_districts='2', yellow_districts='1', green_districts='0', waterlogged_tambons='117', max_ddpm_days='12', reasons='r'),
            dict(province_code='22', province='จันทบุรี', level_code='green', level='เขียว', green_districts='2', max_ddpm_days=''),
            dict(province_code='30', province='นครราชสีมา', level_code='normal', level='ปกติ'), dict(province='', level_code='red'), dict(province='ก', level_code='')])
        rows = server.parse_sheet('flood_2p2r_province', text)
        raw = {name: [] for name in server.SHEETS}
        raw['flood_2p2r_province'] = rows
        out = server.transform(raw)['flood2p2r']
        self.assertEqual([r['level_code'] for r in out], ['red', 'green', 'normal'])
        self.assertEqual((out[0]['province_code'], out[0]['red_districts'], out[0]['max_ddpm_days']), ('14', 13, 12))
        self.assertIsNone(out[1]['max_ddpm_days']); self.assertIsNone(out[2]['red_districts'])   # blank is null, never 0
        self.assertEqual(list(out[0]), server.REQUIRED['flood_2p2r_province'])
        with self.assertRaises(ValueError): server.parse_sheet('flood_2p2r_province', 'a,b' + chr(10) + '1,2')

    def test_failure_is_isolated(self):
        def fetch(item):
            if item[0] == 'flood_waterlogged': raise RuntimeError('simulated')
            return item[0], []
        with patch.object(server, 'fetch_sheet', side_effect=fetch), patch('traceback.print_exc'):
            result = server.read_data()
        self.assertEqual(result['sourceStatus']['flood_waterlogged']['status'], 'error')
        self.assertEqual(result['sourceStatus']['flood_waterlogged_district']['status'], 'ok')
        self.assertEqual(result['sourceStatus']['Disaster_DB']['status'], 'ok')
        self.assertEqual(result['floodWaterlogged'], [])

if __name__=='__main__': unittest.main()
