# Map Tools v2 — Implementation Roadmap

Status: execution roadmap  
Date: 2026-08-25

## 1. Delivery strategy

The implementation should be performed as a sequence of bounded phases. Each phase has a narrow purpose and a qualification gate. Avoid combining architecture migration, drawing-engine replacement, major visual redesign, and new engineering features in one branch.

The guiding rule is:

> Preserve behavior first, make state reliable second, modularize third, improve workflow fourth, then add domain features.

## 2. Phase 0 — Baseline characterization and safety net

### Goal

Make the current behavior observable and protect useful v1 functionality before structural changes.

### Work

- introduce npm/Vite-compatible test infrastructure with minimum disturbance to current runtime;
- add browser characterization tests for marker, radii, shapes, arrow, text, search, and save/open;
- add a small representative v1 project fixture;
- document currently known persistence losses rather than encoding them as expected v2 behavior;
- add CI for tests/build once package tooling exists.

### Acceptance

- baseline smoke suite passes on `main` behavior;
- known defects are marked explicitly;
- test fixtures are deterministic;
- no user-facing redesign required.

### Codex effort profile

Good candidate for a bounded implementation packet using a cost-efficient model once test expectations are explicit.

## 3. Phase 1 — Project Schema v2 and persistence hardening

### Goal

Eliminate silent project-data loss and unsafe project loading.

### Work

- implement Project Schema v2 types;
- implement validation;
- implement serializer/deserializer;
- implement v1 migration/import path;
- assign stable IDs;
- preserve marker radius data;
- persist text and arrow semantics explicitly;
- validate before replacing active project;
- add XSS-safe text rendering;
- add full round-trip unit/integration tests.

### Acceptance

- all feature-type round-trip tests pass;
- invalid project files leave current work unchanged;
- malicious labels render as text;
- unknown basemap falls back without losing project content;
- project JSON no longer depends on Leaflet runtime IDs or feature groups.

## 4. Phase 2 — Vite + TypeScript modular architecture

### Goal

Convert the implementation into a maintainable structure without materially changing product behavior.

### Work

- Vite app entry;
- TypeScript strict mode;
- npm-managed Leaflet/dependencies;
- lockfile;
- domain/store/map/persistence/geocoding/measurement boundaries;
- drawing adapter around current drawing library;
- remove global app state progressively;
- lint/type-check/build CI.

### Acceptance

- existing browser characterization and v2 persistence suites remain green;
- production static build works on GitHub Pages-compatible hosting;
- no third-party Play CDN dependency for Tailwind-style production assets;
- project serialization and measurement tests do not require Leaflet rendering.

## 5. Phase 3 — Workspace UX foundation

### Goal

Make projects with many objects manageable and recoverable from editing mistakes.

### Work

- explicit selection model;
- object/layer panel;
- property inspector;
- groups/layers;
- visibility and lock;
- rename;
- duplicate;
- zoom to feature;
- undo/redo command history;
- keyboard Escape/Delete behavior;
- dirty/saved indicator;
- search-result isolation and explicit add-to-project action.

### Acceptance

- dense-project UAT succeeds;
- map and panel selection stay synchronized;
- group visibility/lock semantics pass tests;
- core undo/redo matrix passes;
- search no longer silently changes project content.

## 6. Phase 4 — Engineering toolkit

### Goal

Differentiate Map Tools from generic map annotation apps by optimizing common traffic/transport/infrastructure workflows.

### Work

- engineering symbol library;
- semantic style presets;
- enhanced measurement panel;
- bearing/azimuth;
- polygon perimeter;
- buffer tools;
- coordinate parser/converter;
- initial Thai engineering defaults.

### Initial symbol set

- project site;
- intersection;
- access/egress;
- U-turn;
- traffic signal;
- TMC survey;
- mid-block survey;
- pedestrian survey;
- parking survey;
- camera/CCTV;
- bus stop;
- taxi/loading;
- accident/conflict point.

### Acceptance

A typical traffic study map can be prepared without manually approximating generic marker meaning through arbitrary colors/text.

## 7. Phase 5 — Report-quality export

### Goal

Produce report/presentation maps without manual reconstruction in PowerPoint or graphics software.

### Work

- separate quick capture from report export;
- output composition area;
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

### Acceptance

- exported output does not contain app controls;
- map furniture is deterministic;
- attribution is preserved as required;
- report output is suitable for insertion into a technical report at normal print resolution.

## 8. Phase 6 — Interoperability and image overlay

### Goal

Connect Map Tools to common engineering/GIS handoffs without becoming a full GIS.

### Work

First:

- GeoJSON import/export;
- CSV point import/export.

Then:

- KML/KMZ;
- GPX where useful;
- site-plan image overlay;
- opacity/lock/transform;
- controlled georeferencing workflow.

### Acceptance

Common field/survey and GIS point/geometry data can enter/leave the project without losing basic feature meaning.

## 9. Deferred technology decisions

Evaluate only after v2 Core qualification:

- Leaflet-Geoman vs Terra Draw vs continuing Leaflet.draw;
- Leaflet 2 migration;
- React or another UI framework;
- PWA/offline packaging;
- desktop wrapper.

These are decisions, not current requirements.

## 10. Recommended pull-request boundaries

Prefer one PR per bounded objective, for example:

1. `phase-0-test-harness`
2. `phase-1-project-schema`
3. `phase-1-safe-persistence`
4. `phase-2-vite-typescript`
5. `phase-2-module-extraction`
6. `phase-3-selection-object-panel`
7. `phase-3-history`
8. `phase-3-search-isolation`
9. later engineering/export PRs

Avoid a single `rewrite-v2` PR.

## 11. Release qualification checklist

Before calling v2 Core complete:

- [ ] all supported feature types survive two save/open cycles;
- [ ] invalid import preserves active project;
- [ ] security payload tests pass;
- [ ] stable IDs verified;
- [ ] object panel and map selection synchronized;
- [ ] undo/redo matrix passes;
- [ ] search result isolation passes;
- [ ] responsive smoke matrix passes;
- [ ] 500-object performance smoke passes;
- [ ] production build passes;
- [ ] CI green;
- [ ] manual UAT scenarios recorded.

## 12. Stop conditions

Do not proceed to engineering feature expansion if any of these remain unresolved:

- save/open can silently lose supported feature semantics;
- unsafe HTML injection remains possible from project text;
- current project can be destroyed by failed import;
- architecture still requires Leaflet runtime objects for persistence;
- core test suite is unreliable or non-deterministic.
