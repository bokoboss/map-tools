# Map Tools v2 — Traffic/Transport Engineering Toolkit Specification

Status: product/implementation specification
Date: 2026-08-25

## 1. Purpose

The engineering toolkit differentiates Map Tools from generic annotation software. It should make common traffic, transport, infrastructure, site-access, and survey-planning maps fast to produce without turning the app into a full GIS or CAD package.

## 2. Semantic symbols

Initial required symbol IDs:

- `project-site`
- `intersection`
- `access-entry`
- `access-exit`
- `access-entry-exit`
- `uturn`
- `traffic-signal`
- `tmc-survey`
- `midblock-survey`
- `pedestrian-survey`
- `parking-survey`
- `camera-cctv`
- `bus-stop`
- `taxi-loading`
- `accident-conflict`

Symbols must be semantic `symbolId` values persisted in feature style/properties. The renderer owns actual SVG/icon implementation.

Do not encode meaning only through arbitrary color.

## 3. Style presets

Initial preset IDs:

- `existing`
- `proposed`
- `alternative-a`
- `alternative-b`
- `survey`
- `constraint`
- `impact`
- `mitigation`

A preset is a convenience operation that applies typed styles. Once applied, the resulting explicit style values are persisted; projects must not break if preset definitions change later.

## 4. Measurement tools

### Polyline

Display:

- each segment length on demand;
- total length;
- optional start→end bearing.

### Polygon/rectangle

Display:

- area in m²;
- hectares where useful;
- Thai land units (`ไร่–งาน–ตร.วา`);
- perimeter.

### Circle

Display:

- radius;
- diameter;
- area.

### Units

Distance:

- m below 1,000 m by default;
- km at/above 1,000 m, while preserving sufficient precision.

Area:

- m²;
- ha;
- Thai land units.

Formatting must be centralized/testable, not duplicated in popup templates.

## 5. Bearing/azimuth

Use true/geodesic bearing appropriate to WGS84 coordinates rather than screen pixel angle.

Output convention:

- degrees from north;
- normalized `[0, 360)`;
- label as bearing/azimuth clearly.

Screen-space arrow rotation may still use renderer-specific math for icon orientation, but engineering bearing values must not be derived from pixel coordinates.

## 6. Buffers

Support at least:

- point buffer;
- polyline buffer;
- polygon buffer where technically robust.

Common presets:

- 100 m;
- 250 m;
- 500 m;
- 1 km;
- 3 km;
- 5 km.

Also allow numeric custom distance in metres/kilometres.

Buffers should be explicit project features or deterministic derived features with clearly documented ownership. Preferred v2 behavior: create normal editable polygon features with metadata describing source feature and buffer distance where practical.

Do not use simple degree offsets as metre buffers.

## 7. Coordinate utilities

### Direct decimal input

Accept explicit decimal longitude/latitude input and navigate/add marker.

### Copy

Allow copying selected point coordinate in a clearly labeled order, e.g.:

`13.756300, 100.501800` for UI display if labeled Lat, Lon.

Internally/persisted domain remains `[longitude, latitude]`.

### DMS

Support parsing/formatting DMS if implemented with deterministic tests.

### UTM

Thailand-focused conversion may support UTM zones 47N and 48N, but only with an explicit CRS/zone label. Never guess a projected coordinate pair as lat/lon.

## 8. Survey-point workflow

A typical survey planning workflow should be possible as:

1. search/navigate to site;
2. add semantic survey marker;
3. choose `TMC`, `Mid-block`, `Pedestrian`, or `Parking` symbol;
4. name it (e.g. `TMC-01 Dolphin Circle`);
5. optionally add study radius/buffer;
6. group under `Survey Points`;
7. export map with automatic legend.

## 9. Access/traffic-flow workflow

A typical site-access diagram should support:

- project boundary;
- entry/exit symbols;
- semantic arrows for inbound/outbound flow;
- proposed/existing style presets;
- labels;
- measurement/bearing where needed;
- legend generation.

## 10. Legend semantics

Engineering symbols and style presets should expose human-readable labels to the report composer.

Legend entries should derive from semantic symbol/style metadata, not from inspecting raw SVG or CSS.

## 11. Thai defaults

Thai-oriented behavior that should remain or be supported:

- Sarabun-compatible typography;
- metric units;
- `ไร่–งาน–ตร.วา` conversion;
- left-hand-traffic-specific symbols only where semantics genuinely require it;
- Thai/English labels should both render safely.

Do not hard-code all product UI to Thai if bilingual support is later introduced; domain data must remain language-neutral where possible.

## 12. Test vectors

Required deterministic engineering calculations:

- asymmetric two-point bearing case;
- known 1 km-scale line distance case;
- 1,600 m² = 1 rai;
- 400 m² = 1 ngan;
- 4 m² = 1 square wah;
- circle area from known radius;
- polygon perimeter from a simple geometry;
- buffer output sanity checks including no degree-as-metre shortcut.

## 13. Non-goals

- traffic assignment;
- junction capacity analysis;
- signal timing optimization;
- route choice modeling;
- network topology editing;
- CAD-grade design geometry;
- full GIS geoprocessing.
