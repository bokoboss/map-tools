# Codex Execution Packet — Combined A1+A2 Core Safety and Persistence

Status: preferred bounded implementation packet
Date: 2026-08-25

## Why this packet exists

The repository is small enough that A1 characterization and A2 persistence hardening can be executed in one controlled branch/PR without losing the protection provided by characterization tests.

The internal order is mandatory:

> **Characterize first → record baseline → then change persistence/security → prove regression + new acceptance.**

This combined packet is preferred over running issues #2 and #3 as two completely separate Codex jobs.

## Issues

Implements:

- #2 — A1 Characterization tests and CI safety net
- #3 — A2 Project Schema v2 and safe lossless persistence

## Base

Start from current `main` after the v2 planning/specification documents are present.

Recommended branch:

`codex/a1-a2-core-safety-persistence`

The older `codex/phase-0-test-harness` branch may be abandoned/recreated if no implementation work has begun on it.

## Authoritative references

Read before editing code:

1. `MASTER_EXECUTION_PLAN.md`
2. `BASELINE_AUDIT.md`
3. `PROJECT_SCHEMA_V2.md`
4. `DOMAIN_MODEL_CONTRACT.md`
5. `ARCHITECTURE.md`
6. `DECISIONS.md`
7. `TEST_AND_UAT_PLAN.md`
8. `fixtures/project-v2-mixed.json`
9. `fixtures/project-v2-security-text.json`

The older `CODEX_PHASE_0_PACKET.md` and `CODEX_PHASE_1_PACKET.md` remain supporting detail where they do not conflict with this combined packet.

---

# Stage 1 — A1 Characterization Freeze

## Objective

Build a deterministic safety net around useful current v1 behavior before changing persistence.

## Required work

- introduce minimal package/test tooling needed for repeatable tests;
- characterize marker create/edit/delete/drag;
- characterize multiple radius rings;
- characterize polyline/polygon/rectangle/circle;
- characterize arrow;
- characterize text + rotation;
- characterize search with deterministic mocked network responses;
- characterize current save/open behavior;
- add representative v1 project fixture;
- document known save/open semantic losses as defects, not desired expected behavior;
- add CI/build/smoke qualification.

## Mandatory checkpoint

Before starting Stage 2:

1. run the complete Stage 1 suite;
2. record exact results in `docs/v2/A1_BASELINE_CHECKPOINT.md`;
3. commit Stage 1 separately with a clear commit message;
4. verify the working tree is clean.

Do **not** modify persistence behavior before this checkpoint commit exists.

---

# Stage 2 — A2 Safe/Lossless Persistence

## Objective

Replace fragile renderer-derived save/open behavior with a validated semantic Project Schema v2 path.

## Required work

### Domain/project model

- Project Schema v2 envelope;
- stable project/group/feature/radius IDs;
- canonical `[longitude, latitude]` coordinates;
- typed semantic feature types;
- no Leaflet runtime IDs/feature groups in persisted data.

### Supported semantic features

- marker;
- marker radius rings;
- text + text content + rotation;
- polyline;
- polygon;
- rectangle;
- circle;
- arrow.

### Serialization

Implement deterministic serialization from semantic project state.

### Deserialization

Use candidate-load pattern:

1. parse into unknown/candidate data;
2. identify schema/version;
3. migrate if needed;
4. validate full candidate document;
5. only after success replace active project.

Invalid input must leave current work unchanged.

### v1 migration

Recover:

- markers;
- radius rings;
- recoverable GeoJSON shapes;
- known style/radius information.

Do not invent lost text/arrow semantics from ambiguous v1 saved data.

### Safe text

Project/user labels and text annotations are plain text.

The canonical unsafe-text fixture must display literally and must not execute scripts/event handlers.

---

# Required test matrix after Stage 2

## Preserve A1 suite

Every useful Stage 1 characterization must remain green except where an intentional A2 correctness/security change is explicitly documented.

## Round-trip

For each supported semantic type:

`create → save → fresh load → compare semantic state → edit → save → fresh load`

Run at least two save/open cycles.

## Canonical mixed fixture

Use `fixtures/project-v2-mixed.json` to verify:

- all semantic types load;
- non-default styles load;
- two marker radius rings load;
- Thai/English text loads;
- coordinates are not swapped;
- serialize/reload is semantically stable.

## Security fixture

Use `fixtures/project-v2-security-text.json` to verify:

- payload displays as literal text;
- no script runs;
- no event-handler injection occurs;
- save/reopen preserves safe literal content.

## Import-failure safety

Test:

- malformed JSON;
- unsupported schema version;
- invalid coordinates;
- duplicate IDs;
- invalid geometry for discriminator;
- invalid style values;
- oversized/invalid structures according to implementation limits.

Active project must remain unchanged after each failed import.

## Coordinate-order test

Use asymmetric Bangkok-like values such as `[100.5018, 13.7563]` and prove they render/read back at the intended location. A lat/lon reversal must fail visibly in tests.

---

# Explicit non-scope

Do not perform A3 structural migration in this combined PR beyond the minimum tooling required for tests.

Specifically do not:

- fully migrate to TypeScript;
- redesign the workspace;
- implement object manager;
- add undo/redo;
- replace Leaflet.draw;
- migrate to Leaflet 2;
- add engineering toolkit;
- build report composer.

If small pure modules are needed to make persistence testable, they may be introduced in JavaScript/modules, but avoid broad architecture churn that belongs to A3.

---

# Required qualification

Create `docs/v2/A1_A2_QUALIFICATION.md` containing:

- base SHA;
- Stage 1 checkpoint SHA;
- final head SHA;
- exact install/test/build commands;
- Stage 1 characterization results;
- intentional behavior changes introduced by A2;
- round-trip matrix results;
- security fixture results;
- invalid-import results;
- browser smoke results;
- CI run link/status;
- known limitations;
- explicit recommendation: `READY_FOR_A3` or `NOT_READY_FOR_A3`.

## PR rule

Open one PR against `main` and link/close both #2 and #3 when accepted.

Do not self-merge unless explicitly instructed.
