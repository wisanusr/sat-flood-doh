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

## หมายเหตุ
- `Code.gs`, `*.html` (ยกเว้น `docs/`) ยังใช้เป็น Apps Script ได้เหมือนเดิม
- `build.py` สร้างไฟล์ Apps Script จากโฟลเดอร์ `../flood_web` ซึ่งยังไม่อยู่ใน repo นี้
