const assert=require('node:assert/strict');
const m=require('./data-model.js');
for(const [n,c] of [[null,'#94a3b8'],[0,'#94a3b8'],[1,'#22c55e'],[999,'#22c55e'],[1000,'#facc15'],[9999,'#facc15'],[10000,'#f97316'],[99999,'#f97316'],[100000,'#dc2626']])assert.equal(m.householdBorderColor(n),c);
const loaded='2026-10-04T12:00:00+07:00';
const q=r=>m.quality(r,loaded);
for(const [stamp,label] of [['2026-10-04T11:00:00+07:00','ภายใน 24 ชั่วโมง'],['2026-10-03T12:00:00+07:00','ภายใน 24 ชั่วโมง'],['2026-10-03T11:59:59+07:00','ข้อมูลเก่าเกิน 24 ชั่วโมง'],[null,'ไม่ทราบเวลาข้อมูล'],['2026-10-04T12:00:01+07:00','เวลาอนาคต']])assert.equal(q({station_id:'x',observed_at_th:stamp,fetched_at_th:loaded}),label);
assert.equal(q({shelter_id:'x',fetched_at_th:null}),'ไม่ทราบเวลาข้อมูล');
assert.equal(q({shelter_id:'x',updated_at_source:'2026-09-26T08:00:00+07:00',fetched_at_th:'2026-10-04T11:00:00+07:00'}),'ภายใน 24 ชั่วโมง');
assert.equal(m.sum([{x:null}], 'x'),null);assert.equal(m.sum([{x:0}], 'x'),0);assert.equal(m.sum([{x:2},{x:null}], 'x'),2);
assert.equal(m.districtSummary([],q).label,'ไม่มีสถานีในข้อมูล');
assert.equal(m.districtSummary([{station_id:'a',observed_at_th:'2026-10-01T00:00:00+07:00',flood_status_source:'วิกฤต'}],q).label,'ไม่มีข้อมูลล่าสุดภายใน 24 ชั่วโมง');
assert.equal(m.districtSummary([{station_id:'a',observed_at_th:loaded,flood_status_source:'วิกฤติ'},{station_id:'b',observed_at_th:loaded,flood_status_source:'ล้นตลิ่ง'}],q).status,'ล้นตลิ่ง');
assert.equal(m.validCoordinates({latitude:91,longitude:100}),false);
// News tab rules
{
  const arts=[{title:'น้ำท่วมกรุงเทพ',source:'มติชน',urgency:'critical',province:'กรุงเทพมหานคร'},{title:'ฟื้นฟูหลังน้ำลด',source:'Thai PBS',urgency:'recovery',province:'ภาพรวมประเทศ'},{title:'เตือนฝนตกหนัก',source:'มติชน',urgency:'warning',province:'กรุงเทพมหานคร'}];
  assert.equal(m.newsArticles(arts,{}).length,3);
  assert.deepEqual(m.newsArticles(arts,{urgency:'critical'}).map(a=>a.title),['น้ำท่วมกรุงเทพ']);
  assert.equal(m.newsArticles(arts,{province:'กรุงเทพมหานคร'}).length,2);
  assert.equal(m.newsArticles(arts,{query:'thai pbs'}).length,1);
  assert.equal(m.newsArticles(arts,{urgency:'warning',province:'ภาพรวมประเทศ'}).length,0);
  assert.equal(m.newsArticles(null,{}).length,0);
  assert.deepEqual(m.newsProvinces(arts)[0],{province:'กรุงเทพมหานคร',count:2});
  assert.deepEqual(m.newsUrgencyCounts(arts),{critical:1,warning:1,recovery:1});
  const doc={word_freq:{th:{เขื่อน:9,ฝน:4,ตัว:7},en:{dam:3}},tfidf_scores:{th:{เขื่อน:2,ฝน:3,ตัว:1}},word_categories:{เขื่อน:'monitoring',ฝน:'monitoring'}};
  assert.deepEqual(m.newsWords(doc,'th','',0).map(r=>r.word),['ฝน','เขื่อน','ตัว']);
  assert.deepEqual(m.newsWords(doc,'th','monitoring',1).map(r=>r.word),['ฝน']);
  assert.equal(m.newsWords(doc,'th','',0).find(r=>r.word==='ตัว').category,'general');
  assert.deepEqual(m.newsWords(doc,'en','monitoring',0),[]);
  assert.equal(m.newsWords(null,'th','',0).length,0);
  assert.equal(m.safeUrl('javascript:alert(1)'),'');assert.equal(m.safeUrl('//evil'),'');assert.equal(m.safeUrl('https://example.com/a'),'https://example.com/a');
  assert.equal(m.ageLabel(0.1),'6 นาทีที่แล้ว');assert.equal(m.ageLabel(5),'5 ชั่วโมงที่แล้ว');assert.equal(m.ageLabel(72),'3 วันที่แล้ว');assert.equal(m.ageLabel(null),'ไม่ระบุเวลา');
  // News UI helpers
  assert.equal(m.growthValue('+3650%'),3650);assert.equal(m.growthValue('Breakout'),Infinity);assert.equal(m.growthValue(''),-1);assert.equal(m.growthValue(null),-1);
  const rq={rising_queries:[{query:'a',growth:'+100%'},{query:'b',growth:'Breakout'},{query:'c',growth:'+3000%'},{query:'a',growth:'+900%'},{query:'',growth:'+5%'},{query:'d',growth:'x'}]};
  assert.deepEqual(m.newsRising(rq).map(r=>r.query+':'+r.growth),['b:Breakout','c:+3000%','a:+900%','d:x']);
  assert.deepEqual(m.newsRising(null),[]);assert.deepEqual(m.newsRising({}),[]);
  const reg={interest_by_region:[{region:'ข',score:40},{region:'ก',score:100},{region:'ค',score:100},{region:'ง',score:null}]};
  assert.deepEqual(m.newsTopRegions(reg,2).map(r=>r.region),['ก','ค']);assert.equal(m.newsTopRegions(reg,0).length,3);assert.deepEqual(m.newsTopRegions(null,5),[]);
  const wc=[{word:'x',count:3,tfidf:1},{word:'y',count:9,tfidf:0.5},{word:'z',count:3,tfidf:2}];
  assert.deepEqual(m.newsTopByCount(wc,2).map(r=>r.word),['y','z']);assert.equal(m.newsTopByCount(wc,0).length,3);assert.deepEqual(m.newsTopByCount(null,3),[]);
  // Health Need Map helper tests
  const fakeHn = {
    health_need_by_province: {
      'เชียงใหม่': { flood_general: 80, stagnant_water: 45, recovery: 20 },
      'พระนครศรีอยุธยา': { flood_general: 90, stagnant_water: 15, recovery: 60 }
    }
  };
  const mapData = m.healthNeedMapData(fakeHn, 'stagnant_water');
  assert.equal(typeof mapData.data['เชียงใหม่'], 'number');
  assert.equal(mapData.data['เชียงใหม่'] > mapData.data['พระนครศรีอยุธยา'], true);
  assert.equal(mapData.max, 100);
  assert.equal(mapData.category.key, 'stagnant_water');
  const recData = m.healthNeedMapData(fakeHn, 'recovery');
  assert.equal(typeof recData.data['พระนครศรีอยุธยา'], 'number');
  assert.equal(m.healthNeedColor(0, 100, ['#fff', '#f00']), '#f8fafc');
  assert.equal(m.healthNeedColor(100, 100, ['#fff', '#f00']), '#f00');
  assert.equal(m.sourceInitial('matichon.co.th'),'M');assert.equal(m.sourceInitial('ไทยรัฐ'),'ไ');assert.equal(m.sourceInitial('  '),'?');assert.equal(m.sourceInitial(null),'?');
  // Trends timeline: daily means, 24 h windows, phase index
  const pt=(h,v)=>({t:'2026-10-0'+(5+Math.floor(h/24))+'T'+String(h%24).padStart(2,'0')+':00+07:00',v});
  const tlp=[];for(let h=0;h<48;h++)tlp.push(pt(h,[h<24?10:20,h<24?40:30,0]));
  const tl={terms:['a','b','c'],points:tlp};
  assert.deepEqual(m.timelineDaily(tl).map(d=>[d.date,d.hours,...d.values]),[['2026-10-05',24,10,40,0],['2026-10-06',24,20,30,0]]);
  assert.deepEqual(m.timelineDaily(null),[]);assert.deepEqual(m.timelineDaily({terms:['a']}),[]);
  assert.deepEqual(m.termWindows(tl),[{term:'a',index:20,previous:10,change:100},{term:'b',index:30,previous:40,change:-25},{term:'c',index:0,previous:0,change:null}]);
  assert.equal(m.termWindows({terms:['a'],points:tlp.slice(0,10)}),null);
  const shortPrev=m.termWindows({terms:['a','b','c'],points:tlp.slice(-30)});assert.equal(shortPrev[0].previous,null);assert.equal(shortPrev[0].change,null);
  assert.equal(m.trendLevel(60),'สูง');assert.equal(m.trendLevel(59.4),'ปานกลาง');assert.equal(m.trendLevel(29),'ต่ำ');assert.equal(m.trendLevel(null),null);
  const lc=m.lifecycle({timeline:tl,phases:[{key:'p1',label:'1',terms:['a','b'],categories:['x']},{key:'p2',label:'2',terms:['c'],categories:[]},{key:'p3',label:'3',terms:['zzz'],categories:[]}]});
  assert.deepEqual(lc.phases.map(p=>[p.key,p.index,p.level]),[['p1',25,'ต่ำ'],['p2',0,'ต่ำ'],['p3',null,null]]);
  assert.equal(lc.leading,'p1');assert.deepEqual(lc.phases[0].terms.map(t=>t.term),['a','b']);
  assert.equal(m.lifecycle({timeline:null,phases:[{key:'p',terms:['a']}]}),null);assert.equal(m.lifecycle(null),null);assert.equal(m.lifecycle({timeline:tl,phases:[]}),null);
  // Several snapshots in one day: newest per key wins
  {
    const ts=m.timestamp,pick=(rows,k,t)=>m.latestPerKey(rows,k,t).map(r=>r.id);
    const rows=[{id:'a-early',k:'a',t:'2026-10-07T06:00:00+07:00'},{id:'b',k:'b',t:'2026-10-07T07:00:00+07:00'},{id:'a-late',k:'a',t:'2026-10-07T09:55:00+07:00'},{id:'a-mid',k:'a',t:'2026-10-07T08:00:00+07:00'}];
    assert.deepEqual(pick(rows,r=>r.k,r=>ts(r.t)),['a-late','b']);
    assert.deepEqual(pick([{id:1,k:'x',t:'2026-10-07T09:00:00+07:00'},{id:2,k:'x',t:'2026-10-07T02:00:00Z'}],r=>r.k,r=>ts(r.t)),[2]);   // 09:00 +07:00 is 02:00Z: equal, the later row wins
    assert.deepEqual(pick([{id:1,k:'x',t:'2026-10-07T09:00:00+07:00'},{id:2,k:'x',t:'2026-10-07T01:00:00Z'}],r=>r.k,r=>ts(r.t)),[1]);   // offsets are compared as real instants
    assert.deepEqual(pick([{id:1,k:'x',t:'2026-10-07T09:00:00+07:00'},{id:2,k:'x',t:null}],r=>r.k,r=>ts(r.t)),[1]);                      // a row without time never beats one with a time
    assert.deepEqual(pick([{id:1,k:'x',t:null},{id:2,k:'x',t:null}],r=>r.k,r=>ts(r.t)),[2]);
    assert.deepEqual(pick([{id:1,k:''},{id:2,k:null},{id:3,k:'y'}],r=>r.k,()=>NaN),[3,1,2]);
    assert.deepEqual(m.latestPerKey(null,r=>r,()=>0),[]);
    assert.equal(m.disasterTime({Update_Time:'2026-10-07T10:00:00+07:00',Ingested_At:'2026-10-07T09:55:00+07:00'}),ts('2026-10-07T10:00:00+07:00'));
    assert.equal(m.disasterTime({Update_Time:null,Ingested_At:'2026-10-07T09:55:00+07:00'}),ts('2026-10-07T09:55:00+07:00'));
    assert.ok(Number.isNaN(m.disasterTime({})));
    const st=[{o:'2026-10-07T11:00:00+07:00'},{o:'2026-10-07T11:50:00+07:00'},{o:'2026-10-07T13:00:00+07:00'},{o:'bad'}];
    assert.equal(m.latestTime(st.map(x=>({observed_at_th:x.o})),'observed_at_th',ts('2026-10-07T12:00:00+07:00')),ts('2026-10-07T11:50:00+07:00'));
    assert.equal(m.latestTime(st.map(x=>({observed_at_th:x.o})),'observed_at_th'),ts('2026-10-07T13:00:00+07:00'));
    assert.ok(Number.isNaN(m.latestTime([],'observed_at_th')));
  }
  // Data age banner
  const T0=Date.parse('2026-10-07T00:00:00Z');
  assert.deepEqual(m.dataAge('2026-10-07T00:00:00Z',T0+5*60000),{minutes:5,level:'ok',text:'5 นาที'});
  assert.deepEqual(m.dataAge('2026-10-07T00:00:00Z',T0+60*60000),{minutes:60,level:'ok',text:'1 ชม. 0 นาที'});
  assert.equal(m.dataAge('2026-10-07T00:00:00Z',T0+61*60000).level,'warn');assert.equal(m.dataAge('2026-10-07T00:00:00Z',T0+180*60000).level,'warn');
  assert.deepEqual(m.dataAge('2026-10-07T00:00:00Z',T0+336*60000),{minutes:336,level:'bad',text:'5 ชม. 36 นาที'});
  assert.equal(m.dataAge('2026-10-07T00:00:00Z',T0-60000).minutes,0);assert.equal(m.dataAge(null,T0),null);assert.equal(m.dataAge('x',T0),null);assert.equal(m.dataAge('2026-10-07T00:00:00.516Z',T0+60000).minutes,0);
  // Vulnerable-group totals
  const vrows=[{province:'ก',elderly:100,pregnant:10,children:50},{province:'ข',elderly:300,pregnant:null,children:150},{province:'ค',elderly:600,pregnant:30,children:null}];
  const vt=m.vulnerableTotals(vrows,new Set(['ก','ข']));
  assert.deepEqual(vt.all,{elderly:1000,pregnant:40,children:200});assert.deepEqual(vt.affected,{elderly:400,pregnant:10,children:200});
  assert.deepEqual(vt.share,{elderly:40,pregnant:25,children:100});assert.equal(vt.provinces,3);assert.equal(vt.affectedProvinces,2);
  const none=m.vulnerableTotals(vrows,new Set());assert.deepEqual(none.affected,{elderly:null,pregnant:null,children:null});assert.deepEqual(none.share,{elderly:null,pregnant:null,children:null});assert.equal(none.affectedProvinces,0);
  const empty=m.vulnerableTotals([],new Set(['ก']));assert.deepEqual(empty.all,{elderly:null,pregnant:null,children:null});assert.equal(empty.provinces,0);assert.equal(m.vulnerableTotals(null,new Set()).provinces,0);
  // Trend hatching categories
  assert.equal(m.trendKind('เพิ่มขึ้น'),'up');assert.equal(m.trendKind('ระดับน้ำเพิ่มขึ้น'),'up');assert.equal(m.trendKind(' ทรงตัว '),'steady');assert.equal(m.trendKind('ลดลง'),'down');
  assert.equal(m.trendKind(''),null);assert.equal(m.trendKind(null),null);assert.equal(m.trendKind('ไม่ระบุ'),null);
  // Situation summary rules
  assert.equal(m.provinceLevel('เพิ่มขึ้น',2),'critical');assert.equal(m.provinceLevel('ระดับน้ำเพิ่มขึ้น',1),'critical');
  assert.equal(m.provinceLevel('เพิ่มขึ้น',0),'high');assert.equal(m.provinceLevel('ทรงตัว',5),'high');
  assert.equal(m.provinceLevel('ลดลง',9),'stabilizing');assert.equal(m.provinceLevel(null,3),'unknown');assert.equal(m.provinceLevel('',0),'unknown');
  assert.equal(m.regionNumber('เขตสุขภาพที่ 13'),13);assert.equal(m.regionNumber(''),null);
  const reps=[{Province:'ก',Water_Level_Trend:'เพิ่มขึ้น',Affected_Households:10},{Province:'ข',Water_Level_Trend:'เพิ่มขึ้น',Affected_Households:500},{Province:'ค',Water_Level_Trend:'ลดลง',Affected_Households:null},{Province:'ง',Water_Level_Trend:'ทรงตัว',Affected_Households:7},{Province:'จ',Water_Level_Trend:null,Affected_Households:1},{Province:'ฉ',Water_Level_Trend:'เพิ่มขึ้น',Affected_Households:3}];
  const region={ก:'เขตสุขภาพที่ 4',ข:'เขตสุขภาพที่ 4',ค:'เขตสุขภาพที่ 13',ง:'เขตสุขภาพที่ 5',จ:'เขตสุขภาพที่ 5'};
  const grp=m.situationGroups(reps,p=>region[p],p=>({ก:1,ข:2,ค:0})[p]||0);
  assert.deepEqual(grp.critical.map(g=>[g.region,g.items.map(i=>i.province)]),[['เขตสุขภาพที่ 4',['ข','ก']]]);   // more households first
  assert.deepEqual(grp.high.map(g=>[g.region,g.items.map(i=>i.province)]),[['เขตสุขภาพที่ 5',['ง']],['ไม่ทราบเขต',['ฉ']]]);
  assert.deepEqual(grp.stabilizing.map(g=>g.number),[13]);assert.equal(grp.stabilizing[0].items[0].households,null);
  assert.deepEqual(grp.unknown.map(g=>g.items[0].province),['จ']);
  assert.deepEqual(m.situationGroups([],()=>'',()=>0),{critical:[],high:[],stabilizing:[],unknown:[]});
  assert.deepEqual(m.situationGroups(null,()=>'',()=>0).critical,[]);
  const order=m.situationGroups([{Province:'x',Water_Level_Trend:'ลดลง'},{Province:'y',Water_Level_Trend:'ลดลง'},{Province:'z',Water_Level_Trend:'ลดลง'}],p=>({x:'เขตสุขภาพที่ 13',y:'เขตสุขภาพที่ 2',z:''})[p],()=>0).stabilizing.map(g=>g.region);
  assert.deepEqual(order,['เขตสุขภาพที่ 2','เขตสุขภาพที่ 13','ไม่ทราบเขต']);   // numeric order, unknown last
}
// Flood-prep tab rules
{
  const rows=[{province:'ก',risk_level:'กลาง',forecast_total_mm:50,wl_level5:0,wl_rising_critical:1,in_active_cap:'False'},
              {province:'ข',risk_level:'สูง',forecast_total_mm:10,wl_level5:2,wl_rising_critical:0,in_active_cap:'True'},
              {province:'ค',risk_level:'สูง',forecast_total_mm:90,wl_level5:1,wl_rising_critical:2,in_active_cap:true},
              {province:'ง',risk_level:'ต่ำ'},{province:'จ',risk_level:'???'},{province:'',risk_level:'สูง'}];
  assert.deepEqual(m.riskRows(rows).map(r=>r.province),['ค','ข','ก','ง']);      // level, then forecast total; unknown level/empty province dropped
  assert.deepEqual(m.riskRows(rows,'สูง').map(r=>r.province),['ค','ข']);
  assert.deepEqual(m.riskSummary(rows),{total:4,high:2,medium:1,low:1,level5Stations:3,risingCritical:3,inCap:2});
  assert.deepEqual(m.riskSummary(null),{total:0,high:0,medium:0,low:0,level5Stations:0,risingCritical:0,inCap:0});
  assert.equal(m.parseBool('True'),true);assert.equal(m.parseBool('false'),false);assert.equal(m.parseBool(''),false);assert.equal(m.parseBool(null),false);
  assert.equal(m.waterTrend({waterlevel_msl:2.01,waterlevel_msl_prev:2.01}),'flat');
  assert.equal(m.waterTrend({waterlevel_msl:2.02,waterlevel_msl_prev:2.01}),'up');
  assert.equal(m.waterTrend({waterlevel_msl:202.18,waterlevel_msl_prev:202.19}),'down');   // 1 cm is above the 5 mm "flat" band
  assert.equal(m.waterTrend({waterlevel_msl:2.003,waterlevel_msl_prev:2.0}),'flat');
  assert.equal(m.waterTrend({waterlevel_msl:null,waterlevel_msl_prev:1}),null);
  assert.equal(m.overbankM({diff_wl_bank:0.83,diff_wl_bank_text:'ล้นตลิ่ง (ม.)'}),0.83);
  assert.equal(m.overbankM({diff_wl_bank:0.83,diff_wl_bank_text:'ต่ำกว่าตลิ่ง (ม.)'}),null);   // only stations that say they are over the bank
  assert.equal(m.overbankM({diff_wl_bank:null,diff_wl_bank_text:'ล้นตลิ่ง (ม.)'}),null);
  const run='2026-10-07T13:00:00+07:00',at=h=>Date.parse(run)+h*3600000;
  assert.equal(m.riskFreshness(run,at(1)).level,'ok');
  assert.equal(m.riskFreshness(run,at(20)).level,'ok');       // overnight gap between the 13:00 and 09:00 runs is normal
  assert.equal(m.riskFreshness(run,at(25)).level,'warn');
  assert.equal(m.riskFreshness(run,at(31)).level,'bad');      // a whole missed run
  assert.equal(m.riskFreshness(run,at(-2)).level,'unknown');  // timestamp in the future
  assert.equal(m.riskFreshness(null,at(1)).level,'unknown');
  assert(!('flood_risk' in m.SOURCES),'flood tabs must stay out of SOURCES (core retry/footer/refresh loops)');
  assert.deepEqual(m.RISK_SOURCES,{flood_risk:'floodRisk',flood_wl_critical:'floodCritical'});
}
// Flood-prep evidence view: rain series, rain classes, dates, exposure
{
  assert.deepEqual(m.parseSeries('1.9|19.3||69.6|x'),[1.9,19.3,null,69.6,null]);   // empty and non-numeric days stay as gaps, never 0
  assert.deepEqual(m.parseSeries(''),[]);assert.deepEqual(m.parseSeries(null),[]);assert.deepEqual(m.parseSeries('0'),[0]);
  const key=v=>m.rainClass(v)?.key;
  assert.deepEqual([0,0.05,0.1,10,10.1,35,35.1,90,90.1].map(key),['none','none','light','light','moderate','moderate','heavy','heavy','very']);
  assert.equal(m.rainClass(null),null);assert.equal(m.rainClass(NaN),null);
  assert.deepEqual(m.seriesDates('2026-10-30T00:00:00+07:00',4),['2026-10-30','2026-10-31','2026-11-01','2026-11-02']);   // month rollover
  assert.deepEqual(m.seriesDates('2026-12-31',2),['2026-12-31','2027-01-01']);                                           // year rollover
  assert.deepEqual(m.seriesDates('not a date',3),[]);
  const vul=[{province:'ก',children:1,pregnant:2,elderly:3},{province:'ก',children:99,pregnant:99,elderly:99},{province:'ข',children:10,pregnant:null,elderly:5}];
  assert.deepEqual(m.exposure(vul,['ก','ข','ค']),{children:11,pregnant:2,elderly:8,total:21,matched:2,missing:['ค']});   // a province counts once; null is not 0
  assert.deepEqual(m.exposure(null,['ก']),{children:0,pregnant:0,elderly:0,total:0,matched:0,missing:['ก']});
  assert.deepEqual(m.reasonList('ก; ข ;; ค'),['ก','ข','ค']);assert.deepEqual(m.reasonList(null),[]);
}
// Waterlogging tab: status groups, counts, ordering, filters, freshness, coordinates, null handling
{
  const T='น้ำขัง',W='เฝ้าระวัง',N='พบน้ำใหม่',D='ข้อมูลไม่พอ',S='พบน้ำล่าสุด (ไม่มีภาพใหม่)';
  assert.deepEqual(Object.keys(m.WATER_LOG_STATUS),[T,W,N,D,S]);   // exactly the pipeline's 5 labels; no separate "pending" status
  assert(!('น้ำขัง (รอยืนยัน)' in m.WATER_LOG_STATUS));
  assert(!('flood_waterlogged' in m.SOURCES),'waterlogging tabs must stay out of SOURCES (core retry/footer/refresh loops)');
  const row=(st,sub,area,extra={})=>({province:'ก',district:'ข',district_code:'1001',subdistrict:sub,status:st,latest_area_km2:area,...extra});
  const rows=[row(S,'s1',9),row(D,'s2',null),row(N,'s3',2),row(W,'s4',1),row(T,'s5',50,{confidence:'กลาง'}),row(T,'s6',1,{confidence:'สูง'}),row(T,'s7',3,{confidence:'สูง'}),row(T,'s8',null,{confidence:'สูง'}),row(T,'s10',4,{confidence:'กลาง'}),row(T,'s11',7),row('???','s9',5),{province:'',status:T},{province:'ก',status:''}];
  // order: status; within 'น้ำขัง' confidence สูง before กลาง before missing, then area large to small (unknown last); unknown status last
  assert.deepEqual(m.waterRows(rows).map(r=>r.subdistrict),['s7','s6','s8','s5','s10','s11','s4','s3','s2','s1','s9']);
  assert.deepEqual(m.waterSummary(rows),{total:11,logged:6,image:3,ddpm:2,unknownConf:1,stale:1,fresh:1,watch:2,other:1});
  assert.deepEqual(m.waterSummary(null),{total:0,logged:0,image:0,ddpm:0,unknownConf:0,stale:0,fresh:0,watch:0,other:0});
  // confidence labels and the dashed (medium confidence) map style
  assert.equal(m.waterConfidence({confidence:'สูง'}).label,'ยืนยันด้วยภาพ');assert.equal(m.waterConfidence({confidence:' กลาง '}).label,'ตาม ปภ.');
  assert.equal(m.waterConfidence({confidence:null}),null);assert.equal(m.waterConfidence({confidence:'ต่ำ'}),null);assert.equal(m.waterConfidence(null),null);
  assert.equal(m.waterIsDashed({status:T,confidence:'กลาง'}),true);assert.equal(m.waterIsDashed({status:T,confidence:'สูง'}),false);
  assert.equal(m.waterIsDashed({status:T}),false);assert.equal(m.waterIsDashed({status:N,confidence:'กลาง'}),false);   // only 'น้ำขัง' is dashed
  // filters: status set, province, district code, search text (tambon / district / province)
  const all=m.waterRows(rows);
  assert.deepEqual(m.waterFilter(all,{statuses:new Set([T])}).map(r=>r.subdistrict),['s7','s6','s8','s5','s10','s11']);
  assert.equal(m.waterFilter(all,{statuses:new Set()}).length,0);
  assert.equal(m.waterFilter(all,{}).length,all.length);
  assert.equal(m.waterFilter(all,{province:'ข'}).length,0);
  assert.deepEqual(m.waterFilter(all,{districtCode:1001,query:' S3 '}).map(r=>r.subdistrict),['s3']);
  assert.equal(m.waterFilter(all,{districtCode:'9999'}).length,0);
  // DDPM district count: >= 3 consecutive days; an empty ddpm_days is not 0 and not counted
  const dd=[{district_code:'1',ddpm_days:3},{district_code:'2',ddpm_days:2},{district_code:'3',ddpm_days:null},{district_code:'4',ddpm_days:10},{district_code:'4',ddpm_days:10}];
  assert.equal(m.waterDdpmDistricts(dd),2);assert.equal(m.waterDdpmDistricts(dd,2),3);assert.equal(m.waterDdpmDistricts(null),0);
  // coordinates: both present and real; empty stays empty (no 0,0 point)
  assert.equal(m.waterHasPoint({latitude:15.2,longitude:100.1}),true);
  assert.equal(m.waterHasPoint({latitude:null,longitude:100.1}),false);assert.equal(m.waterHasPoint({latitude:15.2,longitude:null}),false);
  assert.equal(m.waterHasPoint({latitude:0,longitude:0}),false);assert.equal(m.waterHasPoint({latitude:95,longitude:100}),false);assert.equal(m.waterHasPoint({latitude:'15.2',longitude:'100'}),false);
  // freshness: run level 6 h / 12 h, image age from non-stale rows (falls back to stale rows), unknown without a run time
  const run='2026-10-09T07:00:00+07:00',at=h=>Date.parse(run)+h*3600000;
  const fr=[{status:T,run_at:run,image_age_hours:30},{status:N,run_at:run,image_age_hours:26.5},{status:S,run_at:run,image_age_hours:200},{status:D,run_at:run,image_age_hours:null}];
  assert.equal(m.waterFreshness(fr,at(1)).imageHours,26.5);
  assert.equal(m.waterFreshness([fr[2]],at(1)).imageHours,200);
  assert.equal(m.waterFreshness([{status:T,run_at:run}],at(1)).imageHours,null);
  assert.deepEqual([0,6,6.1,12,12.1].map(h=>m.waterFreshness(fr,at(h)).runLevel),['ok','ok','warn','warn','bad']);
  assert.equal(m.waterFreshness(fr,at(-2)).runLevel,'unknown');assert.equal(m.waterFreshness([],at(1)).runLevel,'unknown');
  assert.equal(m.waterFreshness(fr,at(1)).runAt,new Date(Date.parse(run)).toISOString());
  // 2P2R province colours: level lookup, ordering, counts, code matching (leading zeros / numeric cells), unmatched provinces
  assert.deepEqual(Object.keys(m.WATER_2P2R),['red','orange','yellow','green','normal']);
  assert.deepEqual(['red','orange','yellow','green'].map(k=>m.WATER_2P2R[k].color),['#E24B4A','#EF9F27','#F2D43D','#4CAF50']);
  assert.equal(m.WATER_2P2R.normal.color,null);                                 // normal = no fill
  assert(m.WATER_2P2R.red.note.includes('ไม่ใช่การยืนยัน')&&m.WATER_2P2R.green.note.includes('ไม่ใช่การยืนยัน'));
  assert.equal(m.WATER_2P2R.orange.note,null);
  assert.equal(m.water2p2rLevel({level_code:' red '}).label,'แดง');assert.equal(m.water2p2rLevel({level_code:'purple'}),null);assert.equal(m.water2p2rLevel({level_code:null}),null);assert.equal(m.water2p2rLevel(null),null);
  assert.deepEqual([10,'7','14',' 22 ','',null].map(m.waterProvCode),['10','07','14','22','','']);
  const pv=[{province:'ข',province_code:'31',level_code:'yellow'},{province:'ก',province_code:'14',level_code:'red'},{province:'ค',province_code:'22',level_code:'green'},{province:'ง',province_code:30,level_code:'normal'},{province:'จ',province_code:'32',level_code:'orange'},{province:'ฉ',province_code:'',level_code:'red'},{province:'ช',province_code:'40',level_code:'??'},{province:'',province_code:'41',level_code:'red'},{province:'ซ',province_code:'14',level_code:'orange'}];
  assert.deepEqual(m.waterProvinceRows(pv).map(r=>r.province),['ก','จ','ซ','ข','ค','ง']);   // highest level first, then name; invalid rows dropped
  assert.deepEqual(m.waterProvinceSummary(pv),{total:6,red:1,orange:2,yellow:1,green:1,normal:1,invalid:3});
  assert.deepEqual(m.waterProvinceSummary(null),{total:0,red:0,orange:0,yellow:0,green:0,normal:0,invalid:0});
  const idx=m.waterProvinceIndex(pv);assert.equal(idx.get('14').level_code,'red');assert.equal(idx.get('30').level_code,'normal');assert.equal(idx.size,5);   // duplicate code: first (highest) wins
  assert.deepEqual(m.waterProvinceUnmatched(pv,['14','22','30','31']).map(r=>r.province),['จ']);   // 32 is not in the map
  assert.deepEqual(m.waterProvinceUnmatched([],['14']),[]);
  assert.deepEqual(m.WATERLOGGED_SOURCES,{flood_waterlogged:'floodWaterlogged',flood_waterlogged_amphoe:'floodWaterloggedAmphoe'});
  assert(m.WATER_2P2R.red.plan.startsWith('แก้ไขทันที')&&m.WATER_2P2R.green.plan.startsWith('ฟื้นฟู')&&m.WATER_2P2R.normal.plan==='');
  assert.deepEqual([1404,'1404',' 101 ','',null,'x'].map(m.waterAmpCode),['1404','1404','0101','','','x']);
  const O=m.WATER_BASIS_DDPM_ONLY,S2='ภาพดาวเทียม + ปภ.';
  assert.equal(O,'ปภ. (ไม่มีภาพดาวเทียม)');
  // district rows: a level and a district code are required; codes are padded; highest level first, then province, longest DDPM run
  const amp=[{province:'ก',province_code:'14',district_code:1404,district:'a',level_code:'orange',ddpm_days:4,province_level_code:'red',province_reasons:'pr'},
    {province:'ก',province_code:'14',district_code:'1405',district:'b',level_code:'red',waterlogged_tambons:5,ddpm_days:9,province_level_code:'red',province_reasons:'pr'},
    {province:'ก',province_code:'14',district_code:'1406',district:'c',level_code:'green',absent_days:3,basis:O,province_level_code:'red'},
    {province:'ข',district_code:'7101',district:'d',level_code:'red',ddpm_days:11,basis:O,province_level_code:'red'},
    {province:'ข',district_code:'7102',district:'e',level_code:'yellow',ddpm_days:2,basis:O,province_level_code:'red'},
    {province:'ค',district_code:'',district:'x',level_code:'red'},{province:'ค',district_code:'2201',district:'y',level_code:'purple'},null];
  assert.deepEqual(m.waterAmphoeRows(amp).map(r=>r.district_code),['1405','7101','1404','7102','1406']);
  assert.equal(m.waterAmphoeRows(amp).find(r=>r.district_code==='7101').province_code,'71');   // province code from the district code when blank
  // province rows rebuilt from the district rows: the level / reasons are the pipeline's, the counts are sums
  const pvA=m.waterProvincesFromAmphoe(amp);
  assert.deepEqual(pvA.map(r=>[r.province_code,r.level_code,r.red_districts,r.orange_districts,r.yellow_districts,r.green_districts,r.waterlogged_tambons,r.max_ddpm_days]),
    [['14','red',1,1,0,1,5,9],['71','red',1,0,1,0,null,11]]);
  assert.equal(pvA[0].reasons,'pr');assert.equal(pvA[0].plan,m.WATER_2P2R.red.plan);assert.equal(pvA[1].reasons,null);
  assert.deepEqual(m.waterProvincesFromAmphoe([{province:'ก',district_code:'1001',level_code:'red',province_level_code:'bogus'}]),[]);   // unknown province level: dropped, never guessed
  assert.deepEqual(m.waterProvincesFromAmphoe(null),[]);
  // district list: highest level first; within a level satellite rows (most waterlogged tambons first), then DDPM-only rows
  const mix=[{province:'ก',district:'o1',district_code:'1001',level_code:'red',ddpm_days:7,basis:O},{province:'ก',district:'s1',district_code:'1002',level_code:'red',waterlogged_tambons:0,basis:S2},
    {province:'ข',district:'o2',district_code:'2001',level_code:'red',ddpm_days:12,basis:O},{province:'ก',district:'s2',district_code:'1003',level_code:'red',waterlogged_tambons:3,basis:S2},
    {province:'ก',district:'o3',district_code:'1004',level_code:'orange',ddpm_days:5,basis:O},{province:'ก',district:'o4',district_code:'1005',level_code:'yellow',ddpm_days:2,basis:O},
    {province:'ก',district:'g1',district_code:'1006',level_code:'green',basis:O},{province:'',district:'x',district_code:'1007',level_code:'red'}];
  assert.deepEqual(m.waterDistricts(mix).map(r=>r.district),['s2','s1','o2','o1','o3','o4','g1']);
  assert.equal(m.waterDdpmOnlyCount(mix),3);                                   // DDPM-only red / orange only: not yellow, not green
  assert.equal(m.waterDdpmOnlyCount(null),0);assert.equal(m.waterDdpmOnlyCount([{basis:S2,level_code:'red'}]),0);
  assert.equal(m.waterIsDdpmLogged({basis:O,level_code:'orange'}),true);assert.equal(m.waterIsDdpmLogged({basis:O,level_code:'yellow'}),false);assert.equal(m.waterIsDdpmLogged({basis:S2,level_code:'red'}),false);
  assert.equal(m.waterIsDdpmOnly({basis:' '+O+' '}),true);assert.equal(m.waterIsDdpmOnly({basis:null}),false);assert.equal(m.waterIsDdpmOnly(null),false);
  assert.equal(m.waterDdpmDistricts(mix,3),3);                                  // districts the DDPM reports on >= 3 days in a row
}

// Missing or unusable BMA comparisons must never inflate the steady count.
{
 const row={station_id:'bkk',observed_at_th:loaded,water_in_m_msl:0,flood_status_source:'ปกติ'};
 for(const [label,expected] of [['เพิ่ม','up'],['คงตัว','steady'],['ลด','down'],['ข้อมูลไม่เพียงพอ',null],['',null],[null,null],['toString',null]])assert.equal(m.bkkTrend({...row,water_status_vs_24h_avg:label},loaded),expected);
 for(const extra of [{observed_at_th:'2026-10-03T11:59:00+07:00'},{observed_at_th:null},{observed_at_th:'2026-10-04T12:01:00+07:00'},{flood_status_source:'ขัดข้อง'},{water_in_m_msl:null},{water_in_m_msl:-99}])assert.equal(m.bkkTrend({...row,water_status_vs_24h_avg:'เพิ่ม',...extra},loaded),null);
 assert.equal(m.bkkTrend({...row,water_in_m_msl:-0.3,water_status_vs_24h_avg:'ลด'},loaded),'down');
}

{
 const row={station_id:'bkk',observed_at_th:loaded,water_in_m_msl:0,flood_status_source:'ปกติ'};
 const rows=labels=>labels.map(water_status_vs_24h_avg=>({...row,water_status_vs_24h_avg}));
 for(const [labels,kind] of [[['เพิ่ม','เพิ่ม','ลด'],'up'],[['คงตัว','คงตัว','เพิ่ม'],'steady'],[['ลด'],'down'],[['เพิ่ม','ลด'],'mixed'],[['เพิ่ม','คงตัว','ลด'],'mixed'],[[],'unknown'],[['ข้อมูลไม่เพียงพอ'],'unknown']])assert.equal(m.bkkDistrictTrend(rows(labels),loaded).kind,kind);
 const result=m.bkkDistrictTrend([...rows(['ลด']),{...row,water_status_vs_24h_avg:'เพิ่ม',observed_at_th:'2026-10-01T12:00:00+07:00'}],loaded);
 assert.equal(result.kind,'down');assert.equal(result.unknown,1);assert.deepEqual(result.counts,{up:0,steady:0,down:1});
}

// Count official districts once each, irrespective of the number of their stations.
{
 const r={station_id:'x',observed_at_th:loaded,water_in_m_msl:0,flood_status_source:'ปกติ'};
 const rows=[...Array.from({length:10},()=>({...r,district_or_area:'เขตบางรัก',water_status_vs_24h_avg:'เพิ่ม'})),{...r,district_or_area:'บางแค',water_status_vs_24h_avg:'ลด'},{...r,district_or_area:'นอก กทม.',water_status_vs_24h_avg:'เพิ่ม'}];
 const result=m.bkkTrendDistricts(rows,['บางรัก','บางแค','พระนคร'],loaded);
 assert.equal(result.length,3);assert.deepEqual(result.map(r=>r.kind),['up','down','unknown']);assert.equal(result.filter(r=>r.kind==='up').length,1);
 const filtered=m.bkkTrendDistricts(rows,['บางแค'],loaded);assert.deepEqual(filtered.map(r=>r.kind),['down']);
}

console.log('PASS: data model, waterlogging and BKK district trends');
