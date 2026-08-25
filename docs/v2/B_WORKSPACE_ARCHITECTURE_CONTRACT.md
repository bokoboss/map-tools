# Map Tools v2 — Macro Phase B Workspace Architecture Contract

Status: implementation contract
Date: 2026-08-25

## 1. Purpose

Macro Phase B adds productive workspace behavior on top of the accepted A3 renderer-ready architecture. The implementation must improve editing productivity without moving canonical ownership back into Leaflet or the DOM.

The required ownership model is:

```text
ProjectDocumentV2
      │
ProjectStore + History/Baseline
      │
Workspace UI state ───── Object Panel / Inspector / Keyboard / Search
      │
MapRenderer / RendererHost
      │
LeafletRenderer (current) / future renderer
```

## 2. Canonical persisted state

`ProjectStore` remains the only canonical owner of persisted project state.

Persisted state includes:

- project metadata;
- map view/basemap;
- groups;
- features and nested radius rings.

Do not store DOM nodes, Leaflet objects, runtime layer IDs, selection highlight state, active tools, open panels, search previews, or history implementation objects inside `ProjectDocumentV2`.

## 3. Workspace/UI state

Introduce a small renderer-neutral workspace-state abstraction (name may differ) for transient UI state.

Minimum state:

- selected feature ID or null;
- active/expanded workspace panel state where useful;
- active drawing/editing state where useful;
- current search results and selected search preview where useful.

Single-feature selection is sufficient for Macro Phase B. Do not expand scope into a full multi-select editing system.

Selection stores stable `FeatureId`, never `L.Layer`, `L.LatLng`, Leaflet stamp IDs, DOM elements, or renderer-private objects.

## 4. Renderer selection contract

Map → panel selection requires a renderer-neutral event path.

Extend the renderer abstraction with the smallest stable contract needed, for example:

```ts
onFeatureSelect(listener: (featureId: FeatureId | null) => void): () => void
```

Exact naming may differ.

The concrete Leaflet renderer may map clicks to stable feature IDs internally, but Leaflet-only event/runtime types must stop at the renderer boundary.

`selectFeature(featureId)` remains a transient visual operation. Selection styling must not modify the persisted feature style or mark the project dirty.

Renderer replacement/reinitialization must preserve selection by stable ID where that ID still exists, without copying renderer objects.

## 5. Object/layer panel model

Render panel rows from canonical `project.groups` and `project.features`.

Required groups:

- all persisted groups sorted by `order`;
- an implicit **Ungrouped** section for `groupId: null` features.

Each feature appears exactly once.

Minimum feature-row actions:

- select;
- visibility toggle;
- lock toggle;
- rename;
- duplicate;
- zoom to;
- delete.

Required group actions:

- create group;
- expand/collapse as UI-only state;
- rename;
- visibility toggle;
- lock toggle;
- delete group by **ungrouping its children**, not deleting child features;
- assign/move a feature to another group or Ungrouped through the inspector.

Deleting a group must therefore set affected feature `groupId` to null in the same undoable domain transaction and remove the group. Do not add a second destructive “delete group and all contents” workflow in Macro Phase B.

Group visibility/lock semantics remain:

```text
effectiveVisible = group.visible && feature.visible
effectiveLocked  = group.locked || feature.locked
```

Toggling a group must never overwrite child flags.

## 6. Duplicate semantics

Duplicating a feature must:

- create a new stable feature ID;
- preserve semantic type, geometry, style, properties, visibility, lock, and group assignment;
- use a distinct user-visible name such as `<name> Copy` with deterministic conflict handling;
- regenerate nested radius IDs for marker radius rings;
- select the duplicate after creation;
- create one undoable history entry.

Do not use Leaflet runtime cloning as the source of truth.

## 7. Inspector editing

Inspector edits canonical domain state directly through store/domain mutation APIs.

Common controls:

- name;
- group assignment;
- visibility;
- lock.

Feature-specific minimum controls:

- marker: color and radius-ring add/edit/delete;
- text: text, color, rotation, font size, font weight, halo;
- polyline: stroke color, weight, opacity/dash where supported;
- arrow: stroke color, weight; semantic arrow head remains `end`;
- polygon/rectangle: stroke color/weight, fill color, fill opacity;
- circle: radius, stroke/fill style; center coordinate editing may be included if implemented safely.

Normal inspector edits should not require the old modal workflow. Existing modal actions may remain as secondary compatibility routes if they continue to pass tests.

Input validation must reuse domain/persistence constraints rather than inventing renderer-specific validation.

## 8. History model

History is domain history, not renderer history.

For this product scale, a bounded normalized-project snapshot history is acceptable and preferred over a large command-class hierarchy if it remains deterministic and well tested.

Recommended behavior:

- retain up to 100 committed domain mutations;
- each history entry contains deterministic before/after canonical project state plus an optional label;
- undo restores the previous canonical project snapshot;
- redo restores the next canonical project snapshot;
- new mutation after undo clears redo;
- opening/loading another project clears history;
- selection/search/panel expansion/hover create no history entries.

### Continuous interaction rule

A drag or continuous geometry interaction must create **one logical history entry**, not one entry per mousemove/drag event.

Use transaction/coalescing semantics where needed:

```text
interaction start → capture before
intermediate canonical/render updates allowed
interaction end → commit one after snapshot
```

If the current renderer can keep intermediate movement visual without writing every intermediate position to canonical state, that is also acceptable. The final canonical state must be committed at interaction end.

Do not weaken marker-radius follow behavior or geometry editing to achieve history support.

## 9. Dirty/saved baseline

Replace one-way boolean dirty logic with a saved-baseline model capable of recognizing return to the saved state.

Required semantics:

- load/open establishes a saved baseline and clears history;
- initial new project begins as saved until a persisted mutation occurs;
- save establishes the current canonical state as the new saved baseline;
- undo back to the saved baseline reports `Saved`;
- redo/mutation away from it reports `Unsaved changes`;
- selection/search/hover/panel state never affects dirty status.

A deterministic normalized serialization/fingerprint or equivalent canonical comparison is acceptable.

History restoration must **not** accidentally redefine the saved baseline.

## 10. Map view and history

Map view is persisted in Project Schema v2 and therefore may affect dirty state.

Passive pan/zoom does not need to create undo/redo history entries in Macro Phase B. It may update the persisted map view and dirty baseline as currently designed. Do not let rapid map movement flood the feature-edit history stack.

## 11. Keyboard routing

Keyboard handling must be centralized enough to avoid conflicting listeners.

Required routing:

- `Escape`: cancel drawing/edit/modal/transient action first; if none, clear selection;
- `Delete` / `Backspace`: target selected feature only when focus is not in input/textarea/select/contenteditable;
- `Ctrl/Cmd+Z`: undo;
- `Ctrl/Cmd+Shift+Z` and `Ctrl/Cmd+Y`: redo;
- `Ctrl/Cmd+S`: prevent browser save-page behavior and invoke project save where supported.

Never trigger delete/undo shortcuts while a text field is consuming the same keystroke inappropriately.

## 12. Search state

Geocoding remains a renderer-neutral service.

Required search behavior:

- show multiple returned matches in a result list;
- selecting a result updates a transient map preview/navigation state;
- search result preview is not a project feature;
- `Add to project` creates one normal marker with a new stable ID;
- adding to project is one undoable domain mutation;
- merely searching/selecting a result creates no history entry and does not dirty the project;
- browser tests use mocked geocoder responses.

## 13. Dense-project fixture

Use:

`docs/v2/fixtures/project-v2-dense-workspace.json`

It contains 40 semantic features across four persisted groups and is the canonical B dense-project UAT fixture.

Do not replace it with random/generated-at-runtime data for acceptance tests.

## 14. Responsive workspace

Preferred desktop structure:

```text
Top actions/search
┌──────────┬───────────────────────────────┬──────────────────────┐
│ Tool rail│             MAP               │ Objects / Layers     │
│          │                               │ Inspector            │
└──────────┴───────────────────────────────┴──────────────────────┘
Status: coordinates / zoom / selection / Saved|Unsaved
```

The map remains the primary visual surface.

Suggested right-panel width: approximately 320–380 px on desktop, responsive rather than fixed by contract.

Narrow/tablet behavior may use a collapsible/overlay panel. Mobile is view/light-edit support, not desktop feature-density parity.

Do not convert the product into a generic card/dashboard UI.

## 15. Accessibility

Minimum acceptance:

- icon-only buttons have accessible names;
- selected row exposes a non-color-only state (`aria-selected`, text/icon state, or equivalent);
- focus rings remain visible;
- panel rows/actions are keyboard reachable;
- modal/dialog focus handling is not regressed;
- narrow/mobile layouts do not make primary controls unreachable;
- no horizontal document scrolling caused by workspace chrome at tested widths.

## 16. Protected architecture

Macro Phase B must preserve A3 guarantees:

- domain/persistence/store contain no Leaflet/MapLibre/Three runtime objects;
- `MapRenderer` remains renderer-neutral;
- Project Schema v2 remains renderer-neutral;
- no MapLibre or Three.js dependency is required for B;
- `?test=1` remains the only route that exposes test-only browser hooks/legacy globals;
- normal production runtime must not expose the test surface.

## 17. Explicit non-scope

- visible 3D/2.5D mode;
- MapLibre/Three.js implementation;
- engineering symbol library;
- buffer toolkit;
- report composer;
- full GIS symbology editor;
- collaborative state;
- multi-select bulk editing beyond minimal future-compatible state design;
- drawing-engine replacement;
- Leaflet major-version migration;
- React/framework migration unless an unavoidable blocker is escalated before implementation.
