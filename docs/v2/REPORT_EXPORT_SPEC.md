# Map Tools v2 — Report Export Specification

Status: implementation specification
Date: 2026-08-25

## 1. Purpose

Map Tools should produce deterministic report-ready maps without requiring manual reconstruction in PowerPoint or graphics software.

Quick screenshot/capture and report export are separate workflows.

## 2. Output formats

Required presets:

- A4 portrait;
- A4 landscape;
- A3 portrait;
- A3 landscape;
- 16:9 presentation;
- custom pixel/page size.

Required output:

- high-resolution PNG;
- PDF.

Optional later:

- SVG/vector output where technically practical and licensing/tiles permit.

## 3. Composer model

The report composer is a controlled output layout, not a screenshot of the editing workspace.

Conceptual structure:

```text
┌─────────────────────────────────────────┐
│ Map title                               │
├─────────────────────────────────────────┤
│                                         │
│                 MAP                     │
│                                         │
│                               Legend    │
│                                         │
├─────────────────────────────────────────┤
│ Scale | North | Source | Date           │
└─────────────────────────────────────────┘
```

The exact placement may vary by template but must be deterministic.

## 4. Map furniture

Core elements:

- title;
- legend;
- north arrow;
- scale bar;
- source/attribution;
- date.

Each element can be enabled/disabled except source/attribution where required by tile/data license.

## 5. Legend

Legend entries derive from project semantics.

Priority sources:

1. semantic engineering symbol IDs;
2. semantic style/preset metadata;
3. explicit user legend labels where later supported.

Do not infer engineering meaning from raw colors alone.

Deduplicate identical semantic entries unless the user explicitly requests separate entries.

## 6. Scale bar

Scale must correspond to actual map projection/zoom at the output viewport.

Do not fake a decorative scale bar.

Preferred metric labeling:

- metres for local scales;
- kilometres for broader scales.

## 7. North arrow

For normal north-up Leaflet maps, standard north arrow is acceptable.

If map rotation is later introduced, north arrow must reflect map bearing. Rotation is not required for v2 Core.

## 8. Attribution

Preserve required attribution for basemap/tile providers and imported datasets where applicable.

Attribution must remain legible in final output.

Do not silently remove OpenStreetMap/Esri/CARTO/etc. required credits merely to create a cleaner figure.

## 9. Resolution

PNG export should support at least:

- 1x draft;
- 2x standard report;
- higher-resolution option where browser memory permits.

A4/A3 PDF output should be sized in physical page dimensions rather than only arbitrary screenshot pixels.

## 10. Output isolation

The final export must exclude:

- editing toolbars;
- search panel;
- object manager;
- inspector;
- selection handles;
- drawing vertices;
- context menus;
- hover/selection highlighting;
- loading/error UI.

Project annotations intentionally placed on the map remain.

## 11. Tile/render readiness

The export flow must wait for the controlled map view to reach a ready state before capture/render.

If required basemap tiles fail:

- do not silently export a partially blank final report without warning;
- surface a clear export warning/error;
- allow retry.

Deterministic automated tests should mock tile readiness rather than rely on public services.

## 12. Project view vs export view

The report composer may use a temporary export viewport/extent without overwriting the working project's saved map view unless the user explicitly chooses to apply it.

## 13. Title and source text safety

All report text is plain/sanitized text under the same security rules as project labels.

## 14. Visual qualification cases

Required visual cases:

1. marker + radius;
2. text + arrow;
3. mixed polygon/circle/rectangle;
4. engineering symbols with legend;
5. Thai + English labels;
6. A4 landscape;
7. A3 landscape;
8. 16:9;
9. long title/source text;
10. dark and light basemap where supported.

## 15. Acceptance

A report export is qualified when:

- selected size/orientation is correct;
- no editor chrome leaks into output;
- map content matches project semantics;
- scale bar is valid;
- north arrow is correct for supported orientation;
- attribution is present where required;
- legend is deterministic and readable;
- high-resolution PNG succeeds;
- PDF succeeds;
- Thai text renders correctly;
- repeated export from identical state produces materially equivalent composition.

## 16. Explicit non-goals

- full desktop-publishing layout engine;
- arbitrary multi-page report authoring;
- Adobe Illustrator replacement;
- print-shop prepress controls.
