# Codex Execution Packet — Macro Phase B Productive Workspace

Status: bounded implementation packet
Date: 2026-08-25

## Preconditions

Do not start until Macro Phase A is qualified.

Authoritative references:

- `MASTER_EXECUTION_PLAN.md`
- `WORKSPACE_UX_SPEC.md`
- `DOMAIN_MODEL_CONTRACT.md`
- `ARCHITECTURE.md`
- `TEST_AND_UAT_PLAN.md`
- `DECISIONS.md`

## Objective

Make real multi-object projects manageable without changing the product into a full GIS/CAD application.

## Required scope

### Selection

- one canonical selection state;
- map ↔ object-panel synchronization;
- transient selection styling not persisted.

### Object/layer panel

- feature rows;
- group rows;
- visible type icon/name;
- visibility;
- lock;
- rename;
- duplicate;
- zoom to;
- delete;
- group move/assignment if grouping is implemented in the same PR.

### Inspector

- common properties;
- feature-specific style/property editing according to `WORKSPACE_UX_SPEC.md`.

### History

- undo/redo domain mutations for create/delete/move/geometry/style/text/radius/duplicate;
- redo cleared by a new mutation after undo;
- loading another project resets history.

### Project status

- saved/unsaved indicator tied only to persisted-domain changes.

### Search isolation

- transient search result layer;
- result list where multiple matches exist;
- explicit `Add to project` conversion;
- search itself does not dirty or serialize project.

### Keyboard

- Escape;
- Delete/Backspace safe behavior;
- Ctrl/Cmd+Z;
- redo shortcut;
- Ctrl/Cmd+S where appropriate.

## Recommended PR slicing

If one PR becomes too large, split without redefining the macro phase:

- B1: selection + object panel + inspector;
- B2: history + dirty state + keyboard;
- B3: search isolation + responsive/accessibility hardening.

## Required tests

### Selection/object tests

- map selection highlights correct row;
- row selection highlights correct feature;
- deleted feature clears invalid selection;
- selection is absent from serialized JSON;
- visibility and lock semantics respect group effective state;
- duplicate generates new stable IDs.

### History tests

For every core mutation:

`before → execute → undo == before → redo == after`

Also test:

- redo cleared on divergent edit;
- history reset on project load;
- non-domain UI interaction creates no history entry.

### Dirty-state tests

- selection does not dirty;
- hover does not dirty;
- search does not dirty;
- feature mutation dirties;
- save/load establishes saved baseline.

### Search tests

- multiple results can be presented;
- transient result excluded from serialization;
- Add to project creates normal marker with stable ID;
- mocked geocoder means deterministic CI.

## Dense-project UAT

Use or generate a deterministic project containing approximately 40–50 mixed features in four groups.

Verify that a user can primarily through the panel:

- locate named feature;
- zoom to it;
- hide/show it;
- lock/unlock it;
- rename it;
- duplicate it;
- change a property;
- delete and undo deletion.

## Responsive/accessibility checks

At minimum verify:

- wide desktop;
- 1366×768-class laptop;
- tablet/narrow window;
- mobile smoke.

Primary controls must remain reachable. Focus visibility, icon accessible names, and keyboard behavior must be checked.

## Visual design rule

This packet is a workspace UX improvement, but preserve the established visual character unless a specific usability problem requires change. Do not introduce a generic dashboard aesthetic merely because the architecture is new.

## Non-scope

- engineering symbol library;
- buffer toolkit;
- report composer;
- KML/GeoJSON expansion beyond what is already qualified;
- drawing-engine replacement;
- Leaflet 2.

## Required handoff

Create `docs/v2/B_QUALIFICATION.md` including:

- base/head SHA;
- PR slicing used;
- automated test results;
- browser/UAT evidence;
- responsive/accessibility findings;
- known limitations;
- whether Macro Phase B is qualified for engineering expansion.

Open PR(s) against `main`; do not self-merge unless explicitly instructed.
