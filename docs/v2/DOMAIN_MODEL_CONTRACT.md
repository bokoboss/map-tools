# Map Tools v2 — Domain Model Contract

Status: implementation contract
Date: 2026-08-25

## 1. Purpose

This document narrows implementation freedom around the Project Schema v2 domain model so Codex does not need to invent data semantics during refactoring.

The persisted/project model is canonical. Leaflet runtime objects are adapters/renderers only.

## 2. Required top-level domain types

The implementation should expose strongly typed equivalents of:

```ts
type ProjectId = string
type GroupId = string
type FeatureId = string
type RadiusId = string

type Coordinate = readonly [longitude: number, latitude: number]

interface ProjectDocumentV2 {
  schemaVersion: 2
  app: AppMetadata
  project: ProjectMetadata
  mapView: MapViewState
  groups: ProjectGroup[]
  features: ProjectFeature[]
}
```

Do not store `L.LatLng`, `L.Layer`, `L.Marker`, Leaflet stamp IDs, DOM nodes, event objects, or drawing-handler instances in these domain types.

## 3. Feature discriminator union

Use a discriminated union so invalid feature/property combinations are unrepresentable where practical.

```ts
type ProjectFeature =
  | MarkerFeature
  | TextFeature
  | PolylineFeature
  | PolygonFeature
  | RectangleFeature
  | CircleFeature
  | ArrowFeature
```

Every feature has:

- stable `id`;
- semantic `type`;
- user-visible `name`;
- nullable `groupId`;
- `visible`;
- `locked`;
- typed geometry;
- typed style;
- typed properties.

## 4. Geometry contracts

### Point

```ts
interface PointGeometry {
  kind: 'point'
  coordinates: Coordinate
}
```

### LineString

```ts
interface LineStringGeometry {
  kind: 'lineString'
  coordinates: Coordinate[]
}
```

Minimum two points after validation.

### Polygon

```ts
interface PolygonGeometry {
  kind: 'polygon'
  coordinates: Coordinate[]
}
```

The persisted representation uses one exterior ring in v2 Core. Interior holes are out of scope unless separately approved.

Choose one persisted closure rule and normalize consistently. Preferred: persist without repeating the first coordinate as the last; adapters may close it for formats/renderers that require closure.

### Rectangle

```ts
interface BoundsGeometry {
  kind: 'bounds'
  southWest: Coordinate
  northEast: Coordinate
}
```

Validate longitude/latitude ordering and normalize min/max if necessary before canonical serialization.

### Circle

```ts
interface CircleGeometry {
  kind: 'circle'
  center: Coordinate
  radiusM: number
}
```

`radiusM` must be finite and non-negative.

## 5. Semantic feature contracts

### Marker

Required properties:

```ts
interface MarkerProperties {
  radii: RadiusRing[]
}
```

Radius rings are independently identified and ordered.

```ts
interface RadiusRing {
  id: RadiusId
  distanceM: number
  color: HexColor
  fillOpacity: number
}
```

### Text

`properties.text` is plain text only.

Rotation is presentation state and should live in typed style, e.g. `rotationDeg`.

### Arrow

An arrow is one semantic feature with line geometry and arrow presentation. Never persist an arrowhead marker as a second project feature.

### Rectangle / Circle

Preserve semantic feature type after edit/save/open. Do not permanently collapse them into polygon/point representations.

## 6. Style primitives

Prefer narrow typed values:

```ts
type HexColor = `#${string}`
type Opacity = number
```

Validation must reject or normalize values outside the documented contract.

Common style fields may include:

- `color`;
- `fillColor`;
- `opacity`;
- `fillOpacity`;
- `weightPx`;
- `dashArray`;
- `rotationDeg`;
- `fontSizePx`;
- `fontWeight`;
- `halo`;
- `symbolId`;
- `arrowHead`.

Do not preserve arbitrary executable CSS/HTML strings in the project model.

## 7. Store invariants

The project store must maintain:

- unique project/group/feature/radius IDs;
- feature `groupId` is null or references an existing group;
- no duplicate feature IDs;
- no duplicate radius IDs within a feature;
- finite numeric coordinates;
- latitude within `[-90, 90]`;
- longitude within `[-180, 180]`;
- validated feature geometry for its discriminator type.

## 8. Effective group state

Do not mutate child feature flags when toggling a group.

```ts
effectiveVisible = groupVisible && feature.visible
effectiveLocked = groupLocked || feature.locked
```

This preserves the child feature's own state when the parent group is toggled back.

## 9. Selection is not persisted project content

Selection, hover, active drawing handler, open modal, transient search result, and temporary preview geometry belong to UI/runtime state, not `ProjectDocumentV2`.

## 10. Dirty-state rule

Project dirty state changes only for persisted project mutations, e.g.:

- feature create/delete/edit/move;
- style/property change;
- group mutation;
- map view/basemap change if map view is persisted;
- project metadata edit.

Pure UI actions such as selection, opening a modal, hovering, or viewing search results must not mark the project dirty.

## 11. Command mutation interface

Macro Phase B undo/redo should operate on domain mutations, not Leaflet events.

Recommended conceptual interface:

```ts
interface Command {
  label: string
  execute(store: ProjectStore): void
  undo(store: ProjectStore): void
}
```

Exact implementation may differ, but command history must be based on deterministic domain before/after state.

## 12. Leaflet adapter boundary

All coordinate conversion belongs here:

```ts
function toLeafletLatLng([lon, lat]: Coordinate): L.LatLngExpression
function fromLeafletLatLng(latlng: L.LatLng): Coordinate
```

No other module should silently reverse coordinate order.

## 13. Serialization boundary

Serializer responsibilities:

- accept only valid canonical domain state;
- emit deterministic normalized JSON;
- not inspect Leaflet layers.

Deserializer responsibilities:

- parse JSON into unknown input;
- validate/migrate into a complete candidate domain document;
- return structured success/warnings/errors;
- never mutate active store during parse/validation.

## 14. Required tests

At minimum:

- each discriminator constructs valid domain object;
- invalid coordinate ranges rejected;
- asymmetric coordinate values prove lon/lat order;
- group effective state does not overwrite child state;
- duplicate IDs rejected;
- semantic rectangle/circle/arrow/text types survive normalization;
- transient UI state never appears in serialized project JSON;
- domain model can be tested with no Leaflet import.
