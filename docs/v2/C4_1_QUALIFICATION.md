# C4.1 — MapLibre 3D Preview Qualification

Status: `C4_1_3D_PREVIEW_QUALIFIED`  
C4.2 readiness: `READY_FOR_C4_2`  
Date: 2026-08-27

## Handoff identity

| Item | Value |
| --- | --- |
| Repository | `bokoboss/map-tools` |
| Branch | `codex/c4-1-maplibre-3d-preview` |
| Required planning/base SHA | `74377f18921f2e9b2d5516d2eaed17e507e3ac47` |
| C4.1A foundation checkpoint | `08176ab` — `feat(c4.1a): add MapLibre preview foundation` |
| C4.1B implementation checkpoint | `6db204d` — `feat(c4.1b): render MapLibre project preview` |
| Qualification evidence commit | `6db204d` — all implementation gates below were run against this C4.1B checkpoint |
| Final head | Latest branch commit containing this qualification record; exact SHA is reported in the PR handoff |
| MapLibre dependency | `maplibre-gl@6.6.0` exactly |

The implementation starts from the required planning head. C4.1A was implemented,
tested, documented, and committed before C4.1B began. The working tree was clean
after each implementation checkpoint.

## Architecture and product boundary

- `ProjectDocumentV2` and `ProjectStore` remain the only canonical project state.
- Leaflet 2D and MapLibre 3D Preview consume the same renderer-neutral project
  snapshot and stable `FeatureId` values.
- `RendererCapabilities`, `MapModeState`, `MapModeController`, and
  `RendererHost` keep mode, camera presentation, and renderer lifecycle outside
  persistence/history.
- A candidate renderer is constructed and rendered before the current renderer is
  destroyed. A constructor/style failure therefore leaves a usable 2D renderer.
- 3D uses `DisabledDrawingAdapter`; drawing, dragging, and geometry editing are
  disabled with the explicit message: `Switch to 2D to draw or edit geometry.`
- Production uses OpenFreeMap Bright (`https://tiles.openfreemap.org/styles/bright`)
  and the OpenFreeMap planet source (`https://tiles.openfreemap.org/planet`), with
  `building` fill-extrusion using `render_height` and `render_min_height`.
- Automated tests use a deterministic local style and do not depend on public map
  availability.
- Project/user/geocoder text is inserted through safe DOM APIs (`textContent`);
  no project text is passed through `innerHTML`.
- No Three.js, React, Zustand, Terra Draw, Mapbox GL Draw, terrain library, or
  second state framework was added.

## Feature rendering matrix

| Canonical feature | Renderer projection | Qualification |
| --- | --- | --- |
| marker | DOM-backed MapLibre marker with stable ID | PASS |
| marker radii | deterministic geodesic polygon rings | PASS |
| text | DOM-backed literal Thai/English text with `textContent` | PASS |
| polyline | GeoJSON `LineString` | PASS |
| polygon | GeoJSON closed ring; closure occurs only in the adapter | PASS |
| rectangle | bounds converted to renderer-only polygon ring | PASS |
| circle | deterministic geodesic polygon ring | PASS |
| arrow | canonical shaft plus renderer-only head from the final non-degenerate segment | PASS |

All projected features retain `FeatureId`, style, visibility, effective lock, and
selection properties. No canonical geometry is mutated during projection.

## Transient state qualification

- Default 3D presentation is pitch `55°`, bearing `-20°`; `Reset north` sets
  bearing to `0°`, and `Top view` sets pitch to `0°`.
- Pitch/bearing are not fields in `ProjectDocumentV2` and do not create history or
  dirty state.
- Polygon/rectangle preview extrusion defaults to `20 m`, is keyed by stable ID,
  displays `Temporary renderer preview; never saved to the project.`, and is not
  persisted or recorded in history.
- Preview extrusion survives `3D → 2D → 3D` in the same session and is cleared by
  save/open replacement.
- Shared center/zoom uses existing `mapView` semantics while preserving the 2D
  `basemapId`.

## C4 acceptance journeys

| Journey | Result | Evidence |
| --- | --- | --- |
| C4-J1 clean renderer switch | PASS | Real mode buttons; mixed fixture fingerprint and selected stable ID survive 2D → 3D → 2D in development and static-artifact runs |
| C4-J2 camera | PASS | Real Reset north/Top view controls; project, dirty state, and history unchanged |
| C4-J3 building context | PASS | Separate `C4_REAL_PROVIDER=1` Bangkok smoke; OpenFreeMap source/layer/attribution present and `buildingFeatureCount > 0` (191 observed in a direct run) |
| C4-J4 feature matrix | PASS | Real 3D UI shows all seven semantic fixture types, marker radius projection, and Thai text |
| C4-J5 preview extrusion | PASS | Real toggle; 20 m GeoJSON height and fill-extrusion layer; survives mode switch and clears on reopen |
| C4-J6 selection/context/locks | PASS | Real 3D marker click and polygon right-click synchronize selection/context; locked action is disabled; geometry edit routes to 2D |
| C4-J7 property mutation | PASS | Real Inspector text/style edits update the 3D projection and survive undo/redo/save/open |
| C4-J8 failure fallback | PASS | Forced MapLibre construction failure leaves the canonical project unchanged and restores usable 2D controls |

The automated C4 suite intentionally skips the public-provider case unless
`C4_REAL_PROVIDER=1`; the separate real-provider smoke above is the networked
qualification evidence.

## Automated gates

| Gate | Result |
| --- | --- |
| `npm ci` | PASS — clean install; 235 packages audited, 0 vulnerabilities |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 40/40 |
| `npm run build` | PASS — Vite 6.4.3 |
| Development browser matrix | PASS — 51 passed, 1 intentional provider skip |
| Static `dist/` browser matrix (`PLAYWRIGHT_USE_PREVIEW=1`) | PASS — 51 passed, 1 intentional provider skip |
| Static production globals | PASS — `window.__mapToolsTest` and `window.MapToolsSchema` absent on the normal route |
| Forced 3D failure smoke | PASS — 2D remains usable with no project mutation |
| Real static-artifact Bangkok provider smoke | PASS — OpenFreeMap buildings and attribution verified |
| `git diff --check` | PASS |

The browser matrices were run against controlled local servers because the host
already had unrelated services using the default ports. The static-artifact run
used a plain Python HTTP server over the built `dist/` directory.

## Performance and bundle record

The accepted B4 qualification records an approximately `522 kB` minified
application chunk baseline. C4.1 produces:

| Artifact | Size | Gzip |
| --- | ---: | ---: |
| Main application chunk | 1,529.86 kB | 397.89 kB |
| MapLibre worker chunk | 478.93 kB | not separately reported |
| CSS | 137.83 kB | 29.26 kB |

The main-chunk increase is approximately `+1,007.86 kB` against the documented
B4 baseline, plus the dedicated MapLibre worker. Vite retains its existing
`>500 kB` warning; the increase is documented and intentional for the requested
MapLibre renderer. `npm ls --depth=0` contains `maplibre-gl@6.6.0` and no Three.js.

Deterministic dense smoke results (Chromium, no page errors):

| Generated project | Switch/render observation |
| --- | ---: |
| 40 dense features | 242 ms; 200 source feature records observed across rendered tiles |
| 500 dense features | 246 ms; 1,530 source feature records observed across rendered tiles |

## Known limitations and C4.2 boundary

- 3D is intentionally read-only for geometry. Drawing, vertex editing, marker/text
  dragging, and shape creation remain 2D-only.
- OpenFreeMap style and building tiles are external runtime dependencies; the
  deterministic test provider remains the CI path.
- Persistent height/elevation semantics are not present. Preview extrusion is
  deliberately transient; versioned engineering elevation belongs to C4.2.
- The production bundle is larger because MapLibre and its worker are included;
  code splitting can be considered in a later performance pass.

The renderer-neutral boundary, transient-state isolation, safe fallback lifecycle,
and qualified building/overlay path are stable enough to begin C4.2 design. No
C4.2 schema or engineering-height implementation is included here.
