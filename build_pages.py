"""Build the static site (docs/index.html) for GitHub Pages.

Run `node fetch_data.cjs` first (writes docs/data.json), then `python build_pages.py`.
Inlines the Apps Script includes of Index.html and replaces google.script.run
with fetch('data.json').

Dashboard.html marks the google.script.run bridge with /*@bridge-begin*/.../*@bridge-end*/ (written by build.py).
The static site first paints from the published data.json (a snapshot rebuilt by GitHub Actions on a schedule GitHub does
not keep on time) and then reads the Google Sheet itself with flood_web/live-sheets.js, which runs the same Config.gs and
Code.gs as the snapshot build. The refresh button and per-sheet retries read the sheet too and fall back to the snapshot.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent

def read(name):
    return (ROOT / (name + '.html')).read_text(encoding='utf-8')

BRIDGE = re.compile(r'/\*@bridge-begin\*/.*?/\*@bridge-end\*/', re.S)
bridge_new = (
    "window.DATA_IS_SNAPSHOT=true;"
    "async function snapshotData(){const r=await fetch('data.json',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}"
    "async function liveData(source){if(!window.LiveSheets)throw new Error('live reader unavailable');const d=await window.LiveSheets.read(source||null);"
    "if(!d.sourceStatus||Object.values(d.sourceStatus).every(x=>x.status!=='ok'))throw new Error('no sheet could be read');return d}"
    # first load = snapshot (fast first paint); the refresh button / per-sheet retry = live read with snapshot fallback
    "async function requestData(source,refresh){"
    "if(source||refresh){try{const d=await liveData(source);window.DATA_IS_SNAPSHOT=false;window.DATA_LIVE_ERROR=false;return d}catch(e){console.warn('live read failed',e);window.DATA_LIVE_ERROR=true}}"
    "const d=await snapshotData();window.DATA_IS_SNAPSHOT=true;return d}"
    "async function upgradeLive(){window.DATA_LIVE_PENDING=true;"
    "try{const d=await liveData(null);window.DATA_IS_SNAPSHOT=false;window.DATA_LIVE_ERROR=false;return d}"
    "catch(e){console.warn('live read failed',e);window.DATA_LIVE_ERROR=true;return null}"
    "finally{window.DATA_LIVE_PENDING=false}}")

def include(match):
    name = match.group(1)
    text = read(name)
    if name == 'Dashboard':
        text, swapped = BRIDGE.subn(lambda m: bridge_new, text)
        assert swapped == 1, 'Apps Script bridge marker not found in Dashboard.html'
    return text

html = (ROOT / 'Index.html').read_text(encoding='utf-8')
html = re.sub(r"<\?!= include_\('(\w+)'\); \?>", include, html)
# Fill the pages-only slots (news tab) that build.py left in Index.html from flood_web/template.html.
PAGES_ONLY = re.compile(r'<!--@pages-only-begin-->(.*?)<!--@pages-only-end-->', re.S)
blocks = PAGES_ONLY.findall((ROOT / 'flood_web' / 'template.html').read_text(encoding='utf-8'))
for i, block in enumerate(blocks):
    assert html.count('<!--@pages-slot-%d-->' % i) == 1, 'pages-only slot %d missing in Index.html (run build.py)' % i
    html = html.replace('<!--@pages-slot-%d-->' % i, block)
assert '@pages-slot' not in html and blocks, 'unfilled pages-only slot'
LIVE_TAG = '<script src="/live-sheets.js"></script>'
assert html.count(LIVE_TAG) == 1
gas = {n: (ROOT / n).read_text(encoding='utf-8') for n in ('Config.gs', 'Code.gs')}
assert all('</script' not in t for t in gas.values()), 'Apps Script source would break the inline script'
live_js = (ROOT / 'flood_web' / 'live-sheets.js').read_text(encoding='utf-8').replace('</', '<\\/')
html = html.replace(LIVE_TAG, '<script type="text/plain" id="gasConfig">\n' + gas['Config.gs'] + '\n</script>\n'
                    '<script type="text/plain" id="gasCode">\n' + gas['Code.gs'] + '\n</script>\n<script>\n' + live_js + '\n</script>')
NEWS_TAG = '<script src="/news-view.js"></script>'
assert html.count(NEWS_TAG) == 1
news_js = (ROOT / 'flood_web' / 'news-view.js').read_text(encoding='utf-8').replace('</', '<\\/')
html = html.replace(NEWS_TAG, '<script>\n' + news_js + '\n</script>')
DOH_TAG = '<script src="/shelter-doh-view.js"></script>'
assert html.count(DOH_TAG) == 1
doh_js = (ROOT / 'flood_web' / 'shelter-doh-view.js').read_text(encoding='utf-8').replace('</', '<\\/')
html = html.replace(DOH_TAG, '<script>\n' + doh_js + '\n</script>')
html = html.replace('id="refreshData" type="button">', 'id="refreshData" type="button" title="อ่านข้อมูลสดจากชีตอีกครั้ง (ถ้าอ่านไม่ได้จะใช้ไฟล์ที่เผยแพร่)">', 1)
assert '<?!=' not in html and 'google.script.run.with' not in html, 'Unconverted Apps Script code'
assert 'function requestData' in html and 'requestDashboard' not in html, 'Request bridge not converted'
out = ROOT / 'docs'
out.mkdir(exist_ok=True)
(out / 'index.html').write_text(html, encoding='utf-8')
(out / '.nojekyll').write_text('', encoding='utf-8')
print('Built', out / 'index.html', round(len(html) / 1e6, 2), 'MB')
