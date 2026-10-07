/* Shared, pure data rules used by the dashboard and deterministic tests. */
(function(root){
  const SOURCES={Disaster_DB:'disasters',Vulnerable_group:'vulnerable',thai_water_DB:'stations',BKK_water_DB:'bkkStations',shelter_DB:'shelters'};
  const WATER_STATUS={ล้นตลิ่ง:{rank:5,color:'#991b1b'},วิกฤต:{rank:4,color:'#dc2626'},เตือนภัย:{rank:3,color:'#f97316'},เฝ้าระวัง:{rank:2,color:'#facc15'},ปกติ:{rank:1,color:'#22c55e'}};
  const canonicalWaterStatus=value=>String(value??'').trim()==='วิกฤติ'?'วิกฤต':String(value??'').trim();
  function timestamp(v){if(!v)return NaN;let t=String(v).trim().replace(' ','T');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t))return NaN;if(!/(Z|[+-]\d{2}:?\d{2})$/i.test(t))t+='+07:00';return Date.parse(t)}
  function sum(rows,key){const values=rows.map(r=>r[key]).filter(Number.isFinite);return values.length?values.reduce((a,b)=>a+b,0):null}
  function quality(row,loadedAt){const measured=row.station_id!=null?row.observed_at_th:row.shelter_id!=null?row.fetched_at_th:null;const age=(timestamp(loadedAt)-timestamp(measured))/60000;return !Number.isFinite(age)?'ไม่ทราบเวลาข้อมูล':age<0?'เวลาอนาคต':age<=1440?'ภายใน 24 ชั่วโมง':'ข้อมูลเก่าเกิน 24 ชั่วโมง'}
  function householdBorderColor(n){return !Number.isFinite(n)||n<1?'#94a3b8':n>=100000?'#dc2626':n>=10000?'#f97316':n>=1000?'#facc15':'#22c55e'}
  function validCoordinates(r){return Number.isFinite(r.latitude)&&Number.isFinite(r.longitude)&&Math.abs(r.latitude)<=90&&Math.abs(r.longitude)<=180}
  function districtSummary(rows,getQuality){const fresh=rows.filter(r=>getQuality(r)==='ภายใน 24 ชั่วโมง');let status=null,rank=0;for(const r of fresh){const s=canonicalWaterStatus(r.flood_status_source);if((WATER_STATUS[s]?.rank||0)>rank){status=s;rank=WATER_STATUS[s].rank}}return {status,drivers:fresh.filter(r=>status&&canonicalWaterStatus(r.flood_status_source)===status),color:status?WATER_STATUS[status].color:rows.length?'#94a3b8':'transparent',label:status||(!rows.length?'ไม่มีสถานีในข้อมูล':!fresh.length?'ไม่มีข้อมูลล่าสุดภายใน 24 ชั่วโมง':'ไม่มีสถานะระดับน้ำที่ใช้ได้')}}
  function latestStationDay(rows,loadedAt){
    const cutoff=timestamp(loadedAt);
    const valid=rows.map(row=>({row,t:timestamp(row.observed_at_th)})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(cutoff)&&x.t<=cutoff);
    const dayOf=t=>new Date(t+7*3600000).toISOString().slice(0,10);
    const day=valid.reduce((latest,x)=>dayOf(x.t)>latest?dayOf(x.t):latest,'');
    const stations=new Map();
    for(const x of valid){if(dayOf(x.t)!==day)continue;const key=x.row.station_id||[x.row.station_name,x.row.district_or_area,x.row.latitude,x.row.longitude].join('|');if(!stations.has(key)||x.t>stations.get(key).t)stations.set(key,x)}
    return {day,rows:Array.from(stations.values(),x=>x.row)};
  }
  // ── News tab (news.json from news/news_scraper.py) ──
  const URGENCY={critical:{label:'เร่งด่วน',rank:3},warning:{label:'เฝ้าระวัง',rank:2},recovery:{label:'ฟื้นฟู',rank:1}};
  const NEWS_CATEGORIES={monitoring:'เฝ้าระวัง/ระดับน้ำ',relief:'ช่วยเหลือ',post_flood:'หลังน้ำท่วม',location:'สถานที่',general:'ทั่วไป'};
  function safeUrl(u){try{const x=new URL(String(u||''));return x.protocol==='https:'||x.protocol==='http:'?x.href:''}catch(e){return ''}}
  function newsArticles(articles,f){const q=String(f.query||'').trim().toLowerCase();return (articles||[]).filter(a=>(!f.urgency||a.urgency===f.urgency)&&(!f.province||a.province===f.province)&&(!q||String(a.title||'').toLowerCase().includes(q)||String(a.source||'').toLowerCase().includes(q)))}
  function newsProvinces(articles){const c=new Map();for(const a of articles||[])c.set(a.province,(c.get(a.province)||0)+1);return Array.from(c,([province,count])=>({province,count})).sort((a,b)=>b.count-a.count||a.province.localeCompare(b.province,'th'))}
  function newsUrgencyCounts(articles){const c={critical:0,warning:0,recovery:0};for(const a of articles||[])if(a.urgency in c)c[a.urgency]++;return c}
  function newsWords(doc,lang,category,limit){const freq=doc?.word_freq?.[lang]||{},tfidf=doc?.tfidf_scores?.[lang]||{},cats=doc?.word_categories||{};const rows=Object.keys(freq).map(word=>({word,count:freq[word],tfidf:tfidf[word]??null,category:lang==='th'?(cats[word]||'general'):'general'})).filter(r=>!category||r.category===category).sort((a,b)=>(b.tfidf??0)-(a.tfidf??0)||b.count-a.count);return limit>0?rows.slice(0,limit):rows}
  function ageLabel(hours){if(!Number.isFinite(hours))return 'ไม่ระบุเวลา';if(hours<1)return Math.max(1,Math.round(hours*60))+' นาทีที่แล้ว';if(hours<48)return Math.round(hours)+' ชั่วโมงที่แล้ว';return Math.round(hours/24)+' วันที่แล้ว'}
  const model={newsArticles,newsProvinces,newsUrgencyCounts,newsWords,ageLabel,safeUrl,URGENCY,NEWS_CATEGORIES,latestStationDay,SOURCES,WATER_STATUS,canonicalWaterStatus,timestamp,sum,quality,householdBorderColor,validCoordinates,districtSummary};
  if(typeof module!=='undefined')module.exports=model;else root.DashboardModel=model;
})(typeof window!=='undefined'?window:globalThis);
