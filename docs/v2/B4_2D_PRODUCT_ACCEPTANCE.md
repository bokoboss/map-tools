# B4 — 2D Product Acceptance Specification

Status: execution specification  
Date: 2026-08-26  
Issue: #13

## 1. Objective

Qualify Map Tools v2 as a usable 2D engineering-map application before starting any visible 3D work.

Macro A and B established a reliable architecture and productive workspace. B4 is intentionally different: it is a **product acceptance / interaction parity gate**. Passing unit tests or renderer architecture tests is not sufficient by itself.

The target user outcome is:

> A user can create, locate, edit, protect, save, reopen, and delete common map objects through obvious map/workspace interactions without discovering that a documented shortcut or core v1 workflow has silently disappeared.

## 2. Product principles

1. **Map-first.** The map remains the dominant surface.
2. **Exact placement.** Creating a geographic object must make the intended coordinate obvious.
3. **Context shortcuts, not context dependence.** Desktop right-click is fast, but every required action has a toolbar/workspace alternative.
4. **Canonical commands.** Context menu, popup, inspector, keyboard, and toolbar routes must converge on the same domain/store mutations.
5. **Locks actually protect.** A lock is not decorative.
6. **Transient means transient.** Context menu, reverse-geocode status, placement mode, selection, and hover are not persisted project data.
7. **Help describes reality.** No documented workflow may be absent in production.
8. **No v1 security regression.** Parity never justifies unsafe `innerHTML`, inline event handlers, runtime IDs, or direct Leaflet persistence.

## 3. Required user journeys

### J1 — Desktop exact-point marker journey

Starting from a blank project:

1. right-click a known blank-map coordinate;
2. custom context menu opens near the pointer and remains inside the viewport;
3. menu displays longitude/latitude in a documented order;
4. mocked reverse-geocode status resolves to a safe plain-text address;
5. choose **Add marker here**;
6. marker editor opens with the clicked coordinate retained transiently;
7. enter marker name and color;
8. save;
9. project contains exactly one marker at the clicked WGS84 `[longitude, latitude]` coordinate;
10. marker becomes selected in Objects / Inspector;
11. add a radius ring;
12. drag marker;
13. Undo restores the exact pre-drag coordinate and ring remains attached;
14. Redo restores the moved coordinate;
15. save project;
16. reopen the saved project;
17. name, color, exact coordinate, radius ID/distance/color, and feature ID remain semantically intact.

Acceptance notes:

- opening/closing the background context menu and reverse geocoding creates no history and does not dirty the project;
- only the saved marker mutation changes project state;
- stale reverse-geocode responses must not mutate a different/newer menu.

### J2 — Universal toolbar / touch-equivalent marker placement

1. activate **Add Pin** from the toolbar;
2. application enters visible marker-placement mode;
3. no modal opens yet and no project feature is created;
4. click/tap a known map point;
5. marker editor opens for that exact point;
6. save creates one marker there;
7. repeat and press Escape before map placement — no marker is created;
8. repeat, click the map, then cancel the editor — no marker is created.

This is the required non-right-click path for touch/mobile users.

### J3 — Marker contextual workflow

Given an existing marker with one radius:

1. right-click marker;
2. marker is selected and workspace row/inspector synchronize;
3. menu offers marker-appropriate actions;
4. **Edit marker** changes the name/color through the canonical edit route;
5. **Manage radii** allows add/edit/delete and participates in history;
6. **Delete marker** uses the normal confirmation/domain delete path;
7. Undo/Redo restore/remove the complete marker including radius semantics.

### J4 — Text contextual workflow

1. add text at a known point;
2. right-click text;
3. text is selected;
4. menu offers **Edit text**, **Rotate**, and **Delete**;
5. edit content;
6. rotate to a non-default angle;
7. Undo/Redo restore both content and rotation correctly;
8. deletion and Undo restore safe literal text with no HTML execution.

### J5 — Shape and arrow contextual workflow

For polyline, polygon, rectangle, circle, and arrow:

1. create the object using normal drawing UI;
2. right-click it;
3. it becomes selected;
4. menu provides geometry edit, style edit, and delete as appropriate;
5. geometry edit remains one logical history transaction;
6. style edit is undoable;
7. delete is undoable;
8. semantic rectangle/circle/arrow identities survive save/open.

At least one real browser journey must execute the full create → context edit → undo/redo → save/open path for a polygon and for an arrow. Other shape types may use focused parity tests plus the preserved characterization suite.

### J6 — Effective lock protection

Test both direct feature lock and parent-group lock.

While effectively locked:

Allowed:
- select;
- inspect read-only properties;
- zoom to;
- toggle visibility;
- unlock using the legitimate lock control when the lock source permits it.

Blocked:
- drag/move;
- geometry edit;
- text/content edit;
- style/color edit;
- radius add/edit/delete;
- group reassignment;
- Delete/Backspace deletion;
- context-menu delete/edit/style actions;
- popup edit action;
- inspector mutations.

Group-lock rules:

- effective lock is `group.locked || feature.locked`;
- toggling group lock never overwrites the child `feature.locked` flag;
- attempting to unlock the feature while its group remains locked does not make it editable;
- history records the actual lock mutation, not blocked user attempts.

### J7 — Context menu lifecycle and accessibility

Desktop:

- right-click background opens background menu;
- right-click feature opens feature menu only;
- opening a new context menu closes the previous one;
- normal map click closes it;
- Escape closes it before clearing unrelated selection;
- scrolling/resizing cannot strand it outside the viewport;
- first actionable item receives sensible focus;
- menu items are real buttons or equivalent accessible controls;
- disabled locked actions expose a disabled state, not only a color change.

Mobile/touch:

- B4 does not require long-press context menus;
- exact marker placement and object actions remain available through toolbar + workspace;
- no required capability depends solely on right-click.

### J8 — Help / discoverability journey

Help must describe the current product, including:

- pan/zoom/basemap/search;
- Add Pin placement mode;
- desktop right-click background actions;
- desktop right-click object actions;
- Objects / Inspector as the universal object-management path;
- Undo/Redo and Saved/Unsaved;
- lock behavior;
- touch/mobile alternative to right-click;
- save/open and quick PNG export.

Browser smoke should assert that key help text is consistent with actual controls/actions; do not use brittle full-copy snapshots.

## 4. Context-menu architecture

A dedicated transient controller is preferred, e.g. `ContextMenuController`, rather than embedding menu construction inside `LeafletRenderer`.

### Renderer responsibility

- detect background/feature context request;
- translate Leaflet runtime data to renderer-neutral request data;
- stop feature context requests from bubbling into a second background request;
- emit stable `FeatureId | null`, WGS84 coordinate, and client/viewport point.

### Application/UI responsibility

- select feature when context is for a feature;
- build the appropriate menu from domain feature/effective lock state;
- route actions to existing AppController / WorkspaceController commands;
- perform reverse geocoding through `GeocodingService`;
- manage focus/close/stale-request lifecycle;
- never write context state into `ProjectDocumentV2`.

### RendererHost responsibility

As with map click and feature selection, context-request listeners must survive renderer replacement without duplicated listeners.

## 5. Reverse-geocode behavior

Background context menu initially renders:

- `Longitude: ...`
- `Latitude: ...`
- `Looking up address…`

Then resolves to safe plain text such as:

- `Address: ...`

Failure must show a non-blocking message such as:

- `Address unavailable`

Requirements:

- no raw HTML from the geocoder;
- mock Nominatim in tests;
- exact coordinate passed to reverse endpoint;
- a request token or abort strategy prevents stale results from updating a newer menu;
- closing menu invalidates pending UI update;
- reverse lookup never changes dirty/history/project serialization.

## 6. Placement-mode behavior

`Add Pin` should behave as a tool, not as an implicit “create at map center” command.

State machine:

`idle → marker-placement → marker-editor → create | cancel → idle`

Rules:

- toolbar button visibly indicates active placement mode;
- cursor/status indicates “click map to place marker”;
- activating another drawing/annotation tool cancels marker placement;
- Escape cancels marker placement first;
- map pan/zoom remains usable where practical, but a deliberate map click is the placement event;
- right-click **Add marker here** bypasses placement mode and opens the same editor with the context coordinate;
- no feature exists until Save.

## 7. Lock-command guard

Do not enforce lock only by disabling Leaflet dragging. Add an application/domain-command guard so every mutation route is protected consistently.

A small reusable policy/helper is preferred, conceptually:

```ts
canMutateFeature(project, featureId, mutationKind): boolean
```

or equivalent.

The important property is centralization: inspector, keyboard, context menu, popup, and map edit must not each invent separate lock rules.

Blocked operations should be no-op from the domain/history perspective and provide understandable UI feedback where relevant.

## 8. Browser test strategy

Add a dedicated B4 suite, preferably split by concern:

- `tests/context-menu-browser.spec.js`
- `tests/marker-placement-browser.spec.js`
- `tests/lock-semantics-browser.spec.js`
- `tests/b4-product-journey.spec.js`

Tests should use real UI events whenever feasible:

- Playwright `click({ button: 'right' })` / mouse right-click;
- toolbar buttons;
- form inputs;
- actual drawing interactions or existing renderer-visible layers where Leaflet.draw automation is unstable;
- file download/upload for a real save/open journey where practical.

Test hooks may be used for deterministic observation and setup, but the acceptance journeys must not be implemented entirely as direct `window.__mapToolsTest` mutations.

## 9. Required regression matrix

Preserve all existing A/B qualification gates plus add assertions for:

- context request carries no Leaflet runtime object;
- `RendererHost` rebinds context listeners exactly once;
- background context is transient;
- feature context uses stable ID;
- feature context does not double-fire background menu;
- reverse lookup safe/stale-resistant;
- exact marker placement coordinate order;
- placement cancel creates no history/project feature;
- context actions create the same domain result/history behavior as equivalent workspace actions;
- effective lock blocks every prohibited mutation route;
- blocked lock attempts create no history entry and do not dirty;
- Help does not advertise absent controls;
- production `/index.html` still exposes no test globals.

## 10. Performance / scope discipline

B4 is interaction hardening, not a UI rewrite.

Do not:

- introduce React or another framework;
- change Project Schema solely for context-menu state;
- introduce MapLibre/Three.js;
- replace Leaflet.draw;
- redesign the workspace wholesale;
- implement the engineering symbol toolkit;
- implement report composer/export C2;
- expand interoperability C3.

## 11. Qualification artifact

Create `docs/v2/B4_QUALIFICATION.md` containing:

- base SHA;
- implementation head SHA;
- final PR tip/CI provenance without pre-claiming future SHAs;
- parity matrix outcome with every required GAP resolved;
- exact unit/integration count;
- dev browser count;
- preview browser count;
- J1–J8 outcome matrix;
- lock-surface matrix;
- static artifact smoke;
- normal production global check;
- known limitations;
- final decision:
  - `B4_2D_PRODUCT_ACCEPTANCE_QUALIFIED`, or
  - `B4_2D_PRODUCT_ACCEPTANCE_NOT_QUALIFIED` with exact blockers;
- C4 gate:
  - `READY_TO_START_C4_1`, or
  - `BLOCK_C4_1` with exact reason.

## 12. Exit condition

Do not start C4.1 implementation until B4 is merged and `B4_2D_PRODUCT_ACCEPTANCE_QUALIFIED` is accepted by the control-plane review.
