# Codex Execution Packet — Phase 0 Baseline Characterization

## Mission

Create a deterministic test/build safety net around the current Map Tools v1 behavior without redesigning the product or starting the v2 architecture migration.

This phase exists to make later refactoring safe. Preserve current user-visible behavior unless a minimal change is strictly necessary to make the app testable.

## Authoritative references

Read before editing:

- `docs/v2/BASELINE_AUDIT.md`
- `docs/v2/PRODUCT_SPEC.md`
- `docs/v2/ARCHITECTURE.md`
- `docs/v2/TEST_AND_UAT_PLAN.md`
- `docs/v2/ROADMAP.md`

Baseline to protect:

- branch: `main`
- commit: `5f4823534c80fd7a2b53d4b55ff76d18975521d2`

## Scope

### In scope

1. Introduce minimal package/build/test tooling suitable for repeatable local and CI execution.
2. Keep the current application behavior and Leaflet implementation intact as much as practical.
3. Add browser characterization tests for current useful workflows.
4. Add deterministic mocks/fixtures for network-dependent search/reverse-geocoding behavior.
5. Add at least one representative legacy project JSON fixture.
6. Add CI that exercises install, tests, and the production/static build path used by the app.
7. Document current known defects separately from expected v2 behavior.

### Out of scope

Do not:

- introduce Project Schema v2 yet;
- refactor the monolithic application into the final architecture;
- rewrite in React/Vue/Svelte;
- migrate Leaflet major version;
- replace Leaflet.draw;
- redesign the UI;
- add object/layer manager;
- add undo/redo;
- add engineering symbols/buffers/report composer;
- change save/open semantics to pretend current losses are correct.

## Tooling preference

Use the smallest maintainable toolchain that supports the acceptance plan. Preferred target:

- npm with lockfile;
- Vite only if required to make test/build execution practical without altering runtime behavior materially;
- Playwright for browser characterization;
- Vitest only where pure helper tests are useful in this phase;
- GitHub Actions for CI.

If a simpler static-server + Playwright approach protects behavior with less churn, it is acceptable. Do not force the Phase 2 architecture into Phase 0.

## Required characterization scenarios

Implement the scenarios described as C-01 through C-07 in `TEST_AND_UAT_PLAN.md`.

At minimum browser coverage must exercise:

### Marker

- create a marker at a known point;
- label/color edit;
- drag;
- delete.

### Radius rings

- add at least two radii;
- edit one;
- delete one;
- verify rings track parent marker movement.

### Shapes

For polyline, polygon, circle, rectangle:

- draw;
- verify the measurement popup/content is present;
- edit style where feasible;
- edit geometry where feasible;
- delete.

### Arrow

- draw;
- edit geometry;
- verify arrowhead remains associated with the line;
- delete.

### Text

- create;
- edit;
- rotate;
- drag;
- delete.

### Search

- intercept/mimic geocoder response;
- verify current result behavior without relying on the public service;
- explicitly document that current search result creation enters the project marker collection.

### Save/open

- save a mixed project;
- load a known v1 fixture;
- record observable fidelity gaps as known baseline defects.

Do not make tests assert that semantic loss is desirable. A characterization test may document a defect using a named/annotated expectation or dedicated defect fixture.

## Network isolation

Tests must not depend on live Nominatim, OSM, Esri, CARTO, or other public services being reachable.

Intercept external requests or use local/mocked responses so CI is deterministic.

Map tile requests may be blocked/mocked where needed. Tests should assert application behavior, not third-party map availability.

## Testability changes allowed

Minimal non-product changes are allowed, for example:

- stable `data-testid` attributes;
- small helper extraction;
- deterministic hooks for file download/open in tests;
- test-only fixture support.

Do not expose test-only controls in normal production UI.

## CI requirements

Add a workflow that, from a clean checkout:

1. installs dependencies from lockfile;
2. runs relevant checks/tests;
3. builds or otherwise validates the deployable static app;
4. runs the browser smoke suite.

Use supported Node LTS versions appropriate at implementation time; keep the matrix minimal unless there is a concrete compatibility reason for multiple versions.

## Required outputs

- package manifest and lockfile;
- test configuration;
- browser characterization tests;
- fixtures/mocks;
- CI workflow;
- `docs/v2/PHASE_0_QUALIFICATION.md` containing:
  - exact branch/commit;
  - commands executed;
  - test counts/results;
  - known baseline defects;
  - whether Phase 1 is safe to start.

## Acceptance criteria

Phase 0 is complete only when:

- a clean local/CI execution can run the test suite without public-network dependence;
- marker/radius/shape/arrow/text/search/save-open characterization exists;
- CI passes;
- current app remains usable as before;
- no large architecture/product redesign was introduced;
- current save/open fidelity defects are documented rather than normalized as correct behavior.

## Review checklist

Before opening the PR, inspect:

- `git diff --check`;
- production app load;
- browser console for new errors;
- test determinism on a second run;
- generated/temporary files not accidentally committed;
- GitHub Pages/static hosting compatibility.

## Stop/escalate conditions

Stop and report rather than broadening scope if:

- testing the current app requires a major rewrite;
- browser tooling exposes a severe current defect that blocks characterization;
- the existing save/open path corrupts fixtures in a way that prevents meaningful baseline capture;
- hosting/build changes would break the existing GitHub Pages deployment without a clear migration plan.

## Deliverable style

Keep the PR focused on the safety net. In the PR description include:

- what behavior is now characterized;
- what known defects remain intentionally unfixed for Phase 1;
- exact qualification commands/results;
- any deviation from this packet and the reason.
