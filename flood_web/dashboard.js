// Shared map footer: [expand icon] [layers popover] ... [extra buttons], placed under the map. Used by the shelter, risk and DOH maps; the national / BKK map builds the same bar from template.html.
window.MapChrome=(()=>{const ic=d=>'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>',ICON={open:ic('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),close:ic('<path d="M14 10h6V4M10 14H4v6M20 4l-6 6M4 20l6-6"/>'),layers:ic('<path d="M12 3 2 8.5 12 14l10-5.5z"/><path d="m2 13 10 5.5L22 13"/><path d="m2 17.5 10 5.5 10-5.5" opacity=".55"/>')};
function expandButton(section,mapEl){const b=document.createElement('button');b.type='button';b.className='lightbtn expand-map icon-btn';const label=x=>{b.innerHTML=ICON[x?'close':'open'];b.title=b.ariaLabel=x?'ออกจากแผนที่เต็มจอ':'ขยายแผนที่';b.setAttribute('aria-pressed',String(x))};label(false);b.onclick=()=>{const x=section.classList.toggle('map-expanded');label(x);document.body.classList.toggle('map-open',!!document.querySelector('.map-expanded'));requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')))};return b}
function setup(section,mapEl,tools,keep=[]){if(!section||!mapEl||section.dataset.mapChrome)return;section.dataset.mapChrome='1';const bar=document.createElement('div');bar.className='map-tools layer-bar map-chrome';bar.append(expandButton(section,mapEl));
 if(tools){const id='layerPop'+Math.random().toString(36).slice(2,7),btn=document.createElement('button');btn.type='button';btn.className='lightbtn layers-btn';btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls',id);btn.innerHTML=ICON.layers+'<span>ชั้นข้อมูล</span>';const pop=document.createElement('div');pop.className='layer-pop';pop.id=id;pop.hidden=true;const set=o=>{pop.hidden=!o;btn.setAttribute('aria-expanded',String(o))};btn.onclick=e=>{e.stopPropagation();set(pop.hidden)};document.addEventListener('click',e=>{if(!pop.hidden&&!pop.contains(e.target))set(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden){set(false);btn.focus()}});const extras=keep.filter(Boolean);Array.from(tools.childNodes).forEach(n=>{if(!extras.includes(n))pop.append(n)});bar.append(btn,pop);if(extras.length){const x=document.createElement('span');x.className='layer-bar-extra';x.append(...extras);bar.append(x)}tools.remove()}
 let after=mapEl;while(after.nextElementSibling&&/MobileKey$/.test(after.nextElementSibling.id||''))after=after.nextElementSibling;after.after(bar)}
return{setup,ICON}})();
if(window.Chart)Chart.defaults.font.family="'Google Sans', Tahoma, sans-serif";
//@local-request-begin (build.py swaps this block for the google.script.run version)
async function requestData(source,refresh){const q=new URLSearchParams();if(source)q.set('source',source);if(refresh)q.set('refresh','1');const response=await fetch('/api/data'+(q.size?'?'+q:''),{cache:'no-store'});return response.json();}
//@local-request-end
(async()=>{try{
document.getElementById('pageTitle').textContent='กำลังอ่านข้อมูลจาก Google Sheets…';
const DATA=await requestData();
if(!DATA.sourceStatus)throw new Error(DATA.error||'รูปแบบข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง');
  try {
    const resGeo = await fetch('/thai_provinces.json');
    window.PROVINCES_GEOJSON = resGeo.ok ? await resGeo.json() : null;
  } catch(e) { window.PROVINCES_GEOJSON = null; }
  try {
    const districtResponse=await fetch('/bkk_districts.geojson');
    window.BKK_DISTRICTS_GEOJSON=districtResponse.ok?await districtResponse.json():null;
  } catch(e) { window.BKK_DISTRICTS_GEOJSON=null; }
  try{const res=await fetch('/regions.geojson');window.HEALTH_REGIONS_GEOJSON=res.ok?await res.json():null}catch(e){window.HEALTH_REGIONS_GEOJSON=null}

const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('th-TH'):'ไม่มีข้อมูล',sum=DashboardModel.sum,uniq=a=>[...new Set(a)],date=v=>!v||String(v).startsWith('undefined')?'ไม่มีวันรายงาน':new Date(v).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}),time=v=>v?new Date(Number.isFinite(DashboardModel.timestamp(v))?DashboardModel.timestamp(v):v).toLocaleString('th-TH',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}):'ไม่ทราบเวลาข้อมูล';
const districts='คลองสาน คลองสามวา คลองเตย คันนายาว จตุจักร จอมทอง ดอนเมือง ดินแดง ดุสิต ตลิ่งชัน ทวีวัฒนา ทุ่งครุ ธนบุรี บางกอกน้อย บางกอกใหญ่ บางกะปิ บางขุนเทียน บางคอแหลม บางซื่อ บางนา บางบอน บางพลัด บางรัก บางเขน บางแค บึงกุ่ม ปทุมวัน ประเวศ ป้อมปราบศัตรูพ่าย พญาไท พระนคร พระโขนง ภาษีเจริญ มีนบุรี ยานนาวา ราชเทวี ราษฎร์บูรณะ ลาดกระบัง ลาดพร้าว วังทองหลาง วัฒนา สวนหลวง สะพานสูง สัมพันธวงศ์ สาทร สายไหม หนองจอก หนองแขม หลักสี่ ห้วยขวาง'.split(' ');
const {SOURCES,validCoordinates}=DashboardModel;
const rowSources=new WeakMap();
function indexSources(){
    for(const [name,key] of Object.entries(SOURCES))for(const row of DATA[key])rowSources.set(row,name);
    
    // Trend labels differ across report days ("ระดับน้ำเพิ่มขึ้น" vs "เพิ่มขึ้น"); keep one form.
    for (const r of DATA.disasters || []) if (typeof r.Water_Level_Trend === 'string') r.Water_Level_Trend = r.Water_Level_Trend.replace(/^ระดับน้ำ/, '').trim();
    // Several snapshots of one record (the importers append): keep the newest, comparing times as real instants (see DashboardModel.latestPerKey).
    // Stations by id (names repeat across provinces); a report row by day + province + disaster type; a shelter by id.
    const ts = DashboardModel.timestamp;
    function dedup(arr) { return DashboardModel.latestPerKey(arr.filter(r => r.station_id || r.station_name), r => r.station_id || r.station_name, r => ts(r.observed_at_th || r.updated_at_source || r.Ingested_At)); }
    if (DATA.disasters) DATA.disasters = DashboardModel.latestPerKey(DATA.disasters, r => [String(r.Report_Date || '').slice(0, 10), r.Province, r.Disaster_Type].join('|'), DashboardModel.disasterTime);
    if (DATA.shelters) DATA.shelters = DashboardModel.latestPerKey(DATA.shelters, r => r.shelter_id, r => { const f = ts(r.fetched_at_th); return Number.isFinite(f) ? f : ts(r.updated_at_source); });
    if (DATA.stations) DATA.stations = dedup(DATA.stations);
    if (DATA.bkkStations) DATA.bkkStations = dedup(DATA.bkkStations);
    // BMA sheet also lists canal stations just outside Bangkok; their province is only in the area name (e.g. "อำเภอเมืองปทุมธานี").
    const provinces = (window.PROVINCES_GEOJSON?.features || []).map(f => f.properties.pro_th).filter(Boolean);
    for (const r of DATA.bkkStations || []) if (!r.province) r.province = provinces.find(p => String(r.district_or_area || '').endsWith(p)) || null;
    // Keep only stations with a usable water status; broken / unknown ones are not shown or counted.
    const usable = r => !!DashboardModel.WATER_STATUS[DashboardModel.canonicalWaterStatus(r.flood_status_source)];
    DATA.excludedStations = {national: 0, bkk: 0};
    if (DATA.stations) { const n = DATA.stations.length; DATA.stations = DATA.stations.filter(usable); DATA.excludedStations.national = n - DATA.stations.length; }
    if (DATA.bkkStations) { const n = DATA.bkkStations.length; DATA.bkkStations = DATA.bkkStations.filter(usable); DATA.excludedStations.bkk = n - DATA.bkkStations.length; }
}
// National view = Thaiwater stations + BMA-sheet stations around Bangkok (province known, not Bangkok itself).
function nationalStations() { return DATA.stations.concat(DATA.bkkStations.filter(r => r.province && r.province !== 'กรุงเทพมหานคร')); }
indexSources();
// The flood-prep tab (risk-view.js) reads the same DATA object; it is told when DATA is first ready or reloaded.
window.dashboardData=DATA;
const timestamp=DashboardModel.timestamp;
const quality=r=>DashboardModel.quality(r,DATA.sourceStatus[rowSources.get(r)]?.loadedAt||DATA.loadedAt);
const badge=(s,kind='')=>`<span class="badge ${kind}">${esc(s)}</span>`;
const qualityBadge=r=>badge(quality(r),quality(r)==='ภายใน 24 ชั่วโมง'?'good':quality(r)==='เวลาอนาคต'?'bad':'warn');
const statusBadge=s=>{const c=canonicalWaterStatus(s);const color=WATER_STATUS[c]?.color;return color?`<span class="badge" style="background-color:${color};color:${color==='#facc15'?'#000':'#fff'}">${esc(s)}</span>`:badge(s);};
const link=(url,text)=>{try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`:esc(text)}catch{return esc(text)}};
let state={tab:'national',date:uniq(DATA.disasters.map(r=>r.Report_Date.slice(0,10))).sort().at(-1),region:'',province:'',district:''},currentStations=[],currentShelters=[],csvRows=[],map=null,layers=null,nationalBase=null,nationalLegend=null,healthRegionLayer=null,healthRegionNumbers=null,shelterMap=null,shelterLayers=null;
function opts(id,values,first){$(id).innerHTML=(first?`<option value="">${first}</option>`:'')+values.map(v=>`<option value="${esc(v)}">${id==='reportDate'?date(v+'T00:00:00+07:00'):esc(v)}</option>`).join('')}
opts('reportDate',uniq(DATA.disasters.map(r=>r.Report_Date.slice(0,10))).sort());$('reportDate').value=state.date;
opts('region',uniq(DATA.vulnerable.map(r=>r.region).filter(Boolean)).sort((a,b)=>String(a).localeCompare(String(b),'th',{numeric:true})),'ทุกเขตสุขภาพ');opts('province',provinceNames(),'ทุกจังหวัด');opts('district',districts,'ทุกเขต กทม.');
function renderTrendCards(bkk){const el=$('trendCards');el.classList.toggle('hidden',bkk);if(bkk)return;const allowed=new Set(allowedProvinces()),t=new Map();for(const r of getReports()){if(!allowed.has(r.Province))continue;const k=DashboardModel.trendKind(r.Water_Level_Trend);if(k)t.set(r.Province,k)}const n={up:0,steady:0,down:0};t.forEach(k=>n[k]++);const defs=[['up','น้ำเพิ่มขึ้น','↗'],['steady','น้ำทรงตัว','='],['down','น้ำลดลง','↓']];el.innerHTML=defs.map(([k,l,i])=>`<div class="trend-card tc-${k}" style="${trendBadgeStyle(l.replace(/^น้ำ/,''))}"><span class="tc-icon" aria-hidden="true">${i}</span><span class="tc-label">${l}</span><span class="tc-num">${fmt(n[k])} <small>จ.</small></span></div>`).join('')}
function card(label,value,unit,note,accent=false){return `<article class="card ${accent?'accent':''}"><div class="eyebrow">${label}</div><div class="number">${fmt(value)}<span class="unit">${unit}</span></div><div class="card-note">${note}</div></article>`}
function metric(label,value){return `<div class="metricline"><span>${label}</span><strong>${value}</strong></div>`}
function bars(rows){let max=Math.max(...rows.map(r=>r.value),1);return rows.map(r=>{let color='#087873';if(r.value>=100000)color='#dc2626';else if(r.value>=10000)color='#f97316';else if(r.value>=1000)color='#facc15';else if(r.value>=1)color='#22c55e';return `<div class="barrow"><button data-province="${esc(r.name)}" title="ดูจังหวัด ${esc(r.name)}">${esc(r.name)}</button><div class="bartrack"><div class="bar" style="width:${r.value/max*100}%;background:${color}"></div></div><strong>${fmt(r.value)}</strong></div>`}).join('')||'<p class="empty">ไม่มีรายงานในขอบเขตที่เลือก</p>'}
function table(headers,rows){return `<table><thead><tr>${headers.map((h,i)=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map((v,i)=>`<td>${v}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="empty">ไม่มีข้อมูลในขอบเขตที่เลือก</td></tr>`}</tbody></table>`}
function getReports(){return DATA.disasters.filter(r=>r.Report_Date.slice(0,10)===state.date&&r.Current_Status==='กำลังประสบภัย')}
function render(){const bkk=state.tab==='bkk',ops=state.tab==='ops';$('workspace').classList.toggle('national-layout',!bkk);if(!bkk&&shelterLayers)shelterLayers.clearLayers();$('workspace').setAttribute('aria-labelledby',bkk?'tab-bkk':ops?'tab-ops':'tab-national');document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.tab===state.tab)));document.querySelectorAll('.national-filter').forEach(x=>x.classList.toggle('hidden',bkk));$('districtField').classList.toggle('hidden',!bkk);$('shelterMapPanel').classList.toggle('hidden',!bkk);
$('shelterCards').classList.toggle('hidden',!bkk);
$('allSheltersPanel').classList.toggle('hidden',!bkk);
$('nationalVulPanel').classList.toggle('hidden', bkk||ops);$('vulSummary').classList.toggle('hidden', bkk||ops);$('stationPanel').classList.toggle('hidden',ops);$('region').closest('.field')?.classList.toggle('hidden',ops);if(ops)state.region='';$('opsShelterChip').classList.toggle('hidden',!ops);document.querySelectorAll('#showWaterHeat,#showStationPins').forEach(x=>x.closest('label')?.classList.toggle('hidden',ops));
$('bkkVulPanel').classList.toggle('hidden', !bkk);$('areaNote').classList.toggle('hidden',!bkk);$('pageTitle').textContent=bkk?'กรุงเทพมหานคร':ops?'ปฏิบัติการ ปภ.':'สถานการณ์น้ำและพื้นที่ได้รับผลกระทบ';$('pageSub').textContent=bkk?'ติดตามระดับน้ำ ความพร้อมศูนย์พักพิง และข้อมูลรายเขต':ops?'ข้อมูลรายงานสถานการณ์ภัยจาก กรมป้องกันและบรรเทาสาธารณภัย (ปภ.) เท่านั้น · เลือกพื้นที่เพื่อดูรายละเอียด':'ภาพรวมประเทศไทย รวมกรุงเทพมหานคร · เลือกพื้นที่เพื่อดูรายละเอียด';$('dateLabel').textContent='รายงาน ปภ. '+date(state.date+'T00:00:00+07:00');$('filterNote').textContent=bkk?'รายเขต: ใช้กับสถานีและศูนย์พักพิง':'วันรายงาน: ใช้กับข้อมูล ปภ. เท่านั้น';if($('sourceName'))$('sourceName').innerHTML=link(DATA.sourceUrl,DATA.source);
 const all=getReports(),allowed=allowedProvinces(),reports=all.filter(r=>bkk?r.Province==='กรุงเทพมหานคร':allowed.includes(r.Province));
 currentStations=bkk?DATA.bkkStations.filter(r=>r.province==='กรุงเทพมหานคร'&&(!state.district||r.district_or_area===state.district)):(ops?[]:nationalStations().filter(r=>allowed.includes(r.province)));const activeShelterFilters=new Set(Array.from(document.querySelectorAll('.shelter-status-filter:checked')).map(el=>el.value)); currentShelters=bkk?DATA.shelters.filter(r=>(!state.district||r.district===state.district)&&activeShelterFilters.has(shelterStatusKey(r))):[];
 const fresh=currentStations.filter(r=>quality(r)==='ภายใน 24 ชั่วโมง'),stale=currentStations.filter(r=>quality(r)==='ข้อมูลเก่าเกิน 24 ชั่วโมง'),future=currentStations.filter(r=>quality(r)==='เวลาอนาคต'),severe=fresh.filter(r=>(WATER_STATUS[canonicalWaterStatus(r.flood_status_source)]?.rank||0)>=4),affected=uniq(reports.map(r=>r.Province)),households=reports.length?sum(reports,'Affected_Households'):null;
 
 let bkkCriticalDistricts = 0, bkkCriticalStations = 0, bkkShelterFull = 0, bkkShelterCap = 0, bkkShelterOcc = 0;
 if(bkk) {
   const distMap = new Map();
   for(const r of currentStations) {
     if(quality(r) !== 'ภายใน 24 ชั่วโมง') continue;
     const st = canonicalWaterStatus(r.flood_status_source);
     if((WATER_STATUS[st]?.rank||0)>=4) bkkCriticalStations++;
     if(WATER_STATUS[st]) {
       const currentRank = distMap.get(r.district_or_area) || 0;
       if(WATER_STATUS[st].rank > currentRank) distMap.set(r.district_or_area, WATER_STATUS[st].rank);
     }
   }
   for(const rank of distMap.values()) {
     if(rank >= (WATER_STATUS['วิกฤต']?.rank || 4)) bkkCriticalDistricts++;
   }
   for(const r of currentShelters) {
     if(r.status_source === 'เต็ม' || r.status_source === 'ใกล้เต็ม' || (r.capacity > 0 && r.occupied >= r.capacity)) bkkShelterFull++;
     bkkShelterCap += (r.capacity || 0);
     bkkShelterOcc += (r.occupied || 0);
   }
   bkkShelterCap=sum(currentShelters,'capacity');bkkShelterOcc=sum(currentShelters,'occupied');
 }
$('cards').innerHTML=bkk?card('เขตวิกฤต / ล้นตลิ่ง',bkkCriticalDistricts,'เขต','จากข้อมูลสถานีน้ำ 24 ชม.',true)+card('สถานีวิกฤต / ล้นตลิ่ง',bkkCriticalStations,'สถานี',`จากทั้งหมด ${fmt(fresh.length)} สถานีที่ข้อมูลอัปเดต`)+card('ผู้เข้าพักศูนย์พักพิง',bkkShelterOcc,'คน',`รองรับได้ทั้งหมด ${fmt(bkkShelterCap)} คน`)+card('จำนวนศูนย์ที่เต็ม/ใกล้เต็ม',bkkShelterFull,'แห่ง',`จากศูนย์ตามตัวกรองทั้งหมด ${fmt(currentShelters.length)} แห่ง`):card('จังหวัดที่มีรายงานภัย',affected.length,'จังหวัด','นับจังหวัดไม่ซ้ำในวันรายงาน',true)+card('ครัวเรือนตามรายงาน',households,'ครัวเรือน','รวมเฉพาะวันและพื้นที่ที่เลือก')+card('จังหวัดแนวโน้มน้ำเพิ่มขึ้น',uniq(reports.filter(r=>r.Water_Level_Trend==='เพิ่มขึ้น').map(r=>r.Province)).length,'จังหวัด','แนวโน้มตามรายงาน ปภ.')+(ops?'':card('สถานีวิกฤติ / ล้นตลิ่ง ข้อมูลสด',severe.length,'แห่ง',`เฉพาะอายุ 0–24 ชั่วโมง จาก ${fmt(currentStations.length)} สถานี`));
 $('alert').style.display='none';
 $('mapTitle').textContent=bkk?'สถานะระดับน้ำรายเขต กรุงเทพมหานคร':'การเฝ้าระวังน้ำและผลกระทบ';$('mapSubtitle').textContent=bkk?'ขอบเขต 50 เขต · Heatmap จากสถานีระดับน้ำที่ข้อมูลผ่านเกณฑ์ 24 ชั่วโมง':'';$('mapSubtitle').classList.toggle('hidden',!bkk);$('mapCount').textContent=bkk?(state.district?'เขต'+state.district:'50 เขต')+` · ${fmt(currentStations.length)} สถานี`:ops?`${fmt(affected.length)} จังหวัด`:`${fmt(currentStations.length)} สถานี`;
 $('stationMapLegend').classList.add('hidden');$('householdMapLegend').classList.add('hidden');$('map').classList.toggle('national-view',!bkk);$('bkkMapTools').classList.toggle('hidden',!bkk);$('healthRegionTools').classList.toggle('hidden',bkk);$('districtWaterLegend').classList.toggle('hidden',!bkk);$('districtShelterLegend').classList.toggle('hidden',!bkk);$('districtWaterNote').classList.toggle('hidden',!bkk);$('nationalHeatNote').classList.toggle('hidden',bkk);renderTrendCards(bkk);
 if(bkk){$('sideTitle').textContent='สรุปสถานีระดับน้ำรายเขต';$('sideSub').textContent=state.district||'เรียงตามเขตที่มีสถานีวิกฤตมากที่สุด (24 ชม.)';const over=currentShelters.filter(r=>r.occupied>r.capacity),coords=currentShelters.filter(r=>typeof r.latitude==='number'&&typeof r.longitude==='number');const distStats=new Map();for(const r of currentStations){if(quality(r)!=='ภายใน 24 ชั่วโมง')continue;const d=r.district_or_area||'ไม่ระบุ',st=canonicalWaterStatus(r.flood_status_source);if(!distStats.has(d))distStats.set(d,{วิกฤต:0,เตือนภัย:0,ปกติ:0});const stat=distStats.get(d);if((WATER_STATUS[st]?.rank||0)>=4)stat.วิกฤต++;else if((WATER_STATUS[st]?.rank||0)>=2)stat.เตือนภัย++;else if(st==='ปกติ')stat.ปกติ++;}const sortedDistricts = Array.from(distStats.entries())
    .filter(([_,s]) => s.วิกฤต > 0 || s.เตือนภัย > 0 || s.ปกติ > 0)
    .sort((a,b) => b[1].วิกฤต - a[1].วิกฤต || b[1].เตือนภัย - a[1].เตือนภัย || b[1].ปกติ - a[1].ปกติ);
    
  $('sideBody').innerHTML = table(['เขต', 'วิกฤต', 'เตือนภัย', 'ปกติ'], sortedDistricts.map(([d, s]) => {
    return [
      `<button class="linkbutton" data-district="${esc(d)}">${esc(d)}</button>`,
      s.วิกฤต ? `<span class="badge" style="background:#dc2626;color:#fff">${s.วิกฤต}</span>` : '-',
      s.เตือนภัย ? `<span class="badge" style="background:#ea580c;color:#fff">${s.เตือนภัย}</span>` : '-',
      s.ปกติ ? `<span class="badge" style="background:#16a34a;color:#fff">${s.ปกติ}</span>` : '-',
    ];
  }));
} else {
  $('sideTitle').textContent = 'ตารางสรุปผลกระทบ ปภ.';
  $('sideSub').textContent = state.province || state.region || 'จัดอันดับตามจำนวนครัวเรือนเดือดร้อน';
  const sortedRows = reports.slice().sort((a,b)=>(b.Affected_Households||0)-(a.Affected_Households||0));
  if (ops) {
    loadDoh();
    // Operations tab: no separate water column; the province name itself carries the water-trend colour.
    $('sideBody').innerHTML = table(['จังหวัด', 'ครัวเรือน', 'ตำบล', 'อำเภอ', 'เสียชีวิต', 'ศูนย์พักพิง DOH (แห่ง)'], sortedRows.map(r => [
      `<button class="province-chip" style="${trendBadgeStyle(r.Water_Level_Trend)}" data-province="${esc(r.Province)}" title="แนวโน้มระดับน้ำ: ${esc(r.Water_Level_Trend||'ไม่ระบุ')}">${esc(r.Province)}</button>`,
      `${householdBadge(r.Affected_Households)}`,
      esc(r.Affected_Subdistricts_Count ?? '-'),
      esc(r.Affected_Districts_Count ?? '-'),
      r.Casualties_Deaths == null ? '-' : fmt(r.Casualties_Deaths),
      doh.all ? fmt(doh.all.filter(x=>x.province===r.Province).length) : doh.failed ? '-' : '…'
    ]));
  } else {
  const headers = ['จังหวัด', 'อำเภอ', 'ตำบล', 'ครัวเรือน', 'เสียชีวิต', 'น้ำ'];
  $('sideBody').innerHTML = table(headers, sortedRows.map(r => [
    `<button class="linkbutton" data-province="${esc(r.Province)}">${esc(r.Province)}</button>`,
    esc(r.Affected_Districts_Count ?? '-'),
    esc(r.Affected_Subdistricts_Count ?? '-'),
    `${householdBadge(r.Affected_Households)}`,
    r.Casualties_Deaths == null ? '-' : fmt(r.Casualties_Deaths),
    `<span class="badge" style="${trendBadgeStyle(r.Water_Level_Trend)}">${esc(r.Water_Level_Trend||'ไม่ระบุ')}</span>`
  ]));
  }
}


renderMap();
renderAreas();
renderStations();
renderShelterDetails();renderShelterToolbar();
renderVulnerable();renderVulSummary();
renderBkkVulChart();
$('sideBody').classList.toggle('ddpm-summary',state.tab!=='bkk');$('sideBody').classList.toggle('ops-summary',state.tab==='ops');
paginateTables();requestAnimationFrame(updateTableHints);
if(state.tab === 'bkk') $('bkkVulPanel').classList.remove('hidden');
renderSourceStatus();updateAlert();renderSituation();renderDataAge();
if(state.tab==='bkk'){refitIfResized(map);refitIfResized(shelterMap)}
}

// Plain-language summary under the main map, as ONE block that can be copied as plain text. Everything in it is
// counted from the loaded sheets; the level rules (DashboardModel.provinceLevel) are printed under the block so nobody
// has to guess how a province was classified. `notes` (data gaps, rules) stay out of the copied text.
let situationText='';
function situationBlock(host,title,facts,sections,notes,compact){
 // facts: bullets under the title. sections: [{head, items[]}] or [{head}] for a heading with no list.
 // compact (Bangkok): bullets follow their heading directly; otherwise a blank line separates them.
 const lines=[title];if(!compact)lines.push('');
 if(facts.length){facts.forEach(f=>lines.push('* '+f));lines.push('')}
 sections.forEach(s=>{lines.push(s.head);if(s.items&&s.items.length){if(!compact)lines.push('');s.items.forEach(i=>lines.push('* '+i))}lines.push('')});
 while(lines.length&&lines[lines.length-1]==='')lines.pop();
 situationText=lines.join('\n');
 host.innerHTML='<div class="situation-head"><h2>'+esc(title)+'</h2><button type="button" class="lightbtn" id="copySituation">คัดลอกข้อความ</button></div>'
  +(facts.length?'<ul class="sit-facts">'+facts.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul>':'')
  +sections.map(s=>'<h3>'+esc(s.head)+'</h3>'+(s.items&&s.items.length?'<ul>'+s.items.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul>':'')).join('')
  +(notes.length?'<p class="mini-note situation-rule">'+notes.join(' · ')+'</p>':'');
 $('copySituation').addEventListener('click',async e=>{
  const btn=e.currentTarget,done=ok=>{btn.textContent=ok?'คัดลอกแล้ว':'คัดลอกไม่สำเร็จ';setTimeout(()=>{btn.textContent='คัดลอกข้อความ'},2000)};
  try{await navigator.clipboard.writeText(situationText);done(true)}
  catch(err){ // clipboard API needs https/localhost; fall back to a temporary textarea
   const t=document.createElement('textarea');t.value=situationText;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();
   let ok=false;try{ok=document.execCommand('copy')}catch(x){}t.remove();done(ok)}
 });
}
function renderSituation(){
 const host=$('situationSummary');if(!host)return;
 const bkk=state.tab==='bkk',day=state.date?date(state.date+'T00:00:00+07:00'):'ไม่มีวันรายงาน';
 if(failed('Disaster_DB')){situationText='';host.innerHTML='<h2>สรุปสถานการณ์</h2><p class="empty">อ่านรายงาน ปภ. ไม่สำเร็จ จึงยังสรุปสถานการณ์ไม่ได้</p>';return}
 const reports=getReports(),fresh=r=>quality(r)==='ภายใน 24 ชั่วโมง',rank=r=>WATER_STATUS[canonicalWaterStatus(r.flood_status_source)]?.rank||0;
 if(!bkk){
  const allowed=new Set(allowedProvinces()),rows=reports.filter(r=>allowed.has(r.Province));
  if(!rows.length){situationText='';host.innerHTML='<h2>'+esc(day)+' สรุปสถานการณ์</h2><p class="empty">ไม่มีรายงานพื้นที่ประสบภัยในวันและพื้นที่ที่เลือก</p>';return}
  const hasBkk=rows.some(r=>r.Province==='กรุงเทพมหานคร'),provinces=rows.filter(r=>r.Province!=='กรุงเทพมหานคร').length;
  const hh=sum(rows,'Affected_Households'),deaths=sum(rows,'Casualties_Deaths'),missing=rows.filter(r=>!Number.isFinite(r.Affected_Households)).length;
  const crit=new Map();
  if(state.tab!=='ops')for(const r of nationalStations().concat(DATA.bkkStations.filter(x=>x.province==='กรุงเทพมหานคร')))if(fresh(r)&&rank(r)>=4)crit.set(r.province,(crit.get(r.province)||0)+1);
  const ops=state.tab==='ops',regionOf=p=>ops?'':DATA.vulnerable.find(v=>v.province===p)?.region||'';
  const g=DashboardModel.situationGroups(rows,regionOf,p=>crit.get(p)||0);
  const count=list=>list.reduce((n,x)=>n+x.items.length,0),short=r=>String(r).replace('เขตสุขภาพที่ ','เขต ');
  const section=(head,list)=>list.length?{head:head+' ('+fmt(count(list))+' จังหวัด)',items:list.map(x=>(ops?'':short(x.region)+' ')+x.items.map(i=>i.province).join(' '))}:null;
  const facts=['ครัวเรือนที่ได้รับผลกระทบ: '+fmt(hh)+' ครัวเรือน'].concat(deaths==null?[]:['ผู้เสียชีวิตตามรายงาน: '+fmt(deaths)+' ราย']);
  const sections=[{head:'สถานการณ์น้ำ ณ วันรายงาน — พื้นที่ต้องเฝ้าระวัง'}].concat([
   section('สถานการณ์วิกฤต',g.critical),section('เฝ้าระวังสูง',g.high),section('สถานการณ์เริ่มทรงตัว',g.stabilizing),section('ยังไม่มีแนวโน้มระดับน้ำในรายงาน',g.unknown)].filter(Boolean));
  const notes=[];
  if(missing)notes.push('ครัวเรือน: ไม่รวม '+fmt(missing)+' จังหวัดที่รายงานไม่มีตัวเลข');
  if(deaths!=null)notes.push('ผู้เสียชีวิต: นับเฉพาะจังหวัดที่ระบุตัวเลข');
  if(state.tab!=='ops'&&failed('thai_water_DB'))notes.push('<b>อ่านข้อมูลสถานีน้ำไม่สำเร็จ จึงยังแยกระดับวิกฤตไม่ได้</b>');
  if(state.tab==='ops')notes.push('จัดกลุ่มจากรายงาน ปภ. วันที่เลือกเท่านั้น (ไม่ใช้ข้อมูลสถานีวัดน้ำ) ไม่ใช่การพยากรณ์ · เฝ้าระวังสูง = น้ำเพิ่มขึ้นหรือทรงตัว · เริ่มทรงตัว = น้ำลดลง');else notes.push('จัดกลุ่มตามเขตสุขภาพ จากรายงาน ปภ. วันที่เลือกและสถานีวัดน้ำที่ข้อมูลไม่เกิน 24 ชั่วโมง ไม่ใช่การพยากรณ์ · วิกฤต = น้ำเพิ่มขึ้น + มีสถานีวิกฤต/ล้นตลิ่งอย่างน้อย 1 แห่งในจังหวัด · เฝ้าระวังสูง = น้ำเพิ่มขึ้นแต่ไม่มีสถานีวิกฤต หรือทรงตัว · เริ่มทรงตัว = น้ำลดลง');
  situationBlock(host,day+' พื้นที่ประสบภัย '+fmt(provinces)+' จังหวัด'+(hasBkk?' และ กทม.':''),facts,sections,notes.map(n=>n.startsWith('<b>')?n:esc(n)));
  return;
 }
 // Bangkok
 const r=reports.find(x=>x.Province==='กรุงเทพมหานคร');
 const stations=DATA.bkkStations.filter(x=>x.province==='กรุงเทพมหานคร'&&fresh(x)),stationsFailed=failed('BKK_water_DB');
 const byDistrict=new Map();
 for(const s of stations){const d=String(s.district_or_area??'').replace(/^เขต/,'').trim();if(d){if(!byDistrict.has(d))byDistrict.set(d,[]);byDistrict.get(d).push(s)}}
 const level=new Map(Array.from(byDistrict,([d,rows])=>{const sm=districtWaterSummary(rows);return [d,WATER_STATUS[sm.status]?.rank||0]}));
 const inLevel=f=>Array.from(level).filter(([,v])=>f(v)).map(([d])=>d).sort((a,b)=>a.localeCompare(b,'th'));
 const critD=inLevel(v=>v>=4),warnD=inLevel(v=>v===3),critS=stations.filter(x=>rank(x)>=4).length,warnS=stations.filter(x=>rank(x)===3).length;
 const shelters=DATA.shelters,sf=failed('shelter_DB'),st=s=>getShelterStatus(s);
 const fullDistricts=districts.filter(d=>{const s=shelters.filter(x=>x.district===d);return s.length>0&&s.every(x=>st(x)==='เต็ม')});
 const trend=r?String(r.Water_Level_Trend??'').replace(/^ระดับน้ำ/,'').trim():'';
 const facts=[];
 if(r){if(Number.isFinite(r.Casualties_Deaths))facts.push('ผู้เสียชีวิตตามรายงาน: '+fmt(r.Casualties_Deaths)+' ราย');if(trend)facts.push('แนวโน้มระดับน้ำตามรายงาน ปภ.: '+trend)}
 else facts.push('ไม่มีรายงานภัยจาก ปภ. ในวันที่เลือก');
 const sections=[];
 if(stationsFailed)facts.push('อ่านข้อมูลสถานีวัดน้ำ กทม. ไม่สำเร็จ');
 else{
  facts.push('สถานีวัดน้ำที่ข้อมูลไม่เกิน 24 ชั่วโมง: '+fmt(stations.length)+' แห่ง (วิกฤต/ล้นตลิ่ง '+fmt(critS)+' · เตือนภัย '+fmt(warnS)+')');
  sections.push(critD.length?{head:'เขตที่มีสถานีวิกฤต / ล้นตลิ่ง ('+fmt(critD.length)+' เขต)',items:[critD.join(' ')]}:{head:'ไม่มีเขตที่มีสถานีวิกฤต / ล้นตลิ่ง'});
  if(warnD.length)sections.push({head:'เขตที่ระดับน้ำสูงสุดอยู่ที่เตือนภัย ('+fmt(warnD.length)+' เขต)',items:[warnD.join(' ')]});
 }
 if(sf)sections.push({head:'ศูนย์พักพิง: อ่านข้อมูลไม่สำเร็จ'});
 else sections.push({head:'ศูนย์พักพิง',items:['ทั้งหมด '+fmt(shelters.length)+' แห่ง · ผู้พัก '+fmt(sum(shelters,'occupied'))+' คน จากความจุ '+fmt(sum(shelters,'capacity'))+' คน','เต็ม '+fmt(shelters.filter(x=>st(x)==='เต็ม').length)+' แห่ง · ใกล้เต็ม '+fmt(shelters.filter(x=>st(x)==='ใกล้เต็ม').length)+' แห่ง'].concat(fullDistricts.length?['เขตที่ศูนย์เต็มทุกแห่ง: '+fullDistricts.join(' ')]:[])});
 situationBlock(host,day+' กรุงเทพมหานคร',facts,sections,[esc('นับจากข้อมูลล่าสุดในฐานข้อมูล: เขตจัดระดับจากสถานีที่รุนแรงที่สุดในเขต (ข้อมูลไม่เกิน 24 ชั่วโมง) ไม่ใช่การพยากรณ์ ไม่รวมสถานีขัดข้อง/ไม่ทราบสถานะ')],true);
}

function renderAreas(){
  const bkk = state.tab === 'bkk';
  const all = getReports();
  const allowed = allowedProvinces();
  const reports = all.filter(r => bkk ? r.Province === 'กรุงเทพมหานคร' : allowed.includes(r.Province));

  if(state.tab==='bkk'){
    $('areaTitle').textContent='ข้อมูลผู้มาใช้ศูนย์พักพิงรายเขต';
    const rows=districts.filter(x=>!state.district||x===state.district).map(x=>{
      let s=currentShelters.filter(r=>r.district===x),w=DATA.bkkStations.filter(r=>r.province==='กรุงเทพมหานคร'&&r.district_or_area===x);
      return {name:x,stations:w.length,old:w.filter(r=>quality(r)==='ข้อมูลเก่าเกิน 24 ชั่วโมง').length,centers:s.length,occupied:s.length?sum(s,'occupied'):null,available:s.length?sum(s,'available'):null,over:s.length?s.filter(r=>r.occupied>r.capacity).length:null}
    }).sort((a,b)=>(b.over||0)-(a.over||0)||(b.occupied||0)-(a.occupied||0));
    const headers=['เขต','ศูนย์พักพิงที่มีรายงาน (แห่ง)','ผู้พัก (คน)','ที่ว่าง (คน)','เกินความจุ (แห่ง)'];
    $('areaTable').innerHTML=table(headers,rows.map(r=>[`<button class="linkbutton" data-district="${esc(r.name)}">${esc(r.name)}</button>`,fmt(r.centers),fmt(r.occupied),fmt(r.available),r.over?badge(fmt(r.over),'bad'):fmt(r.over)]));
    csvRows=[headers,...rows.map(r=>[r.name,r.centers,r.occupied??'ไม่มีข้อมูล',r.available??'ไม่มีข้อมูล',r.over??'ไม่มีข้อมูล'])];
  } else {
    $('areaTitle').textContent='รายละเอียดจังหวัดตามจำนวนครัวเรือนที่ประสบภัย และแนวโน้มรายจังหวัด';
    const ops=state.tab==='ops',headers=['จังหวัด',...(ops?[]:['เขตสุขภาพ']),'อำเภอ','ตำบล','หมู่บ้าน','ครัวเรือน','เสียชีวิต','น้ำ','สถานะ'];
    const rows=allowed.map(p=>{
      const r=reports.find(x=>x.Province===p),v=DATA.vulnerable.find(x=>x.province===p);
      return {p,r,region:v?.region||'ไม่มีข้อมูล'}
    }).filter(row => row.r && row.r.Current_Status === 'กำลังประสบภัย').sort((a,b) => (b.r?.Affected_Households||0) - (a.r?.Affected_Households||0));
    $('areaTable').innerHTML=table(headers,rows.map(({p,r,region})=>[
      `<button class="linkbutton" data-province="${esc(p)}">${esc(p)}</button>`, ...(ops?[]:[esc(region)]),
      r ? `<div style="max-width:140px;white-space:normal;font-size:13px">${esc(r.District_Names||(r.Affected_Districts_Count??'-'))}</div>` : '—',
      r ? `<div style="text-align:right">${esc(r.Affected_Subdistricts_Count??'-')}</div>` : '—',
      r ? `<div style="text-align:right">${esc(r.Affected_Villages_Count??'-')}</div>` : '—',
      r ? `${householdBadge(r.Affected_Households)}` : '—',
      r ? `<div style="text-align:right">${r.Casualties_Deaths==null?'-':fmt(r.Casualties_Deaths)}</div>` : '—',
      r ? `<span class="badge" style="${trendBadgeStyle(r.Water_Level_Trend)}">${esc(r.Water_Level_Trend)}</span>` : '—',
      r ? badge(r.Current_Status, r.Current_Status==='กำลังประสบภัย'?'warn':'') : badge('ไม่มีรายงาน')
    ]));
    csvRows=[headers,...rows.map(({p,r,region})=>[
      p, ...(ops?[]:[region]), r?.District_Names||(r?.Affected_Districts_Count??'-'), r?.Affected_Subdistricts_Count??'-', r?.Affected_Villages_Count??'-', r?.Affected_Households??'-', r?.Casualties_Deaths??'-', r?.Water_Level_Trend??'-', r?.Current_Status??'ไม่มีรายงาน'
    ])];
  }
}

function renderStations(){
 const source=state.tab==='bkk'?'BKK_water_DB':'thai_water_DB';
 const sourceRows=state.tab==='bkk'?DATA.bkkStations.filter(r=>r.province==='กรุงเทพมหานคร'):nationalStations();
 const latest=DashboardModel.latestStationDay(sourceRows,DATA.sourceStatus[source]?.loadedAt||DATA.loadedAt);
 const scoped=new Set(currentStations);
 const rows=latest.rows.filter(r=>scoped.has(r)).sort((a,b)=>{
    const sa = canonicalWaterStatus(a.flood_status_source);
    const sb = canonicalWaterStatus(b.flood_status_source);
    const rankA = WATER_STATUS[sa]?.rank || 0;
    const rankB = WATER_STATUS[sb]?.rank || 0;
    if (rankA !== rankB) return rankB - rankA;
    const timeA = timestamp(a.observed_at_th || a.updated_at_source || a.Ingested_At) || 0;
    const timeB = timestamp(b.observed_at_th || b.updated_at_source || b.Ingested_At) || 0;
    return timeB - timeA;
  });$('stationSub').textContent=`${latest.day?'เฉพาะวันที่ตรวจวัดล่าสุด '+date(latest.day+'T00:00:00+07:00'):'ไม่มีข้อมูลตรวจวัดที่ระบุเวลาได้'} · ${fmt(rows.length)} สถานีในพื้นที่เลือก · ใช้รายการล่าสุดของแต่ละสถานีในวันนั้น ไม่รวมวันอื่น · ระดับน้ำเป็นเมตร รทก. ไม่ใช่ความลึกน้ำท่วม · ไม่รวมสถานีขัดข้อง/ไม่ทราบสถานะ ${fmt(state.tab==='bkk'?DATA.excludedStations.bkk:DATA.excludedStations.national)} แห่ง`;$('stationTable').innerHTML=table(['สถานี',state.tab==='bkk'?'เขต':'พื้นที่','ระดับน้ำ (ม. รทก.)','สถานะต้นทาง','เวลาตรวจวัด'],rows.map(r=>[esc(r.station_name),esc(r.district_or_area),typeof r.water_in_m_msl==='number'?r.water_in_m_msl.toFixed(2):'ไม่มีข้อมูล',statusBadge(r.flood_status_source),time(r.observed_at_th)]));paginateTables();}
function sourceLinks(rows,label){const urls=uniq(rows.map(r=>r.source_url).filter(Boolean));return 'ที่มา: '+esc(label)+(urls.length?' · '+urls.map((u,i)=>link(u,urls.length===1?'เปิดแหล่งข้อมูล':'แหล่งข้อมูล '+(i+1))).join(' '):' · ไม่มีลิงก์ต้นทางในข้อมูลพื้นที่ที่เลือก')}
const SHELTER_COLORS={'เปิดให้บริการ/ว่าง':'#15803d','ใกล้เต็ม':'#ea580c','เต็ม':'#dc2626'};
function shelterStatusColor(status){return SHELTER_COLORS[String(status??'').trim()]||'#64748b'}
function shelterLegend(){return '<strong>หมุดศูนย์พักพิง:</strong>'+Object.entries(SHELTER_COLORS).map(([status,color])=>`<span><i class="shelter-symbol" style="--shelter-color:${color}" aria-hidden="true"></i> ${esc(status)}</span>`).join('')+'<span><i class="shelter-symbol" style="--shelter-color:#64748b" aria-hidden="true"></i> ไม่ทราบ / สถานะอื่น</span>'}
// DOH temporary-shelter sanitation assessments (doh_shelter.json, written in CI; only published with the GitHub Pages build).
// Loaded the first time the layer is switched on; the latest assessment of each shelter is drawn, coloured by its grade.
const DOH_COLORS={3:'#2f8a4a',2:'#b87a14',1:'#b34540'},DOH_LABELS={3:'ดี',2:'พอใช้',1:'ต้องปรับปรุง'},doh={all:null,rows:null,loading:false,failed:false};
function loadDoh(){
 if(doh.rows||doh.loading||doh.failed)return;
 doh.loading=true;
 fetch('doh_shelter.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(d=>{doh.all=(d.records||[]).filter(r=>r.is_latest);doh.rows=doh.all.filter(r=>r.lat!=null&&r.lon!=null)}).catch(()=>{doh.failed=true}).finally(()=>{doh.loading=false;if(state.tab==='ops')render()});
}
function addDohShelterPins(){
 if(!doh.rows){loadDoh();$('healthRegionStatus').textContent=doh.failed?'โหลดข้อมูลศูนย์พักพิง DOH ไม่สำเร็จ (มีเฉพาะเว็บ GitHub Pages)':'กำลังโหลดศูนย์พักพิง DOH…';return}
 for(const r of doh.rows){
  const color=r.level?DOH_COLORS[r.level]:'#ffffff';
  L.circleMarker([r.lat,r.lon],{radius:8,color:r.level?'#fff':'#475569',weight:2,fillColor:color,fillOpacity:.95}).bindTooltip(esc(r.name)+' · '+esc(r.province)+' · ระดับ'+(DOH_LABELS[r.level]||'ไม่มีข้อมูล')).addTo(layers);
 }
 $('healthRegionStatus').textContent=($('healthRegionStatus').textContent?$('healthRegionStatus').textContent+' · ':'')+fmt(doh.rows.length)+' ศูนย์พักพิง DOH';
}
function addShelterPins(target,rows){
 const valid=rows.filter(validCoordinates);
 const group=L.layerGroup().addTo(target);
 for(const r of valid){
  const status=shelterStatusKey(r),color=shelterStatusColor(status);
  L.marker([r.latitude,r.longitude],{icon:L.divIcon({className:'shelter-pin',html:`<span class="shelter-symbol" style="--shelter-color:${color}" aria-hidden="true"></span>`,iconSize:[44,44],iconAnchor:[22,30]}),title:'ศูนย์พักพิง '+r.shelter_name+' · '+status}).bindPopup(`<b>${esc(r.shelter_name)}</b><br>เขต${esc(r.district)}<br><b>สถานะ: ${esc(status)}</b><br>ผู้พัก ${fmt(r.occupied)} / ความจุ ${fmt(r.capacity)} คน<br>ที่ว่าง ${fmt(r.available)} คน${Number.isFinite(r.occupied)&&Number.isFinite(r.capacity)&&r.occupied>r.capacity?'<br><b>ผู้พักเกินความจุที่ระบุ</b>':''}<br>ดึงข้อมูล: ${time(r.fetched_at_th)}<br>ศูนย์เปลี่ยนค่าล่าสุด: ${time(r.updated_at_source)}<br>${esc(quality(r))}`).addTo(group);
 }
 return valid.map(r=>[r.latitude,r.longitude]);
}

const getShelterStatus = r => { let s=String(r.status_source||'').trim(); return s==='เปิดให้บริการ/ว่าง'?'ว่าง':s==='ใกล้เต็ม'?'ใกล้เต็ม':s==='เต็ม'?'เต็ม':'ไม่ทราบ'; };
function renderShelterMap(){
 if(state.tab!=='bkk'||!window.L)return;
 if(!shelterMap){shelterScope=null;shelterMap=L.map('shelterMap',{scrollWheelZoom:false,zoomSnap:0.5,zoomDelta:0.5,maxZoom:14}).setView([13.75,100.55],10);shelterLayers=L.layerGroup().addTo(shelterMap)}
 shelterMap.invalidateSize({pan:false});shelterLayers.clearLayers();
 
 const waterRows2=DATA.bkkStations.filter(r=>r.province==='กรุงเทพมหานคร');
 const activeStatuses2=new Set(waterRows2.map(r=>canonicalWaterStatus(r.flood_status_source)));
 $('shelterMapLegend2').innerHTML='<span style="font-weight:bold;margin-right:8px">สถานะน้ำสูงสุดรายเขต:</span>'+['วิกฤต','เตือนภัย','ปกติ','ขัดข้อง / ขัดข้องชั่วคราว'].filter(s=>activeStatuses2.has(s)).map(s=>`<span><i class="dot" style="background:${WATER_STATUS[s]?.color||'#94a3b8'}"></i>${s}</span>`).join('')+'<span>สีเทา/ไม่ระบายสี: ไม่มีสถานีหรือไม่มีสถานะล่าสุดที่ใช้ได้</span>';

 $('shelterStatusLegend').innerHTML=shelterLegend();updateBkkMapKey(shelterMap,true);

 if(!window.BKK_DISTRICTS_GEOJSON)$('shelterMapSubtitle').textContent='โหลดขอบเขตไม่สำเร็จ · ยังแสดงศูนย์พักพิงตามพิกัด';
 const waterRows=currentStations;
 const activeStatuses=new Set(waterRows.map(r=>canonicalWaterStatus(r.flood_status_source)));
 const distSummaries=new Map();
 const maxRank=Math.max(1,...waterRows.filter(r=>quality(r)==='ภายใน 24 ชั่วโมง').map(r=>WATER_STATUS[canonicalWaterStatus(r.flood_status_source)]?.rank||1));
 const heatData=waterRows.filter(r=>typeof r.latitude==='number'&&typeof r.longitude==='number').map(r=>{
   const st=canonicalWaterStatus(r.flood_status_source), q=quality(r);
   const rank=WATER_STATUS[st]?.rank||0;

   return [r.latitude,r.longitude,q!=='ภายใน 24 ชั่วโมง'?0:rank/maxRank];
 }).filter(d=>d[2]>0);
 
 if(heatData.length && L.heatLayer) safeHeatLayer(heatData,{radius:40,blur:20,maxZoom:14,max:1.0,minOpacity:0.05,gradient:{.3:'#93c5fd',.5:'#3b82f6',.7:'#1d4ed8',1:'#082f6b'}}).addTo(shelterLayers);


 for(const name of districts)distSummaries.set(name,districtWaterSummary(waterRows.filter(r=>String(r.district_or_area??'').replace(/^เขต/,'').trim()===name)));
 L.geoJSON(window.BKK_DISTRICTS_GEOJSON||{type:'FeatureCollection',features:[]}, {
   style(feature){const name=feature.properties.amp_th,summary=distSummaries.get(name)||districtWaterSummary([]),active=!state.district||state.district===name;return {className:'bkk-district',color:summary.status?summary.color:(active?'#334155':'#94a3b8'),weight:summary.status?3:(state.district===name?2.5:1),fillColor:'transparent',fillOpacity:0}},
   onEachFeature(feature,layer){
    const name=feature.properties.amp_th,summary=distSummaries.get(name)||districtWaterSummary([]);
    layer.bindTooltip(`<b>เขต${esc(name)}</b><br>${summary.drivers.length?`สถานีวิกฤต/เตือนภัยสูงสุด: ${esc(summary.status)} (${summary.drivers.length} แห่ง)`:`จุดวัดน้ำ: ${summary.status||'ไม่มีข้อมูลผ่านเกณฑ์'}`}`);
    layer.on('click',()=>{state.district=state.district===name?'':name;$('district').value=state.district;render()});
   }
 }).addTo(shelterLayers);


 const filteredShelters=currentShelters;
 const pts=addShelterPins(shelterLayers, filteredShelters);
 
 shelterMap.invalidateSize();
 if(shelterScope!==state.district){shelterScope=state.district;fitShelters(pts)}
 
 const latestShelterTime = DashboardModel.latestTime(filteredShelters, 'fetched_at_th'), timeStr = Number.isFinite(latestShelterTime) ? new Date(latestShelterTime).toISOString() : '';
 $('shelterMapSource').innerHTML = sourceLinks(filteredShelters,'ระบบช่วยเหลือผู้ประสบภัย กรุงเทพมหานคร')+`<br><b>ปรับปรุงข้อมูล:</b> ${timeStr ? time(timeStr) : 'ไม่ระบุ'} · แสดงพิกัด ${pts.length} จาก ${filteredShelters.length} แห่ง`;
 $('shelterMapNote').innerHTML = '<b style="color:#334155">คำอธิบายแผนที่:</b><br/>' + '• <b>เส้นกรอบเขต:</b> สีบ่งบอกสถานะของสถานีน้ำที่รุนแรงที่สุดในเขตนั้นๆ<br/>' + (heatData.length ? '• <b>Heatmap (สีฟุ้ง):</b> แสดงจุดหนาแน่นของสถานีน้ำ <i>*ไม่ใช่พื้นที่น้ำท่วมจริง</i><br/>' : '• <b>Heatmap:</b> (ไม่มีข้อมูลสถานีอัปเดตใน 24 ชม. จึงไม่แสดง Heatmap)<br/>') + '• <b>หมุด:</b> ตำแหน่งศูนย์พักพิง กรองตามสถานะที่เลือกไว้ด้านบน';
 

}


// Shows how many shelters each status chip stands for and, when a status is switched off, how many shelters are hidden.
// These chips filter the pins on both Bangkok maps AND the shelter cards and tables, so the hidden count is spelled out
// next to the chips instead of leaving the user to wonder where the shelters went.
function renderShelterToolbar(){
 if(state.tab!=='bkk')return;
 const rows=DATA.shelters.filter(r=>!state.district||r.district===state.district),counts={};
 for(const r of rows){const k=shelterStatusKey(r);counts[k]=(counts[k]||0)+1}
 document.querySelectorAll('.chip-count').forEach(el=>{el.textContent=fmt(counts[el.dataset.status]||0)});
 const off=Array.from(document.querySelectorAll('.shelter-status-filter')).filter(cb=>!cb.checked).map(cb=>cb.value);
 const hidden=off.reduce((n,v)=>n+(counts[v]||0),0),note=$('shelterFilterNote');
 if(!note)return;
 note.innerHTML=off.length?'<b>ซ่อนศูนย์พักพิง '+fmt(hidden)+' จาก '+fmt(rows.length)+' แห่ง</b> ตามสถานะที่ปิดอยู่ · แผนที่ ตัวเลขการ์ดและตารางศูนย์พักพิงด้านล่างใช้ตัวกรองเดียวกัน <button type="button" class="linkbutton" id="showAllShelters">แสดงทั้งหมด</button>':'';
 const all=$('showAllShelters');
 if(all)all.onclick=()=>{document.querySelectorAll('.shelter-filter,.shelter-status-filter').forEach(cb=>{cb.checked=true});render()};
}

function renderShelterDetails(){
 const getStatus = r => { let s=String(r.status_source||'').trim(); return s==='เปิดให้บริการ/ว่าง'?'ว่าง':s==='ใกล้เต็ม'?'ใกล้เต็ม':s==='เต็ม'?'เต็ม':'ไม่ทราบ'; };
 const bkkShelters = currentShelters;
 const allowedStatuses = new Set(Array.from(document.querySelectorAll('.shelter-filter:checked')).map(cb=>cb.dataset.filter));
 const filteredShelters = bkkShelters.filter(r=>allowedStatuses.has(getShelterStatus(r)));
 
 const totalShelters = bkkShelters.length;
 const fullShelters = bkkShelters.filter(r => getShelterStatus(r) === 'เต็ม').length;
 const almostFullShelters = bkkShelters.filter(r => getShelterStatus(r) === 'ใกล้เต็ม').length;
 
 // Districts whose every shelter is full. Uses all shelters (not the status checkboxes) and skips districts with no shelter in the data.
 const targetDistricts = state.district ? [state.district] : districts;
 const fullDistricts = targetDistricts.filter(d => {
   const sInD = DATA.shelters.filter(r => r.district === d);
   return sInD.length > 0 && sInD.every(r => getShelterStatus(r) === 'เต็ม');
 }).length;
 
 $('shelterCards').innerHTML = 
   card('ศูนย์พักพิงทั้งหมด', totalShelters, 'แห่ง', state.district ? `ในเขต${state.district}` : 'ใน กทม.') +
   card('ศูนย์ที่เต็มแล้ว', fullShelters, 'แห่ง', 'ไม่สามารถรับผู้พักเพิ่มได้', true) +
   card('ศูนย์ที่ใกล้เต็ม', almostFullShelters, 'แห่ง', 'ต้องเฝ้าระวังพิเศษ', true) +
   card('เขตที่ศูนย์พักพิงเต็มทุกแห่ง', fullDistricts, 'เขต', `จาก ${targetDistricts.length} เขต · ไม่นับเขตที่ไม่มีศูนย์ในข้อมูล`);

renderShelterTable(filteredShelters.filter(r=>['เต็ม','ใกล้เต็ม'].includes(getShelterStatus(r))));renderAllSheltersTable(filteredShelters);
}

function renderAllSheltersTable(shelters) {
  const sorted = [...shelters].sort((a,b) => {
    const rank = s => s==='เต็ม'?3 : s==='ใกล้เต็ม'?2 : s==='ว่าง'?1 : 0;
    const diff = rank(getShelterStatus(b)) - rank(getShelterStatus(a));
    if(diff !== 0) return diff;
    return (a.district||'').localeCompare(b.district||'','th');
  });
  
  const rowsHtml = sorted.map(s => {
    const st = getShelterStatus(s);
    const stColor = st==='เต็ม'?'#dc2626':st==='ใกล้เต็ม'?'#ea580c':st==='ว่าง'?'#16a34a':'#64748b';
    return `<tr>
      <td>${esc(s.district||'ไม่ระบุ')}</td>
      <td>${esc(s.shelter_name)}</td>
      <td class="num">${fmt(s.capacity)}</td>
      <td class="num">${fmt(s.occupied)}</td>
      <td style="color:${stColor}; font-weight:600">${esc(st)}</td>
    </tr>`;
  }).join('');
  
  $('allSheltersBody').innerHTML = `<table class="data-table">
    <thead>
      <tr style="position: sticky; top: 0; background: #fff; z-index: 1;">
        <th>เขต</th>
        <th>ชื่อศูนย์พักพิง</th>
        <th class="num">ความจุ (คน)</th>
        <th class="num">ผู้ใช้บริการ (คน)</th>
        <th>สถานะ</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="5" style="text-align:center;color:#666">ไม่มีศูนย์พักพิงในพื้นที่นี้</td></tr>'}
    </tbody>
  </table>`;
}

function renderShelterTable(shelters) {
  const sorted = [...shelters].sort((a,b) => {
    const sa = getShelterStatus(a);
    const sb = getShelterStatus(b);
    const rank = s => s==='เต็ม'?3 : s==='ใกล้เต็ม'?2 : s==='ว่าง'?1 : 0;
    if(rank(sb) !== rank(sa)) return rank(sb) - rank(sa);
    return (a.district||'').localeCompare(b.district||'','th');
  });
  
  const rowsHtml = sorted.map(s => {
    const st = getShelterStatus(s);
    const stColor = st==='เต็ม'?'#dc2626':st==='ใกล้เต็ม'?'#ea580c':st==='ว่าง'?'#16a34a':'#64748b';
    return `<tr>
      <td>${esc(s.district||'ไม่ระบุ')}</td>
      <td>${esc(s.shelter_name)}</td>
      <td style="color:${stColor}; font-weight:600">${esc(st)}</td>
      <td class="num">${fmt(s.occupied)} / ${fmt(s.capacity)}</td>
    </tr>`;
  }).join('');
  
  $('shelterSideBody').innerHTML = `<table class="data-table">
    <thead>
      <tr style="position: sticky; top: 0; background: #f8fafc; z-index: 1;">
        <th>เขต</th>
        <th>ชื่อศูนย์พักพิง</th>
        <th>สถานะ</th>
        <th class="num">ผู้พัก / ความจุ</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="4" style="text-align:center;color:#666">ไม่มีศูนย์พักพิงในเงื่อนไขที่เลือก</td></tr>'}
    </tbody>
  </table>`;
}

const WATER_STATUS=DashboardModel.WATER_STATUS;
const canonicalWaterStatus=DashboardModel.canonicalWaterStatus;
const districtWaterSummary=rows=>DashboardModel.districtSummary(rows,quality);
function renderDistrictWaterMap(fit=false){
 $('districtShelterLegend').innerHTML=shelterLegend();
 
 if(!window.BKK_DISTRICTS_GEOJSON){$('mapSubtitle').textContent='โหลดเส้นแบ่งเขตไม่สำเร็จ กรุณารีเฟรชอีกครั้ง';map.setView([13.75,100.55],10);return}
 const rows=DATA.bkkStations.filter(r=>r.province==='กรุงเทพมหานคร'),summaries=new Map();const activeStatuses=new Set(rows.map(r=>canonicalWaterStatus(r.flood_status_source))); const knownLegend=Object.entries(WATER_STATUS).filter(([label])=>activeStatuses.has(label)).map(([label,value])=>`<span><i class="dot" style="border-radius:2px;background:${value.color}"></i>${label}</span>`).join(''); const unknownStatuses=Array.from(activeStatuses).filter(s=>s&&!WATER_STATUS[s]); const unknownLegend=unknownStatuses.length?`<span><i class="dot" style="border-radius:2px;background:#94a3b8"></i>${esc(unknownStatuses.join(' / '))}</span>`:''; $('districtWaterLegend').innerHTML=knownLegend+unknownLegend+'<span>สีเทา/ไม่ระบายสี: ไม่มีสถานีหรือไม่มีสถานะล่าสุดที่ใช้ได้</span>';
 for(const name of districts)summaries.set(name,districtWaterSummary(rows.filter(r=>String(r.district_or_area??'').replace(/^เขต/,'').trim()===name)));
 let selected=null;
 const area=L.geoJSON(window.BKK_DISTRICTS_GEOJSON,{
  style(feature){const name=feature.properties.amp_th,summary=summaries.get(name)||districtWaterSummary([]),active=!state.district||state.district===name;return {className:'bkk-district',color:summary.status?summary.color:(active?'#334155':'#94a3b8'),weight:summary.status?3:(state.district===name?2.5:1),fillColor:'transparent',fillOpacity:0}},
  onEachFeature(feature,layer){const name=feature.properties.amp_th,summary=summaries.get(name)||districtWaterSummary([]),stations=rows.filter(r=>String(r.district_or_area??'').replace(/^เขต/,'').trim()===name),old=stations.filter(r=>quality(r)!=='ภายใน 24 ชั่วโมง').length;
   layer.bindTooltip(`<b>เขต${esc(name)}</b><br>${esc(summary.label)} · ${fmt(stations.length)} สถานี`);
   const details=summary.drivers.map(r=>`${esc(r.station_name)} — ${time(r.observed_at_th)} (${esc(quality(r))})`).join('<br>');
   layer.bindPopup(`<b>เขต${esc(name)}</b><br>สถานะรุนแรงที่สุด: ${esc(summary.label)}<br>สถานีในข้อมูล ${fmt(stations.length)} แห่ง<br>ข้อมูลเก่า / เวลาไม่ผ่านเกณฑ์ ${fmt(old)} แห่ง${details?'<hr><b>สถานีที่กำหนดสีเขต</b><br>'+details:''}${!summary.status&&stations.length?'<br>สถานะต้นทาง: '+esc(uniq(stations.map(r=>r.flood_status_source||'ไม่ระบุ')).join(', ')):''}`);
   if(name===state.district)selected=layer;
  }
 }).addTo(layers);
 if($('showShelterPins').checked)addShelterPins(layers,currentShelters);
 // heatmap drawn below
 // Draw heatmap for BKK stations
 $('districtWaterNote').textContent='โหลด Heatmap ไม่สำเร็จ · เส้นเขตและหมุดศูนย์พักพิงยังใช้งานได้';
 if(window.L && L.heatLayer){
   const maxRank=Math.max(1,...currentStations.filter(r=>quality(r)==='ภายใน 24 ชั่วโมง').map(r=>WATER_STATUS[canonicalWaterStatus(r.flood_status_source)]?.rank||1));
   const heatData=currentStations.filter(r=>typeof r.latitude==='number'&&typeof r.longitude==='number').map(r=>{
     const status=canonicalWaterStatus(r.flood_status_source),q=quality(r);
     const rank=WATER_STATUS[status]?.rank||0;
     const intensity=q!=='ภายใน 24 ชั่วโมง'?0:rank/maxRank;
     return [r.latitude,r.longitude,intensity];
   }).filter(d=>d[2]>0);
   if(heatData.length) safeHeatLayer(heatData,{radius:40,blur:20,maxZoom:14,max:1.0,minOpacity:0.05,gradient:{.15:'#93c5fd',.4:'#3b82f6',.7:'#1d4ed8',1:'#082f6b'}}).addTo(layers);
   $('districtWaterNote').innerHTML = '<b style="color:#334155">คำอธิบายแผนที่:</b><br/>' + '• <b>เส้นกรอบเขต:</b> สีบ่งบอกสถานะของสถานีน้ำที่รุนแรงที่สุดในเขตนั้นๆ (อัปเดต 24 ชม.)<br/>' + (heatData.length ? '• <b>Heatmap (สีฟุ้ง):</b> แสดงจุดหนาแน่นของสถานีน้ำ (ยิ่งสีน้ำเงินเข้ม = วิกฤต) <i>*ไม่ใช่พื้นที่น้ำท่วมจริง</i><br/>' : '• <b>Heatmap:</b> (ไม่มีข้อมูลสถานีอัปเดตใน 24 ชม. จึงไม่แสดง Heatmap)<br/>') + '• <b>หมุด:</b> ตำแหน่งศูนย์พักพิง สามารถกดกรองสถานะ (ว่าง/เต็ม) ได้ที่ปุ่มด้านบน<br/>' + '<i style="color:#64748b; margin-top:4px; display:block">👉 กดคลิกที่พื้นที่แต่ละเขต เพื่อดูรายชื่อสถานีน้ำทั้งหมดในเขตนั้น</i>';
 }
 map._dashboardBounds=(selected||area).getBounds();map.stop();map.invalidateSize({animate:false});if(fit)map.fitBounds(map._dashboardBounds,{padding:[24,24],maxZoom:13,animate:false});
}
function householdBadge(n){
 const color=householdBorderColor(n);
 const foreground=Number.isFinite(n)&&n>=(state.tab==='ops'?1000:100000)?'#fff':'#172b36';
 return `<strong class="household-badge" style="background-color:${color};color:${foreground}">${fmt(n)}</strong>`;
}
function householdColor(n){return n===undefined||n===null?null:n>=100000?'#dc2626':n>=10000?'#f97316':n>=1000?'#facc15':'#22c55e'}
const householdBorderColor=n=>DashboardModel.householdBorderColor(n,state.tab==='ops');
// Water-level trend colours: the operations tab (DDPM only) uses red/yellow/green so they do not clash with its blue household scale.
const trendColors=()=>state.tab==='ops'?{up:'#dc2626',steady:'#facc15',down:'#22c55e'}:{up:'#082f6b',steady:'#3b82f6',down:'#93c5fd'};
const trendBadgeStyle=t=>{const c=trendColors();return t==='เพิ่มขึ้น'?'background:'+c.up+';color:#fff':t==='ทรงตัว'?'background:'+c.steady+';color:'+(state.tab==='ops'?'#000':'#fff'):t==='ลดลง'?'background:'+c.down+';color:'+(state.tab==='ops'?'#fff':'#082f6b'):'background:#e2e8f0;color:#64748b'};
function updateBkkMapKey(target, showPins){
 if(!target._bkkKey){
  const control=L.control({position:'bottomright'});
  control.onAdd=()=>{const el=L.DomUtil.create('details','bkk-map-key');el.open=true;
   el.innerHTML='<summary>คำอธิบายแผนที่</summary><div class="bkk-key-content"></div>';
   L.DomEvent.disableClickPropagation(el);L.DomEvent.disableScrollPropagation(el);return el;};
  control.addTo(target);target._bkkKey=control;
  const container=target.getContainer();
  let layout=container.parentElement;
  if(!layout.classList.contains('bkk-map-layout')){
   layout=document.createElement('div');layout.className='bkk-map-layout';
   container.before(layout);layout.append(container);
  }
  layout.classList.add('has-bkk-key');
  layout.append(control.getContainer());
  requestAnimationFrame(()=>{target.invalidateSize({pan:false});
   if(target===map){mapScope='';renderMap();}
   else fitShelters(currentShelters.filter(validCoordinates).map(r=>[r.latitude,r.longitude]));
  });
 }
 const rows=DATA.bkkStations.filter(r=>r.province==='กรุงเทพมหานคร');
 const statuses=new Set(rows.map(r=>canonicalWaterStatus(r.flood_status_source)));
 target._bkkKey.getContainer().querySelector('.bkk-key-content').innerHTML=
 '<strong>ความเข้มสถานะระดับน้ำ</strong><div class="heat-scale"></div><div class="heat-scale-label"><span>ปกติ (ใส)</span><span>รุนแรง / กระจุกตัว</span></div><hr><strong>เส้นเขต: สถานะน้ำสูงสุด</strong>'+
 Object.entries(WATER_STATUS).filter(([label])=>statuses.has(label)).map(([label,value])=>`<div class="border-key"><i style="border-color:${value.color}"></i>${esc(label)}</div>`).join('')+
 '<div class="border-key"><i style="border-color:#94a3b8"></i>ไม่มีสถานะล่าสุดที่ใช้ได้</div>'+
 (showPins?'<hr><div class="bkk-key-shelters">'+shelterLegend()+'</div>':'')+
 '<small>ใช้สถานีภายใน 24 ชม.<br>สีฟุ้งไม่ใช่ขอบเขตน้ำท่วมจริง</small>';
}
function fitNationalMap(bounds){map._fitting=true;if(bounds?.isValid())map.fitBounds(bounds,{padding:[44,44],maxZoom:11,animate:false});else map.setView([13,101],5);map._fitting=false}
// Keep the data area centred when the container is resized after the first fit (cards / fonts reflow), until the user pans or zooms.
function watchMapResize(){if(map._resizeWatch||!window.ResizeObserver)return;map._resizeWatch=true;map.on('movestart zoomstart',()=>{if(!map._fitting)map._userMoved=true});new ResizeObserver(()=>{if(!map)return;map.invalidateSize({pan:false});if(state.tab==='national'&&!map._userMoved&&map._dashboardBounds)fitNationalMap(map._dashboardBounds)}).observe($('map'))}
function nationalMapKey(ops){
 const control=L.control({position:'bottomleft'});
 control.onAdd=()=>{const el=L.DomUtil.create('div','national-map-key');el.innerHTML='<div class="key-heat"><strong style="color:#3156c5">ความเข้มสถานะระดับน้ำ</strong><div class="heat-scale"></div><div class="heat-scale-label"><span>ปกติ (ใส)</span><span>รุนแรง / กระจุกตัว</span></div></div><div class="key-households"><hr><strong style="color:#991b1b">เส้นขอบ: ครัวเรือนประสบภัย</strong>'+[[100000,'100,000+'],[10000,'10,000–99,999'],[1000,'1,000–9,999'],[1,'1–999'],[null,'ไม่มีข้อมูล'],[0,'0 ครัวเรือน']].map(([n,label])=>`<div class="border-key"><i style="border-color:${householdBorderColor(n)};border-top-width:${n>0?5:1.2}px"></i>${label}</div>`).join('')+'</div><div class="key-doh"><hr><strong style="color:#334155">ศูนย์พักพิง DOH (ผลประเมิน)</strong>'+[['#2f8a4a','ดี'],['#b87a14','พอใช้'],['#b34540','ต้องปรับปรุง'],['#fff;border:2px solid #475569','ไม่มีข้อมูล']].map(([c,l])=>`<div class="border-key"><i class="trend-swatch" style="background:${c};border-radius:50%"></i>${l}</div>`).join('')+'</div><div class="key-trend"><hr><strong style="color:#082f6b">สีพื้น: แนวโน้มระดับน้ำ (ปภ.)</strong>'+[[trendColors().up,'เพิ่มขึ้น'],[trendColors().steady,'ทรงตัว'],[trendColors().down,'ลดลง']].map(([color,label])=>`<div class="border-key"><i class="trend-swatch" style="background:${color}"></i>${label}</div>`).join('')+'</div>';L.DomEvent.disableClickPropagation(el);L.DomEvent.disableScrollPropagation(el);return el};return control;
}
// Leaflet.heat may redraw in an animation frame after its tab is hidden.
function safeHeatLayer(points,options){const layer=L.heatLayer(points,options),redraw=layer._redraw;layer._redraw=function(){if(!this._map||!this._map.getContainer().clientWidth||!this._map.getContainer().clientHeight||!this._heat?._width||!this._heat?._height){this._frame=null;return this}return redraw.call(this)};return layer}
function renderHealthRegionNumbers(){
 if(!map)return;
 if(healthRegionNumbers){healthRegionNumbers.remove();healthRegionNumbers=null}
 if(state.tab==='bkk'||$('showHealthRegionNumbers').getAttribute('aria-pressed')!=='true'||!window.HEALTH_REGIONS_GEOJSON)return;
 if(!map.getPane('healthRegionLabels')){map.createPane('healthRegionLabels');map.getPane('healthRegionLabels').style.zIndex=660;map.getPane('healthRegionLabels').style.pointerEvents='none'}
 healthRegionNumbers=L.layerGroup().addTo(map);
 for(const feature of window.HEALTH_REGIONS_GEOJSON.features){
  const label=String(feature.properties.region||''),number=label.match(/\d+/)?.[0];
  if(!number)continue;
  const boundary=L.geoJSON(feature),center=boundary.getBounds().getCenter();
  L.marker(center,{pane:'healthRegionLabels',interactive:false,keyboard:false,icon:L.divIcon({className:'health-region-number',html:`<span title="${esc(label)}">${esc(number)}</span>`,iconSize:[26,26],iconAnchor:[13,13]})}).addTo(healthRegionNumbers);
 }
}
function renderHealthRegions(){
 if(!map)return;
 renderHealthRegionNumbers();
 if(healthRegionLayer){map.removeLayer(healthRegionLayer);healthRegionLayer=null}
 if(state.tab==='bkk'||!$('showHealthRegions').checked){$('healthRegionStatus').textContent='';return}
 if(!window.HEALTH_REGIONS_GEOJSON){$('healthRegionStatus').textContent='โหลดเส้นเขตสุขภาพไม่สำเร็จ กรุณารีเฟรช';return}
 healthRegionLayer=L.geoJSON(window.HEALTH_REGIONS_GEOJSON,{pane:'healthRegionBoundaries',interactive:false,style:{className:'health-region-outline',color:'#000000',weight:1,lineCap:'butt',opacity:1,fill:false}}).addTo(map);
 $('healthRegionStatus').textContent=window.HEALTH_REGIONS_GEOJSON.features.length+' เขตสุขภาพ';
}
let mapScope='',shelterScope='';
function renderMap(){if(!window.L)return;const scope=[state.tab,state.region,state.province,state.district].join('|');const fit=!map||scope!==mapScope;mapScope=scope;if(!window.L)return;if(!map){$('map').innerHTML='';map=L.map('map',{scrollWheelZoom:false,zoomSnap:0.5,zoomDelta:0.5,maxZoom:13}).setView([13.7,100.5],6); document.getElementById('map').style.background = '#ffffff';map.createPane('nationalBoundaries');map.getPane('nationalBoundaries').style.zIndex=450;map.createPane('trendFill');map.getPane('trendFill').style.zIndex=390;map.getPane('trendFill').style.pointerEvents='none';map.createPane('healthRegionBoundaries');map.getPane('healthRegionBoundaries').style.zIndex=650;map.getPane('healthRegionBoundaries').style.pointerEvents='none';layers=L.layerGroup().addTo(map)}layers.clearLayers();map.setMaxZoom(state.tab==='bkk'?13:11);
if(state.tab==='bkk'){renderHealthRegions();if(nationalBase&&map.hasLayer(nationalBase))map.removeLayer(nationalBase);if(nationalLegend){nationalLegend.getContainer()?.remove();nationalLegend.remove();nationalLegend=null}$('mobileMapKey').replaceChildren();try{renderDistrictWaterMap(fit);updateBkkMapKey(map,$('showShelterPins').checked);}catch(e){console.error("DIST_ERR:", e)} try{renderShelterMap();}catch(e){console.error("SHELTER_ERR:", e)} return}
if(nationalBase&&map.hasLayer(nationalBase))map.removeLayer(nationalBase);
$('map').style.background='#ffffff';
if(map._bkkKey){map._bkkKey.remove();map._bkkKey=null;map.getContainer().parentElement.classList.remove('has-bkk-key');map.invalidateSize({pan:false})}const opsKey=state.tab==='ops';if(nationalLegend&&nationalLegend._ops!==opsKey){nationalLegend.getContainer()?.remove();nationalLegend.remove();nationalLegend=null}if(!nationalLegend){nationalLegend=nationalMapKey(opsKey);nationalLegend._ops=opsKey;nationalLegend.addTo(map)}syncMapKey();
renderHealthRegions();
let selectedBounds=null,allBounds=null;

if (window.PROVINCES_GEOJSON) {
    const allowed = new Set(allowedProvinces());
    const totals = new Map();
    for (const r of getReports()) {
        if (state.tab==='bkk' ? r.Province!=='กรุงเทพมหานคร' : !allowed.has(r.Province)) continue;
        const raw=r.Affected_Households;
        if (raw===null || raw===undefined || String(raw).trim()==='') continue;
        const n=Number(String(raw).replace(/,/g,''));
        if (!Number.isFinite(n) || n<0) continue;
        totals.set(r.Province,(totals.get(r.Province)??0)+n);
    }
    const trends=new Map(),TREND_LABEL={up:'เพิ่มขึ้น',steady:'ทรงตัว',down:'ลดลง'},TREND_COLOR=trendColors();
    for (const r of getReports()) { if (!allowed.has(r.Province)) continue; const k=DashboardModel.trendKind(r.Water_Level_Trend); if (k) trends.set(r.Province,k); }
    const showHouseholds=$('showHouseholds')?.checked!==false;
    const provinceOutline=L.geoJSON(window.PROVINCES_GEOJSON, {
        pane:'nationalBoundaries',
        style(feature) {
            if(!showHouseholds)return {className:'national-province',color:'#94a3b8',weight:1,opacity:.6,fill:true,fillOpacity:0};
            const n=totals.get(feature.properties.pro_th);
            return {className:'national-province',color:householdBorderColor(n),weight:n>0?5:1.2,opacity:n>0?1:.5,fill:true,fillOpacity:0};
        },
        onEachFeature(feature,layer) {
            const prov=feature.properties.pro_th,n=totals.get(prov);
            if(allowed.has(prov)){if(!allBounds)allBounds=L.latLngBounds([]);allBounds.extend(layer.getBounds());if(trends.has(prov)){if(!selectedBounds)selectedBounds=L.latLngBounds([]);selectedBounds.extend(layer.getBounds())}}
            const inScope=state.tab==='bkk'?prov==='กรุงเทพมหานคร':allowed.has(prov);
            layer.bindTooltip(`<b>${esc(prov)}</b><br>${!inScope?'นอกพื้นที่ที่เลือก':n===undefined?'ไม่มีข้อมูลครัวเรือนในวันที่เลือก':fmt(n)+' ครัวเรือน'}${trends.has(prov)?'<br>แนวโน้มระดับน้ำ: '+TREND_LABEL[trends.get(prov)]:''}<br>${date(state.date+'T00:00:00+07:00')}`);
        }
    }).addTo(layers);
    // Solid, fully opaque colour by water-level trend (rising / steady / falling): the same colours as the trend badges in the tables. Drawn under the heatmap and the outlines; not interactive.
    if ($('showTrendFill')?.checked && trends.size) L.geoJSON(window.PROVINCES_GEOJSON, {pane:'trendFill',interactive:false,filter:f=>trends.has(f.properties.pro_th),style:f=>({stroke:false,fill:true,fillColor:TREND_COLOR[trends.get(f.properties.pro_th)],fillOpacity:1})}).addTo(layers);
}
// Default zoom: provinces that have water-level status data; fall back to the whole selected area when none do.
if(!selectedBounds)selectedBounds=allBounds;
// Legend sections follow their layers.
document.querySelectorAll('.national-map-key .key-heat').forEach(e=>e.style.display=$('showWaterHeat').checked&&state.tab!=='ops'?'':'none');
$('nationalHeatNote').style.display=$('showWaterHeat').checked&&state.tab!=='ops'?'':'none';
document.querySelectorAll('.national-map-key .key-households').forEach(e=>e.style.display=$('showHouseholds').checked?'':'none');
document.querySelectorAll('.national-map-key .key-doh').forEach(e=>e.style.display=state.tab==='ops'&&$('showOpsShelters').checked?'':'none');
document.querySelectorAll('.national-map-key .key-trend').forEach(e=>e.style.display=$('showTrendFill').checked?'':'none');
map.stop();map.invalidateSize({animate:false});
map._dashboardBounds=selectedBounds;watchMapResize();if(fit){map._userMoved=false;fitNationalMap(selectedBounds)}
const heatData=currentStations.filter(r=>typeof r.latitude==='number'&&typeof r.longitude==='number'&&quality(r)==='ภายใน 24 ชั่วโมง').map(r=>{
 const rank=WATER_STATUS[canonicalWaterStatus(r.flood_status_source)]?.rank||0;
 return [r.latitude,r.longitude,({1:0,2:.25,3:.5,4:.8,5:1})[rank]||0];
}).filter(r=>r[2]>0);
const showWaterHeat=$('showWaterHeat')?.checked!==false;
if(showWaterHeat&&L.heatLayer&&heatData.length)safeHeatLayer(heatData,{radius:30,blur:24,maxZoom:8,max:6,minOpacity:.06,gradient:{.15:'#93c5fd',.4:'#3b82f6',.7:'#1d4ed8',1:'#082f6b'}}).addTo(layers);
if($('showStationPins')?.checked){
  currentStations.filter(r=>typeof r.latitude==='number'&&typeof r.longitude==='number'&&quality(r)==='ภายใน 24 ชั่วโมง').forEach(r=>{
    const rank=WATER_STATUS[canonicalWaterStatus(r.flood_status_source)]?.rank||0;
    const c=rank>=5?'#082f6b':rank>=4?'#1d4ed8':rank>=3?'#3b82f6':rank>=2?'#93c5fd':'transparent';
    if(c!=='transparent'){
      L.circleMarker([r.latitude,r.longitude],{radius:4,fillColor:c,fillOpacity:0.8,color:'#ffffff',weight:1}).bindTooltip(`<b>${esc(r.station_id)}</b><br>${esc(r.flood_status_source)}`).addTo(layers);
    }
  });
}
if(state.tab==='ops'&&$('showOpsShelters').checked)addDohShelterPins();
$('nationalHeatNote').textContent=!L.heatLayer?'โหลด Heatmap ไม่สำเร็จ กรุณารีเฟรช':heatData.length?'Heatmap คำนวณจากสถานะและการกระจุกตัวของสถานีที่ข้อมูลผ่านเกณฑ์ 24 ชั่วโมง ณ เวลาอ่านข้อมูล ไม่ใช่ปริมาณมวลน้ำหรือขอบเขตน้ำท่วมจริง':'ไม่มีสถานีเฝ้าระวังขึ้นไปที่ข้อมูลผ่านเกณฑ์ 24 ชั่วโมงในพื้นที่เลือก จึงไม่แสดง Heatmap';
}

$('showHealthRegionNumbers').addEventListener('click',()=>{const button=$('showHealthRegionNumbers'),show=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(show));renderHealthRegionNumbers()});
$('showHealthRegions').addEventListener('change',renderHealthRegions);$('showStationPins').addEventListener('change',()=>renderMap());$('showWaterHeat').addEventListener('change',()=>renderMap());$('showTrendFill').addEventListener('change',()=>renderMap());$('showHouseholds').addEventListener('change',()=>renderMap());
$('showShelterPins').addEventListener('change',()=>renderMap());$('showOpsShelters').addEventListener('change',()=>renderMap());
document.querySelectorAll('.shelter-filter,.shelter-status-filter').forEach(cb=>cb.addEventListener('change',()=>{document.querySelectorAll('.shelter-filter,.shelter-status-filter').forEach(other=>{if(other.value===cb.value)other.checked=cb.checked});render()}));
$('fitDistrictMap').addEventListener('click',()=>{mapScope='';renderMap()});$('fitShelterMap').addEventListener('click',()=>fitShelters(currentShelters.filter(validCoordinates).map(r=>[r.latitude,r.longitude])));
// Table filtering changes height as well as width; refit only after layout settles.
// The Bangkok maps are laid out in a grid with a legend column and a table that is paginated after the first render, so the
// container can still change size after the first fit. When Leaflet's cached size no longer matches the container, re-measure
// and fit again (a no-op otherwise, so a user's zoom/pan survives filter changes).
function refitIfResized(target){
 if(!target)return;
 const el=target.getContainer(),w=el.clientWidth,h=el.clientHeight;
 if(!w||!h)return;
 const size=target.getSize();
 if(size.x===w&&size.y===h)return;
 target.stop();target.invalidateSize({pan:false,animate:false});
 if(target._dashboardBounds?.isValid())target.fitBounds(target._dashboardBounds,{padding:[24,24],maxZoom:target===map&&state.tab!=='bkk'?11:13,animate:false});
}
let mapResizeTimer;
const mapSizes=new WeakMap();
const mapResizeObserver=new ResizeObserver(entries=>{
 const changed=entries.filter(({target,contentRect:r})=>{
  if(!r.width||!r.height)return false;
  const size=`${r.width}|${r.height}`;
  if(mapSizes.get(target)===size)return false;
  mapSizes.set(target,size);return true;
 });
 if(!changed.length)return;
 clearTimeout(mapResizeTimer);
 mapResizeTimer=setTimeout(()=>{
  for(const target of [map,shelterMap]){
   if(!target||!target.getContainer().clientWidth||!target.getContainer().clientHeight)continue;
   target.stop();target.invalidateSize({pan:true,animate:false});
   if(target._dashboardBounds?.isValid())target.fitBounds(target._dashboardBounds,{padding:[24,24],maxZoom:target===map&&state.tab!=='bkk'?11:13,animate:false});
  }
  syncMapKey();
 },120);
});
mapResizeObserver.observe($('map'));mapResizeObserver.observe($('shelterMap'));

// The household-outline layer is remembered per tab: on by default, but off by default on the operations tab.
const householdPref={ops:false};
document.querySelectorAll('.tab:not([data-tab="news"]):not([data-tab="risk"]):not([data-tab="doh"])').forEach(x=>x.addEventListener('click',()=>{const hh=$('showHouseholds');if(hh&&state.tab!==x.dataset.tab){householdPref[state.tab]=hh.checked;hh.checked=householdPref[x.dataset.tab]??true}state.tab=x.dataset.tab;render();requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')))}));$('reportDate').addEventListener('change',e=>{state.date=e.target.value;render()});
$('region').addEventListener('change',e=>{state.region=e.target.value;state.province='';opts('province',DATA.vulnerable.filter(r=>!state.region||r.region===state.region).map(r=>r.province).sort((a,b)=>a.localeCompare(b,'th')),'ทุกจังหวัด');render()});$('province').addEventListener('change',e=>{state.province=e.target.value;render()});$('district').addEventListener('change',e=>{state.district=e.target.value;render()});
document.addEventListener('click',e=>{const p=e.target.closest('[data-province]'),d=e.target.closest('[data-district]');if(p){state.province=p.dataset.province;$('province').value=state.province;render();window.scrollTo({top:0,behavior:'smooth'})}if(d){state.district=d.dataset.district;$('district').value=state.district;render();window.scrollTo({top:0,behavior:'smooth'})}});
$('reset').addEventListener('click',()=>{tableFilters.clear();document.querySelectorAll('[data-table-filters]').forEach(el=>el.remove());state.region='';state.province='';state.district='';$('region').value='';$('district').value='';opts('province',provinceNames(),'ทุกจังหวัด');render()});
// Save the page being looked at (national or BKK) as a PNG: heading, data-age line, cards, map and table.
// modern-screenshot (loaded on first use) lets the browser itself draw the page, so the Leaflet layers come out as they look on screen.
let screenshotLib=null;
function loadScreenshotLib(){
 if(window.modernScreenshot)return Promise.resolve(window.modernScreenshot);
 return screenshotLib||(screenshotLib=new Promise((ok,fail)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.0/dist/index.js';s.onload=()=>ok(window.modernScreenshot);s.onerror=()=>{screenshotLib=null;fail(new Error('load'))};document.head.appendChild(s)}));
}
async function saveScreenshot(){
 const btn=$('shotBtn'),label=btn.textContent;btn.disabled=true;btn.textContent='กำลังสร้างภาพ…';
 try{
  const ms=await loadScreenshotLib(),ws=$('workspace'),grid=ws.querySelector(':scope > .grid'),shown='.heading,#dataAge,#cards,#alert,.grid';
  // Only the blocks in `shown` are drawn; the filter rows etc. above the grid are left out, so the image is that much shorter.
  const gap=parseFloat(getComputedStyle(ws).rowGap)||0;let height=grid.getBoundingClientRect().bottom-ws.getBoundingClientRect().top;
  for(const el of ws.children){if(el===grid)break;if(!el.matches(shown)&&getComputedStyle(el).display!=='none')height-=el.getBoundingClientRect().height+gap}
  const canvas=await ms.domToCanvas(ws,{scale:2,height:Math.ceil(height)+8,backgroundColor:getComputedStyle(document.body).backgroundColor,
   filter:n=>n.nodeType!==1||!((n.parentElement===ws&&!n.matches(shown))||n.classList.contains('leaflet-control-zoom')||n.classList.contains('expand-map'))});
  const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw new Error('empty');
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='flood-'+(state.tab==='bkk'?'bkk':state.tab==='ops'?'ops':'national')+'-'+(state.date||'latest')+'.png';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),10000);
  btn.textContent='✓ บันทึกแล้ว';
 }catch(e){console.warn('screenshot failed',e);btn.textContent='สร้างภาพไม่สำเร็จ'}
 finally{setTimeout(()=>{btn.textContent=label;btn.disabled=false},1800)}
}
$('shotBtn').addEventListener('click',saveScreenshot);
$('methodBtn').addEventListener('click',()=>$('methods').showModal());$('closeMethods').addEventListener('click',()=>$('methods').close());$('methods').addEventListener('click',e=>{if(e.target===$('methods')){let r=$('methods').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('methods').close()}});
$('export').addEventListener('click',()=>{const csv='\uFEFF'+filteredExportRows().map(row=>row.map(v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"').join(',')).join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=`flood-${state.tab}-${state.date}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)});
function provinceNames(){const names=window.PROVINCES_GEOJSON?.features.map(f=>f.properties.pro_th)||[...DATA.disasters.map(r=>r.Province),...DATA.vulnerable.map(r=>r.province)];return uniq(names.filter(Boolean)).sort((a,b)=>a.localeCompare(b,'th'))}
function allowedProvinces(){return provinceNames().filter(p=>(!state.province||p===state.province)&&(!state.region||DATA.vulnerable.some(r=>r.province===p&&r.region===state.region)))}
function shelterStatusKey(r){const s=String(r.status_source||'').trim();return SHELTER_COLORS[s]?s:'ไม่ทราบสถานะ'}
function fitShelters(pts){if(!shelterMap)return;shelterMap._dashboardBounds=pts.length?L.latLngBounds(pts):window.BKK_DISTRICTS_GEOJSON?L.geoJSON(window.BKK_DISTRICTS_GEOJSON).getBounds():L.latLngBounds([[13.4,100.3],[14,100.9]]);shelterMap.invalidateSize({pan:true,animate:false});shelterMap.fitBounds(shelterMap._dashboardBounds,{padding:[28,28],maxZoom:13,animate:false})}
function syncMapKey(){const el=nationalLegend?.getContainer();if(!el)return;const target=matchMedia('(max-width:767px)').matches?$('mobileMapKey'):$('map').querySelector('.leaflet-bottom.leaflet-left');if(target&&el.parentElement!==target)target.append(el)}
const tablePages=new Map(),tableFilters=new Map(),originalTableRows=new WeakMap();
function paginateTables(){
 for(const id of ['areaTable','stationTable','vulTable','allSheltersBody','shelterSideBody','sideBody']){
  const host=$(id),table=host?.querySelector('table');
  const remove=kind=>host?.parentElement.querySelector(':scope > [data-'+kind+'="'+id+'"]')?.remove();
  if(!table){remove('pager');remove('table-filters');tablePages.delete(id);continue}
  host.classList.add('unified-table');if(table.parentElement!==host){host.append(table);Array.from(host.children).filter(el=>el!==table).forEach(el=>el.remove())}if(!originalTableRows.has(table))originalTableRows.set(table,Array.from(table.tBodies[0]?.rows||[]).filter(r=>r.cells.length>1));const rows=originalTableRows.get(table);
  const headers=Array.from(table.tHead?.rows[0]?.cells||[]).map(c=>c.textContent.trim());
  const key=state.tab+':'+id;let filter=tableFilters.get(key);if(!filter){filter={query:'',column:'',value:'',sort:''};tableFilters.set(key,filter)}
  const signature=key+'|'+headers.join('|')+'|'+rows.map(r=>r.textContent).join('|');
  let toolbar=host.parentElement.querySelector(':scope > [data-table-filters="'+id+'"]');
  if(!toolbar||toolbar.dataset.signature!==signature){
   toolbar?.remove();toolbar=document.createElement('div');toolbar.className='table-controls';toolbar.dataset.tableFilters=id;toolbar.dataset.signature=signature;
   const top=document.createElement('div');top.className='table-control-top';
   const toggle=document.createElement('button');toggle.type='button';toggle.className='lightbtn';toggle.dataset.filterToggle='';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',id+'-filters');
   const summary=document.createElement('span');summary.className='filter-summary';summary.setAttribute('aria-live','polite');top.append(toggle,summary);
   const form=document.createElement('form');form.className='table-filter-panel';form.id=id+'-filters';form.hidden=true;
   const field=(label,input)=>{const wrap=document.createElement('label');wrap.textContent=label;wrap.append(input);form.append(wrap)};
   const search=document.createElement('input');search.type='search';search.placeholder='ค้นหาทุกคอลัมน์';field('ค้นหาในตาราง',search);
   const column=document.createElement('select');column.innerHTML='<option value="">ทุกคอลัมน์</option>'+headers.map((h,i)=>`<option value="${i}">${esc(h)}</option>`).join('');field('คอลัมน์ที่ต้องการกรอง',column);
   const value=document.createElement('select');field('ค่าที่ต้องการ',value);
   const sort=document.createElement('select');sort.innerHTML='<option value="">ลำดับเริ่มต้น</option>'+headers.map((h,i)=>`<option value="${i}:asc">${esc(h)} · น้อยไปมาก / ก–ฮ</option><option value="${i}:desc">${esc(h)} · มากไปน้อย / ฮ–ก</option>`).join('');field('เรียงลำดับ',sort);
   function options(selected=''){const values=column.value===''?[]:uniq(rows.map(r=>r.cells[Number(column.value)]?.textContent.trim()||'')).sort((a,b)=>a.localeCompare(b,'th',{numeric:true}));value.innerHTML='<option value="">ทุกค่า</option>'+values.filter(Boolean).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');value.value=values.includes(selected)?selected:'';value.disabled=column.value===''}
   function resetDraft(){search.value=filter.query;column.value=filter.column;options(filter.value);sort.value=filter.sort||''}
   function close(){resetDraft();form.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus()}
   toggle.onclick=()=>{if(!form.hidden){close();return}resetDraft();form.hidden=false;toggle.setAttribute('aria-expanded','true');search.focus()};column.onchange=()=>options();
   const actions=document.createElement('div');actions.className='filter-actions';
   const apply=document.createElement('button');apply.type='submit';apply.className='lightbtn primary-filter';apply.textContent='ใช้ตัวกรอง';
   const clear=document.createElement('button');clear.type='button';clear.className='lightbtn';clear.textContent='ล้างตัวกรอง';
   const cancel=document.createElement('button');cancel.type='button';cancel.className='lightbtn';cancel.textContent='ปิด';cancel.onclick=close;
   const update=()=>{tablePages.delete(id);close();paginateTables();requestAnimationFrame(updateTableHints)};
   form.onsubmit=e=>{e.preventDefault();Object.assign(filter,{query:search.value.trim(),column:column.value,value:value.value,sort:sort.value});update()};
   clear.onclick=()=>{Object.assign(filter,{query:'',column:'',value:'',sort:''});update()};form.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close()}};
   actions.append(apply,clear,cancel);form.append(actions);toolbar.append(top,form);host.before(toolbar);
  }
  const conditions=[filter.query?'ค้นหา: '+filter.query:'',filter.value?(headers[Number(filter.column)]||'ค่า')+': '+filter.value:''].filter(Boolean);
  toolbar.querySelector('[data-filter-toggle]').textContent='ตัวกรอง'+(conditions.length?' · '+conditions.length:'');
  toolbar.querySelector('.filter-summary').textContent=conditions.join(' · ')+(filter.sort?(conditions.length?' · ':'')+'เรียง: '+headers[Number(filter.sort.split(':')[0])]:'');
  const term=filter.query.trim().toLocaleLowerCase('th');
  const matches=rows.map((r,i)=>({r,i})).filter(({r})=>(!term||r.textContent.toLocaleLowerCase('th').includes(term))&&(!filter.value||r.cells[Number(filter.column)]?.textContent.trim()===filter.value));
  if(filter.sort){const [col,direction]=filter.sort.split(':');const text=r=>r.cells[Number(col)]?.textContent.trim()||'';const numeric=v=>/^-?[\d,]+(?:\.\d+)?$/.test(v)?Number(v.replace(/,/g,'')):null;matches.sort((a,b)=>{const av=text(a.r),bv=text(b.r),an=numeric(av),bn=numeric(bv);return (an!==null&&bn!==null?an-bn:av.localeCompare(bv,'th',{numeric:true}))*(direction==='desc'?-1:1)})}
  matches.forEach(({r})=>table.tBodies[0].append(r));
  let result=toolbar.querySelector('.table-result');if(!result){result=document.createElement('div');result.className='table-result';result.setAttribute('aria-live','polite');toolbar.append(result)}result.textContent=`พบ ${matches.length} จาก ${rows.length} รายการ`;
  const pageKey=signature+'|'+JSON.stringify(filter);let entry=tablePages.get(id);if(!entry||entry.signature!==pageKey){entry={signature:pageKey,page:0};tablePages.set(id,entry)}entry.rowIndices=matches.map(x=>x.i);
  const pageSize=state.tab==='bkk'&&(id==='sideBody'||id==='shelterSideBody')?7:id==='sideBody'?(state.tab==='ops'?12:10):20;const pages=Math.max(1,Math.ceil(matches.length/pageSize));entry.page=Math.min(entry.page,pages-1);rows.forEach(r=>r.hidden=true);matches.slice(entry.page*pageSize,entry.page*pageSize+pageSize).forEach(({r})=>r.hidden=false);
  remove('pager');const nav=document.createElement('div');nav.className='pagination';nav.dataset.pager=id;nav.setAttribute('aria-live','polite');
  const count=document.createElement('span');count.textContent=matches.length?`พบ ${matches.length} จาก ${rows.length} รายการ · หน้า ${entry.page+1}/${pages}`:'ไม่พบข้อมูลตามตัวกรอง';
  for(const [label,step] of [['ก่อนหน้า',-1],['ถัดไป',1]]){if(pages<=1)break;const button=document.createElement('button');button.className='lightbtn';button.textContent=label;button.disabled=step<0?entry.page===0:entry.page===pages-1;button.onclick=()=>{entry.page+=step;paginateTables()};nav.append(button)}
  nav.insertBefore(count,nav.lastChild);host.after(nav);
 }
}
function filteredExportRows(){const indices=tablePages.get('areaTable')?.rowIndices;return indices?[csvRows[0],...indices.map(i=>csvRows[i+1]).filter(Boolean)]:csvRows}
const sourceLabels={Disaster_DB:'รายงานภัย ปภ.',Vulnerable_group:'ฐานประชากรกลุ่มเปราะบาง',thai_water_DB:'สถานีน้ำทั่วประเทศ',BKK_water_DB:'สถานีน้ำ กทม.',shelter_DB:'ศูนย์พักพิง'};
function renderSourceStatus(){const failed=Object.entries(DATA.sourceStatus).filter(([name,s])=>s.status==='error'&&sourceLabels[name]&&(state.tab!=='ops'||name==='Disaster_DB'));$('sourceStatus').innerHTML=failed.map(([name,s])=>`<div class="alert source-error"><span><b>${sourceLabels[name]}</b> — ${esc(s.message)}</span><button class="lightbtn" data-retry-source="${name}">ลองใหม่</button></div>`).join('');$('sourceStatus').classList.toggle('hidden',!failed.length)}
function unavailable(id,name){if(DATA.sourceStatus[name]?.status!=='error')return;const el=$(id);if(el)el.innerHTML=`<div class="empty">โหลด${sourceLabels[name]}ไม่สำเร็จ — กดลองใหม่ด้านบน</div>`}
function updateTableHints(){for(const el of document.querySelectorAll('.table-wrap,#sideBody,#shelterSideBody,#allSheltersBody')){const hint=el.previousElementSibling?.classList.contains('table-scroll-hint')?el.previousElementSibling:null;const overflow=el.clientWidth>0&&el.scrollWidth>el.clientWidth+2;if(overflow){if(!hint){const p=document.createElement('p');p.className='table-scroll-hint';p.textContent='เลื่อนตารางซ้าย–ขวาเพื่อดูข้อมูลครบทุกคอลัมน์';el.before(p)}el.setAttribute('tabindex','0');el.setAttribute('aria-label','ตารางข้อมูล เลื่อนซ้ายและขวาได้')}else{hint?.remove();el.removeAttribute('tabindex')}}}
window.addEventListener('resize',()=>requestAnimationFrame(updateTableHints));
function failed(name) { return DATA.sourceStatus[name]?.status==='error'; }
// Warnings are rebuilt for the current tab on every render so they never carry over from another tab.
function updateAlert(){
 const bkk=state.tab==='bkk',msgs=[];
 if(state.tab!=='ops'&&failed(bkk?'BKK_water_DB':'thai_water_DB'))msgs.push('ข้อมูลสถานีอ่านไม่สำเร็จ จึงยังประเมินสถานะน้ำไม่ได้');
 const scoped=bkk?getReports().filter(r=>r.Province==='กรุงเทพมหานคร'):getReports().filter(r=>allowedProvinces().includes(r.Province));
 const missing=scoped.filter(r=>!Number.isFinite(r.Affected_Households)).length;
 if(missing)msgs.push(`ขาดจำนวนครัวเรือน ${missing} รายการ ยอดรวมเฉพาะรายการที่มีข้อมูล`);
 if(bkk&&currentShelters.some(r=>!Number.isFinite(r.occupied)||!Number.isFinite(r.capacity)))msgs.push('ยอดผู้พักและความจุรวมเฉพาะรายการที่มีข้อมูล');
 const el=$('alert');el.textContent=msgs.join(' · ');el.style.display=msgs.length?'block':'none';
}
function finishRender(){
 renderSourceStatus();
 const bkk=state.tab==='bkk';
 const cardSources=bkk?['BKK_water_DB','BKK_water_DB','shelter_DB','shelter_DB']:state.tab==='ops'?['Disaster_DB','Disaster_DB','Disaster_DB']:['Disaster_DB','Disaster_DB','Disaster_DB','thai_water_DB'];
 Array.from($('cards').children).forEach((el,i)=>{if(failed(cardSources[i])){el.querySelector('.number').textContent='อ่านไม่ได้';el.querySelector('.card-note').textContent='ลองโหลดแหล่งข้อมูลใหม่ด้านบน'}});
 unavailable('areaTable',bkk?'shelter_DB':'Disaster_DB');unavailable('sideBody',bkk?'BKK_water_DB':'Disaster_DB');unavailable('stationTable',bkk?'BKK_water_DB':'thai_water_DB');
 for(const id of ['shelterCards','shelterSideBody','allSheltersBody'])unavailable(id,'shelter_DB');
 if(failed('Vulnerable_group')){unavailable('vulnerableNational','Vulnerable_group');unavailable('vulTable','Vulnerable_group');$('vulChartEmpty').classList.remove('hidden');$('vulChartEmpty').textContent='โหลดฐานประชากรไม่สำเร็จ'}
 if(state.tab!=='ops'&&failed(bkk?'BKK_water_DB':'thai_water_DB'))$('mapCount').textContent='ข้อมูลสถานีอ่านไม่ได้';
 if(failed('Disaster_DB'))$('vulHouseholds').textContent='อ่านไม่ได้';
 updateAlert();
 $('selectedFilters').textContent=[bkk?'กรุงเทพมหานคร':state.tab==='ops'?'ปฏิบัติการ (ปภ.)':'ภาพรวมประเทศ',state.district||state.province||state.region||'ทุกพื้นที่','วันรายงาน ปภ.: '+(state.date?date(state.date+'T00:00:00+07:00'):'ไม่มีวันรายงาน')].join(' · ');
 $('filterNote').textContent='วันรายงานใช้กับ ปภ. เท่านั้น · สถานีน้ำและศูนย์พักพิงใช้ข้อมูลล่าสุดที่อ่านได้';
 $('region').disabled=failed('Vulnerable_group');$('reportDate').disabled=!DATA.disasters.length;
 document.querySelector('.foot > span:last-child').textContent=Object.entries(DATA.sourceStatus).filter(([name,s])=>s.status==='ok'&&sourceLabels[name]).map(([name,s])=>sourceLabels[name]+': '+time(s.loadedAt)).join(' · ');
 
 
 renderMap(); renderAreas(); paginateTables();requestAnimationFrame(updateTableHints);
 if(state.tab==='bkk'){refitIfResized(map);refitIfResized(shelterMap)}
}
// Merge freshly read sources into DATA and rebuild the controls that depend on them.
function applyReload(next,names){
 const prevDates=uniq(DATA.disasters.map(r=>r.Report_Date.slice(0,10))).sort();
 for(const name of names){DATA[SOURCES[name]]=next[SOURCES[name]];DATA.sourceStatus[name]=next.sourceStatus[name]}
 for(const [name,key] of Object.entries(DashboardModel.RISK_SOURCES))if(next.sourceStatus?.[name]?.status==='ok'){DATA[key]=next[key];DATA.sourceStatus[name]=next.sourceStatus[name]}
 DATA.loadedAt=next.loadedAt;indexSources();
 if(names.includes('Disaster_DB')){const dates=uniq(DATA.disasters.map(r=>r.Report_Date.slice(0,10))).sort();if(!dates.includes(state.date)||state.date===prevDates.at(-1))state.date=dates.at(-1);opts('reportDate',dates);$('reportDate').value=state.date||''}
 if(names.includes('Vulnerable_group')){opts('region',uniq(DATA.vulnerable.map(r=>r.region).filter(Boolean)),'ทุกเขตสุขภาพ');if(!Array.from($('region').options).some(o=>o.value===state.region))state.region='';$('region').value=state.region}
 opts('province',provinceNames(),'ทุกจังหวัด');if(!provinceNames().includes(state.province))state.province='';$('province').value=state.province;
 render();finishRender();
 window.dispatchEvent(new Event('dashboard:data'));
}
$('sourceStatus').addEventListener('click',async e=>{const button=e.target.closest('[data-retry-source]');if(!button)return;const name=button.dataset.retrySource;button.disabled=true;button.textContent='กำลังอ่าน…';try{const next=await requestData(name);if(!next.sourceStatus?.[name])throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');applyReload(next,[name])}catch(error){button.disabled=false;button.textContent='ลองใหม่';const text=button.parentElement.querySelector('span');text.textContent='อ่านข้อมูลไม่สำเร็จ กรุณาลองใหม่';console.error(error)}});
// Refresh: re-read every sheet bypassing the server cache. A sheet that fails keeps its previous data.
$('refreshData').addEventListener('click',async()=>{const button=$('refreshData'),status=$('refreshStatus');button.disabled=true;status.textContent='กำลังอ่านข้อมูล…';try{const next=await requestData(null,true);if(!next.sourceStatus)throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');const names=Object.keys(SOURCES),ok=names.filter(n=>next.sourceStatus[n]?.status==='ok'),bad=names.filter(n=>!ok.includes(n));if(!ok.length)throw new Error('อ่านไม่สำเร็จทุกแหล่ง');applyReload(next,ok);const newest=ok.map(n=>next.sourceStatus[n].loadedAt).sort().at(-1);status.textContent=(bad.length?'อ่านไม่สำเร็จ '+bad.map(n=>sourceLabels[n]).join(', ')+' (ใช้ข้อมูลเดิม) · ':'')+'อ่านข้อมูลเมื่อ '+time(newest)}catch(error){console.error(error);status.textContent='รีเฟรชไม่สำเร็จ ยังแสดงข้อมูลเดิม'}finally{button.disabled=false}});
[['layersBtn','layerPop'],['layersBtnBkk','layerPopBkk']].forEach(([b,p])=>{const lb=$(b),lp=$(p),set=o=>{lp.hidden=!o;lb.setAttribute('aria-expanded',String(o))};lb.addEventListener('click',e=>{e.stopPropagation();set(lp.hidden)});document.addEventListener('click',e=>{if(!lp.hidden&&!lp.contains(e.target))set(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!lp.hidden){set(false);lb.focus()}})});
$('toggleFilters').addEventListener('click',()=>{const expanded=$('toggleFilters').getAttribute('aria-expanded')!=='true';$('toggleFilters').setAttribute('aria-expanded',String(expanded));$('dashboardFilters').classList.toggle('expanded',expanded)});
{const ICON={open:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',close:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 10h6V4M10 14H4v6M20 4l-6 6M4 20l6-6"/></svg>'};
for(const id of ['map']){const panel=$(id).closest('section'),hosts=id==='map'?[$('healthRegionTools'),$('bkkMapTools')]:[panel.querySelector('.panel-head')],buttons=hosts.map(h=>{const button=document.createElement('button');button.type='button';button.className='lightbtn expand-map icon-btn';h.prepend(button);return button}),label=x=>buttons.forEach(button=>{button.innerHTML=ICON[x?'close':'open'];button.title=button.ariaLabel=x?'ออกจากแผนที่เต็มจอ':'ขยายแผนที่';button.setAttribute('aria-pressed',String(x))});label(false);const toggle=()=>{const expanded=panel.classList.toggle('map-expanded');label(expanded);document.body.classList.toggle('map-open',!!document.querySelector('.map-expanded'));requestAnimationFrame(()=>{map?.invalidateSize({pan:false});shelterMap?.invalidateSize({pan:false})})};buttons.forEach(b=>b.onclick=toggle)}}
MapChrome.setup($('shelterMap').closest('section'),$('shelterMap'),$('shelterMapTools'),[$('fitShelterMap')]);
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('.map-expanded .expand-map')?.click()});
matchMedia('(max-width:767px)').addEventListener('change',syncMapKey);
window.addEventListener('error',()=>{const el=document.getElementById('alert');if(el)el.textContent='เกิดข้อผิดพลาดในการแสดงผลหน้าเว็บ กรุณาลองโหลดใหม่'});

const methodItems=document.querySelectorAll('#methods > ol:first-of-type > li');
methodItems[2].textContent='ความสด: ใช้เวลาตรวจวัดสถานีหรือเวลาปรับปรุงศูนย์เทียบเวลาอ่านชีตนั้น อายุ 0–24 ชั่วโมงถือว่าล่าสุด ไม่ใช้เวลานำเข้าแทนเวลาตรวจวัด';
methodItems[3].textContent='กทม.: แสดงสถานีที่จังหวัดในข้อมูลต้นทางเป็นกรุงเทพมหานคร ไม่รวมจังหวัดรอบข้าง';
methodItems[4].textContent='ศูนย์พักพิง: จำนวนศูนย์ เขต พิกัด และผู้พักเกินความจุคำนวณจาก Google Sheets ทุกครั้งที่โหลดหน้า';
document.querySelector('#methods p.sub').textContent='อ่าน Google Sheets ผ่านเซิร์ฟเวอร์ทุกครั้งที่เปิดหรือรีเฟรชหน้า รอ Google Sheets บันทึกสำเร็จแล้วรีเฟรช เวลาข้อมูลต้นทางอาจเก่ากว่าเวลาที่อ่านไฟล์';
render();
window.dispatchEvent(new Event('dashboard:data'));
// GitHub Pages build: the first paint used the published snapshot; now read the sheet itself and swap in what could be read.
if(typeof upgradeLive==='function'){renderDataAge();upgradeLive().then(next=>{const ok=next?Object.keys(SOURCES).filter(n=>next.sourceStatus[n]?.status==='ok'):[];if(ok.length)applyReload(next,ok);else renderDataAge()}).catch(()=>renderDataAge())}
// Optional page-scoped agent access uses the same visible navigation.
if(document.modelContext?.registerTool){const lifecycle=new AbortController();try{Promise.resolve(document.modelContext.registerTool({name:'navigate_flood_dashboard',title:'เปิดมุมมองเฝ้าระวังน้ำ',description:'Switch the visible dashboard tab and optionally select a supported DDPM report date.',inputSchema:{type:'object',properties:{tab:{type:'string',enum:['national','bkk','ops']},reportDate:{type:'string',enum:uniq(DATA.disasters.map(r=>r.Report_Date.slice(0,10)))}},required:['tab'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||!['national','bkk','ops'].includes(input.tab)||Object.keys(input).some(k=>!['tab','reportDate'].includes(k))||(input.reportDate&&!uniq(DATA.disasters.map(r=>r.Report_Date.slice(0,10))).includes(input.reportDate)))throw new Error('Invalid dashboard selection');state.tab=input.tab;if(input.reportDate){state.date=input.reportDate;$('reportDate').value=state.date}render();return {tab:state.tab,reportDate:state.date,metrics:$('cards').innerText}}},{signal:lifecycle.signal})).catch(()=>{});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true})}catch{}}
document.fonts?.ready.then(()=>{if(window.Chart)Object.values(Chart.instances).forEach(chart=>chart.update('none'));map?.invalidateSize({pan:true});shelterMap?.invalidateSize({pan:true})});
const mapScript=document.createElement('script');mapScript.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';mapScript.onload=()=>{const heatScript=document.createElement('script');heatScript.src='https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';heatScript.onload=()=>{renderMap();finishRender()};heatScript.onerror=()=>{renderMap();finishRender()};document.head.appendChild(heatScript);};mapScript.onerror=()=>{$('map').innerHTML='<div class="map-fallback">แผนที่ต้องเชื่อมต่ออินเทอร์เน็ต<br>ยังดูตัวชี้วัดและตารางข้อมูลทั้งหมดได้ด้านล่าง</div>';finishRender()};document.head.appendChild(mapScript);

let bkkVulChartInstance = null;
function renderBkkVulChart() {
    if (state.tab !== 'bkk') return;
    const bkkReports = getReports().filter(r => r.Province === 'กรุงเทพมหานคร');
    const households = bkkReports.length ? sum(bkkReports, 'Affected_Households') : null;
    $('vulHouseholds').textContent = households !== null ? fmt(households) : '-';
    
    // Population base is province-level only; it cannot be split by district.
    const vulData = DATA.vulnerable.filter(r => r.province === 'กรุงเทพมหานคร');
    $('vulnerableSubBkk').textContent = state.district ? 'ฐานประชากรทั้ง กทม. (ไม่มีข้อมูลแยกรายเขต)' : '';
    if (!vulData.length || failed('Vulnerable_group')) {
        $('vulChartEmpty').classList.remove('hidden');
        if (bkkVulChartInstance) { bkkVulChartInstance.destroy(); bkkVulChartInstance = null; }
        return;
    }
    $('vulChartEmpty').classList.add('hidden');
    
    const groups = ['ผู้สูงอายุ', 'หญิงตั้งครรภ์', 'เด็กเล็ก'];
    const colors = ['#3b82f6', '#10b981', '#f59e0b'];
    const sums = [sum(vulData, 'elderly'), sum(vulData, 'pregnant'), sum(vulData, 'children')];
    if (sums.every(x => !x)) {
        $('vulChartEmpty').classList.remove('hidden');
        if (bkkVulChartInstance) { bkkVulChartInstance.destroy(); bkkVulChartInstance = null; }
        return;
    }
    
    if (bkkVulChartInstance) {
        bkkVulChartInstance.data.datasets[0].data = sums;
        bkkVulChartInstance.update();
    } else {
        const ctx = document.getElementById('vulChart').getContext('2d');
        bkkVulChartInstance = new window.Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: groups,
                datasets: [{
                    data: sums,
                    backgroundColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: { callbacks: { label: (ctx) => ' ' + ctx.label + ': ' + fmt(ctx.raw) + ' คน' } }
                }
            }
        });
    }
}

// How old is what the page shows? The GitHub Pages build serves a snapshot (data.json) rebuilt by GitHub Actions on a schedule
// that GitHub does not guarantee, so say so instead of letting it pass as live data. Uses the oldest sheet read time.
function renderDataAge(){
 const el=$('dataAge');if(!el)return;
 const times=Object.values(DATA.sourceStatus||{}).filter(s=>s.status==='ok'&&s.loadedAt).map(s=>s.loadedAt).sort(),loaded=times[0]||DATA.loadedAt;
 const a=DashboardModel.dataAge(loaded,Date.now());
 if(!a){el.style.display='none';return}
 const snapshot=window.DATA_IS_SNAPSHOT===true,when=time(loaded);
 el.style.display='';el.className='data-age age-'+a.level;
 el.innerHTML=snapshot
  ?(a.level==='ok'?'ข้อมูลอายุ <b>'+esc(a.text)+'</b> · ไฟล์สร้างเมื่อ '+esc(when)+' (หน้านี้แสดงไฟล์ที่สร้างตามรอบ ไม่ได้อ่านชีตสด)'
   :'<b>ข้อมูลอายุ '+esc(a.text)+'</b> (ไฟล์สร้างเมื่อ '+esc(when)+') — หน้านี้แสดงไฟล์ที่สร้างตามรอบ ไม่ได้อ่านชีตสด จึงอาจต่างจากชีตตอนนี้')
  :'ข้อมูลอ่านจากชีตเมื่อ '+esc(when)+' (อายุ '+esc(a.text)+')';
 if(window.DATA_LIVE_PENDING===true)el.innerHTML+=' · <b>กำลังอ่านข้อมูลสดจากชีต…</b>';
 else if(window.DATA_LIVE_ERROR===true&&snapshot)el.innerHTML+=' · อ่านชีตสดไม่สำเร็จ จึงใช้ไฟล์ที่เผยแพร่';
 const basis=timeBasis();if(basis)el.innerHTML+='<div class="age-basis">'+basis+'</div>';
}
// The data on one page comes from sources with different clocks: the report day is a ปภ. day, the stations are read 'now' and
// the sheet keeps only the newest reading per station. Show each block's own time so they can be compared at a glance.
function timeBasis(){
 const bkk=state.tab==='bkk',parts=[],stamp=ms=>Number.isFinite(ms)?time(new Date(ms).toISOString()):'ไม่ทราบเวลา';
 if(!bkk){
  const rows=DATA.disasters.filter(r=>r.Report_Date.slice(0,10)===state.date),w=rows.map(DashboardModel.disasterTime).filter(Number.isFinite),written=w.length?Math.max(...w):NaN;
  const at=rows.map(r=>/เวลา\s*(\d{1,2})[.:](\d{2})\s*น/.exec(r.Remarks||'')).filter(Boolean).map(x=>x[1].padStart(2,'0')+':'+x[2]).sort().pop();
  parts.push('รายงาน ปภ. <b>'+esc(state.date?date(state.date+'T00:00:00+07:00'):'-')+'</b>'+(at?' เวลา '+esc(at)+' น.':'')+(Number.isFinite(written)?' (นำเข้า '+esc(stamp(written))+')':''));
 }
 const stationRows=bkk?DATA.bkkStations.filter(r=>r.province==='กรุงเทพมหานคร'):nationalStations(),src=bkk?'BKK_water_DB':'thai_water_DB';
 const cutoff=DashboardModel.timestamp(DATA.sourceStatus[src]?.loadedAt||DATA.loadedAt);
 parts.push('สถานีน้ำ'+(bkk?' กทม.':'')+' ตรวจวัดล่าสุด <b>'+esc(stamp(DashboardModel.latestTime(stationRows,'observed_at_th',cutoff)))+'</b>');
 if(bkk)parts.push('ศูนย์พักพิง ปรับปรุง <b>'+esc(stamp(DashboardModel.latestTime(DATA.shelters,'fetched_at_th')))+'</b>');
 const dates=uniq(DATA.disasters.map(r=>r.Report_Date.slice(0,10))).sort();
 if(!bkk&&state.date&&state.date!==dates.at(-1))parts.push('<b>วันรายงานที่เลือกไม่ใช่วันล่าสุด</b> — สถานีน้ำยังเป็นค่าล่าสุดตอนนี้ ไม่ย้อนตามวัน');
 return 'เวลาของข้อมูล: '+parts.join(' · ');
}
setInterval(()=>{try{renderDataAge()}catch(e){}},60000);

// Totals box above the vulnerable-group table: the whole selection and the provinces that have a flood report on the selected day.
function renderVulSummary(){
 const host=$('vulSummary');if(!host||state.tab==='bkk')return;
 if(failed('Vulnerable_group')){host.innerHTML='<div class="panel-head"><div><h2>สรุปจำนวนกลุ่มเปราะบาง</h2></div></div><div class="panel-body"><p class="empty">โหลดฐานประชากรไม่สำเร็จ</p></div>';return}
 const allowed=new Set(allowedProvinces()),rows=DATA.vulnerable.filter(r=>allowed.has(r.province));
 const affected=new Set(getReports().filter(r=>allowed.has(r.Province)).map(r=>r.Province));
 const t=DashboardModel.vulnerableTotals(rows,affected),scope=state.province||(state.region?state.region:'ทั้งประเทศ');
 const groups=[['elderly','ผู้สูงอายุ 60 ปีขึ้นไป'],['pregnant','หญิงตั้งครรภ์'],['children','เด็กเล็ก 0–4 ปี']];
 const note=k=>t.affectedProvinces?'ในจังหวัดที่ประสบภัย: <b>'+fmt(t.affected[k])+'</b> คน'+(t.share[k]==null?'':' ('+t.share[k].toFixed(1)+'%)'):'ไม่มีจังหวัดที่ประสบภัยในวันและพื้นที่ที่เลือก';
 host.innerHTML='<div class="panel-head"><div><h2>สรุปจำนวนกลุ่มเปราะบาง</h2><p class="sub">'+esc(scope)+' · '+fmt(t.provinces)+' จังหวัด · ประสบภัย '+fmt(t.affectedProvinces)+' จังหวัด ('+(state.date?date(state.date+'T00:00:00+07:00'):'ไม่มีวันรายงาน')+')</p></div><span class="badge">ฐานประชากรทั้งจังหวัด</span></div>'
  +'<div class="panel-body"><div class="cards vul-cards">'+groups.map(([k,label],i)=>card(label,t.all[k],'คน',note(k),i===0)).join('')+'</div>'
  +'<p class="mini-note">จำนวนประชากรทั้งจังหวัดตามฐานข้อมูล ไม่ใช่จำนวนผู้ได้รับผลกระทบจริง · ร้อยละ = สัดส่วนของจังหวัดที่ประสบภัยต่อทั้งพื้นที่ที่เลือก</p></div>';
}

function renderVulnerable() {
    if (state.tab === 'bkk') return;
    if (failed('Vulnerable_group')) return;
    const allowed = allowedProvinces();
    const rows = DATA.vulnerable.filter(r => allowed.includes(r.province));
    const grouped = new Map();
    for (const r of rows) {
        if (!grouped.has(r.province)) grouped.set(r.province, { province: r.province, region: r.region });
        const obj = grouped.get(r.province);
        for (const k of ['elderly', 'pregnant', 'children']) {
            obj[k] = (obj[k] || 0) + (r[k] || 0);
        }
    }
    const finalRows = Array.from(grouped.values()).sort((a,b) => (b.elderly||0) - (a.elderly||0));
    const headers = ['จังหวัด', 'เขตสุขภาพ', 'ผู้สูงอายุ', 'หญิงตั้งครรภ์', 'เด็กเล็ก'];
    $('vulTable').innerHTML = table(headers, finalRows.map(r => [
        `<button class="linkbutton" data-province="${esc(r.province)}">${esc(r.province)}</button>`,
        esc(r.region),
        fmt(r.elderly),
        fmt(r.pregnant),
        fmt(r.children)
    ]));
}

}catch(error){document.getElementById('pageTitle').textContent='แสดง Dashboard ไม่สำเร็จ';document.getElementById('cards').innerHTML='';document.getElementById('alert').style.display='block';document.getElementById('alert').textContent=error.message+' — รีเฟรชเพื่อลองใหม่';const retry=document.createElement('button');retry.className='lightbtn';retry.textContent='ลองโหลดใหม่';retry.onclick=()=>location.reload();document.getElementById('alert').append(' ',retry);console.error(error)}})();


