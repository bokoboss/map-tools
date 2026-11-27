# Project Profile

## Identity
- Project name: Map Tools
- Repository URL: https://github.com/bokoboss/map-tools
- Live app: https://bokoboss.github.io/map-tools/ (GitHub Pages, branch `main`, root)
- Authoritative local path: `C:\MyRD\map-tools`
- Primary branch: `main`
- Product: pin + multi-radius map tool for traffic-count station plans (TMC / MB / UT / PC / OD), with drawing, report export and data exchange

## History and current baseline
- 2025-07: original Gemini-built single-file Leaflet tool (commit `5f48235`).
- 2026-08: v2 rewrite (Vite / TypeScript / Project Schema v2) reached B4 2D acceptance but was never deployed; C4.1 3D Preview was next. v2 is paused and archived on branch `archive/v2-vite` (head `e578c46`), including its docs, tests and fixtures.
- 2026-11-27: the original tool was restored and extended (PRs #19–#23), then made the main app at the repository root. `/classic/` redirects to the root.
- Accepted runtime: the static app at the root (`index.html`, `script.js`, `style.css`).

## Technology stack
- Static HTML/CSS/JavaScript, no build step; libraries pinned from CDNs
- Map: Leaflet 1.9.4 + Leaflet.draw 1.0.4 (the only drawing/editing engine)
- Optional vector basemaps: maplibre-gl 5.24.1 + @maplibre/maplibre-gl-leaflet 0.1.4, OpenFreeMap styles, loaded only when chosen
- Styling: Tailwind Play CDN + `style.css`; Sarabun font (Google Fonts, loaded with `crossorigin="anonymous"` so exports can embed it)
- Export: modern-screenshot 4.7.0 for paper-size PNG; html2canvas 1.4.1 for screen export and as fallback
- Colour picker: iro.js 5
- Tests: Playwright (Chromium) scripts in `tests/e2e/`, Node 22

## Standard commands
### Local run
```text
python -m http.server 8000
```
Then open http://localhost:8000/

### Full validation
```text
cd tests/e2e
npm install
npx playwright install chromium
npm test
```
`npm test` serves the repository root on 127.0.0.1:8765 and runs suites `01`–`05` in order.

## Architecture / invariants
- One page, one script. State lives in Leaflet layers (`markers`, `drawnItems`); `serializeProject()` / `loadProject()` are the only save/load path (also used by autosave and undo/redo).
- Project file format v2: `markers[]` (labelText, markerColor, pointType, code, latlng, radii) and `shapes[]` (text, arrow, circle, geojson). `drawnShapes` GeoJSON is also written for GIS use. Files from the original tool (no `shapes`) must still open, with arrows re-paired.
- Survey point types and code prefixes live in `SURVEY_TYPES`; both TMC types share numbering.
- All user, file, geocoder and CSV text is escaped before it reaches HTML.
- Autosave key `map-tools-classic:autosave` in localStorage (same origin as before the move, so existing autosaves carry over).
- Undo/redo uses whole-project snapshots (100 steps, in memory only).
- Paper export resizes the map container onto the on-screen frame, captures, then restores the exact view (`setView … reset: true`).
- Vector basemaps need `preserveDrawingBuffer`; paper export temporarily raises the MapLibre pixel ratio and restores it.

## Protected behavior
- Pins with multiple radius rings, colours, drag, labels; drawing tools (line, polygon, rectangle, circle, arrow, text with rotation); search; measurements.
- Save/open round trip of every feature type, plus opening original-format files.
- Survey types, auto codes, legend (included in exports), CSV export/import round trip, KML export.
- Quick pin mode, optional names, undo/redo, autosave restore.
- Screen export ("ตามหน้าจอ") behaves as the original export.

## Important paths
- App: `index.html`, `script.js`, `style.css`
- Old-link redirect: `classic/index.html`
- User guide (Thai): `docs/APP_GUIDE.md`
- Browser tests: `tests/e2e/` (`run.mjs`, suites `01`–`05`, `fixtures/`)
- Engineering workflow docs: `docs/development/`
- v2 source and docs: branch `archive/v2-vite`

## Validation matrix
| Gate | Command / Method | Required |
|---|---|---|
| Syntax | `node --check script.js` | Yes |
| Browser suites | `cd tests/e2e && npm test` | Yes |
| Exported image review | open a paper-size PNG and check icons, labels, legend | For export changes |
| CI | `.github/workflows/ci.yml` | Yes |
| Diff hygiene | `git diff --check` | Yes |

## Git / release policy
- Bounded feature branches (`feat/…`, `fix/…`, `chore/…`), one objective per PR, merged by the owner.
- Merging to `main` deploys to GitHub Pages directly.

## Current known limitations / risks
- Depends on external CDNs, tile providers, OpenFreeMap and Nominatim; tests also need network access.
- Raster basemaps are upscaled in high-DPI exports; vector basemaps stay sharp.
- Vector basemaps need WebGL.
- Undo history is lost on reload.
- Not yet checked on a real device beyond automated Chromium runs.
