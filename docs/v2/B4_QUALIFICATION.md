# B4 2D Product Acceptance Qualification

Status: locally qualified; GitHub Actions control-plane status is not reported for the final PR evidence head.

Date: 2026-08-26

Issue: [#13 - B4 2D product acceptance and interaction parity](https://github.com/bokoboss/map-tools/issues/13)

## Provenance

- Repository: `bokoboss/map-tools`
- Execution branch: `codex/b4-2d-product-acceptance`
- Required B4 starting SHA: `dc5ed047a45ceaf7c651af8b2c7da3bdb4952a65`
- `origin/main` was verified at the required starting SHA before implementation.
- Accepted Macro B runtime baseline: `501f996217857945e3008bae226ab7d19d5573e8`
- B4.1 implementation checkpoint: `836f896e3082a058c0ee78701273f29967e8b6f2`
- B4.1 checkpoint evidence commit: `2936e26364bfbd43878da5a3f3d4e82205f0e39f`
- B4.2 implementation/remediation head: `c47c7249fb8c6e65aa196a7c05de6a4e46896126`
- Qualification evidence commit before this final decision update: `c5bd71eb47ea14918fd000fdf115acfe838d0c49`
- PR: [#16 - B4: qualify 2D product acceptance and interaction parity](https://github.com/bokoboss/map-tools/pull/16), open, against `main`, intentionally unmerged, and closing #13.
- The final PR tip is the latest pushed commit on PR #16; its exact SHA is reported in the final handoff after this document update. No future SHA is pre-claimed in this document.

The B4.1 implementation and checkpoint were committed before B4.2 work began. B4.2 implementation is separated from this qualification artifact so code provenance and qualification evidence remain independently auditable.

## Qualification gates

| Gate | Command or method | Result |
|---|---|---|
| Clean dependency install | `npm ci` | PASS - 212 packages added, 213 audited, 0 vulnerabilities |
| Lint | `npm run lint` | PASS |
| Strict typecheck | `npm run typecheck` | PASS |
| Unit/integration/architecture tests | `npm test` | PASS - 33/33 |
| Production build | `npm run build` | PASS - Vite 6.4.3; 31 modules transformed |
| Development browser suite | `npm run test:browser` | PASS - 41/41 cases reported `ok` |
| Production-preview browser suite | `PLAYWRIGHT_USE_PREVIEW=1 npm run test:browser` | PASS - 41/41 cases reported `ok` |
| Diff hygiene | `git diff --check` | PASS |
| Static artifact smoke | Plain `py.exe -3 -m http.server 4174 --directory dist` plus Chromium load of `/index.html` | PASS - map and workspace visible; no app/page exception; production test globals absent |

The two Windows browser invocations completed all cases but their Vite child process did not exit after the final passing case. Only the exact Map Tools Playwright/Vite/esbuild process trees were stopped after the complete `41/41` result. This is a Windows test-server teardown limitation, not a failed test case. The build emitted the existing minified-chunk warning for the approximately 522 kB JavaScript bundle.

## Browser count and journey coverage

The final browser suite contains the accepted 28-case browser baseline plus 13 B4 cases: six focused context/placement/parity cases and seven product-journey cases. The final unit/integration count is the accepted 29-case baseline plus four B4 policy/reverse-geocode/store cases.

| Journey | Result | Evidence |
|---|---|---|
| J1 exact-point context marker | PASS | Real Chromium: background right-click, exact coordinates/address, Add marker here, name/color, radius, drag, undo/redo, save/reopen |
| J2 toolbar/touch-equivalent placement | PASS | Real Chromium: Add Pin placement mode, exact map click, editor/save path, Escape/cancel/no-feature paths, and annotation-tool cancellation |
| J3 marker context actions | PASS | Real Chromium: stable-ID selection sync, context edit, radius management, delete, undo |
| J4 text context actions | PASS | Real Chromium: create, right-click edit/rotate/delete, undo/redo, literal unsafe-looking text remains text |
| J5 shape and arrow context actions | PASS | Real Chromium: toolbar polygon and arrow creation, context style/geometry routes, undo/redo, save/open; focused polyline/rectangle/circle context coverage |
| J6 effective lock protection | PASS | Real Chromium: direct feature lock and parent-group lock across inspector, workspace, keyboard, context, popup, radius, duplicate, delete, move, geometry, and unlock routes |
| J7 context lifecycle/accessibility | PASS | Real Chromium: feature/background separation, replacement, normal-click close, Escape, viewport clamp, first-action focus, disabled locked actions |
| J8 Help/discoverability | PASS | Real Chromium: Help covers navigation, basemap/search, Add Pin, right-click, Objects / Inspector, history, saved state, lock, touch, and file actions |

J2 is covered by the focused placement suite rather than a separately named test in `tests/b4-product-journey.spec.js`; it is included in the final 41-case count.

## Parity matrix outcome

Every B4-required blocking GAP in `docs/v2/B4_PARITY_MATRIX.md` is resolved for the 2D acceptance scope:

| Required parity or product gap | Outcome |
|---|---|
| Background right-click context request | PASS - renderer-neutral request with `featureId: null` |
| Feature right-click and stable-ID selection | PASS - feature request stops propagation and synchronizes Objects / Inspector |
| Background coordinates and reverse address | PASS - canonical `[longitude, latitude]`, safe plain text, loading/failure state |
| Reverse stale/closed response isolation | PASS - generation token invalidates older or closed menus |
| Add Pin exact placement | PASS - intentional change from map-center fallback to explicit placement mode |
| Marker, text, shape, and arrow contextual actions | PASS - all required action families converge on existing app/store commands |
| Effective lock enforcement | PASS - centralized feature policy plus application, workspace, popup, and renderer guards |
| Help and touch-equivalent workflow | PASS - Help describes real controls and toolbar/workspace alternatives |
| Required semantic save/open behavior | PASS - marker/radii, text, polygon, arrow, rectangle, and circle semantics survive |

No required B4 parity `GAP` remains unresolved. No MapLibre, Three.js, 3D, framework migration, or drawing-engine replacement was added.

## Lock-surface matrix

Effective lock is `group.locked || feature.locked`. The reusable policy is `canMutateFeature(project, featureId, mutationKind)` in `src/domain/mutationPolicy.ts`; `ProjectStore.updateFeature` and `ProjectStore.removeFeature` reject blocked feature mutations before cloning, history, dirty-state, or event emission.

| Surface or mutation | Effectively locked behavior | Evidence |
|---|---|---|
| Select, inspect, zoom/fit | Allowed | J6 workspace and selection assertions |
| Feature visibility | Allowed | J6 toggles visibility while locked |
| Legitimate feature lock toggle | Allowed; does not defeat a locked parent group | J6 direct/group lock sequence |
| Group visibility and lock toggle | Allowed; child `locked` flag is preserved | Existing workspace characterization plus J6 |
| Marker/text move | Blocked; renderer is non-draggable and runtime attempts restore canonical state | J6 and renderer guard |
| Shape geometry edit | Blocked; edit activation and edit events are guarded | J6 and renderer guard |
| Name/content edit | Blocked | Disabled inspector/modal routes and J6 |
| Style/color, text rotation, circle radius | Blocked | Disabled inspector/context/modal routes and J6 |
| Radius add/edit/delete | Blocked | Disabled inspector/context/popup routes and J6 |
| Feature group reassignment | Blocked | Disabled inspector select and store policy |
| Feature delete, Delete/Backspace, duplicate | Blocked | Disabled workspace actions, keyboard guard, context/popup guard, and J6 |
| Group rename | Blocked when the group itself is locked | Disabled group rename action and J6 |
| Group delete-by-ungrouping | Allowed as the existing Macro B group-level command; child features and direct lock flags are preserved | Existing accepted group-delete characterization and explicit policy exception |

Blocked operations create no history entry, do not dirty the project, and do not leave a partial runtime edit. The group-delete exception is intentional compatibility with the accepted Macro B contract: it removes a group container and ungroups its children; it does not delete child feature data or overwrite child lock flags. Feature-level delete and reassignment remain blocked while effectively locked.

## Reverse-geocode and transient-state evidence

- Unit coverage verifies Nominatim receives `lat` and `lon` query parameters derived from canonical `[longitude, latitude]` in the correct order.
- Browser coverage mocks Nominatim with literal text such as `<safe literal address>` and verifies it is rendered with `textContent`, not HTML.
- Browser coverage releases an older reverse request after a newer menu is open and after a menu is closed; neither stale result changes the current menu.
- Context menu, reverse status, placement state, selection, and search-preview state remain transient and are absent from `ProjectDocumentV2`, dirty state, history, and serialization.

## Static artifact and production-global smoke

The final `dist/` build was served by a plain static Python server and opened in Chromium at `http://127.0.0.1:4174/index.html`. The rendered map and `#workspace-panel` were visible. The page had no application/page exception; the only console entry was the expected missing optional `favicon.ico` resource (`404`). On the normal production route:

- `typeof window.__mapToolsTest === "undefined"`;
- `typeof window.MapToolsSchema === "undefined"`.

The production browser suite also passed its no-test-globals check.

## CI and control-plane provenance

The active workflow is `.github/workflows/ci.yml` and runs `npm ci`, lint, typecheck, unit tests, build, Chromium installation, and the browser suite. PR #16 is open, unmerged, and targets base SHA `dc5ed047a45ceaf7c651af8b2c7da3bdb4952a65`.

For both the initial B4.2 implementation head `c47c7249fb8c6e65aa196a7c05de6a4e46896126` and the qualification evidence head `c5bd71eb47ea14918fd000fdf115acfe838d0c49`, GitHub reported zero workflow runs, zero check runs, and zero status contexts after polling. The workflow file is active and present on `main`, but no PR run was created or exposed for these heads. CI result: `NOT REPORTED` (not PASS and not FAIL). This is recorded as an infrastructure/control-plane limitation; it is not represented as a green CI result, and the complete local CI-equivalent gates are listed above.

## Known limitations and intentional v1 changes

- Add Pin intentionally no longer creates a marker at the current map center; it now requires an explicit map click/tap placement before Save.
- Desktop right-click is a shortcut; long-press context menus are not required. Touch users have toolbar placement plus Objects / Inspector management.
- The existing Macro B group command deletes a group by ungrouping children, including while the group is locked; child feature records and direct lock flags are preserved.
- Leaflet remains the only concrete renderer and Leaflet.draw remains the drawing engine; C4/MapLibre/3D is out of scope.
- Basemap tiles and Nominatim remain external network dependencies and may be rate-limited or unavailable.
- The production bundle retains the existing >500 kB minified-chunk warning.
- The plain static smoke reports a missing optional `favicon.ico`; it does not affect app rendering.
- The Windows Playwright/Vite test-server child needs explicit cleanup after all cases report passing; Linux CI is expected to exercise normal workflow teardown.

## Final decisions

Local product acceptance gates and all J1-J8 journeys pass.

- `B4_2D_PRODUCT_ACCEPTANCE_QUALIFIED` - the required local product-acceptance, parity, lock, persistence, static, and real-browser evidence is green. GitHub Actions did not report a run for the final PR evidence head, so control-plane review must still confirm CI infrastructure/status before merge.
- `BLOCK_C4_1` - C4.1 must not start because PR #16 is intentionally unmerged, B4 has not yet received control-plane acceptance, and the final GitHub Actions status is not reported. This remains true even though the local 2D product-acceptance evidence is green.
