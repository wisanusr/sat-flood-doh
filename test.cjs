const fs=require('fs'),vm=require('vm'),assert=require('assert');
const dir=__dirname;
const read=n=>fs.readFileSync(dir+'/'+n,'utf8');
for(const name of ['Dashboard','DataModel'])new vm.Script(read(name+'.html').replace(/^<script>\s*/,'').replace(/\s*<\/script>$/,''));
const ctx=vm.createContext({console, Date, Utilities:{formatDate:()=> '2026-10-05T00:00:00+07:00'}});
vm.runInContext(read('Config.gs')+'\n'+read('Code.gs'),ctx);
const evaluate=s=>vm.runInContext(s,ctx);
assert.equal(evaluate("normalize_('Affected_Households','1,234')"),1234);
assert.equal(evaluate("normalize_('capacity','')"),null);
assert.equal(evaluate("normalize_('Report_Date','05/10/2569')"),'2026-10-05T00:00:00+07:00');
assert.equal(evaluate("transform_('BKK_water_DB',[{district_or_area:'เขตบางรัก'}])[0].province"),'กรุงเทพมหานคร');
// flood-prep tabs: typed output, rows without a province dropped, never confused with the station tabs
assert.deepEqual(evaluate("CONFIG.optional"),['flood_2p2r_province','flood_risk','flood_waterlogged','flood_waterlogged_district','flood_wl_critical']);
{
  const risk=evaluate("transform_('flood_risk',[{run_at:'2026-10-07T15:04:00+07:00',province:'ระนอง',risk_level:'สูง',forecast_total_mm:224.6,in_active_cap:'True'},{province:'',risk_level:'สูง'}])");
  assert.equal(risk[0].forecast_daily_mm,null);assert.equal(evaluate("transform_('flood_risk',[{province:'ก',forecast_start:'2026-10-07T00:00:00+07:00',forecast_daily_mm:'1.9|19.3||69.6',cap_headlines:'x',tmd_warning_title:'t',tmd_warning_text:'b',forecast_fetched_at:'2026-10-07T15:03:00+07:00'}])[0].forecast_daily_mm"),'1.9|19.3||69.6');
  assert.equal(evaluate("transform_('flood_risk',[{province:'ก',cap_headlines:'x',tmd_warning_title:'t'}])[0].tmd_warning_title"),'t');
  assert.equal(evaluate("transform_('flood_wl_critical',[{province:'ก',amphoe:'ลาดพร้าว',basin_name:'บ'}])[0].amphoe"),'ลาดพร้าว');
  assert.equal(evaluate("normalize_('forecast_start','2026-10-07')"),'2026-10-07T00:00:00+07:00');
  assert.equal(risk.length,1);assert.equal(risk[0].province,'ระนอง');assert.equal(risk[0].in_active_cap,'True');assert.equal(risk[0].wl_level5,null);
  const crit=evaluate("transform_('flood_wl_critical',[{province:'กรุงเทพมหานคร',station_name:'x',situation_level:5,latitude:13.9,longitude:100.6}])");
  assert.equal(crit.length,1);assert.equal(crit[0].latitude,13.9);assert.equal(crit[0].province_code,null);
  assert.equal(evaluate("normalize_('run_at','2026-10-07 15:04')"),'2026-10-07T15:04:00+07:00');
  assert.equal(evaluate("normalize_('rain_24h_max_mm','119.5')"),119.5);
  assert.equal(evaluate("normalize_('situation_level','5')"),5);
}
// waterlogging tab: sheet text in, typed rows out (blank stays null, never 0; bad numbers become null; codes stay text)
{
  const sheetOf=(name,rows)=>{const h=evaluate('CONFIG.required.'+name);return [h].concat(rows.map(o=>h.map(k=>o[k]??'')))};
  const give=(name,rows)=>evaluate(`SpreadsheetApp={openById:()=>({getSheetByName:n=>({getDataRange:()=>({getValues:()=>n==='${name}'?${JSON.stringify(sheetOf(name,rows))}:[CONFIG.required[n]]})})})}`);
  give('flood_waterlogged',[{run_at:'2026-10-09 07:30',status:'น้ำขัง',confidence:'สูง',province_code:'18',province:'ชัยนาท',district_code:'1801',district:'เมืองชัยนาท',subdistrict:'บ้านกล้วย',tb_idn:'180101',run_span_days:'3.5',run_start:'2026-10-06 18:23',run_end:'2026-10-09',image_age_hours:'',detections:'x',latest_area_km2:'1,234.5',in_ddpm:'ใช่',ddpm_days:'4',ddpm_report_date:'09/10/2569',latitude:'15.2',longitude:'',reasons:'a;b'},{status:'น้ำขัง',province:''},{province:'ก',status:''}]);
  let r=evaluate("getDashboardData('flood_waterlogged')");
  assert.equal(r.sourceStatus.flood_waterlogged.status,'ok');
  const w=r.floodWaterlogged;
  assert.equal(w.length,1);
  assert.equal(w[0].run_span_days,3.5);assert.equal(w[0].latest_area_km2,1234.5);assert.equal(w[0].ddpm_days,4);assert.equal(w[0].latitude,15.2);
  assert.equal(w[0].image_age_hours,null);assert.equal(w[0].longitude,null);assert.equal(w[0].detections,null);   // blank / malformed -> null, not 0
  assert.equal(w[0].tb_idn,'180101');assert.equal(w[0].province_code,'18');assert.equal(w[0].reasons,'a;b');
  assert.equal(w[0].run_at,'2026-10-09T07:30:00+07:00');assert.equal(w[0].run_start,'2026-10-06T18:23:00+07:00');assert.equal(w[0].run_end,'2026-10-09T00:00:00+07:00');assert.equal(w[0].ddpm_report_date,'2026-10-09T00:00:00+07:00');
  assert.deepEqual(Object.keys(w[0]),evaluate("CONFIG.required.flood_waterlogged"));
  give('flood_waterlogged_district',[{run_at:'2026-10-09 07:30',province:'ชัยนาท',district_code:'1801',district:'เมืองชัยนาท',waterlogged_tambons:'2',confirmed_tambons:'',total_tambons:'8',latest_area_km2:'0.5',max_run_days:'5',in_ddpm:'ใช่',ddpm_days:'3',basis:'ภาพดาวเทียม + ปภ.'},{run_at:'2026-10-09 07:30',province:'กาญจนบุรี',district_code:'7111',district:'ด่านมะขามเตี้ย',in_ddpm:'ใช่',ddpm_days:'12',basis:'ปภ. (ไม่มีภาพดาวเทียม)'},{province:'ชัยนาท',district:''}]);
  r=evaluate("getDashboardData('flood_waterlogged_district')");
  const dd=r.floodWaterloggedDistrict;
  assert.equal(dd.length,2);assert.equal(dd[0].basis,'ภาพดาวเทียม + ปภ.');assert.equal(dd[0].waterlogged_tambons,2);
  // DDPM-only district: every count / area column is null (blank cell), never 0; ddpm_days survives
  for(const k of ['waterlogged_tambons','confirmed_tambons','watch_tambons','new_tambons','nodata_tambons','stale_tambons','total_tambons','latest_area_km2','max_run_days'])assert.equal(dd[1][k],null,k);
  assert.equal(dd[1].ddpm_days,12);assert.equal(dd[1].basis,'ปภ. (ไม่มีภาพดาวเทียม)');assert.equal(dd[0].confirmed_tambons,null);assert.equal(dd[0].max_run_days,5);
  assert.deepEqual(Object.keys(dd[0]),evaluate("CONFIG.required.flood_waterlogged_district"));
  // 2P2R province colours: all 5 levels, blank max_ddpm_days stays null (never 0), codes stay text, rows without province / level dropped
  give('flood_2p2r_province',[{run_at:'2026-10-12 16:00',province_code:'14',province:'พระนครศรีอยุธยา',level_code:'red',level:'แดง',phase:'Response',plan:'p',red_districts:'13',orange_districts:'2',yellow_districts:'1',green_districts:'0',waterlogged_tambons:'117',max_ddpm_days:'12',reasons:'r'},
    {province_code:'22',province:'จันทบุรี',level_code:'green',level:'เขียว',phase:'Recovery',green_districts:'2',waterlogged_tambons:'0',max_ddpm_days:''},
    {province_code:'30',province:'นครราชสีมา',level_code:'normal',level:'ปกติ'},{province_code:'31',province:'x',level_code:'orange'},{province_code:'32',province:'y',level_code:'yellow'},{province:'',level_code:'red'},{province:'z',level_code:''}]);
  r=evaluate("getDashboardData('flood_2p2r_province')");
  assert.equal(r.sourceStatus.flood_2p2r_province.status,'ok');
  const pv=r.flood2p2r;assert.equal(pv.length,5);
  assert.deepEqual(pv.map(x=>x.level_code),['red','green','normal','orange','yellow']);
  assert.equal(pv[0].province_code,'14');assert.equal(pv[0].red_districts,13);assert.equal(pv[0].waterlogged_tambons,117);assert.equal(pv[0].max_ddpm_days,12);
  assert.equal(pv[1].max_ddpm_days,null);assert.equal(pv[2].red_districts,null);   // blank -> null, not 0
  assert.deepEqual(Object.keys(pv[0]),evaluate("CONFIG.required.flood_2p2r_province"));
  assert.equal(evaluate("CONFIG.required.flood_2p2r_province.length"),14);
  // a bad date fails that tab only (the other tabs keep their data)
  give('flood_waterlogged',[{status:'น้ำขัง',province:'ก',run_at:'not a date'}]);
  assert.equal(evaluate("getDashboardData('flood_waterlogged')").sourceStatus.flood_waterlogged.status,'error');
}
evaluate(`SpreadsheetApp={openById:()=>({getSheetByName:name=>({getDataRange:()=>({getValues:()=>[CONFIG.required[name]]})})})}`);
let data=evaluate('getDashboardData()');
assert.equal(Object.keys(data.sourceStatus).length,10);
assert(Object.values(data.sourceStatus).every(s=>s.status==='ok'));
evaluate(`SpreadsheetApp={openById:()=>({getSheetByName:name=>name==='shelter_DB'?null:({getDataRange:()=>({getValues:()=>[CONFIG.required[name]]})})})}`);
data=evaluate('getDashboardData()');
assert.equal(data.sourceStatus.shelter_DB.status,'error');
assert.equal(data.sourceStatus.Disaster_DB.status,'ok');
// waterlogging tabs: a missing tab, a wrong header row and an empty tab each fail that tab only
evaluate(`SpreadsheetApp={openById:()=>({getSheetByName:name=>name==='flood_waterlogged'?null:name==='flood_waterlogged_district'?({getDataRange:()=>({getValues:()=>[['wrong','header']]})}):({getDataRange:()=>({getValues:()=>[CONFIG.required[name]]})})})}`);
data=evaluate('getDashboardData()');
assert.equal(data.sourceStatus.flood_waterlogged.status,'error');assert.equal(data.sourceStatus.flood_waterlogged_district.status,'error');assert.equal(data.sourceStatus.flood_2p2r_province.status,'ok');
assert.deepEqual([data.floodWaterlogged,data.floodWaterloggedDistrict],[[],[]]);
assert.equal(data.sourceStatus.Disaster_DB.status,'ok');assert.equal(data.sourceStatus.flood_risk.status,'ok');
evaluate(`SpreadsheetApp={openById:()=>({getSheetByName:name=>name==='flood_waterlogged'?({getDataRange:()=>({getValues:()=>[]})}):({getDataRange:()=>({getValues:()=>[CONFIG.required[name]]})})})}`);
assert.equal(evaluate("getDashboardData('flood_waterlogged')").sourceStatus.flood_waterlogged.status,'error');
data=evaluate("getDashboardData('thai_water_DB')");assert.equal(Object.keys(data.sourceStatus).length,1);
assert.throws(()=>evaluate("getDashboardData('invalid')"));
// 5-minute cache: second call must not touch the spreadsheet; big values must respect the 100 KB limit; failures are not cached.
{
  const store=new Map();let opens=0;
  ctx.CacheService={getScriptCache:()=>({
    get:k=>store.has(k)?store.get(k):null,
    getAll:ks=>Object.fromEntries(ks.filter(k=>store.has(k)).map(k=>[k,store.get(k)])),
    putAll:(items,ttl)=>{assert.equal(ttl,300);for(const [k,v] of Object.entries(items)){assert(Buffer.byteLength(v)<100*1024,'cache value over 100KB');store.set(k,v)}}
  })};
  const req=evaluate('CONFIG.required.shelter_DB');
  const bigRows=Array.from({length:3000},(_,i)=>req.map((h,j)=>j===2?'ศูนย์พักพิงทดสอบ'+i:'ก'.repeat(10)));
  evaluate(`SpreadsheetApp={openById:()=>{globalThis.__opens=(globalThis.__opens||0)+1;return {getSheetByName:name=>({getDataRange:()=>({getValues:()=>[CONFIG.required[name]].concat(name==='shelter_DB'?${JSON.stringify(bigRows)}:[])})})}}}`);
  const first=evaluate("getDashboardData('shelter_DB')");
  assert.equal(first.sourceStatus.shelter_DB.status,'ok');assert.equal(first.shelters.length,3000);
  assert(store.size>2,'expected chunked cache entries');
  const opensAfterFirst=evaluate('globalThis.__opens');
  const second=evaluate("getDashboardData('shelter_DB')");
  assert.equal(evaluate('globalThis.__opens'),opensAfterFirst,'cached call must not open the spreadsheet');
  assert.deepEqual(second.shelters,first.shelters);assert.equal(second.sourceStatus.shelter_DB.loadedAt,first.sourceStatus.shelter_DB.loadedAt);
  // Refresh button: reuses a read newer than the 30 s cooldown, re-reads (and re-caches) an older one.
  evaluate("getDashboardData('shelter_DB',true)");
  assert.equal(evaluate('globalThis.__opens'),opensAfterFirst,'refresh inside cooldown must reuse the cache');
  evaluate("(()=>{const c=cacheGet_(CACHE_PREFIX+'shelter_DB');c.status.loadedAt=new Date(Date.now()-120000).toISOString();cachePut_(CACHE_PREFIX+'shelter_DB',c)})()");
  const refreshed=evaluate("getDashboardData('shelter_DB',true)");
  assert.equal(evaluate('globalThis.__opens'),opensAfterFirst+1,'refresh after cooldown must re-read the sheet');
  assert(Date.now()-Date.parse(refreshed.sourceStatus.shelter_DB.loadedAt)<5000,'refreshed read time should be new');
  evaluate("getDashboardData('shelter_DB')");
  assert.equal(evaluate('globalThis.__opens'),opensAfterFirst+1,'normal load after refresh must use the new cache');
  store.clear();
  evaluate(`SpreadsheetApp={openById:()=>({getSheetByName:()=>null})}`);
  assert.equal(evaluate("getDashboardData('shelter_DB')").sourceStatus.shelter_DB.status,'error');assert.equal(store.size,0);
  delete ctx.CacheService;
}
assert(!read('Dashboard.html').includes("fetch('/"));
assert(!read('Index.html').includes('src="/'));
JSON.stringify(data);
console.log('PASS: syntax, normalization, mapping, partial failure, retry, bundled paths');
