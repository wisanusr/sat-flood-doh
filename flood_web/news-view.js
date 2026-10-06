/* "ข่าว" tab: flood news, word cloud and Google Trends. GitHub Pages build only (see build.py / build_pages.py).
   Reads news_data/news.json and news_data/trends.json written by the news/ scripts in CI. Independent of the
   dashboard's own data load, so the tab keeps working if the Google Sheets read fails and vice versa. */
(function(){
  const M=window.DashboardModel;
  const tab=document.getElementById('tab-news'),pane=document.getElementById('newsPane');
  if(!M||!tab||!pane)return;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number.isFinite(n)?n.toLocaleString('th-TH'):'-';
  const state={lang:'th',category:'',limit:30,urgency:'',province:'',query:''};
  let news=null,trends=null,loaded=false,loading=null,chart=null;

  async function getJson(name){
    const r=await fetch('news_data/'+name,{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.json();
  }
  function load(){
    if(!loading)loading=Promise.allSettled([getJson('news.json'),getJson('trends.json')]).then(([n,t])=>{
      news=n.status==='fulfilled'?n.value:null;trends=t.status==='fulfilled'?t.value:null;loaded=true;loading=null;
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

  function statusBanner(){
    const parts=[];
    if(!news)return '<div class="alert news-alert">ยังไม่มีข้อมูลข่าว (ไฟล์ news_data/news.json ยังไม่ถูกสร้างหรืออ่านไม่ได้) แท็บอื่นยังใช้งานได้ตามปกติ</div>';
    const bad=(news.sources||[]).filter(s=>s.status!=='ok');
    if(bad.length)parts.push('แหล่งข่าวที่อ่านไม่สำเร็จ: '+bad.map(s=>esc(s.name)).join(', '));
    return parts.length?'<div class="alert news-alert">'+parts.join(' · ')+'</div>':'';
  }

  function cloudHtml(rows){
    if(!rows.length)return '<p class="empty">ไม่มีคำที่ตรงกับตัวกรอง</p>';
    const max=Math.max(...rows.map(r=>r.count)),min=Math.min(...rows.map(r=>r.count));
    const size=c=>max===min?26:Math.round(14+(Math.sqrt(c)-Math.sqrt(min))/(Math.sqrt(max)-Math.sqrt(min))*30);
    const shuffled=rows.slice().sort((a,b)=>a.word.localeCompare(b.word,'th'));
    return '<div class="word-cloud" role="list">'+shuffled.map(r=>'<span role="listitem" class="cw cw-'+r.category+'" style="font-size:'+size(r.count)+'px" title="'+esc(r.word)+' · '+fmt(r.count)+' ครั้ง">'+esc(r.word)+'</span>').join('')+'</div>';
  }
  function legendHtml(){
    return '<div class="map-legend cw-legend">'+Object.entries(M.NEWS_CATEGORIES).map(([k,v])=>'<span><i class="dot cwd-'+k+'"></i>'+esc(v)+'</span>').join('')+'</div>';
  }
  function tableHtml(rows){
    if(!rows.length)return '<p class="empty">ไม่มีข้อมูล</p>';
    return '<div class="table-wrap"><table><thead><tr><th>คำ</th><th>หมวด</th><th class="num">จำนวนครั้ง</th><th class="num">คะแนน TF-IDF</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.word)+'</td><td><span class="badge">'+esc(M.NEWS_CATEGORIES[r.category]||'ทั่วไป')+'</span></td><td class="num">'+fmt(r.count)+'</td><td class="num">'+(r.tfidf==null?'-':r.tfidf.toFixed(2))+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function articleHtml(a){
    const u=M.URGENCY[a.urgency]||{label:'เฝ้าระวัง'};
    const cls=a.urgency==='critical'?'bad':a.urgency==='recovery'?'good':'warn';
    const href=M.safeUrl(a.url);
    const title=href?'<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+'</a>':esc(a.title);
    return '<li class="news-item"><div class="news-title">'+title+'</div><div class="news-meta"><span class="badge '+cls+'">'+esc(u.label)+'</span><span class="badge">'+esc(a.province)+'</span><span>'+esc(a.source)+'</span><span>'+esc(M.ageLabel(a.age_hours))+'</span></div></li>';
  }
  function trendsHtml(){
    if(!trends)return '<div class="alert news-alert">ยังไม่มีข้อมูล Google Trends (ไฟล์ trends.json ไม่พร้อมใช้งาน)</div>';
    if(trends.status!=='ok')return '<div class="alert news-alert">Google Trends ไม่พร้อมใช้งานในรอบข้อมูลนี้ จึงไม่แสดงข้อมูลสมมติแทน'+(trends.error?'<br><small>'+esc(trends.error)+'</small>':'')+'</div>';
    const cats=Object.values(trends.categories||{}).filter(c=>c.queries&&c.queries.length);
    const region=(trends.interest_by_region||[]).map(r=>'<div class="barrow"><span>'+esc(r.region)+'</span><div class="bartrack"><div class="bar" style="width:'+Math.max(2,Math.min(100,r.score))+'%"></div></div><strong>'+fmt(r.score)+'</strong></div>').join('');
    return '<div class="trend-grid"><div><h3>คำค้นหาที่เพิ่มขึ้น แยกตามความต้องการ</h3>'+(cats.length?cats.map(c=>'<h4>'+esc(c.label)+'</h4><ul class="trend-list">'+c.queries.map(q=>'<li><span>'+esc(q.query)+'</span><b>'+esc(q.growth)+'</b></li>').join('')+'</ul>').join(''):'<p class="empty">ไม่มีคำค้นหาที่เพิ่มขึ้นในรอบนี้</p>')+'</div>'
      +'<div><h3>ดัชนีการค้นหาตามจังหวัด ('+esc((trends.keywords||[])[0]||'')+')</h3>'+(region||'<p class="empty">ไม่มีข้อมูล</p>')+'</div></div>'
      +'<p class="mini-note">ที่มา: Google Trends ประเทศไทย 7 วันล่าสุด · อัปเดต '+esc((trends.generated_at||'').replace('T',' ').slice(0,16))+'</p>';
  }

  function render(){
    if(!document.body.classList.contains('news-mode'))return;
    // Keep focus and typed text while the list below re-renders from a filter change.
    const focusId=document.activeElement&&pane.contains(document.activeElement)?document.activeElement.id:'';
    const sel=document.activeElement&&document.activeElement.selectionStart!=null?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null;
    if(!news){pane.innerHTML='<div class="heading"><div><h1>ข่าวและแนวโน้มการค้นหา</h1></div></div>'+statusBanner()+'<section class="panel"><div class="panel-head"><h2>Google Trends</h2></div><div class="panel-body">'+trendsHtml()+'</div></section>';return}
    const words=M.newsWords(news,state.lang,state.category,state.limit);
    const matches=M.newsArticles(news.articles,state);
    const counts=M.newsUrgencyCounts(news.articles);
    const provinces=M.newsProvinces(news.articles);
    pane.innerHTML=
      '<div class="heading"><div><h1>ข่าวและแนวโน้มการค้นหา</h1><p class="sub">ข่าวน้ำท่วมย้อนหลัง '+fmt(news.window_hours)+' ชั่วโมง จาก RSS สาธารณะ · จัดกลุ่มด้วยกฎคำสำคัญ ไม่ใช่การยืนยันข้อเท็จจริง</p></div><div class="report-date">อัปเดต '+esc((news.generated_at||'').replace('T',' ').slice(0,16))+'</div></div>'
      +statusBanner()
      +'<div class="cards news-cards"><div class="card accent"><div class="eyebrow">ข่าวทั้งหมด</div><div class="number">'+fmt(news.article_count)+'</div></div><div class="card"><div class="eyebrow">เร่งด่วน</div><div class="number">'+fmt(counts.critical)+'</div></div><div class="card"><div class="eyebrow">เฝ้าระวัง</div><div class="number">'+fmt(counts.warning)+'</div></div><div class="card"><div class="eyebrow">ฟื้นฟู</div><div class="number">'+fmt(counts.recovery)+'</div></div></div>'
      +'<section class="panel"><div class="panel-head"><div><h2>คำที่พบบ่อยในข่าว</h2><p class="sub">ขนาดตัวอักษร = จำนวนครั้ง · เรียงตาม TF-IDF (คำที่ใช้ค้นหา เช่น "น้ำท่วม" ถูกตัดออก)</p></div></div>'
      +'<div class="filters news-filters"><div class="field"><label for="newsLang">ภาษา</label><select id="newsLang"><option value="th"'+(state.lang==='th'?' selected':'')+'>ไทย</option><option value="en"'+(state.lang==='en'?' selected':'')+'>English</option></select></div>'
      +'<div class="field"><label for="newsCat">หมวดคำ</label><select id="newsCat"'+(state.lang==='en'?' disabled':'')+'><option value="">ทั้งหมด</option>'+Object.entries(M.NEWS_CATEGORIES).map(([k,v])=>'<option value="'+k+'"'+(state.category===k?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></div>'
      +'<div class="field"><label for="newsLimit">จำนวนคำ</label><select id="newsLimit">'+[[10,'10'],[30,'30'],[60,'60'],[0,'ทั้งหมด']].map(([v,l])=>'<option value="'+v+'"'+(state.limit===v?' selected':'')+'>'+l+'</option>').join('')+'</select></div></div>'
      +'<div class="panel-body news-words"><div>'+cloudHtml(words)+legendHtml()+'</div><div class="news-chart"><canvas id="newsChart" aria-label="กราฟแท่งคำที่พบบ่อย" role="img"></canvas></div></div>'
      +'<details class="news-table"><summary>ดูตารางคำ ('+fmt(words.length)+')</summary>'+tableHtml(words)+'</details></section>'
      +'<section class="panel"><div class="panel-head"><div><h2>พาดหัวข่าว</h2><p class="sub">แสดง '+fmt(matches.length)+' จาก '+fmt((news.articles||[]).length)+' รายการ · เรียงใหม่สุดก่อน</p></div></div>'
      +'<div class="filters news-filters"><div class="field"><label for="newsUrgency">ระดับ</label><select id="newsUrgency"><option value="">ทั้งหมด</option>'+Object.entries(M.URGENCY).map(([k,v])=>'<option value="'+k+'"'+(state.urgency===k?' selected':'')+'>'+esc(v.label)+'</option>').join('')+'</select></div>'
      +'<div class="field"><label for="newsProvince">จังหวัด</label><select id="newsProvince"><option value="">ทั้งหมด</option>'+provinces.map(p=>'<option value="'+esc(p.province)+'"'+(state.province===p.province?' selected':'')+'>'+esc(p.province)+' ('+p.count+')</option>').join('')+'</select></div>'
      +'<div class="field"><label for="newsQuery">ค้นหาพาดหัว/สำนักข่าว</label><input id="newsQuery" type="search" value="'+esc(state.query)+'"></div></div>'
      +'<ul class="news-list">'+(matches.length?matches.slice(0,60).map(articleHtml).join(''):'<li class="empty">ไม่มีข่าวที่ตรงกับตัวกรอง</li>')+'</ul>'
      +(matches.length>60?'<p class="mini-note" style="padding:0 22px 16px">แสดง 60 รายการแรก</p>':'')
      +'<div class="mini-note" style="padding:0 22px 16px">แหล่งข้อมูล: '+(news.sources||[]).map(s=>esc(s.name)+(s.status==='ok'?' ('+s.count+')':' (ผิดพลาด)')).join(' · ')+'</div></section>'
      +'<section class="panel"><div class="panel-head"><div><h2>Google Trends</h2><p class="sub">สิ่งที่คนไทยกำลังค้นหาเกี่ยวกับน้ำท่วม</p></div></div><div class="panel-body">'+trendsHtml()+'</div></section>';
    bind();drawChart(words);
    if(focusId&&$(focusId)){$(focusId).focus();if(sel&&$(focusId).setSelectionRange)try{$(focusId).setSelectionRange(sel[0],sel[1])}catch(e){}}
  }
  function bind(){
    const on=(id,key,conv)=>{const el=$(id);if(el)el.addEventListener(id==='newsQuery'?'input':'change',()=>{state[key]=conv?conv(el.value):el.value;if(key==='lang'&&state.lang==='en')state.category='';render()})};
    on('newsLang','lang');on('newsCat','category');on('newsLimit','limit',Number);on('newsUrgency','urgency');on('newsProvince','province');on('newsQuery','query');
  }
  function drawChart(words){
    if(chart){chart.destroy();chart=null}
    const el=$('newsChart');if(!el||!window.Chart)return;
    const top=words.slice(0,15);
    el.parentElement.style.height=Math.max(160,top.length*26+40)+'px';
    chart=new window.Chart(el,{type:'bar',data:{labels:top.map(r=>r.word),datasets:[{data:top.map(r=>r.count),backgroundColor:'#087873',borderRadius:4}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmt(c.parsed.x)+' ครั้ง'}}},scales:{x:{beginAtZero:true,ticks:{precision:0}}}}});
  }

  tab.addEventListener('click',open);
  document.querySelectorAll('.tab').forEach(x=>{if(x!==tab)x.addEventListener('click',close)});
})();
