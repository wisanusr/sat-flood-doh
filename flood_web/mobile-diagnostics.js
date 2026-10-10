/* Diagnostic pages only. Keeps a bounded local timeline; sends no telemetry. */
(function(){
  'use strict';
  const config=window.MOBILE_TEST_CONFIG,key='flood-mobile-test-v1-'+config.mode;
  const started=performance.now(),events=[];
  let previous=null,box=null,status=null,last='เริ่มเปิดหน้า';
  try{previous=JSON.parse(localStorage.getItem(key)||'null')}catch{}
  const stamp=()=>Math.round((performance.now()-started)/100)/10;
  const report=()=>({version:config.version,mode:config.mode,startedAt:new Date(performance.timeOrigin).toISOString(),
    elapsed:stamp(),last,events,previous:previous?{startedAt:previous.startedAt,elapsed:previous.elapsed,last:previous.last,events:previous.events}:null});
  function persist(){try{localStorage.setItem(key,JSON.stringify({...report(),previous:null}))}catch{}}
  function show(){
    if(status)status.textContent=config.label+' · '+Math.floor(stamp())+' วินาที · '+last;
    if(box)box.textContent=JSON.stringify(report(),null,2);
  }
  function mark(step,detail){
    last=step;events.push({seconds:stamp(),step,...(detail?{detail}:{} )});
    if(events.length>80)events.shift();persist();show();
  }
  window.MobileDiagnostics={mark};
  mark('page-start');
  window.addEventListener('error',e=>mark('javascript-error',String(e.message||'unknown').slice(0,200)));
  window.addEventListener('unhandledrejection',e=>mark('promise-error',String(e.reason?.message||e.reason||'unknown').slice(0,200)));
  window.addEventListener('pagehide',()=>mark('page-hidden'));
  window.addEventListener('dashboard:data',()=>mark('dashboard-data-ready'));
  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,options){
    let label='asset';
    try{
      const u=new URL(typeof input==='string'?input:input.url,document.baseURI);
      if(u.pathname.endsWith('/data.json'))label='snapshot';
      else if(u.hostname==='docs.google.com')label='sheet:'+u.searchParams.get('sheet');
      else label=u.pathname.split('/').pop()||'asset';
    }catch{}
    mark('fetch-start',label);
    try{
      const response=await originalFetch(input,options);mark('fetch-response',label+' HTTP '+response.status);
      for(const method of ['text','json']){
        const read=response[method].bind(response);
        response[method]=async function(){
          const result=await read();mark('body-ready',label+(method==='text'?' '+result.length+' chars':''));return result;
        };
      }
      return response;
    }catch(e){mark('fetch-failed',label+' '+String(e?.name||'error'));throw e}
  };
  document.addEventListener('DOMContentLoaded',()=>{
    mark('dom-ready');
    const panel=document.createElement('details');panel.id='mobileDiagnostics';
    panel.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:10000;background:#fff;color:#17333e;border-top:2px solid #087873;padding:8px 12px;font:13px/1.5 system-ui;max-height:45vh;overflow:auto';
    status=document.createElement('summary');status.style.cursor='pointer';panel.append(status);
    const help=document.createElement('p');help.textContent='หน้าทดสอบ: เปิดทิ้งไว้ 2 นาทีโดยไม่กดแท็บหรือรีเฟรช หาก Safari รีโหลดเอง ให้เปิดแถบนี้แล้วคัดลอกผล (มีบันทึกครั้งก่อนถ้า Safari ยังเก็บไว้)';panel.append(help);
    const copy=document.createElement('button');copy.type='button';copy.textContent='คัดลอกผลทดสอบ';copy.className='lightbtn';
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(report(),null,2));copy.textContent='คัดลอกแล้ว'}catch{copy.textContent='เลือกข้อความด้านล่างแล้วคัดลอก'}};panel.append(copy);
    const links=document.createElement('p');
    for(const [mode,label] of [['snapshot','ทดสอบ A'],['no-map','ทดสอบ B'],['control','ทดสอบ C']]){
      const a=document.createElement('a');a.href='mobile-test/'+mode+'.html';a.textContent=label;a.style.marginRight='16px';links.append(a);
    }
    panel.append(links);box=document.createElement('pre');box.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;user-select:text';panel.append(box);document.body.append(panel);
    if(config.mode==='snapshot'){
      const refresh=document.getElementById('refreshData');if(refresh){refresh.disabled=true;refresh.title='หน้าทดสอบ A ปิดการอ่านข้อมูลสด'}
    }
    if(config.mode==='no-map'){
      const map=document.getElementById('map');if(map){const note=document.createElement('p');note.textContent='ทดสอบ B: ปิดการโหลดแผนที่ เพื่อแยกสาเหตุ';note.style.padding='24px';map.append(note)}
    }
    mark(config.mode==='snapshot'?'automatic-live-disabled':config.mode==='no-map'?'map-disabled':'control-mode');
    show();
  });
  setInterval(()=>{persist();show()},5000);
})();
