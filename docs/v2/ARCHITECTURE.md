# Map Tools v2 — Architecture

Status: implementation architecture draft  
Date: 2026-08-25

## 1. Architectural objective

Map Tools v2 should preserve the lightweight browser-first character of the current application while removing the two largest sources of technical risk:

1. application state is encoded implicitly in Leaflet runtime objects;
2. unrelated behavior is coupled through one global JavaScript module.

The target architecture is a small TypeScript application with a versioned domain model, explicit services, deterministic serialization, and Leaflet isolated behind rendering/editing adapters.

## 2. Recommended stack

For the v2 Core:

- Vite;
- TypeScript with strict mode;
- Leaflet 1.9.x;
- existing drawing engine initially, behind an adapter boundary;
- npm-managed dependencies with lockfile;
- Vitest for unit/component-light tests;
- Playwright for browser acceptance tests;
- ESLint and Prettier or equivalent formatting/lint gates.

Do not combine the v2 Core with a Leaflet 2 migration or a drawing-engine migration. Those can be evaluated after behavior is stable and tested.

## 3. Architectural rules

### R-01 — Domain state is canonical

The project-domain model is the source of truth.

Leaflet layers are projections of domain features. Direct mutations to Leaflet layers must ultimately dispatch a domain command/update.

### R-02 — Rendering is replaceable

Leaflet-specific objects and APIs must not leak into project serialization, command history, validation, or import/export logic.

### R-03 — Persistence is explicit and versioned

Every project file has a `schemaVersion`. Loading is a pipeline:

`read -> parse -> validate -> migrate -> normalize -> commit to store -> render`

A failure before commit must not mutate the active project.

### R-04 — Side effects live in services

Geocoding, file download/read, browser storage, tile configuration, and export are services rather than mixed into UI event handlers.

### R-05 — Commands are reversible when practical

Normal map-editing operations are represented as commands or equivalent state transitions suitable for undo/redo.

## 4. Proposed module layout

```text
src/
  main.ts
  app/
    AppController.ts
    commands/
    history/
    selection/
  domain/
    project.ts
    feature.ts
    style.ts
    groups.ts
    validation.ts
  store/
    ProjectStore.ts
    selectors.ts
  map/
    LeafletMapAdapter.ts
    LeafletFeatureRenderer.ts
    LeafletEventBridge.ts
    drawing/
      DrawingAdapter.ts
      LeafletDrawAdapter.ts
  persistence/
    projectSchema.ts
    serializeProject.ts
    deserializeProject.ts
    migrations/
  geocoding/
    GeocodingService.ts
    NominatimGeocoder.ts
  measurement/
    distance.ts
    area.ts
    bearing.ts
    thaiArea.ts
  export/
    QuickPngExporter.ts
    report/
  ui/
    toolbar/
    objects/
    inspector/
    dialogs/
    statusbar/
  security/
    safeText.ts
  utils/

tests/
  unit/
  integration/
  e2e/
```

Exact filenames are not mandatory. The boundaries are.

## 5. Domain model

The domain layer contains plain serializable data only. It must not contain:

- `L.Marker`;
- `L.Polyline`;
- DOM nodes;
- event callbacks;
- library-specific IDs;
- transient modal state.

Example conceptual type:

```ts
interface MapFeature {
  id: string;
  type: FeatureType;
  name: string;
  groupId: string | null;
  visible: boolean;
  locked: boolean;
  geometry: FeatureGeometry;
  style: FeatureStyle;
  properties: FeatureProperties;
}
```

Discriminated unions should be used so that a circle cannot accidentally carry arrow-only data or a text feature omit required text properties.

## 6. Project store

A small application-specific store is preferred over adding a large state-management dependency prematurely.

Responsibilities:

- hold active `ProjectDocument`;
- expose read-only snapshots/selectors;
- apply validated commands/transitions;
- manage dirty state;
- emit update notifications;
- coordinate selection and history boundaries.

The store must not call Leaflet directly.

## 7. Leaflet adapter

### 7.1 Renderer

`LeafletFeatureRenderer` owns the mapping between domain feature IDs and Leaflet layers.

Example responsibilities:

- create layer for a domain feature;
- update layer when domain state changes;
- remove layer when feature is deleted;
- apply visibility/lock/style;
- preserve an internal `featureId -> Leaflet layer` map.

### 7.2 Event bridge

Leaflet events are translated into application commands.

Examples:

- marker drag end -> `MoveFeatureCommand`;
- shape edit end -> `UpdateGeometryCommand`;
- draw created -> `AddFeatureCommand`;
- map click in text mode -> begin text-feature creation flow.

### 7.3 Drawing adapter

Drawing-library usage should be hidden behind an interface so Leaflet.draw can later be replaced without changing domain/persistence code.

Conceptual API:

```ts
interface DrawingAdapter {
  start(tool: DrawTool): void;
  cancel(): void;
  setEditable(featureId: string, enabled: boolean): void;
}
```

## 8. Command/history model

Commands should contain enough information to apply and revert a user action.

Initial commands:

- AddFeature;
- DeleteFeature;
- UpdateGeometry;
- UpdateStyle;
- UpdateName;
- UpdateFeatureProperties;
- MoveFeature;
- DuplicateFeature;
- SetVisibility;
- SetLocked;
- AssignGroup;
- AddGroup / RenameGroup / DeleteGroup where applicable.

History requirements:

- undo and redo stacks;
- new command clears redo stack;
- project load/new resets history;
- transient selection changes are not history commands;
- continuous drag/slider input should be coalesced into one committed history item where practical.

## 9. Persistence architecture

### Save pipeline

1. obtain immutable project snapshot;
2. normalize ordering where deterministic output is useful;
3. validate internal invariants;
4. serialize to Project Schema v2;
5. generate JSON file.

### Open pipeline

1. read file as text;
2. parse JSON;
3. validate envelope/schema version;
4. migrate older supported schema;
5. validate normalized result;
6. build temporary project document;
7. only then replace active project;
8. fit/restore map view as specified.

Never call `clearMap()` before validation succeeds.

## 10. Security architecture

All user-provided strings are plain text unless explicitly documented otherwise.

Rules:

- avoid building HTML strings from user data;
- prefer DOM element construction and `textContent`;
- project-file imports must not create event-handler attributes or arbitrary markup;
- external URL strings from project data must not be trusted as executable content;
- validation should apply size/count limits to prevent pathological files from freezing the app.

Recommended initial file limits are implementation safeguards, not product promises. They should be generous enough for normal engineering projects and documented in code/tests.

## 11. Geocoding architecture

Search results are transient application state, not project features.

`GeocodingService` returns normalized results:

```ts
interface GeocodingResult {
  id: string;
  label: string;
  lat: number;
  lon: number;
  boundingBox?: [number, number, number, number];
}
```

Only an explicit `Add to project` action converts a result into a marker/domain feature.

Provider-specific request throttling and attribution remain inside the provider implementation.

## 12. Measurements

Derived values should be pure functions where possible.

Examples:

- `polylineLength(geometry)`;
- `polygonArea(geometry)`;
- `polygonPerimeter(geometry)`;
- `bearing(a, b)`;
- `formatThaiArea(squareMetres)`.

These functions should be unit-tested independently from Leaflet and the DOM.

## 13. Export architecture

Keep two separate concepts:

### Quick capture

A fast PNG of the current map composition for informal use.

### Report composer

A later deterministic layout pipeline that renders map content plus map furniture (legend, north arrow, scale, title, attribution) into a controlled output size.

Do not make report export depend on hiding application controls and screenshotting the entire app DOM.

## 14. Migration strategy from v1

### Step A — Characterize current behavior

Add browser tests around the existing static application before large refactoring.

### Step B — Introduce schema/domain conversion alongside current renderer

Implement conversion functions that can create domain features from current UI actions and render domain features through Leaflet.

### Step C — Replace ad-hoc save/open

Move persistence to the versioned project model.

### Step D — Introduce Vite/TypeScript structure

Migrate behavior module by module while keeping browser tests green.

### Step E — Replace object-local global state with selection/store state

Only after the domain/store is stable, build object manager and inspector UI.

## 15. Drawing-engine decision

Do not migrate drawing libraries in the same change set as the architecture conversion.

After v2 Core qualification, compare at least:

- continued Leaflet.draw use;
- Leaflet-Geoman;
- Terra Draw.

Decision criteria:

- Leaflet compatibility;
- editing stability;
- snapping;
- rotate/scale/cut capability;
- TypeScript quality;
- maintenance activity;
- migration cost;
- license;
- testability.

## 16. Architecture acceptance criteria

The architecture phase is complete when:

- project state can be serialized without inspecting Leaflet objects;
- persistence tests run without rendering a map;
- measurements can be tested without Leaflet;
- map rendering can rebuild from a domain project snapshot;
- search results are not stored as project features unless explicitly converted;
- user strings do not require unsafe HTML interpolation;
- undo/redo operates on domain operations;
- CI runs lint, type-check, unit tests, and browser smoke tests.
