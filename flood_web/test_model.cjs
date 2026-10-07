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
console.log('PASS: household boundaries, freshness, missing/zero totals, district severity, coordinates, news filters');
