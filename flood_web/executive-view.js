/* "รายงานผู้บริหาร" tab: a one-page poster for executives, saved as a 1179x2200 PNG and
   sent on LINE. GitHub Pages build only (see build.py / build_pages.py). Reads its sheet tabs straight from the Google Sheet
   CSV export, independently of the dashboard's own data load: Disaster_DB and Vulnerable_group (required), and
   flood_waterlogged_amphoe (2P2R levels) and tmd_rain_level / tmd_outlook_card / tmd_risk_outlook (optional: the poster
   shows "no data" in that section). The data rules are DashboardModel.exec* in data-model.js. */
(function(){
  const tab=document.getElementById('tab-exec'),pane=document.getElementById('execPane');
  if(!tab||!pane)return;
  const M=window.DashboardModel,$=id=>document.getElementById(id);
  const SHEET='1RQDU83exQhNpVYjp9JyD5UdocA6JB6GpJeXA-Qe8Pr4';   // = CONFIG.spreadsheetId (Config.gs)
  const REQUIRED=['Disaster_DB','Vulnerable_group'],OPTIONAL=['flood_waterlogged_amphoe','tmd_rain_level','tmd_outlook_card','tmd_risk_outlook'];
  // Saved image: iPhone 15 width (1179 px) but shorter than its screen (2556 px). Shown full-width, the photo viewer centres it
  // with ~59 pt bars above and below, so the Dynamic Island, the home bar and the rounded corners fall outside the image.
  // The poster is laid out 540 CSS px wide with the same ratio and saved at 1179/540x.
  const OUT_W=1179,OUT_H=2200,POSTER_W=540,POSTER_H=POSTER_W*OUT_H/OUT_W;
  const DASH_URL='https://moph.link/sat-doh',LOGO='doh_logo_w.svg';
  const SHOT_LIB='https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.0/dist/index.js',QR_LIB='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>n==null?'-':Math.round(n).toLocaleString('th-TH');
  const fmtM=n=>n>=1e6?(n/1e6).toFixed(2)+' ล้าน':fmt(n);
  const TH_MONTH=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const ymd=v=>String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const thDate=v=>{const m=ymd(v);return m?(+m[3])+' '+TH_MONTH[+m[2]-1]+' '+(+m[1]+543):'-'};
  const thDay=v=>{const m=ymd(v);return m?(+m[3])+' '+TH_MONTH[+m[2]-1]:'-'};
  const NONE='#e7eff1',OUTSIDE={fill:'#f8fafc',stroke:'#dbe3ea',width:0.3};
  const st={tables:null,errors:{},geo:null,region:null,loading:null,built:false};

  // ── data ──
  function parseCsv(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c}else if(c==='"')q=true;else if(c===',')row.push(cell),cell='';else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';rows.push(row);row=[]}else cell+=c}if(cell!==''||row.length){row.push(cell);rows.push(row)}return rows}
  async function readTab(name){
    const r=await fetch('https://docs.google.com/spreadsheets/d/'+SHEET+'/gviz/tq?tqx=out:csv&sheet='+encodeURIComponent(name),{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const [h,...rows]=parseCsv(await r.text());
    if(!h||!rows.length)throw new Error('ไม่มีแถวข้อมูล');
    return rows.filter(x=>x.some(c=>c!=='')).map(x=>Object.fromEntries(h.map((k,i)=>[k.trim(),(x[i]??'').trim()])));
  }
  const loadScript=src=>new Promise((ok,fail)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>fail(new Error('load '+src));document.head.appendChild(s)});
  let qrReady=null,shotReady=null;
  function load(){
    if(st.loading)return st.loading;
    if(!qrReady)qrReady=loadScript(QR_LIB).catch(e=>{qrReady=null;console.warn('[executive] QR library',e)});
    const geo=window.PROVINCES_GEOJSON?Promise.resolve(window.PROVINCES_GEOJSON):fetch('/thai_provinces.json').then(r=>r.ok?r.json():null).catch(()=>null);
    // Health-region outlines are optional: without them the map just has no region lines.
    const regions=window.HEALTH_REGIONS_GEOJSON?Promise.resolve(window.HEALTH_REGIONS_GEOJSON):fetch('/regions.geojson').then(r=>r.ok?r.json():null).catch(()=>null);
    const names=[...REQUIRED,...OPTIONAL];
    st.loading=Promise.all([Promise.allSettled(names.map(readTab)),geo,regions,qrReady]).then(([res,g,hr])=>{
      st.tables={};st.errors={};
      res.forEach((r,i)=>{if(r.status==='fulfilled')st.tables[names[i]]=r.value;else{st.tables[names[i]]=[];st.errors[names[i]]=r.reason&&r.reason.message||'อ่านไม่ได้'}});
      st.geo=g&&g.features?g:null;st.regions=hr&&hr.features?hr:null;
    }).finally(()=>{st.loading=null});
    return st.loading;
  }

  // ── SVG maps (equirectangular with cos(lat) correction; literal colours so the PNG export keeps them) ──
  // focus = Set of province names to frame (a health region) or null for the whole country; maxH caps the height.
  const mapCache=new Map();
  function mapPaths(width,focus,maxH){
    const key=width+'|'+maxH+'|'+(focus?[...focus].sort().join(','):'');
    if(mapCache.has(key))return mapCache.get(key);
    let lon0=97.3,lon1=105.7,lat0=5.5,lat1=20.5;
    if(focus&&focus.size){
      lon0=lat0=Infinity;lon1=lat1=-Infinity;
      for(const f of st.geo.features){if(!focus.has(f.properties.pro_th))continue;
        for(const poly of f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates)for(const [x,y] of poly[0]){if(x<lon0)lon0=x;if(x>lon1)lon1=x;if(y<lat0)lat0=y;if(y>lat1)lat1=y}}
      const px=(lon1-lon0)*0.08,py=(lat1-lat0)*0.08;lon0-=px;lon1+=px;lat0-=py;lat1+=py;
    }
    const k=Math.cos((lat0+lat1)/2*Math.PI/180),sc=Math.min(width/((lon1-lon0)*k),maxH/(lat1-lat0));
    const P=([x,y])=>[(x-lon0)*k*sc,(lat1-y)*sc],paths=new Map();
    const pathOf=f=>{let d='';
      for(const poly of f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates)for(const ring of poly){let last=null,seg='',n=0;
        for(const c of ring){const p=P(c);if(last&&Math.abs(p[0]-last[0])<0.5&&Math.abs(p[1]-last[1])<0.5)continue;seg+=(n?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1);last=p;n++}
        if(n>=3)d+=seg+'Z'}
      return d};
    for(const f of st.geo.features)paths.set(f.properties.pro_th,pathOf(f));
    // health-region outlines (regions.geojson), drawn over the province fill in the same projection
    const regions=st.regions?st.regions.features.map(pathOf).join(''):'';
    const out={paths,regions,tmd:tmdOutline(P),width:Math.round((lon1-lon0)*k*sc),height:Math.round((lat1-lat0)*sc)};
    mapCache.set(key,out);return out;
  }
  // Outlines of TMD's forecast regions (M.execTmdRegionOf) traced from the province rings: a border segment is drawn when
  // only one province has it (coast, national border) or when the two provinces sharing it are in different regions.
  // Neighbouring provinces share their border vertices in thai_provinces.json, so shared segments match exactly.
  let tmdSegs=null;
  function tmdOutline(P){
    const key=([x,y])=>x.toFixed(6)+','+y.toFixed(6),edge=(a,b)=>{const p=key(a),q=key(b);return p<q?p+'|'+q:q+'|'+p};
    const rings=f=>(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).flat();
    if(!tmdSegs){
      const owners=new Map();
      for(const f of st.geo.features){const r=M.execTmdRegionOf.get(f.properties.pro_th)||f.properties.pro_th;
        for(const ring of rings(f))for(let i=1;i<ring.length;i++){const e=edge(ring[i-1],ring[i]);(owners.get(e)||owners.set(e,[]).get(e)).push(r)}}
      tmdSegs=new Set([...owners].filter(([,rs])=>rs.length===1||rs.some(r=>r!==rs[0])).map(([e])=>e));
    }
    // walk each ring and join consecutive boundary segments into polylines; each shared border is drawn once. Polylines
    // shorter than 3 px are dropped: they are the few places where neighbouring provinces' vertices do not quite match.
    const done=new Set();let d='',line='',len=0,last=null;
    const flush=()=>{if(line&&len>=3)d+=line;line='';len=0};
    for(const f of st.geo.features)for(const ring of rings(f)){
      for(let i=1;i<ring.length;i++){const e=edge(ring[i-1],ring[i]);
        if(!tmdSegs.has(e)||done.has(e)){flush();continue}
        done.add(e);const a=P(ring[i-1]),b=P(ring[i]);
        if(!line){line='M'+a[0].toFixed(1)+' '+a[1].toFixed(1);last=a}
        const step=Math.hypot(b[0]-last[0],b[1]-last[1]);
        if(step>=0.5||i===ring.length-1){line+='L'+b[0].toFixed(1)+' '+b[1].toFixed(1);len+=step;last=b}
      }
      flush();
    }
    return d;
  }
  // styleOf(province) -> {fill, stroke, width}; regionWidth > 0 draws the health-region outlines on top, tmdWidth > 0 the
  // TMD forecast-region outlines.
  function svgMap(m,styleOf,regionWidth,tmdWidth){
    let s='<svg viewBox="0 0 '+m.width+' '+m.height+'" xmlns="http://www.w3.org/2000/svg" style="overflow:hidden">';
    for(const [p,d] of m.paths){const x=styleOf(p);s+='<path d="'+d+'" fill="'+x.fill+'" stroke="'+x.stroke+'" stroke-width="'+x.width+'"><title>'+esc(p)+'</title></path>'}
    if(regionWidth&&m.regions)s+='<path d="'+m.regions+'" fill="none" stroke="#17333e" stroke-width="'+regionWidth+'" stroke-linejoin="round"/>';
    if(tmdWidth&&m.tmd)s+='<path d="'+m.tmd+'" fill="none" stroke="#17333e" stroke-width="'+tmdWidth+'" stroke-linejoin="round" stroke-linecap="round"/>';
    return s+'</svg>';
  }
  function qrBox(){
    if(typeof window.qrcode!=='function')return '';
    const q=window.qrcode(0,'M');q.addData(DASH_URL);q.make();
    return '<div class="x-qr">'+q.createSvgTag({cellSize:4,margin:1,scalable:true})+'<div><b>ติดตามสถานการณ์</b><span>moph.link/sat-doh</span></div></div>';
  }

  // ── the poster ──
  // region = health region number, or null for the whole country. Everything follows it except the TMD text, which TMD
  // writes per TMD region, so it stays national.
  function poster(){
    const T=st.tables,region=st.region,vul=M.execVulnerable(T.Vulnerable_group),regionOf=M.execRegionOf(vul);
    const inR=p=>!region||regionOf.get(p)===region,focus=region?new Set([...regionOf].filter(([,n])=>n===region).map(([p])=>p)):null;
    const S=M.execDdpm(T.Disaster_DB,region?inR:null),ex=M.exposure(vul,S.cur.map(x=>x.province));
    const levels=new Map([...M.execProvinceLevels(T.flood_waterlogged_amphoe)].filter(([p])=>inR(p)));
    const groups=M.execByRegion(M.execProvinceList(levels,S.cur),regionOf);
    const rain=M.execRainDays(T.tmd_rain_level,3,region?inR:null),rainColor=new Map(M.EXEC_RAIN.map(b=>[b.level,b.color]));
    const big=mapPaths(232,focus,425),small=mapPaths(72,focus,132);
    const lv=p=>M.EXEC_P2R[levels.get(p)]||null;
    const p2rStyle=p=>{if(!inR(p))return OUTSIDE;const l=lv(p);return l?{fill:l.color,stroke:'#ffffff',width:0.5}:{fill:'#f1f5f9',stroke:'#94a3b8',width:0.4}};
    const rainStyle=d=>p=>inR(p)?{fill:rainColor.get(d.levels.get(p))||NONE,stroke:'#94a3b8',width:0.25}:OUTSIDE;
    const delta=d=>d==null?'':d===0?'เท่าเดิม':'<span class="'+(d>0?'x-up':'x-down')+'">'+(d>0?'▲ +':'▼ ')+fmt(Math.abs(d))+'</span>';
    const periods=T.tmd_risk_outlook.slice().sort((a,b)=>+a.period_no-+b.period_no),cardBy=new Map(T.tmd_outlook_card.map(c=>[c.period_start,c]));
    const p0=periods[0],alertTo=periods.length?periods[Math.min(1,periods.length-1)].period_end:'';
    const shown=Object.keys(M.EXEC_P2R).filter(k=>[...levels.values()].includes(k));
    const day=M.execReportDay(S.day,T.flood_waterlogged_amphoe,T.tmd_rain_level,T.tmd_outlook_card,T.tmd_risk_outlook);
    return '<div class="x-inner">'
    +'<div class="x-head"><img class="x-logo" src="'+LOGO+'" alt="กรมอนามัย"><div><strong>รายงานสถานการณ์อุทกภัย</strong><small>เฝ้าระวังน้ำและผลกระทบต่อสุขภาพ'+(region?' · <b>เขตสุขภาพที่ '+region+'</b>':'')+'</small></div>'
    +'<div class="x-date">'+thDate(day)+'</div></div>'
    +'<div class="x-body">'
    +'<div class="x-cards">'
    +'<div class="x-card"><div class="x-eyebrow">ประสบภัย (ปภ.)</div><div class="x-num">'+fmt(S.provinces)+'<span class="x-unit">จังหวัด</span></div><div class="x-note">'+delta(S.dProv)+'</div></div>'
    +'<div class="x-card x-accent"><div class="x-eyebrow">ผลกระทบ (ครัวเรือน)</div><div class="x-num">'+fmt(S.hh)+'</div><div class="x-note">'+delta(S.dHh)+'</div></div>'
    +'<div class="x-card"><div class="x-eyebrow">กลุ่มเปราะบาง (คน)</div><div class="x-vul"><span>เด็ก</span><b>'+fmt(ex.children)+'</b><span>หญิงตั้งครรภ์</span><b>'+fmt(ex.pregnant)+'</b><span>ผู้สูงอายุ</span><b>'+fmtM(ex.elderly)+'</b></div></div>'
    +'</div>'
    +'<div class="x-mid"><div class="x-panel x-mapbox'+(region?' x-mapzoom':'')+'">'+svgMap(big,p2rStyle,1.1)
    +'<div class="x-legend x-legend-col">'+(shown.length?shown.map(k=>'<span><i style="background:'+M.EXEC_P2R[k].color+'"></i>'+M.EXEC_P2R[k].label+'</span>').join(''):'<span>ไม่มีข้อมูลระดับ 2P2R</span>')+'</div></div>'
    +'<div class="x-panel"><h2>ระดับความเสี่ยง 2P2R</h2><div class="x-regs">'
    +(groups.length?groups.map(g=>{const top=g.items.map(x=>lv(x.province)).filter(Boolean).sort((a,b)=>b.rank-a.rank)[0]||{color:NONE,light:true};
      return '<div class="x-reg"><div class="x-badge'+(top.light?' x-light':'')+'" style="background:'+top.color+'">'+(g.region||'?')+'</div>'
      +'<div class="x-pv">'+g.items.map(x=>{const l=lv(x.province);return '<span><i style="background:'+(l?l.color:NONE)+'"></i>'+esc(x.province)+'</span>'}).join('')+'</div></div>'}).join(''):'<p class="x-pv">ไม่มีจังหวัดที่มีระดับความเสี่ยง</p>')
    +'</div></div></div>'
    +'<div class="x-panel"><h2>เฝ้าระวังและพยากรณ์ล่วงหน้า <small>กรมอุตุนิยมวิทยา</small></h2>'
    +(p0?'<div class="x-alert">⚠ ระวัง '+esc(p0.rain_wording||'ฝนตกหนัก')+' '+thDay(p0.period_start)+(alertTo&&alertTo!==p0.period_start?' – '+thDay(alertTo):'')+'</div>':'')
    +'<div class="x-fc"><div class="x-periods">'+(periods.length?periods.map(p=>{const c=cardBy.get(p.period_start);return '<div class="x-period"><b>'+esc(c?.period_label||thDay(p.period_start)+' – '+thDay(p.period_end))+(c?.cap_level?' <span class="x-cap">· ประกาศเตือน'+esc(c.cap_level)+'</span>':'')+'</b><p>'+esc(p.headline_th)+'</p></div>'}).join(''):'<p class="x-empty">ไม่มีข้อมูลพยากรณ์</p>')+'</div>'
    +'<div>'+(rain.length?'<div class="x-rainmaps">'+rain.map(d=>'<figure><figcaption>'+thDay(d.date)+'</figcaption>'+svgMap(small,rainStyle(d),0,0.7)+'<div class="x-stat">>35 มม. '+d.heavy+' จ.</div></figure>').join('')+'</div>'
      +'<div class="x-rainkey">'+M.EXEC_RAIN.map(b=>'<span><i style="background:'+b.color+'"></i>'+b.label+'</span>').join('')+'</div>':'<p class="x-empty">ไม่มีข้อมูลฝนพยากรณ์</p>')
    +qrBox()+'</div></div></div>'
    +'</div>'
    +'<div class="x-foot">'+(S.recovered.length?'<div class="x-rec"><b>✓ คลี่คลายแล้ว:</b> '+esc(S.recovered.join(' '))+'</div>':'')
    +'<div class="x-meta">ที่มา : กรมป้องกันและบรรเทาสาธารณภัย, กรมอุตุนิยมวิทยา, HDC (สรุปข้อความด้วย AI อาจมีข้อผิดพลาด)</div></div>'
    +'</div>';
  }
  // Scale the content to fill the poster: up to 1.3x on a quiet day, down on a busy one. The content is laid out w px wide
  // and scaled by POSTER_W/w, so lines wrap differently at each w: search for the narrowest w (largest scale) whose content
  // fits. w is a whole number of pixels: with a fractional width the PNG export can wrap a line differently from the screen.
  // FIT_SLACK: the export draws text a few px taller than the screen, so a poster that only just fits would lose its last line.
  const FIT_SLACK=16;
  function fitPoster(){
    const inner=pane.querySelector('.x-inner');if(!inner)return;
    const fits=w=>{const z=POSTER_W/w;inner.style.transform=w!==POSTER_W?'scale('+z+')':'';inner.style.width=w!==POSTER_W?w+'px':'';inner.style.minHeight='0';return inner.scrollHeight*z<=POSTER_H-FIT_SLACK};
    let lo=Math.round(POSTER_W/1.3),hi=Math.round(POSTER_W/0.6);   // lo fits? then use it; else find the first w that fits
    if(!fits(lo)){while(hi-lo>1){const mid=(lo+hi)>>1;if(fits(mid))hi=mid;else lo=mid}lo=hi}
    fits(lo);inner.style.minHeight=Math.floor((POSTER_H-FIT_SLACK)*lo/POSTER_W)+'px';
  }
  // Show the whole poster within the pane width: the stage takes the scaled size and a wrapper around the poster is scaled.
  // The poster element itself is never transformed: the PNG export copies it, and a transform on it shifts the saved image.
  function fitStage(){
    const stage=$('execStage');if(!stage)return;
    const s=Math.min(1,(pane.clientWidth||POSTER_W)/POSTER_W);
    $('execScale').style.transform=s<1?'scale('+s+')':'';stage.style.width=(POSTER_W*s)+'px';stage.style.height=(POSTER_H*s)+'px';
  }

  // ── pane ──
  function build(){
    pane.innerHTML='<div class="x-tools"><label class="field">เขตสุขภาพ<select id="execRegion"><option value="">ทั้งประเทศ</option>'
      +Array.from({length:13},(_,i)=>'<option value="'+(i+1)+'">เขตสุขภาพที่ '+(i+1)+'</option>').join('')+'</select></label>'
      +'<button class="lightbtn" id="execReload" type="button">↻ อ่านข้อมูลใหม่</button><button class="x-save" id="execSave" type="button">📷 บันทึกภาพส่งไลน์</button></div>'
      +'<div id="execStatus" class="x-status" role="status"></div>'
      +'<div class="x-stagewrap"><div id="execStage" class="x-stage"><div id="execScale" class="x-scale"><div id="execPoster" class="x-poster"></div></div></div></div>';
    $('execRegion').value=st.region?String(st.region):'';
    $('execRegion').addEventListener('change',e=>{st.region=e.target.value?+e.target.value:null;draw()});
    $('execReload').addEventListener('click',async()=>{const b=$('execReload');b.disabled=true;mapCache.clear();await load();b.disabled=false;draw()});
    $('execSave').addEventListener('click',save);
    st.built=true;
  }
  // Only a notice when a tab could not be read; nothing is shown above the poster otherwise.
  function status(){
    const failed=Object.keys(st.errors);let s='';
    if(failed.length)s='<div class="alert">อ่านแท็บนี้ไม่ได้: '+failed.map(n=>esc(n)+' ('+esc(st.errors[n])+')').join(', ')+' ส่วนที่ใช้ข้อมูลนี้ในภาพจะขึ้นว่าไม่มีข้อมูล</div>';
    $('execStatus').innerHTML=s;
  }
  function draw(){
    if(!document.body.classList.contains('exec-mode')||!st.tables)return;
    const missing=REQUIRED.filter(n=>st.errors[n]);
    if(missing.length||!st.geo){
      $('execPoster').innerHTML='';$('execStatus').innerHTML='<div class="alert">สร้างรายงานไม่ได้: อ่าน '+esc(missing.join(', ')||'เส้นขอบจังหวัด')+' ไม่สำเร็จ กด "อ่านข้อมูลใหม่" เพื่อลองอีกครั้ง แท็บอื่นยังใช้งานได้ตามปกติ</div>';
      $('execSave').disabled=true;return;
    }
    $('execPoster').innerHTML=poster();
    status();fitStage();fitPoster();
    $('execSave').disabled=false;
  }
  async function save(){
    const btn=$('execSave'),label=btn.textContent;btn.disabled=true;btn.textContent='กำลังสร้างภาพ…';
    try{
      if(!shotReady)shotReady=loadScript(SHOT_LIB).catch(e=>{shotReady=null;throw e});
      await shotReady;
      const day=M.execReportDay(M.execDdpm(st.tables.Disaster_DB).day,st.tables.flood_waterlogged_amphoe,st.tables.tmd_rain_level,st.tables.tmd_outlook_card,st.tables.tmd_risk_outlook)||'latest';
      const url=await window.modernScreenshot.domToPng($('execPoster'),{scale:OUT_W/POSTER_W,width:POSTER_W,height:POSTER_H,backgroundColor:'#eff4f5',style:{boxShadow:'none'}});
      const a=document.createElement('a');a.href=url;a.download='flood-executive-'+day+(st.region?'-r'+st.region:'')+'.png';document.body.appendChild(a);a.click();a.remove();
      btn.textContent='✓ บันทึกแล้ว';
    }catch(e){console.warn('[executive] save failed',e);btn.textContent='สร้างภาพไม่สำเร็จ'}
    finally{setTimeout(()=>{btn.textContent=label;btn.disabled=false},1800)}
  }
  function select(active){
    document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',String(x===active)));
    $('workspace').setAttribute('aria-labelledby',active.id);
  }
  async function open(){
    document.body.classList.remove('news-mode','doh-mode');
    document.body.classList.add('exec-mode');
    select(tab);
    if(!st.built)build();
    if(!st.tables){$('execStatus').innerHTML='<p class="empty">กำลังโหลดข้อมูล…</p>';$('execSave').disabled=true;await load();}
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    draw();
  }
  function close(){document.body.classList.remove('exec-mode')}
  // ?region=4 opens on that health region (used for links sent to a region)
  const q=+new URLSearchParams(location.search).get('region');if(q>=1&&q<=13)st.region=q;
  addEventListener('resize',()=>{if(document.body.classList.contains('exec-mode')){fitStage();fitPoster()}});
  tab.addEventListener('click',open);
  document.querySelectorAll('.tab').forEach(x=>{if(x!==tab)x.addEventListener('click',close)});
})();
