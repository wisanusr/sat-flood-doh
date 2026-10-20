/* Shared, pure data rules used by the dashboard and deterministic tests. */
(function(root){
  const SOURCES={Disaster_DB:'disasters',Vulnerable_group:'vulnerable',thai_water_DB:'stations',BKK_water_DB:'bkkStations',shelter_DB:'shelters'};
  const WATER_STATUS={ล้นตลิ่ง:{rank:5,color:'#991b1b'},วิกฤต:{rank:4,color:'#dc2626'},เตือนภัย:{rank:3,color:'#f97316'},เฝ้าระวัง:{rank:2,color:'#facc15'},ปกติ:{rank:1,color:'#22c55e'}};
  const canonicalWaterStatus=value=>String(value??'').trim()==='วิกฤติ'?'วิกฤต':String(value??'').trim();
  function timestamp(v){if(!v)return NaN;let t=String(v).trim().replace(' ','T');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t))return NaN;if(!/(Z|[+-]\d{2}:?\d{2})$/i.test(t))t+='+07:00';return Date.parse(t)}
  function sum(rows,key){const values=rows.map(r=>r[key]).filter(Number.isFinite);return values.length?values.reduce((a,b)=>a+b,0):null}
  function quality(row,loadedAt){const measured=row.station_id!=null?row.observed_at_th:row.shelter_id!=null?row.fetched_at_th:null;const age=(timestamp(loadedAt)-timestamp(measured))/60000;return !Number.isFinite(age)?'ไม่ทราบเวลาข้อมูล':age<0?'เวลาอนาคต':age<=1440?'ภายใน 24 ชั่วโมง':'ข้อมูลเก่าเกิน 24 ชั่วโมง'}
  function householdBorderColor(n,blue){return !Number.isFinite(n)||n<1?'#94a3b8':blue?(n>=100000?'#082f6b':n>=10000?'#1d4ed8':n>=1000?'#3b82f6':'#93c5fd'):n>=100000?'#dc2626':n>=10000?'#f97316':n>=1000?'#facc15':'#22c55e'}
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
  // A day can hold several snapshots of the same record (the importers append). Keep the newest row per key by `timeOf` (ms or NaN);
  // a later row wins a tie or a missing time, and rows without a key are kept as they are. Order = first appearance of each key.
  function latestPerKey(rows,keyOf,timeOf){
    const best=new Map(),keyless=[];
    for(const row of rows||[]){
      const key=keyOf(row);if(key==null||key===''){keyless.push(row);continue}
      const t=timeOf(row),at=Number.isFinite(t)?t:-Infinity,cur=best.get(key);
      if(!cur||at>=cur.at)best.set(key,{row,at});
    }
    return Array.from(best.values(),x=>x.row).concat(keyless);
  }
  // When a Disaster_DB row was written: Update_Time if the sheet has it, else Ingested_At.
  function disasterTime(r){const u=timestamp(r&&r.Update_Time);return Number.isFinite(u)?u:timestamp(r&&r.Ingested_At)}
  // Newest time (ms) of `field` over rows, ignoring times after `cutoff` (ms) when one is given; NaN when none.
  function latestTime(rows,field,cutoff){let best=NaN;for(const r of rows||[]){const t=timestamp(r&&r[field]);if(Number.isFinite(t)&&(!Number.isFinite(cutoff)||t<=cutoff)&&!(t<=best))best=t}return best}
  // Age of the data the page is showing (ISO load time vs `now` in ms): ok <= 60 min, warn <= 180 min, bad beyond.
  function dataAge(loadedAt,now){
    const t=timestamp(loadedAt);if(!Number.isFinite(t)||!Number.isFinite(now))return null;
    const min=Math.max(0,Math.floor((now-t)/60000));
    return {minutes:min,level:min<=60?'ok':min<=180?'warn':'bad',text:min<60?min+' นาที':Math.floor(min/60)+' ชม. '+(min%60)+' นาที'};
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
  // ── Flood-prep tab (flood_risk / flood_wl_critical, written by the flood-prep pipeline) ──
  // Kept apart from SOURCES on purpose: SOURCES drives the retry banners, footer and refresh of the core dashboard, and
  // these two optional tabs must never add errors or "undefined" labels to it.
  const RISK_SOURCES={flood_risk:'floodRisk',flood_wl_critical:'floodCritical'};
  const RISK_LEVELS={'สูง':{rank:3,color:'#dc2626',key:'high'},'กลาง':{rank:2,color:'#f97316',key:'medium'},'ต่ำ':{rank:1,color:'#22c55e',key:'low'}};
  const riskRank=v=>RISK_LEVELS[String(v??'').trim()]?.rank??0;
  // The pipeline writes every cell as text, so booleans arrive as 'True'/'False'.
  const parseBool=v=>v===true||/^(true|1|yes)$/i.test(String(v??'').trim());
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  function riskRows(rows,level){
    return (rows||[]).filter(r=>r&&r.province&&riskRank(r.risk_level)>0&&(!level||r.risk_level===level))
      .sort((a,b)=>riskRank(b.risk_level)-riskRank(a.risk_level)||(b.forecast_total_mm??-1)-(a.forecast_total_mm??-1)||String(a.province).localeCompare(String(b.province),'th'));
  }
  function riskSummary(rows){
    const out={total:0,high:0,medium:0,low:0,level5Stations:0,risingCritical:0,inCap:0};
    for(const r of rows||[]){
      const lv=RISK_LEVELS[String(r&&r.risk_level||'').trim()];if(!lv||!r.province)continue;
      out.total++;out[lv.key]++;
      out.level5Stations+=finite(r.wl_level5)?r.wl_level5:0;
      out.risingCritical+=finite(r.wl_rising_critical)?r.wl_rising_critical:0;
      if(parseBool(r.in_active_cap))out.inCap++;
    }
    return out;
  }
  // Water level against the previous reading: 'up' | 'down' | 'flat' | null (unknown). 5 mm is below gauge resolution.
  function waterTrend(r){
    const a=r&&r.waterlevel_msl,b=r&&r.waterlevel_msl_prev;
    if(!finite(a)||!finite(b))return null;
    const d=a-b;return Math.abs(d)<0.005?'flat':d>0?'up':'down';
  }
  // Metres above the bank, only when the station itself says it is over the bank ("ล้นตลิ่ง").
  function overbankM(r){return r&&finite(r.diff_wl_bank)&&String(r.diff_wl_bank_text??'').startsWith('ล้น')?r.diff_wl_bank:null}
  // The pipeline runs at 09:00 and 13:00 (Thai time), so the normal gap overnight is about 20 h: that is "ok", not stale.
  function riskFreshness(runAt,now){
    const t=timestamp(runAt);if(!Number.isFinite(t)||!Number.isFinite(now))return {level:'unknown',hours:null};
    const h=(now-t)/3600000;
    if(h<-0.1)return {level:'unknown',hours:null};
    return {level:h<=21?'ok':h<=30?'warn':'bad',hours:Math.max(0,h)};
  }
  // Daily rain series as the pipeline writes it: "1.9|19.3||69.6" (empty = no value for that day).
  function parseSeries(s){
    if(s==null||String(s).trim()==='')return [];
    return String(s).split('|').map(x=>{const v=x.trim();if(v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null});
  }
  // Rain classes: the commonly published daily bands (0.1-10 light, 10.1-35 moderate, 35.1-90 heavy, >90 very heavy).
  // Not yet confirmed against the Thai Meteorological Department's own document, so the page labels them as such.
  const RAIN_CLASSES={
    none:{key:'none',label:'ไม่มีฝน',color:'#f1f5f9',ink:'#475569'},
    light:{key:'light',label:'ฝนเล็กน้อย (≤10 มม.)',color:'#dbeafe',ink:'#1e3a8a'},
    moderate:{key:'moderate',label:'ฝนปานกลาง (10-35 มม.)',color:'#93c5fd',ink:'#0f172a'},
    heavy:{key:'heavy',label:'ฝนหนัก (35-90 มม.)',color:'#2563eb',ink:'#ffffff'},
    very:{key:'very',label:'ฝนหนักมาก (>90 มม.)',color:'#1e1b4b',ink:'#ffffff'},
  };
  function rainClass(mm){
    if(!finite(mm))return null;
    return mm<0.1?RAIN_CLASSES.none:mm<=10?RAIN_CLASSES.light:mm<=35?RAIN_CLASSES.moderate:mm<=90?RAIN_CLASSES.heavy:RAIN_CLASSES.very;
  }
  // n consecutive calendar days from "YYYY-MM-DD..." as ISO dates (pure date arithmetic, no time zone involved).
  function seriesDates(startIso,n){
    const m=String(startIso??'').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(!m)return [];
    const base=Date.UTC(+m[1],+m[2]-1,+m[3]);
    return Array.from({length:n},(_,i)=>new Date(base+i*86400000).toISOString().slice(0,10));
  }
  // Vulnerable population (Vulnerable_group rows) living in the given provinces; `missing` lists provinces with no row.
  function exposure(rows,provinces){
    const want=new Set(provinces||[]),seen=new Set(),out={children:0,pregnant:0,elderly:0,total:0,matched:0,missing:[]};
    for(const r of rows||[]){
      if(!want.has(r.province)||seen.has(r.province))continue;
      seen.add(r.province);
      for(const k of ['children','pregnant','elderly'])if(finite(r[k]))out[k]+=r[k];
    }
    out.total=out.children+out.pregnant+out.elderly;out.matched=seen.size;out.missing=[...want].filter(p=>!seen.has(p));
    return out;
  }
  const reasonList=s=>String(s??'').split(';').map(x=>x.trim()).filter(Boolean);
  // ── Executive report tab ("รายงานผู้บริหาร", executive-view.js; GitHub Pages build only). Inputs are raw sheet rows as the
  // CSV export gives them (every cell a string): Disaster_DB, Vulnerable_group, flood_waterlogged_amphoe and the tmd_* tabs
  // (geeks_project_google docs/tmd_data_dictionary.md). An empty cell means no data, never 0. ──
  const execNum=v=>{const s=String(v??'').replace(/,/g,'').trim();return /^-?\d+(\.\d+)?$/.test(s)?Number(s):null};
  const isoDay=v=>{const m=String(v??'').match(/^\d{4}-\d{2}-\d{2}/);return m?m[0]:''};
  // "2026-10-19 7:02:09" -> ms; the importer writes single-digit hours. Thai time, as all sheet times are.
  const execTime=v=>{const m=String(v??'').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);return m?Date.UTC(+m[1],+m[2]-1,+m[3],+m[4]-7,+m[5]):NaN};
  // One DDPM report day: the newest row per province (a day can hold several snapshots of one province).
  function execDdpmDay(rows,day){
    const best=new Map();
    for(const r of rows||[]){if(isoDay(r.Report_Date)!==day||!r.Province)continue;const t=execTime(r.Ingested_At),cur=best.get(r.Province);if(!cur||!(t<cur.t))best.set(r.Province,{r,t})}
    return Array.from(best.values(),({r})=>({province:r.Province,hh:execNum(r.Affected_Households),remarks:r.Remarks||''}));
  }
  // Latest DDPM report day against the one before. keep(province) limits the provinces counted, but the days always come
  // from all rows: a health region with no report on the latest day shows nothing, not an older report of its own.
  function execDdpm(rows,keep){
    const days=[...new Set((rows||[]).map(r=>isoDay(r.Report_Date)).filter(Boolean))].sort(),ok=x=>!keep||keep(x.province);
    const day=days.at(-1)||'',prevDay=days.at(-2)||'',cur=day?execDdpmDay(rows,day).filter(ok):[],prev=prevDay?execDdpmDay(rows,prevDay).filter(ok):[];
    const total=a=>a.reduce((s,x)=>s+(x.hh||0),0),now=new Set(cur.map(x=>x.province));
    return {day,prevDay,cur:cur.sort((a,b)=>(b.hh??-1)-(a.hh??-1)||a.province.localeCompare(b.province,'th')),provinces:cur.length,hh:total(cur),
      dProv:prevDay?cur.length-prev.length:null,dHh:prevDay?total(cur)-total(prev):null,recovered:prev.filter(x=>!now.has(x.province)).map(x=>x.province)};
  }
  // Vulnerable_group rows (Thai headers) -> {province, region number, children, pregnant, elderly}; the "รวมทั้งหมด" row is dropped.
  function execVulnerable(rows){
    return (rows||[]).filter(r=>r['จังหวัด']&&r['จังหวัด']!=='รวมทั้งหมด').map(r=>({province:r['จังหวัด'],region:regionNumber(r['เขตสุขภาพ']),
      children:execNum(r['จำนวนเด็ก 0-4 ปีทั้งหมด (คน)']),pregnant:execNum(r['จำนวนหญิงตั้งครรภ์ทั้งหมด (คน)']),elderly:execNum(r['จำนวนผู้สูงอายุ 60 ปีขึ้นไปทั้งหมด (คน)'])}));
  }
  // province -> health region number. Bangkok is region 13 when the sheet has no row for it.
  function execRegionOf(vul){const m=new Map();for(const r of vul||[])if(r.region)m.set(r.province,r.region);if(!m.has('กรุงเทพมหานคร'))m.set('กรุงเทพมหานคร',13);return m}
  // 2P2R province level (flood_waterlogged_amphoe.province_level_code, repeated on each district row). Colours are the
  // waterlogging tab's WATER_2P2R (flood-dashboard-waterlogged data-model.js); keep the two in step.
  const EXEC_P2R={red:{rank:4,color:'#E24B4A',label:'ตอบโต้ทันที'},orange:{rank:3,color:'#EF9F27',label:'ตรวจเชิงรุก'},yellow:{rank:2,color:'#F2D43D',label:'เตรียมพร้อม',light:true},green:{rank:1,color:'#4CAF50',label:'ฟื้นฟู'}};
  function execProvinceLevels(rows){const out=new Map();for(const r of rows||[]){const k=String(r.province_level_code??'').trim();if(EXEC_P2R[k]&&r.province&&!out.has(r.province))out.set(r.province,k)}return out}
  // The province list follows the 2P2R map: every province with a level plus any DDPM province without one, highest level
  // first, then by DDPM households.
  function execProvinceList(levels,ddpmCur){
    const hh=new Map((ddpmCur||[]).map(x=>[x.province,x.hh]));
    return [...new Set([...levels.keys(),...hh.keys()])].map(p=>({province:p,level:levels.get(p)||null,hh:hh.get(p)??null}))
      .sort((a,b)=>(EXEC_P2R[b.level]?.rank||0)-(EXEC_P2R[a.level]?.rank||0)||(b.hh??-1)-(a.hh??-1)||a.province.localeCompare(b.province,'th'));
  }
  // Group a sorted province list by health region (ascending region number; unknown regions last), keeping the order.
  function execByRegion(items,regionOf){
    const out=new Map();
    for(const x of items||[]){const n=regionOf.get(x.province)||null;if(!out.has(n))out.set(n,[]);out.get(n).push(x)}
    return Array.from(out,([region,list])=>({region,items:list})).sort((a,b)=>(a.region??99)-(b.region??99));
  }
  // TMD heavy-rain map bands, keyed by the pipeline's label (rain_max_amphoe_level): white, yellow, orange, red, purple.
  const EXEC_RAIN=[{level:'0-35 มม.',color:'#ffffff',label:'≤35'},{level:'35.1-65 มม.',color:'#FFE600',label:'≤65'},{level:'65.1-125 มม.',color:'#FF9800',label:'≤125'},{level:'125.1-250 มม.',color:'#E53935',label:'≤250'},{level:'มากกว่า 250 มม.',color:'#8E24AA',label:'>250'}];
  // First n forecast days of the latest run (tmd_rain_level): the level per province and how many provinces have a district over 35 mm.
  function execRainDays(rows,n,keep){
    const run=(rows||[]).reduce((m,r)=>String(r.run_at||'')>m?String(r.run_at):m,''),latest=(rows||[]).filter(r=>r.run_at===run&&(!keep||keep(r.province)));
    const days=[...new Set(latest.map(r=>isoDay(r.forecast_date)).filter(Boolean))].sort().slice(0,n);
    return days.map(d=>{const rs=latest.filter(r=>isoDay(r.forecast_date)===d);return {date:d,levels:new Map(rs.map(r=>[r.province,r.rain_max_amphoe_level])),heavy:rs.filter(r=>(execNum(r.amphoe_heavy_count)??0)>0).length}});
  }
  // Report date = the newest data date on the poster: the DDPM report day and the run dates of the other tabs (forecast dates are future, not used).
  function execReportDay(ddpmDay,...tables){return [ddpmDay,...tables.flatMap(t=>(t||[]).map(r=>isoDay(r.run_at)))].filter(Boolean).reduce((a,b)=>b>a?b:a,'')}
  const model={execNum,execTime,execDdpm,execVulnerable,execRegionOf,EXEC_P2R,execProvinceLevels,execProvinceList,execByRegion,EXEC_RAIN,execRainDays,execReportDay,latestPerKey,disasterTime,latestTime,parseSeries,RAIN_CLASSES,rainClass,seriesDates,exposure,reasonList,RISK_SOURCES,RISK_LEVELS,riskRank,parseBool,riskRows,riskSummary,waterTrend,overbankM,riskFreshness,dataAge,vulnerableTotals,trendKind,provinceLevel,situationGroups,regionNumber,timelineDaily,termWindows,lifecycle,trendLevel,newsRising,newsTopRegions,newsTopByCount,sourceInitial,growthValue,newsArticles,newsProvinces,newsUrgencyCounts,newsWords,ageLabel,safeUrl,URGENCY,NEWS_CATEGORIES,latestStationDay,SOURCES,WATER_STATUS,canonicalWaterStatus,timestamp,sum,quality,householdBorderColor,validCoordinates,districtSummary};
  if(typeof module!=='undefined')module.exports=model;else root.DashboardModel=model;
})(typeof window!=='undefined'?window:globalThis);
