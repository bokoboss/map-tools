# CODEX C4.1 Packet — MapLibre 3D Preview Foundation

Status: authoritative execution packet  
Date: 2026-08-27

## 0. Required baseline

Execution starts only from the planning head named in issue #17.

Accepted runtime underneath planning:
- B4 squash merge: `95e9928facd84d7e2e44b88f6680358c6af0da5e`.

Do not implement from an older B/A/B4 branch.

## 1. Mandatory reading

Before code:
1. AGENTS.md
2. PROJECT_PROFILE.md
3. docs/development/ENGINEERING_WORKFLOW.md
4. docs/v2/C4_1_3D_PREVIEW_SPEC.md
5. docs/v2/C4_1_RENDERER_ARCHITECTURE.md
6. docs/v2/C4_1_FEATURE_RENDERING_MATRIX.md
7. docs/v2/B4_2D_PRODUCT_ACCEPTANCE.md
8. docs/v2/B4_QUALIFICATION.md
9. docs/v2/B_WORKSPACE_ARCHITECTURE_CONTRACT.md
10. docs/v2/DOMAIN_MODEL_CONTRACT.md
11. docs/v2/PROJECT_SCHEMA_V2.md
12. docs/v2/ARCHITECTURE.md
13. docs/v2/DECISIONS.md
14. docs/v2/TEST_AND_UAT_PLAN.md

Reference only:
- https://maplibre.org/maplibre-gl-js/docs/
- https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/
- https://openfreemap.org/quick_start/
- https://github.com/naiiytom/tha-metro-mini-3d

Do not copy non-trivial reference implementation code without preserving its license notice.

## 2. Primary objective

Implement an optional **3D Preview** mode backed by MapLibre GL JS while preserving the qualified 2D product.

The same ProjectStore / ProjectDocumentV2 is rendered in either:
- Leaflet 2D;
- MapLibre 3D Preview.

3D is read-only for geometry.

## 3. Dependency

Add exactly:
- `maplibre-gl@6.6.0`

Commit package-lock changes.

Do NOT add:
- Three.js;
- React;
- Zustand;
- Terra Draw;
- Mapbox GL Draw;
- another state framework.

## 4. C4.1A checkpoint — renderer/mode foundation

Implement first:

### Renderer capability contract
Add renderer-neutral capabilities:
- mode;
- drawing;
- geometryEditing;
- featureDragging;
- basemapSwitching;
- pitchBearing;
- contextRequests.

No UI may use `instanceof LeafletRenderer` to decide product behavior.

### Camera presentation
Add renderer-neutral transient pitch/bearing presentation.
Do not modify ProjectDocumentV2 MapView.

### Mode state/controller
Create transient mode state:
- 2d / 3d-preview;
- 3D pitch/bearing;
- preview extrusion map keyed by stable FeatureId.

No serialization/history/dirty.

### MapLibrePreviewRenderer skeleton
- npm MapLibre import + CSS;
- production style configuration;
- MapRenderer implementation;
- correct destroy lifecycle;
- common center/zoom;
- pitch/bearing;
- selection/context events;
- renderer capabilities;
- safe failure path.

### Drawing behavior
When 3D active:
- disable geometry drawing/editing;
- use a DisabledDrawingAdapter if needed;
- no LeafletDrawAdapter may survive bound to a destroyed Leaflet renderer.

### Mode switch
2D → 3D → 2D:
- same canonical project object/store;
- same stable selection;
- no serialize/deserialize;
- center/zoom retained;
- 2D basemapId retained;
- pitch/bearing transient.

### C4.1A tests
At minimum:
- architecture import boundaries;
- RendererHost replacement listener behavior;
- mode state not persisted;
- project fingerprint unchanged by mode/pitch/bearing;
- 2D basemap ID preserved through 3D;
- simulated MapLibre init failure returns safely to 2D.

Before C4.1B:
- run relevant gates;
- create `docs/v2/C4_1A_RENDERER_CHECKPOINT.md`;
- commit C4.1A separately;
- clean working tree.

Do not begin C4.1B without the checkpoint.

## 5. C4.1B — project rendering + product UX

Implement the rendering matrix exactly from:
- `C4_1_FEATURE_RENDERING_MATRIX.md`.

### Project overlay
Create pure project → renderer GeoJSON conversion.

Render:
- marker;
- radius rings;
- text;
- polyline;
- polygon;
- rectangle;
- circle;
- arrow.

### Required conversions
- canonical [lon,lat];
- polygon renderer closure only;
- rectangle bounds → polygon;
- geodesic circle/radius polygon;
- arrow endpoint bearing.

### Text safety
Thai/English/user text must render literally.
Prefer DOM MapLibre Marker textContent for C4.1.

### Buildings
Production:
- OpenFreeMap Bright;
- OpenFreeMap planet vector source;
- building fill extrusion from `building` source layer;
- use render_height/render_min_height;
- keep attribution.

Automated CI must not depend on public OpenFreeMap availability.

### Preview extrusion
For selected polygon/rectangle:
- toggle;
- height metres;
- default 20 m;
- preview only disclosure;
- transient state;
- no dirty/history/serialization;
- in-session survival across renderer switching;
- absent after save/reopen/new browser session.

### Selection
- map click → stable ID → Objects/Inspector;
- workspace select → 3D highlight/focus;
- renderer switch preserves valid selection.

### Context
Reuse B4 MapContextRequest.

- background right-click coordinates/reverse geocode;
- feature right-click selects stable ID;
- lock policy preserved;
- geometry edit in 3D explicitly disabled / requires 2D;
- no silent no-op action.

### Navigation/control UX
Add:
- 2D | 3D Preview switch;
- 3D Preview badge/hint;
- Reset North;
- Top View;
- preview extrusion controls;
- disabled drawing/edit state with reason.

Preserve the established Map Tools visual language; no dashboard redesign.

## 6. Renderer construction / composition rule

Refactor `src/main.ts` only as needed so renderer construction is not hard-wired to a single concrete renderer.

Preferred:
- shared callbacks/factories;
- ModeController owns renderer replacement;
- AppController remains renderer-neutral.

Avoid a second application/controller/store instance.

## 7. 3D common navigation

Normal user 3D pan/zoom:
- updates ProjectStore mapView center/zoom through existing no-history navigation semantics;
- preserves current canonical 2D basemapId.

Pitch/bearing:
- no ProjectStore mutation;
- no history;
- no dirty.

Programmatic transient navigation such as search:
- preserve existing no-dirty semantics.

## 8. WebGL/provider failure

Test explicit failure path:
- MapLibre construction/style failure;
- project unchanged;
- no history/dirty corruption;
- 2D still/re-again usable;
- user receives clear message.

Do not swallow errors into blank map.

## 9. Automated tests

Keep every accepted A/B/B4 test green.

Add unit/architecture tests:
- no maplibre imports in domain/store/persistence;
- capabilities;
- camera transient state;
- geometry conversion;
- circle/radius geodesic conversion;
- arrow bearing;
- project → GeoJSON all types;
- preview extrusion absent from ProjectDocument;
- mode switch project equality.

Add real-browser tests:
- C4-J1 through C4-J8;
- real mode switch buttons;
- actual MapLibre canvas;
- selection/context;
- inspector canonical edit;
- undo/redo;
- failure fallback.

Automated browser tests must use deterministic mocked/local style/data where needed.
Do not make CI depend on live OpenFreeMap or Nominatim.

Add separate manual/real-provider smoke for:
- Bangkok OpenFreeMap style;
- 3D buildings;
- attribution.

## 10. Performance / bundle gates

Record:
- final production bundle/chunk sizes;
- delta from B4;
- 40-feature mixed/dense 3D switch smoke;
- 500-feature renderer smoke if practical using deterministic generated project data.

Do not fail solely because MapLibre increases the existing bundle warning, but document the delta and avoid accidental duplicate inclusion.

Do not add Three.js to the bundle.

## 11. Qualification journeys

### C4-J1
2D mixed project → select → 3D → same selection → 2D → project equal.

### C4-J2
3D pitch/bearing/orbit → reset north/top → no dirty/history from pitch/bearing.

### C4-J3
real provider smoke shows 3D buildings and attribution.

### C4-J4
all feature types + marker radii visible/identifiable in 3D.

### C4-J5
transient polygon preview extrusion, in-session switch survival, save/reopen absence.

### C4-J6
3D selection/context + B4 lock semantics + geometry editing disabled.

### C4-J7
canonical property/style edit in 3D → overlay update → undo/redo → save/reopen.

### C4-J8
forced 3D failure → safe usable 2D fallback, project untouched.

## 12. Full gates

Run:

```
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:browser
PLAYWRIGHT_USE_PREVIEW=1 npm run test:browser
git diff --check
```

Also:
- plain static dist server + Chromium;
- production globals absent;
- real-provider OpenFreeMap Bangkok smoke;
- WebGL failure smoke;
- git status clean.

## 13. Qualification artifact

Create:
- `docs/v2/C4_1_QUALIFICATION.md`

Record:
- starting SHA;
- C4.1A checkpoint SHA;
- final implementation head;
- qualification evidence commit;
- exact package version;
- exact commands/counts;
- feature-rendering matrix;
- C4-J1..J8;
- provider smoke;
- failure fallback;
- bundle delta;
- known limitations;
- final CI on final PR head.

Decision:
- `C4_1_3D_PREVIEW_QUALIFIED` or NOT;
- `READY_FOR_C4_2` or `BLOCK_C4_2`.

## 14. Explicit non-scope

Do not implement:
- Project Schema height/elevation fields;
- terrain;
- Three.js;
- GLB/glTF;
- vehicles;
- shadows/day-night presentation;
- mesh modeling;
- 3D geometry editing;
- MapLibre drawing engine;
- GIS import/export;
- report composer;
- engineering symbol library;
- React/framework migration.

## 15. Handoff / PR

One execution branch, one PR, two internal checkpoints.

PR:
- against main;
- closes issue #17;
- references parent #10;
- remains unmerged.

Final report:
- PR URL;
- base SHA;
- C4.1A checkpoint;
- final head;
- MapLibre version;
- unit/browser counts;
- J1–J8;
- provider smoke;
- bundle delta;
- CI;
- qualification;
- C4.2 readiness;
- limitations.
