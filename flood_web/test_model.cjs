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
}
console.log('PASS: household boundaries, freshness, missing/zero totals, district severity, coordinates, news filters');
