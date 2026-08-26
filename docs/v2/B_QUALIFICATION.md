# Macro Phase B Qualification - Productive Workspace

Status: qualified; local gates passed; PR CI pending for the remediation tip
Date: 2026-08-26

## Identity

- Repository: `bokoboss/map-tools`
- Execution branch: `codex/b-productive-workspace`
- Base SHA: `5a3d13d22a34e4f257e19b7c81494fb7423c2844`
- B1 checkpoint SHA: `dd66452fd34a1d2a10a51e29b993cb178cfd7c2a`
- B2 checkpoint SHA: `553ef3847ac64fb3024a01de59ca54fdb243a973`
- Previous implementation head SHA: `be50228`
- Remediation implementation head SHA: `de91ae7e220bc4a04e2326bd63b13462a438252b`
- Qualification/evidence commit SHA: this document commit, established when the document is committed
- Current final PR tip SHA: established and reported after the qualification/evidence commit is pushed; it is not pre-claimed here

`origin/main` and the requested execution branch both resolved to the base SHA before implementation. B1 and B2 were committed separately with clean-tree checkpoints before the next phase began. The remediation implementation commit is separated from this qualification/evidence commit so the provenance distinguishes code from evidence.

## Scope result

Macro Phase B adds a map-first productive workspace around the existing Leaflet renderer. The implementation keeps canonical Project Schema v2 state in the domain/store layer and keeps selection, panel expansion, inspector state, search previews, and history implementation objects transient. It does not add MapLibre, Three.js, visible 3D/2.5D, React, collaboration, multi-select, or a drawing-engine replacement.

Delivered capabilities include:

- stable-ID map/workspace selection and transient selection highlighting;
- responsive Objects / Inspector workspace with groups, implicit Ungrouped, visibility, locking, create/rename, delete-by-ungrouping, duplicate, zoom, and type-aware inline editing;
- bounded domain snapshot history, saved-baseline dirty semantics, transactions for continuous interaction, and keyboard shortcuts;
- deterministic multiple-result geocoding with transient map preview and explicit Add to project;
- responsive and accessibility smoke coverage using the canonical dense fixture.

## Qualification commands and results

All checks below were run from `C:\MyRD\map-tools` after a clean lockfile installation.

| Gate | Command | Result |
|---|---|---|
| Clean install | `npm ci` | PASS - 212 packages added, 213 audited, 0 vulnerabilities |
| Lint | `npm run lint` | PASS |
| Strict typecheck | `npm run typecheck` | PASS |
| Unit/integration/architecture tests | `npm test` | PASS - 29/29 |
| Production build | `npm run build` | PASS - Vite 6.4.3; one existing >500 kB chunk warning |
| Development browser suite | `npm run test:browser` | PASS - 28/28 |
| Preview browser suite | `PLAYWRIGHT_USE_PREVIEW=1 npm run test:browser` | PASS - 28/28 |
| Diff hygiene | `git diff --check` | PASS |
| Static artifact smoke | `python -m http.server 4174 --directory dist` plus Chromium load | PASS - map visible, page errors `[]`, `__mapToolsTest` and `MapToolsSchema` undefined on `/index.html` |

The browser suite covers the preserved A1/A2/A3 behavior checks plus Macro B workspace checks, including dense workspace UAT, transient multi-result search, responsive desktop/mobile coverage, normal production globals, continuous shape geometry history, and group delete-by-ungrouping undo/redo. The 29 unit/integration checks include the B1 workspace invariants and B2 store/history invariants.

## Dense-project UAT

`tests/dense-uat.spec.js` loads the exact fixture `docs/v2/fixtures/project-v2-dense-workspace.json` and passes 1/1. Through the object panel it locates `marker-survey-01`, selects it, zooms to it, hides/shows it, locks/unlocks it, renames it, reassigns it, duplicates it, proves a new feature ID and regenerated radius IDs, edits marker color, deletes it, undoes, redoes, undoes again, and proves group visibility/lock changes do not overwrite child flags.

## Responsive and accessibility result

The browser matrix passes at approximately 1440x900, 1366x768, 900x900, and 390x844. The map remains visible, the desktop layout stays map-first with a 320-380 px right workspace target, the narrow workspace collapses/reopens without losing primary map controls, and no document horizontal overflow is introduced. Workspace rows expose `aria-selected`, selection is visually and structurally distinguishable without relying only on color, focus remains visible, and icon-only buttons have accessible names or titles. This is a focused product accessibility smoke, not a full WCAG audit.

## History and dirty-state evidence

Selection, group expansion, inspector navigation, and search preview remain clean and create no history entries. Search preview navigation completes without dirtying map view state, while normal map navigation still persists and dirties the workspace. Feature edits create undoable entries; saved-baseline restoration reports Saved; divergent edits clear redo; project replacement resets history; Delete is protected in editable fields; continuous marker drag and continuous supported-shape editing each create one logical history entry; and group deletion-by-ungrouping restores the group and all child assignments through undo/redo. Search Add creates exactly one normal marker mutation and supports undo/redo.

## Architecture regression evidence

The domain, persistence, store, workspace state, history, and renderer-neutral interfaces remain free of Leaflet/MapLibre/Three runtime objects. Stable `FeatureId` values are the only selection values crossing the `MapRenderer` boundary. Leaflet objects and runtime IDs remain inside `LeafletRenderer` and `LeafletDrawAdapter`. Renderer replacement restores valid selection without changing canonical project state, and invalid selection IDs are cleared rather than persisted.

## CI

The workflow is `.github/workflows/ci.yml` and runs `npm ci`, lint, typecheck, unit tests, build, Chromium installation, and the browser suite.

- PR: [#12 - Macro Phase B productive workspace](https://github.com/bokoboss/map-tools/pull/12), open and unmerged; it fixes #5.
- Remediation CI run: pending for the pushed remediation/current PR tip; the final run ID, status, and head SHA are recorded in the final PR report.

## Known limitations

- Leaflet remains the only concrete renderer; future renderer readiness is architectural, not an implemented second renderer.
- Basemap tiles and Nominatim geocoding remain external network dependencies with normal availability and rate-limit constraints.
- The responsive workspace is intentionally a compact map-first panel, not a full mobile redesign.
- `script.js` and `src/project-schema.js` remain legacy characterization sources outside the Vite production graph.
- The production bundle retains the existing >500 kB minified chunk warning.

## Readiness decisions

- `MACRO_PHASE_B_QUALIFIED` - all local gates, browser suites, dense UAT, responsive checks, and static artifact smoke pass; the remediation PR CI run is pending after push.
- `READY_FOR_C4_3D_PREVIEW` - Macro B has no architectural blocker to begin C4.1: canonical ProjectStore state, renderer-neutral workspace state, stable FeatureId boundaries, runtime-object isolation, and renderer reinitialization remain qualified. MapLibre/3D/2.5D is not implemented in this PR and remains future C4 work.
