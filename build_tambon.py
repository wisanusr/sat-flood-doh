"""Make flood_web/tambon/<pro_code>.json (tambon outlines for the "น้ำขัง" map, one file per province) from the full
subdistricts file.

Source: subdistricts.geojson of https://github.com/chingchai/OpenGISData-Thailand (the same set as amphoe.geojson).
Usage: python build_tambon.py path/to/subdistricts.geojson

The whole country is too large to inline into the page like the district outlines, so the page fetches one province
file when it needs it (zoomed in, or a province / district chosen); build_pages.py copies the folder into docs/.
Keeps tam_code, tam_th, amp_code only; finer simplification than the districts because tambons are small. Outlines only.
"""
from pathlib import Path
from collections import defaultdict
import json, sys
from build_amphoe import simplify

TOLERANCE = 0.0006  # degrees, about 65 m
DECIMALS = 4
OUT = Path(__file__).resolve().parent / 'flood_web' / 'tambon'


def ring(coords):
    pts = []
    for x, y in simplify(coords, TOLERANCE):
        p = [round(x, DECIMALS), round(y, DECIMALS)]
        if not pts or p != pts[-1]:
            pts.append(p)
    return pts if len(pts) >= 4 else None  # a closed ring needs 4 points; tiny islands drop out


def main(src):
    data = json.loads(Path(src).read_text(encoding='utf-8'))
    by_prov = defaultdict(list)
    for f in data['features']:
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        out = []
        for poly in polys:
            outer = ring(poly[0])
            if outer:  # holes without their outer ring are dropped with it
                out.append([outer] + [r for r in (ring(h) for h in poly[1:]) if r])
        if not out:
            continue
        p = f['properties']
        by_prov[p['pro_code']].append({'type': 'Feature',
                                       'properties': {k: p[k] for k in ('tam_code', 'tam_th', 'amp_code')},
                                       'geometry': {'type': 'MultiPolygon', 'coordinates': out}})
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.json'):
        old.unlink()
    total = 0
    for code, feats in sorted(by_prov.items()):
        feats.sort(key=lambda f: f['properties']['tam_code'])
        path = OUT / f'{code}.json'
        path.write_text(json.dumps({'type': 'FeatureCollection', 'features': feats}, ensure_ascii=False, separators=(',', ':')),
                        encoding='utf-8')
        total += path.stat().st_size
    sizes = sorted((p.stat().st_size for p in OUT.glob('*.json')), reverse=True)
    print(f'{sum(len(v) for v in by_prov.values())} tambons in {len(by_prov)} provinces -> {OUT} '
          f'({total / 1e6:.2f} MB, largest {sizes[0] / 1e3:.0f} KB, median {sizes[len(sizes) // 2] / 1e3:.0f} KB)')


if __name__ == '__main__':
    main(sys.argv[1])
