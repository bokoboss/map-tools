# Map Tools — Project Schema v2

Status: normative draft for implementation  
Date: 2026-08-25

## 1. Goals

Project Schema v2 must make save/open behavior explicit, versioned, testable, and independent of Leaflet runtime objects.

The schema must preserve:

- project metadata;
- map view;
- groups/layers;
- feature identity and type;
- geometry;
- semantic properties;
- style;
- visibility and lock state;
- marker radius rings;
- text content/rotation;
- arrow semantics.

## 2. Coordinate convention

All persisted coordinate arrays use WGS84 longitude/latitude order:

`[longitude, latitude]`

This deliberately follows GeoJSON coordinate order rather than Leaflet's runtime `[lat, lng]` convention.

Requirements:

- the Leaflet adapter is responsible for converting persisted/domain `[lon, lat]` into Leaflet `LatLng` values;
- GeoJSON import/export must not silently swap coordinate order;
- validation must enforce longitude in `[-180, 180]` and latitude in `[-90, 90]`;
- tests must use asymmetric coordinates so an accidental swap is detectable.

## 3. Envelope

Conceptual structure:

```json
{
  "schemaVersion": 2,
  "app": {
    "name": "map-tools",
    "version": "2.x"
  },
  "project": {
    "id": "uuid",
    "name": "Project name",
    "createdAt": "2026-08-25T00:00:00.000Z",
    "updatedAt": "2026-08-25T00:00:00.000Z"
  },
  "mapView": {
    "center": [100.5018, 13.7563],
    "zoom": 13,
    "basemapId": "osm-standard"
  },
  "groups": [],
  "features": []
}
```

Timestamps should be ISO-8601 strings.

## 4. Stable IDs

All projects, groups, features, and independently editable radius rings must use stable generated IDs.

Requirements:

- IDs must not depend on Leaflet `stamp()` values;
- IDs must survive save/open;
- duplicate creates new IDs;
- migration from v1 generates IDs once during import/migration.

UUIDs are preferred, but any collision-resistant application-generated string format is acceptable if tested.

## 5. Groups

```json
{
  "id": "group-survey",
  "name": "Survey Points",
  "visible": true,
  "locked": false,
  "order": 20
}
```

A feature may use `groupId: null` for ungrouped content.

Visibility rule:

`effectiveVisible = group.visible && feature.visible`

Lock rule:

`effectiveLocked = group.locked || feature.locked`

## 6. Common feature fields

Every feature must contain:

```json
{
  "id": "feature-id",
  "type": "marker",
  "name": "TMC-01",
  "groupId": "group-survey",
  "visible": true,
  "locked": false,
  "geometry": {},
  "style": {},
  "properties": {}
}
```

`type` is a discriminator and determines the valid geometry/properties structure.

Initial supported types:

- `marker`;
- `text`;
- `polyline`;
- `polygon`;
- `rectangle`;
- `circle`;
- `arrow`.

## 7. Marker

```json
{
  "id": "m1",
  "type": "marker",
  "name": "TMC-01",
  "groupId": "survey",
  "visible": true,
  "locked": false,
  "geometry": {
    "kind": "point",
    "coordinates": [100.5018, 13.7563]
  },
  "style": {
    "color": "#2563eb",
    "symbolId": "pin"
  },
  "properties": {
    "radii": [
      {
        "id": "r1",
        "distanceM": 500,
        "color": "#3388ff",
        "fillOpacity": 0.2
      }
    ]
  }
}
```

## 8. Text

```json
{
  "id": "t1",
  "type": "text",
  "name": "Main Access",
  "groupId": "annotations",
  "visible": true,
  "locked": false,
  "geometry": {
    "kind": "point",
    "coordinates": [100.5018, 13.7563]
  },
  "style": {
    "color": "#1f2937",
    "fontSizePx": 14,
    "fontWeight": 600,
    "rotationDeg": 25,
    "halo": true
  },
  "properties": {
    "text": "Main Access"
  }
}
```

Text is plain text. Project files must not use text values as executable HTML.

## 9. Polyline

```json
{
  "id": "l1",
  "type": "polyline",
  "name": "Study Route",
  "groupId": null,
  "visible": true,
  "locked": false,
  "geometry": {
    "kind": "lineString",
    "coordinates": [
      [100.5000, 13.7500],
      [100.5020, 13.7510]
    ]
  },
  "style": {
    "color": "#3388ff",
    "weightPx": 4,
    "opacity": 1,
    "dashArray": null
  },
  "properties": {}
}
```

## 10. Polygon

```json
{
  "id": "p1",
  "type": "polygon",
  "name": "Project Boundary",
  "groupId": "site",
  "visible": true,
  "locked": false,
  "geometry": {
    "kind": "polygon",
    "coordinates": [
      [100.5000, 13.7500],
      [100.5000, 13.7510],
      [100.5020, 13.7510]
    ]
  },
  "style": {
    "color": "#f06eaa",
    "weightPx": 4,
    "opacity": 1,
    "fillColor": "#f06eaa",
    "fillOpacity": 0.2
  },
  "properties": {}
}
```

The application may normalize polygon closure internally; the persisted rule must be consistent and covered by tests.

## 11. Rectangle

Rectangle semantics should be preserved explicitly rather than collapsing permanently into a generic polygon.

```json
{
  "id": "rect1",
  "type": "rectangle",
  "geometry": {
    "kind": "bounds",
    "southWest": [100.5000, 13.7500],
    "northEast": [100.5030, 13.7520]
  },
  "style": {
    "color": "#8b5cf6",
    "weightPx": 4,
    "fillColor": "#8b5cf6",
    "fillOpacity": 0.2
  },
  "properties": {}
}
```

## 12. Circle

```json
{
  "id": "c1",
  "type": "circle",
  "geometry": {
    "kind": "circle",
    "center": [100.5018, 13.7563],
    "radiusM": 250
  },
  "style": {
    "color": "#f59e0b",
    "weightPx": 4,
    "fillColor": "#f59e0b",
    "fillOpacity": 0.2
  },
  "properties": {}
}
```

## 13. Arrow

An arrow is a semantic line with arrow rendering. It is not persisted as a Leaflet feature group or separate arrow-head marker.

```json
{
  "id": "a1",
  "type": "arrow",
  "name": "Traffic Flow",
  "geometry": {
    "kind": "lineString",
    "coordinates": [
      [100.5000, 13.7500],
      [100.5020, 13.7510]
    ]
  },
  "style": {
    "color": "#10b981",
    "weightPx": 3,
    "arrowHead": "end"
  },
  "properties": {}
}
```

Renderer code derives arrow-head position and rotation from the final line segment.

## 14. Style validation

At minimum validate:

- CSS colors to an accepted format, preferably normalized hex;
- finite positive stroke weights within sensible UI limits;
- opacity in `[0, 1]`;
- rotation as finite number normalized to a documented range;
- radius values as finite non-negative numbers.

Do not accept arbitrary CSS strings where a narrower typed field is possible.

## 15. Map view

```json
{
  "center": [100.5018, 13.7563],
  "zoom": 13,
  "basemapId": "osm-standard"
}
```

If a saved basemap ID is unavailable in a future version:

1. load project features normally;
2. fall back to the default basemap;
3. show a non-blocking message;
4. do not fail the whole project load.

## 16. Migration from current v1 JSON

The migration/importer should recognize the existing shape:

```json
{
  "markers": [],
  "drawnShapes": {}
}
```

Migration goals:

- generate a new project ID;
- generate stable IDs for all recovered features;
- convert Leaflet-style marker latitude/longitude objects into schema `[lon, lat]` order;
- convert markers and radius rings;
- recover generic GeoJSON shapes and known style/radius data;
- preserve as much recoverable data as possible;
- explicitly report content that cannot be reconstructed with certainty.

Important: current v1 text/arrow semantics may not be fully recoverable from saved files because they were not represented as a normative persisted type. Migration must never invent semantics silently.

## 17. Validation behavior

Validation must occur before replacing the active project.

Reject files when:

- JSON syntax is invalid;
- schema version is unsupported and no migration exists;
- required IDs/types/geometries are missing;
- coordinate or numeric values are non-finite or outside documented ranges;
- array/object structures exceed implementation safety limits;
- the structure is incompatible with the declared feature type.

Warnings, rather than hard errors, are appropriate for recoverable conditions such as unknown basemap IDs or optional future fields.

## 18. Forward compatibility

Readers may ignore unknown optional fields only when doing so cannot change feature semantics.

Unknown `type` values must not be converted into a known type automatically.

Future schema changes that alter meaning require a new schema version and migration.

## 19. Round-trip acceptance matrix

For every supported feature type:

1. create feature with non-default style/properties;
2. save project;
3. deserialize into a fresh project;
4. compare normalized domain documents;
5. render the reopened project;
6. edit it successfully;
7. save/reopen again.

The normalized first and second project documents must be semantically equal except for intentionally updated timestamps or explicitly documented normalization.

Coordinate round-trip fixtures must use values such as Bangkok `[100.5018, 13.7563]`, where longitude is outside the valid latitude range, so an accidental `[lat, lon]` swap fails validation/tests immediately.
