# Map Tools v2 — Master Execution Plan

Status: authoritative execution plan
Date: 2026-08-25

## Purpose

Map Tools v2 is managed as **three macro phases**, not seven independent phases. The previous Phase 0–6 sequence remains useful only as bounded work packages / pull-request slices.

The objective is to minimize expensive implementation reasoning in Codex. ChatGPT owns specification, decomposition, acceptance criteria, test vectors, architecture decisions, and review. Codex should primarily execute code changes, run local/browser tests, fix concrete failures, and produce qualification evidence.

## Preferred Codex run count

For the core modernization, prefer approximately **three main Codex runs**:

1. **Run 1 — Combined A1+A2:** characterization/CI checkpoint first, then Project Schema v2 + safe/lossless persistence in the same controlled PR.
2. **Run 2 — A3:** Vite + TypeScript modularization after Run 1 is qualified.
3. **Run 3 — B:** productive workspace UX, object manager, inspector, undo/redo, dirty state, and search isolation.

Macro Phase C is expansion work and should be run only for the C1/C2/C3 capabilities actually needed. It is not required to block use of the qualified v2 Core.

## Macro Phase A — Reliable Core

Combines former Phase 0, Phase 1, and Phase 2.

### Outcome

A testable, lossless, safe, maintainable Map Tools core.

### Work packages

- **A1 — Characterization + CI**: issue #2
- **A2 — Project Schema v2 + safe/lossless persistence**: issue #3
- **A3 — Vite + TypeScript modularization**: issue #4

### Preferred execution

A1 and A2 should normally be executed together using `CODEX_A1_A2_COMBINED_PACKET.md`.

The combined implementation must preserve the safety rationale of A1 through a mandatory checkpoint:

1. characterize current useful behavior;
2. run and record the baseline suite;
3. commit the A1 checkpoint with a clean tree;
4. only then modify persistence/security behavior for A2;
5. rerun the full A1 suite plus A2 acceptance/security/round-trip tests.

A3 remains separate because it is a structural migration and is easier to review after persistence semantics are already qualified.

### Completion gate

Macro Phase A is complete when:

- deterministic characterization/CI is green;
- every supported feature survives two save/open cycles;
- unsafe project/user text cannot execute;
- invalid imports cannot destroy active work;
- project/domain data is independent of Leaflet runtime objects;
- production build succeeds from a clean checkout;
- domain/persistence tests can run without rendering Leaflet.

## Macro Phase B — Productive Workspace

Corresponds to former Phase 3.

### Outcome

The app is comfortable for real projects containing dozens to hundreds of map objects.

### Work package

- **B — Workspace UX foundation**: issue #5

### Completion gate

- object/layer panel works;
- selection is synchronized between map and panel;
- visibility/lock/group semantics are deterministic;
- undo/redo covers core mutations;
- dirty/saved state is visible;
- search results are transient until explicitly added;
- dense-project UAT passes.

## Macro Phase C — Engineering Delivery Toolkit

Combines former Phase 4, Phase 5, and Phase 6.

### Outcome

Map Tools becomes a traffic/transport/infrastructure study-map production tool rather than a generic annotation utility.

### Work packages

- **C1 — Traffic/transport engineering toolkit**: issue #6
- **C2 — Report-quality export composer**: issue #7
- **C3 — Geospatial interoperability + site-plan overlay**: issue #8

C1/C2/C3 do not have to be implemented in fixed order. They can be prioritized by immediate project needs after Macro Phase B is qualified.

### Completion gate

Map Tools can create a typical engineering study map, manage semantic engineering objects, export a report-ready figure, and exchange common GIS/survey data without ambiguity.

## Why work packages remain separate

Three macro phases reduce project-management overhead, but implementation should still use bounded pull requests. Combining architecture migration, workspace redesign, engineering symbols, and report export into one code branch would make failures difficult to isolate and review.

The important distinction is:

> **3 macro phases; approximately 3 core Codex runs; optional C-series expansion runs.**

The number of work-package documents or GitHub issues does not imply the number of independent user-facing phases.

## ChatGPT vs Codex division of work

### ChatGPT owns

- source/repository inspection;
- architecture and data-model decisions;
- product requirements;
- UX behavior specifications;
- serialization contracts;
- security requirements;
- deterministic fixture definitions;
- acceptance matrices;
- GitHub issue/PR review;
- diff review;
- CI review;
- qualification review;
- next-step decomposition;
- Codex execution-packet preparation.

### Codex owns only work requiring a runtime

- editing production/test code where execution feedback is needed;
- dependency installation;
- local build/test runs;
- browser automation;
- visual verification;
- runtime debugging;
- fixing failures discovered by tests;
- producing exact qualification evidence.

## Cost-control rule

Do not ask Codex to "review the app and decide what to do." Do not ask Codex to redesign architecture from an open-ended prompt.

Every Codex run should begin from an existing issue plus an authoritative execution packet with:

1. known baseline;
2. exact scope;
3. explicit non-scope;
4. file/architecture contracts;
5. deterministic test cases;
6. acceptance criteria;
7. required evidence and handoff format.

If Codex discovers a product/architecture ambiguity, stop implementation at the ambiguity and return it for ChatGPT resolution rather than letting the implementation silently redefine the product.

## Current prepared execution path

- Run 1 branch: `codex/a1-a2-core-safety-persistence`
- Run 1 packet: `CODEX_A1_A2_COMBINED_PACKET.md`
- Run 2 packet: `CODEX_A3_PACKET.md`
- Run 3 packet: `CODEX_B_PACKET.md`
- Optional expansion framework: `CODEX_C_PACKET.md`
