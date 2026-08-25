# A1+A2 Qualification

Date: 2026-08-25

## Commit evidence

- Base SHA: `e8cf5a6870f1548c14f26010f2a4cbd1699e715d`
- Workflow bootstrap SHA: `ebcd11d647f6ecaaa8adf637149447696b5bb6da`
- Stage 1 checkpoint SHA: `b4add9a237ee4d5c5b6872924d728e9d2955bd7d`
- Final implementation head SHA: `a4da1ef3d745b69df7db3728c5bd98b4e6933fd6`

The qualification document is committed separately after the implementation head so the implementation SHA above remains an auditable checkpoint.

## Exact qualification commands

```text
npm ci
npm run test:all
node --check script.js
git diff --check
```

Results:

- `npm ci`: passed; 3 packages installed; 0 vulnerabilities reported.
- `npm test`: passed; 15 tests, 15 passed, 0 failed.
- `npm run test:browser`: passed; 3 Chromium tests, 3 passed, 0 failed.
- `node --check script.js`: passed.
- `git diff --check`: passed.

There is no production build command in this static application. CI is configured in `.github/workflows/ci.yml` to run `npm ci`, the Node suite, Chromium installation, and browser smoke tests. No remote CI run link is available from this local execution.

## Stage 1 characterization results

The checkpoint suite recorded 14 Node tests and 1 browser smoke test passing. It covered marker lifecycle, multiple radius rings, polyline/polygon/circle/rectangle, arrow, text/rotation, search provider wiring, legacy save/open entry points, and the existing application shell.

## A2 behavior changes

- Save now emits a versioned Project Schema v2 document with stable semantic feature IDs, map view, metadata, typed geometry, styles, marker rings, text, and arrow features.
- Open parses, migrates known v1 files, validates the complete candidate, and only then replaces the active map.
- Legacy v1 markers, recoverable lines, polygons, and circles migrate with warnings for ambiguous or unsupported semantics; text/arrow semantics are not invented.
- Coordinates at the persistence boundary are canonical `[longitude, latitude]`; the Leaflet adapter explicitly converts to `[latitude, longitude]`.
- Marker and text user content is rendered as plain text/escaped text. Imported script/event-handler payloads do not execute.
- Search results are transient until the user chooses `Add to project`.
- Unknown basemaps fall back non-blockingly while preserving project features.

## Round-trip matrix

- Marker with two radius rings: passed in mixed fixture validation and two-cycle normalized serialization.
- Text with Thai/English content, rotation, and style: passed, including an edit between the two save/open cycles.
- Polyline: passed.
- Polygon: passed.
- Rectangle: passed with explicit bounds semantics.
- Circle: passed with explicit center/radius semantics.
- Arrow: passed as one semantic arrow feature, not a persisted arrowhead marker/group artifact.
- Stable IDs and asymmetric Bangkok coordinates: passed.

## Security fixture results

`project-v2-security-text.json` passed Node validation and browser loading. The payload is visible as literal text; no `<script>` node, `onload` handler, or `window.__MAP_TOOLS_XSS__` execution was observed.

## Invalid-import results

Passed cases include malformed JSON, unsupported schema version, duplicate IDs, invalid coordinate order/range, invalid circle radius, invalid geometry, and incomplete documents. Candidate validation occurs before `clearMap()`, and the active document remains unchanged when deserialization fails.

## Browser smoke results

Chromium passed the desktop shell smoke, security fixture rendering, and mixed v2 semantic-fixture rendering with no page errors.

## CI status

Workflow file added and locally mirrored by the commands above. Remote CI has not been run from this workspace; there is no run URL to report.

## Known limitations

- The application remains the original static HTML/JavaScript structure; Vite/TypeScript modularization is intentionally deferred to A3.
- Group editing, undo/redo, object manager, and report composition are out of scope for A1+A2.
- The legacy migration cannot recover ambiguous v1 text/arrow semantics.
- Browser smoke uses CDN-hosted runtime libraries, matching the current v1 application; dependency vendoring is deferred.

## Recommendation

`READY_FOR_A3`
