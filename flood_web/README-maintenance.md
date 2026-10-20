# Flood dashboard maintenance

Source: `template.html` (markup), `dashboard.css` (layout), `dashboard.js` (UI and maps), `data-model.js` (pure data rules). The local server serves `template.html` directly (there is no generated `index.html`). From the repository root, `python build.py` turns these sources into the Apps Script files (`Index.html`, `Dashboard.html`, ...); never edit those generated files directly.

Run `python flood_web/server.py` for localhost:8765. The server reads the existing five Google Sheets CSV exports, independently validates each source, and does not use Excel or historical snapshots as a fallback.

`GET /api/data` returns the existing data arrays plus `sourceStatus` keyed by sheet name. A status is `{status: "ok"|"error", loadedAt: string|null, message: string|null}`. HTTP 200 means at least one successful source; HTTP 503 means all requested sources failed. A successfully read empty sheet remains `ok`. `GET /api/data?source=shelter_DB` retries one source; invalid source names return HTTP 400. Clients replace only the requested array and status after a retry.

## Checks

- `python flood_web/test_server.py`: normalization, source isolation, all-source failure and selective retry.
- `node flood_web/test_model.cjs`: pure data rules (freshness, totals, district severity, coordinates).
- `python flood_web/fixture_server.py`: optional local-only UI fixtures on port 8767. Open `/?scenario=partial`, `allfailed`, `empty`, or `stale`. The retry button returns a recovered source. This server is never used on port 8765 or exposed through the tunnel.
- Browser acceptance: both tabs at 360/393/768/1024/1440 px, filters, pagination, layer toggles, district and shelter fit buttons, full-screen map, and zero console errors. Test a real Sheets load separately; live row counts are not fixed expectations.

Freshness uses the station observation time, or for shelters the time the data was fetched (`fetched_at_th`; `updated_at_source` only says when a shelter last changed), against that source's load time. Fetch time is never substituted for a missing station observation time. Fresh range is inclusive 0–24 hours. Future and unknown times are excluded from fresh severity aggregation. Report date filters DDPM only; population remains a planning baseline, not an affected-person count.

The public server permits only the explicit application assets, not tests, scripts, logs or backups. Original files were backed up outside the served directory under `%LOCALAPPDATA%/FloodDashboard/backups/20261004-204245`.

## Flood-prep tab

`risk-view.js` draws the "เตรียมรับน้ำท่วม" tab from `DATA.floodRisk` / `DATA.floodCritical` (sheet tabs `flood_risk`, `flood_wl_critical`, written by the flood-prep pipeline). Both tabs are optional (`OPTIONAL` in `server.py`): they are listed in `Config.gs` as `optional`, `fetch_data.cjs` skips them when unreadable and the tab shows a notice. They are kept in `DashboardModel.RISK_SOURCES`, not `SOURCES`, so core retry banners, the footer and the refresh button never mention them. Pure rules (`riskRows`, `riskSummary`, `waterTrend`, `overbankM`, `riskFreshness`, `parseBool`) live in `data-model.js` and are covered by `node flood_web/test_model.cjs`. Browser acceptance for this tab: filters, province select + show-all, tab switching with news (modes must not stack), failure/empty/stale notices, 375 px width, zero console errors.

## Executive report tab

`executive-view.js` draws the "รายงานผู้บริหาร" tab (GitHub Pages build only, like the news and DOH tabs): a one-page poster that the "บันทึกภาพส่งไลน์" button saves as a 1179×2200 PNG for executives on LINE: iPhone 15 width but shorter than its screen, so a full-width view leaves the Dynamic Island, home bar and rounded corners outside the image. It reads its tabs straight from the sheet's CSV export, independently of the dashboard's data load: `Disaster_DB` and `Vulnerable_group` are required (without them the tab shows a notice); `flood_waterlogged_amphoe` (2P2R province level) and `tmd_rain_level`, `tmd_outlook_card`, `tmd_risk_outlook` (TMD pipeline, see geeks_project_google `docs/tmd_data_dictionary.md`) are optional and their poster sections show "ไม่มีข้อมูล" when unreadable. The health-region select (also `?region=4` in the URL) limits cards, maps and the 2P2R list; the TMD text stays national. Pure rules (`execDdpm`, `execProvinceLevels`, `execProvinceList`, `execByRegion`, `execRainDays`, `execReportDay`, `EXEC_P2R`, `EXEC_RAIN`) are in `data-model.js` and covered by `node flood_web/test_model.cjs`. The header logo is `flood_web/doh_logo_w.svg` (copied to `docs/` by `build_pages.py`); the QR code (moph.link/sat-doh) and the PNG export load `qrcode-generator` and `modern-screenshot` from jsDelivr. Poster classes are `x-`-prefixed so the dashboard's own `.card`/`.panel` rules stay out of the saved image. Browser acceptance: whole country and a region, switching to and from every other tab, the saved PNG's size and QR, 375 px width without horizontal scroll, zero console errors.
