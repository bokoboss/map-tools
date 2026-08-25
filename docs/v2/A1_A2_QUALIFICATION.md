# A1+A2 Qualification

Date: 2026-08-25

## Commit evidence

- PR base SHA: `2a831523a507761dac35409234bb4bd30775a335`
- Workflow bootstrap SHA: `ebcd11d647f6ecaaa8adf637149447696b5bb6da`
- A1 checkpoint SHA: `b4add9a237ee4d5c5b6872924d728e9d2955bd7d`
- A1+A2 implementation checkpoint SHA: `a4da1ef3d745b69df7db3728c5bd98b4e6933fd6`
- Remediation implementation head SHA: `a344a4bbaf9b7f71c8ed57ce304c91429abb1492`

The qualification document is committed separately after the remediation implementation checkpoint so the implementation SHA remains an auditable checkpoint.

## Exact qualification commands

```text
npm ci
npm test
npm run test:browser
npm run test:all
node --check script.js
git diff --check
```

Results:

- `npm ci`: passed; 3 packages installed; 0 vulnerabilities reported.
- `npm test`: passed; 15 tests, 15 passed, 0 failed.
- `npm run test:browser`: passed; 12 Chromium tests, 12 passed, 0 failed.
- `npm run test:all`: passed; 15 Node tests and 12 Chromium tests passed.
- `node --check script.js`: passed.
- `git diff --check`: passed.

There is no production build command in this static application. CI runs `npm ci`, the Node suite, Chromium installation, and the browser suite.

## A1 behavior characterization

The remediation browser suite deterministically exercises the material C-01..C-07 workflows from `docs/v2/TEST_AND_UAT_PLAN.md`:

- C-01: marker create, drag, edit, and delete.
- C-02: multiple radius add, edit, delete, and follow-parent movement.
- C-03: polyline, polygon, rectangle, and circle create, edit, style, and delete.
- C-04: arrow creation, line edit, arrow-head movement to the final segment, and delete.
- C-05: text create, drag, edit, rotation, and delete.
- C-06: mocked deterministic geocoding results remain transient until explicit project addition.
- C-07: representative v1 open/migration/save behavior produces Project Schema v2.

The browser suite also verifies that a mixed Project Schema v2 fixture renders actual runtime layers for marker, marker radius rings, text, polyline, polygon, rectangle, circle, and arrow. It covers browser save/open round trips for marker+radii, text content+rotation, arrow, rectangle, and circle, plus malformed-import preservation of the active project and rendered state.

Geocoding requests are intercepted with deterministic test responses; the tests do not depend on public Nominatim or other external provider availability.

## A2 behavior changes

- Save emits a versioned Project Schema v2 document with stable semantic feature IDs, map view, metadata, typed geometry, styles, marker rings, text, and arrow features.
- Open parses, migrates known v1 files, validates the complete candidate, and only then replaces the active map.
- Legacy v1 markers, recoverable lines, polygons, and circles migrate with warnings for ambiguous or unsupported semantics; text/arrow semantics are not invented.
- Coordinates at the persistence boundary are canonical `[longitude, latitude]`; the Leaflet adapter explicitly converts to `[latitude, longitude]`.
- Marker and text user content is rendered as plain text/escaped text. Imported script/event-handler payloads do not execute.
- Search results are transient until the user chooses `Add to project`.
- Unknown basemaps fall back non-blockingly while preserving project features.

## Round-trip matrix

- Marker with two radius rings: passed in browser save/open round-trip and normalized serialization.
- Text with Thai/English content, rotation, and style: passed, including browser save/open round-trip.
- Polyline: passed in mixed-fixture rendering and lifecycle characterization.
- Polygon: passed in mixed-fixture rendering and lifecycle characterization.
- Rectangle: passed in browser save/open round-trip and lifecycle characterization with explicit bounds semantics.
- Circle: passed in browser save/open round-trip and lifecycle characterization with explicit center/radius semantics.
- Arrow: passed as one semantic arrow feature with its head following the final line segment.
- Stable IDs and asymmetric Bangkok coordinates: passed.

## Security fixture results

`project-v2-security-text.json` passed Node validation and browser loading. The payload is visible as literal text; no `<script>` node, `onload` handler, or `window.__MAP_TOOLS_XSS__` execution was observed.

## Invalid-import results

Malformed JSON was attempted after establishing an active mixed-feature project. The import was rejected before candidate replacement; the active document and rendered feature set remained unchanged, with no partial candidate render.

The Node suite additionally covers unsupported schema version, duplicate IDs, invalid coordinate order/range, invalid circle radius, invalid geometry, and incomplete documents.

## GitHub Actions evidence

- Run: [32846852993](https://github.com/bokoboss/map-tools/actions/runs/32846852993)
- Job: [test](https://github.com/bokoboss/map-tools/actions/runs/32846852993/job/97798433548)
- Head SHA: `a344a4bbaf9b7f71c8ed57ce304c91429abb1492`
- Status: `success`

## Known limitations

- The application remains the original static HTML/JavaScript structure; Vite/TypeScript modularization is intentionally deferred to A3.
- Group editing, undo/redo, object manager, and report composition are out of scope for A1+A2.
- The legacy migration cannot recover ambiguous v1 text/arrow semantics.
- Browser tests use CDN-hosted runtime libraries, matching the current v1 application; dependency vendoring is deferred.

## Recommendation

`READY_FOR_A3`
