const assert = require('assert');
const { fetchSheetRows, parseCsv } = require('./fetch_data.cjs');
const csv = (n) => ['a,b', ...Array.from({ length: n }, (_, i) => `${i},x`)].join('\n');
const reply = (status, body) => async () => ({ ok: status === 200, status, text: async () => body });
const sequence = (...replies) => { let i = 0; const f = async (...a) => replies[Math.min(i++, replies.length - 1)](...a); f.calls = () => i; return f; };
const quiet = { delayMs: 0 };

(async () => {
  assert.deepEqual(parseCsv('a,b\n"x,1","he said ""hi"""\n'), [['a', 'b'], ['x,1', 'he said "hi"']]);
  const warn = console.warn; console.warn = () => {};
  try {
    // header-only response (tab being rewritten) is retried and then succeeds
    let f = sequence(reply(200, 'a,b'), reply(200, ''), reply(200, csv(3)));
    assert.equal((await fetchSheetRows('t', 'u', { ...quiet, fetchImpl: f })).length, 4);
    assert.equal(f.calls(), 3);
    // HTTP errors are retried too
    f = sequence(reply(500, ''), reply(200, csv(1)));
    assert.equal((await fetchSheetRows('t', 'u', { ...quiet, fetchImpl: f })).length, 2);
    // a network exception is retried
    f = sequence(async () => { throw new Error('ECONNRESET'); }, reply(200, csv(1)));
    assert.equal((await fetchSheetRows('t', 'u', { ...quiet, fetchImpl: f })).length, 2);
    // a healthy read is not repeated
    f = sequence(reply(200, csv(5)));
    await fetchSheetRows('t', 'u', { ...quiet, fetchImpl: f });
    assert.equal(f.calls(), 1);
    // persistent emptiness fails after the configured attempts, naming the sheet
    f = sequence(reply(200, 'a,b'));
    await assert.rejects(fetchSheetRows('BKK_water_DB', 'u', { attempts: 3, ...quiet, fetchImpl: f }), /BKK_water_DB: no rows \(after 3 attempts\)/);
    assert.equal(f.calls(), 3);
  } finally { console.warn = warn; }
  console.log('PASS: fetch retry (empty tab, HTTP error, network error, healthy read, persistent failure)');
})().catch(e => { console.error(e); process.exit(1); });
