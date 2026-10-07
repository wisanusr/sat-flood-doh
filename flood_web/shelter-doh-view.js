/* "ศูนย์พักพิง DOH" tab: sanitation assessment of temporary shelters. GitHub Pages build only (see build.py / build_pages.py).
   Reads doh_shelter.json written in CI by doh_shelter/build_doh_shelter.py. Independent of the dashboard's own data load.
   The latest assessment per shelter (is_latest) and every score are computed in Python; this file only displays them. */
(function(){
  const tab=document.getElementById('tab-doh'),pane=document.getElementById('dohPane');
  if(!tab||!pane)return;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number.isFinite(n)?n.toLocaleString('th-TH'):'-';
  const pct=(a,b)=>b?Math.round(a/b*100):null;
  const thDate=s=>{if(!s)return '-';const[y,m,d]=s.split('-').map(Number);return d+'/'+m+'/'+(y+543)};
  const sum=(a,k)=>a.reduce((t,r)=>t+(r[k]||0),0);
  // Grades come from Python (doh_shelter/build_doh_shelter.py, criteria of แนวทางจัดระดับศพพ.docx): 3 = ดี, 2 = พอใช้, 1 = ต้องปรับปรุง.
  const LV_KEY={3:'g',2:'a',1:'r'},LV_LABEL={3:'ดี',2:'พอใช้',1:'ต้องปรับปรุง'};
  const lk=v=>LV_KEY[v]||'x',lvLabel=v=>LV_LABEL[v]||'ไม่มีข้อมูล';
  const lvPill=v=>'<span class="doh-pill '+lk(v)+'">'+lvLabel(v)+'</span>';
  const COL={g:'#2f8a4a',a:'#b87a14',r:'#b34540',x:'#8a9aa0'};
  const safeUrl=u=>/^https:\/\//i.test(u||'')?u:'';
  const st={prov:'',region:'',status:'',q:'',sort:'name',dir:1,flood:true,date:'',pins:true,regions:true,nums:false,bands:new Set(['g','a','r','x'])};
  let P=null,PG=null,HR=null,regionLayer=null,regionNums=null,keyCtl=null,mapScope='',provLayer=null,ddpm=new Map(),trend=new Map(),D=null,latest=[],byShelter=new Map(),loaded=false,loading=null,failed='',map=null,layer=null,built=false;

  async function load(){
    if(loading)return loading;
    // DDPM (ปภ.) reports and province outlines are optional: without them the province fill is just hidden.
    const getJson=u=>fetch(u,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()});
    const ddpmRows=getJson('data.json').catch(()=>getJson('/api/data')).then(x=>Array.isArray(x.disasters)?x.disasters:null).catch(()=>null);
    const geo=window.PROVINCES_GEOJSON?Promise.resolve(window.PROVINCES_GEOJSON):getJson('/thai_provinces.json').catch(()=>null);
    const regions=window.HEALTH_REGIONS_GEOJSON?Promise.resolve(window.HEALTH_REGIONS_GEOJSON):getJson('/regions.geojson').catch(()=>null);
    loading=Promise.all([getJson('doh_shelter.json'),ddpmRows,geo,regions]).then(([d,rows,g,hr])=>{
      P=rows&&rows.length?rows:null;PG=g&&g.features?g:null;HR=hr&&hr.features?hr:null;
      D=d;latest=d.records.filter(r=>r.is_latest);byShelter=new Map();
      d.records.forEach(r=>{(byShelter.get(r.shelter_id)||byShelter.set(r.shelter_id,[]).get(r.shelter_id)).push(r)});
      byShelter.forEach(a=>a.sort((x,y)=>(x.assess_date||'').localeCompare(y.assess_date||'')));
      failed='';
    }).catch(e=>{D=null;failed=e.message}).finally(()=>{loaded=true;loading=null});
    return loading;
  }
  // ปภ. reports: sum of affected households per province for one report date, only rows still "กำลังประสบภัย"
  // (same rule as the national map). A province missing from the report is "not reported", not "dry".
  const ddpmDates=()=>P?[...new Set(P.map(r=>String(r.Report_Date||'').slice(0,10)).filter(Boolean))].sort():[];
  function computeDdpm(){
    ddpm=new Map();trend=new Map();
    if(!P||!st.date)return;
    P.filter(r=>String(r.Report_Date||'').slice(0,10)===st.date&&r.Current_Status==='กำลังประสบภัย').forEach(r=>{
      const n=Number(r.Affected_Households);
      if(Number.isFinite(n)&&n>=0)ddpm.set(r.Province,(ddpm.get(r.Province)||0)+n);
      // the sheet writes both "เพิ่มขึ้น" and "ระดับน้ำเพิ่มขึ้น"; if a province has several rows keep the worst trend
      const t=String(r.Water_Level_Trend||'').replace(/^ระดับน้ำ/,'').trim();
      if(TREND[t]&&(!trend.has(r.Province)||TREND[t].rank>TREND[trend.get(r.Province)].rank))trend.set(r.Province,t);
    });
    D.records.forEach(r=>{r.flood=ddpm.has(r.province)&&ddpm.get(r.province)>0?ddpm.get(r.province):0});
  }
  // same colours as the trend badges on the main dashboard
  const TREND={'เพิ่มขึ้น':{rank:3,color:'#082f6b'},'ทรงตัว':{rank:2,color:'#3b82f6'},'ลดลง':{rank:1,color:'#93c5fd'}};
  const trendColor=t=>TREND[t]?TREND[t].color:'#94a3b8';
  const TREND_FILL=1;  // province fill opacity; the key swatches use the same value so key and map match
  const rgba=(hex,a)=>'rgba('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')+','+a+')';
  function select(active){
    document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',String(x===active)));
    $('workspace').setAttribute('aria-labelledby',active.id);
  }
  async function open(){
    document.body.classList.remove('news-mode');
    document.body.classList.add('doh-mode');
    select(tab);
    if(!loaded)pane.innerHTML='<p class="empty">กำลังโหลดข้อมูลศูนย์พักพิง…</p>';
    await load();
    if(!document.body.classList.contains('doh-mode'))return;
    if(!D){built=false;pane.innerHTML='<div class="alert doh-alert">ยังไม่มีข้อมูลศูนย์พักพิง DOH (doh_shelter.json อ่านไม่ได้: '+esc(failed)+') แท็บอื่นยังใช้งานได้ตามปกติ</div>';return}
    if(!built)build();
    update();
    setTimeout(()=>{if(map)map.invalidateSize()},50);
  }
  function close(){document.body.classList.remove('doh-mode')}

  const uniq=k=>[...new Set(latest.map(r=>r[k]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
  const opts=(all,vals)=>'<option value="">'+all+'</option>'+vals.map(v=>'<option>'+esc(v)+'</option>').join('');
  function build(){
    built=true;map=null;layer=null;provLayer=null;regionLayer=null;regionNums=null;keyCtl=null;mapScope='';
    if(!st.date)st.date=ddpmDates().pop()||'';
    pane.innerHTML='<div class="heading"><div><h1>ศูนย์พักพิงชั่วคราว · สุขาภิบาลสิ่งแวดล้อม</h1><p class="sub" id="dohSub"></p></div></div>'
     +'<div class="filters doh-filters">'+(P?'<div class="field"><label for="dohDate">วันรายงาน ปภ.</label><select id="dohDate">'+ddpmDates().slice().reverse().map(d=>'<option value="'+d+'">'+thDate(d)+'</option>').join('')+'</select></div>':'')
     +'<div class="field"><label for="dohRegion">เขตสุขภาพ</label><select id="dohRegion">'+opts('ทุกเขตสุขภาพ',uniq('region'))+'</select></div>'
     +'<div class="field"><label for="dohProv">จังหวัด</label><select id="dohProv">'+opts('ทุกจังหวัด',uniq('province'))+'</select></div>'
     +'<div class="field"><label for="dohStatus">สถานะ</label><select id="dohStatus">'+opts('ทุกสถานะ',uniq('status'))+'</select></div>'
     +'<div class="field"><label for="dohQ">ค้นหาชื่อศูนย์/อำเภอ</label><input id="dohQ" type="search"></div>'
     +'<button class="lightbtn" id="dohReset" type="button">ล้างตัวกรอง</button><button class="lightbtn" id="dohCsv" type="button">ส่งออก CSV</button></div>'
     +'<div class="cards" id="dohCards"></div>'
     +'<div class="grid doh-grid"><section class="panel"><div class="panel-head"><div><h2>แผนที่ศูนย์พักพิงและแนวโน้มระดับน้ำรายจังหวัด</h2><p class="sub" id="dohMapSub"></p></div><span class="badge" id="dohMapCount"></span></div>'
     +'<div class="map-tools"><label><input type="checkbox" id="dohPins" checked>1. หมุดศูนย์พักพิง</label>'
     +'<label style="margin-left:16px"><input type="checkbox" id="dohRegions" checked>2. เส้นเขตสุขภาพ <span style="display:inline-block;width:36px;height:1px;background:#475569" aria-hidden="true"></span></label>'
     +'<button type="button" class="lightbtn" id="dohRegionNums" aria-pressed="false">แสดงเลขเขตสุขภาพ</button><span id="dohRegionStatus" class="sub" style="margin-left:8px"></span>'
     +'<label style="margin-left:16px"><input type="checkbox" id="dohFlood" checked'+(P&&PG?'':' disabled')+'>3. แนวโน้มระดับน้ำ (ปภ.)</label>'
     +'<div style="display:flex;gap:6px;flex-wrap:wrap;border-left:1px solid #ddd;padding-left:10px">'
     +[['g','ดี'],['a','พอใช้'],['r','ต้องปรับปรุง'],['x','ไม่มีข้อมูล']].map(([k,l])=>'<label class="filter-pill"><input type="checkbox" class="doh-band" value="'+k+'" checked> <span>'+l+'</span></label>').join('')+'</div>'
     +'<button type="button" class="lightbtn" id="dohFit">จัดแผนที่ให้พอดี</button></div>'
     +'<div id="dohMap" class="map national-view"></div><div id="dohMobileKey"></div><p class="mini-note" id="dohMapNote" style="padding:10px 20px 14px"></p></section>'
     +'<section class="panel"><div class="panel-head"><div><h2>ระดับรายมิติ</h2><p class="sub">จำนวนศูนย์ตามระดับ · ระดับของมิติ = ข้อที่แย่ที่สุดที่ตอบ</p></div></div><div class="panel-body" id="dohDims"></div>'
     +'</section></div>'
     +'<section class="panel"><div class="panel-head"><div><h2>ข้อที่ยังไม่ได้ระดับดีมากที่สุด</h2><p class="sub" id="dohWorstSub"></p></div></div><div class="doh-tablewrap"><table id="dohWorstTbl"><thead><tr><th class="n">#</th><th>มิติ</th><th>ข้อ</th><th class="n">ต้องปรับปรุง</th><th class="n">พอใช้</th><th class="n">ดี</th><th class="n">ไม่ได้ตอบ</th><th>สัดส่วนที่ยังไม่ได้ระดับดี</th></tr></thead><tbody></tbody></table></div></section>'
     +'<section class="panel"><div class="panel-head"><div><h2>ศูนย์ที่ควรติดตามก่อน</h2><p class="sub" id="dohPrioSub"></p></div></div><div class="doh-tablewrap"><table id="dohPrio"><thead><tr><th>ศูนย์พักพิง</th><th>จังหวัด</th><th>ระดับ</th><th>ข้อที่ต้องปรับปรุง</th><th>การประเมินล่าสุด</th></tr></thead><tbody></tbody></table></div></section>'
     +'<div class="grid doh-grid2"><section class="panel"><div class="panel-head"><div><h2>ผู้รับบริการและกลุ่มเปราะบาง</h2><p class="sub" id="dohVulSub"></p></div></div><div class="panel-body" id="dohVul"></div></section>'
     +'<section class="panel"><div class="panel-head"><div><h2>รายจังหวัด</h2><p class="sub">ผู้รับบริการ (จำนวนศูนย์) · การประเมินล่าสุด</p></div></div><div class="panel-body" id="dohProvList"></div></section></div>'
     +'<div class="grid doh-grid2"><section class="panel"><div class="panel-head"><div><h2>ปัญหา/อุปสรรคที่รายงาน</h2><p class="sub" id="dohProbSub"></p></div></div><div class="panel-body doh-scroll" id="dohProblems"></div></section>'
     +'<section class="panel"><div class="panel-head"><div><h2>ข้อเสนอและการขอรับสิ่งสนับสนุน</h2></div></div><div class="panel-body doh-scroll" id="dohSupport"></div></section></div>'
     +'<div class="grid doh-grid2"><section class="panel"><div class="panel-head"><div><h2>แนวโน้มร้อยละข้อที่ได้ระดับ “ดี”</h2><p class="sub">รวมทุกการประเมินในแต่ละวัน · ค่าท้ายแถว = ร้อยละ (จำนวนครั้ง)</p></div></div><div class="panel-body" id="dohTrend"></div></section>'
     +'<section class="panel"><div class="panel-head"><div><h2>ผู้รับบริการสะสมรายวัน</h2><p class="sub">ผลรวมของการประเมินล่าสุดของแต่ละศูนย์ ณ สิ้นวันนั้น (ศูนย์ที่ยังไม่เคยประเมินไม่ถูกนับ)</p></div></div><div class="panel-body" id="dohOccTrend"></div></section></div>'
     +'<section class="panel"><div class="panel-head"><div><h2>รายการศูนย์พักพิง</h2><p class="sub">กดแถวเพื่อดูรายละเอียดและประวัติการประเมิน · กดหัวคอลัมน์เพื่อเรียง</p></div></div><div class="doh-tablewrap"><table id="dohTbl"><thead></thead><tbody></tbody></table></div></section>'
     +'<p class="mini-note" id="dohFoot"></p>'
     +'<dialog id="dohDlg" class="doh-dlg"><div class="doh-dlg-head"><h3 id="dohDlgT"></h3><button class="lightbtn" id="dohDlgX" type="button">ปิด</button></div><div class="doh-dlg-body" id="dohDlgB"></div></dialog>';
    $('dohProv').addEventListener('change',e=>{st.prov=e.target.value;update()});
    $('dohStatus').addEventListener('change',e=>{st.status=e.target.value;update()});
    $('dohRegion').addEventListener('change',e=>{
      st.region=e.target.value;st.prov='';
      $('dohProv').innerHTML=opts('ทุกจังหวัด',[...new Set(latest.filter(r=>!st.region||r.region===st.region).map(r=>r.province).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th')));
      update();
    });
    $('dohRegions').addEventListener('change',e=>{st.regions=e.target.checked;drawRegions()});
    $('dohPins').addEventListener('change',e=>{st.pins=e.target.checked;update()});
    $('dohRegionNums').addEventListener('click',()=>{st.nums=!st.nums;$('dohRegionNums').setAttribute('aria-pressed',String(st.nums));$('dohRegionNums').textContent=st.nums?'ซ่อนเลขเขตสุขภาพ':'แสดงเลขเขตสุขภาพ';drawRegions()});
    document.querySelectorAll('.doh-band').forEach(cb=>cb.addEventListener('change',()=>{st.bands=new Set([...document.querySelectorAll('.doh-band')].filter(x=>x.checked).map(x=>x.value));update()}));
    $('dohFit').addEventListener('click',()=>{mapScope='';update()});
    window.addEventListener('resize',syncKey);
    $('dohCsv').addEventListener('click',exportCsv);
    if($('dohDate')){$('dohDate').value=st.date;$('dohDate').addEventListener('change',e=>{st.date=e.target.value;update()})}
    if($('dohFlood'))$('dohFlood').addEventListener('change',e=>{st.flood=e.target.checked;update()});
    $('dohQ').addEventListener('input',e=>{st.q=e.target.value.trim();update()});
    $('dohReset').addEventListener('click',()=>{Object.assign(st,{prov:'',region:'',status:'',q:''});$('dohProv').innerHTML=opts('ทุกจังหวัด',uniq('province'));['dohProv','dohRegion','dohStatus','dohQ'].forEach(i=>$(i).value='');update()});
    $('dohTbl').tHead.addEventListener('click',e=>{const k=e.target.dataset.k;if(!k)return;st.dir=st.sort===k?-st.dir:1;st.sort=k;drawTable(filtered())});
    [$('dohTbl'),$('dohPrio')].forEach(t=>t.tBodies[0].addEventListener('click',e=>{const tr=e.target.closest('tr.doh-row');if(tr)openDetail(tr.dataset.id)}));
    $('dohDlgX').addEventListener('click',()=>$('dohDlg').close());
    $('dohDlg').addEventListener('click',e=>{if(e.target===$('dohDlg'))$('dohDlg').close()});
  }

  const filtered=()=>latest.filter(r=>(!st.prov||r.province===st.prov)&&(!st.region||r.region===st.region)&&(!st.status||r.status===st.status)&&(!st.q||(r.name+' '+r.district+' '+r.subdistrict).includes(st.q))&&st.bands.has(lk(r.level)));
  const bars=(rows,small)=>rows.map(r=>'<div class="doh-bar'+(small?' sm':'')+'"><span>'+esc(r.l)+'</span><span class="doh-track"><span class="doh-fill" style="width:'+Math.max(0,Math.min(100,r.w))+'%;background:'+r.c+'"></span></span><span class="doh-val">'+esc(r.v)+'</span></div>').join('');
  const allQ=()=>D.dims.flatMap(d=>d.qs);
  const stack=(c,total)=>'<span class="doh-stack" role="img" aria-label="ดี '+c[3]+' พอใช้ '+c[2]+' ต้องปรับปรุง '+c[1]+'">'+[[3,'g'],[2,'a'],[1,'r']].map(([k,x])=>c[k]?'<span style="width:'+(c[k]/total*100)+'%;background:'+COL[x]+'"></span>':'').join('')+'</span>';

  // Same look as the national water-station map: white canvas without tiles, province borders coloured by ปภ.
  // affected households, black health-region lines, a bottom-right key (moved under the map on phones).
  function keyHtml(){
    const dot=c=>'<i style="border:0;width:14px;height:14px;border-radius:50%;background:'+c+';margin:0 6px"></i>';
    // pins without a grade are hollow (white) so they cannot be mistaken for a grey/blue province fill
    const noData='<i style="border:2px solid #475569;width:14px;height:14px;border-radius:50%;background:#fff;box-sizing:border-box;margin:0 6px"></i>';
    const swatch=(c,a)=>'<i style="border:1.5px solid '+c+';width:18px;height:12px;border-radius:2px;background:'+(a?rgba(c,a):'#fff')+';box-sizing:border-box;margin:0 4px"></i>';
    return '<strong style="color:#3156c5">1. หมุดศูนย์พักพิง: ระดับสุขาภิบาล</strong>'
      +[['g','ดี'],['a','พอใช้'],['r','ต้องปรับปรุง'],['x','ไม่มีข้อมูล']].map(([k,l])=>'<div class="border-key">'+(k==='x'?noData:dot(COL[k]))+l+'</div>').join('')
      +'<hr><strong>2. เส้นเขตสุขภาพ</strong><div class="border-key"><i style="border-color:#000;border-top-width:1px"></i>เส้นแบ่งเขต</div>'
      +(P&&PG?'<hr><strong style="color:#082f6b">3. แนวโน้มระดับน้ำ (ปภ.)</strong>'
        +Object.keys(TREND).map(t=>'<div class="border-key">'+swatch(TREND[t].color,TREND_FILL)+t+'</div>').join('')
        +'<div class="border-key">'+swatch('#cbd5e1',0)+'ไม่อยู่ในรายงาน</div>':'')
      +'<small style="display:block;margin-top:6px">หมุดทุกศูนย์ขนาดเท่ากัน · สีจังหวัดไม่ใช่ขอบเขตน้ำท่วมจริง</small>';
  }
  function syncKey(){
    const el=keyCtl&&keyCtl.getContainer();if(!el)return;
    const target=matchMedia('(max-width:767px)').matches?$('dohMobileKey'):$('dohMap').querySelector('.leaflet-bottom.leaflet-right');
    if(target&&el.parentElement!==target)target.append(el);
  }
  function drawRegions(){
    if(!map)return;
    if(regionLayer){map.removeLayer(regionLayer);regionLayer=null}
    if(regionNums){regionNums.remove();regionNums=null}
    if(!HR){$('dohRegionStatus').textContent=st.regions?'โหลดเส้นเขตสุขภาพไม่สำเร็จ':'';return}
    if(st.regions){
      regionLayer=L.geoJSON(HR,{pane:'dohRegionLines',interactive:false,style:{className:'health-region-outline',color:'#000000',weight:1,lineCap:'butt',opacity:1,fill:false}}).addTo(map);
      $('dohRegionStatus').textContent=HR.features.length+' เขตสุขภาพ';
    }else $('dohRegionStatus').textContent='';
    if(st.nums){
      regionNums=L.layerGroup().addTo(map);
      HR.features.forEach(f=>{
        const label=String(f.properties.region||''),num=(label.match(/[0-9]+/)||[])[0];if(!num)return;
        L.marker(L.geoJSON(f).getBounds().getCenter(),{pane:'dohRegionLabels',interactive:false,keyboard:false,icon:L.divIcon({className:'health-region-number',html:'<span title="'+esc(label)+'">'+esc(num)+'</span>',iconSize:[26,26],iconAnchor:[13,13]})}).addTo(regionNums);
      });
    }
  }
  function drawMap(rows){
    const el=$('dohMap');
    if(!window.L){el.innerHTML='<p class="empty">โหลดแผนที่ไม่สำเร็จ ใช้ตารางด้านล่างแทนได้</p>';return}
    if(!map){
      el.innerHTML='';map=L.map(el,{scrollWheelZoom:false}).setView([13.7,100.5],6);el.style.background='#ffffff';
      map.createPane('dohProvinces').style.zIndex=450;
      map.createPane('dohShelters').style.zIndex=670;
      const lp=map.createPane('dohRegionLines');lp.style.zIndex=650;lp.style.pointerEvents='none';
      const np=map.createPane('dohRegionLabels');np.style.zIndex=660;np.style.pointerEvents='none';
      if(PG)provLayer=L.geoJSON(PG,{pane:'dohProvinces',style:()=>({className:'national-province',color:'#94a3b8',weight:1.2,opacity:.5,fill:false}),onEachFeature:(f,l)=>l.bindTooltip('')}).addTo(map);
      layer=L.layerGroup().addTo(map);
      keyCtl=L.control({position:'bottomright'});
      keyCtl.onAdd=()=>{const c=L.DomUtil.create('div','national-map-key');c.innerHTML=keyHtml();L.DomEvent.disableClickPropagation(c);L.DomEvent.disableScrollPropagation(c);return c};
      keyCtl.addTo(map);
      drawRegions();
    }
    syncKey();
    layer.clearLayers();
    const provs=new Set(rows.map(r=>r.province));
    if(provLayer)provLayer.eachLayer(l=>{
      const name=l.feature.properties.pro_th,t=trend.get(name),n=ddpm.get(name),on=st.flood&&P;
      l.setStyle(on&&t?{color:trendColor(t),weight:1.5,opacity:1,fill:true,fillColor:trendColor(t),fillOpacity:TREND_FILL}:{color:'#94a3b8',weight:1.2,opacity:.5,fill:false});
      l.setTooltipContent('<b>'+esc(name)+'</b><br>'+(!P?'ไม่มีข้อมูล ปภ.':t?'ระดับน้ำ'+esc(t)+(n!==undefined?' · '+fmt(n)+' ครัวเรือนประสบภัย':''):'ไม่อยู่ในรายงาน ปภ. วันที่เลือก')+(provs.has(name)?'<br>ศูนย์พักพิงที่แสดง '+rows.filter(r=>r.province===name).length+' แห่ง':'')+'<br>'+thDate(st.date));
    });
    const pins=st.pins?rows.filter(r=>r.lat!=null):[];
    pins.forEach(r=>{
      const t=trend.get(r.province);
      const m=L.circleMarker([r.lat,r.lon],{pane:'dohShelters',radius:8,color:r.level?'#fff':'#475569',weight:2,fillColor:r.level?COL[lk(r.level)]:'#ffffff',fillOpacity:.95});
      m.bindTooltip(esc(r.name)+' · '+esc(r.province)+' · ระดับ'+lvLabel(r.level)+(t?' · ระดับน้ำ'+esc(t):''));m.on('click',()=>openDetail(r.shelter_id));m.addTo(layer);
    });
    $('dohMapCount').textContent=fmt(pins.length)+' ศูนย์บนแผนที่';
    $('dohMapSub').textContent=(P?'สีจังหวัดตามแนวโน้มระดับน้ำ ปภ. วันที่ '+thDate(st.date)+' · ':'')+'หมุดตามผลประเมินล่าสุดของแต่ละศูนย์';
    $('dohMapNote').textContent='สีจังหวัดมาจากแนวโน้มระดับน้ำในรายงาน ปภ. (ไม่ใช่ขอบเขตน้ำท่วมจริง จังหวัดที่ไม่อยู่ในรายงานไม่ได้แปลว่าไม่ท่วม) · หมุดที่ไม่มีพิกัดที่ใช้ได้จะไม่แสดงบนแผนที่แต่ยังอยู่ในตาราง';
    map.stop();map.invalidateSize({animate:false});
    const scope=[st.region,st.prov].join('|');
    if(scope!==mapScope){
      mapScope=scope;
      let b=null;
      if(PG)provLayer.eachLayer(l=>{if((!st.prov&&!st.region)||provs.has(l.feature.properties.pro_th)){b=b||L.latLngBounds([]);b.extend(l.getBounds())}});
      if(!b&&pins.length)b=L.latLngBounds(pins.map(r=>[r.lat,r.lon]));
      if(b&&b.isValid())map.fitBounds(b,{padding:[20,20],maxZoom:11,animate:false});
    }
  }

  function update(){
    computeDdpm();
    const rows=filtered(),open=rows.filter(r=>r.status==='เปิดให้บริการ');
    const occ=sum(rows,'occupants'),cap=sum(rows,'capacity'),vul=sum(rows,'vulnerable');
    const lc={3:0,2:0,1:0,0:0};rows.forEach(r=>{lc[r.level||0]++});
    const dates=D.records.map(r=>r.assess_date).filter(Boolean).sort();
    $('dohSub').textContent='ข้อมูลจากชีต doh_shelter · '+D.records.length+' รายการประเมิน จาก '+latest.length+' ศูนย์ · ช่วงวันที่ประเมิน '+thDate(dates[0])+' – '+thDate(dates[dates.length-1]);
    $('dohCards').innerHTML=[
      ['ศูนย์พักพิง',fmt(rows.length),'เปิดให้บริการ '+fmt(open.length)+' · ปิด '+fmt(rows.length-open.length)],
      ['ผู้รับบริการปัจจุบัน',fmt(occ),'ความจุรวม '+fmt(cap)+' คน ('+(pct(occ,cap)??'-')+'%)'],
      ['กลุ่มเปราะบาง',fmt(vul),(pct(vul,occ)??'-')+'% ของผู้รับบริการ'],
      ['ศูนย์ที่ได้ระดับ “ดี”',fmt(lc[3]),'พอใช้ '+fmt(lc[2])+' · ต้องปรับปรุง '+fmt(lc[1])+' · ไม่มีข้อมูล '+fmt(lc[0])],
      P?['ศูนย์ในจังหวัดที่ ปภ. รายงานผู้ประสบภัย',fmt(rows.filter(r=>r.flood).length),'จาก '+fmt(rows.length)+' ศูนย์ · ปภ. '+thDate(st.date)+' (ไม่อยู่ในรายงาน ≠ ไม่ท่วม)']:
      ['จังหวัดที่มีศูนย์',fmt(new Set(rows.map(r=>r.province)).size),'ครอบคลุม '+fmt(new Set(rows.map(r=>r.region)).size)+' เขตสุขภาพ']
    ].map(c=>'<div class="card"><div class="eyebrow">'+c[0]+'</div><div class="number">'+c[1]+'</div><div class="card-note">'+c[2]+'</div></div>').join('');
    if(P){
      // provinces in the selected ปภ. report by water-level trend (national, not narrowed by the shelter filters)
      const tc={'เพิ่มขึ้น':0,'ทรงตัว':0,'ลดลง':0};trend.forEach(t=>{tc[t]++});
      const wave='<path d="M6 36q4-4 8 0t8 0t8 0t8 0t8 0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>';
      const ICON={
        'เพิ่มขึ้น':'<path d="M10 26L22 14M14 13h9v9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
        'ทรงตัว':'<path d="M13 15h16M13 22h16" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>',
        'ลดลง':'<path d="M21 11v15M14 20l7 7 7-7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'};
      // same colours as the province fill on the map and the trend badges of the main dashboard; the light blue needs dark text
      const FG={'เพิ่มขึ้น':'#fff','ทรงตัว':'#fff','ลดลง':'#082f6b'};
      $('dohCards').insertAdjacentHTML('beforeend',Object.keys(tc).map(t=>'<div class="card doh-trend-card" style="background:'+TREND[t].color+';color:'+FG[t]+'" title="จังหวัดในรายงาน ปภ. วันที่ '+thDate(st.date)+' ที่ระดับน้ำ'+t+'">'
        +'<svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true"><circle cx="22" cy="22" r="21" fill="none" stroke="currentColor" stroke-width="2"/>'+ICON[t]+wave.replace(/M6 36/,'M6 33')+'</svg>'
        +'<div><div class="doh-trend-label">น้ำ'+t+'</div><div class="doh-trend-num">'+fmt(tc[t])+' <span>จ.</span></div></div></div>').join(''));
    }

    const cnt=(rs,f)=>{const c={3:0,2:0,1:0,0:0};rs.forEach(r=>{c[f(r)||0]++});return c};
    $('dohDims').innerHTML=D.dims.map(d=>{
      const c=cnt(rows,r=>r.dim_levels[d.id]),n=c[3]+c[2]+c[1];
      if(!d.qs.length||!n)return '<div class="doh-dim-row"><b>'+esc(d.name)+'</b><span class="doh-dim-na">ข้อมูลไม่ครบ'+(d.missing.length?' · ชีตไม่มีคอลัมน์: '+d.missing.map(esc).join(', '):'')+'</span></div>';
      return '<div class="doh-dim-row"><b>'+esc(d.name)+'</b>'+stack(c,n)+'<span class="doh-dim-legend">ดี '+c[3]+' · พอใช้ '+c[2]+' · ต้องปรับปรุง '+c[1]+(d.missing.length?' · ไม่มีคอลัมน์: '+d.missing.map(esc).join(', '):'')+'</span></div>';
    }).join('')||'<p class="empty">ไม่มีข้อมูล</p>';
    const dimOf=new Map(D.dims.flatMap(d=>d.qs.map(q=>[q.key,d.name])));
    const items=allQ().map(q=>({l:q.label,dim:dimOf.get(q.key),c:cnt(rows,r=>r.levels[q.key])})).filter(o=>o.c[1]+o.c[2]>0).sort((a,b)=>b.c[1]-a.c[1]||b.c[2]-a.c[2]);
    $('dohWorstSub').textContent='เรียงตามจำนวนศูนย์ที่ต้องปรับปรุง แล้วตามพอใช้ · '+fmt(items.length)+' จาก '+fmt(allQ().length)+' ข้อ มีอย่างน้อย 1 ศูนย์ที่ยังไม่ได้ระดับดี (รวม '+fmt(rows.length)+' ศูนย์)';
    $('dohWorstTbl').tBodies[0].innerHTML=items.map((o,i)=>'<tr><td class="n">'+(i+1)+'</td><td>'+esc(o.dim)+'</td><td>'+esc(o.l)+'</td><td class="n">'+(o.c[1]?'<span class="doh-pill r">'+o.c[1]+'</span>':'-')+'</td><td class="n">'+(o.c[2]?'<span class="doh-pill a">'+o.c[2]+'</span>':'-')+'</td><td class="n">'+o.c[3]+'</td><td class="n">'+o.c[0]+'</td><td style="min-width:160px">'+stack({3:0,2:o.c[2],1:o.c[1]},Math.max(1,rows.length))+'</td></tr>').join('')||'<tr><td colspan="8" class="empty">ไม่มีข้อที่ต่ำกว่าระดับดี</td></tr>';

    const V=[['ผู้สูงอายุ','elderly'],['ผู้พิการ','disabled'],['ผู้ป่วยติดเตียง','bedridden'],['หญิงตั้งครรภ์','pregnant'],['เด็กเล็ก 0-5 ปี','child'],['ผู้ป่วยฟอกไต','dialysis'],['ผู้ป่วยจิตเวชเรื้อรัง','psychiatric']];
    const vmax=Math.max(1,...V.map(v=>sum(rows,v[1])));
    $('dohVulSub').textContent='รวมผู้รับบริการ '+fmt(occ)+' คน (ชาย '+fmt(sum(rows,'male'))+' · หญิง '+fmt(sum(rows,'female'))+' เฉพาะศูนย์ที่ระบุเพศ)';
    $('dohVul').innerHTML=bars(V.map(v=>({l:v[0],w:sum(rows,v[1])/vmax*100,v:fmt(sum(rows,v[1])),c:'#087873'})),true);

    const PM=new Map();rows.forEach(r=>{const o=PM.get(r.province)||PM.set(r.province,{n:0,occ:0}).get(r.province);o.n++;o.occ+=r.occupants||0});
    const pl=[...PM].sort((a,b)=>b[1].occ-a[1].occ||b[1].n-a[1].n),pm=Math.max(1,...pl.map(p=>p[1].occ));
    $('dohProvList').innerHTML=bars(pl.map(([k,o])=>({l:k+' ('+o.n+')',w:o.occ/pm*100,v:fmt(o.occ),c:'#087873'})),true)||'<p class="empty">ไม่มีข้อมูล</p>';

    const pr=rows.filter(r=>r.problems.length);
    $('dohProbSub').textContent=fmt(pr.length)+' ศูนย์ที่รายงานปัญหา';
    $('dohProblems').innerHTML=pr.map(r=>'<div class="doh-prob"><b>'+esc(r.name)+' · '+esc(r.province)+'</b>'+r.problems.map(p=>esc(p).replace(/\n/g,'<br>')).join('<br>')+'</div>').join('')||'<p class="empty">ไม่มีปัญหาที่รายงาน</p>';
    const sp=rows.filter(r=>(r.support&&r.support!=='-')||r.recommend);
    $('dohSupport').innerHTML=sp.map(r=>'<div class="doh-prob"><b>'+esc(r.name)+' · '+esc(r.province)+'</b>'+(r.recommend?'ข้อเสนอ: '+esc(r.recommend)+'<br>':'')+(r.support&&r.support!=='-'?'ขอสนับสนุน: '+esc(r.support):'')+'</div>').join('')||'<p class="empty">ไม่มีรายการ</p>';

    const ids=new Set(rows.map(r=>r.shelter_id)),hist=D.records.filter(r=>ids.has(r.shelter_id)&&r.assess_date);
    const days=new Map();hist.forEach(r=>{const o=days.get(r.assess_date)||days.set(r.assess_date,{y:0,n:0,c:0}).get(r.assess_date);o.y+=r.score.y;o.n+=r.score.n;o.c++});
    const dl=[...days].sort((a,b)=>a[0].localeCompare(b[0]));
    $('dohTrend').innerHTML=bars(dl.map(([d,o])=>{const p=pct(o.y,o.n);return{l:thDate(d),w:p||0,v:(p==null?'-':p+'%')+' ('+o.c+')',c:'#087873'}}),true)||'<p class="empty">ไม่มีข้อมูล</p>';
    const occ_=dl.map(([d])=>{let t=0;byShelter.forEach((a,id)=>{if(!ids.has(id))return;const last=a.filter(r=>r.assess_date&&r.assess_date<=d).pop();if(last)t+=last.occupants||0});return[d,t]});
    const om=Math.max(1,...occ_.map(o=>o[1]));
    $('dohOccTrend').innerHTML=bars(occ_.map(([d,t])=>({l:thDate(d),w:t/om*100,v:fmt(t),c:'#4b8ca0'})),true)||'<p class="empty">ไม่มีข้อมูล</p>';

    const pri=rows.filter(r=>r.status==='เปิดให้บริการ'&&(r.poor.length||r.fair.length||r.stale)).sort((a,b)=>b.priority-a.priority).slice(0,10);
    $('dohPrioSub').textContent='ศูนย์ที่เปิดอยู่ เรียงตามคะแนนความเร่งด่วน (40 ต่อข้อที่ต้องปรับปรุง + 10 ต่อข้อพอใช้ + 10 ถ้าไม่ได้ประเมินเกิน '+D.stale_days+' วัน) · แสดง '+pri.length+' อันดับแรก';
    $('dohPrio').tBodies[0].innerHTML=pri.map(r=>'<tr class="doh-row" data-id="'+esc(r.shelter_id)+'"><td>'+esc(r.name)+(r.flood?' <span class="doh-pill b">จังหวัดมีผู้ประสบภัย</span>':'')+'</td><td>'+esc(r.province)+'</td><td>'+lvPill(r.level)+'</td><td>'+(r.poor.map(esc).join(', ')||'-')+'</td><td>'+thDate(r.assess_date)+(r.stale?' <span class="doh-pill a">เกิน '+D.stale_days+' วัน</span>':'')+'</td></tr>').join('')||'<tr><td colspan="5" class="empty">ไม่มีศูนย์ที่ต้องติดตามตามเกณฑ์นี้</td></tr>';
    $('dohFoot').textContent='ดึงข้อมูลเมื่อ '+new Date(D.fetched_at).toLocaleString('th-TH')+' · ผลรวมใช้การประเมินล่าสุดของแต่ละศูนย์ · ระดับตาม แนวทางจัดระดับศพพ. (ข้อแย่สุดเป็นตัวกำหนดมิติและศูนย์ ไม่นับข้อที่ไม่ได้ตอบ) · แปลงวันที่ พ.ศ./ค.ศ. ในชีตเป็นรูปแบบเดียวกันแล้ว';
    drawMap(rows);drawTable(rows);
  }

  const COLS=[['name','ศูนย์พักพิง'],['province','จังหวัด'],['district','อำเภอ'],['status','สถานะ'],['occupants','ผู้รับบริการ','n'],['capacity','รองรับ','n'],['vulnerable','เปราะบาง','n'],['lv','ระดับ'],['assess_date','ประเมินล่าสุด']];
  function drawTable(rows){
    $('dohTbl').tHead.innerHTML='<tr>'+COLS.map(c=>'<th class="'+(c[2]||'')+'" data-k="'+c[0]+'">'+c[1]+(st.sort===c[0]?(st.dir>0?' ▲':' ▼'):'')+'</th>').join('')+'</tr>';
    const val=(r,k)=>k==='lv'?(r.level??0):r[k];
    const s=rows.slice().sort((a,b)=>{const x=val(a,st.sort),y=val(b,st.sort);return (typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??''),'th'))*st.dir});
    $('dohTbl').tBodies[0].innerHTML=s.map(r=>'<tr class="doh-row" data-id="'+esc(r.shelter_id)+'"><td>'+esc(r.name)+'</td><td>'+esc(r.province)+'</td><td>'+esc(r.district)+'</td><td>'+esc(r.status)+'</td><td class="n">'+fmt(r.occupants)+'</td><td class="n">'+fmt(r.capacity)+'</td><td class="n">'+fmt(r.vulnerable)+'</td><td>'+lvPill(r.level)+'</td><td>'+thDate(r.assess_date)+'</td></tr>').join('')||'<tr><td colspan="9" class="empty">ไม่มีศูนย์ที่ตรงกับตัวกรอง</td></tr>';
  }

  function exportCsv(){
    const cell=v=>{v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
    const head=['รหัสศูนย์','ชื่อศูนย์','จังหวัด','อำเภอ','เขตสุขภาพ','สถานะ','ผู้รับบริการ','รองรับสูงสุด','กลุ่มเปราะบาง','ระดับ','ข้อที่ต้องปรับปรุง','ข้อที่พอใช้','ข้อที่ได้ดี (%)','ประเมินล่าสุด','ละติจูด','ลองจิจูด'].concat(P?['วันรายงาน ปภ.','ครัวเรือนประสบภัยในจังหวัด (ปภ.)']:[]);
    const lines=[head].concat(filtered().map(r=>[r.shelter_id,r.name,r.province,r.district,r.region,r.status,r.occupants,r.capacity,r.vulnerable,lvLabel(r.level),r.poor.join(' | '),r.fair.join(' | '),r.score.p,r.assess_date,r.lat,r.lon].concat(P?[st.date,r.flood||'']:[])));
    const blob=new Blob(['\ufeff'+lines.map(l=>l.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='doh_shelter_'+D.fetched_at.slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function openDetail(id){
    const hist=byShelter.get(id);if(!hist)return;const r=hist[hist.length-1];
    $('dohDlgT').textContent=r.name;
    const kv=[['ที่ตั้ง',[r.subdistrict,r.district,r.province].filter(Boolean).join(' · ')],['หน่วยรายงาน',r.agency],['เขตสุขภาพ',r.region],['ขนาด',r.size],['สถานะ',r.status+(r.open_date?' (เปิด '+thDate(r.open_date)+(r.close_date?' ปิด '+thDate(r.close_date):'')+')':'')],
      ['ผู้รับบริการ / รองรับ',fmt(r.occupants)+' / '+fmt(r.capacity)+' คน'],['กลุ่มเปราะบาง',fmt(r.vulnerable)+' คน'],['ภัย',r.hazard],['ผลคลอรีนคงเหลือ',r.ppm||'-'],['ปริมาณมูลฝอย',r.garbage||'-'],['สัตว์/แมลงพาหะที่พบ',r.vectors||'-']].concat(P?[['ผู้ประสบภัยในจังหวัด (ปภ. '+thDate(st.date)+')',r.flood?fmt(r.flood)+' ครัวเรือน':'ไม่อยู่ในรายงาน']]:[]);
    let h='<table class="doh-detail">'+kv.map(([k,v])=>'<tr><td>'+k+'</td><td>'+esc(v)+'</td></tr>').join('')+'</table>';
    h+='<h4>ผลการประเมินล่าสุด ('+thDate(r.assess_date)+') · ระดับ '+lvLabel(r.level)+'</h4>';
    D.dims.forEach(d=>{
      h+='<p class="doh-dim"><b>'+esc(d.name)+'</b> '+(d.qs.length?lvPill(r.dim_levels[d.id]):'<span class="doh-pill x">ข้อมูลไม่ครบ</span>')+'</p>';
      if(d.qs.length)h+='<div class="doh-chk">'+d.qs.map(q=>'<span>'+esc(q.label)+' <small>('+esc(r.answers[q.key]||'ไม่ตอบ')+')</small></span><span>'+lvPill(r.levels[q.key])+'</span>').join('')+'</div>';
      if(d.missing.length)h+='<p class="doh-dim-na">ชีตไม่มีคอลัมน์สำหรับ: '+d.missing.map(esc).join(', ')+'</p>';
    });
    if(r.problems.length)h+='<h4>ปัญหา/อุปสรรค</h4>'+r.problems.map(p=>'<div class="doh-prob">'+esc(p).replace(/\n/g,'<br>')+'</div>').join('');
    if(hist.length>1)h+='<h4>ประวัติการประเมิน ('+hist.length+' ครั้ง)</h4><table class="doh-detail">'+hist.map(x=>'<tr><td>'+thDate(x.assess_date)+'</td><td class="n">'+fmt(x.occupants)+' คน</td><td>'+lvPill(x.level)+'</td></tr>').join('')+'</table>';
    const imgs=(r.images||[]).map(safeUrl).filter(Boolean);
    if(imgs.length)h+='<h4>ภาพประกอบ</h4>'+imgs.map((u,i)=>'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">ภาพ '+(i+1)+'</a>').join(' · ');
    $('dohDlgB').innerHTML=h;$('dohDlg').showModal();
  }

  tab.addEventListener('click',open);
  document.querySelectorAll('.tab').forEach(x=>{if(x!==tab)x.addEventListener('click',close)});
})();
