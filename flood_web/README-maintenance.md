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

## Waterlogging tab ("น้ำขัง")

`waterlogged-view.js` draws the tab from `DATA.floodWaterlogged` / `DATA.floodWaterloggedDistrict` (sheet tabs `flood_waterlogged`, 21 columns, one row per tambon, and `flood_waterlogged_district`, 16 columns incl. `basis`, written by the waterlogging pipeline in `geeks_project_google`). Read-only. Both tabs are optional like the flood-prep ones: `fetch_data.cjs` retries once, then skips a tab it cannot read, the tab shows "ยังไม่มีข้อมูลรอบนี้" and the rest of the dashboard is unaffected. `server.py` reads them by tab name (gviz, `SHEETS[name] = None`) because no gid was given.

- District rows with `basis` = `ปภ. (ไม่มีภาพดาวเทียม)` (no satellite water in the province, DDPM reports the district >= 3 days) have no tambons and blank (null) count/area columns: shown as "–", never 0, sorted last with a badge, a basis filter, a separate card, and a note on click instead of a tambon filter. Thresholds (area, image age, DDPM days) live in the pipeline and are not hard-coded in the page.
- `status` has 5 values (no separate pending status): `น้ำขัง` is one label for every tambon and the evidence level is `confidence` (สูง = "ยืนยันด้วยภาพ", กลาง = "ตาม ปภ."). The card shows the split under the number, the table sorts สูง before กลาง and shows a small badge, the map draws กลาง with a dashed outline in the same colour (`waterConfidence` / `waterIsDashed` in `data-model.js`).
- Province colours (2P2R): sheet tab `flood_2p2r_province` (14 columns, one row per province, optional) -> `DATA.flood2p2r`. `level_code` (red/orange/yellow/green/normal) decides the fill (`WATER_2P2R` in `data-model.js`; the page never recomputes a level). Polygons are joined by `province_code` = `pro_code` of `thai_provinces.json`; one shared canvas renderer draws polygons first and tambon points on top so both stay clickable. Clicking a province sets the province filter (tables, districts) and shows the level / phase / plan / counts / reasons with the red and green caveats; an empty or unreadable tab hides the layer with a notice. Provinces missing from the GeoJSON are listed under the legend.
- Layout follows the national tab so the pages feel the same: heading + report date, `.data-age` bar, `.filters` bar (labelled fields, clear / refresh buttons), `.cards`, `.grid` (map panel with status toggle cards, shared map footer with expand + layers popover, `map-source` line | right panel: provinces by 2P2R level, or the selected province / tambon), a `.situation` summary box with a copy button, then `.section-title` + `.panel` tables. New UI should reuse these classes rather than add tab-specific ones.
- Every sheet value is text; empty stays `null` (never 0). Status, confidence and reasons are the pipeline's: the page never recomputes a status. Pure logic (status groups, counts, order, filters, freshness) lives in `data-model.js` (`water*` functions, tested in `test_model.cjs`).
- The tables use `window.DashboardTables` (exposed by `dashboard.js`): `table()`, paging and column filters, ids `waterTable` / `waterDistrictTable`. Tab buttons of external panes carry `data-external`, which keeps the core tab click handler off them.
- Map: Leaflet with the canvas renderer (hundreds to thousands of points); tambons without coordinates stay in the list only.
- New columns: update `REQUIRED`/`NUMERIC`/`DATES` and `transform()` in `server.py`, `transform_` in `Code.gs`, run `python build.py`, then the tests (`node test.cjs`, `node flood_web/test_model.cjs`, `node flood_web/test_live.cjs`, `python flood_web/test_server.py`).

## Flood-prep tab

`risk-view.js` draws the "เตรียมรับน้ำท่วม" tab from `DATA.floodRisk` / `DATA.floodCritical` (sheet tabs `flood_risk`, `flood_wl_critical`, written by the flood-prep pipeline). Both tabs are optional (`OPTIONAL` in `server.py`): they are listed in `Config.gs` as `optional`, `fetch_data.cjs` skips them when unreadable and the tab shows a notice. They are kept in `DashboardModel.RISK_SOURCES`, not `SOURCES`, so core retry banners, the footer and the refresh button never mention them. Pure rules (`riskRows`, `riskSummary`, `waterTrend`, `overbankM`, `riskFreshness`, `parseBool`) live in `data-model.js` and are covered by `node flood_web/test_model.cjs`. Browser acceptance for this tab: filters, province select + show-all, tab switching with news (modes must not stack), failure/empty/stale notices, 375 px width, zero console errors.
