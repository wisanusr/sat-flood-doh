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
evaluate(`SpreadsheetApp={openById:()=>({getSheetByName:name=>({getDataRange:()=>({getValues:()=>[CONFIG.required[name]]})})})}`);
let data=evaluate('getDashboardData()');
assert.equal(Object.keys(data.sourceStatus).length,5);
assert(Object.values(data.sourceStatus).every(s=>s.status==='ok'));
evaluate(`SpreadsheetApp={openById:()=>({getSheetByName:name=>name==='shelter_DB'?null:({getDataRange:()=>({getValues:()=>[CONFIG.required[name]]})})})}`);
data=evaluate('getDashboardData()');
assert.equal(data.sourceStatus.shelter_DB.status,'error');
assert.equal(data.sourceStatus.Disaster_DB.status,'ok');
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
