# Flood Dashboard — เฝ้าระวังน้ำ (กรมอนามัย)

เว็บแสดงสถานการณ์น้ำท่วมจาก Google Sheets สาธารณะ รันทั้งหมดผ่าน GitHub (ไม่ต้อง deploy Apps Script)

## วิธีทำงาน
1. GitHub Actions (`.github/workflows/pages.yml`) ทำงานทุก 30 นาทีและเมื่อ push
2. `fetch_data.cjs` อ่านชีตเป็น CSV (ชีตต้องเปิดแบบ "ทุกคนที่มีลิงก์อ่านได้") แล้วแปลงด้วยตรรกะเดียวกับ `Code.gs` → `docs/data.json`
3. `build_pages.py` รวมหน้าเว็บเป็น `docs/index.html`
4. deploy ขึ้น GitHub Pages

## ตั้งค่าครั้งแรก
Settings → Pages → Source: **GitHub Actions** (Pages บน repo private ต้องใช้แพ็กเกจเสียเงิน)

## รันในเครื่อง
```
node test.cjs
node fetch_data.cjs
python build_pages.py
python -m http.server 8000 --directory docs
```

## แท็บ "ข่าว & Trends" (เฉพาะ GitHub Pages)
ย้ายมาจากโปรเจกต์ SAT_flood: พาดหัวข่าวน้ำท่วม, Word Cloud (TF-IDF) และ Google Trends
- `news/news_scraper.py` อ่าน RSS (Google News, มติชน, Thai PBS, ไทยรัฐ) ย้อนหลัง 30 ชม. → `docs/news_data/news.json` (เก็บเฉพาะพาดหัว/แหล่ง/ลิงก์/เวลา ไม่เก็บเนื้อหาข่าว)
- `news/trends_scraper.py` อ่าน Google Trends → `docs/news_data/trends.json` ถ้าอ่านไม่ได้ (pytrends ไม่เป็นทางการ อาจถูกจำกัดบน GitHub runner) จะแสดงสถานะ "ไม่พร้อมใช้งาน" ไม่ใช้ข้อมูลสมมติ
- ทั้งสองรันใน `pages.yml` ก่อน build และ `continue-on-error` จึงไม่ทำให้ deploy แดชบอร์ดล้ม ไฟล์ JSON ไม่ถูก commit (อยู่ใน `docs/`)
- UI: `flood_web/news-view.js` (บล็อก `<!--@pages-only-begin-->` ใน `template.html` ถูกตัดออกจากแพ็กเกจ Apps Script โดย `build.py` และใส่กลับใน `build_pages.py`)
- ทดสอบ: `python news/test_news.py` · รันในเครื่อง: `pip install -r news/requirements.txt && python news/news_scraper.py && python news/trends_scraper.py` ก่อน `python build_pages.py`
- ข้อมูลข่าวเป็นการจัดกลุ่มด้วยกฎคำสำคัญ ไม่ใช่การยืนยันข้อเท็จจริง; ลิงก์ข่าวเป็นของเจ้าของเนื้อหาต้นทาง

## โครงสร้างและวิธีแก้ไข
- **ต้นทางที่แก้ไข:** `flood_web/` (`template.html`, `dashboard.js`, `data-model.js`, `dashboard.css`, GeoJSON, `server.py` สำหรับทดสอบในเครื่อง)
- **ไฟล์ที่สร้างอัตโนมัติ (อย่าแก้ตรงๆ):** `Index.html`, `Dashboard.html`, `DataModel.html`, `Styles.html`, `*GeoJSON.html`, `Config.gs`, `schema.json`, `appsscript.json` สร้างด้วย `python build.py` แล้ว commit
- **เขียนมือ:** `Code.gs` (อ่านชีต แปลงข้อมูล แคช 5 นาทีเมื่อรันบน Apps Script), `fetch_data.cjs`, `build_pages.py`, `test.cjs`

ลำดับหลังแก้หน้าเว็บ:
```
node flood_web/test_model.cjs
python flood_web/test_server.py
python build.py          # สร้างไฟล์ Apps Script จาก flood_web/
node test.cjs
```
ทดสอบหน้าจริงกับชีต: `python flood_web/server.py` แล้วเปิด http://127.0.0.1:8765/

## หมายเหตุ
- `Code.gs` และไฟล์ที่สร้างอัตโนมัติยังใช้เป็น Apps Script ได้เหมือนเดิม (Deploy แยกได้) ส่วนเวอร์ชัน Pages ใช้ `Code.gs` ชุดเดียวกันผ่าน `fetch_data.cjs`
- เวอร์ชัน Pages: ปุ่ม "รีเฟรชข้อมูล" และ "ลองใหม่" โหลด `data.json` ชุดล่าสุดที่เผยแพร่ (อัปเดตทุก 30 นาที) ไม่ได้อ่านชีตสด แคช 5 นาทีมีผลเฉพาะบน Apps Script
- ขั้นตอน CI ตรวจว่าไฟล์ที่สร้างตรงกับ `flood_web/` (`python3 build.py` แล้ว `git diff --exit-code`) หากไม่ตรงให้รัน `python build.py` แล้ว commit
