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

async function main() {
  const ctx = vm.createContext({ console, Date, Utilities: { formatDate: d => d.toISOString() } });
  vm.runInContext(read('Config.gs') + '\n' + read('Code.gs'), ctx);
  const config = vm.runInContext('CONFIG', ctx);
  const sheets = {};
  for (const name of Object.keys(config.required)) {
    const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    const rows = parseCsv(await res.text());
    if (rows.length < 2) throw new Error(`${name}: no rows`);
    sheets[name] = rows;
  }
  ctx.__sheets = sheets;
  vm.runInContext(`SpreadsheetApp={openById:()=>({getSheetByName:n=>__sheets[n]?({getDataRange:()=>({getValues:()=>__sheets[n]})}):null})}`, ctx);
  const data = vm.runInContext('getDashboardData()', ctx);
  const bad = Object.entries(data.sourceStatus).filter(([, s]) => s.status !== 'ok');
  if (bad.length) throw new Error('Sheet read failed: ' + bad.map(([k]) => k).join(', '));
  fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'docs', 'data.json'), JSON.stringify(data));
  console.log('Wrote docs/data.json', Object.fromEntries(['disasters', 'vulnerable', 'stations', 'bkkStations', 'shelters'].map(k => [k, data[k].length])));
}
main().catch(e => { console.error(e.message); process.exit(1); });
