"""Build the static site (docs/index.html) for GitHub Pages.

Run `node fetch_data.cjs` first (writes docs/data.json), then `python build_pages.py`.
Inlines the Apps Script includes of Index.html and replaces google.script.run
with fetch('data.json').
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent

def read(name):
    return (ROOT / (name + '.html')).read_text(encoding='utf-8')

bridge_old = re.search(r'function requestDashboard\(source\)\{.*?\}\n', read('Dashboard'), re.S).group(0)
bridge_new = ("async function requestDashboard(){const r=await fetch('data.json',{cache:'no-store'});"
              "if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}\n")

def include(match):
    name = match.group(1)
    text = read(name)
    return text.replace(bridge_old, bridge_new) if name == 'Dashboard' else text

html = (ROOT / 'Index.html').read_text(encoding='utf-8')
html = re.sub(r"<\?!= include_\('(\w+)'\); \?>", include, html)
assert '<?!=' not in html and 'google.script.run.with' not in html, 'Unconverted Apps Script code'
out = ROOT / 'docs'
out.mkdir(exist_ok=True)
(out / 'index.html').write_text(html, encoding='utf-8')
(out / '.nojekyll').write_text('', encoding='utf-8')
print('Built', out / 'index.html', round(len(html) / 1e6, 2), 'MB')
