# Map Tools v2 — Product Specification

Status: draft for implementation planning  
Date: 2026-08-25

## 1. Product definition

Map Tools v2 is a lightweight engineering map annotation and study-map workspace. It is intended for traffic engineers, transport planners, infrastructure consultants, urban planners, and related technical users who need to prepare clear geospatial study diagrams and report-ready maps quickly without opening a full desktop GIS workflow.

The product is deliberately positioned between a basic web map and a full GIS/CAD application.

### Primary job to be done

> Create, annotate, measure, save, revise, and export an engineering study map in minutes, while preserving enough structure that the project can be reopened and edited reliably later.

## 2. Target workflows

### W-01 — Traffic study map

1. Search or navigate to the project site.
2. Add project boundary or study area.
3. Place survey locations and access/intersection points.
4. Add arrows, labels, buffers, and measurements.
5. Organize objects by group/layer.
6. Save the project.
7. Export a report-ready image or PDF.

### W-02 — Site access / circulation concept

1. Load a basemap or satellite view.
2. Overlay a project/site-plan image when available.
3. Draw existing/proposed access points and circulation arrows.
4. Annotate constraints and alternatives.
5. Compare visibility between alternatives using groups/layers.
6. Export one or more presentation/report maps.

### W-03 — Survey planning

1. Add TMC, mid-block, pedestrian, parking, camera, or other survey locations.
2. Label each station.
3. Add study buffers and directional notes.
4. Export a field reference map.
5. Reopen the project later to revise station positions.

## 3. Product principles

### P-01 — Fast before powerful

Common engineering map tasks should require fewer interactions than doing the same work in a desktop GIS.

### P-02 — Structured, not disposable

Every saved object must have an explicit type and stable ID. A saved project must reopen without silently losing semantics, style, labels, or geometry.

### P-03 — Map first, controls second

The map remains the dominant workspace. Toolbars and inspectors should be compact and should not obscure the area being edited.

### P-04 — Object-level operations must scale

The app must remain usable when a project contains dozens or hundreds of annotations. Users should not need to hunt for every object directly on the map.

### P-05 — Engineering output must be presentable

The product should generate maps that can be inserted into technical reports and presentations with minimal post-processing.

### P-06 — Interoperable but not a GIS replacement

Support common exchange formats and coordinate workflows, while avoiding a scope expansion into advanced geoprocessing.

## 4. Core workspace

Recommended desktop layout:

```text
+--------------------------------------------------------------+
| Project | Search                         Save | Export | Help |
+---------+--------------------------------------+---------------+
| Draw    |                                      | Objects       |
| tools   |                 MAP                  | / Layers      |
|         |                                      |---------------|
|         |                                      | Inspector     |
|         |                                      |               |
+---------+--------------------------------------+---------------+
| Lat/Lon | Zoom | Scale | Selection metrics | CRS / Units      |
+--------------------------------------------------------------+
```

### Required workspace areas

- top application bar;
- compact draw/annotation toolbar;
- main map canvas;
- object/layer panel;
- property inspector;
- status bar for coordinates, scale, and selection metrics.

The exact visual design can evolve, but these functions should be separated conceptually.

## 5. Feature requirements

### 5.1 Project management

Must:

- create a new project;
- open a project;
- save/download a project;
- preserve project version and metadata;
- preserve active map view;
- warn before destructive reset when unsaved changes exist;
- reject invalid project files without destroying the current project.

Should:

- show project name;
- show dirty/saved state;
- support autosave to browser storage as crash recovery, without replacing explicit project-file save.

### 5.2 Basemaps

Must retain current useful basemap choices.

Must:

- allow changing basemap independently from project objects;
- persist selected basemap identifier when possible;
- degrade gracefully if a basemap provider is temporarily unavailable;
- keep provider attribution visible/exportable where required.

### 5.3 Search and coordinates

Must:

- search place/address text;
- show multiple search results rather than automatically accepting only the first result;
- keep search results transient until explicitly added to the project;
- accept decimal latitude/longitude input;
- support copy coordinates from map/context menu.

Should later support:

- DMS parsing;
- UTM zones commonly used in Thailand (47N/48N) via an explicit coordinate conversion tool.

### 5.4 Feature types

The v2 project model must explicitly support:

- marker;
- text;
- polyline;
- polygon;
- rectangle;
- circle;
- arrow.

All feature types must support:

- stable ID;
- name/label where applicable;
- visibility;
- lock state;
- group/layer association;
- style;
- selection;
- deletion;
- save/open round trip.

### 5.5 Marker and symbol tools

Must retain:

- draggable marker;
- configurable color;
- label;
- multiple radius rings.

Engineering-symbol presets should be introduced after the core is stable. Initial domain symbol set:

- project site;
- intersection;
- access/egress;
- U-turn;
- traffic signal;
- TMC survey;
- mid-block survey;
- pedestrian survey;
- parking survey;
- camera/CCTV;
- bus stop;
- taxi/loading;
- accident/conflict point.

### 5.6 Drawing and annotation

Must retain:

- polyline;
- polygon;
- rectangle;
- circle;
- arrow;
- text.

Must add:

- explicit selection state;
- duplicate;
- lock/unlock;
- hide/show;
- keyboard delete when focus is not inside a form control;
- escape to cancel active drawing/editing.

### 5.7 Object/layer management

Must provide a panel that can:

- list project objects;
- select an object and zoom to it;
- rename;
- hide/show;
- lock/unlock;
- duplicate;
- delete;
- assign to a group/layer.

Should provide:

- reorder groups/layers;
- collapse/expand groups;
- bulk visibility and locking;
- filter/search by object name/type.

### 5.8 Undo/redo

Must cover user-editing commands including:

- add;
- delete;
- geometry move/edit;
- style change;
- text/name change;
- radius change;
- duplicate;
- group/layer reassignment.

Project open/new operations do not need to be part of the normal command history.

### 5.9 Measurement

Must retain distance and area behavior.

Should support:

- total polyline length;
- polygon area and perimeter;
- circle radius/diameter/area;
- segment length;
- bearing/azimuth;
- metric area units;
- Thai `ไร่–งาน–ตร.วา` display.

Measurement values should be derived from geometry, not stored as manually editable values.

### 5.10 Buffer tools

After core stability, support:

- marker buffers;
- line buffers;
- polygon buffers;
- multiple buffer distances;
- named/preset study radii.

Common presets may include 100 m, 250 m, 500 m, 1 km, 3 km, and 5 km, while retaining free numeric input.

### 5.11 Style presets

Provide reusable semantic presets such as:

- Existing;
- Proposed;
- Alternative A;
- Alternative B;
- Survey;
- Constraint;
- Impact;
- Mitigation.

Presets must remain editable after application.

### 5.12 Export

Keep a quick viewport PNG function.

A report export mode should later support:

- A4;
- A3;
- 16:9;
- custom size;
- portrait/landscape;
- title;
- legend;
- north arrow;
- scale bar;
- attribution/source note;
- date;
- high-resolution PNG;
- PDF.

Export should not depend on capturing visible application controls.

### 5.13 Interoperability

First-wave import/export:

- project JSON;
- GeoJSON;
- CSV point coordinates.

Second-wave:

- KML/KMZ;
- GPX;
- georeferenced/image overlay workflow.

Shapefile and DXF are not required for the initial v2 release.

## 6. Non-functional requirements

### Reliability

- deterministic save/open round trip;
- no silent data loss;
- failed imports leave current project unchanged;
- stable feature IDs within a project;
- explicit schema migrations.

### Security

- user labels are treated as text by default;
- no unsanitized HTML injection from project files;
- project-file data is schema-validated;
- external requests fail safely.

### Performance

Initial target: normal interaction should remain responsive for a project with at least 500 simple objects on a modern desktop browser. This is an engineering target to validate, not a guarantee of GIS-scale performance.

### Accessibility

At minimum:

- keyboard-reachable primary controls;
- visible focus states;
- labels/tooltips that do not rely only on icons;
- sufficient contrast for controls;
- destructive actions require clear distinction;
- active tool/selection state is not conveyed by color alone.

### Internationalization

Architecture should not hard-code Thai text throughout application logic. Thai remains the primary UI language initially; English support should be possible through a translation dictionary rather than code duplication.

## 7. Release boundaries

### v2 Core

- characterization tests;
- versioned project schema;
- safe persistence;
- Vite + TypeScript modularization;
- object/layer manager;
- undo/redo;
- search isolation;
- secure text handling;
- CI.

### v2 Engineering Toolkit

- engineering symbol library;
- enhanced measurements;
- buffers;
- semantic style presets;
- coordinate utilities.

### v2 Report Output

- report composer;
- legend/north arrow/scale/source;
- high-resolution PNG/PDF.

### Later

- GeoJSON/CSV/KML integration expansion;
- image overlay/georeferencing;
- advanced templates.

## 8. Explicit non-goals

The v2 plan does not attempt to provide:

- user accounts;
- cloud databases;
- live multi-user collaboration;
- routing/navigation engine;
- traffic assignment/modelling;
- full desktop GIS analysis;
- CAD drafting;
- 3D streetscape design.

## 9. Product success criteria

A v2 core release is successful when a user can create a mixed-feature engineering map, save it, reopen it, continue editing without semantic or visual loss, manage objects efficiently from a panel, undo mistakes, and pass the automated and browser acceptance suite.
