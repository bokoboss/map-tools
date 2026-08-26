# Macro Phase B2 History Checkpoint

Status: passed locally
Date: 2026-08-25

## Execution identity

- Base SHA: `5a3d13d22a34e4f257e19b7c81494fb7423c2844`
- B1 checkpoint SHA: `dd66452fd34a1d2a10a51e29b993cb178cfd7c2a`
- Branch: `codex/b-productive-workspace`
- Checkpoint commit: the B2 implementation commit that adds this record

## B2 scope delivered

- Added bounded domain-only before/after snapshot history with a 100-entry default limit.
- Added undo/redo for all existing store mutations, redo invalidation after divergent edits, and history reset on project replacement.
- Added interaction transactions so continuous marker drags and geometry edits commit one logical history entry.
- Replaced the one-way dirty flag with a saved-baseline fingerprint that ignores only system `updatedAt` metadata.
- Added baseline establishment on load/save, restoration of `Saved` after undo to baseline, and preservation of the baseline during history restoration.
- Kept passive map view changes dirty when persisted but excluded them from feature-edit history.
- Added centralized Escape, Delete/Backspace, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y, and Ctrl/Cmd+S routing with editable-field protection.
- Added browser and unit coverage for keyboard routing, saved-baseline behavior, redo invalidation, load reset, and continuous interaction coalescing.

## Validation evidence

| Gate | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 29/29 |
| `npm run build` | PASS |
| `npx playwright test` | PASS — 18/18 |
| `git diff --check` | PASS before checkpoint evidence commit |

The B2 browser checks prove selection alone does not dirty/history the project, rename undo/redo returns to the loaded saved baseline, Delete is ignored while an inspector input is focused, selected-feature deletion is undoable, and a multi-event marker drag creates one history entry.

## Architecture gate

History stores normalized `ProjectDocumentV2` snapshots only. It contains no Leaflet layers, DOM nodes, renderer IDs, selection state, panel state, or search preview state. The saved baseline is an independent fingerprint and is not rewritten by undo/redo.

## Deliberately deferred to B3

Multiple-result search presentation, transient search result isolation/add-to-project browser coverage, final responsive viewport matrix, accessibility findings, dense UAT completion record, and final production qualification remain open for B3.
