# C4.1 — Feature Rendering Matrix

Status: acceptance matrix  
Date: 2026-08-27

This matrix defines how every Project Schema v2 feature must appear in MapLibre 3D Preview.

## Common rules

All feature rendering:
- consumes canonical WGS84 [longitude, latitude];
- uses stable FeatureId;
- respects effective visibility;
- never persists renderer objects;
- never rewrites canonical style for selection/highlight;
- keeps safe user text literal;
- remains identifiable after 2D ↔ 3D switching.

| Domain type | 3D Preview representation | Style mapping | Selection/context | Geometry edit in 3D | Acceptance |
|---|---|---|---|---|---|
| marker | MapLibre DOM Marker or equivalent point overlay | feature.style.color / symbolId fallback | click/right-click stable FeatureId | No | Visible at exact coordinate; selection sync; context works |
| marker radius | geodesic GeoJSON polygon fill + outline | radius color/fillOpacity | selecting ring resolves to parent marker FeatureId | No | Distance/ring semantics visually preserved |
| text | safe DOM Marker text overlay | color/font size/weight/rotation/halo where practical | stable parent FeatureId | No move; property edit allowed | Thai + English literal text visible; no HTML execution |
| polyline | GeoJSON line layer | color/weight/opacity/dash | hit-test stable FeatureId | No | Line shape and style recognizable |
| polygon | GeoJSON fill + line; optional transient fill-extrusion | fill/stroke/opacity | hit-test stable FeatureId | No | Flat by default; preview extrusion when enabled |
| rectangle | bounds converted to renderer-only polygon + line; optional extrusion | fill/stroke/opacity | stable rectangle FeatureId | No | Canonical rectangle remains rectangle after switch/save |
| circle | geodesic renderer-only polygon + line | fill/stroke/opacity | stable circle FeatureId | No | Center/radius visually consistent |
| arrow | line shaft + renderer-derived endpoint arrowhead | color/weight/arrowHead=end | either shaft/head resolves to same FeatureId | No | Direction identifiable and endpoint bearing correct |

## Marker details

- Default pin must remain legible against vector basemap.
- Unknown symbolId uses a deterministic generic pin, never fails rendering.
- DOM marker click/context events stop propagation to avoid duplicate background events.
- Locked marker stays selectable but is not draggable in 3D.

## Radius rings

- Approximate geodesic circle using 64 segments by default.
- Rendering adapter may reduce segments only with explicit performance evidence.
- Radius interaction maps to the parent marker FeatureId.
- Preview must not create a separate canonical feature for a radius.

## Text

C4.1 prioritizes correctness of Thai/user text over vector-label sophistication.

Preferred first implementation:
- DOM-backed MapLibre Marker;
- node.textContent = feature.properties.text;
- browser/system font stack;
- optional CSS halo;
- rotation from style.rotationDeg.

Do not insert user text into innerHTML or SVG markup strings.

## Line / polygon style mapping

Suggested plain property keys in renderer GeoJSON:
- featureId;
- featureType;
- color;
- fillColor;
- weightPx;
- opacity;
- fillOpacity;
- dashArray;
- selected;
- effectiveLocked;
- previewHeightM.

Layer paint expressions may read these values.

## Polygon / rectangle preview extrusion

- flat fill stays available at height=0;
- transient previewHeightM > 0 activates fill-extrusion;
- preview extrusion should retain project color with a controlled opacity;
- selected extrusion receives a non-destructive highlight;
- extrusion does not alter domain properties.

## Circle conversion

Renderer-only helper inputs:
- center WGS84;
- radius metres;
- segments.

Required tests:
- radius 0 handled deterministically;
- finite positive radius;
- asymmetric Bangkok coordinate;
- generated first/last ring point closes correctly in GeoJSON output;
- canonical circle object remains unchanged.

## Arrow head

For the last non-degenerate segment:
- derive geographic bearing;
- arrowhead points toward final coordinate;
- changing camera bearing must not invert project direction;
- shaft and head share stable FeatureId.

If DOM/CSS arrowhead is used, its geographic rotation must be recomputed/represented correctly as map bearing changes.

## Selection visual

Selection must be visible in both renderers without changing persisted style.

Acceptable patterns:
- overlay highlight layer filtered by featureId;
- renderer-local selected property in regenerated GeoJSON;
- DOM class on marker/text.

Do not write highlight color/weight back into ProjectStore.

## Z-order

Recommended order:
1. vector basemap;
2. 3D building context;
3. flat project fill/radius overlays;
4. project preview extrusion;
5. project line overlays;
6. DOM markers/text/arrowheads;
7. selection emphasis.

Project annotations must remain legible against buildings.

## Visibility and group semantics

MapLibre adapter uses effectiveVisible:
- group.visible && feature.visible.

Group visibility must not mutate child feature.visible.

Lock only affects allowed actions and optional visual affordance; it does not automatically hide a feature.

## Capability behavior

In 3D Preview:
- shape “Edit geometry” is disabled or redirects explicitly to 2D;
- marker/text dragging unavailable;
- property/style/radius/delete operations may remain available through canonical UI if allowed by lock policy;
- no renderer-specific mutation bypass.

## Automated matrix gate

The mixed fixture must render all seven semantic feature types plus marker radii.

Automated test evidence should assert:
- renderer-local presence/identifiability by stable ID;
- expected layer/DOM representation;
- no console/page error;
- selection works from map and workspace;
- save/reopen after canonical property edit preserves semantics.

Pixel-perfect equivalence with Leaflet is not required. Semantic equivalence and usable visual identification are required.
