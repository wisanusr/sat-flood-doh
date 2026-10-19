"""Make flood_web/amphoe.geojson (district outlines for the "น้ำขัง" map) from the full districts file.

Source: districts.geojson of https://github.com/chingchai/OpenGISData-Thailand (the same set as thai_provinces.json
and bkk_districts.geojson). Usage: python build_amphoe.py path/to/districts.geojson

Keeps amp_code, amp_th, pro_code, pro_th only, simplifies each ring (Douglas-Peucker) and rounds coordinates so the
file stays small enough to inline into the Apps Script and Pages builds. Outlines only: not for area sums.
"""
from pathlib import Path
import json, sys

TOLERANCE = 0.003  # degrees, about 300 m
DECIMALS = 3
OUT = Path(__file__).resolve().parent / 'flood_web' / 'amphoe.geojson'


def simplify(points, tol):
    """Douglas-Peucker on one ring; iterative so long rings do not hit the recursion limit."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = points[a], points[b]
        dx, dy = x2 - x1, y2 - y1
        norm = (dx * dx + dy * dy) ** 0.5
        best, idx = -1.0, -1
        for i in range(a + 1, b):
            x, y = points[i]
            d = abs(dy * (x - x1) - dx * (y - y1)) / norm if norm else ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
            if d > best:
                best, idx = d, i
        if idx > 0 and best > tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(points, keep) if k]


def ring(coords):
    pts = []
    for x, y in simplify(coords, TOLERANCE):
        p = [round(x, DECIMALS), round(y, DECIMALS)]
        if not pts or p != pts[-1]:
            pts.append(p)
    return pts if len(pts) >= 4 else None  # a closed ring needs 4 points; tiny islands drop out


def main(src):
    data = json.loads(Path(src).read_text(encoding='utf-8'))
    features = []
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
        features.append({'type': 'Feature',
                         'properties': {k: p[k] for k in ('amp_code', 'amp_th', 'pro_code', 'pro_th')},
                         'geometry': {'type': 'MultiPolygon', 'coordinates': out}})
    features.sort(key=lambda f: f['properties']['amp_code'])
    OUT.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False, separators=(',', ':')),
                   encoding='utf-8')
    print(f'{len(features)} districts -> {OUT} ({OUT.stat().st_size / 1e6:.2f} MB)')


if __name__ == '__main__':
    main(sys.argv[1])
