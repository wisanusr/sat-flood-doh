function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('เฝ้าระวังน้ำ | กรมอนามัย')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function include_(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

function normalize_(key, value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ssXXX");
  if (typeof value === 'string') value = value.trim();
  if (value === '' || value == null) return null;
  if (CONFIG.numeric.includes(key)) {
    const n = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  if (CONFIG.dates.includes(key)) {
    let s=String(value), m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    const pad=v=>String(v||0).padStart(2,'0');
    if(m) s=`${Number(m[3])>2500?Number(m[3])-543:m[3]}-${pad(m[2])}-${pad(m[1])}T${pad(m[4])}:${pad(m[5])}:${pad(m[6])}+07:00`;
    else {
      s=s.replace(' ','T').replace(/T(\d):/,'T0$1:');
      if(/^\d{4}-\d{2}-\d{2}$/.test(s)) s+='T00:00:00';
      if(/T\d{2}:\d{2}$/.test(s)) s+=':00';
      if(/T\d{2}:\d{2}:\d{2}$/.test(s)) s+='+07:00';
    }
    if(!Number.isFinite(Date.parse(s))) throw new Error('รูปแบบวันที่ไม่ถูกต้อง: '+key);
    return s;
  }
  return value;
}
function readRows_(ss, name) {
  const sheet=ss.getSheetByName(name);
  if(!sheet) throw new Error('ไม่พบชีต '+name);
  const values=sheet.getDataRange().getValues(), headers=values[0].map(v=>String(v).trim());
  if(CONFIG.required[name].some(k=>!headers.includes(k))) throw new Error('หัวคอลัมน์ไม่ครบ: '+name);
  return values.slice(1).filter(row=>row.some(v=>v!=='' && v!=null)).map(row=>{
    const out={}; headers.forEach((key,i)=>{if(key) out[key]=normalize_(key,row[i]);}); return out;
  });
}
function pick_(row, fields) { const out={};fields.split(' ').forEach(k=>out[k]=row[k]??null);return out; }
function transform_(name, rows) {
  if(name==='Disaster_DB') return rows.map(r=>{
    if(!r.Report_Date||!r.Province) throw new Error('รายงานขาดวันที่หรือจังหวัด');
    return pick_(r,'Record_ID Report_Date Ingested_At Update_Time Region Province Disaster_Type Affected_Districts_Count District_Names Affected_Subdistricts_Count Affected_Villages_Count Affected_Households Casualties_Deaths Water_Level_Trend Current_Status Remarks Source_URL');
  });
  if(name==='Vulnerable_group') return rows.filter(r=>r['จังหวัด']).map(r=>({province:r['จังหวัด'],region:r['เขตสุขภาพ'],children:r[CONFIG.required[name][2]],pregnant:r[CONFIG.required[name][3]],elderly:r[CONFIG.required[name][4]]}));
  if(name==='shelter_DB') return rows.map(r=>pick_(r,'shelter_id district shelter_name capacity occupied available status_source latitude longitude updated_at_source fetched_at_th source_url map_url'));
  return rows.map(r=>{
    const out=pick_(r,'station_id station_name district_or_area latitude longitude observed_at_th water_in_m_msl warning_in_source critical_in_source flood_status_source age_minutes_at_fetch fetched_at_th source_url');
    if(name==='BKK_water_DB') {
      let payload={};try{payload=JSON.parse(r.raw_station_json||'{}')||{};}catch(e){}
      const district=String(r.district_or_area||payload.district_name||'').replace(/^เขต/,'').trim();
      out.district_or_area=district;
      out.province=payload.geocode?.province_name?.th||(CONFIG.districts.includes(district)?'กรุงเทพมหานคร':null);
    } else out.province=r.district_or_area;
    return out;
  });
}
// Per-sheet result cache (5 min). Values over 100 KB are split into chunks; only successful reads are cached,
// so a failed sheet is retried on the next request. Any cache problem falls back to reading the sheet.
const CACHE_SECONDS=300, CACHE_CHUNK=30000, CACHE_PREFIX='dash1_';
function cacheGet_(key) {
  if(typeof CacheService==='undefined') return null;
  try {
    const cache=CacheService.getScriptCache(), count=Number(cache.get(key));
    if(!(count>0)) return null;
    const keys=[]; for(let i=0;i<count;i++) keys.push(key+'_'+i);
    const parts=cache.getAll(keys), text=keys.map(k=>parts[k]);
    return text.some(t=>t==null)?null:JSON.parse(text.join(''));
  } catch(e) { return null; }
}
function cachePut_(key, value) {
  if(typeof CacheService==='undefined') return;
  try {
    const text=JSON.stringify(value), items={}; let count=0;
    for(let i=0;i<text.length;i+=CACHE_CHUNK) items[key+'_'+(count++)]=text.slice(i,i+CACHE_CHUNK);
    items[key]=String(count);
    CacheService.getScriptCache().putAll(items,CACHE_SECONDS);
  } catch(e) { console.warn('cache '+key+': '+e.message); }
}
// refresh=true (the "รีเฟรชข้อมูล" button) skips the cache and re-reads the sheets, but a sheet read in the last
// REFRESH_COOLDOWN_SECONDS is reused so repeated clicks cannot exhaust the Sheets quota.
const REFRESH_COOLDOWN_SECONDS=30;
function getDashboardData(source, refresh) {
  const mapping={Disaster_DB:'disasters',Vulnerable_group:'vulnerable',thai_water_DB:'stations',BKK_water_DB:'bkkStations',shelter_DB:'shelters'};
  if(source && !Object.prototype.hasOwnProperty.call(mapping,source)) throw new Error('แหล่งข้อมูลไม่ถูกต้อง');
  let ss=null;
  const getSs=()=>ss||(ss=SpreadsheetApp.openById(CONFIG.spreadsheetId));
  const result={source:'รายงานสถานการณ์สาธารณภัยรายจังหวัด — Google Sheets',sourceType:'google_sheets',sourceUrl:'https://docs.google.com/spreadsheets/d/'+CONFIG.spreadsheetId+'/edit',loadedAt:new Date().toISOString(),sourceStatus:{},disasters:[],vulnerable:[],stations:[],bkkStations:[],shelters:[]};
  (source?[source]:Object.keys(mapping)).forEach(name=>{
    const cached=cacheGet_(CACHE_PREFIX+name);
    const cachedAge=cached?(Date.now()-Date.parse(cached.status.loadedAt))/1000:Infinity;
    if(cached && (!refresh || cachedAge<REFRESH_COOLDOWN_SECONDS)){ result[mapping[name]]=cached.rows; result.sourceStatus[name]=cached.status; return; }
    try{
      result[mapping[name]]=transform_(name,readRows_(getSs(),name));
      result.sourceStatus[name]={status:'ok',loadedAt:new Date().toISOString(),message:null};
      cachePut_(CACHE_PREFIX+name,{rows:result[mapping[name]],status:result.sourceStatus[name]});
    }catch(e){
      console.error(name+': '+e.message);
      result.sourceStatus[name]={status:'error',loadedAt:null,message:'อ่านชีต '+name+' ไม่สำเร็จ ตรวจชื่อชีต หัวคอลัมน์ และรูปแบบข้อมูล'};
    }
  });
  return result;
}
