# Map Tools v2 — Workspace UX Specification

Status: implementation specification
Date: 2026-08-25

## 1. Product intent

The workspace should support real engineering study maps containing dozens to hundreds of objects. The user should not have to remember hidden right-click actions or repeatedly open modal dialogs to manage normal object properties.

## 2. Desktop information architecture

Preferred layout:

```text
┌───────────────────────────────────────────────────────────────┐
│ Project / File      Search                Save   Export       │
├────────┬──────────────────────────────┬───────────────────────┤
│ Tool   │                              │ Objects / Layers      │
│ rail   │             MAP              │ --------------------  │
│        │                              │ Inspector             │
│        │                              │                       │
├────────┴──────────────────────────────┴───────────────────────┤
│ Lat/Lon | Zoom | Scale | Selection summary | Saved/Unsaved   │
└───────────────────────────────────────────────────────────────┘
```

This is a behavior specification, not a pixel-perfect visual mandate. Preserve current visual strengths where practical.

## 3. Primary user states

The workspace must have explicit state for:

- no selection;
- one feature selected;
- multiple features selected (later/basic support acceptable);
- drawing tool active;
- editing geometry;
- transient search result;
- dirty project;
- saved project;
- import validation error/warning.

Do not rely only on color to communicate active state.

## 4. Object/layer panel

Each persisted feature appears exactly once in the object panel.

Minimum row actions:

- select;
- visibility toggle;
- lock indicator/toggle;
- name;
- feature-type icon;
- context action menu.

Context actions:

- rename;
- duplicate;
- zoom to;
- move/group where grouping exists;
- delete.

Group rows support:

- expand/collapse;
- visibility;
- lock;
- rename;
- delete/ungroup behavior with explicit confirmation semantics.

## 5. Selection contract

Selection is a single source of truth shared by map and panel.

### Map → panel

Clicking/selecting a feature on the map:

- selects the corresponding domain feature;
- highlights its object-panel row;
- brings the row into view when practical;
- populates the inspector.

### Panel → map

Clicking an object-panel row:

- selects the map object;
- visibly highlights it without modifying persisted style;
- populates the inspector.

Selection highlight must be transient UI state and must not be serialized.

## 6. Inspector contract

The inspector exposes properties appropriate to feature type.

Common properties:

- name;
- group;
- visibility;
- lock;
- stroke/fill/symbol style where relevant.

Feature-specific properties:

- marker: symbol/color + radius rings;
- text: text, rotation, font styling;
- polyline/arrow: stroke style; arrow semantics for arrow;
- polygon/rectangle: stroke/fill;
- circle: center/radius + style.

Normal property editing should not require opening a modal unless the control is genuinely complex.

## 7. Drawing interaction

Starting a drawing tool must:

- visibly mark the active tool;
- change cursor/interaction state appropriately;
- provide an obvious cancel route;
- support `Escape` to cancel current drawing safely;
- return to neutral state after completion unless repeat-draw mode is deliberately introduced later.

## 8. Keyboard contract

At minimum:

- `Escape`: cancel transient drawing/editing/modal state; otherwise clear selection;
- `Delete`/`Backspace`: delete selected project feature only when focus is not inside an editable text/input field;
- `Ctrl/Cmd+Z`: undo;
- `Ctrl/Cmd+Shift+Z` and/or `Ctrl/Cmd+Y`: redo;
- `Ctrl/Cmd+S`: save project where browser restrictions allow interception without harmful side effects.

Keyboard shortcuts must not fire while typing into text inputs when inappropriate.

## 9. Undo/redo contract

Undoable operations must include at least:

- feature create;
- feature delete;
- feature move;
- geometry edit;
- style edit;
- name/text/property edit;
- radius add/edit/delete;
- duplicate;
- group move/change where implemented.

Rules:

- new mutation after undo clears redo stack;
- selection-only changes are not history commands;
- loading a different project resets command history;
- save does not erase history unless implementation requires it and this is documented;
- undo/redo must restore semantic domain state, not merely visual Leaflet state.

## 10. Dirty/saved state

Show an unobtrusive but visible indicator:

- `Saved` when persisted state matches last save/load baseline;
- `Unsaved changes` after a persisted-domain mutation.

Transient UI state must not mark dirty.

## 11. Search contract

Search is a navigation/discovery workflow, not automatic project creation.

A search result:

- appears in a transient search layer;
- may be selected/inspected;
- may move/zoom map;
- must not enter project serialization automatically.

Provide an explicit **Add to project** action to convert a result into a normal marker feature.

If multiple geocoder matches exist, show a result list rather than always taking the first result.

## 12. Context menu

Right-click remains a productivity shortcut, not the only discoverable route to core actions.

Every critical action available only in a context menu in v1 should have a visible route through selection + inspector/object panel in v2.

## 13. Confirmation behavior

Require explicit confirmation for destructive multi-object actions such as clear project or deleting a non-empty group if children would also be deleted.

Single-feature deletion should be recoverable by Undo; a blocking confirmation dialog is therefore optional once reliable undo exists.

## 14. Responsive behavior

### Wide desktop

- map remains primary canvas;
- object/inspector panel may remain persistently visible.

### Narrow desktop/tablet

- side panel may collapse or overlay;
- primary map controls remain reachable;
- no horizontal page scrolling caused by workspace chrome.

### Mobile

Mobile is supported for viewing/light annotation, not required to match desktop power-user density. Primary actions must remain reachable and dialogs must fit viewport.

## 15. Accessibility requirements

- icon-only controls have accessible names/tooltips;
- focus is visible;
- keyboard traversal is coherent;
- modal focus is contained/restored appropriately;
- active/selected states are not color-only;
- text contrast meets normal UI expectations;
- touch targets remain usable on small screens.

## 16. Dense-project UAT

Create a project with approximately:

- 20 markers;
- 5 text labels;
- 10 lines/arrows;
- 5 polygons/rectangles/circles;
- 4 groups.

A user must be able to locate, hide/show, lock/unlock, rename, duplicate, zoom to, edit, and delete objects primarily from the object panel without map hunting.

## 17. Explicit non-goals

- no full GIS layer symbology editor;
- no collaborative multi-user presence;
- no timeline/version-history UI;
- no CAD-style precision constraint system in v2 Core.
