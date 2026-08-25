# Codex Execution Packet — Macro Phase B Productive Workspace

Status: preferred bounded implementation packet
Date: 2026-08-25

## Preconditions

Macro Phase A is accepted and merged.

Accepted A3 merge baseline:

`614bb814ac83891c8150d285efbcdbaece7ecd26`

Before execution, use the current `main` after the B planning/fixture updates and confirm the execution branch is synchronized from it.

Recommended branch:

`codex/b-productive-workspace`

## Authoritative references

Read before editing code:

1. `PROJECT_PROFILE.md`
2. `docs/v2/MASTER_EXECUTION_PLAN.md`
3. `docs/v2/WORKSPACE_UX_SPEC.md`
4. `docs/v2/B_WORKSPACE_ARCHITECTURE_CONTRACT.md`
5. `docs/v2/DOMAIN_MODEL_CONTRACT.md`
6. `docs/v2/ARCHITECTURE.md`
7. `docs/v2/TEST_AND_UAT_PLAN.md`
8. `docs/v2/DECISIONS.md`
9. `docs/v2/fixtures/project-v2-dense-workspace.json`
10. `docs/v2/A3_QUALIFICATION.md`

If older planning text conflicts with `B_WORKSPACE_ARCHITECTURE_CONTRACT.md`, the B contract wins for Macro Phase B implementation details.

## Objective

Make medium/large engineering map projects manageable through a discoverable workspace while preserving the accepted A3 renderer-neutral architecture and Project Schema v2 semantics.

This is the workspace/productivity phase. It is not an engineering-toolkit phase and not a 3D phase.

## Preferred execution mode

Use **one Codex run and one PR** with three auditable internal checkpoints. Do not split into separate PRs unless a concrete technical blocker makes the combined run unsafe.

### B1 checkpoint — Selection + Objects + Inspector

Implement and qualify:

- renderer-neutral single selection state;
- map → panel selection and panel → map selection;
- transient selection highlight;
- object/layer panel;
- group rows + Ungrouped;
- group create/rename/visibility/lock/delete-by-ungrouping;
- feature visibility/lock/rename/duplicate/zoom/delete;
- feature → group assignment;
- inline property inspector;
- dense fixture can be loaded and managed from the panel.

Before B2: run relevant tests, create `docs/v2/B1_WORKSPACE_CHECKPOINT.md`, commit B1 separately, and verify a clean tree.

### B2 checkpoint — History + Dirty State + Keyboard

Implement and qualify:

- domain-level undo/redo;
- one logical history entry per continuous interaction;
- redo invalidation after divergent edit;
- project-load history reset;
- saved-baseline dirty semantics;
- undo back to saved baseline reports Saved;
- keyboard routing for Escape/Delete/Undo/Redo/Save;
- no UI-only state in history or persistence.

Before B3: run full B1+B2 regression, create `docs/v2/B2_HISTORY_CHECKPOINT.md`, commit B2 separately, and verify a clean tree.

### B3 checkpoint — Search + Responsive + Accessibility + Dense UAT

Implement and qualify:

- multiple deterministic search results;
- transient preview and explicit Add to project;
- search creates no dirty/history entry until Add;
- wide/laptop/tablet/mobile responsive smoke;
- accessible names/focus/selection states;
- dense-project UAT using the canonical fixture;
- final production build/browser qualification.

Then create final qualification evidence and open the PR.

## Required architecture

### Canonical project state

`ProjectStore` remains canonical for persisted domain data. No DOM nodes, Leaflet objects, runtime IDs, selection state, panel state, search previews, or history implementation objects may be persisted in `ProjectDocumentV2`.

### Workspace state

Use a small renderer-neutral transient workspace-state abstraction. Minimum required selection representation:

```ts
selectedFeatureId: FeatureId | null
```

Single-feature selection is sufficient for B. Do not expand into full multi-select bulk editing.

### Renderer boundary

Map selection events must cross the renderer boundary only as stable feature IDs. Extend `MapRenderer` with the minimum renderer-neutral event contract needed. Do not expose Leaflet runtime/event types outside the concrete Leaflet adapter/renderer.

Selection highlight is transient and must not mutate saved styles or dirty the project. Renderer reinitialization must keep canonical project data intact and restore valid selection by stable ID where practical.

### History

History operates on domain state, not Leaflet state. A bounded normalized-project snapshot history (for example 100 entries) is explicitly acceptable and preferred if it keeps implementation simpler and deterministic.

Continuous drag/edit interactions must coalesce into one logical history entry.

### Dirty baseline

Replace one-way boolean dirty logic with a saved/load baseline comparison so undoing exactly back to the baseline restores `Saved`. History restore must not redefine the saved baseline.

## Required product scope

### Selection

- one canonical selection state;
- map ↔ panel synchronization;
- row scroll-into-view when practical;
- inspector follows selection;
- selected map feature has visible non-persisted highlight;
- selection absent from serialization.

### Object/layer panel

Every persisted feature appears exactly once.

Required feature actions: select, visibility toggle, lock toggle, rename, duplicate, zoom to, delete.

Required group behavior: create group, expand/collapse, rename, visibility toggle, lock toggle, delete group by moving children to Ungrouped and removing the group in one undoable transaction, and group assignment through inspector.

Group effective state must preserve child flags.

### Duplicate

Duplicate must generate a new feature ID and new nested radius IDs, preserve semantic content/group, use deterministic copy naming, select the duplicate, and create one history entry.

### Inspector

Common controls: name, group, visibility, lock.

Feature-specific minimum controls:

- marker: color + radius add/edit/delete;
- text: text, color, rotation, font size, font weight, halo;
- polyline: stroke color/weight/opacity/dash where supported;
- arrow: stroke color/weight while preserving semantic arrow head;
- polygon/rectangle: stroke/fill/weight/fill opacity;
- circle: radius + stroke/fill styling; safe center editing is optional.

Normal panel edits should not require modal dialogs. Existing modal workflows may remain as compatibility routes where useful.

### History

Undo/redo must cover at least create, delete, marker/text move, geometry edit, style edit, rename/text/property edit, radius add/edit/delete, duplicate, group create/rename/delete, group assignment, and feature/group visibility/lock changes.

Rules: new mutation after undo clears redo; loading another project resets history; search/selection/hover/panel expansion create no history entry; passive pan/zoom need not enter feature history; save should not erase usable history unless unavoidable and documented.

### Project status

Show `Saved` / `Unsaved changes` visibly but unobtrusively. New/load/open establishes baseline; persisted mutation becomes Unsaved; save establishes new baseline; undo to saved baseline becomes Saved; UI-only interactions never dirty.

### Search

Show multiple geocoder results; selecting one previews/navigates transiently; Add to project is explicit; preview is absent from project JSON; Add creates a normal marker plus one history entry; CI uses mocked geocoder results.

### Keyboard

- `Escape`: cancel active transient operation first; otherwise clear selection;
- `Delete`/`Backspace`: delete selected feature only outside editable fields;
- `Ctrl/Cmd+Z`: undo;
- `Ctrl/Cmd+Shift+Z` and/or `Ctrl/Cmd+Y`: redo;
- `Ctrl/Cmd+S`: project save without browser-save-page behavior.

## Dense-project UAT

Use exactly `docs/v2/fixtures/project-v2-dense-workspace.json`, containing 40 features across four groups.

Verify primarily through the panel: locate a named feature; select/zoom; hide/show; lock/unlock; rename; duplicate and verify new IDs; move groups; edit a property; delete; undo/redo; and prove group toggles do not overwrite child state.

## Required automated tests

### Architecture regression

Preserve A3 architecture tests and prove domain/persistence/store remain renderer-runtime-free, workspace state uses stable IDs/domain snapshots only, production does not expose test globals, and renderer replacement does not mutate project data.

### Selection/object panel

Test map→row, row→map, inspector sync, selection clearing after delete, non-serialization, group effective state, duplicate feature/radius IDs, and undoable delete-group-by-ungrouping.

### History

For every core mutation category prove `before → execute → undo == before → redo == after`. Also prove continuous drag/edit produces one logical entry, redo clears after divergent edit, load resets history, UI-only state is absent, and baseline semantics survive history restore.

### Dirty state

Test initial/load Saved, selection/search not dirty, feature/group mutation dirty, save baseline, undo to baseline Saved, redo away Unsaved.

### Search

Test multiple visible results, transient preview, serialization exclusion, Add stable marker, Add undo/redo, mocked network.

### Responsive/accessibility

Browser checks at minimum: ~1440×900 desktop, 1366×768 laptop, ~900 px tablet/narrow, ~390×844 mobile smoke. Assert no horizontal workspace overflow, map visibility, reachable primary actions, accessible selected state, accessible icon buttons, visible focus, and correct keyboard routing where practical.

## Visual design rule

Preserve the established Map Tools visual character and map-first hierarchy. Do not introduce a generic analytics/dashboard aesthetic.

Preferred desktop composition is a compact tool rail + primary map + approximately 320–380 px object/inspector panel, with responsive collapse/overlay at narrower widths. This is not pixel-perfect; usability and consistency take precedence.

## Required regression gates

At final qualification run at least:

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

Also perform a plain static-server production-build smoke if the A3 deployment model still supports it. All accepted A1+A2+A3 behavior/security/architecture tests must remain green.

## Explicit non-scope

Do not implement MapLibre, Three.js, visible 3D/2.5D, engineering symbols, advanced buffers, report composer, interoperability expansion, full GIS symbology, collaboration, full multi-select/bulk editing, drawing-engine replacement, Leaflet 2, or React/another framework unless a genuine blocker is escalated before implementation.

## Required handoff

Create `docs/v2/B_QUALIFICATION.md` containing base SHA, B1 checkpoint SHA, B2 checkpoint SHA, final head SHA, exact validation results/test counts, dense UAT evidence, responsive/accessibility matrix, history/dirty evidence, architecture regression evidence, CI, limitations, and explicit decisions `MACRO_PHASE_B_QUALIFIED`/`MACRO_PHASE_B_NOT_QUALIFIED` plus `READY_FOR_C4_3D_PREVIEW`/`NOT_READY_FOR_C4_3D_PREVIEW`.

Open one PR against `main` that closes issue #5. Do not merge.
