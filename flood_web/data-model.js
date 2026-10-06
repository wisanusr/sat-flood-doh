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
  const model={latestStationDay,SOURCES,WATER_STATUS,canonicalWaterStatus,timestamp,sum,quality,householdBorderColor,validCoordinates,districtSummary};
  if(typeof module!=='undefined')module.exports=model;else root.DashboardModel=model;
})(typeof window!=='undefined'?window:globalThis);
