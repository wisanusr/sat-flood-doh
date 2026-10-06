"""Build deployable Apps Script files from the current dashboard. No live writes."""
from pathlib import Path
import importlib.util, json, re

ROOT = Path(__file__).resolve().parent
WEB = ROOT / 'flood_web'
spec = importlib.util.spec_from_file_location('backend', WEB / 'server.py')
backend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend)
config = dict(spreadsheetId=backend.SPREADSHEET_ID, required=backend.REQUIRED,
              numeric=sorted(backend.NUMERIC), dates=sorted(backend.DATES),
              districts=sorted(backend.BKK_DISTRICTS))
(ROOT / 'Config.gs').write_text('const CONFIG = '+json.dumps(config, ensure_ascii=False, indent=2)+';\n', encoding='utf-8')
for name, filename, variable in [('GeoJSON','thai_provinces.json','PROVINCES_GEOJSON'),('BkkGeoJSON','bkk_districts.geojson','BKK_DISTRICTS_GEOJSON'),('RegionsGeoJSON','regions.geojson','HEALTH_REGIONS_GEOJSON')]:
    data = json.loads((WEB / filename).read_text(encoding='utf-8'))
    (ROOT / (name+'.html')).write_text('<script>window.'+variable+'='+json.dumps(data,ensure_ascii=False).replace('</','<\\/')+';</script>', encoding='utf-8')
js = (WEB / 'dashboard.js').read_text(encoding='utf-8')
start = js.index('  try {\n    const resGeo')
end = js.index('const $=id=>', start)
js = js[:start]+js[end:]
bridge = '/*@bridge-begin*/function requestData(source,refresh){return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getDashboardData(source||null,!!refresh));}/*@bridge-end*/'
js, swapped = re.subn(r'//@local-request-begin.*?//@local-request-end', lambda m: bridge, js, flags=re.S)
assert swapped == 1, 'local request block not found'
assert "fetch('/" not in js, 'Unconverted local request'
for name, text, tag in [('Dashboard',js,'script'),('DataModel',(WEB/'data-model.js').read_text(encoding='utf-8'),'script'),('Styles',(WEB/'dashboard.css').read_text(encoding='utf-8'),'style')]:
    (ROOT/(name+'.html')).write_text('<'+tag+'>\n'+text+'\n</'+tag+'>',encoding='utf-8')
html=(WEB/'template.html').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="/dashboard.css">', "<?!= include_('Styles'); ?>")
html=html.replace('<script src="/data-model.js"></script><script src="/dashboard.js"></script>', '\n'.join("<?!= include_('"+n+"'); ?>" for n in ['GeoJSON','BkkGeoJSON','RegionsGeoJSON','DataModel','Dashboard']))
# Blocks marked pages-only (the news tab) exist only on the GitHub Pages site: leave a numbered slot here and
# build_pages.py fills it from template.html. The Apps Script package has no news.json, so it must not show the tab.
pages_only = iter(range(1000))
html=re.sub(r'<!--@pages-only-begin-->.*?<!--@pages-only-end-->', lambda m: '<!--@pages-slot-%d-->' % next(pages_only), html, flags=re.S)
(ROOT/'Index.html').write_text(html,encoding='utf-8')
(ROOT/'appsscript.json').write_text(json.dumps({'timeZone':'Asia/Bangkok','runtimeVersion':'V8','exceptionLogging':'STACKDRIVER','oauthScopes':['https://www.googleapis.com/auth/spreadsheets.readonly']},indent=2),encoding='utf-8')
(ROOT/'schema.json').write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
print('Built Apps Script package:', ROOT)
