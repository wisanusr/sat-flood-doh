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
        # District rows (flood_waterlogged_amphoe): real district codes so the map fills them. Satellite-based districts in the
        # 4 test provinces; a province with no satellite water (Kanchanaburi) whose districts come from the DDPM alone (count /
        # area blank); 2 green districts; a district code that is not in the map (9901).
        def amp(pc,pn,code,name,lv,plv,dd=None,tamb=True,j=1,absent=None,why=''):
            sat=dict(waterlogged_tambons=j,confirmed_tambons=j-1,watch_tambons=1,new_tambons=1,nodata_tambons=0,stale_tambons=3,total_tambons=10,latest_area_km2=2.5*j,max_run_days=j+0.5) if tamb else {k:None for k in 'waterlogged_tambons confirmed_tambons watch_tambons new_tambons nodata_tambons stale_tambons total_tambons latest_area_km2 max_run_days'.split()}
            return dict(run_at=STAMP,province_code=pc,province=pn,district_code=code,district=name,level_code=lv,basis='ภาพดาวเทียม + ปภ.' if tamb else 'ปภ. (ไม่มีภาพดาวเทียม)',
                reasons=why or 'ทดสอบระดับ '+lv,**sat,in_ddpm='ใช่' if dd else 'ไม่ใช่',ddpm_days=dd,absent_days=absent,province_level_code=plv,province_reasons='ทดสอบเหตุผลจังหวัด '+pn)
        levels={'14':('red',9),'60':('orange',5),'18':('yellow',2),'24':('yellow',None)}
        rows_amp=[amp(pc,pn,pc+'0'+str(j),'อำเภอ'+str(j),levels[pc][0],levels[pc][0],levels[pc][1] and levels[pc][1]+j,j=j) for pn,pc,_,_ in provs for j in (1,2,3)]
        rows_amp+=[amp('71','กาญจนบุรี','7101','อำเภอปภ1','red','red',11,False),amp('71','กาญจนบุรี','7102','อำเภอปภ2','orange','red',5,False),amp('71','กาญจนบุรี','7103','อำเภอปภ3','yellow','red',2,False)]
        rows_amp+=[amp('22','จันทบุรี','220'+str(j),'อำเภอฟื้น'+str(j),'green','green',None,False,absent=j+1,why='เคยอยู่ใน ปภ. ต่อเนื่อง 5 วัน แล้วไม่อยู่ในรายงาน %d วัน (ประมาณว่าน้ำลด ไม่ใช่การยืนยัน)'%(j+1)) for j in (1,2)]
        rows_amp+=[amp('99','จังหวัดไม่มีในแผนที่','9901','อำเภอไม่มีในแผนที่','red','red',9,False)]
        result['floodWaterloggedAmphoe']=[] if scenario=='prempty' else rows_amp
    failures=list(server.SHEETS) if scenario=='allfailed' else ['BKK_water_DB'] if scenario=='partial' else ['flood_waterlogged','flood_waterlogged_amphoe'] if scenario=='wlerror' else ['flood_waterlogged_amphoe'] if scenario=='prerror' else []
    keys={'Disaster_DB':'disasters','Vulnerable_group':'vulnerable','thai_water_DB':'stations','BKK_water_DB':'bkkStations','shelter_DB':'shelters','flood_risk':'floodRisk','flood_wl_critical':'floodCritical','flood_waterlogged':'floodWaterlogged','flood_waterlogged_amphoe':'floodWaterloggedAmphoe'}
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
