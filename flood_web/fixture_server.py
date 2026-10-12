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
    if scenario not in ('empty','wlempty'):
        # Waterlogging tab: every status, a tambon without coordinates, a long list so paging and the canvas map are exercised.
        sts=['น้ำขัง','เฝ้าระวัง','พบน้ำใหม่','ข้อมูลไม่พอ','พบน้ำล่าสุด (ไม่มีภาพใหม่)']
        provs=[('ชัยนาท','18',15.19,100.12),('นครสวรรค์','60',15.70,100.12),('พระนครศรีอยุธยา','14',14.35,100.57),('ฉะเชิงเทรา','24',13.69,101.07)]
        rows=[]
        for i in range(60):
            pn,pc,la,lo=provs[i%4]; st=sts[i%5]
            rows.append(dict(run_at=STAMP,status=st,confidence=('สูง' if (i//5)%2==0 else 'กลาง') if st=='น้ำขัง' else None,province_code=pc,province=pn,district_code=pc+'0'+str(i%3+1),district='อำเภอ'+str(i%3+1),
                subdistrict='ตำบลทดสอบ'+str(i),tb_idn=pc+'0'+str(i%3+1)+'%02d'%(i%90),run_span_days=(i%7)+0.5 if i%5<2 else 0,run_start='2026-10-02T05:50:00+07:00',run_end='2026-10-09T05:50:00+07:00',
                image_age_hours=30+i if st.startswith('พบน้ำล่าสุด') else 26.5,detections=i%5+1,latest_area_km2=round(0.2+i*0.37,3) if i%11 else None,
                in_ddpm='ใช่' if i%3 else 'ไม่ใช่',ddpm_days=(i%9)+1 if i%3 else None,ddpm_report_date='2026-10-09T00:00:00+07:00',
                latitude=None if i==7 else la+((i*7)%40)/100-0.2,longitude=None if i==7 else lo+((i*13)%40)/100-0.2,reasons='พบน้ำต่อเนื่อง %d วัน; อยู่ในอำเภอที่ ปภ. รายงาน'%(i%7)))
        result['floodWaterlogged']=rows
        result['floodWaterloggedDistrict']=[dict(run_at=STAMP,province=pn,district_code=pc+'0'+str(j),district='อำเภอ'+str(j),waterlogged_tambons=j,confirmed_tambons=j-1,watch_tambons=1,new_tambons=1,nodata_tambons=0,stale_tambons=3,total_tambons=10,latest_area_km2=2.5*j,max_run_days=j+0.5,in_ddpm='ใช่',ddpm_days=j+2) for pn,pc,_,_ in provs for j in (1,2,3)]
        # Province with no satellite water: DDPM-only districts, count / area columns blank (null)
        result['floodWaterloggedDistrict']+=[dict(run_at=STAMP,province='กาญจนบุรี',district_code='710'+str(j),district='อำเภอปภ'+str(j),waterlogged_tambons=None,confirmed_tambons=None,watch_tambons=None,new_tambons=None,nodata_tambons=None,stale_tambons=None,total_tambons=None,latest_area_km2=None,max_run_days=None,in_ddpm='ใช่',ddpm_days=12-j,basis='ปภ. (ไม่มีภาพดาวเทียม)') for j in (1,2)]
        for r in result['floodWaterloggedDistrict']: r.setdefault('basis','ภาพดาวเทียม + ปภ.')
    if scenario not in ('empty','wlempty','prempty'):
        # 2P2R province colours: all 5 levels, one province code that is not in the map (99) and blank max_ddpm_days
        def pr(code,name,lv,label,phase,plan,r,o,y,g,wl,dd,why):
            return dict(run_at=STAMP,province_code=code,province=name,level_code=lv,level=label,phase=phase,plan=plan,red_districts=r,orange_districts=o,yellow_districts=y,green_districts=g,waterlogged_tambons=wl,max_ddpm_days=dd,reasons=why)
        result['flood2p2r']=[
            pr('14','พระนครศรีอยุธยา','red','แดง','Response','แก้ไขทันที: จัดการน้ำเสีย ขยะ ส้วม น้ำสะอาด และคุ้มครองประชาชน',13,2,1,0,117,12,'น้ำขังต่อเนื่อง: 13 อำเภอที่ ปภ. รายงาน ≥ 7 วัน'),
            pr('60','นครสวรรค์','orange','ส้ม','Preparedness → Response','ตรวจเชิงรุก: ลงสำรวจคุณภาพน้ำ ส้วม ขยะ น้ำใช้ และกลุ่มเปราะบาง',0,3,1,0,54,5,'น้ำขังที่ ปภ. รายงานต่อเนื่อง 3–6 วัน'),
            pr('18','ชัยนาท','yellow','เหลือง','Preparedness','เตรียมทีม อุปกรณ์ คลอรีน PPE ทะเบียนกลุ่มเปราะบาง และติดตามสถานการณ์',0,0,2,0,0,None,'มีรายงาน/พบน้ำ แต่ยังไม่เข้าเงื่อนไขน้ำขัง'),
            pr('22','จันทบุรี','green','เขียว','Recovery','ฟื้นฟู: Big Cleaning ล้าง–ฆ่าเชื้อ ฟื้นระบบน้ำและสุขาภิบาล ตรวจความปลอดภัย และติดตามกลุ่มเปราะบาง',0,0,0,2,0,None,'น้ำน่าจะลด: 2 อำเภอเคยอยู่ใน ปภ. ต่อเนื่อง ≥ 3 วัน แล้วไม่อยู่ในรายงาน ≥ 2 วัน (ประมาณจาก ปภ. ไม่ใช่การยืนยัน)'),
            pr('30','นครราชสีมา','normal','ปกติ','','ไม่พบสถานการณ์',0,0,0,0,0,None,'ไม่พบสถานการณ์'),
            pr('99','จังหวัดไม่มีในแผนที่','red','แดง','Response','แก้ไขทันที',1,0,0,0,0,9,'ทดสอบรหัสจังหวัดที่ไม่ตรงกับ GeoJSON'),
        ]
    failures=list(server.SHEETS) if scenario=='allfailed' else ['BKK_water_DB'] if scenario=='partial' else ['flood_waterlogged','flood_waterlogged_district'] if scenario=='wlerror' else ['flood_2p2r_province'] if scenario=='prerror' else []
    keys={'Disaster_DB':'disasters','Vulnerable_group':'vulnerable','thai_water_DB':'stations','BKK_water_DB':'bkkStations','shelter_DB':'shelters','flood_risk':'floodRisk','flood_wl_critical':'floodCritical','flood_waterlogged':'floodWaterlogged','flood_waterlogged_district':'floodWaterloggedDistrict','flood_2p2r_province':'flood2p2r'}
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
