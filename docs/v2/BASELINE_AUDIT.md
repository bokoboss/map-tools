# Map Tools v2 — Baseline Audit

Status: planning baseline  
Baseline branch: `main`  
Baseline commit: `5f4823534c80fd7a2b53d4b55ff76d18975521d2`  
Audit date: 2026-08-25

## 1. Current product

Map Tools is a client-side Leaflet application for lightweight geospatial annotation. The current repository contains four top-level files: `index.html`, `script.js`, `style.css`, and `README.md`. No package manager, build system, automated test suite, CI workflow, or dependency lockfile is present.

Current capabilities include:

- multiple basemaps;
- location search and reverse geocoding;
- markers with labels and multiple radius rings;
- polyline, polygon, circle, and rectangle drawing;
- arrow and text annotations;
- automatic distance and area display;
- Thai land-area units;
- context-menu editing;
- JSON save/open;
- PNG viewport export.

The concept is strong enough to retain. The recommended direction is evolutionary hardening, not a ground-up product rewrite.

## 2. Main architectural findings

### A-01 — Leaflet objects are acting as the canonical data model

Application state is spread across Leaflet instances and ad-hoc properties such as `labelText`, `markerColor`, `radii`, `isArrow`, `isTextLabel`, and `rotation`.

Risk:

- persistence behavior depends on Leaflet serialization details;
- undo/redo is difficult;
- object lists/layer management are difficult to implement cleanly;
- validation and schema migration are unavailable;
- renderer state and business state cannot be tested independently.

Recommendation: introduce a versioned project-domain model. Leaflet becomes an editor/renderer of that model rather than the source of truth.

### A-02 — `script.js` is a monolith

Map initialization, state, DOM lookup, modal logic, drawing, geometry formatting, persistence, search, export, context menus, and color management are located in one JavaScript file.

Risk: unrelated changes have a large regression surface and feature work will increasingly depend on implicit global state.

Recommendation: migrate to Vite + TypeScript and split by domain after persistence behavior is characterized and protected by tests.

### A-03 — UI markup is concentrated in one large HTML document

Most controls and modals are hard-coded in `index.html`, while event binding is performed manually from `script.js`.

Recommendation: do not perform a framework rewrite solely to address this. First modularize state and services. UI composition can remain DOM-based until there is a demonstrated need for React or another component framework.

## 3. Persistence findings

### P-01 — Special feature semantics are not represented explicitly in the saved schema

`drawnItems.toGeoJSON()` is used as the main serialization path. Style and radius metadata are patched into resulting features, but custom application concepts such as text annotations and arrows have additional runtime-only semantics.

Text annotations use a Leaflet marker with custom fields including `isTextLabel`, `labelText`, and `rotation`. Arrows use a feature group containing a line and a separate arrow-head marker and carry `isArrow` at runtime.

The current load path reconstructs generic GeoJSON layers and does not provide an explicit type-aware reconstruction path for these concepts.

Impact: save → close → reopen is not guaranteed to reproduce the original project faithfully for all feature types.

Priority: P0.

### P-02 — Project format is unversioned

No `schemaVersion` is present.

Impact: future migrations cannot distinguish old project structures from new structures reliably.

Priority: P0 for v2 planning.

### P-03 — Map view and project metadata are not persisted

The current project file focuses on markers and drawn geometry. Project name, author/source notes, created/updated timestamps, active basemap, map center, zoom, visibility/lock state, and grouping are not represented.

Priority: P1.

## 4. Security and robustness findings

### S-01 — User-entered labels are interpolated into HTML

Marker popup and text-annotation rendering interpolate stored text into HTML strings.

Impact: crafted project data or unsafe user input can become a DOM injection/XSS vector.

Required remediation:

- use DOM `textContent` for plain text;
- if rich text is later required, sanitize through an explicit allow-list;
- add regression tests with HTML/script payloads.

Priority: P0.

### S-02 — Project-file validation is minimal

The open-project flow parses arbitrary JSON and then assumes expected shapes.

Required remediation:

- validate schema before mutating the current project;
- reject unsupported or malformed files with actionable messages;
- load into a temporary model first, then commit only after validation succeeds;
- preserve the existing project if import fails.

Priority: P0.

### S-03 — Runtime dependencies are loaded from CDNs

The current application loads Tailwind Play CDN and several JavaScript libraries directly from third-party CDNs.

Impact:

- builds are not reproducible;
- dependency versions are not centrally locked;
- offline/local behavior depends on network availability;
- supply-chain review is harder.

Recommendation: npm-managed dependencies and a lockfile under the Vite build.

Priority: P1.

## 5. UX/workflow findings from source behavior

### U-01 — Search result becomes a project marker

The search flow creates the selected result through the same marker creation function used for project annotations.

Impact: a temporary search aid can become persisted project content unintentionally.

Recommendation: maintain a separate transient search-result layer. Provide an explicit `Add to project` action.

Priority: P1.

### U-02 — Object management does not scale

Editing is primarily object-local through popups, modal dialogs, double-click, and right-click context menus.

This is acceptable for a few objects but becomes inefficient when a study contains many annotations.

Recommendation: add an object/layer panel with selection, rename, visibility, lock, duplicate, delete, group, and reorder functions.

Priority: P1.

### U-03 — No undo/redo

Drawing and editing are destructive once committed.

Recommendation: command/history model after canonical project state exists.

Priority: P1.

### U-04 — Export is a viewport screenshot, not a report map

Current PNG export captures the map viewport using `html2canvas`.

Recommendation: retain quick PNG capture, then add a report composer with paper size, orientation, title, legend, north arrow, scale bar, source attribution, and high-resolution output.

Priority: P2.

## 6. Engineering-domain opportunity

The strongest product positioning is not general-purpose GIS. Map Tools should become a fast engineering study-map and annotation workspace for traffic, transportation, infrastructure, site planning, and technical reports.

High-value domain features:

- traffic survey point symbols;
- intersection and access symbols;
- directional arrows and movement annotations;
- project boundary and study-area buffers;
- line/polygon measurements and bearing;
- coordinate tools suitable for Thailand;
- engineering style presets (`Existing`, `Proposed`, `Alternative`, `Survey`, `Constraint`, `Mitigation`);
- report-map export.

## 7. Test gaps

No automated tests are currently present. Before refactoring, add characterization coverage for:

1. marker create/edit/delete;
2. radius create/edit/delete and marker drag;
3. polyline/polygon/circle/rectangle create/edit/delete;
4. text and arrow lifecycle;
5. save/open round trips for every feature type;
6. malformed project rejection;
7. XSS-safe labels;
8. search result isolation;
9. measurement calculations;
10. export smoke path.

Browser-level tests should also cover the primary desktop workflow and at least one narrow/mobile viewport.

## 8. Recommended sequence

1. Establish characterization tests around current behavior.
2. Define Project Schema v2 and migration rules.
3. Implement safe, validated, lossless serialization.
4. Introduce Vite + TypeScript and modular boundaries without changing product behavior.
5. Add object/layer manager and undo/redo.
6. Add engineering-domain tools.
7. Build report-quality export.
8. Add broader geospatial interoperability.

## 9. Explicit non-goals for the next development cycle

Do not add these until the v2 core is stable:

- backend accounts or cloud persistence;
- real-time collaboration;
- 3D;
- full GIS geoprocessing;
- CAD authoring;
- Leaflet 2 migration;
- framework rewrite for its own sake.

## 10. Baseline acceptance statement

The existing implementation is suitable as a v1 prototype/reference behavior set, but it is not yet a reliable foundation for sustained feature expansion. The v2 effort should preserve the useful interaction model while separating domain state from Leaflet runtime state and making project round trips deterministic and testable.
