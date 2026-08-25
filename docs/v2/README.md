# Map Tools v2 Planning Index

This directory is the authoritative planning baseline for the Map Tools v2 effort.

## Documents

- [`BASELINE_AUDIT.md`](./BASELINE_AUDIT.md) — verified source-level findings, risks, and upgrade direction.
- [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md) — target users, workflows, product principles, functional/non-functional requirements, and release boundaries.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — recommended technical boundaries, state model, persistence pipeline, Leaflet adapter strategy, and migration sequence.
- [`PROJECT_SCHEMA_V2.md`](./PROJECT_SCHEMA_V2.md) — normative draft of the versioned project file/domain schema.
- [`TEST_AND_UAT_PLAN.md`](./TEST_AND_UAT_PLAN.md) — characterization, unit/integration/E2E, security, performance, responsive, and manual UAT acceptance gates.
- [`ROADMAP.md`](./ROADMAP.md) — phase sequence, PR boundaries, release qualification, and stop conditions.
- [`CODEX_PHASE_0_PACKET.md`](./CODEX_PHASE_0_PACKET.md) — bounded execution packet for the baseline characterization/test-harness phase.
- [`CODEX_PHASE_1_PACKET.md`](./CODEX_PHASE_1_PACKET.md) — bounded execution packet for Project Schema v2 and safe persistence.

## Authority order

When documents appear to conflict, use this order:

1. `PROJECT_SCHEMA_V2.md` for persisted data semantics;
2. `TEST_AND_UAT_PLAN.md` for acceptance/qualification;
3. `ARCHITECTURE.md` for technical boundaries;
4. `PRODUCT_SPEC.md` for product behavior and scope;
5. `ROADMAP.md` for sequencing.

Implementation findings may justify a planning update, but requirements should be changed explicitly rather than silently bypassed.

## Current baseline

- repository: `bokoboss/map-tools`
- baseline branch: `main`
- baseline commit: `5f4823534c80fd7a2b53d4b55ff76d18975521d2`
- current implementation: static HTML/CSS/JavaScript + Leaflet
- planning date: 2026-08-25

## Current decision

Do not rewrite from scratch.

Treat the current app as the v1 reference implementation. Establish tests, create a canonical domain/project model, fix persistence/security, then modularize while preserving qualified behavior. New engineering features come after v2 Core reliability is established.
