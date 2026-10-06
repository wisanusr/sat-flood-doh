"""Build a single-file static site (docs/index.html) for GitHub Pages.

Usage: python build_pages.py <APPS_SCRIPT_WEB_APP_URL>   (the .../exec URL)
The page then loads data with fetch(<url>?api=1) instead of google.script.run.
"""
from pathlib import Path
import json, re, sys

ROOT = Path(__file__).resolve().parent
if len(sys.argv) != 2 or not sys.argv[1].startswith('https://script.google.com/'):
    sys.exit('Usage: python build_pages.py https://script.google.com/macros/s/<id>/exec')
api_url = sys.argv[1]

def read(name):
    return (ROOT / (name + '.html')).read_text(encoding='utf-8')

bridge_old = re.search(r'function requestDashboard\(source\)\{.*?\}\n', read('Dashboard'), re.S).group(0)
bridge_new = ("const API_URL=" + json.dumps(api_url) + ";\n"
              "async function requestDashboard(source){const r=await fetch(API_URL+'?api=1'+(source?'&source='+encodeURIComponent(source):''),{cache:'no-store'});"
              "if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();if(d.error)throw new Error(d.error);return d;}\n")

def include(match):
    name = match.group(1)
    text = read(name)
    return text.replace(bridge_old, bridge_new) if name == 'Dashboard' else text

html = (ROOT / 'Index.html').read_text(encoding='utf-8')
html = re.sub(r"<\?!= include_\('(\w+)'\); \?>", lambda m: include(m), html)
assert '<?!=' not in html and 'google.script.run.with' not in html, 'Unconverted Apps Script code'
out = ROOT / 'docs'
out.mkdir(exist_ok=True)
(out / 'index.html').write_text(html, encoding='utf-8')
(out / '.nojekyll').write_text('', encoding='utf-8')
print('Built', out / 'index.html', round(len(html) / 1e6, 2), 'MB')
