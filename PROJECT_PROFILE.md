# Project Profile

## Identity
- Project name: Map Tools
- Repository URL: https://github.com/bokoboss/map-tools
- Authoritative local path: `C:\MyRD\map-tools`
- Primary branch: `main`
- Package/application version: `2.0.0` (current package metadata; v2 product remains under phased development)

## Current accepted baseline
- Accepted branch: `main`
- Accepted HEAD SHA: `764d0044b999d3857b896e583becbc5218879caf`
- Accepted date: 2026-08-25
- Current phase/milestone: Macro Phase A — A1+A2 accepted; A3 modular architecture is next
- Last accepted PR / CI run: PR #9; final reviewed PR-head CI run `32847542043` passed before squash merge

## Technology stack
- Languages: JavaScript, HTML, CSS, JSON; TypeScript planned for A3
- Frameworks/libraries: Leaflet 1.9.4, Leaflet.draw 1.0.4, Leaflet GeometryUtil, Tailwind Play CDN, iro.js, html2canvas; Playwright for browser tests
- Package manager: npm with committed `package-lock.json`
- Supported OS/runtime: static browser application; Node.js 20 in CI; authoritative local development environment is Windows

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
npm test
node --check script.js
```

### Full validation
```text
npm run test:all
node --check script.js
git diff --check
```

### Build/package
```text
No production build command in the accepted A1+A2 static application.
A Vite + TypeScript production build is an A3 requirement.
```

### Local run
```text
npm run serve
```
Then open `http://127.0.0.1:4173/index.html`.

## Architecture / invariants
- Project/domain data is the canonical persistence boundary; Leaflet runtime objects are renderer/editor state, not the persisted data model.
- Project Schema v2 is versioned and validated before an imported candidate can replace the active project.
- Persisted WGS84 coordinate order is `[longitude, latitude]`; Leaflet adapter/runtime conversion owns `[latitude, longitude]` conversion.
- Stable project/group/feature/radius IDs must not depend on Leaflet runtime IDs.
- Supported semantic feature types are marker, marker radius rings, text, polyline, polygon, rectangle, circle, and arrow.
- Text and user/project labels are plain text; imported strings must not create executable HTML/event handlers.
- Search results remain transient until the user explicitly adds them to the project.
- Invalid imports must leave the active project and rendered state unchanged.
- Drawing-engine replacement and Leaflet major-version migration are deferred decisions, not implicit A3 requirements.
- A3 must strengthen the renderer boundary so a future second renderer (for example MapLibre-based 3D visualization) can be added without changing Project Schema/domain semantics.

## Protected behavior
Changes must not alter the following unless explicitly approved:
- A1 C-01..C-07 characterized marker/radius/shape/arrow/text/search/save-open behavior except where an intentional product change is documented and accepted.
- Project Schema v2 round-trip semantics and stable IDs.
- Marker radius-ring persistence.
- Text content/rotation persistence and safe literal rendering.
- Arrow semantic identity and arrow-head behavior.
- Rectangle bounds semantics and circle center/radius semantics.
- Validation-before-replace behavior for project import.
- WGS84 `[longitude, latitude]` persistence order.
- v1 migration must recover only supportable content and must not invent ambiguous text/arrow semantics.

## Important paths
- Source: `index.html`, `script.js`, `style.css`, `src/project-schema.js`
- Tests: `tests/`, `playwright.config.cjs`, `docs/v2/fixtures/`
- Documentation: `docs/v2/`, `docs/development/`
- Generated output: Playwright `test-results/` / `playwright-report/` are ignored; production build output does not yet exist
- Local-only / sensitive / licensed data: none required by the accepted repository baseline; project-specific client/sensitive data must not be committed unless explicitly approved

## Validation matrix
| Gate | Command / Method | Required |
|---|---|---|
| Unit / targeted | `npm test` | Yes |
| Integration / regression | Project Schema tests + A1 behavior characterization | Yes |
| Browser/UI | `npm run test:browser` | Yes for behavior/UI changes |
| Full local regression | `npm run test:all` | Yes before handoff/merge |
| Syntax / diff hygiene | `node --check script.js`; `git diff --check` | Yes while static JS remains |
| Security | unsafe-text fixture + invalid-import tests | Yes for persistence/rendering changes |
| Real-data/reference | representative v1 fixture + canonical v2 fixtures | Required where relevant |
| CI | `.github/workflows/ci.yml` `test` job | Yes |
| Build/package/runtime | no production build yet; becomes mandatory in A3 | A3 onward |

## Execution characteristics
- Typical task ambiguity: medium; product/UX intent should be resolved in ChatGPT before Codex execution
- High-risk areas: persistence/schema migrations, coordinate conversion, renderer/domain coupling, safe text rendering, import replacement, drawing lifecycle, future renderer migration
- Modules safe to parallelize: documentation/specification and isolated pure-domain utilities only when ownership is explicit
- Modules tightly coupled / single-owner: Project Schema/persistence boundary, map renderer/event bridge, application state migration, drawing integration
- Preferred local execution constraints: use the cheapest model that can reliably finish a bounded packet; local/browser/runtime changes require actual tests and CI evidence before acceptance

## Git / release policy
- Branch naming: bounded task branches such as `codex/a3-vite-typescript` or equivalent issue-oriented names
- Commit policy: keep auditable checkpoints for material migration stages; avoid unrelated refactors
- PR policy: one bounded objective per PR where practical; include issue, exact validation evidence, limitations, and readiness recommendation
- Merge policy: ChatGPT/control-plane review of actual diff + CI/evidence; material architecture/schema/security changes require scrutiny gate; squash merge is preferred for accepted bounded PRs unless history itself is required
- Release policy: no v2 Core release until the release qualification gates in `docs/v2/TEST_AND_UAT_PLAN.md` are satisfied

## Current known limitations / risks
- Runtime libraries are still CDN-hosted; dependency management/production build is deferred to A3.
- Application remains a monolithic static JavaScript structure despite the new pure Project Schema module.
- Legacy v1 text/arrow semantics cannot be recovered reliably from ambiguous saved files.
- Object manager, groups editing, undo/redo, dense-project workflow, report-quality export, engineering toolkit, interoperability, and 3D visualization are not yet implemented.
- Current browser tests rely on the existing CDN runtime path; A3 should move production dependencies into the package/build system and make CI less externally fragile.

## Current next objective
- Execute A3: Vite + TypeScript modular architecture while preserving the accepted A1+A2 behavior/persistence/security suite.
- A3 must establish a renderer abstraction that keeps the current Leaflet renderer replaceable and prepares for a future MapLibre/3D visualization renderer without implementing the 3D feature itself.
