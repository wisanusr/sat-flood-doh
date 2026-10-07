/* Reads the Google Sheet straight from the browser (GitHub Pages build only; see build_pages.py).
   The page normally shows data.json, a snapshot that GitHub Actions rebuilds on a schedule GitHub does not keep on time. This
   module fetches each tab as CSV from Google (the sheet is public and Google answers cross-origin requests from the page's
   own origin) and runs the SAME Config.gs + Code.gs that build data.json and the Apps Script web app, so the numbers are
   built by identical code whichever way they arrive. A tab that cannot be read is reported as an error for that tab only;
   the caller keeps the snapshot for it. Also loads in Node for tests (module.exports). */
(function(root){
  function parseCsv(text){
    const rows=[];let row=[],cell='',q=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c}
      else if(c==='"')q=true;
      else if(c===',')row.push(cell),cell='';
      else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';rows.push(row);row=[]}
      else cell+=c;
    }
    if(cell!==''||row.length){row.push(cell);rows.push(row)}
    return rows;
  }
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  // One tab as an array of rows. An empty tab (the import script rewrites a tab for a few seconds) or a failed request is retried.
  async function fetchRows(name,url,{fetchImpl,attempts,delayMs,timeoutMs}){
    let last;
    for(let i=1;i<=attempts;i++){
      const ctl=typeof AbortController!=='undefined'?new AbortController():null,timer=ctl?setTimeout(()=>ctl.abort(),timeoutMs):null;
      try{
        const res=await fetchImpl(url,{cache:'no-store',signal:ctl?.signal});
        if(!res.ok)throw new Error('HTTP '+res.status);
        const rows=parseCsv(await res.text());
        if(rows.length<2)throw new Error('no rows');
        return rows;
      }catch(e){last=e;if(i<attempts)await sleep(delayMs)}
      finally{if(timer)clearTimeout(timer)}
    }
    throw new Error(name+': '+(last&&last.message)+' (after '+attempts+' attempts)');
  }

  // configSrc / codeSrc = the text of Config.gs and Code.gs. They run in a function scope with a stand-in SpreadsheetApp that
  // serves the CSV rows, exactly like fetch_data.cjs does under Node.
  function createReader({configSrc,codeSrc,fetchImpl=(typeof fetch!=='undefined'?fetch.bind(root):null),attempts=3,delayMs=2000,timeoutMs=30000}){
    const factory=new Function('Utilities','SpreadsheetApp','console',configSrc+'\n'+codeSrc+'\n;return {getDashboardData:getDashboardData,CONFIG:CONFIG};');
    const utilities={formatDate:d=>d.toISOString()};   // CSV cells are strings, so Date values never reach it
    const config=factory(utilities,{},console).CONFIG;
    async function read(source){
      const names=source?[source]:Object.keys(config.required),sheets={},errors={};
      await Promise.all(names.map(async name=>{
        const url='https://docs.google.com/spreadsheets/d/'+config.spreadsheetId+'/gviz/tq?tqx=out:csv&sheet='+encodeURIComponent(name);
        try{sheets[name]=await fetchRows(name,url,{fetchImpl,attempts,delayMs,timeoutMs})}catch(e){errors[name]=e.message;console.warn('[live-sheets] '+e.message)}
      }));
      const app={openById:()=>({getSheetByName:n=>sheets[n]?{getDataRange:()=>({getValues:()=>sheets[n]})}:null})};
      const data=factory(utilities,app,console).getDashboardData(source||null);
      data.liveErrors=errors;
      return data;
    }
    return {read,config};
  }

  const api={parseCsv,fetchRows,createReader};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof document!=='undefined'){
    const cfg=document.getElementById('gasConfig'),code=document.getElementById('gasCode');
    if(cfg&&code){try{root.LiveSheets=createReader({configSrc:cfg.textContent,codeSrc:code.textContent})}catch(e){console.warn('[live-sheets] reader unavailable',e)}}
  }
})(typeof window!=='undefined'?window:globalThis);
