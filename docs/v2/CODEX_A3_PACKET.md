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

## Objective

Migrate the qualified application to a maintainable Vite + TypeScript structure while preserving accepted behavior and persistence semantics.

This is an architecture migration, not a redesign.

## Required outputs

- `package.json` and lockfile;
- Vite production/static build;
- TypeScript strict configuration;
- npm-managed dependencies;
- modular source tree;
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
- no DOM imports.

### `persistence/`

- serializer/deserializer/migration/validation;
- accepts/returns domain objects;
- no Leaflet runtime objects.

### `map/`

- Leaflet initialization/render/update;
- `Coordinate` ↔ `L.LatLng` adapter;
- renderer-specific feature mapping.

### `drawing/`

- adapter around current Leaflet.draw behavior;
- translates drawing events to domain commands/data;
- Leaflet.draw must not leak into persistence/domain interfaces.

### `store/`

- canonical project state;
- selection/runtime UI state separated from persisted project state.

## Migration rules

- preserve qualified A1 behavior unless an A2-correctness/security rule intentionally changes it;
- preserve Project Schema v2 JSON semantics;
- do not redesign the workspace in this packet;
- do not replace Leaflet.draw;
- do not migrate to Leaflet 2;
- do not add React or another UI framework unless an unavoidable blocker is demonstrated and returned for review first.

## Build/dependency rules

- replace Tailwind Play CDN usage with a production-supported build path or equivalent local styling approach;
- third-party production JS/CSS dependencies should be npm-managed where practical;
- lock dependency versions through the package lockfile;
- clean checkout must be sufficient to reproduce install/build/test.

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
- domain unit tests run in a non-browser environment;
- serializer tests run without map rendering;
- asymmetric coordinate test proves adapter order.

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
12. quick image export remains usable if still in scope.

## Non-scope

- object manager redesign;
- undo/redo;
- engineering symbols;
- report composer;
- interoperability expansion;
- drawing-engine replacement.

## Required handoff

`docs/v2/A3_QUALIFICATION.md` must record:

- base/head SHA;
- exact install/test/typecheck/lint/build commands;
- browser qualification matrix;
- CI run link/status;
- architecture deviations if any;
- known limitations;
- whether Macro Phase A is fully qualified.

Open a PR against `main`; do not self-merge unless explicitly instructed.
