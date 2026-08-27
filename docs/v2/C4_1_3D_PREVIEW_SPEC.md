# C4.1 — 3D Preview Product Specification

Status: authoritative planning contract  
Date: 2026-08-27  
Parent: issue #10 — C4 2.5D/3D engineering visualization mode

## 1. Objective

Add a useful **3D Preview** mode to Map Tools without turning the product into a 3D authoring/CAD application.

The accepted 2D workspace remains the authoritative editing environment. C4.1 adds a second renderer that visualizes the same canonical ProjectDocumentV2 and the same stable feature IDs.

Primary user job:

> Open an engineering study map, switch to 3D, orbit the site, understand project geometry in surrounding building context, inspect/select the same objects, optionally apply temporary preview extrusion, then return to 2D with the project unchanged except for normal map navigation or deliberate project edits.

## 2. Product boundary

C4.1 is **3D visualization / 2.5D preview**, not a geometry editor.

In 3D Preview:

Allowed:
- pan / zoom / orbit / pitch / bearing;
- select objects;
- Objects / Inspector synchronization;
- visibility and lock controls;
- property/style edits that are already renderer-neutral;
- marker/text/radius property editing;
- delete/duplicate where existing lock policy permits;
- contextual right-click selection/actions;
- transient preview extrusion for polygon/rectangle features;
- normal save/open of the canonical project.

Not allowed in C4.1:
- drawing new geometry;
- marker/text dragging;
- shape vertex editing;
- terrain editing;
- true 3D model placement;
- mesh/vertex tools;
- BIM/CAD;
- Three.js assets.

Geometry creation and geometry manipulation stay in 2D.

## 3. Mode switch

Add a compact top-level segmented control:

- **2D**
- **3D Preview**

Requirements:
- 2D remains the default on application load.
- Switching mode is transient UI state.
- Switching mode alone does not dirty the project, create history, or serialize any new field.
- Current stable feature selection survives 2D ↔ 3D.
- The canonical ProjectStore object is never replaced or duplicated.
- Search/context/placement transient state is closed/cancelled before renderer replacement.
- Active drawing/edit transactions must be cleanly cancelled before entering 3D.
- Returning to 2D recreates the Leaflet renderer/drawing adapter against the same canonical project.

## 4. Camera semantics

Persisted ProjectDocumentV2 MapView remains unchanged:

- center;
- zoom;
- 2D basemapId.

C4.1 does **not** add pitch or bearing to Project Schema v2.

3D-only camera presentation state is transient:
- pitchDeg;
- bearingDeg.

Recommended default when first entering 3D:
- pitch: approximately 55°;
- bearing: approximately -20°.

Requirements:
- 3D pan/zoom updates canonical map center/zoom using the existing map-view semantics.
- 3D pitch/bearing changes do not dirty/history/serialize.
- 3D renderer must not replace the persisted 2D basemapId with its own vector-style identifier.
- Returning to 2D uses the current shared center/zoom and the unchanged 2D basemap selection.
- Provide **Reset North** and **Top View** controls.
- Top View means pitch 0°, while Reset North means bearing 0°.

## 5. 3D basemap / building context

Initial production 3D style:
- OpenFreeMap Bright style: https://tiles.openfreemap.org/styles/bright

Initial building context:
- OpenFreeMap vector source: https://tiles.openfreemap.org/planet
- source layer: building
- MapLibre fill-extrusion using render_height/render_min_height where available.

Requirements:
- map attribution must remain visible;
- style/source failure must degrade gracefully to project overlay if possible, or show a clear non-destructive error state;
- external provider failure must never mutate/delete canonical project data;
- 3D style choice is renderer configuration, not ProjectDocumentV2 state;
- 2D basemap selector is disabled in 3D with an explanatory hint rather than pretending that raster Leaflet basemap IDs map one-to-one to the 3D vector style.

## 6. Preview extrusion

C4.1 must demonstrate project massing without prematurely changing Project Schema.

Add **transient preview extrusion** for polygon and rectangle features.

Suggested UI:
- selected polygon/rectangle in 3D exposes:
  - Preview extrusion toggle;
  - Preview height (m);
  - clear “Preview only — not saved” disclosure.

Requirements:
- extrusion settings are renderer/workspace transient state keyed by stable FeatureId;
- they are absent from ProjectDocumentV2;
- they create no project history;
- they do not dirty the project;
- they survive 2D ↔ 3D mode switches within the current browser session;
- they do not survive save/reopen;
- C4.2 is the phase that may introduce versioned persistent elevation/height semantics.

Default preview height when enabled: 20 m.

## 7. Interaction consistency

### Selection

- clicking a rendered project feature selects its stable FeatureId;
- selected object row and Inspector update exactly as in 2D;
- selecting from Objects highlights/focuses the corresponding 3D feature;
- renderer switching preserves valid selection.

### Context menu

The B4 renderer-neutral MapContextRequest contract remains authoritative.

3D background right-click:
- same coordinate/reverse-geocode behavior as 2D;
- Add marker here may remain available because creation occurs through the canonical marker editor, but any geometry placement/edit flow that requires map dragging remains 2D-only.

3D feature right-click:
- selects the same stable feature;
- canonical property/delete/radius actions remain governed by existing lock policy;
- geometry-edit action must be disabled or explicitly route the user back to 2D; it must never silently no-op.

### Lock semantics

C4.1 must reuse B4 mutation policy:
- effectiveLocked = group.locked || feature.locked;
- no MapLibre interaction may bypass canMutateFeature/canMutateGroup;
- 3D preview itself does not create a second lock model.

## 8. Drawing and editing UX in 3D

When 3D Preview is active:
- geometry drawing buttons are disabled;
- Add Text / Add Pin placement requiring map placement is disabled unless an explicitly safe 3D-point placement path is implemented and qualified; default C4.1 behavior is disabled;
- geometry edit/toggle actions are disabled;
- marker/text dragging is unavailable;
- show a concise hint: “Switch to 2D to draw or edit geometry.”

Property editing through Inspector remains usable where renderer-neutral and permitted by lock policy.

## 9. Error and fallback behavior

If WebGL / MapLibre initialization fails:
- keep canonical project untouched;
- return or offer return to 2D;
- show a concise error message;
- never trap the user in a blank workspace.

If OpenFreeMap style/building source fails:
- project overlays should still render when a usable style exists;
- otherwise present a non-destructive 3D unavailable state;
- 2D remains fully usable.

## 10. Accessibility / responsive behavior

- mode switch keyboard accessible;
- active mode communicated beyond color;
- camera/reset controls have accessible names;
- disabled 3D editing controls communicate why;
- at narrow/mobile width, 3D Preview remains usable but the existing responsive workspace behavior stays authoritative;
- touch orbit/pitch is provided by MapLibre interaction, while editing still routes to 2D.

## 11. Acceptance journeys

### C4-J1 — clean renderer switch

Open mixed fixture in 2D → select a feature → switch to 3D → same selected ID → switch back → same project fingerprint/IDs and valid selection.

### C4-J2 — camera

Enter 3D → orbit/pitch/bearing → Reset North → Top View → verify pitch/bearing are transient and create no project history/dirty state.

### C4-J3 — building context

At a representative Bangkok urban location and suitable zoom → 3D building context renders above the vector basemap with required attribution.

CI tests must not depend on public network availability; use deterministic renderer/style fixtures for automated coverage and retain a separate real-provider smoke.

### C4-J4 — project feature matrix

Mixed fixture shows and keeps identifiable:
- marker;
- marker radius rings;
- text including Thai;
- polyline;
- polygon;
- rectangle;
- circle;
- arrow.

### C4-J5 — preview extrusion

Select project polygon → enable 20 m preview extrusion → visible fill extrusion → change height → switch 2D → back 3D → transient extrusion remains in-session → save/reopen → preview extrusion absent → ProjectDocument semantics unchanged.

### C4-J6 — selection/context

3D feature click/right-click selects stable feature and synchronizes workspace/context. Locked features retain B4 protection. Geometry-edit action is unavailable in 3D with explicit explanation.

### C4-J7 — property mutation

Change a renderer-neutral property/style from Inspector in 3D → ProjectStore/history behavior matches 2D → 3D overlay updates → undo/redo works → save/reopen preserves the canonical mutation.

### C4-J8 — failure fallback

Force MapLibre/style initialization failure → no project data loss → user can return to qualified 2D workspace.

## 12. Success decision

Final qualification must report one of:

- C4_1_3D_PREVIEW_QUALIFIED
- C4_1_3D_PREVIEW_NOT_QUALIFIED

And one of:

- READY_FOR_C4_2
- BLOCK_C4_2

C4.2 readiness means the preview architecture is stable enough to consider persistent engineering elevation semantics; it does not mean C4.2 is implemented.
