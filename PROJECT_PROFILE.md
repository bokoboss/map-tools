# Project Profile

## Identity
- Project name: Map Tools
- Repository URL: https://github.com/bokoboss/map-tools
- Authoritative local path: `C:\MyRD\map-tools`
- Primary branch: `main`
- Package/application version: `2.0.0`

## Current accepted baseline
- Accepted branch: `main`
- Accepted runtime baseline SHA: `501f996217857945e3008bae226ab7d19d5573e8`
- Accepted date: 2026-08-26
- Current phase/milestone: Macro Phase A and Macro Phase B complete; B4 2D Product Acceptance is the mandatory next gate before C4.1
- Last accepted PR: PR #12 — Macro Phase B Productive Workspace
- Macro B final reviewed PR head: `48863c043761c432f322b360142ca0f9bcafcd7e`
- Macro B final acceptance CI before squash merge: run `32978712904` passed
- A1+A2: accepted via PR #9; issues #2/#3 completed
- A3: accepted via PR #11; issue #4 completed
- Macro B: accepted via PR #12; issue #5 completed
- B4: issue #13 open — 2D product acceptance and interaction parity

Planning/specification commits may advance `main` beyond the accepted runtime baseline before the next execution branch is created. Runtime acceptance is established by reviewed PR/CI evidence, not by assuming every later documentation commit is a new runtime release.

## Technology stack
- Languages: TypeScript, HTML, CSS, JSON; retained legacy JavaScript is outside the production graph
- Build/runtime: Vite 6, strict TypeScript
- Current 2D renderer: Leaflet 1.9.4
- Drawing adapter: Leaflet.draw 1.0.4
- Styling: Tailwind CSS 3 + PostCSS plus project CSS
- Export: html2canvas quick PNG capture
- Browser testing: Playwright / Chromium
- Unit/integration testing: Node test runner through `tsx`
- Package manager: npm with committed `package-lock.json`
- CI runtime: Node.js 20
- Authoritative local development environment: Windows

## Standard commands
### Install/bootstrap
```text
npm ci
```

Engineering workflow validation when the shared workflow is available locally:
```text
python C:\MyRD\engineering-development-workflow\scripts\setup_project.py validate C:\MyRD\map-tools
```

### Fast validation
```text
npm run lint
npm run typecheck
npm test
```

### Full validation
```text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:browser
PLAYWRIGHT_USE_PREVIEW=1 npm run test:browser
git diff --check
```

### Build/package
```text
npm run build
```
Output: `dist/` with relative Vite asset paths for static/GitHub Pages-style hosting.

### Local run
```text
npm run dev
```

Alternative fixed local server used by tests/development:
```text
npm run serve
```

Production preview:
```text
npm run preview
```

## Architecture / invariants
- `ProjectDocumentV2` is the canonical persisted domain model.
- `ProjectStore` owns canonical persisted project state; renderers do not act as the project database.
- Domain/persistence/store interfaces are renderer-neutral and contain no Leaflet, MapLibre, Three.js, DOM, or drawing-runtime objects.
- `MapRenderer` / `RendererHost` define the renderer-neutral visualization boundary.
- `LeafletRenderer` is the current concrete 2D renderer; Leaflet-specific coordinates/runtime objects remain inside the Leaflet boundary.
- `DrawingAdapter` is renderer-neutral at the application boundary; `LeafletDrawAdapter` contains current Leaflet.draw integration.
- Persisted WGS84 coordinate order is `[longitude, latitude]`; renderer adapters own runtime conversion.
- Stable project/group/feature/radius IDs must never depend on renderer runtime IDs.
- Project Schema v2 is validated/migrated completely before a candidate replaces active project state.
- `ProjectStore` history uses bounded domain snapshots; continuous map edits must remain one logical history entry.
- Saved/Unsaved status is based on a saved/load project baseline, not a one-way dirty boolean.
- Workspace selection and panel expansion are transient and never serialized.
- Effective group/feature visibility and lock derive without overwriting child flags.
- Search results and search navigation are transient until explicit Add to project.
- User/project/geocoder text is plain/safe text; imported or remote strings must not execute HTML/event handlers.
- Normal production runtime does not expose test/legacy browser globals; `?test=1` is the explicit browser-test surface.
- Future MapLibre/3D visualization must consume the same canonical Project Schema/store without duplicating canonical project state.

## Protected behavior
Changes must not alter the following unless explicitly approved and requalified:
- A1 C-01..C-07 marker/radius/shape/arrow/text/search/save-open behavior except documented intentional product changes.
- Project Schema v2 round-trip semantics and stable IDs.
- WGS84 `[longitude, latitude]` persistence order.
- Marker radius-ring persistence.
- Text content/rotation persistence and safe literal rendering.
- Arrow semantic identity and arrow-head behavior.
- Rectangle bounds semantics and circle center/radius semantics.
- Invalid import leaves active project/rendered state unchanged.
- v1 migration recovers only supportable content and does not invent ambiguous text/arrow semantics.
- A3 renderer-neutral architecture: domain/persistence/store contain no renderer-runtime objects.
- Renderer teardown/reinitialization must not mutate canonical project data or valid stable-ID selection.
- Macro B object/layer panel, inspector, groups, selection, history, saved-baseline, keyboard and search-isolation behavior.
- Group visibility/lock operations do not overwrite child `visible`/`locked` flags.
- Search preview navigation does not dirty/history; normal user map navigation still persists map view.
- Production build remains reproducible from committed npm dependencies and lockfile.

## Important paths
- Production entry: `index.html`, `src/main.ts`
- App orchestration: `src/app/`
- Domain: `src/domain/`
- Canonical store/history: `src/store/`
- Workspace: `src/workspace/`
- Persistence/migration: `src/persistence/`
- Renderer abstraction: `src/map/renderer/`
- Leaflet renderer/coordinate boundary: `src/map/leaflet/`
- Drawing abstraction/adapters: `src/drawing/`
- Geocoding: `src/geocoding/`
- Measurement: `src/measurement/`
- Quick export: `src/export/`
- Tests: `tests/`
- Canonical fixtures: `docs/v2/fixtures/`
- Product/architecture docs: `docs/v2/`
- B4 parity matrix: `docs/v2/B4_PARITY_MATRIX.md`
- B4 product acceptance: `docs/v2/B4_2D_PRODUCT_ACCEPTANCE.md`
- Engineering workflow docs: `docs/development/`
- Generated build: `dist/` (not source of truth)
- Legacy compatibility/characterization sources: `script.js`, `src/project-schema.js` — retained outside production graph until separately retired
- Local-only / sensitive / licensed data: none required by repository baseline; client/sensitive data must not be committed unless explicitly approved

## Validation matrix
| Gate | Command / Method | Required |
|---|---|---|
| Lint | `npm run lint` | Yes |
| Strict typecheck | `npm run typecheck` | Yes |
| Unit/integration/architecture | `npm test` | Yes |
| Production build | `npm run build` | Yes |
| Browser/UI dev | `npm run test:browser` | Yes for app/UI behavior |
| Browser/UI production preview | `PLAYWRIGHT_USE_PREVIEW=1 npm run test:browser` | Yes before phase handoff |
| Static artifact smoke | serve `dist/` with a plain static server | Required for deployment-affecting changes |
| Security/persistence | unsafe-text + invalid-import + schema/migration tests | Required where relevant |
| Dense workspace | `docs/v2/fixtures/project-v2-dense-workspace.json` | Preserved Macro B gate |
| B4 parity/product journeys | `docs/v2/B4_PARITY_MATRIX.md` + `B4_2D_PRODUCT_ACCEPTANCE.md` | Required before C4.1 |
| Diff hygiene | `git diff --check` | Yes |
| CI | `.github/workflows/ci.yml` | Yes |

## Execution characteristics
- Typical task ambiguity: medium; ChatGPT/control plane should resolve product/architecture choices before Codex execution.
- High-risk areas: persistence/schema, coordinate conversion, renderer/domain leakage, undo/redo transaction boundaries, saved-baseline semantics, selection state leakage, drawing/drag coalescing, context-event translation, lock enforcement, safe remote text, and stale async UI updates.
- Modules safe to parallelize: isolated UI components/tests/documentation once ownership contracts are explicit.
- Modules tightly coupled / single-owner: `ProjectStore` + history/baseline, renderer event contract, AppController/workspace/context orchestration, project load/save lifecycle.
- Preferred local execution: cheapest model that can reliably finish a bounded packet; architecture/UI migrations require actual browser/build/CI evidence.

## Git / release policy
- Branch naming: bounded task branches such as `codex/b4-2d-product-acceptance`.
- Commit policy: material multi-stage tasks should keep auditable internal checkpoint commits where the execution packet requires them.
- PR policy: one bounded objective per PR where practical; include issue closure, exact validation evidence, limitations, and readiness decision.
- Merge policy: ChatGPT/control-plane review of actual diff + CI + qualification evidence; architecture/security/high-impact changes require scrutiny gate; squash merge preferred for accepted bounded PRs.
- Release policy: do not call the current v2 2D product acceptance-complete until B4 is explicitly qualified.

## Current known limitations / risks
- Leaflet remains the only concrete renderer; MapLibre/Three.js/visible 3D are not implemented.
- Leaflet.draw remains the drawing engine behind its adapter.
- Macro B is architecture/workspace-qualified, but current 2D product acceptance is incomplete.
- Legacy v1 custom right-click context menu is still present in HTML/Help but no longer wired in the TypeScript production runtime.
- Blank-map exact-point marker creation, coordinate context display, and reverse geocoding are therefore missing from the current v2 interaction surface.
- Toolbar Add Pin currently falls back to project map center when no explicit coordinate is supplied; B4 should replace this with precise placement mode.
- Effective lock is not yet enforced consistently across every inspector/keyboard/context mutation surface; B4 must centralize the guard.
- Legacy `script.js` and `src/project-schema.js` remain outside the production graph for retained characterization compatibility.
- Legacy v1 text/arrow semantics cannot be recovered from ambiguous historical files.
- Basemap tiles and Nominatim remain external network services subject to provider availability/rate limits.
- Engineering toolkit, report-quality export, interoperability expansion, and 3D visualization remain later work.

## Current next objective
- Execute issue #13 / B4 2D Product Acceptance using `docs/v2/CODEX_B4_PACKET.md` once the planning packet/branch is finalized.
- Restore safe renderer-neutral context requests and reverse geocoding.
- Replace implicit map-center Add Pin with precise placement mode as the universal touch/mobile route.
- Enforce effective lock semantics across all mutation surfaces.
- Qualify real user journeys from create/context-edit/history through save/reopen.
- C4.1 remains architecture-ready but is deliberately blocked from implementation until B4 reports `B4_2D_PRODUCT_ACCEPTANCE_QUALIFIED` and `READY_TO_START_C4_1`.
