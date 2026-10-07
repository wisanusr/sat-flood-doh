// Offline tests for the browser-side sheet reader (flood_web/live-sheets.js): node flood_web/test_live.cjs
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const live = require('./live-sheets.js');
const root = path.join(__dirname, '..');
const configSrc = fs.readFileSync(path.join(root, 'Config.gs'), 'utf8'), codeSrc = fs.readFileSync(path.join(root, 'Code.gs'), 'utf8');

// --- CSV parser
assert.deepStrictEqual(live.parseCsv('a,b\n"x,1","he said ""hi"""\r\n"ไทย",\n'), [['a', 'b'], ['x,1', 'he said "hi"'], ['ไทย', '']]);
assert.deepStrictEqual(live.parseCsv('a\n'), [['a']]);
assert.deepStrictEqual(live.parseCsv('a,b'), [['a', 'b']]);

const config = live.createReader({ configSrc, codeSrc, fetchImpl: async () => { throw new Error('unused'); } }).config;

// --- fixtures: one or two valid rows per tab, built from the headers the sheet must have
const quote = v => /[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
function csvFor(name) {
  const headers = config.required[name];
  const sample = {
    Record_ID: 'r1', Report_Date: '05/10/2569', Province: 'กรุงเทพมหานคร', Affected_Households: '1,234', Current_Status: 'กำลังประสบภัย',
    station_id: 's1', district_or_area: name === 'BKK_water_DB' ? 'เขตบางรัก' : 'ปทุมธานี', latitude: '13.7', longitude: '100.5',
    observed_at_th: '2026-10-05T10:00:00+07:00', fetched_at_th: '2026-10-05T10:05:00+07:00', raw_station_json: '{"district_name":"เขตบางรัก"}',
    shelter_id: 'sh1', district: 'บางรัก', shelter_name: 'โรงเรียน, ทดสอบ', capacity: '100', occupied: '40', available: '60',
  };
  const rows = [headers.map(h => quote(h)).join(',')];
  rows.push(headers.map(h => quote(String(sample[h] ?? (h.includes('จังหวัด') ? 'กรุงเทพมหานคร' : h.includes('เขตสุขภาพ') ? 'เขตสุขภาพที่ 13' : h.includes('(คน)') ? '1,000' : '')))).join(','));
  return rows.join('\n');
}
const respond = (status, body) => ({ ok: status === 200, status, text: async () => body });
function makeFetch(overrides = {}) {
  const calls = [];
  const f = async (url, opts) => {
    const name = decodeURIComponent(url.split('sheet=')[1]);
    calls.push({ url, name, opts });
    const o = overrides[name];
    if (typeof o === 'function') return o(calls.filter(c => c.name === name).length);
    return respond(200, csvFor(name));
  };
  f.calls = calls;
  return f;
}
const reader = fetchImpl => live.createReader({ configSrc, codeSrc, fetchImpl, attempts: 3, delayMs: 0 });

(async () => {
  // --- full read: URLs, cache mode and values
  let f = makeFetch();
  let data = await reader(f).read();
  assert.strictEqual(f.calls.length, 5);
  for (const c of f.calls) {
    assert(c.url.startsWith('https://docs.google.com/spreadsheets/d/' + config.spreadsheetId + '/gviz/tq?tqx=out:csv&sheet='), c.url);
    assert.strictEqual(c.opts.cache, 'no-store');
  }
  assert.deepStrictEqual(Object.values(data.sourceStatus).map(s => s.status), ['ok', 'ok', 'ok', 'ok', 'ok']);
  assert.strictEqual(data.disasters[0].Affected_Households, 1234);
  assert.strictEqual(data.disasters[0].Report_Date, '2026-10-05T00:00:00+07:00');
  assert.strictEqual(data.shelters[0].shelter_name, 'โรงเรียน, ทดสอบ');
  assert.strictEqual(data.bkkStations[0].district_or_area, 'บางรัก');
  assert.deepStrictEqual(data.liveErrors, {});

  // --- same result as running Code.gs directly on the same rows (the way fetch_data.cjs builds data.json)
  const ctx = vm.createContext({ console, Date, Utilities: { formatDate: d => d.toISOString() } });
  vm.runInContext(configSrc + '\n' + codeSrc, ctx);
  ctx.__sheets = Object.fromEntries(Object.keys(config.required).map(n => [n, live.parseCsv(csvFor(n))]));
  vm.runInContext('SpreadsheetApp={openById:()=>({getSheetByName:n=>__sheets[n]?({getDataRange:()=>({getValues:()=>__sheets[n]})}):null})}', ctx);
  const direct = vm.runInContext('getDashboardData()', ctx);
  for (const k of ['disasters', 'vulnerable', 'stations', 'bkkStations', 'shelters']) assert.strictEqual(JSON.stringify(data[k]), JSON.stringify(direct[k]), k);  // JSON: the vm realm has its own Object/Array prototypes

  // --- an empty tab (the import script is rewriting it) is retried and then read
  f = makeFetch({ shelter_DB: n => n < 3 ? respond(200, csvFor('shelter_DB').split('\n')[0]) : respond(200, csvFor('shelter_DB')) });
  data = await reader(f).read();
  assert.strictEqual(data.sourceStatus.shelter_DB.status, 'ok');
  assert.strictEqual(f.calls.filter(c => c.name === 'shelter_DB').length, 3);

  // --- HTTP errors and network errors are retried too
  f = makeFetch({ thai_water_DB: n => { if (n === 1) return respond(500, ''); if (n === 2) throw new TypeError('network'); return respond(200, csvFor('thai_water_DB')); } });
  data = await reader(f).read();
  assert.strictEqual(data.sourceStatus.thai_water_DB.status, 'ok');

  // --- one tab that never loads fails alone; the others are still read
  const warn = console.warn, err = console.error; console.warn = console.error = () => {};  // Code.gs logs each missing tab
  try {
    f = makeFetch({ BKK_water_DB: () => respond(200, 'station_id') });
    data = await reader(f).read();
    assert.strictEqual(data.sourceStatus.BKK_water_DB.status, 'error');
    assert.deepStrictEqual(Object.keys(data.liveErrors), ['BKK_water_DB']);
    assert(/BKK_water_DB: no rows \(after 3 attempts\)/.test(data.liveErrors.BKK_water_DB));
    assert.strictEqual(f.calls.filter(c => c.name === 'BKK_water_DB').length, 3);
    assert.strictEqual(data.sourceStatus.shelter_DB.status, 'ok');
    assert.deepStrictEqual(data.bkkStations, []);

    // --- every tab failing: all errors (the page then falls back to the published snapshot)
    f = makeFetch(Object.fromEntries(Object.keys(config.required).map(n => [n, () => respond(503, '')])));
    data = await reader(f).read();
    assert(Object.values(data.sourceStatus).every(s => s.status === 'error'));
    assert.strictEqual(Object.keys(data.liveErrors).length, 5);
  } finally { console.warn = warn; console.error = err; }

  // --- a single tab (per-sheet retry button)
  f = makeFetch();
  data = await reader(f).read('shelter_DB');
  assert.deepStrictEqual(Object.keys(data.sourceStatus), ['shelter_DB']);
  assert.strictEqual(f.calls.length, 1);
  assert.strictEqual(data.shelters.length, 1);

  console.log('PASS: live sheet reader (CSV parsing, URLs, same output as Code.gs, retry, per-tab failure, single tab)');
})().catch(e => { console.error(e); process.exit(1); });
