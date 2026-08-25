# Macro Phase B1 Workspace Checkpoint

Status: passed locally
Date: 2026-08-25

## Execution identity

- Base SHA: `5a3d13d22a34e4f257e19b7c81494fb7423c2844`
- Branch: `codex/b-productive-workspace`
- Checkpoint commit: the B1 implementation commit that adds this record

## B1 scope delivered

- Added a renderer-neutral `WorkspaceState` containing only stable feature/group IDs and transient expansion state.
- Extended the renderer boundary with stable-ID feature selection events.
- Preserved selection across `RendererHost` renderer replacement and cleared invalid selection IDs.
- Added transient map selection highlighting without changing persisted feature styles.
- Added the desktop map-first Objects / Inspector workspace with responsive collapse behavior.
- Added persisted group rows, implicit Ungrouped, group expansion, create, rename, visibility, lock, and delete-by-ungrouping.
- Added feature row selection, visibility, lock, duplicate, zoom, delete, deterministic copy naming, and stable nested radius ID regeneration.
- Added inline common and type-specific inspector controls, including marker radii, text properties, line/arrow styling, area styling, and circle radius/styling.
- Added dense-fixture browser coverage for panel-first management and group effective-state preservation.

## Validation evidence

| Gate | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 24/24 |
| `npm run build` | PASS |
| `npx playwright test` | PASS — 15/15, including 2 B1 workspace tests |
| `git diff --check` | PASS |

The B1 browser checks use the canonical `docs/v2/fixtures/project-v2-dense-workspace.json` and prove selection/inspector synchronization, rename, duplicate naming, new feature/radius IDs, group visibility/lock child-flag preservation, and group delete-by-ungrouping.

## Architecture gate

Domain, persistence, and store modules remain free of Leaflet/MapLibre/Three runtime objects. Selection is held in `WorkspaceState` as a stable `FeatureId | null`; it is not serialized into `ProjectDocumentV2`. Leaflet runtime types remain inside the concrete renderer boundary.

## Deliberately deferred to B2/B3

Undo/redo, saved-baseline dirty semantics, keyboard routing, multi-result search UI, and final responsive/accessibility qualification remain gated work and must not begin until this checkpoint is committed and the tree is clean.
