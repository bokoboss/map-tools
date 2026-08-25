# Map Tools v2 Planning Index

This directory is the authoritative planning and execution baseline for Map Tools v2.

## Project management model

Map Tools v2 uses **3 macro phases**:

1. **Macro Phase A — Reliable Core**: characterization/CI, Project Schema v2 + safe persistence, Vite/TypeScript modularization.
2. **Macro Phase B — Productive Workspace**: object/layer management, inspector, undo/redo, dirty state, search isolation.
3. **Macro Phase C — Engineering Delivery Toolkit**: traffic/transport tools, report export, interoperability/site-plan overlay.

The older 0–6 sequence is retained only as bounded work packages / PR slices, not as seven independent project phases.

## Core documents

- [`MASTER_EXECUTION_PLAN.md`](./MASTER_EXECUTION_PLAN.md) — authoritative three-phase management model and ChatGPT/Codex division of work.
- [`BASELINE_AUDIT.md`](./BASELINE_AUDIT.md) — verified source-level findings, risks, and upgrade direction.
- [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md) — target users, workflows, product principles, functional/non-functional requirements, and release boundaries.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — technical boundaries, state model, persistence pipeline, Leaflet adapter strategy, and migration sequence.
- [`DOMAIN_MODEL_CONTRACT.md`](./DOMAIN_MODEL_CONTRACT.md) — implementation-level typed domain contract and invariants.
- [`PROJECT_SCHEMA_V2.md`](./PROJECT_SCHEMA_V2.md) — normative versioned project file/domain schema.
- [`DECISIONS.md`](./DECISIONS.md) — product/architecture decisions implementation PRs must not change silently.
- [`TEST_AND_UAT_PLAN.md`](./TEST_AND_UAT_PLAN.md) — characterization, unit/integration/E2E, security, performance, responsive, and manual UAT acceptance gates.
- [`WORKSPACE_UX_SPEC.md`](./WORKSPACE_UX_SPEC.md) — interaction contract for selection, object manager, inspector, history, keyboard, dirty state, and search.
- [`ENGINEERING_TOOLKIT_SPEC.md`](./ENGINEERING_TOOLKIT_SPEC.md) — traffic/transport symbols, measurements, buffers, coordinates, and study-map workflows.
- [`REPORT_EXPORT_SPEC.md`](./REPORT_EXPORT_SPEC.md) — report composer, page/output rules, legend, scale, north arrow, attribution, and qualification cases.
- [`ROADMAP.md`](./ROADMAP.md) — three macro phases, PR strategy, release qualification, and stop conditions.

## Codex execution packets

Preferred run structure:

1. [`CODEX_A1_A2_COMBINED_PACKET.md`](./CODEX_A1_A2_COMBINED_PACKET.md) — **preferred combined first run**: characterization/CI first, mandatory baseline checkpoint, then Project Schema v2 + safe/lossless persistence; closes #2 and #3 when accepted.
2. [`CODEX_A3_PACKET.md`](./CODEX_A3_PACKET.md) — second run: Vite + TypeScript modularization.
3. [`CODEX_B_PACKET.md`](./CODEX_B_PACKET.md) — third core run: productive workspace, object manager, inspector, undo/redo, search isolation.
4. [`CODEX_C_PACKET.md`](./CODEX_C_PACKET.md) — optional/need-driven engineering expansion framework for C1/C2/C3.

Supporting legacy-detail packets:

- [`CODEX_PHASE_0_PACKET.md`](./CODEX_PHASE_0_PACKET.md) — detailed A1-only notes if needed.
- [`CODEX_PHASE_1_PACKET.md`](./CODEX_PHASE_1_PACKET.md) — detailed A2-only notes if needed.

## Canonical fixtures

- [`fixtures/project-v2-mixed.json`](./fixtures/project-v2-mixed.json) — mixed semantic feature round-trip fixture.
- [`fixtures/project-v2-security-text.json`](./fixtures/project-v2-security-text.json) — unsafe-text/XSS regression fixture that must render literally and never execute.

## Authority order

When documents appear to conflict, use this order:

1. `PROJECT_SCHEMA_V2.md` for persisted data semantics;
2. `DECISIONS.md` for explicitly adopted architecture/product decisions;
3. `DOMAIN_MODEL_CONTRACT.md` for implementation-level model invariants;
4. `TEST_AND_UAT_PLAN.md` for acceptance/qualification;
5. `ARCHITECTURE.md` for technical boundaries;
6. focused UX/tool/export specifications for their respective surfaces;
7. `PRODUCT_SPEC.md` for overall product behavior/scope;
8. `MASTER_EXECUTION_PLAN.md` / `ROADMAP.md` for sequencing and work packaging;
9. focused Codex packet for the active work package.

Implementation findings may justify a planning update, but requirements should be changed explicitly rather than silently bypassed.

## Baselines

- repository: `bokoboss/map-tools`
- original v1 source baseline reviewed: `5f4823534c80fd7a2b53d4b55ff76d18975521d2`
- v2 planning baseline merged to `main`: `83d5ca83a60b25cca10ed6e0fa7e4a7d8f20c903`
- current implementation at planning start: static HTML/CSS/JavaScript + Leaflet
- planning date: 2026-08-25

## Current decision

Do not rewrite from scratch.

Treat the original app as the v1 reference implementation. Establish deterministic tests, create a canonical domain/project model, fix persistence/security, modularize while preserving qualified behavior, then improve workspace UX and add engineering delivery features.

Use ChatGPT for architecture, specifications, fixtures, acceptance criteria, GitHub review, and qualification review. Use Codex primarily where runtime/local-browser iteration is required.
