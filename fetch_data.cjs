// Reads the public Google Sheet as CSV and writes docs/data.json using the same
// normalize/transform logic as Code.gs (loaded in a vm with a fake SpreadsheetApp).
const fs = require('fs'), vm = require('vm'), path = require('path');
const read = n => fs.readFileSync(path.join(__dirname, n), 'utf8');

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// The import script rewrites a tab for a few seconds (a run on the hour once saw "BKK_water_DB: no rows"),
// so an empty or failed read is retried before the build gives up. A failed build keeps the old Pages site.
async function fetchSheetRows(name, url, { attempts = 4, delayMs = Number(process.env.FETCH_RETRY_DELAY_MS ?? 15000), fetchImpl = fetch } = {}) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = parseCsv(await res.text());
      if (rows.length < 2) throw new Error('no rows');
      return rows;
    } catch (e) {
      last = e;
      if (i < attempts) { console.warn(`${name}: ${e.message}; retry ${i}/${attempts - 1} in ${delayMs / 1000}s`); await sleep(delayMs); }
    }
  }
  throw new Error(`${name}: ${last.message} (after ${attempts} attempts)`);
}

async function main() {
  const ctx = vm.createContext({ console, Date, Utilities: { formatDate: d => d.toISOString() } });
  vm.runInContext(read('Config.gs') + '\n' + read('Code.gs'), ctx);
  const config = vm.runInContext('CONFIG', ctx);
  const sheets = {};
  // Optional tabs (the flood-prep pipeline's) must never stop the build: if one stays unreadable after the retries it is
  // simply left out, Code.gs reports it as an error for that tab only, and the flood tab shows a notice.
  const optional = new Set(config.optional || []);
  for (const name of Object.keys(config.required)) {
    const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
    try { sheets[name] = await fetchSheetRows(name, url); }
    catch (e) { if (!optional.has(name)) throw e; console.warn(`optional tab skipped: ${e.message}`); }
  }
  ctx.__sheets = sheets;
  vm.runInContext(`SpreadsheetApp={openById:()=>({getSheetByName:n=>__sheets[n]?({getDataRange:()=>({getValues:()=>__sheets[n]})}):null})}`, ctx);
  const data = vm.runInContext('getDashboardData()', ctx);
  const bad = Object.entries(data.sourceStatus).filter(([k, s]) => s.status !== 'ok' && !optional.has(k));
  if (bad.length) throw new Error('Sheet read failed: ' + bad.map(([k]) => k).join(', '));
  fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'docs', 'data.json'), JSON.stringify(data));
  console.log('Wrote docs/data.json', Object.fromEntries(['disasters', 'vulnerable', 'stations', 'bkkStations', 'shelters', 'floodRisk', 'floodCritical'].map(k => [k, data[k].length])));
}
module.exports = { parseCsv, fetchSheetRows };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
