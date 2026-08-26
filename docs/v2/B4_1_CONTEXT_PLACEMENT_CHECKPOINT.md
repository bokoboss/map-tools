# B4.1 Context, Reverse Geocode, and Exact Placement Checkpoint

Status: complete; checkpoint for B4.2 implementation
Date: 2026-08-26
Issue: #13

## Provenance

- Required B4 starting SHA: `dc5ed047a45ceaf7c651af8b2c7da3bdb4952a65`
- `origin/main` verified at the required starting SHA before implementation.
- Execution branch: `codex/b4-2d-product-acceptance`
- B4.1 implementation checkpoint SHA: `836f896` (`feat: restore 2d context and exact marker placement`)
- Accepted Macro B runtime baseline: `501f996217857945e3008bae226ab7d19d5573e8`

## Delivered behavior

- Added the renderer-neutral `MapContextRequest` contract and `RendererHost` listener rebinding.
- Added Leaflet background and feature context requests using WGS84 `[longitude, latitude]`, stable feature IDs, viewport client coordinates, and event propagation stopping for feature requests.
- Added the transient `ContextMenuController` with background coordinates, reverse-geocode loading/resolution/failure status, feature-specific actions, viewport clamping, keyboard focus, Escape close, and stale-request invalidation.
- Extended `GeocodingService` with renderer-neutral reverse lookup and implemented Nominatim reverse requests with canonical latitude/longitude query parameters and literal-safe labels.
- Replaced toolbar Add Pin center fallback with explicit placement mode: activate, click/tap exact map point, edit, and save; Escape/cancel/another annotation tool create no marker.
- Routed context actions through existing AppController and WorkspaceController commands; context and placement state remain transient.
- Updated the marker editor with a transient coordinate preview and updated the accepted Add Pin browser helper for the intentional exact-placement behavior change.

## Checkpoint validation

The following gates passed before this checkpoint commit:

- `npm run lint`
- `npm run typecheck`
- `npm test` - 31 passing tests (29 accepted baseline plus 2 B4.1 tests)
- `npx playwright test tests/b4-context-placement-browser.spec.js` - 5 passing tests
- `git diff --check`

The focused browser suite covers background and feature right-click behavior, exact coordinates, safe reverse text, stale/closed requests, placement mode, Escape/cancel, and tool cancellation. Full B4.2 lock and product-journey qualification remains outstanding.

## Checkpoint state

The working tree was verified clean after committing B4.1. B4.2 lock enforcement and J1-J8 product acceptance work starts after this checkpoint.
