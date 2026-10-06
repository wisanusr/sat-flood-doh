# Flood Dashboard — เฝ้าระวังน้ำ (กรมอนามัย)

Google Apps Script Web App แสดงสถานการณ์น้ำท่วมจาก Google Sheets (รายละเอียดภาษาไทยดู `README_TH.md`)

## ตั้งค่าและ deploy
1. สร้างโปรเจค Apps Script แล้วอัปโหลดไฟล์ด้วย `clasp` (`clasp login`, `clasp create`/`clasp clone`, `clasp push`)
2. Project Settings → Script Properties → เพิ่ม `SPREADSHEET_ID` = รหัสของ Google Sheets (**ห้าม commit ค่านี้**)
3. Deploy → New deployment → Web app

## ทดสอบ
```
node test.cjs
```

## หมายเหตุ
- `build.py` สร้างไฟล์ `Config.gs`, `*GeoJSON.html`, `Dashboard.html` ฯลฯ จากโฟลเดอร์ `../flood_web` ซึ่งยังไม่ได้อยู่ใน repo นี้
- `.clasp.json` และ `.clasprc.json` ถูก ignore ไว้
