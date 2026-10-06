/* "ข่าว" tab: flood news, word cloud and Google Trends. GitHub Pages build only (see build.py / build_pages.py).
   Reads news_data/news.json and news_data/trends.json written by the news/ scripts in CI. Independent of the
   dashboard's own data load, so the tab keeps working if the Google Sheets read fails and vice versa.
   Every number shown comes from those two files; nothing is estimated or filled in. */
(function(){
  const M=window.DashboardModel;
  const tab=document.getElementById('tab-news'),pane=document.getElementById('newsPane');
  if(!M||!tab||!pane)return;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number.isFinite(n)?n.toLocaleString('th-TH'):'-';
  const state={lang:'th',category:'',limit:60,urgency:'',province:'',query:'',pageSize:10};
  const CATEGORY_TABS=[['','ทั้งหมด'],['monitoring','เฝ้าระวัง & สถานการณ์น้ำ'],['relief','การช่วยเหลือ & ศูนย์พักพิง'],['post_flood','ฟื้นฟูหลังน้ำท่วม'],['location','พื้นที่ & จังหวัด']];
  const URGENCY_TABS=[['','ทั้งหมด'],['critical','เร่งด่วน'],['warning','เฝ้าระวัง'],['recovery','ฟื้นฟู']];
  let news=null,trends=null,loaded=false,loading=null,chart=null,fetchedAt=null,refreshing=false;

  async function getJson(name){
    const r=await fetch('news_data/'+name,{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.json();
  }
  function load(){
    if(!loading)loading=Promise.allSettled([getJson('news.json'),getJson('trends.json')]).then(([n,t])=>{
      news=n.status==='fulfilled'?n.value:null;trends=t.status==='fulfilled'?t.value:null;loaded=true;loading=null;fetchedAt=new Date();
    });
    return loading;
  }

  function select(active){
    document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',String(x===active)));
    $('workspace').setAttribute('aria-labelledby',active.id);
  }
  async function open(){
    document.body.classList.add('news-mode');
    select(tab);
    pane.setAttribute('aria-busy','true');
    if(!loaded)pane.innerHTML='<p class="empty">กำลังโหลดข่าว…</p>';
    await load();
    pane.removeAttribute('aria-busy');
    render();
  }
  // dashboard.js re-renders for the tab that was clicked; this only leaves news mode and keeps aria in step
  // for the case where the dashboard's own data never loaded.
  function close(e){
    document.body.classList.remove('news-mode');
    if(e&&e.currentTarget)select(e.currentTarget);
  }
  async function refresh(){
    if(refreshing)return;
    refreshing=true;render();
    loaded=false;loading=null;
    await load();
    refreshing=false;render();
  }

  const stamp=iso=>String(iso||'').replace('T',' ').slice(0,16);
  const clock=d=>d?d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Bangkok'}):'-';

  function statusBanner(){
    const parts=[];
    if(!news)return '<div class="alert news-alert">ยังไม่มีข้อมูลข่าว (ไฟล์ news_data/news.json ยังไม่ถูกสร้างหรืออ่านไม่ได้) แท็บอื่นยังใช้งานได้ตามปกติ</div>';
    const bad=(news.sources||[]).filter(s=>s.status!=='ok');
    if(bad.length)parts.push('แหล่งข่าวที่อ่านไม่สำเร็จ: '+bad.map(s=>esc(s.name)).join(', '));
    return parts.length?'<div class="alert news-alert">'+parts.join(' · ')+'</div>':'';
  }
  const segmented=(attr,items,current,label)=>'<div class="seg" role="group" aria-label="'+esc(label)+'">'+items.map(([k,l])=>'<button type="button" class="seg-btn" data-'+attr+'="'+esc(k)+'" aria-pressed="'+String(current===k)+'">'+esc(l)+'</button>').join('')+'</div>';

  function cloudHtml(rows){
    if(!rows.length)return '<p class="empty">ไม่มีคำที่ตรงกับตัวกรอง</p>';
    const max=Math.max(...rows.map(r=>r.count)),min=Math.min(...rows.map(r=>r.count));
    const size=c=>max===min?30:Math.round(12+(Math.sqrt(c)-Math.sqrt(min))/(Math.sqrt(max)-Math.sqrt(min))*44);
    const ordered=rows.slice().sort((a,b)=>a.word.localeCompare(b.word,'th'));
    return '<div class="word-cloud" role="list">'+ordered.map(r=>'<span role="listitem" class="cw cw-'+esc(r.category)+'" style="font-size:'+size(r.count)+'px" title="'+esc(r.word)+' · '+fmt(r.count)+' ครั้ง">'+esc(r.word)+'</span>').join('')+'</div>';
  }
  function legendHtml(){
    return '<div class="cw-sizes"><strong style="font-size:17px">คำใหญ่</strong> = พบบ่อยมาก <span class="cw-mid">คำกลาง</span> = พบปานกลาง <span class="cw-small">คำเล็ก</span> = พบน้อย</div>'
      +'<div class="map-legend cw-legend">'+Object.entries(M.NEWS_CATEGORIES).map(([k,v])=>'<span><i class="dot cwd-'+esc(k)+'"></i>'+esc(v)+'</span>').join('')+'</div>';
  }
  function freqTableHtml(rows){
    if(!rows.length)return '<p class="empty">ไม่มีข้อมูล</p>';
    const max=Math.max(...rows.map(r=>r.count));
    return '<div class="freq-table"><table><thead><tr><th>#</th><th>คำ</th><th class="num">ความถี่</th></tr></thead><tbody>'
      +rows.map((r,i)=>'<tr><td class="muted">'+(i+1)+'</td><td><b>'+esc(r.word)+'</b>'+(r.tfidf==null?'':' <small class="muted" title="คะแนน TF-IDF">TF-IDF '+r.tfidf.toFixed(2)+'</small>')+'</td><td class="num"><span class="badge freq-badge">'+fmt(r.count)+'x</span><div class="freq-bar"><i style="width:'+Math.max(4,Math.round(r.count/max*100))+'%"></i></div></td></tr>').join('')
      +'</tbody></table></div>';
  }
  function articleHtml(a){
    const u=M.URGENCY[a.urgency]||{label:'เฝ้าระวัง'};
    const cls=a.urgency==='critical'?'bad':a.urgency==='recovery'?'good':'warn';
    const href=M.safeUrl(a.url);
    const title=href?'<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+'</a>':esc(a.title);
    return '<li class="news-card"><span class="src-mark" aria-hidden="true">'+esc(M.sourceInitial(a.source))+'</span><div class="news-card-body"><div class="news-badges"><span class="badge '+cls+'">'+esc(u.label)+'</span><span class="badge">'+esc(a.province)+'</span></div><div class="news-title">'+title+'</div><div class="news-meta"><span>'+esc(a.source)+'</span><span>'+esc(stamp(a.published_at))+'</span><span>'+esc(M.ageLabel(a.age_hours))+'</span></div></div></li>';
  }

  function trendsHeader(){
    const ok=trends&&trends.status==='ok';
    return '<div class="trend-head"><div><h2>ข้อมูลจาก Google Trends</h2><div class="trend-meta">'
      +'<span class="badge '+(ok?'good':'bad')+'">'+(ok?'ดึงตรง':'ไม่พร้อมใช้งาน')+'</span>'
      +(trends?'<span>ข้อมูลอัปเดตล่าสุด: '+esc(stamp(trends.generated_at))+'</span>':'')
      +'<span class="chip">ระบบอัปเดตข้อมูลทุก 30 นาที</span>'
      +'<span class="chip">หน้าเว็บดึงข้อมูลล่าสุดเมื่อ '+esc(clock(fetchedAt))+' น.</span></div></div>'
      +'<button type="button" class="lightbtn" id="newsRefresh"'+(refreshing?' disabled':'')+'>'+(refreshing?'กำลังโหลด…':'รีเฟรชข้อมูล')+'</button></div>';
  }
  function risingHtml(){
    const rows=M.newsRising(trends);
    return '<section class="panel"><div class="panel-head"><div><h2>คำค้นหาที่พุ่งขึ้นกะทันหัน (Rising Queries)</h2><p class="sub">เรียงตามอัตราการเพิ่ม · Breakout = เพิ่มขึ้นมากกว่า 5,000%</p></div></div><div class="panel-body">'
      +(rows.length?'<div class="chips">'+rows.map(r=>'<span class="chip q-chip">'+esc(r.query)+' <b class="badge warn">'+esc(r.growth)+'</b></span>').join('')+'</div>':'<p class="empty">ไม่มีคำค้นหาที่พุ่งขึ้นในรอบนี้ (Google ไม่ส่งรายการนี้ทุกรอบ)</p>')
      +'</div></section>';
  }
  function regionsHtml(){
    const all=M.newsTopRegions(trends,0),top=all.slice(0,5),rest=all.slice(5),kw=esc((trends.keywords||[])[0]||'');
    const row=(r,i)=>'<tr><td class="muted">'+(i+1)+'</td><td><b>'+esc(r.region)+'</b></td><td>'+kw+'</td><td class="num"><span class="badge bad">'+fmt(r.score)+'</span><div class="freq-bar red"><i style="width:'+Math.max(4,Math.min(100,r.score))+'%"></i></div></td></tr>';
    return '<section class="panel"><div class="panel-head"><div><h2>อันดับจังหวัดที่ค้นหาเรื่องน้ำท่วมมากที่สุด</h2><p class="sub">ดัชนี 100 = ค้นหามากที่สุดในช่วงเวลา · คอลัมน์ "คำที่วัด" คือคำที่ใช้คำนวณดัชนี</p></div></div><div class="panel-body">'
      +(top.length?'<div class="freq-table"><table><thead><tr><th>#</th><th>จังหวัด</th><th>คำที่วัด</th><th class="num">ดัชนี</th></tr></thead><tbody>'+top.map(row).join('')+'</tbody></table></div>'
        +(rest.length?'<details class="news-table"><summary>ดูอันดับที่ 6–'+(5+rest.length)+'</summary><div class="freq-table"><table><tbody>'+rest.map((r,i)=>row(r,i+5)).join('')+'</tbody></table></div></details>':''):'<p class="empty">ไม่มีข้อมูลรายจังหวัดในรอบนี้</p>')
      +'</div></section>';
  }
  function trendsHtml(){
    const head='<section class="panel trend-panel">'+trendsHeader()+'</section>';
    if(!trends)return head+'<div class="alert news-alert">ยังไม่มีข้อมูล Google Trends (ไฟล์ trends.json ไม่พร้อมใช้งาน)</div>';
    if(trends.status!=='ok')return head+'<div class="alert news-alert">Google Trends ไม่พร้อมใช้งานในรอบข้อมูลนี้ จึงไม่แสดงข้อมูลสมมติแทน'+(trends.error?'<br><small>'+esc(trends.error)+'</small>':'')+'</div>';
    return head
      +'<div class="info-note">ข้อมูลเทรนด์คำค้นหาดึงตรงจาก Google Trends ประเทศไทย (geo=TH) ช่วง '+esc(String(trends.timeframe||'').replace('now 7-d','7 วันล่าสุด'))+' เป็นสัญญาณความสนใจของประชาชน ไม่ใช่ข้อเท็จจริงเรื่องสถานการณ์น้ำ</div>'
      +'<div class="trend-grid">'+risingHtml()+regionsHtml()+'</div>';
  }

  function render(){
    if(!document.body.classList.contains('news-mode'))return;
    // Keep focus and typed text while the list below re-renders from a filter change.
    const focusId=document.activeElement&&pane.contains(document.activeElement)?document.activeElement.id:'';
    const sel=document.activeElement&&document.activeElement.selectionStart!=null?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null;
    if(!news){pane.innerHTML='<div class="heading"><div><h1>ข่าวและแนวโน้มการค้นหา</h1></div></div>'+statusBanner()+trendsHtml();bind();return}
    const words=M.newsWords(news,state.lang,state.category,state.limit);
    const top15=M.newsTopByCount(M.newsWords(news,state.lang,state.category,0),15);
    const matches=M.newsArticles(news.articles,state);
    const shown=matches.slice(0,state.pageSize);
    const counts=M.newsUrgencyCounts(news.articles);
    const provinces=M.newsProvinces(news.articles);
    pane.innerHTML=
      '<div class="heading"><div><h1>ข่าวและแนวโน้มการค้นหา</h1><p class="sub">ข่าวน้ำท่วมย้อนหลัง '+fmt(news.window_hours)+' ชั่วโมง จาก RSS สาธารณะ · จัดกลุ่มด้วยกฎคำสำคัญ ไม่ใช่การยืนยันข้อเท็จจริง</p></div><div class="report-date">อัปเดต '+esc(stamp(news.generated_at))+'</div></div>'
      +statusBanner()
      +'<div class="cards news-cards"><div class="card accent"><div class="eyebrow">ข่าวทั้งหมด</div><div class="number">'+fmt(news.article_count)+'</div></div><div class="card"><div class="eyebrow">เร่งด่วน</div><div class="number">'+fmt(counts.critical)+'</div></div><div class="card"><div class="eyebrow">เฝ้าระวัง</div><div class="number">'+fmt(counts.warning)+'</div></div><div class="card"><div class="eyebrow">ฟื้นฟู</div><div class="number">'+fmt(counts.recovery)+'</div></div></div>'
      // word cloud
      +'<section class="panel"><div class="panel-head news-head"><div><h2>Word Cloud คำที่ปรากฏในข่าวน้ำท่วม</h2><p class="sub">ขนาดตัวอักษร = จำนวนครั้ง · เรียงตาม TF-IDF (คำที่ใช้ค้นหา เช่น "น้ำท่วม" ถูกตัดออก)</p></div><div class="news-count">'+fmt(news.article_count)+' บทความ · '+esc(stamp(news.generated_at).slice(0,10))+'</div></div>'
      +'<div class="news-toolbar">'+(state.lang==='th'?segmented('cat',CATEGORY_TABS,state.category,'หมวดคำ'):'')
      +'<label class="inline-field">ภาษา <select id="newsLang"><option value="th"'+(state.lang==='th'?' selected':'')+'>ไทย</option><option value="en"'+(state.lang==='en'?' selected':'')+'>English</option></select></label>'
      +'<label class="inline-field">จำนวนคำ <select id="newsLimit">'+[[30,'30'],[60,'60'],[100,'100'],[0,'ทั้งหมด']].map(([v,l])=>'<option value="'+v+'"'+(state.limit===v?' selected':'')+'>'+l+'</option>').join('')+'</select></label></div>'
      +'<div class="panel-body"><div class="cloud-box">'+cloudHtml(words)+'</div>'+legendHtml()+'</div></section>'
      // chart + table
      +'<div class="news-words"><section class="panel"><div class="panel-head"><div><h2>คำที่ปรากฏบ่อยที่สุด (Top 15)</h2><p class="sub">เรียงตามจำนวนครั้งที่พบในข่าว</p></div></div><div class="panel-body"><div class="news-chart"><canvas id="newsChart" aria-label="กราฟแท่งคำที่พบบ่อย 15 อันดับ" role="img"></canvas></div></div></section>'
      +'<section class="panel"><div class="panel-head"><div><h2>ตารางคำความถี่</h2></div></div><div class="panel-body freq-scroll">'+freqTableHtml(top15)+'</div></section></div>'
      // headlines
      +'<section class="panel"><div class="panel-head news-head"><div><h2>พาดหัวข่าวน้ำท่วมล่าสุด</h2><p class="sub">แสดง '+fmt(shown.length)+' จากทั้งหมด '+fmt(matches.length)+' ข่าวตรงเงื่อนไข · เรียงใหม่สุดก่อน</p></div></div>'
      +'<div class="news-toolbar">'+segmented('urg',URGENCY_TABS,state.urgency,'ระดับข่าว')
      +'<label class="inline-field">จังหวัด <select id="newsProvince"><option value="">ทุกจังหวัด ('+fmt((news.articles||[]).length)+')</option>'+provinces.map(p=>'<option value="'+esc(p.province)+'"'+(state.province===p.province?' selected':'')+'>'+esc(p.province)+' ('+p.count+')</option>').join('')+'</select></label>'
      +'<label class="inline-field">แสดง <select id="newsPage">'+[10,20,50,100].map(v=>'<option value="'+v+'"'+(state.pageSize===v?' selected':'')+'>'+v+' ข่าว</option>').join('')+'</select></label>'
      +'<label class="inline-field grow">ค้นหา <input id="newsQuery" type="search" placeholder="พาดหัว / สำนักข่าว" value="'+esc(state.query)+'"></label></div>'
      +'<ul class="news-grid">'+(shown.length?shown.map(articleHtml).join(''):'<li class="empty">ไม่มีข่าวที่ตรงกับตัวกรอง</li>')+'</ul>'
      +'<div class="mini-note" style="padding:0 22px 16px">แหล่งข้อมูล: '+(news.sources||[]).map(s=>esc(s.name)+(s.status==='ok'?' ('+s.count+')':' (ผิดพลาด)')).join(' · ')+'</div></section>'
      // trends
      +trendsHtml();
    bind();drawChart(top15);
    if(focusId&&$(focusId)){$(focusId).focus();if(sel&&$(focusId).setSelectionRange)try{$(focusId).setSelectionRange(sel[0],sel[1])}catch(e){}}
  }
  function bind(){
    const on=(id,key,conv)=>{const el=$(id);if(el)el.addEventListener(id==='newsQuery'?'input':'change',()=>{state[key]=conv?conv(el.value):el.value;if(key==='lang'&&state.lang==='en')state.category='';render()})};
    on('newsLang','lang');on('newsLimit','limit',Number);on('newsProvince','province');on('newsPage','pageSize',Number);on('newsQuery','query');
    pane.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.cat;render()}));
    pane.querySelectorAll('[data-urg]').forEach(b=>b.addEventListener('click',()=>{state.urgency=b.dataset.urg;render()}));
    const r=$('newsRefresh');if(r)r.addEventListener('click',refresh);
  }
  function drawChart(top){
    if(chart){chart.destroy();chart=null}
    const el=$('newsChart');if(!el||!window.Chart)return;
    if(!top.length){el.parentElement.innerHTML='<p class="empty">ไม่มีข้อมูล</p>';return}
    el.parentElement.style.height=Math.max(180,top.length*26+44)+'px';
    // teal for the most frequent words fading to navy, so rank is readable without the numbers
    const color=i=>'hsl('+Math.round(172-i*(112/Math.max(1,top.length-1)))+',62%,'+Math.round(34+i*(10/Math.max(1,top.length-1)))+'%)';
    chart=new window.Chart(el,{type:'bar',data:{labels:top.map(r=>r.word),datasets:[{data:top.map(r=>r.count),backgroundColor:top.map((_,i)=>color(i)),borderRadius:3}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmt(c.parsed.x)+' ครั้ง'}}},scales:{x:{beginAtZero:true,ticks:{precision:0}},y:{ticks:{autoSkip:false}}}}});
  }

  tab.addEventListener('click',open);
  document.querySelectorAll('.tab').forEach(x=>{if(x!==tab)x.addEventListener('click',close)});
})();
