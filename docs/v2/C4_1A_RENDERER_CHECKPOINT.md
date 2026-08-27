# C4.1A Renderer Foundation Checkpoint

Status: accepted foundation checkpoint for C4.1B implementation.

## Scope

C4.1A establishes the renderer-neutral MapLibre preview boundary without changing
`ProjectDocumentV2`, persistence, history, or the canonical `ProjectStore`.

- `MapRenderer` exposes capabilities, transient camera presentation, map-view
  notifications, preview-extrusion input, and interaction cancellation.
- `RendererHost` constructs a candidate renderer before destroying the active
  renderer and rebinds listeners by stable renderer-neutral interfaces.
- 2D Leaflet and 3D MapLibre use separate empty surfaces, so a failed candidate
  cannot blank the active map.
- `MapModeState` keeps mode, 3D camera, and preview-only state out of project
  serialization and history.
- 3D Preview uses a read-only `DisabledDrawingAdapter`; drawing and geometry
  editing controls are disabled with an explicit 2D recovery message.
- A deterministic network-free style is used by browser tests. Production uses
  the required OpenFreeMap Bright style and MapLibre's worker URL.

## Success gates

| Gate | Evidence |
| --- | --- |
| `maplibre-gl` is exact `6.6.0` | `package.json` and lockfile |
| canonical state remains renderer-independent | architecture tests and existing schema/store tests |
| C4.1A mode switch preserves project and selection | `tests/c4-foundation-browser.spec.js` |
| camera reset/top view are transient | `tests/c4-foundation-browser.spec.js` |
| constructor failure leaves usable 2D | `tests/c4-foundation-browser.spec.js` |
| existing B4/browser behavior remains green | existing unit and browser suites |
| lint, typecheck, and build pass | recorded in the implementation handoff |

## Deliberate limits

Feature overlays, geometry conversions, transient polygon/rectangle extrusion
layers, full C4-J1..J8 qualification, and the real Bangkok provider smoke are
C4.1B scope. No Three.js or second project state store is introduced.
