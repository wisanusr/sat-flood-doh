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
  // Google Trends "rising" growth is "+3650%" or "Breakout"; Breakout is the largest.
  function growthValue(g){const s=String(g??'').trim();if(/^breakout$/i.test(s))return Infinity;const n=Number(s.replace(/[^\d.]/g,''));return s!==''&&Number.isFinite(n)?n:-1}
  function newsRising(trends){const best=new Map();for(const q of trends?.rising_queries||[]){const k=String(q.query||'').trim();if(!k)continue;const v=growthValue(q.growth);if(!best.has(k)||v>best.get(k).value)best.set(k,{query:k,growth:String(q.growth??''),value:v})}return Array.from(best.values()).sort((a,b)=>b.value-a.value||a.query.localeCompare(b.query,'th')).map(({query,growth})=>({query,growth}))}
  function newsTopRegions(trends,n){const rows=(trends?.interest_by_region||[]).filter(r=>Number.isFinite(r.score)).slice().sort((a,b)=>b.score-a.score||String(a.region).localeCompare(String(b.region),'th'));return n>0?rows.slice(0,n):rows}
  function newsTopByCount(words,n){const rows=(words||[]).slice().sort((a,b)=>b.count-a.count||(b.tfidf??0)-(a.tfidf??0)||String(a.word).localeCompare(String(b.word),'th'));return n>0?rows.slice(0,n):rows}
  function sourceInitial(name){const m=String(name??'').match(/[\p{L}\p{N}]/u);return m?m[0].toUpperCase():'?'}
  // ── Google Trends timeline (hourly points written by news/trends_scraper.py; values are Google's 0-100 scale) ──
  const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  function trendLevel(v){return !Number.isFinite(v)?null:v>=60?'สูง':v>=30?'ปานกลาง':'ต่ำ'}
  // Daily average per term. A day keeps its own hours only, so the first and last day may be partial.
  function timelineDaily(tl){
    if(!tl||!Array.isArray(tl.points)||!Array.isArray(tl.terms))return [];
    const days=new Map();
    for(const p of tl.points){const d=String(p.t).slice(0,10);if(!days.has(d))days.set(d,tl.terms.map(()=>[]));p.v.forEach((v,i)=>{if(Number.isFinite(v))days.get(d)[i].push(v)})}
    return Array.from(days,([date,cols])=>({date,hours:Math.max(0,...cols.map(c=>c.length)),values:cols.map(c=>{const m=mean(c);return m==null?null:Math.round(m*10)/10})})).sort((a,b)=>a.date<b.date?-1:1);
  }
  // Interest in the last 24 hourly points per term, and the change against the 24 points before them.
  function termWindows(tl){
    if(!tl||!Array.isArray(tl.points)||tl.points.length<24)return null;
    const pts=tl.points,cur=pts.slice(-24),prev=pts.slice(-48,-24);
    return tl.terms.map((term,i)=>{
      const c=mean(cur.map(p=>p.v[i]).filter(Number.isFinite)),q=prev.length===24?mean(prev.map(p=>p.v[i]).filter(Number.isFinite)):null;
      return {term,index:c==null?null:Math.round(c),previous:q==null?null:Math.round(q),change:q>0&&c!=null?Math.round((c-q)/q*100):null};
    });
  }
  // Phase index = mean of its terms' 24 h index; the leading phase is the one with the highest index.
  function lifecycle(trends){
    const tl=trends&&trends.timeline,win=termWindows(tl),phases=(trends&&trends.phases)||[];
    if(!win||!phases.length)return null;
    const byTerm=new Map(win.map(w=>[w.term,w]));
    const out=phases.map(ph=>{
      const terms=(ph.terms||[]).map(t=>byTerm.get(t)).filter(Boolean),idx=terms.map(t=>t.index).filter(Number.isFinite);
      const index=idx.length?Math.round(mean(idx)):null;
      return {key:ph.key,label:ph.label,categories:ph.categories||[],terms,index,level:trendLevel(index)};
    });
    const best=out.filter(p=>p.index!=null).sort((a,b)=>b.index-a.index)[0];
    return {phases:out,leading:best?best.key:null};
  }
  // ── Situation summary: group the day's DDPM reports by water-level trend and fresh critical stations ──
  const trendOf=v=>String(v??'').replace(/^ระดับน้ำ/,'').trim();
  // critical = water rising and at least one fresh critical/overflow station; high = rising without one, or steady;
  // stabilizing = falling; unknown = no usable trend.
  function provinceLevel(trend,criticalStations){const t=trendOf(trend);if(t==='เพิ่มขึ้น')return criticalStations>0?'critical':'high';if(t==='ทรงตัว')return 'high';if(t==='ลดลง')return 'stabilizing';return 'unknown'}
  // Water-level trend of a DDPM report as a map category: up / steady / down (null when the report has none).
  function trendKind(v){const t=trendOf(v);return t==='เพิ่มขึ้น'?'up':t==='ทรงตัว'?'steady':t==='ลดลง'?'down':null}
  // Vulnerable-population totals (province-level baseline rows {province, elderly, pregnant, children}) for the whole
  // selection and for the provinces that have a flood report; share = affected / all, null when it cannot be computed.
  function vulnerableTotals(rows,affected){
    const keys=['elderly','pregnant','children'],inAffected=r=>affected.has(r.province),hit=(rows||[]).filter(inAffected);
    const tot=list=>Object.fromEntries(keys.map(k=>[k,sum(list,k)]));
    const all=tot(rows||[]),aff=tot(hit);
    return {all,affected:aff,share:Object.fromEntries(keys.map(k=>[k,all[k]>0&&aff[k]!=null?aff[k]/all[k]*100:null])),provinces:new Set((rows||[]).map(r=>r.province)).size,affectedProvinces:new Set(hit.map(r=>r.province)).size};
  }
  const regionNumber=label=>{const m=String(label??'').match(/\d+/);return m?Number(m[0]):null};
  function situationGroups(reports,regionOf,criticalOf){
    const out={critical:new Map(),high:new Map(),stabilizing:new Map(),unknown:new Map()};
    for(const r of reports||[]){
      const m=out[provinceLevel(r.Water_Level_Trend,criticalOf(r.Province)||0)],region=regionOf(r.Province)||'ไม่ทราบเขต';
      if(!m.has(region))m.set(region,[]);
      m.get(region).push({province:r.Province,households:Number.isFinite(r.Affected_Households)?r.Affected_Households:null});
    }
    const res={};
    for(const [level,m] of Object.entries(out))res[level]=Array.from(m,([region,items])=>({region,number:regionNumber(region),items:items.sort((a,b)=>(b.households??-1)-(a.households??-1)||a.province.localeCompare(b.province,'th'))})).sort((a,b)=>(a.number??999)-(b.number??999)||a.region.localeCompare(b.region,'th'));
    return res;
  }
  const model={vulnerableTotals,trendKind,provinceLevel,situationGroups,regionNumber,timelineDaily,termWindows,lifecycle,trendLevel,newsRising,newsTopRegions,newsTopByCount,sourceInitial,growthValue,newsArticles,newsProvinces,newsUrgencyCounts,newsWords,ageLabel,safeUrl,URGENCY,NEWS_CATEGORIES,latestStationDay,SOURCES,WATER_STATUS,canonicalWaterStatus,timestamp,sum,quality,householdBorderColor,validCoordinates,districtSummary};
  if(typeof module!=='undefined')module.exports=model;else root.DashboardModel=model;
})(typeof window!=='undefined'?window:globalThis);
