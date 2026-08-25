# Map Tools v2 Planning Index

This directory is the authoritative planning and execution baseline for Map Tools v2.

## Project management model

Map Tools v2 uses **3 macro phases**:

1. **Macro Phase A — Reliable Core**: characterization/CI, Project Schema v2 + safe persistence, Vite/TypeScript modularization. **Accepted/completed.**
2. **Macro Phase B — Productive Workspace**: object/layer management, inspector, domain undo/redo, saved-baseline status, keyboard workflow, and search isolation. **Current execution target.**
3. **Macro Phase C — Engineering Delivery Toolkit**: traffic/transport tools, report export, interoperability/site-plan overlay, plus optional 2.5D/3D visualization expansion.

The older 0–6 sequence is retained only as bounded work packages / PR slices, not as seven independent project phases.

## Core documents

- [`MASTER_EXECUTION_PLAN.md`](./MASTER_EXECUTION_PLAN.md) — authoritative three-phase management model and ChatGPT/Codex division of work.
- [`BASELINE_AUDIT.md`](./BASELINE_AUDIT.md) — verified source-level findings, risks, and upgrade direction.
- [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md) — target users, workflows, product principles, functional/non-functional requirements, and release boundaries.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — technical boundaries, state model, persistence pipeline, renderer strategy, and migration sequence.
- [`DOMAIN_MODEL_CONTRACT.md`](./DOMAIN_MODEL_CONTRACT.md) — implementation-level typed domain contract and invariants.
- [`PROJECT_SCHEMA_V2.md`](./PROJECT_SCHEMA_V2.md) — normative versioned project file/domain schema.
- [`DECISIONS.md`](./DECISIONS.md) — product/architecture decisions implementation PRs must not change silently.
- [`TEST_AND_UAT_PLAN.md`](./TEST_AND_UAT_PLAN.md) — characterization, unit/integration/E2E, security, performance, responsive, and manual UAT acceptance gates.
- [`WORKSPACE_UX_SPEC.md`](./WORKSPACE_UX_SPEC.md) — interaction contract for selection, object manager, inspector, history, keyboard, dirty state, and search.
- [`B_WORKSPACE_ARCHITECTURE_CONTRACT.md`](./B_WORKSPACE_ARCHITECTURE_CONTRACT.md) — Macro B ownership, selection, group, history, saved-baseline, search, responsive, and renderer-neutral constraints.
- [`ENGINEERING_TOOLKIT_SPEC.md`](./ENGINEERING_TOOLKIT_SPEC.md) — traffic/transport symbols, measurements, buffers, coordinates, and study-map workflows.
- [`REPORT_EXPORT_SPEC.md`](./REPORT_EXPORT_SPEC.md) — report composer, page/output rules, legend, scale, north arrow, attribution, and qualification cases.
- [`ROADMAP.md`](./ROADMAP.md) — three macro phases, PR strategy, release qualification, and stop conditions.

## Codex execution packets

Preferred run structure:

1. [`CODEX_A1_A2_COMBINED_PACKET.md`](./CODEX_A1_A2_COMBINED_PACKET.md) — accepted combined A1+A2 run.
2. [`CODEX_A3_PACKET.md`](./CODEX_A3_PACKET.md) — accepted Vite + TypeScript renderer-ready architecture run.
3. [`CODEX_B_PACKET.md`](./CODEX_B_PACKET.md) — **current preferred run**: one Macro B Codex run/PR with B1/B2/B3 internal checkpoints.
4. [`CODEX_C_PACKET.md`](./CODEX_C_PACKET.md) — optional/need-driven engineering expansion framework for C1/C2/C3.

Supporting legacy-detail packets:

- [`CODEX_PHASE_0_PACKET.md`](./CODEX_PHASE_0_PACKET.md) — detailed A1-only notes if needed.
- [`CODEX_PHASE_1_PACKET.md`](./CODEX_PHASE_1_PACKET.md) — detailed A2-only notes if needed.

## Canonical fixtures

- [`fixtures/project-v2-mixed.json`](./fixtures/project-v2-mixed.json) — mixed semantic feature round-trip fixture.
- [`fixtures/project-v2-security-text.json`](./fixtures/project-v2-security-text.json) — unsafe-text/XSS regression fixture that must render literally and never execute.
- [`fixtures/project-v2-dense-workspace.json`](./fixtures/project-v2-dense-workspace.json) — deterministic 40-feature / 4-group Macro B workspace UAT fixture.

## Accepted implementation evidence

- A1+A2 accepted via PR #9.
- A3 accepted via PR #11; squash merge `614bb814ac83891c8150d285efbcdbaece7ecd26`.
- Current production architecture is Vite + strict TypeScript with canonical ProjectStore/Project Schema state, renderer-neutral `MapRenderer`/`RendererHost`, Leaflet as the current 2D renderer, and Leaflet.draw behind its adapter.
- Future 3D direction is tracked separately in issue #10; Macro B must remain compatible with a future MapLibre renderer but does not implement 3D.

## Authority order

When documents appear to conflict, use this order:

1. `PROJECT_SCHEMA_V2.md` for persisted data semantics;
2. `DECISIONS.md` for explicitly adopted architecture/product decisions;
3. `DOMAIN_MODEL_CONTRACT.md` for implementation-level model invariants;
4. the focused active-phase architecture contract (currently `B_WORKSPACE_ARCHITECTURE_CONTRACT.md`);
5. `TEST_AND_UAT_PLAN.md` for acceptance/qualification;
6. `ARCHITECTURE.md` for technical boundaries;
7. focused UX/tool/export specifications for their respective surfaces;
8. `PRODUCT_SPEC.md` for overall product behavior/scope;
9. `MASTER_EXECUTION_PLAN.md` / `ROADMAP.md` for sequencing and work packaging;
10. focused Codex packet for the active work package.

Implementation findings may justify a planning update, but requirements should be changed explicitly rather than silently bypassed.

## Baselines

- repository: `bokoboss/map-tools`
- original v1 source baseline reviewed: `5f4823534c80fd7a2b53d4b55ff76d18975521d2`
- v2 planning baseline merged to `main`: `83d5ca83a60b25cca10ed6e0fa7e4a7d8f20c903`
- accepted A3 runtime baseline: `614bb814ac83891c8150d285efbcdbaece7ecd26`
- planning date: 2026-08-25

## Current decision

Do not rewrite from scratch.

Macro Phase A is complete. Execute Macro Phase B on the accepted renderer-neutral architecture, then add engineering delivery/3D capabilities only after the productive workspace is qualified.

Use ChatGPT for architecture, specifications, fixtures, acceptance criteria, GitHub review, and qualification review. Use Codex primarily where runtime/local-browser iteration is required.
