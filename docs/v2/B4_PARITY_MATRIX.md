# B4 — 2D Interaction / Product-Parity Matrix

Status: planning baseline  
Date: 2026-08-26  
Issue: #13

## 1. Purpose

Macro A and Macro B qualified the data model, persistence, renderer boundary, workspace, history, search isolation, and responsive behavior. They did **not** yet qualify the whole 2D product as a complete day-to-day interaction surface.

B4 closes that gap before any C4 3D implementation starts.

The rule is not “copy every v1 implementation detail.” The rule is:

> Every useful and safe v1 user workflow must either work in v2, have a clearly better replacement, or be explicitly retired with a documented reason.

The legacy reference is the pre-v2 runtime baseline `5f4823534c80fd7a2b53d4b55ff76d18975521d2`. The current accepted runtime baseline before B4 is Macro B squash merge `501f996217857945e3008bae226ab7d19d5573e8`.

## 2. Status vocabulary

- **PASS** — current v2 behavior is present and product-acceptable.
- **IMPROVED** — behavior exists in a deliberately better v2 form.
- **GAP** — user capability is missing, incomplete, misleading, or bypasses an accepted invariant.
- **INTENTIONAL CHANGE** — behavior should change in B4 rather than reproduce the v1 behavior exactly.
- **DEFERRED** — valid feature, but not required for B4 2D product acceptance.

## 3. Navigation / basemap / search

| User workflow | v1 | Current v2 | B4 status / decision |
|---|---|---|---|
| Pan / zoom map | Yes | Yes | **PASS** |
| Zoom controls | Yes | Yes | **PASS** |
| Basemap switching | 7 basemaps | 7 renderer-managed basemaps | **PASS** |
| Forward place search | First-result oriented | Multiple deterministic results + explicit Add | **IMPROVED** |
| Search preview is transient | Weak in v1 | Qualified in Macro B | **IMPROVED** |
| Search preview must not dirty/history | Not explicit | Qualified in Macro B | **PASS** |
| Reverse geocode an arbitrary map point | Yes, from blank-map context menu | Geocoder abstraction only exposes `search()` | **GAP — restore through renderer-neutral geocoding contract** |

## 4. Blank-map contextual workflow

| User workflow | v1 | Current v2 | B4 status / decision |
|---|---|---|---|
| Right-click blank map | Custom context menu | DOM placeholder/help remain but no production `contextmenu` binding | **GAP — blocking regression** |
| Add marker at right-clicked coordinate | Yes | No | **GAP — restore** |
| Show exact coordinate in menu | Yes | No | **GAP — restore** |
| Show reverse-geocoded address/status | Yes | No | **GAP — restore safely** |
| Menu closes on map click / Escape | Yes/partial | No live menu | **GAP — implement explicitly** |
| Menu clamped inside viewport | Basic custom positioning | No live menu | **GAP — harden** |
| Stale reverse-geocode request cannot update a newer menu | Not protected | N/A | **INTENTIONAL CHANGE — required safety/UX hardening** |

## 5. Marker workflow

| User workflow | v1 | Current v2 | B4 status / decision |
|---|---|---|---|
| Create marker from toolbar | Yes | Yes, but no-coordinate path saves at map center | **INTENTIONAL CHANGE — make toolbar enter precise placement mode** |
| Create marker at exact map point | Right-click shortcut | Missing | **GAP — restore right-click + universal placement tool** |
| Name marker | Yes | Yes | **PASS** |
| Marker color | Yes | Yes | **PASS** |
| Drag marker | Yes | Yes + coalesced history | **IMPROVED** |
| Show/hide marker labels | Yes | Yes | **PASS** |
| Add/edit/delete radius rings | Yes | Yes via workspace/modal | **PASS** |
| Radius follows marker drag | Yes | Qualified | **PASS** |
| Double-click marker label to edit | Yes | Current popup content routes dblclick to `edit` | **PASS** |
| Right-click marker | Edit / radius / delete | Missing | **GAP — restore using stable FeatureId** |
| Context action selects/syncs workspace row | No workspace in v1 | N/A | **INTENTIONAL CHANGE — required** |

## 6. Text annotation workflow

| User workflow | v1 | Current v2 | B4 status / decision |
|---|---|---|---|
| Add text at clicked coordinate | Yes | Yes | **PASS** |
| Drag text | Yes | Yes | **PASS** |
| Edit text | Yes | Yes | **PASS** |
| Rotate text | Yes | Yes | **PASS** |
| Delete text | Yes | Yes | **PASS** |
| Right-click text | Edit / rotate / delete | Missing | **GAP — restore** |
| Text remains safe literal text | Unsafe legacy risk | Qualified safe rendering | **IMPROVED — never regress for parity** |

## 7. Shape / arrow workflow

| User workflow | v1 | Current v2 | B4 status / decision |
|---|---|---|---|
| Draw polyline | Yes | Yes | **PASS** |
| Draw polygon | Yes | Yes | **PASS** |
| Draw rectangle | Yes | Yes | **PASS** |
| Draw circle | Yes | Yes | **PASS** |
| Draw semantic arrow | Yes | Yes, semantic persistence | **IMPROVED** |
| Edit geometry | Yes | Yes + transaction history | **IMPROVED** |
| Edit style/color | Yes | Yes | **PASS** |
| Delete | Yes | Yes | **PASS** |
| Measurement popup / distance or area | Yes | Renderer supports current measurement popup | **PASS, requalify in product journeys** |
| Right-click generic shape | Edit geometry / color / delete | Missing | **GAP — restore** |
| Right-click arrow | Edit geometry / color / delete | Missing | **GAP — restore** |

## 8. Project / persistence workflow

| User workflow | v1 | Current v2 | B4 status / decision |
|---|---|---|---|
| Save project | Yes | Schema v2 deterministic save | **IMPROVED** |
| Open project | Yes | Validate-before-replace + v1 migration | **IMPROVED** |
| Undo / redo | No robust domain history | Qualified | **IMPROVED** |
| Saved / Unsaved state | Weak | Baseline fingerprint semantics | **IMPROVED** |
| Delete all | Yes | Yes | **PASS, include journey smoke** |
| Quick PNG export | Yes | Yes | **PASS, not report-quality** |
| Invalid import preserves active project | Not guaranteed | Qualified | **IMPROVED** |

## 9. Workspace / lock integration gaps

These are not v1 parity items; they are Macro B capabilities that must be product-acceptable before C4.

| User workflow | Current v2 observation | B4 decision |
|---|---|---|
| Feature/group lock visually indicated | Yes | **PASS** |
| Effective lock blocks Leaflet dragging/editing | Partially enforced in renderer | **REQUALIFY** |
| Effective lock blocks inspector content/style/radius/group edits | Inspector inputs are not disabled by effective lock | **GAP — enforce** |
| Effective lock blocks Delete shortcut/context destructive actions | Not consistently guarded at domain/application command surface | **GAP — enforce** |
| Locked object remains selectable and zoomable | Desired | **REQUIRED** |
| Visibility remains available while locked | Desired | **REQUIRED** |
| Group lock preserves child `locked` flag | Qualified in Macro B | **PASS — preserve** |
| Unlocking feature cannot defeat group lock | Must follow `group.locked || feature.locked` | **REQUIRED** |

## 10. Help / discoverability / touch

| User workflow | Current v2 | B4 status / decision |
|---|---|---|
| Help documents right-click menu | Yes | **GAP because documented behavior is currently absent** |
| Help explains Objects / Inspector | Incomplete relative to current product | **GAP — update** |
| Right-click is optional shortcut, not sole path | Workspace covers feature actions but not exact blank-map marker placement | **GAP — toolbar placement mode required** |
| Mobile/touch can add marker at exact point | Current toolbar defaults to map center if no coordinate | **GAP — placement mode required** |
| Escape cancels placement/drawing/transient actions | Partially qualified | **REQUALIFY with marker placement and context menu** |
| Context menu keyboard/focus behavior | Missing | **GAP — basic accessible focus + Escape** |

## 11. Renderer-neutral contextual interaction contract

B4 should add a renderer-neutral event concept equivalent to:

```ts
export interface MapContextRequest {
  featureId: FeatureId | null;
  coordinate: Coordinate; // WGS84 [longitude, latitude]
  clientPoint: { x: number; y: number };
  source: 'mouse' | 'keyboard' | 'touch';
}

interface MapRenderer {
  onContextRequest(listener: (request: MapContextRequest) => void): () => void;
}
```

The exact name may differ, but these rules are mandatory:

- no `L.Layer`, `L.LatLng`, Leaflet event, runtime stamp, or DOM event object crosses the renderer boundary;
- `RendererHost` rebinds the listener when a renderer is replaced;
- background request uses `featureId: null`;
- feature request uses stable `FeatureId`;
- feature right-click does not also trigger the background context menu;
- context request state itself is transient and never serialized/history-recorded.

## 12. Reverse geocoding contract

Extend the existing geocoding abstraction rather than calling Nominatim directly from UI code.

Conceptually:

```ts
export interface ReverseGeocodingResult {
  label: string;
  coordinate: Coordinate;
}

interface GeocodingService {
  search(query: string): Promise<GeocodingResult[]>;
  reverse(coordinate: Coordinate): Promise<ReverseGeocodingResult | null>;
}
```

Requirements:

- use plain text only;
- deterministic mocked tests;
- request failures show non-blocking status;
- a stale response cannot overwrite a newer/closed context menu;
- reverse lookup does not dirty, serialize, or enter history.

## 13. B4 exit rule

B4 is complete only when the parity matrix has no unresolved **GAP** marked as required for 2D product acceptance, all existing A/B gates remain green, and the user journeys in `B4_2D_PRODUCT_ACCEPTANCE.md` pass in real browser execution.

Only then may C4.1 3D Preview implementation begin.
