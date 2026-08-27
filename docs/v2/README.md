# Map Tools v2 Planning Index

This directory is the authoritative planning and execution baseline for Map Tools v2.

## Project management model

Map Tools v2 uses **3 macro phases** plus a mandatory 2D product-acceptance gate before visible 3D/engineering expansion:

1. **Macro Phase A — Reliable Core**: characterization/CI, Project Schema v2 + safe persistence, Vite/TypeScript modularization. **Accepted/completed.**
2. **Macro Phase B — Productive Workspace**: object/layer management, inspector, domain undo/redo, saved-baseline status, keyboard workflow, and search isolation. **Accepted/completed.**
3. **B4 — 2D Product Acceptance / Interaction Parity**: contextual workflows, exact marker placement, reverse geocoding, lock enforcement, and real product UAT. **Accepted/completed via PR #16.**
4. **Macro Phase C — Engineering Delivery Toolkit / Visualization**: traffic/transport tools, report export, interoperability/site-plan overlay, and 2.5D/3D visualization. **C4.1 3D Preview is the current execution target.**

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
- [`B4_PARITY_MATRIX.md`](./B4_PARITY_MATRIX.md) — v1 useful-workflow → current-v2 parity audit and required B4 resolution status.
- [`B4_2D_PRODUCT_ACCEPTANCE.md`](./B4_2D_PRODUCT_ACCEPTANCE.md) — accepted B4 contextual interaction, marker-placement, reverse-geocode, lock semantics, and real user-journey acceptance contract.
- [`C4_1_3D_PREVIEW_SPEC.md`](./C4_1_3D_PREVIEW_SPEC.md) — C4.1 product boundary, mode/camera semantics, preview extrusion, failure behavior, and C4-J1..J8.
- [`C4_1_RENDERER_ARCHITECTURE.md`](./C4_1_RENDERER_ARCHITECTURE.md) — MapLibre renderer, mode state, capabilities, camera, lifecycle, GeoJSON adapter, provider and test architecture.
- [`C4_1_FEATURE_RENDERING_MATRIX.md`](./C4_1_FEATURE_RENDERING_MATRIX.md) — per-feature 2D→3D semantic rendering acceptance matrix.
- [`ENGINEERING_TOOLKIT_SPEC.md`](./ENGINEERING_TOOLKIT_SPEC.md) — traffic/transport symbols, measurements, buffers, coordinates, and study-map workflows.
- [`REPORT_EXPORT_SPEC.md`](./REPORT_EXPORT_SPEC.md) — report composer, page/output rules, legend, scale, north arrow, attribution, and qualification cases.
- [`ROADMAP.md`](./ROADMAP.md) — macro phases, B4 gate, PR strategy, release qualification, and stop conditions.

## Codex execution packets

Execution history / current packet:

1. [`CODEX_A1_A2_COMBINED_PACKET.md`](./CODEX_A1_A2_COMBINED_PACKET.md) — accepted combined A1+A2 run.
2. [`CODEX_A3_PACKET.md`](./CODEX_A3_PACKET.md) — accepted Vite + TypeScript renderer-ready architecture run.
3. [`CODEX_B_PACKET.md`](./CODEX_B_PACKET.md) — accepted Macro B Productive Workspace run.
4. [`CODEX_B4_PACKET.md`](./CODEX_B4_PACKET.md) — accepted B4 product-acceptance run.
5. [`CODEX_C4_1_PACKET.md`](./CODEX_C4_1_PACKET.md) — **current preferred run**: one C4.1 MapLibre 3D Preview run/PR with renderer-foundation and product-rendering checkpoints.
6. [`CODEX_C_PACKET.md`](./CODEX_C_PACKET.md) — optional/need-driven engineering expansion framework for other C work.

Supporting legacy-detail packets:

- [`CODEX_PHASE_0_PACKET.md`](./CODEX_PHASE_0_PACKET.md) — detailed A1-only notes if needed.
- [`CODEX_PHASE_1_PACKET.md`](./CODEX_PHASE_1_PACKET.md) — detailed A2-only notes if needed.

## Canonical fixtures

- [`fixtures/project-v2-mixed.json`](./fixtures/project-v2-mixed.json) — mixed semantic feature round-trip fixture.
- [`fixtures/project-v2-security-text.json`](./fixtures/project-v2-security-text.json) — unsafe-text/XSS regression fixture that must render literally and never execute.
- [`fixtures/project-v2-dense-workspace.json`](./fixtures/project-v2-dense-workspace.json) — deterministic 40-feature / 4-group workspace UAT fixture.

B4 should reuse these fixtures plus real UI-created objects rather than introduce random acceptance data unless a new deterministic fixture is demonstrably necessary.

## Accepted implementation evidence

- A1+A2 accepted via PR #9.
- A3 accepted via PR #11; squash merge `614bb814ac83891c8150d285efbcdbaece7ecd26`.
- Macro B accepted via PR #12; squash merge `501f996217857945e3008bae226ab7d19d5573e8`.
- B4 accepted via PR #16; squash merge `95e9928facd84d7e2e44b88f6680358c6af0da5e`.
- Current accepted production architecture is Vite + strict TypeScript with canonical ProjectStore/Project Schema state, renderer-neutral `MapRenderer`/`RendererHost`, Leaflet as the current 2D renderer, and Leaflet.draw behind its adapter.
- B4 closes the 2D contextual/placement/lock parity gaps and qualifies the current 2D product experience.
- C4 parent direction remains issue #10; C4.1 now starts from the accepted B4 renderer-neutral interaction model.

## Authority order

When documents appear to conflict, use this order:

1. `PROJECT_SCHEMA_V2.md` for persisted data semantics;
2. `DECISIONS.md` for explicitly adopted architecture/product decisions;
3. `DOMAIN_MODEL_CONTRACT.md` for implementation-level model invariants;
4. active focused architecture/product contract (`C4_1_RENDERER_ARCHITECTURE.md` / `C4_1_3D_PREVIEW_SPEC.md` during C4.1);
5. active focused rendering/acceptance matrix (`C4_1_FEATURE_RENDERING_MATRIX.md` during C4.1);
6. `TEST_AND_UAT_PLAN.md` for general acceptance/qualification;
7. `ARCHITECTURE.md` for technical boundaries;
8. focused UX/tool/export specifications for their respective surfaces;
9. `PRODUCT_SPEC.md` for overall product behavior/scope;
10. `MASTER_EXECUTION_PLAN.md` / `ROADMAP.md` for sequencing and work packaging;
11. focused Codex packet for the active work package.

Implementation findings may justify a planning update, but requirements should be changed explicitly rather than silently bypassed.

## Baselines

- repository: `bokoboss/map-tools`
- original v1 source baseline reviewed: `5f4823534c80fd7a2b53d4b55ff76d18975521d2`
- v2 planning baseline merged to `main`: `83d5ca83a60b25cca10ed6e0fa7e4a7d8f20c903`
- accepted A3 runtime baseline: `614bb814ac83891c8150d285efbcdbaece7ecd26`
- accepted Macro B runtime baseline: `501f996217857945e3008bae226ab7d19d5573e8`
- accepted B4 2D product baseline: `95e9928facd84d7e2e44b88f6680358c6af0da5e`
- C4.1 planning date: 2026-08-27

## Current decision

Do not rewrite from scratch.

Macro Phase A, Macro Phase B, and B4 are complete. Execute C4.1 3D Preview next on the same canonical ProjectStore / RendererHost architecture. C4.1 adds MapLibre but does not change Project Schema v2, add Three.js, or implement 3D geometry editing.

Use ChatGPT for architecture, rendering contracts, acceptance journeys, GitHub review, and qualification review. Use Codex primarily where MapLibre/runtime/browser implementation and iteration are required.
