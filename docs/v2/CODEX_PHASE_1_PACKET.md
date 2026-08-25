# Codex Execution Packet — Phase 1 Project Schema v2 and Safe Persistence

## Mission

Replace the fragile v1 persistence model with a versioned, validated, lossless Project Schema v2 and make user-entered/project-entered text safe by default.

Phase 1 begins only after Phase 0 qualification is green.

## Authoritative references

Read before editing:

- `docs/v2/PROJECT_SCHEMA_V2.md` — persisted semantics are normative.
- `docs/v2/ARCHITECTURE.md` — state/persistence boundaries.
- `docs/v2/TEST_AND_UAT_PLAN.md` — qualification requirements.
- `docs/v2/PRODUCT_SPEC.md` — user-facing behavior.
- `docs/v2/BASELINE_AUDIT.md` — known baseline risks.
- `docs/v2/PHASE_0_QUALIFICATION.md` — actual qualified baseline once Phase 0 is complete.

If implementation constraints conflict with the normative schema, update the planning document explicitly in the PR rather than silently changing semantics in code.

## Scope

### In scope

1. Define TypeScript/JSDoc-compatible domain/project data types as appropriate for the current Phase 0 structure.
2. Implement `schemaVersion: 2` project serialization.
3. Implement validation before active-project replacement.
4. Implement stable project/group/feature/radius IDs independent of Leaflet runtime IDs.
5. Persist and restore all supported feature semantics:
   - marker;
   - marker radius rings;
   - text including content and rotation/style;
   - polyline;
   - polygon;
   - rectangle;
   - circle;
   - arrow as a semantic arrow, not a persisted feature-group artifact.
6. Persist project metadata and map view required by the schema.
7. Implement v1 legacy project import/migration for recoverable content.
8. Make user/project strings safe text by default.
9. Add unit/integration/browser tests for the full persistence/security matrix.
10. Preserve current user workflow unless a change is necessary to make project loading safe and explicit.

### Out of scope

Do not:

- perform the full Vite + TypeScript modular architecture migration unless Phase 0 already introduced part of it and the change is genuinely required;
- replace the drawing library;
- add layer/object manager;
- add undo/redo;
- redesign the main workspace;
- add engineering symbols or buffer tools;
- add report composer;
- add cloud storage/backend.

## Core design rule

Leaflet runtime objects must not be the persisted data contract.

The save pipeline serializes application/domain data into Project Schema v2. The load pipeline validates/migrates data first, then reconstructs Leaflet rendering from the normalized project document.

A failed load must not call destructive reset/clear operations on the active project.

## Required project-load pipeline

Implement behavior equivalent to:

1. read selected file as text;
2. parse JSON in isolation;
3. detect v2 vs supported legacy v1;
4. validate envelope and feature data;
5. migrate legacy data where possible;
6. normalize the result;
7. construct/verify a temporary project document;
8. only after all prior steps succeed, replace active project;
9. render restored features;
10. restore/fallback map view/basemap;
11. report recoverable warnings separately from hard errors.

## Stable IDs

Requirements:

- no persisted use of Leaflet `stamp()` values;
- save/open preserves IDs;
- duplicate-like migration-created objects receive generated IDs;
- radius rings receive their own stable IDs;
- IDs are validated as non-empty strings and generated via a collision-resistant mechanism.

## Feature reconstruction requirements

### Marker

Restore location, label/name, color/symbol, all radius rings, group/visibility/lock fields available in the v2 model.

### Text

Restore as semantic text annotation, not a generic marker.

Text is plain text. Rotation/style must survive round trip.

### Arrow

Persist as semantic line geometry plus arrow style. Re-render any arrowhead marker from geometry at runtime.

Do not serialize separate Leaflet marker/feature-group implementation detail.

### Rectangle

Preserve rectangle type rather than silently changing to generic polygon semantics.

### Circle

Preserve center + radius semantics rather than relying on generic GeoJSON point behavior.

## v1 migration/import behavior

Recognize the existing top-level `markers` + `drawnShapes` structure.

Recover:

- marker positions/labels/colors/radii;
- generic polylines/polygons/circles/rectangles where identifiable;
- known styles and radius values stored by v1.

Important:

- do not invent lost text/arrow semantics where the legacy file does not contain enough information;
- if recoverable content must be downgraded to a generic type, make that explicit in warnings/qualification fixtures;
- migration must not fail the whole file merely because an optional basemap/view field is absent.

## Security requirements

Replace unsafe user-string HTML interpolation paths.

Preferred rules:

- use DOM construction + `textContent` for marker labels/text annotations;
- avoid `innerHTML` where user/project strings participate;
- if a library API requires HTML, construct trusted structural markup separately and insert user text through text nodes or explicit escaping;
- add regression payloads for tags, script-like strings, event attributes, quotes, ampersands, Thai text, and mixed Unicode.

The expected UI behavior is literal display of the entered text, not execution or markup interpretation.

## Validation requirements

Reject the candidate file before mutation for hard errors including:

- invalid JSON;
- unsupported schema version with no migration;
- missing required feature discriminator/geometry;
- invalid coordinate structure;
- out-of-range lat/lon;
- invalid radius/opacity/rotation numeric data where the schema defines bounds;
- duplicate IDs if they would make selection/render mapping ambiguous;
- impossible feature-type/property combinations.

Recoverable warning examples:

- unknown basemap ID;
- optional unsupported future metadata that can be safely ignored;
- legacy information that cannot be reconstructed exactly but can be preserved as a clearly identified generic geometry.

## Required test matrix

Implement all persistence/security tests P-01 through P-08 and S-01 through S-04 from `TEST_AND_UAT_PLAN.md`.

Additionally test:

1. two consecutive save/open cycles;
2. stable IDs after each cycle;
3. non-default styles for every feature type;
4. Thai/English mixed labels;
5. arrow geometry edit after reopen;
6. text rotation edit after reopen;
7. marker-radius parent drag after reopen;
8. current project preservation after malformed file;
9. current project preservation after valid JSON with invalid schema;
10. unknown basemap fallback.

## Deterministic equality

Define a normalized comparison function/fixture for project documents.

Round-trip equality may ignore only explicitly documented volatile fields such as `updatedAt` if save intentionally changes it.

Do not compare serialized JSON byte-for-byte if stable semantic comparison is more appropriate, but serialized output should remain reasonably deterministic to aid review/version control.

## UX/error behavior

Project-open errors must be actionable but concise.

At minimum distinguish:

- cannot parse JSON;
- unsupported project version;
- project validation failed;
- project loaded with warnings.

Do not replace useful console diagnostics with only a generic alert. Keep developer detail available while showing a user-safe message.

## Required outputs

- Project Schema v2 implementation;
- validation layer;
- v1 migration/import layer;
- stable ID support;
- safe text rendering changes;
- persistence/security tests;
- representative v2 fixture containing every feature type;
- representative legacy v1 fixture(s);
- `docs/v2/PHASE_1_QUALIFICATION.md` containing:
  - branch/commit;
  - migration behavior;
  - exact test commands/results;
  - known limitations/warnings;
  - whether Phase 2 architecture migration is safe to start.

## Acceptance criteria

Phase 1 is complete only when:

- every supported v2 feature survives two save/open cycles;
- marker radii survive and remain attached to their marker;
- text remains text with rotation/content intact;
- arrow remains arrow with runtime arrowhead correctly reconstructed;
- rectangle/circle semantics survive;
- IDs remain stable;
- malformed/invalid files do not alter current work;
- unsafe label payloads are rendered literally;
- v1 recoverable content migration is covered by fixtures/tests;
- Phase 0 characterization remains green except where an intentional persistence/security behavior change is documented;
- CI is green.

## Review checklist

Before PR handoff:

- inspect diff for accidental broad architecture rewrite;
- inspect saved v2 JSON manually;
- run the entire round-trip matrix twice;
- run malicious-text regression tests;
- verify legacy fixture migration;
- verify current project remains after failed import;
- verify no persisted Leaflet IDs/classes/feature-group implementation data;
- run production build/browser smoke;
- run `git diff --check`.

## Stop/escalate conditions

Stop and report if:

- a legacy v1 semantic type cannot be reconstructed from available data;
- current drawing structures make lossless v2 runtime reconstruction impossible without a bounded adapter/refactor;
- a schema decision in the normative document proves internally inconsistent;
- a proposed fix would require pulling the full Phase 2 architecture into this PR.

In those cases, propose the smallest explicit planning amendment rather than improvising a hidden behavior change.
