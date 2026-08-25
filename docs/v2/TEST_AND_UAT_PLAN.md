# Map Tools v2 — Test and UAT Plan

Status: implementation acceptance plan  
Date: 2026-08-25

## 1. Purpose

This plan converts the v2 product and architecture requirements into executable quality gates. Codex or any implementation agent should treat these checks as acceptance criteria, not optional follow-up work.

## 2. Test pyramid

### Unit tests

Pure logic and schema behavior:

- feature validation;
- project validation;
- migrations;
- serialization/deserialization;
- measurements;
- Thai area conversion;
- bearing;
- style normalization;
- command apply/revert behavior;
- coordinate parsing.

### Integration tests

Application state without full browser dependence:

- ProjectStore + commands;
- persistence pipeline;
- import failure preservation;
- undo/redo stack;
- group visibility/lock logic;
- search-result conversion into project feature.

### Browser/E2E tests

User-visible workflows:

- create/edit/delete objects;
- save/open round trip;
- drawing cancellation;
- selection/object panel;
- undo/redo;
- keyboard behavior;
- geocoding UI with mocked network response;
- export smoke path;
- responsive/narrow viewport smoke path.

## 3. Characterization suite for the current v1 baseline

Before major refactoring, capture the useful current behavior so architecture work does not accidentally remove functionality.

Required characterization scenarios:

### C-01 Marker lifecycle

- add marker at explicit map location;
- set label and non-default color;
- drag marker;
- edit label/color;
- delete marker.

### C-02 Marker radius rings

- add multiple radii;
- use different colors/distances;
- edit one ring;
- delete one ring;
- drag parent marker and verify rings follow.

### C-03 Shape lifecycle

For polyline, polygon, circle, and rectangle:

- create;
- display measurement;
- change color;
- edit geometry;
- delete.

### C-04 Arrow lifecycle

- create arrow;
- edit line geometry;
- verify arrow head follows final segment;
- recolor;
- delete.

### C-05 Text lifecycle

- add text;
- drag;
- edit content;
- rotate;
- delete.

### C-06 Search

- search a location using mocked provider result;
- verify result appears;
- document current behavior that it enters the project marker collection.

### C-07 Existing JSON open/save

- open representative v1 project;
- verify recoverable geometry;
- save again;
- record any known semantic loss as baseline defect, not accepted v2 behavior.

## 4. v2 persistence acceptance tests

### P-01 Round trip: marker

Create marker with:

- name;
- non-default color;
- symbol;
- two radius rings;
- group;
- hidden/unlocked state variation.

Save/open and assert semantic equality.

### P-02 Round trip: text

Create text with:

- content containing Thai and English;
- non-default size;
- rotation;
- halo;
- group.

Save/open and assert semantic equality.

### P-03 Round trip: line/polygon/rectangle/circle

For each type use non-default styles and edited geometry.

Save/open and assert semantic equality.

### P-04 Round trip: arrow

Arrow must reopen as `arrow`, not generic polyline or feature group artifact.

### P-05 Stable IDs

IDs remain unchanged after save/open. Duplicate creates a different ID.

### P-06 Map view

Center, zoom, and known basemap ID reopen correctly.

### P-07 Invalid file does not destroy project

Given an active project with unsaved data, attempt to open malformed/invalid JSON.

Expected:

- error shown;
- active document unchanged;
- dirty state unchanged;
- no partial render from failed file.

### P-08 Unknown basemap

Expected:

- project loads;
- features remain intact;
- fallback basemap is used;
- warning is non-blocking.

## 5. Security tests

### S-01 Marker label payload

Input examples should include strings resembling:

- HTML tags;
- `<script>`;
- image `onerror` attributes;
- quoted attribute-breaking payloads.

Expected: displayed literally as text; no executable node/event handler created.

### S-02 Text annotation payload

Same expectation as S-01.

### S-03 Project-file payload

Malicious strings embedded in imported project JSON must remain data.

### S-04 Invalid numeric values

Reject or normalize documented cases including NaN-equivalent/non-finite values supplied through malformed JSON-compatible structures, out-of-range latitude/longitude, negative invalid dimensions, and impossible opacity.

## 6. Search tests

### G-01 Multiple results

Mock at least three geocoding results.

Expected: user can choose; app does not auto-commit the first result.

### G-02 Transient result isolation

Search and select a result.

Expected: project feature count is unchanged until `Add to project` is activated.

### G-03 Add result to project

Expected: new stable marker feature is created from normalized result.

### G-04 Provider failure

Expected: user-facing failure state; existing project unaffected.

## 7. Object/layer manager tests

### O-01 Selection synchronization

Select object from map -> corresponding panel item selected.

Select panel item -> map selection updates and can zoom to feature.

### O-02 Visibility

Feature visibility toggle affects renderer but does not delete data.

### O-03 Group visibility

Group off hides child features while preserving each feature's own visibility value.

### O-04 Locking

Locked feature cannot be dragged or geometry-edited through the map UI.

### O-05 Group locking

Group lock prevents editing all children without overwriting child lock values.

### O-06 Rename

Rename persists through save/open.

### O-07 Duplicate

Geometry/style/properties copied; ID regenerated; copy becomes independently editable.

## 8. Undo/redo tests

At minimum test undo + redo for:

- add marker;
- delete polygon;
- move marker;
- geometry edit;
- label edit;
- style edit;
- radius edit;
- duplicate;
- group assignment;
- visibility where defined as historical command.

Additional rules:

- redo stack clears after a new command following undo;
- project open/new clears history;
- selection-only changes do not pollute history;
- one drag should normally produce one history entry.

## 9. Measurement tests

Use known fixtures with tolerances appropriate to the geodesic method selected.

Required:

- short line in metres;
- line > 1 km;
- polygon area;
- polygon perimeter;
- circle radius/area;
- bearing;
- Thai area conversion at exact boundaries: 4 m², 400 m², 1,600 m² and mixed values.

Formatting tests must be separate from calculation tests.

## 10. Accessibility/keyboard acceptance

Browser checks:

- tab reaches all primary toolbar actions;
- focus indication is visible;
- active drawing tool is identifiable without color alone;
- Escape cancels active drawing or closes appropriate topmost dialog;
- destructive dialog identifies the destructive action clearly;
- Enter activates focused primary action where semantically appropriate;
- object deletion shortcut does not fire while typing in an input/textarea;
- icon-only controls have accessible names/tooltips.

This is a minimum product gate, not a claim of full WCAG conformance.

## 11. Responsive smoke matrix

At minimum qualify:

- desktop: 1440×900;
- laptop: 1280×720;
- narrow/tablet-like: 768×1024;
- mobile smoke: 390×844.

Mobile does not need feature parity with optimized desktop editing in the first v2 core, but primary controls must remain reachable and the app must not become unusable due to overlapping fixed panels.

## 12. Performance smoke test

Synthetic project:

- 300 markers;
- 100 text labels;
- 50 polylines;
- 25 polygons;
- 25 arrows.

Total: 500 objects.

Acceptance intent:

- project opens without browser freeze;
- selection and visibility changes remain interactive;
- save completes;
- no unbounded event/listener growth after repeated open/new cycles.

Do not encode brittle millisecond thresholds until a repeatable CI/browser environment is available.

## 13. CI gates

Every pull request touching the v2 application should run:

1. dependency install from lockfile;
2. format check;
3. lint;
4. TypeScript type-check;
5. unit tests;
6. integration tests;
7. production build;
8. Playwright browser smoke suite.

A release qualification run should additionally execute the full round-trip matrix and target viewport matrix.

## 14. Manual UAT scenarios

### UAT-01 Engineering study map

Create a project containing:

- project polygon;
- two survey markers with different symbols/colors;
- one marker with 500 m and 1 km radii;
- three traffic-flow arrows;
- two labels;
- one measured polyline.

Group items into `Site`, `Survey`, and `Annotations`. Save, close/reload, reopen, edit one marker, undo the edit, redo it, and export a quick PNG.

Expected: no semantic/style loss and no confusing object-state mismatch.

### UAT-02 Failed import recovery

With an unsaved UAT-01 project open, attempt to import corrupted project JSON.

Expected: UAT-01 remains untouched.

### UAT-03 Dense project management

Load/create at least 50 objects and manage them primarily through the object panel.

Expected: rename, select, hide, lock, duplicate, and delete can be completed without hunting for each feature directly on the map.

### UAT-04 Search-to-project

Search for a place, inspect multiple results, fly to one, then explicitly add it to the project.

Expected: transient search behavior is clearly distinguishable from permanent project content.

## 15. Definition of done for v2 Core

v2 Core is not complete until:

- all P0 baseline defects addressed;
- schema round trips pass for every feature type;
- invalid imports preserve active work;
- XSS regression tests pass;
- object manager workflows pass;
- undo/redo core matrix passes;
- CI is green;
- manual UAT-01 to UAT-04 are recorded as passed or have explicit release-blocking defects.
