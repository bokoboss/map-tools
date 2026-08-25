# Map Tools v2 — Architecture and Product Decisions

Status: active decision log  
Date: 2026-08-25

This file records decisions that should not be re-litigated implicitly inside implementation PRs. A decision may be changed, but the change should be explicit and justified.

## ADR-001 — Evolve the existing app; do not rewrite from scratch

**Decision:** treat the current static app as the v1 reference implementation and migrate incrementally.

**Why:** the existing app already contains useful interaction behavior and domain-specific details. A ground-up rewrite would create unnecessary regression risk and make it harder to distinguish deliberate product changes from accidental omissions.

**Consequence:** characterization tests precede architectural refactoring.

## ADR-002 — Domain/project state is canonical; Leaflet is renderer/editor state

**Decision:** persisted/business state must be representable without Leaflet runtime objects.

**Why:** the current coupling of project semantics to Leaflet markers, feature groups, and ad-hoc properties causes persistence and maintainability problems.

**Consequence:** renderer adapters translate domain features to/from Leaflet interactions.

## ADR-003 — Project Schema v2 uses GeoJSON coordinate order

**Decision:** all persisted coordinate arrays use `[longitude, latitude]` in WGS84.

**Why:** this aligns with GeoJSON/interoperability standards and makes persisted data independent from Leaflet's `[lat, lng]` runtime convention.

**Consequence:** the Leaflet adapter performs explicit coordinate conversion. Tests must use asymmetric coordinates such as Bangkok `[100.5018, 13.7563]` so accidental swapping fails immediately.

## ADR-004 — Arrow and text are semantic feature types

**Decision:** arrows and text annotations are not persisted as implementation artifacts such as feature groups or generic markers.

**Why:** their semantics must survive save/open and future renderer changes.

**Consequence:** Project Schema v2 includes explicit `arrow` and `text` discriminators and type-specific properties.

## ADR-005 — Rectangle and circle semantics remain explicit

**Decision:** rectangles and circles remain distinct project feature types even if an interchange format represents them differently.

**Why:** their editing behavior and semantic parameters (bounds, center/radius) differ from generic polygons/points.

**Consequence:** adapters may convert for GeoJSON export but the Map Tools project model preserves the native type.

## ADR-006 — User-entered/project-entered strings are plain text by default

**Decision:** labels and annotations are data, not HTML.

**Why:** current string interpolation can create injection/XSS risk and complicates safe project import.

**Consequence:** rendering uses `textContent`/text nodes or equivalent safe handling. Rich text would require a future explicit feature and sanitization policy.

## ADR-007 — Validate candidate project before replacing active project

**Decision:** opening/importing a project uses a temporary parse/validate/migrate pipeline. Active state changes only after success.

**Why:** a malformed file must not destroy unsaved current work.

**Consequence:** destructive `clearMap()`-first loading is prohibited in v2 persistence.

## ADR-008 — Defer drawing-engine replacement

**Decision:** do not combine Leaflet.draw replacement with core persistence/architecture migration.

**Why:** changing both state architecture and drawing behavior in one phase makes regression diagnosis difficult.

**Consequence:** hide the current drawing library behind an adapter and evaluate Leaflet-Geoman/Terra Draw only after v2 Core qualification.

## ADR-009 — Defer Leaflet 2 migration

**Decision:** v2 Core targets the current stable Leaflet 1.9.x line.

**Why:** a major renderer migration does not solve the primary product risks and would expand the refactor surface.

**Consequence:** renderer boundaries should make future migration possible without coupling schema/domain code to Leaflet internals.

## ADR-010 — Do not introduce a frontend framework without demonstrated need

**Decision:** Vite + TypeScript modularization is required; React/Vue/Svelte is not currently required.

**Why:** the primary problems are state ownership, persistence, testing, and workflow architecture rather than lack of a component framework.

**Consequence:** framework adoption remains a later decision based on UI complexity after the object manager/inspector requirements are better understood.

## ADR-011 — Separate transient search state from project state

**Decision:** geocoding results are transient until the user explicitly adds one to the project.

**Why:** the current behavior can accidentally turn navigation/search into persisted annotation data.

**Consequence:** search provider results use a separate layer/state and an explicit `Add to project` action.

## ADR-012 — Separate quick capture from report export

**Decision:** keep a lightweight quick PNG path, but implement report output through a controlled composition pipeline.

**Why:** hiding controls and screenshotting the application DOM is not sufficient for repeatable report-quality maps.

**Consequence:** report export can have its own layout, dimensions, map furniture, and attribution logic.

## ADR-013 — Engineering specialization comes after v2 Core reliability

**Decision:** traffic/transport symbols, buffers, advanced measurements, and report features start only after save/open, security, tests, and core architecture are qualified.

**Why:** adding features to an unreliable persistence model compounds migration cost and data-loss risk.

**Consequence:** Phase 4+ issues depend on completion of the earlier core phases.
