import unittest
from unittest.mock import patch
import server

class SourceTests(unittest.TestCase):
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
        self.assertEqual(server.OPTIONAL,{'flood_risk','flood_wl_critical'})
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

if __name__=='__main__': unittest.main()
