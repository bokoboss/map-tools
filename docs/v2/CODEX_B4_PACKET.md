# Codex Execution Packet — B4 2D Product Acceptance / Interaction Parity

Status: ready for bounded execution  
Date: 2026-08-26  
GitHub issue: #13

## 1. Objective

Make the current 2D Map Tools experience product-acceptable before any visible C4/3D work starts.

This is **not** a broad redesign and not a 3D task. It is a focused interaction-parity and usability-hardening run against the accepted Macro B architecture.

The accepted runtime baseline before B4 is:

`501f996217857945e3008bae226ab7d19d5573e8`

The exact required execution-branch starting SHA is supplied in the Codex prompt and must be the planning `main` tip that contains this packet and the B4 specifications.

## 2. Mandatory reading before code changes

Read in this order:

1. `AGENTS.md`
2. `PROJECT_PROFILE.md`
3. `docs/development/ENGINEERING_WORKFLOW.md`
4. `docs/v2/CODEX_B4_PACKET.md`
5. `docs/v2/B4_PARITY_MATRIX.md`
6. `docs/v2/B4_2D_PRODUCT_ACCEPTANCE.md`
7. `docs/v2/B_WORKSPACE_ARCHITECTURE_CONTRACT.md`
8. `docs/v2/WORKSPACE_UX_SPEC.md`
9. `docs/v2/DOMAIN_MODEL_CONTRACT.md`
10. `docs/v2/ARCHITECTURE.md`
11. `docs/v2/PROJECT_SCHEMA_V2.md`
12. `docs/v2/DECISIONS.md`
13. `docs/v2/B_QUALIFICATION.md`
14. `docs/v2/TEST_AND_UAT_PLAN.md`

Also inspect the retained legacy `script.js` only as a behavior reference. Do **not** copy its unsafe/global implementation style into production.

## 3. Protected baseline

Preserve every accepted A1/A2/A3/Macro-B behavior unless this packet explicitly defines an intentional product change.

Especially protect:

- Project Schema v2 semantics and stable IDs;
- WGS84 persisted coordinate order `[longitude, latitude]`;
- candidate validation before project replacement;
- safe literal text rendering;
- semantic text/rectangle/circle/arrow persistence;
- renderer-neutral domain/store/persistence;
- `MapRenderer` / `RendererHost` abstraction;
- renderer teardown/reinitialization semantics;
- stable-ID workspace selection;
- Objects / Inspector behavior;
- group effective visibility/lock child-flag preservation;
- bounded domain history and transaction coalescing;
- saved-baseline dirty semantics;
- transient search preview and search-navigation dirty isolation;
- production runtime test-global isolation.

## 4. Strict execution structure

Use **one branch and one PR** for B4.

Keep these internal checkpoints:

### B4.1 — Context + reverse geocode + precise marker placement

Implement and qualify:

- renderer-neutral context-request contract;
- `RendererHost` listener lifecycle;
- Leaflet background and feature context requests;
- context-menu controller/UI;
- reverse-geocode abstraction + Nominatim implementation;
- stale async reverse-result protection;
- desktop blank-map right-click workflow;
- desktop feature right-click workflow;
- toolbar Add Pin placement mode;
- Escape/cancel placement behavior;
- mobile/touch alternative through toolbar/workspace.

Before B4.2:

- run relevant unit/browser tests;
- create `docs/v2/B4_1_CONTEXT_PLACEMENT_CHECKPOINT.md`;
- commit B4.1 separately;
- keep the tree clean.

### B4.2 — Cross-surface lock enforcement + product journeys + Help

Implement and qualify:

- centralized effective-lock mutation guard;
- inspector read-only/disabled behavior while effectively locked;
- keyboard Delete protection;
- popup/context/map-edit protection;
- group-lock semantics;
- Help synchronization;
- full B4 real user-journey suite;
- final qualification.

Create final `docs/v2/B4_QUALIFICATION.md` and one PR against `main` closing #13.

Do not merge.

## 5. Renderer-neutral context request

Add a renderer-neutral context request to `MapRenderer` and proxy it through `RendererHost`.

Conceptual contract:

```ts
export interface MapContextRequest {
  featureId: FeatureId | null;
  coordinate: Coordinate;
  clientPoint: { x: number; y: number };
  source: 'mouse' | 'keyboard' | 'touch';
}

interface MapRenderer {
  onContextRequest(listener: (request: MapContextRequest) => void): () => void;
}
```

Exact names may differ.

Mandatory invariants:

- no Leaflet object/type/event crosses this interface;
- no DOM `MouseEvent`/`PointerEvent` object crosses this interface;
- background request has `featureId: null`;
- feature request has stable `FeatureId`;
- feature context request must not also emit background context request;
- request coordinate is WGS84 `[longitude, latitude]`;
- listener survives `RendererHost.replace` / `replaceWith` exactly once;
- context state is transient and does not dirty/history/serialize.

Leaflet runtime detection remains inside `LeafletRenderer`.

## 6. Context menu controller / UI

Prefer a dedicated transient UI controller rather than constructing DOM menu content inside `LeafletRenderer`.

Required background menu:

- **Add marker here**;
- Longitude value;
- Latitude value;
- reverse-geocode loading/resolved/failure status.

Required feature menu:

### Marker
- Edit marker;
- Manage radii;
- Delete marker.

### Text
- Edit text;
- Rotate text;
- Delete text.

### Arrow / polyline / polygon / rectangle / circle
- Edit geometry;
- Edit style/color;
- Delete object.

Behavior:

- opening feature context selects the feature and syncs Objects / Inspector;
- actions route through existing canonical app/workspace/store commands;
- no direct renderer persistence mutations;
- menu closes on normal map click, Escape, replacement by another context request, and after an executed action where appropriate;
- menu position is clamped within viewport;
- actionable items are real accessible controls;
- focus enters menu sensibly;
- locked actions expose disabled state rather than color-only indication;
- context menu is a desktop shortcut, never the only path.

Do not reintroduce legacy inline event handlers or arbitrary `innerHTML` for user/remote strings.

## 7. Reverse geocoding

Extend `GeocodingService` with renderer-neutral reverse geocoding.

Conceptually:

```ts
export interface ReverseGeocodingResult {
  label: string;
  coordinate: Coordinate;
}

interface GeocodingService {
  search(query: string): Promise<GeocodingResult[]>;
  reverse(coordinate: Coordinate): Promise<ReverseGeocodingResult | null>;
}
```

Nominatim implementation requirements:

- use `/reverse` with explicit `lat` and `lon` derived from `[lon, lat]` correctly;
- request Thai language consistently with forward search where practical;
- normalize untrusted response data;
- return safe plain data, never HTML;
- mocked deterministic browser/unit tests;
- failures are non-blocking.

Async correctness requirement:

- opening another menu or closing the current menu invalidates the previous reverse lookup UI update;
- use `AbortController`, request generation/token, or equivalent deterministic mechanism;
- stale response must never overwrite the current/newer menu.

Reverse geocoding is transient:

- no project mutation;
- no history;
- no dirty;
- no serialization.

## 8. Intentional product change — Add Pin becomes placement mode

Current toolbar Add Pin without a coordinate eventually creates at map center. Replace that behavior.

Required state flow:

`idle → marker-placement → marker-editor → save/cancel → idle`

Behavior:

1. click Add Pin toolbar button;
2. no feature and no marker modal yet;
3. button/cursor/status visibly indicates placement mode;
4. click/tap map exact point;
5. open the existing marker editor for that coordinate;
6. Save creates one marker at exact WGS84 coordinate;
7. Escape before map click exits placement with no mutation;
8. Cancel after map click/editor exits with no mutation;
9. activating another draw/text tool cancels marker placement;
10. background context menu **Add marker here** opens the same marker editor directly for the context coordinate.

This is the universal touch/mobile path. Long-press context menu is **not required** in B4.

## 9. Effective-lock enforcement

Current effective state is:

`effectiveLocked = group.locked || feature.locked`

B4 must make this semantic real across every mutation surface.

### Allowed while effectively locked

- select;
- inspect read-only values;
- zoom/fit;
- toggle visibility;
- change the legitimate lock control itself when allowed by lock source.

### Blocked while effectively locked

- drag/move;
- geometry edit;
- name/content edit;
- style/color edit;
- marker radius add/edit/delete;
- group reassignment;
- Delete/Backspace deletion;
- context-menu delete/edit/style/radius actions;
- popup edit/action routes;
- inspector property mutation.

Use a centralized application/domain policy/helper. Do not scatter inconsistent one-off checks across UI handlers.

Blocked attempts:

- create no history entry;
- do not dirty;
- do not partially mutate renderer state;
- should provide understandable disabled/read-only UI where applicable.

Group lock:

- never overwrites child `feature.locked` flag;
- feature unlock cannot defeat a still-locked parent group;
- group unlock reveals original child lock state.

## 10. Real B4 product journeys

Implement browser tests for J1–J8 from `B4_2D_PRODUCT_ACCEPTANCE.md`.

Minimum named suites may include:

- `tests/context-menu-browser.spec.js`
- `tests/marker-placement-browser.spec.js`
- `tests/lock-semantics-browser.spec.js`
- `tests/b4-product-journey.spec.js`

### Critical rule

Do not satisfy product acceptance entirely through direct `window.__mapToolsTest` calls.

Use real UI interactions for the principal path:

- right-click through Playwright pointer/mouse;
- toolbar controls;
- modal/inspector inputs;
- context menu buttons;
- keyboard Escape/Undo/Redo/Delete;
- actual save/open where practical.

Test hooks may observe deterministic state or set up otherwise unstable drawing fixtures, but they are not a substitute for user interaction.

## 11. Mandatory B4 test cases

At minimum prove:

### Context contract
- background right-click emits one request with no feature ID;
- feature right-click emits one stable feature ID and does not double-fire background;
- no Leaflet/DOM runtime objects cross renderer-neutral interface;
- `RendererHost` replacement rebinds one listener only.

### Background context
- menu opens and is viewport-clamped;
- exact coordinate order is correct;
- reverse lookup displays safe literal text;
- stale lookup cannot update newer/closed menu;
- menu open/close/reverse status does not dirty/history/serialize;
- Add marker here uses exact coordinate.

### Marker placement
- toolbar starts placement mode with zero project mutation;
- click/tap exact point opens editor;
- Save creates one marker there;
- Escape before placement creates nothing;
- Cancel editor creates nothing;
- activating another tool cancels placement.

### Feature contextual actions
- marker edit/radius/delete routes work;
- text edit/rotate/delete routes work;
- polygon and arrow geometry/style/delete routes work;
- context opening synchronizes selection/inspector;
- action history behaves exactly like equivalent canonical workspace command.

### Lock
- feature lock blocks every prohibited route;
- group lock blocks every prohibited route;
- locked renderer geometry cannot be moved;
- inspector is read-only/disabled appropriately;
- keyboard delete is blocked;
- context/popup actions are disabled/blocked;
- blocked attempts add no history and do not dirty;
- visibility and selection/zoom still work;
- group lock does not overwrite child flag.

### Save/open
- contextual edits retain marker radius/text/shape/arrow semantics through save/open;
- safe text remains literal;
- stable IDs retained where persistence contract requires.

### Help / production
- Help key workflow text matches live controls;
- production `/index.html` exposes neither `window.__mapToolsTest` nor `window.MapToolsSchema`;
- static `dist/` browser smoke has no page errors.

## 12. Existing test regression

Preserve the complete accepted suite.

Expected existing baseline before B4:

- unit/integration/architecture: 29 tests;
- browser: 28 tests in development and preview at Macro B qualification.

B4 final counts must be **greater than or equal to** these baselines and include the new product journey coverage.

Do not weaken or delete an accepted test merely to make B4 pass unless the test asserts the intentional Add Pin behavior that this packet explicitly replaces; in that case update the test to the new exact-placement contract and document the reason.

## 13. Required local qualification

Run at minimum:

```text
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

- serve `dist/` with a plain static server;
- load production `/index.html` in Chromium;
- confirm map/workspace visible;
- confirm no page errors;
- confirm no production test globals;
- inspect final `git status`, `git diff`, and `git diff --check`.

## 14. Qualification artifact

Create:

`docs/v2/B4_QUALIFICATION.md`

It must record:

- repository/branch;
- accepted runtime baseline;
- exact execution starting SHA;
- B4.1 checkpoint SHA;
- final implementation/remediation SHA(s);
- qualification/evidence provenance without recursively pre-claiming a future tip;
- exact commands/results;
- unit/integration count;
- dev browser count;
- preview browser count;
- parity matrix resolution summary;
- J1–J8 result matrix;
- lock-surface result matrix;
- reverse-geocode/stale-request evidence;
- static artifact smoke;
- final CI run/status;
- known limitations;
- `B4_2D_PRODUCT_ACCEPTANCE_QUALIFIED` or `B4_2D_PRODUCT_ACCEPTANCE_NOT_QUALIFIED`;
- `READY_TO_START_C4_1` or `BLOCK_C4_1` with exact reason.

## 15. PR requirements

- one PR against `main`;
- PR body includes `Closes #13` or `Fixes #13`;
- do not merge;
- report exact base/head/checkpoint SHAs;
- report test counts and CI;
- report any architecture deviation;
- report any intentionally changed v1 behavior;
- report unresolved parity item if any.

## 16. Explicit non-scope

Do **not** implement:

- MapLibre;
- Three.js;
- visible 2.5D/3D;
- terrain/building extrusion;
- C1 engineering symbol library;
- C2 report composer;
- C3 import/export expansion;
- full UI redesign;
- React/new UI framework;
- full multi-select/bulk edit;
- drawing-engine replacement;
- Leaflet 2;
- long-press mobile context menu unless trivial and non-disruptive;
- legacy unsafe globals/inline handlers for parity.

## 17. Stop / escalation conditions

Stop and report before expanding scope if any of these occur:

- contextual interaction cannot be added without leaking Leaflet runtime types into canonical app/domain interfaces;
- lock enforcement would require a Project Schema breaking change;
- precise marker placement would require duplicating canonical project state;
- accepted A/B persistence/history semantics cannot be preserved;
- a new framework/drawing engine appears necessary.

Otherwise iterate until B4 qualification is genuinely green.
