"""Local-only deterministic UI acceptance server. Never used by production."""
import json
from urllib.parse import urlsplit, parse_qs
import server

STAMP='2026-10-04T12:00:00+07:00'
def fixture(scenario, retry=None):
    result=server.transform({name:[] for name in server.SHEETS})
    result['loadedAt']=STAMP
    result['sourceStatus']={name:dict(status='ok',loadedAt=STAMP,message=None) for name in server.SHEETS}
    if scenario!='empty':
        result['disasters']=[dict(Record_ID='test',Report_Date=STAMP,Province='กรุงเทพมหานคร',Affected_Households=0,Current_Status='กำลังประสบภัย',Affected_Districts_Count=0,Affected_Subdistricts_Count=0,Affected_Villages_Count=0)]
        result['bkkStations']=[dict(station_id=str(i),station_name='สถานีทดสอบ '+str(i),district_or_area='บางรัก',province='กรุงเทพมหานคร',latitude=13.72+i/10000,longitude=100.52,observed_at_th='2026-10-01T12:00:00+07:00' if scenario=='stale' else STAMP,fetched_at_th=STAMP,flood_status_source='วิกฤต',water_in_m_msl=1) for i in range(25)]
        result['shelters']=[dict(shelter_id=str(i),shelter_name='ศูนย์ทดสอบ '+str(i),district='บางรัก',latitude=13.72+i/10000,longitude=100.52,capacity=100,occupied=0,available=100,status_source='เปิดให้บริการ/ว่าง',updated_at_source=STAMP) for i in range(25)]
    failures=list(server.SHEETS) if scenario=='allfailed' else ['BKK_water_DB'] if scenario=='partial' else []
    keys={'Disaster_DB':'disasters','Vulnerable_group':'vulnerable','thai_water_DB':'stations','BKK_water_DB':'bkkStations','shelter_DB':'shelters'}
    for name in failures:
        if name==retry: continue
        result[keys[name]]=[]
        result['sourceStatus'][name]=dict(status='error',loadedAt=None,message='จำลองการอ่านข้อมูลไม่สำเร็จ')
    if retry:result['sourceStatus']={retry:result['sourceStatus'][retry]}
    return result

class FixtureHandler(server.Handler):
    def do_GET(self):
        route=urlsplit(self.path)
        if route.path=='/api/data':
            scenario=parse_qs(urlsplit(self.headers.get('Referer','')).query).get('scenario',['partial'])[0]
            retry=parse_qs(route.query).get('source',[None])[0]
            data=fixture(scenario,retry)
            body=json.dumps(data,ensure_ascii=False).encode()
            self.send_response(200 if any(s['status']=='ok' for s in data['sourceStatus'].values()) else 503)
            self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Content-Length',str(len(body)))
            self.end_headers();self.wfile.write(body)
        else:super().do_GET()

if __name__=='__main__':server.DashboardServer(('127.0.0.1',8767),FixtureHandler).serve_forever()
