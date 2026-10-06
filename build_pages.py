"""Build the static site (docs/index.html) for GitHub Pages.

Run `node fetch_data.cjs` first (writes docs/data.json), then `python build_pages.py`.
Inlines the Apps Script includes of Index.html and replaces google.script.run
with fetch('data.json').

Dashboard.html marks the google.script.run bridge with /*@bridge-begin*/.../*@bridge-end*/ (written by build.py).
In the static site every request returns the whole published data.json, so a per-source retry and the
refresh button simply reload the latest published file (rebuilt by GitHub Actions every 30 minutes).
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent

def read(name):
    return (ROOT / (name + '.html')).read_text(encoding='utf-8')

BRIDGE = re.compile(r'/\*@bridge-begin\*/.*?/\*@bridge-end\*/', re.S)
bridge_new = ("async function requestData(){const r=await fetch('data.json',{cache:'no-store'});"
              "if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}")

def include(match):
    name = match.group(1)
    text = read(name)
    if name == 'Dashboard':
        text, swapped = BRIDGE.subn(lambda m: bridge_new, text)
        assert swapped == 1, 'Apps Script bridge marker not found in Dashboard.html'
    return text

html = (ROOT / 'Index.html').read_text(encoding='utf-8')
html = re.sub(r"<\?!= include_\('(\w+)'\); \?>", include, html)
html = html.replace('id="refreshData" type="button">', 'id="refreshData" type="button" title="โหลดข้อมูลชุดล่าสุดที่เผยแพร่ (อัปเดตทุก 30 นาที)">', 1)
assert '<?!=' not in html and 'google.script.run.with' not in html, 'Unconverted Apps Script code'
assert 'function requestData' in html and 'requestDashboard' not in html, 'Request bridge not converted'
out = ROOT / 'docs'
out.mkdir(exist_ok=True)
(out / 'index.html').write_text(html, encoding='utf-8')
(out / '.nojekyll').write_text('', encoding='utf-8')
print('Built', out / 'index.html', round(len(html) / 1e6, 2), 'MB')
