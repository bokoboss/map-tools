# Codex Execution Packet — A3 Vite + TypeScript Modularization

Status: bounded implementation packet  
Date: 2026-08-25

## Preconditions

Do not start this packet until A1 and A2 are qualified and their PRs are merged.

Required authoritative references:

- `MASTER_EXECUTION_PLAN.md`
- `ARCHITECTURE.md`
- `DOMAIN_MODEL_CONTRACT.md`
- `PROJECT_SCHEMA_V2.md`
- `TEST_AND_UAT_PLAN.md`
- `DECISIONS.md`
- `PROJECT_PROFILE.md`

## Objective

Migrate the qualified application to a maintainable Vite + TypeScript structure while preserving accepted behavior and persistence semantics.

This is an architecture migration, not a redesign.

A3 must also establish a **renderer boundary that is ready for a future second renderer**. The current implementation remains Leaflet-based, but domain/store/persistence/UI contracts must not assume that Leaflet is the only possible map renderer. A future MapLibre-based 2.5D/3D visualization mode should be addable without changing Project Schema semantics or re-owning canonical project state.

**A3 does not implement 3D. It only prevents A3 from making 3D unnecessarily expensive later.**

## Required outputs

- Vite production/static build;
- TypeScript strict configuration;
- npm-managed dependencies and committed lockfile;
- modular source tree;
- explicit renderer interface/adapter boundary;
- lint/type-check/test/build scripts;
- GitHub Actions qualification;
- GitHub Pages/static deployment compatibility;
- `docs/v2/A3_QUALIFICATION.md`.

## Required architectural boundaries

Target conceptual tree:

```text
src/
  app/
  domain/
  store/
  map/
    renderer/
    leaflet/
  drawing/
  persistence/
  geocoding/
  measurement/
  ui/
  utils/
```

Exact filenames may differ, but responsibilities must remain separated.

### `domain/`

- pure TypeScript types/invariants;
- no Leaflet imports;
- no MapLibre/Three imports;
- no DOM imports.

### `persistence/`

- serializer/deserializer/migration/validation;
- accepts/returns domain objects;
- no Leaflet, MapLibre, Three.js, or renderer runtime objects.

### `store/`

- canonical project state;
- selection/runtime UI state separated from persisted project state;
- renderer implementations consume store/domain state and must not become an alternate project database.

### `map/renderer/`

Define the smallest useful renderer-facing contract needed by the accepted application. Exact naming may vary, but the architecture should support concepts equivalent to:

```ts
interface MapRenderer {
  setView(view: MapView): void;
  getView(): MapView;
  renderProject(project: ProjectDocument): void;
  upsertFeature(feature: ProjectFeature): void;
  removeFeature(featureId: string): void;
  setFeatureVisibility(featureId: string, visible: boolean): void;
  selectFeature(featureId: string | null): void;
  fitFeature(featureId: string): void;
  destroy(): void;
}
```

Do not force this exact surface if a smaller contract is demonstrably better. The invariant is more important than the syntax:

> Application/domain code talks to a renderer abstraction; Leaflet-specific objects and events stay inside the Leaflet implementation boundary.

The renderer abstraction must not encode Leaflet-only concepts such as `L.Layer`, `L.LatLng`, Leaflet stamps, panes, or feature groups in cross-module interfaces.

### `map/leaflet/`

- Leaflet initialization/render/update;
- `Coordinate` ↔ `L.LatLng` conversion;
- renderer-specific feature mapping;
- popup/layer implementation details;
- Leaflet event bridge into application/domain commands.

### `drawing/`

- adapter around current Leaflet.draw behavior;
- translates drawing events to domain commands/data;
- Leaflet.draw must not leak into persistence/domain interfaces;
- drawing ownership may remain Leaflet-specific in A3 because true renderer-neutral 3D editing is explicitly not required.

## Future 3D-readiness constraints

These are A3 architecture constraints, not A3 features:

1. **Project Schema remains renderer-neutral.** Do not add MapLibre/Three runtime structures to persisted data.
2. **Coordinate semantics remain WGS84 `[longitude, latitude]`.** Individual renderers own their runtime coordinate conversion.
3. **View state remains semantic.** Current persisted center/zoom/basemap must not be replaced by Leaflet classes. Future pitch/bearing/elevation fields may be added through a versioned schema change when 3D is actually implemented.
4. **Feature identity is shared across renderers.** A marker/polygon/arrow/text feature keeps the same stable domain ID regardless of renderer.
5. **2D editing remains authoritative initially.** Future 3D can begin as a visualization mode without requiring duplicate edit logic.
6. **Renderer lifecycle is explicit.** It must be technically possible to destroy the Leaflet renderer and create another renderer against the same store/project without reloading or migrating project data.
7. **No premature abstraction.** Do not add MapLibre or Three.js dependencies in A3 only to prove future capability; instead make boundaries clean enough that those dependencies can be introduced later.

## Migration rules

- preserve qualified A1 behavior unless an A2-correctness/security rule intentionally changes it;
- preserve Project Schema v2 JSON semantics;
- preserve all accepted browser characterization and security coverage;
- do not redesign the workspace in this packet;
- do not replace Leaflet.draw;
- do not migrate to Leaflet 2;
- do not add React or another UI framework unless an unavoidable blocker is demonstrated and returned for review first;
- do not replace Leaflet with MapLibre in A3;
- do not implement terrain, building extrusion, camera pitch/orbit, Three.js assets, or any visible 3D mode in A3.

## Build/dependency rules

- replace Tailwind Play CDN usage with a production-supported build path or equivalent local styling approach;
- third-party production JS/CSS dependencies should be npm-managed where practical;
- lock dependency versions through the package lockfile;
- clean checkout must be sufficient to reproduce install/build/test;
- browser tests should no longer rely on public CDN availability for application runtime libraries after A3 migration.

## Required tests/gates

Run and preserve:

- all A1 characterization tests;
- all A2 persistence/security tests;
- TypeScript type-check;
- lint;
- unit/integration tests;
- browser smoke;
- production build;
- clean-install CI.

Add architecture tests/guards where practical:

- domain/persistence modules do not import Leaflet;
- domain/persistence modules do not import renderer libraries;
- domain unit tests run in a non-browser environment;
- serializer tests run without map rendering;
- asymmetric coordinate test proves adapter order;
- renderer-neutral application interfaces do not expose Leaflet classes/types;
- Leaflet renderer can be initialized and destroyed without mutating canonical project data.

## Manual browser qualification

Verify at minimum:

1. app loads at production/dev build;
2. map renders;
3. change basemap;
4. create/edit/delete marker;
5. marker radius;
6. text;
7. line/polygon/rectangle/circle;
8. arrow;
9. search;
10. save/open Project Schema v2;
11. v1 import fixture;
12. quick image export remains usable if still in scope;
13. renderer initialization/reinitialization does not lose or mutate project state.

## Non-scope

- object manager redesign;
- undo/redo;
- engineering symbols;
- report composer;
- interoperability expansion;
- drawing-engine replacement;
- MapLibre migration;
- Three.js integration;
- visible 3D/2.5D mode;
- terrain/building extrusion/3D assets.

## Required handoff

`docs/v2/A3_QUALIFICATION.md` must record:

- base/head SHA;
- exact install/test/typecheck/lint/build commands;
- browser qualification matrix;
- architecture/renderer-boundary evidence;
- CI run link/status;
- architecture deviations if any;
- known limitations;
- whether Macro Phase A is fully qualified;
- whether the resulting architecture is `READY_FOR_FUTURE_3D_RENDERER` or `NOT_READY_FOR_FUTURE_3D_RENDERER`.

Open a PR against `main`; do not self-merge unless explicitly instructed.
