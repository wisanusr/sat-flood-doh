"""Build isolated Safari diagnostic pages from the same published dashboard.

Does not change docs/index.html or apply the proposed memory fixes.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
MODES = {
    'control': 'C — เว็บเดิม พร้อมบันทึกขั้นตอน',
    'snapshot': 'A — มีแผนที่ หยุดอ่านชีตสดอัตโนมัติ',
    'no-map': 'B — อ่านชีตสด ไม่โหลดแผนที่',
}


def diagnostic_html(html, mode, recorder):
    assert mode in MODES
    assert '<head>' in html and '<body>' in html
    config = json.dumps({'mode': mode, 'label': MODES[mode], 'version': '2026-10-10-1'}, ensure_ascii=False)
    bootstrap = '<base href="../"><script>window.MOBILE_TEST_CONFIG=' + config + ';\n' + recorder.replace('</', '<\\/') + '\n</script>'
    # Keep charset metadata before the diagnostic script.
    result = html.replace('</title>', '</title>' + bootstrap, 1)
    if mode == 'snapshot':
        marker = "if(typeof upgradeLive==='function'){"
        assert result.count(marker) == 1, 'automatic live-read marker changed'
        result = result.replace(marker, "if(false&&typeof upgradeLive==='function'){", 1)
    if mode == 'no-map':
        start = "const mapScript=document.createElement('script');"
        end = 'document.head.appendChild(mapScript);'
        assert result.count(start) == result.count(end) == 1, 'map loader changed'
        result = result.replace(start, 'if(false){' + start, 1).replace(end, end + '}', 1)
    parse_start = '  function parseCsv(text){'
    parse_end = '    return rows;\n  }\n  const sleep'
    assert result.count(parse_start) == result.count(parse_end) == 1, 'CSV parser changed'
    result = result.replace(parse_start, parse_start + "window.MobileDiagnostics.mark('csv-parse-start',text.length);", 1)
    result = result.replace(parse_end, "    window.MobileDiagnostics.mark('csv-parse-ready',rows.length);\n" + parse_end, 1)
    marker = 'function renderMap(){'
    assert result.count(marker) == 1, 'map render marker changed'
    return result.replace(marker, "function renderMap(){window.MobileDiagnostics.mark('map-render');", 1)


def build(html, out):
    recorder = (ROOT / 'flood_web/mobile-diagnostics.js').read_text(encoding='utf-8')
    target = out / 'mobile-test'
    target.mkdir(exist_ok=True)
    for mode in MODES:
        (target / (mode + '.html')).write_text(diagnostic_html(html, mode, recorder), encoding='utf-8')
    print('Built mobile-test/control.html, snapshot.html, no-map.html')


if __name__ == '__main__':
    build((ROOT / 'docs/index.html').read_text(encoding='utf-8'), ROOT / 'docs')
