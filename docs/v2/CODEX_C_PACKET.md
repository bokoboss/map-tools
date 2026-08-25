# Codex Execution Packet — Macro Phase C Engineering Delivery Toolkit

Status: bounded implementation framework
Date: 2026-08-25

## Preconditions

Macro Phase A and Macro Phase B must be qualified unless a specific C work package is intentionally pulled forward for an immediate project need and does not violate core stop conditions.

Authoritative references:

- `MASTER_EXECUTION_PLAN.md`
- `ENGINEERING_TOOLKIT_SPEC.md`
- `REPORT_EXPORT_SPEC.md`
- `WORKSPACE_UX_SPEC.md`
- `DOMAIN_MODEL_CONTRACT.md`
- `PROJECT_SCHEMA_V2.md`
- `TEST_AND_UAT_PLAN.md`
- `DECISIONS.md`

## Objective

Deliver engineering-specific value without turning Map Tools into a full GIS/CAD system.

Macro Phase C contains three independently prioritizable work packages. Do not implement all three in one PR.

## C1 — Traffic/transport engineering toolkit

Implement according to `ENGINEERING_TOOLKIT_SPEC.md`.

Required minimum:

- semantic symbol IDs and renderer icons;
- style presets;
- measurement centralization;
- perimeter/radius/diameter/area;
- geodesic bearing/azimuth;
- buffer workflow with metre-based geospatial calculations;
- coordinate input/copy utilities;
- Project Schema round-trip for new semantic properties;
- legend metadata exposed for C2.

Qualification must include deterministic engineering calculation tests and a survey-planning UAT map.

## C2 — Report-quality export

Implement according to `REPORT_EXPORT_SPEC.md`.

Required minimum:

- separate report composer path from editor screenshot;
- A4/A3/16:9/custom sizing;
- portrait/landscape;
- title;
- legend;
- north arrow;
- valid scale bar;
- attribution/source;
- date;
- high-resolution PNG;
- PDF;
- export readiness/error handling;
- no editor chrome in final output.

Qualification must include visual cases listed in the report-export specification.

## C3 — Interoperability + site-plan overlay

Required first wave:

- GeoJSON import/export using `[longitude, latitude]` without hidden coordinate reversal;
- CSV point import/export with explicit column mapping;
- safe text/property import;
- validate-before-replace/merge behavior.

Required second wave only after first wave qualifies:

- KML/KMZ where practical;
- GPX where useful;
- image overlay;
- opacity/visibility/lock;
- scale/rotation/position controls;
- controlled georeferencing workflow.

Every schema extension must be versioned/migrated/tested.

## Common implementation rules

- use semantic domain state, not renderer artifacts;
- preserve undo/redo and dirty-state behavior;
- any new project property must survive two save/open cycles;
- imported text is plain/safe text;
- no public-network dependency in deterministic CI;
- do not replace drawing engine unless separately approved;
- do not introduce Leaflet 2 as part of C work;
- do not expand into traffic modeling/CAD/full GIS.

## PR strategy

Use one work package per PR or smaller slices where needed:

- `C1-engineering-symbols-measurement`
- `C1-buffer-coordinate-tools`
- `C2-report-composer`
- `C3-geojson-csv`
- `C3-image-overlay`

## Required handoff per work package

Create a qualification document containing:

- base/head SHA;
- exact commands/tests;
- browser/visual UAT evidence;
- persistence round-trip evidence;
- CI status;
- known limitations;
- whether the individual C work package is qualified.

Open PR against `main`; do not self-merge unless explicitly instructed.
