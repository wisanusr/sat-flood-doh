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

if __name__=='__main__': unittest.main()
