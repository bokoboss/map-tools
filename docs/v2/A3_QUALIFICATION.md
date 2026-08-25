# A3 Qualification — Vite + TypeScript Renderer-Ready Architecture

Status: qualified; PR #11 is open and its initial full CI run passed.

## Identity

- Repository: `bokoboss/map-tools`
- Execution branch: `codex/a3-vite-typescript-renderer-ready`
- Base SHA: `39f57eed548ed7fcd4b077659e12eb5ec10c92b4`
- Implementation head SHA: `18af39508ac4d4b38533f817b682d53665f1777b`; the final PR tip also includes this qualification record.
- Qualification head SHA: `3c02227181fedcca8a3e016738dfe902029e8b74`

The branch was synchronized from `origin` before implementation. The execution branch, `origin/main`, and the requested starting point all resolved to the base SHA above.

## Scope result

A3 migrates the production entry point to Vite and strict TypeScript while preserving the accepted A1+A2 project behavior, persistence, migration, security, and browser characterization coverage. Leaflet remains the active renderer. No MapLibre, Three.js, terrain, pitch/orbit camera, visible 2.5D/3D, object manager, undo/redo, React, Leaflet.draw replacement, or Leaflet 2 migration was introduced.

## Architecture evidence

- `src/domain/model.ts` contains the renderer-neutral Project Schema v2 types. Canonical coordinates remain WGS84 `[longitude, latitude]`.
- `src/domain/project.ts` contains pure project creation, cloning, and semantic helpers.
- `src/store/ProjectStore.ts` owns the canonical project snapshot, mutation notifications, dirty state, and replacement lifecycle.
- `src/persistence/projectSchema.ts` owns validation, serialization, v1 migration, and effective-state derivation without importing Leaflet or DOM runtime types.
- `src/map/renderer/MapRenderer.ts` and `src/map/renderer/RendererHost.ts` define the renderer-neutral boundary and explicit renderer replacement lifecycle.
- `src/map/leaflet/LeafletRenderer.ts` is the only production map-rendering module that owns Leaflet runtime objects. `src/map/leaflet/coordinates.ts` is the explicit coordinate conversion boundary.
- `src/drawing/DrawingAdapter.ts` is renderer-neutral; `src/drawing/LeafletDrawAdapter.ts` contains the permitted Leaflet.draw-specific drawing integration.
- `src/measurement/` and `src/geocoding/` expose pure/service interfaces rather than map-library runtime objects.
- The A3 browser hook reinitializes the Leaflet renderer against the same store snapshot, proving renderer teardown/recreation without project reload or schema migration.
- `index.html` has one Vite module entry and no Tailwind Play CDN or CDN-hosted application runtime libraries. Leaflet, Leaflet.draw, html2canvas, Tailwind/PostCSS, Vite, and TypeScript are lockfile-managed npm dependencies.

## Qualification commands and results

All commands below were run from a clean dependency installation using the committed lockfile.

| Gate | Command | Result |
|---|---|---|
| Clean install | `npm ci` | PASS; 213 packages audited, 0 vulnerabilities |
| Lint | `npm run lint` | PASS |
| Strict typecheck | `npm run typecheck` | PASS |
| Unit/integration/architecture tests | `npm test` | PASS — 22/22 |
| Production build | `npm run build` | PASS — Vite 6.4.3; relative `./assets/` output |
| Development browser characterization | `npm run test:browser` | PASS — 13/13 |
| Production preview browser characterization | `PLAYWRIGHT_USE_PREVIEW=1 npm run test:browser` | PASS — 13/13 |
| Static-host browser check | `python -m http.server 4174 --directory dist` plus Chromium load | PASS — `__mapToolsTest=true`, page errors `[]` |
| Dependency audit | `npm audit --omit=dev`; `npm audit` | PASS — 0 vulnerabilities for both |
| Diff hygiene | `git diff --check` | PASS |

The 13 browser checks cover the original desktop shell and C-01 through C-07 characterization, mixed semantic v2 rendering, browser save/open round-trip, invalid-import preservation, security text rendering, and the A3 renderer reinitialization check.

## Browser/static deployment qualification

The production build was served with Vite preview and passed the complete 13-test browser suite. It was also served directly from `dist/` using Python's static HTTP server and loaded successfully in Chromium with no page errors. `vite.config.ts` sets `base: './'`; the generated HTML references `./assets/...`, so the artifact is compatible with repository-subpath/static hosting such as GitHub Pages. Runtime map tiles and Nominatim geocoding remain external network services by design.

## Protected behavior

The existing A1+A2 characterization and schema/security tests remain in place. The TypeScript persistence implementation is exercised by the schema tests; the legacy source files used by the original characterization guard remain retained but are not loaded by the Vite production entry. Invalid imports are validated before store replacement, user/project strings are rendered as text or escaped SVG values, search results remain transient until explicit add, and canonical project state never stores Leaflet objects.

## Deviations and known limitations

- Leaflet is intentionally still the only concrete renderer in A3; the second renderer is an architectural capability, not an implemented feature.
- Leaflet.draw remains the current drawing engine behind its adapter, as required.
- `script.js` and `src/project-schema.js` remain as legacy compatibility/characterization sources outside the production Vite graph. Removing them would change the protected characterization guard and is deferred until that guard is migrated in a separately qualified change.
- The existing workspace shell and visual design remain intentionally unchanged.
- External basemap tile availability, Nominatim availability/rate limits, and browser CORS behavior remain deployment-time dependencies.
- Macro Phase B/C work and all visible 3D work remain out of scope.

## Readiness decisions

- Macro Phase A: `FULLY_QUALIFIED_FOR_A3` locally; no Macro Phase B or C work started.
- Future renderer readiness: `READY_FOR_FUTURE_3D_RENDERER`.

Evidence for the future-renderer decision is the shared canonical store/schema, semantic view state, stable feature IDs, explicit renderer host lifecycle, isolated Leaflet coordinate conversion, and the passing renderer reinitialization test. A future MapLibre visualization can be added against the same Project Schema/store without rewriting persistence or duplicating canonical project state; implementing that renderer remains a later phase.

## CI

The GitHub Actions workflow runs `npm ci`, lint, strict typecheck, unit/integration tests, production build, Playwright Chromium installation, and the full browser suite. The PR and completed CI evidence are recorded below.

- PR: [#11 — A3 Vite + TypeScript modular architecture, renderer-ready](https://github.com/bokoboss/map-tools/pull/11)
- CI run: [32852555470](https://github.com/bokoboss/map-tools/actions/runs/32852555470) — `success` for implementation PR head `01cde061f7934145e1f6dc82101bdb8c1bdc5e63`
- Final qualification-tip CI run: [32852783846](https://github.com/bokoboss/map-tools/actions/runs/32852783846) — `success` for qualification head `3c02227181fedcca8a3e016738dfe902029e8b74`
