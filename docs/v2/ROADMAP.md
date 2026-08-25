# Map Tools v2 — Implementation Roadmap

Status: execution roadmap  
Date: 2026-08-25

## 1. Delivery strategy

Map Tools v2 is organized into **three macro phases**. The older Phase 0–6 naming is retained only as bounded work packages / pull-request slices so implementation remains reviewable.

The guiding rule is:

> Reliable core first, productive workspace second, engineering delivery features third.

Do not combine unrelated high-risk changes into a single implementation branch merely to reduce the apparent phase count.

## 2. Macro Phase A — Reliable Core

This combines former Phase 0, Phase 1, and Phase 2.

### A1 — Characterization + CI (`#2`)

Goal: make current useful behavior observable before structural changes.

Required outcomes:

- deterministic browser characterization for marker, radii, shapes, arrow, text, search, and save/open;
- representative v1 fixtures;
- documented known persistence defects;
- repeatable local qualification;
- CI/build smoke from a clean checkout.

### A2 — Project Schema v2 + safe/lossless persistence (`#3`)

Goal: eliminate silent project-data loss and unsafe project loading.

Required outcomes:

- versioned Project Schema v2;
- stable IDs independent of Leaflet runtime IDs;
- explicit semantic persistence for marker, text, polyline, polygon, rectangle, circle, arrow, and marker radii;
- validate-before-replace project loading;
- v1 migration for recoverable content;
- safe plain-text rendering;
- complete round-trip/security tests.

### A3 — Vite + TypeScript modularization (`#4`)

Goal: make the qualified core maintainable without materially changing behavior.

Required outcomes:

- Vite build;
- TypeScript strict mode;
- npm-managed dependencies and lockfile;
- domain/store/map/persistence/geocoding/measurement boundaries;
- drawing adapter around the current drawing library;
- no persistence dependence on Leaflet runtime objects;
- lint/type-check/build CI;
- static/GitHub Pages-compatible production output.

### Macro Phase A completion gate

Do not proceed to major UX or engineering feature expansion until all are true:

- characterization suite is deterministic and green;
- supported feature types survive two save/open cycles;
- invalid imports preserve active work;
- malicious text payloads render literally and do not execute;
- project/domain state is independent of Leaflet runtime identity;
- clean-checkout production build succeeds;
- CI is green.

## 3. Macro Phase B — Productive Workspace

Corresponds to former Phase 3 (`#5`).

### Goal

Make projects with many objects manageable and make editing mistakes recoverable.

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
- search-result isolation and explicit Add to project action.

### Acceptance

- dense-project UAT succeeds;
- map and panel selection stay synchronized;
- group visibility/lock semantics pass tests;
- core undo/redo matrix passes;
- search no longer silently changes project content;
- responsive smoke matrix passes.

## 4. Macro Phase C — Engineering Delivery Toolkit

Combines former Phase 4, Phase 5, and Phase 6.

The three work packages below can be prioritized by immediate project need after Macro Phase B is qualified; they are not required to run in a fixed sequence.

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

### Macro Phase C completion gate

A typical engineering study map can be created, managed, exported to a report-ready figure, and exchanged with common GIS/survey data without semantic or coordinate ambiguity.

## 5. Pull-request strategy

The project has three macro phases, but implementation should remain sliced into small verifiable PRs.

Recommended order:

1. `A1-test-harness`
2. `A2-project-schema-persistence`
3. `A3-vite-typescript-modularization`
4. `B1-workspace-selection-object-panel`
5. `B2-history-search-isolation` if B1 becomes too large
6. C-series PRs according to priority

Avoid a single `rewrite-v2` PR.

## 6. ChatGPT/Codex operating model

ChatGPT should perform as much non-runtime work as possible:

- product/UX reasoning;
- architecture;
- data contracts;
- test matrices and deterministic fixtures;
- acceptance criteria;
- issue/PR decomposition;
- GitHub diff/CI review;
- qualification review;
- execution-packet preparation.

Codex should be used primarily for:

- implementation requiring file-system/runtime iteration;
- dependency installation;
- local test/build execution;
- browser automation/visual validation;
- debugging concrete failures;
- producing reproducible qualification evidence.

## 7. Deferred technology decisions

Evaluate only after Macro Phase A qualification unless a concrete blocker requires earlier action:

- Leaflet-Geoman vs Terra Draw vs continuing Leaflet.draw;
- Leaflet 2 migration;
- React or another UI framework;
- PWA/offline packaging;
- desktop wrapper.

These are decisions, not current requirements.

## 8. v2 Core release qualification

Before calling the Reliable Core + Productive Workspace complete:

- [ ] all supported feature types survive two save/open cycles;
- [ ] invalid import preserves active project;
- [ ] security payload tests pass;
- [ ] stable IDs verified;
- [ ] object panel and map selection synchronized;
- [ ] undo/redo matrix passes;
- [ ] search-result isolation passes;
- [ ] responsive smoke matrix passes;
- [ ] 500-object performance smoke passes;
- [ ] production build passes;
- [ ] CI green;
- [ ] manual UAT scenarios recorded.

## 9. Stop conditions

Do not proceed to engineering feature expansion if any remain unresolved:

- save/open can silently lose supported feature semantics;
- unsafe HTML injection remains possible from project text;
- failed import can destroy active project;
- persistence requires Leaflet runtime objects;
- core test suite is unreliable or non-deterministic.

See `MASTER_EXECUTION_PLAN.md` for the authoritative three-phase management view.
