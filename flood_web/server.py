from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode, urlsplit, parse_qs
import csv
import io
import json
import math
import re
import time
import socket

ROOT = Path(__file__).resolve().parent
SPREADSHEET_ID = '1RQDU83exQhNpVYjp9JyD5UdocA6JB6GpJeXA-Qe8Pr4'
SOURCE_URL = f'https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit'
SHEETS = {'Disaster_DB': 0, 'Vulnerable_group': 1622234299,
          'thai_water_DB': 32587398, 'BKK_water_DB': 1876038359, 'shelter_DB': 992577657}
REQUIRED = {
    'Disaster_DB': 'Record_ID Report_Date Province Affected_Households Current_Status'.split(),
    'Vulnerable_group': ['จังหวัด', 'เขตสุขภาพ', 'จำนวนเด็ก 0-4 ปีทั้งหมด (คน)', 'จำนวนหญิงตั้งครรภ์ทั้งหมด (คน)', 'จำนวนผู้สูงอายุ 60 ปีขึ้นไปทั้งหมด (คน)'],
    'thai_water_DB': 'station_id district_or_area latitude longitude observed_at_th fetched_at_th'.split(),
    'BKK_water_DB': 'station_id district_or_area latitude longitude observed_at_th fetched_at_th raw_station_json'.split(),
    'shelter_DB': 'shelter_id district shelter_name capacity occupied available latitude longitude'.split(),
}
NUMERIC = set('Affected_Districts_Count Affected_Subdistricts_Count Affected_Villages_Count Affected_Households Casualties_Deaths latitude longitude water_in_m_msl warning_in_source critical_in_source age_minutes_at_fetch capacity occupied available'.split()) | set(REQUIRED['Vulnerable_group'][2:])
BKK_DISTRICTS = set('คลองสาน คลองสามวา คลองเตย คันนายาว จตุจักร จอมทอง ดอนเมือง ดินแดง ดุสิต ตลิ่งชัน ทวีวัฒนา ทุ่งครุ ธนบุรี บางกอกน้อย บางกอกใหญ่ บางกะปิ บางขุนเทียน บางคอแหลม บางซื่อ บางนา บางบอน บางพลัด บางรัก บางเขน บางแค บึงกุ่ม ปทุมวัน ประเวศ ป้อมปราบศัตรูพ่าย พญาไท พระนคร พระโขนง ภาษีเจริญ มีนบุรี ยานนาวา ราชเทวี ราษฎร์บูรณะ ลาดกระบัง ลาดพร้าว วังทองหลาง วัฒนา สวนหลวง สะพานสูง สัมพันธวงศ์ สาทร สายไหม หนองจอก หนองแขม หลักสี่ ห้วยขวาง'.split())
DATES = set('Report_Date Ingested_At observed_at_th fetched_at_th updated_at_source'.split())

def normalize(key, value):
    value = value.strip() if isinstance(value, str) else value
    if value is None or value == '': return None
    if key in NUMERIC:
        try:
            n = float(str(value).replace(',', ''))
            if not math.isfinite(n): return None
            return int(n) if n.is_integer() else n
        except (ValueError, TypeError): return None
    if key in DATES:
        value = str(value).strip()
        m = re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?', value)
        if m:
            d, mth, y, h, mn, s = m.groups()
            y = int(y)
            if y > 2500: y -= 543
            value = f"{y:04d}-{int(mth):02d}-{int(d):02d}T{int(h or 0):02d}:{int(mn or 0):02d}:{int(s or 0):02d}+07:00"
        else:
            value = value.replace(' ', 'T', 1)
            value = re.sub(r'T(\d):', r'T0\1:', value)
            if re.fullmatch(r'\d{4}-\d{2}-\d{2}', value): value += 'T00:00:00'
            if re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', value): value += '+07:00'
            if re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}', value): value += ':00+07:00'
        try:
            datetime.fromisoformat(value.replace('Z', '+00:00'))
            return value
        except ValueError:
            raise ValueError(f'Invalid date format in column {key}: {value}')
    return value

def parse_sheet(name, text):
    reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
    if not reader.fieldnames or any(k not in reader.fieldnames for k in REQUIRED[name]):
        raise ValueError(f'ชีต {name} ไม่มีหัวคอลัมน์ที่จำเป็น หรืออ่านไม่ได้ด้วยสิทธิ์ปัจจุบัน')
    return [{k: normalize(k, v) for k, v in row.items() if k}
            for row in reader if any(v and str(v).strip() for v in row.values())]

def fetch_sheet(item):
    name, gid = item
    params = urlencode({'format': 'csv', 'gid': gid, '_': time.time_ns()})
    url = f'https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?{params}'
    try:
        with urlopen(Request(url, headers={'Cache-Control': 'no-cache'}), timeout=25) as response:
            if 'text/csv' not in response.headers.get('Content-Type', ''):
                raise ValueError('ไม่ได้รับข้อมูล CSV')
            text = response.read().decode('utf-8-sig')
        return name, parse_sheet(name, text)
    except Exception as exc:
        raise RuntimeError(f'อ่าน Google Sheets: {name} ไม่สำเร็จ') from exc

def transform(raw):
    def pick(row, keys): return {k: row.get(k) for k in keys.split()}
    def stations(rows, bkk=False):
        result = []
        for row in rows:
            item = pick(row, 'station_id station_name district_or_area latitude longitude observed_at_th water_in_m_msl warning_in_source critical_in_source flood_status_source age_minutes_at_fetch fetched_at_th source_url')
            if bkk:
                try:
                    payload = json.loads(row.get('raw_station_json') or '{}')
                except (TypeError, ValueError):
                    payload = {}
                # Older ThaiWater schema includes province; the newer BMA feed uses district_name.
                province = payload.get('geocode', {}).get('province_name', {}).get('th')
                district = str(row.get('district_or_area') or payload.get('district_name') or '').strip()
                if district.startswith('เขต'): district = district[3:].strip()
                item['district_or_area'] = district
                item['province'] = province or ('กรุงเทพมหานคร' if district in BKK_DISTRICTS else None)
            else: item['province'] = row.get('district_or_area')
            result.append(item)
        return result
    disasters = [pick(r, 'Record_ID Report_Date Ingested_At Update_Time Region Province Disaster_Type Affected_Districts_Count District_Names Affected_Subdistricts_Count Affected_Villages_Count Affected_Households Casualties_Deaths Water_Level_Trend Current_Status Remarks Source_URL') for r in raw['Disaster_DB']]
    if any(not r['Report_Date'] or not r['Province'] for r in disasters):
        raise ValueError('รายงานภัยมีแถวที่ขาดวันที่หรือจังหวัด')
    return dict(source='รายงานสถานการณ์สาธารณภัยรายจังหวัด — Google Sheets', sourceType='google_sheets', sourceUrl=SOURCE_URL,
        loadedAt=datetime.now(timezone.utc).isoformat(),
        disasters=disasters,
        vulnerable=[dict(province=r['จังหวัด'], region=r['เขตสุขภาพ'], children=r[REQUIRED['Vulnerable_group'][2]], pregnant=r[REQUIRED['Vulnerable_group'][3]], elderly=r[REQUIRED['Vulnerable_group'][4]]) for r in raw['Vulnerable_group'] if r.get('จังหวัด')],
        stations=stations(raw['thai_water_DB']), bkkStations=stations(raw['BKK_water_DB'], True),
        shelters=[pick(r, 'shelter_id district shelter_name capacity occupied available status_source latitude longitude updated_at_source fetched_at_th source_url map_url') for r in raw['shelter_DB']])

def read_data(source=None):
    # A failed source must not discard the other live sources. No snapshot fallback.
    raw = {name: [] for name in SHEETS}
    statuses = {}
    selected = {source: SHEETS[source]} if source else SHEETS
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {name: pool.submit(fetch_sheet, item) for name, item in
                   ((name, (name, gid)) for name, gid in selected.items())}
        for name, future in futures.items():
            try:
                _, rows = future.result()
                candidate = {key: [] for key in SHEETS}
                candidate[name] = rows
                transform(candidate)  # Validate source-specific transformation independently.
                raw[name] = rows
                statuses[name] = dict(status='ok', loadedAt=datetime.now(timezone.utc).isoformat(), message=None)
            except Exception:
                import traceback
                traceback.print_exc()
                statuses[name] = dict(status='error', loadedAt=None,
                    message=f'อ่านชีต {name} ไม่สำเร็จ ตรวจการเชื่อมต่อ สิทธิ์เข้าถึง และรูปแบบข้อมูล')
    result = transform(raw)
    result['sourceStatus'] = statuses
    return result

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()
    def do_GET(self):
        route = self.path.split('?')[0]
        if route == '/api/data':
            query = parse_qs(urlsplit(self.path).query, keep_blank_values=True)
            # 'refresh' is sent by the dashboard button; this server never caches, so it is accepted and ignored.
            if query.get('refresh', ['1']) != ['1']:
                self.send_error(400, 'Invalid refresh')
                return
            query.pop('refresh', None)
            sources = query.get('source', [])
            if query and (set(query) != {'source'} or len(sources) != 1 or sources[0] not in SHEETS):
                self.send_error(400, 'Invalid source')
                return
            try:
                data = read_data(sources[0] if sources else None)
                body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode('utf-8')
                self.send_response(200 if any(s['status'] == 'ok' for s in data['sourceStatus'].values()) else 503)
            except Exception as exc:
                import traceback
                traceback.print_exc()
                print('Google Sheets read failed:', repr(exc), flush=True)
                body = json.dumps({'error': 'อ่าน Google Sheets ไม่สำเร็จ กรุณาตรวจการเชื่อมต่อ สิทธิ์เข้าถึง และชื่อคอลัมน์ แล้วรีเฟรชอีกครั้ง'}, ensure_ascii=False).encode('utf-8')
                self.send_response(503)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif route in ('/', '/index.html', '/dashboard.css', '/dashboard.js', '/data-model.js', '/news-view.js', '/live-sheets.js', '/thai_provinces.json', '/bkk_districts.geojson', '/regions.geojson'):
            # template.html is the single source of the page (build.py reads it too); no separate index.html copy.
            if route in ('/', '/index.html'): self.path = '/template.html'
            super().do_GET()
        else: self.send_error(404)

class DashboardServer(ThreadingHTTPServer):
    allow_reuse_address = False
    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

if __name__ == '__main__':
    print('http://127.0.0.1:8765/ Google Sheets: ' + SOURCE_URL, flush=True)
    DashboardServer(('127.0.0.1', 8765), Handler).serve_forever()
