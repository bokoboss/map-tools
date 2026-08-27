# Map Tools v2 — Implementation Roadmap

Status: execution roadmap  
Date: 2026-08-26

## 1. Delivery strategy

Map Tools v2 is organized into three macro phases, but a product-acceptance hardening gate is inserted between Macro B and visible Macro C/3D work.

The guiding rule is:

> Reliable core first, productive workspace second, **2D product acceptance third**, then engineering/3D expansion.

Do not confuse architecture qualification with product usability qualification. A test-green refactor is not sufficient if a useful user workflow has disappeared or Help documents behavior that production no longer provides.

## 2. Macro Phase A — Reliable Core — COMPLETE

A1/A2/A3 are complete and accepted.

### A1 — Characterization + CI (`#2`) — COMPLETE

- deterministic marker/radius/shape/arrow/text/search/save-open characterization;
- representative v1 fixtures;
- repeatable local qualification and CI.

### A2 — Project Schema v2 + safe/lossless persistence (`#3`) — COMPLETE

- versioned Project Schema v2;
- stable IDs;
- semantic feature persistence;
- validate-before-replace;
- v1 migration;
- safe literal text;
- round-trip/security coverage.

### A3 — Vite + TypeScript renderer-ready modularization (`#4`) — COMPLETE

- Vite + strict TypeScript;
- renderer-neutral domain/store/persistence;
- `MapRenderer` / `RendererHost` boundary;
- Leaflet implementation isolated behind adapter;
- npm-managed build and CI;
- future renderer readiness.

Accepted A3 squash merge: `614bb814ac83891c8150d285efbcdbaece7ecd26`.

## 3. Macro Phase B — Productive Workspace — COMPLETE

Issue #5 is complete.

Delivered:

- stable-ID map/workspace selection;
- Objects / Inspector workspace;
- persisted groups plus Ungrouped;
- visibility and lock state;
- rename/duplicate/zoom/delete/group assignment;
- bounded domain undo/redo;
- saved-baseline dirty semantics;
- keyboard Escape/Delete/Undo/Redo/Save;
- deterministic multiple-result transient search;
- dense 40-object UAT;
- responsive/accessibility smoke;
- renderer reinitialization preserving stable-ID selection.

Macro B accepted via PR #12, squash merge:

`501f996217857945e3008bae226ab7d19d5573e8`

Macro B means the architecture/workspace is qualified. It does **not** by itself mean every historical 2D interaction has product acceptance.

## 4. B4 — 2D Product Acceptance / Interaction Parity — COMPLETE (`#13`)

Accepted via PR #16, squash merge `95e9928facd84d7e2e44b88f6680358c6af0da5e`.

### Why B4 existed

Post-Macro-B manual use found interaction parity regressions that the earlier characterization matrix did not cover adequately.

The clearest example:

- legacy v1 implemented a custom right-click context menu on blank map and objects;
- current HTML/Help still advertises it;
- the current TypeScript production renderer/application has no live context-menu event path.

Additional product gaps identified during audit:

- reverse geocoding disappeared from the typed geocoding contract;
- toolbar Add Pin falls back to the map center instead of using an explicit exact-placement workflow;
- effective feature/group lock is not yet enforced consistently across every inspector/keyboard/context mutation surface;
- Help is not fully synchronized with the current productive workspace.

### B4 authoritative specifications

- `docs/v2/B4_PARITY_MATRIX.md`
- `docs/v2/B4_2D_PRODUCT_ACCEPTANCE.md`
- `docs/v2/CODEX_B4_PACKET.md`

### B4 required outcomes

- renderer-neutral context-request event using stable IDs and WGS84 coordinates;
- blank-map desktop right-click: Add marker here + exact coordinate + reverse-geocoded address/status;
- feature right-click: marker/text/shape/arrow actions routed to canonical application/store mutations;
- renderer-host listener rebind across renderer replacement;
- safe, stale-resistant reverse geocoding through the geocoding abstraction;
- toolbar Add Pin becomes exact placement mode and provides the non-right-click touch/mobile path;
- effective lock blocks prohibited mutations across map, popup, context menu, inspector, keyboard and group state;
- Help matches actual production behavior;
- real browser product journeys prove create → context edit → history → save/reopen workflows.

### B4 completion gate

All must be true:

- every B4 parity matrix item required for product acceptance is PASS / IMPROVED / intentionally replaced;
- all existing A/B tests remain green;
- B4 product journeys pass in development and production preview;
- static production artifact smoke passes;
- production path exposes no test globals;
- no renderer runtime objects leak across the renderer boundary;
- final qualification reports `B4_2D_PRODUCT_ACCEPTANCE_QUALIFIED`;
- control-plane review accepts `READY_TO_START_C4_1`.

**B4 gate accepted. C4.1 implementation is now unblocked.**

## 5. Macro Phase C — Engineering Delivery Toolkit

Macro C is unblocked because B4 product acceptance is complete.

The C work packages can then be prioritized by actual need rather than a rigid sequence.

### C1 — Traffic/transport engineering toolkit (`#6`)

- engineering symbol library;
- semantic style presets;
- measurement enhancements;
- bearing/azimuth;
- polygon perimeter;
- buffers;
- coordinate utilities;
- Thai engineering defaults where appropriate.

### C2 — Report-quality export (`#7`)

- separate quick capture from report composer;
- A4/A3/16:9/custom;
- portrait/landscape;
- title;
- legend;
- north arrow;
- scale bar;
- attribution/source;
- date;
- high-resolution PNG;
- PDF.

### C3 — Interoperability + site-plan overlay (`#8`)

First wave:

- GeoJSON import/export;
- CSV point import/export.

Second wave:

- KML/KMZ;
- GPX where useful;
- site-plan image overlay;
- opacity/lock/transform;
- controlled georeferencing workflow.

### C4 — 2.5D/3D engineering visualization (`#10`)

C4 architecture prerequisites and B4 product sequencing gate are complete.

C4.1 current slice:

- `2D | 3D Preview` mode switch;
- `maplibre-gl@6.6.0` renderer consuming the same canonical store/project;
- renderer capabilities rather than concrete-type UI checks;
- transient pitch/bearing/reset controls;
- OpenFreeMap vector/building context;
- every current semantic feature type rendered/identifiable;
- transient polygon/rectangle preview extrusion only (no schema change);
- geometry creation/editing remains 2D-only;
- switch back to 2D without semantic/project mutation;
- C4-J1..J8 product/browser qualification.

Authoritative C4.1 docs:
- `C4_1_3D_PREVIEW_SPEC.md`;
- `C4_1_RENDERER_ARCHITECTURE.md`;
- `C4_1_FEATURE_RENDERING_MATRIX.md`;
- `CODEX_C4_1_PACKET.md`.

Do not let C4 bypass the B4 context/lock/product interaction rules.

## 6. Recommended pull-request order from current state

Completed:

1. A1+A2 — PR #9
2. A3 — PR #11
3. Macro B — PR #12

Completed additionally:

4. B4 — PR #16

Next:

5. **C4.1 — `codex/c4-1-maplibre-3d-preview`**

Then, according to need:

6. C4.2 persistent elevation semantics or C1/C2/C3 according to product value.

Avoid a broad `rewrite-v2` or combining B4 with 3D.

## 7. ChatGPT/Codex operating model

ChatGPT/control plane should continue to own:

- product/UX reasoning;
- parity audit;
- renderer/application contracts;
- deterministic acceptance journeys;
- test matrices;
- issue/PR decomposition;
- GitHub diff/CI review;
- qualification review;
- execution-packet preparation.

Codex should be used primarily for:

- bounded production/test implementation;
- local dependency/build/runtime work;
- Playwright/browser iteration;
- concrete debugging;
- reproducible qualification evidence.

## 8. v2 2D product release qualification

Before calling the 2D v2 experience product-accepted:

- [x] supported feature types survive save/open;
- [x] invalid import preserves active project;
- [x] security payload tests pass;
- [x] stable IDs verified;
- [x] object panel and map selection synchronized;
- [x] undo/redo matrix passes;
- [x] search-result isolation passes;
- [x] responsive smoke matrix passes;
- [x] production build passes;
- [x] CI green for Macro B;
- [x] B4 right-click/context parity passes;
- [x] reverse-geocode context workflow passes;
- [x] exact toolbar/touch marker placement passes;
- [x] effective lock is enforced across every mutation surface;
- [x] B4 real product journeys pass;
- [x] Help matches real production interactions;
- [x] B4 qualification is accepted.

## 9. Stop conditions

Do not accept C4.1 or proceed to persistent 3D semantics if any remain unresolved:

- a documented core 2D interaction is absent or misleading;
- context/placement actions can create the wrong coordinate silently;
- lock state can be bypassed through an alternate edit surface;
- save/open can silently lose supported semantics;
- unsafe project/geocoder text can execute;
- failed import can destroy active project;
- persistence requires renderer runtime objects;
- core/browser test suite is unreliable.

See `MASTER_EXECUTION_PLAN.md` for the three-macro-phase management view and the C4.1 focused specs for the current execution gate.
