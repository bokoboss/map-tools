# C4.1 — Renderer Architecture Contract

Status: authoritative implementation architecture  
Date: 2026-08-27

## 1. Architecture decision

C4.1 introduces a second concrete MapRenderer:

```
ProjectDocumentV2 / ProjectStore
          |
     RendererHost
       /      \
Leaflet 2D   MapLibre 3D Preview
```

The canonical project/store remains single-owner and renderer-neutral.

The 3D renderer is a **preview renderer**, not a second editor/database.

## 2. Dependency decision

Use:
- `maplibre-gl@6.6.0` through npm and committed lockfile;
- MapLibre native GeoJSON/style layers for project overlays and fill extrusion.

Do not add Three.js in C4.1.

Three.js remains C4.3 scope for true 3D assets/custom model layers.

## 3. Source boundaries

Required structure, names may vary only slightly:

```
src/map/
  renderer/
    MapRenderer.ts
    RendererHost.ts
  mode/
    MapModeState.ts
    MapModeController.ts
  leaflet/
    LeafletRenderer.ts
  maplibre/
    MapLibrePreviewRenderer.ts
    projectGeoJson.ts
    previewStyle.ts
    geometry.ts
```

Rules:
- `src/domain`, `src/store`, `src/persistence` must not import MapLibre.
- `ProjectDocumentV2` must not contain MapLibre classes/style objects/camera objects.
- MapLibre-specific types stay under `src/map/maplibre` or the composition root.
- stable FeatureId is the only identity crossing renderer boundaries.

## 4. Renderer capabilities

Extend the renderer-neutral interface with an explicit capability contract.

Conceptual model:

```ts
export type RendererMode = '2d' | '3d-preview';

export interface RendererCapabilities {
  mode: RendererMode;
  drawing: boolean;
  geometryEditing: boolean;
  featureDragging: boolean;
  basemapSwitching: boolean;
  pitchBearing: boolean;
  contextRequests: boolean;
}
```

Required values:

LeafletRenderer:
- mode = 2d;
- drawing = true;
- geometryEditing = true;
- featureDragging = true;
- basemapSwitching = true;
- pitchBearing = false;
- contextRequests = true.

MapLibrePreviewRenderer:
- mode = 3d-preview;
- drawing = false;
- geometryEditing = false;
- featureDragging = false;
- basemapSwitching = false;
- pitchBearing = true;
- contextRequests = true.

App/workspace/context UI must use capabilities rather than checking `instanceof LeafletRenderer`.

## 5. Camera presentation contract

Do not modify persisted MapView.

Add renderer-neutral transient camera presentation:

```ts
export interface CameraPresentation {
  pitchDeg: number;
  bearingDeg: number;
}
```

MapRenderer / RendererHost should expose a bounded way to:
- read camera presentation;
- set camera presentation.

Leaflet returns pitch=0 and bearing=0 and ignores unsupported non-zero presentation values.
MapLibre implements pitch/bearing.

Center/zoom continue through the existing MapView.

Do not store 3D style ID in `mapView.basemapId`.

## 6. Mode state

Create a transient MapModeState owned outside ProjectStore.

Conceptual state:

```ts
interface MapModeSnapshot {
  mode: '2d' | '3d-preview';
  camera3d: {
    pitchDeg: number;
    bearingDeg: number;
  };
  previewExtrusions: Record<FeatureId, number>;
}
```

Rules:
- no serialization;
- no project history;
- no dirty-state impact;
- no Leaflet/MapLibre runtime objects;
- previewExtrusions accepts polygon/rectangle feature IDs only;
- remove transient entries when their feature no longer exists.

## 7. Mode switching lifecycle

Required switch 2D → 3D:

1. close context menu/search preview and cancel marker/text placement;
2. cancel active drawing/geometry transaction cleanly;
3. capture current shared center/zoom and valid selected FeatureId;
4. detach current drawing adapter;
5. `RendererHost.replaceWith(createMapLibreRenderer, project)`;
6. set current shared view;
7. restore transient 3D camera presentation;
8. render project;
9. restore selected FeatureId;
10. install a disabled/no-op drawing adapter or otherwise prevent 2D drawing commands.

Required switch 3D → 2D:

1. capture 3D camera presentation into MapModeState;
2. capture current common center/zoom;
3. close 3D transient context/search;
4. `RendererHost.replaceWith(createLeafletRenderer, project)`;
5. recreate LeafletDrawAdapter and pass it to AppController;
6. restore shared view and selected FeatureId;
7. re-enable 2D drawing capabilities.

At no point may the project be serialized/deserialized merely to change renderer.

## 8. Shared map navigation semantics

Both renderers use the same normal navigation rule:

- user center/zoom movement may update ProjectStore mapView without history, preserving existing saved-baseline semantics;
- renderer-programmatic transient navigation (search preview etc.) must not dirty the project;
- pitch/bearing never enter ProjectStore.

MapLibre callback when persisting common navigation must preserve the existing canonical `mapView.basemapId`.

## 9. MapLibre production style configuration

Production:
- base style: `https://tiles.openfreemap.org/styles/bright`;
- building source: `https://tiles.openfreemap.org/planet`;
- building source-layer: `building`.

Building layer:
- fill-extrusion;
- use `render_height` and `render_min_height`;
- insert below the first label/symbol layer where practical;
- preserve attribution.

No API key or secret may be committed.

Test environment:
- automated browser tests must support deterministic local/minimal style configuration;
- CI must not require live OpenFreeMap/Nominatim network access for pass/fail;
- retain a separately documented real-provider smoke.

## 10. Project → GeoJSON adapter

Implement pure renderer-adapter conversion outside domain/store.

Input:
- ProjectDocumentV2;
- effective group visibility/lock;
- transient selected FeatureId;
- transient preview extrusion heights.

Output:
- GeoJSON FeatureCollections or equivalent plain structures used only by MapLibre.

Every rendered project geometry carries:
- stable `featureId`;
- semantic `featureType`;
- style fields needed for data-driven rendering;
- selected flag;
- effective lock flag if useful for visual cues;
- previewHeightM only from transient mode state.

No generated MapLibre runtime identifier becomes canonical.

## 11. Feature rendering strategy

Recommended strategy:

### DOM-backed MapLibre markers
Use safe DOM MapLibre Marker objects for:
- marker;
- text;
- arrow head where this simplifies reliable Thai/plain-text and bearing rendering.

Rules:
- text uses `textContent`, never `innerHTML`;
- marker/text DOM nodes may carry stable featureId only as renderer-local metadata/dataset;
- right-click/click publishes stable FeatureId;
- no DOM node enters ProjectStore/history.

### GeoJSON/style layers
Use GeoJSON sources/layers for:
- marker radius rings;
- polyline;
- polygon;
- rectangle;
- circle;
- arrow shaft;
- preview extrusion.

This keeps polygon/fill/line rendering data-driven and makes selection/visibility updates cheap enough for C4.1.

## 12. Geometry conversion

### Polygon
Close ring only in renderer-adapter output if MapLibre/GeoJSON requires closure. Do not mutate canonical coordinates.

### Rectangle
Convert bounds to a closed polygon ring in adapter output. Preserve canonical rectangle semantics.

### Circle and marker radius
Generate geodesic approximation polygons from WGS84 center/radius.

Use a deterministic helper:
- finite radius validation;
- 64 segments by default;
- no degree-as-metre shortcut;
- pure unit tests including Bangkok coordinates.

### Arrow
- shaft: LineString;
- arrowhead: renderer-derived endpoint decoration;
- calculate bearing from the last non-degenerate line segment;
- persisted semantic `arrowHead=end` remains unchanged.

## 13. Layer plan

A single project GeoJSON source or a small bounded set of sources is acceptable.

Suggested layer families:
- radius-fill / radius-line;
- polygon-fill;
- polygon-line;
- project-extrusion;
- line;
- selected-line/fill emphasis.

Requirements:
- deterministic IDs internal to MapLibre renderer;
- data-driven style from project properties where supported;
- selection highlight is transient and does not rewrite project style;
- project overlays should remain legible above building context.

## 14. Feature hit testing

MapLibre renderer must support:
- normal click → stable feature selection;
- contextmenu → MapContextRequest.

For style-layer geometry:
- query rendered project overlay layers at pointer;
- choose a deterministic topmost feature;
- publish its stable featureId.

For DOM marker/text:
- stop propagation and publish the same stable ID.

A feature context event must not also fire background context.

## 15. Context/action capability handling

B4 ContextMenuController stays renderer-neutral.

Add a capability-aware action decision so:
- lock policy remains authoritative;
- in 3D Preview, shape `toggle-edit` / geometry editing is disabled with an explicit “Switch to 2D to edit geometry” reason;
- canonical non-geometry property/delete actions remain usable if lock policy permits.

Do not silently call no-op geometry editing.

## 16. Drawing adapter strategy

C4.1 must not implement MapLibre drawing.

When 3D active:
- AppController drawing entry points are capability-disabled;
- if AppController requires a DrawingAdapter instance, use an explicit DisabledDrawingAdapter rather than passing LeafletDrawAdapter bound to a destroyed renderer.

The disabled adapter must:
- not create project mutations;
- expose a clear disabled reason;
- require no MapLibre imports.

## 17. Preview extrusion state

The transient mode state maps FeatureId → height metres.

Renderer adapter:
- only polygon/rectangle;
- finite height > 0;
- default 20 m when enabled;
- create fill-extrusion layer data.

Changing preview height:
- updates MapModeState and renderer only;
- no ProjectStore update;
- no history/dirty;
- no save/open persistence.

## 18. MapLibre lifecycle

MapLibrePreviewRenderer.destroy() must:
- remove map event listeners;
- remove DOM markers/text;
- clear renderer-local maps/sets;
- call MapLibre map.remove();
- release references;
- leave ProjectStore untouched.

Renderer replacement must not accumulate duplicate listeners.

## 19. WebGL failure

Before/while creating 3D:
- detect initialization failure;
- surface a recoverable mode-switch error;
- return to or preserve 2D;
- never clear the map container in a way that destroys the canonical project.

## 20. Architecture tests

Required tests:
- domain/store/persistence contain no `maplibre-gl` imports;
- MapRenderer interface exposes only renderer-neutral types;
- mode state contains stable IDs/plain numbers only;
- project → GeoJSON conversion uses [longitude, latitude];
- circle/radius conversion is geodesically sensible and deterministic;
- renderer replacement 2D→3D→2D preserves project snapshot + selection;
- mode/camera/extrusion changes do not dirty/history;
- normal 3D center/zoom persistence preserves 2D basemapId;
- context listeners rebind once;
- production globals remain gated behind `?test=1`.

## 21. Source / licensing notes

Technical references reviewed for this contract:
- MapLibre GL JS docs/API/examples: https://maplibre.org/maplibre-gl-js/docs/
- 3D buildings example: https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/
- OpenFreeMap quick start: https://openfreemap.org/quick_start/
- reference visual direction: https://github.com/naiiytom/tha-metro-mini-3d

MapLibre GL JS is BSD-3-Clause.

The reference `tha-metro-mini-3d` repository is MIT licensed. C4.1 should use it as a design/architecture reference, not copy implementation code. If non-trivial source is copied/adapted, preserve the required MIT notice.

OpenStreetMap/OpenFreeMap attribution must remain visible according to source/provider terms.
