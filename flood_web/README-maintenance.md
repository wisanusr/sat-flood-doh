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
