import { clone, createId, effectiveState } from '../domain/project';
import { canMutateFeature, canMutateGroup } from '../domain/mutationPolicy';
import type {
  FeatureId,
  FeatureStyle,
  ProjectDocumentV2,
  ProjectFeature,
  ProjectGroup,
  RadiusRing
} from '../domain/model';
import { ProjectStore } from '../store/ProjectStore';
import type { MapRenderer } from '../map/renderer/MapRenderer';
import { WorkspaceState } from './WorkspaceState';

function requiredElement<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as unknown as T;
}

function isMarker(feature: ProjectFeature): feature is Extract<ProjectFeature, { type: 'marker' }> {
  return feature.type === 'marker';
}

function isText(feature: ProjectFeature): feature is Extract<ProjectFeature, { type: 'text' }> {
  return feature.type === 'text';
}

function isColor(value: string | undefined): value is `#${string}` {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
}

function colorOrDefault(value: string | undefined, fallback: string): string {
  return isColor(value) ? value : fallback;
}

function featureTypeLabel(type: ProjectFeature['type']): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function featureIcon(type: ProjectFeature['type']): string {
  const icons: Record<ProjectFeature['type'], string> = {
    marker: '●',
    text: 'T',
    polyline: '╱',
    polygon: '◇',
    rectangle: '▣',
    circle: '○',
    arrow: '➜'
  };
  return icons[type];
}

function appendButton(parent: HTMLElement, label: string, action: string, className = 'workspace-icon-button'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.action = action;
  button.ariaLabel = label;
  button.title = label;
  button.textContent = label;
  parent.appendChild(button);
  return button;
}

export class WorkspaceController {
  private readonly panel = requiredElement<HTMLElement>('workspace-panel');
  private readonly objectList = requiredElement<HTMLElement>('object-list');
  private readonly inspector = requiredElement<HTMLElement>('inspector');
  private readonly filterInput = requiredElement<HTMLInputElement>('object-filter');
  private readonly addGroupButton = requiredElement<HTMLButtonElement>('add-group-btn');
  private readonly status = requiredElement<HTMLElement>('workspace-status');
  private readonly workspaceToggle = requiredElement<HTMLButtonElement>('workspace-toggle-btn');
  private readonly workspaceClose = requiredElement<HTMLButtonElement>('workspace-close-btn');
  private readonly store: ProjectStore;
  private readonly renderer: MapRenderer;
  private readonly state: WorkspaceState;
  private readonly unsubscribeStore: () => void;
  private readonly unsubscribeState: () => void;
  private readonly unsubscribeRenderer: () => void;
  private filter = '';
  private readonly knownGroupIds = new Set<string>();

  constructor(store: ProjectStore, renderer: MapRenderer, state = new WorkspaceState()) {
    this.store = store;
    this.renderer = renderer;
    this.state = state;
    this.unsubscribeStore = store.subscribe(() => this.render());
    this.unsubscribeState = state.subscribe(() => this.syncSelectionAndRender());
    this.unsubscribeRenderer = renderer.onFeatureSelect((featureId) => state.selectFeature(featureId));
    this.objectList.addEventListener('click', (event) => this.handleObjectClick(event));
    this.filterInput.addEventListener('input', () => {
      this.filter = this.filterInput.value.trim().toLocaleLowerCase();
      this.renderObjects();
    });
    this.addGroupButton.addEventListener('click', () => this.createGroup());
    this.workspaceToggle.addEventListener('click', () => this.panel.classList.toggle('workspace-panel-collapsed'));
    this.workspaceClose.addEventListener('click', () => this.panel.classList.add('workspace-panel-collapsed'));
    this.render();
  }

  destroy(): void {
    this.unsubscribeStore();
    this.unsubscribeState();
    this.unsubscribeRenderer();
  }

  getState(): WorkspaceStateSnapshotLike {
    return this.state.getSnapshot();
  }

  selectFeature(featureId: FeatureId | null): void {
    const feature = featureId ? this.findFeature(featureId) : null;
    this.state.selectFeature(feature ? feature.id : null);
    this.renderer.selectFeature(feature ? feature.id : null);
    if (feature) this.scrollSelectedRowIntoView(feature.id);
  }

  clearSelection(): void {
    this.state.clearSelection();
    this.renderer.selectFeature(null);
  }

  duplicateFeature(featureId: FeatureId): FeatureId | null {
    const source = this.findFeature(featureId);
    if (!source) return null;
    const snapshot = this.store.getSnapshot();
    if (!canMutateFeature(snapshot, featureId, 'duplicate')) return null;
    const copy = clone(source);
    copy.id = createId('feature');
    copy.name = this.copyName(source.name, snapshot.features.map((feature) => feature.name));
    if (isMarker(copy)) {
      copy.properties.radii = copy.properties.radii.map((radius) => ({ ...radius, id: createId('radius') }));
    }
    this.store.addFeature(copy);
    this.selectFeature(copy.id);
    return copy.id;
  }

  deleteFeature(featureId: FeatureId): void {
    if (!this.findFeature(featureId)) return;
    if (this.store.removeFeature(featureId) && this.state.getSelectedFeatureId() === featureId) this.clearSelection();
  }

  private render(): void {
    const snapshot = this.store.getSnapshot();
    snapshot.groups.forEach((group) => {
      if (!this.knownGroupIds.has(group.id)) {
        this.knownGroupIds.add(group.id);
        this.state.setGroupExpanded(group.id, true);
      }
    });
    const ids = new Set(snapshot.features.map((feature) => feature.id));
    this.state.retainFeature(this.state.getSelectedFeatureId(), ids);
    this.status.textContent = this.store.isDirty() ? 'Unsaved changes' : 'Saved';
    this.renderObjects();
    this.renderInspector();
  }

  private syncSelectionAndRender(): void {
    const selected = this.state.getSelectedFeatureId();
    this.renderer.selectFeature(selected);
    this.renderObjects();
    this.renderInspector();
  }

  private renderObjects(): void {
    const snapshot = this.store.getSnapshot();
    this.objectList.replaceChildren();
    const groups = [...snapshot.groups].sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
    groups.forEach((group) => this.renderGroup(snapshot, group));
    this.renderUngrouped(snapshot);
  }

  private renderGroup(snapshot: ProjectDocumentV2, group: ProjectGroup): void {
    const features = snapshot.features.filter((feature) => feature.groupId === group.id);
    const visibleFeatures = features.filter((feature) => this.matchesFilter(feature, group.name));
    if (this.filter && !visibleFeatures.length) return;
    const section = document.createElement('section');
    section.className = 'workspace-group';
    section.dataset.groupId = group.id;
    const header = this.createGroupHeader(group, features.length);
    section.appendChild(header);
    if (this.state.isGroupExpanded(group.id)) {
      const list = document.createElement('div');
      list.className = 'workspace-feature-list';
      visibleFeatures.forEach((feature) => list.appendChild(this.createFeatureRow(snapshot, feature, group)));
      section.appendChild(list);
    }
    this.objectList.appendChild(section);
  }

  private renderUngrouped(snapshot: ProjectDocumentV2): void {
    const features = snapshot.features.filter((feature) => feature.groupId === null);
    const visibleFeatures = features.filter((feature) => this.matchesFilter(feature, 'Ungrouped'));
    if (this.filter && !visibleFeatures.length) return;
    const section = document.createElement('section');
    section.className = 'workspace-group workspace-ungrouped';
    const header = document.createElement('div');
    header.className = 'workspace-group-header';
    const title = document.createElement('span');
    title.className = 'workspace-group-name';
    title.textContent = `Ungrouped (${features.length})`;
    header.appendChild(title);
    section.appendChild(header);
    visibleFeatures.forEach((feature) => section.appendChild(this.createFeatureRow(snapshot, feature, null)));
    this.objectList.appendChild(section);
  }

  private createGroupHeader(group: ProjectGroup, count: number): HTMLElement {
    const header = document.createElement('div');
    header.className = 'workspace-group-header';
    const toggle = appendButton(header, `${this.state.isGroupExpanded(group.id) ? 'Collapse' : 'Expand'} ${group.name}`, 'toggle-group', 'workspace-disclosure');
    toggle.textContent = this.state.isGroupExpanded(group.id) ? '▾' : '▸';
    toggle.dataset.groupId = group.id;
    const title = document.createElement('span');
    title.className = 'workspace-group-name';
    title.textContent = `${group.name} (${count})`;
    title.title = group.name;
    header.appendChild(title);
    const actions = document.createElement('div');
    actions.className = 'workspace-row-actions';
    const visibility = appendButton(actions, group.visible ? `Hide group ${group.name}` : `Show group ${group.name}`, 'toggle-group-visibility');
    visibility.dataset.groupId = group.id;
    visibility.textContent = group.visible ? '◉' : '○';
    visibility.classList.toggle('is-muted', !group.visible);
    const lock = appendButton(actions, group.locked ? `Unlock group ${group.name}` : `Lock group ${group.name}`, 'toggle-group-lock');
    lock.dataset.groupId = group.id;
    lock.textContent = group.locked ? '🔒' : '🔓';
    const rename = appendButton(actions, `Rename group ${group.name}`, 'rename-group');
    rename.dataset.groupId = group.id;
    rename.textContent = 'Rename';
    const remove = appendButton(actions, `Ungroup and remove ${group.name}`, 'delete-group');
    remove.dataset.groupId = group.id;
    remove.textContent = '×';
    rename.disabled = group.locked;
    rename.setAttribute('aria-disabled', String(group.locked));
    header.appendChild(actions);
    return header;
  }

  private createFeatureRow(snapshot: ProjectDocumentV2, feature: ProjectFeature, group: ProjectGroup | null): HTMLElement {
    const row = document.createElement('div');
    row.className = 'workspace-feature-row';
    row.dataset.featureId = feature.id;
    row.tabIndex = 0;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(this.state.getSelectedFeatureId() === feature.id));
    const state = effectiveState(feature, group);
    if (!state.visible) row.classList.add('is-hidden-feature');
    if (state.locked) row.classList.add('is-locked-feature');
    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'workspace-feature-select';
    select.dataset.action = 'select-feature';
    select.dataset.featureId = feature.id;
    select.title = `Select ${feature.name}`;
    const icon = document.createElement('span');
    icon.className = 'workspace-feature-icon';
    icon.textContent = featureIcon(feature.type);
    const name = document.createElement('span');
    name.className = 'workspace-feature-name';
    name.textContent = feature.name;
    name.title = feature.name;
    select.append(icon, name);
    row.appendChild(select);
    const actions = document.createElement('div');
    actions.className = 'workspace-row-actions workspace-feature-actions';
    const visibility = appendButton(actions, feature.visible ? `Hide ${feature.name}` : `Show ${feature.name}`, 'toggle-feature-visibility');
    visibility.dataset.featureId = feature.id;
    visibility.textContent = feature.visible ? '◉' : '○';
    visibility.classList.toggle('is-muted', !feature.visible);
    const lock = appendButton(actions, feature.locked ? `Unlock ${feature.name}` : `Lock ${feature.name}`, 'toggle-feature-lock');
    lock.dataset.featureId = feature.id;
    lock.textContent = feature.locked ? '🔒' : '🔓';
    const duplicate = appendButton(actions, `Duplicate ${feature.name}`, 'duplicate-feature');
    duplicate.dataset.featureId = feature.id;
    duplicate.textContent = '⧉';
    const fit = appendButton(actions, `Zoom to ${feature.name}`, 'zoom-feature');
    fit.dataset.featureId = feature.id;
    fit.textContent = '⌖';
    const remove = appendButton(actions, `Delete ${feature.name}`, 'delete-feature');
    remove.dataset.featureId = feature.id;
    remove.textContent = '×';
    duplicate.disabled = state.locked;
    remove.disabled = state.locked;
    duplicate.setAttribute('aria-disabled', String(state.locked));
    remove.setAttribute('aria-disabled', String(state.locked));
    row.appendChild(actions);
    row.addEventListener('click', (event) => this.handleObjectClick(event, feature.id));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.selectFeature(feature.id);
      }
    });
    return row;
  }

  private handleObjectClick(event: Event, fallbackFeatureId?: FeatureId): void {
    const target = event.target as HTMLElement;
    const actionElement = target.closest<HTMLElement>('[data-action]');
    const action = actionElement?.dataset.action;
    const featureId = actionElement?.dataset.featureId ?? fallbackFeatureId;
    const groupId = actionElement?.dataset.groupId;
    if (!action) {
      if (featureId) this.selectFeature(featureId);
      return;
    }
    event.stopPropagation();
    if (action === 'select-feature' && featureId) this.selectFeature(featureId);
    else if (action === 'toggle-feature-visibility' && featureId) this.updateFeature(featureId, (feature) => { feature.visible = !feature.visible; }, 'Toggle feature visibility', 'visibility');
    else if (action === 'toggle-feature-lock' && featureId) this.updateFeature(featureId, (feature) => { feature.locked = !feature.locked; }, 'Toggle feature lock', 'lock');
    else if (action === 'duplicate-feature' && featureId) this.duplicateFeature(featureId);
    else if (action === 'zoom-feature' && featureId) { this.selectFeature(featureId); this.renderer.fitFeature(featureId); }
    else if (action === 'delete-feature' && featureId) this.deleteFeature(featureId);
    else if (action === 'toggle-group' && groupId) this.state.toggleGroup(groupId);
    else if (action === 'toggle-group-visibility' && groupId) this.updateGroup(groupId, (group) => { group.visible = !group.visible; }, 'Toggle group visibility', 'visibility');
    else if (action === 'toggle-group-lock' && groupId) this.updateGroup(groupId, (group) => { group.locked = !group.locked; }, 'Toggle group lock', 'lock');
    else if (action === 'rename-group' && groupId) this.renameGroup(groupId);
    else if (action === 'delete-group' && groupId) this.deleteGroup(groupId);
  }

  private renderInspector(): void {
    this.inspector.replaceChildren();
    const feature = this.state.getSelectedFeatureId() ? this.findFeature(this.state.getSelectedFeatureId()!) : null;
    if (!feature) {
      const empty = document.createElement('p');
      empty.className = 'workspace-empty-state';
      empty.textContent = 'Select an object to inspect its properties.';
      this.inspector.appendChild(empty);
      return;
    }
    const heading = document.createElement('div');
    heading.className = 'workspace-inspector-heading';
    const title = document.createElement('div');
    title.className = 'workspace-inspector-title';
    title.textContent = feature.name;
    const type = document.createElement('span');
    type.className = 'workspace-type-badge';
    type.textContent = featureTypeLabel(feature.type);
    heading.append(title, type);
    this.inspector.appendChild(heading);
    const group = feature.groupId ? this.store.getSnapshot().groups.find((candidate) => candidate.id === feature.groupId) : null;
    const effectivelyLocked = effectiveState(feature, group).locked;
    if (effectivelyLocked) {
      const lockNotice = document.createElement('p');
      lockNotice.className = 'workspace-lock-notice';
      lockNotice.textContent = group?.locked ? 'Locked by its group. Protected fields are read-only.' : 'Locked. Protected fields are read-only.';
      lockNotice.setAttribute('role', 'status');
      this.inspector.appendChild(lockNotice);
    }
    const common = document.createElement('div');
    common.className = 'workspace-form-grid';
    common.appendChild(this.textField('Name', feature.name, 'inspector-name', (value) => this.updateFeature(feature.id, (next) => { next.name = value.trim() || feature.name; }, 'Rename feature')));
    common.appendChild(this.groupField(feature));
    common.appendChild(this.checkboxField('Visible', feature.visible, 'inspector-visible', (checked) => this.updateFeature(feature.id, (next) => { next.visible = checked; }, 'Toggle feature visibility', 'visibility')));
    common.appendChild(this.checkboxField('Locked', feature.locked, 'inspector-locked', (checked) => this.updateFeature(feature.id, (next) => { next.locked = checked; }, 'Toggle feature lock', 'lock')));
    this.inspector.appendChild(common);
    const specific = document.createElement('div');
    specific.className = 'workspace-inspector-specific';
    if (isMarker(feature)) this.renderMarkerInspector(specific, feature);
    else if (isText(feature)) this.renderTextInspector(specific, feature);
    else if (feature.type === 'circle') this.renderCircleInspector(specific, feature);
    else if (feature.type === 'polygon' || feature.type === 'rectangle') this.renderAreaInspector(specific, feature);
    else this.renderLineInspector(specific, feature);
    this.inspector.appendChild(specific);
    if (effectivelyLocked) this.disableProtectedInspectorControls();
  }

  private disableProtectedInspectorControls(): void {
    const controls = this.inspector.querySelectorAll<HTMLElement>(
      'input:not(#inspector-visible):not(#inspector-locked), textarea, select, button:not(#inspector-visible):not(#inspector-locked)'
    );
    controls.forEach((control) => {
      (control as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement).disabled = true;
      control.setAttribute('aria-disabled', 'true');
    });
  }

  private renderMarkerInspector(container: HTMLElement, feature: Extract<ProjectFeature, { type: 'marker' }>): void {
    container.appendChild(this.colorField('Marker color', feature.style.color, '#2563eb', (value) => this.updateStyle(feature.id, { color: value }, 'Edit marker color')));
    const heading = document.createElement('h4');
    heading.className = 'workspace-subheading';
    heading.textContent = 'Radius rings';
    container.appendChild(heading);
    feature.properties.radii.forEach((radius) => container.appendChild(this.radiusField(feature, radius)));
    const add = document.createElement('div');
    add.className = 'workspace-radius-add';
    const distance = this.numberInput('Distance (m)', '', 'inspector-radius-distance', 0);
    const color = this.colorInput('Color', '#3388ff', 'inspector-radius-color');
    const button = appendButton(add, 'Add radius', 'add-radius', 'workspace-small-button');
    button.textContent = 'Add';
    button.addEventListener('click', () => {
      const distanceValue = Number(distance.input.value);
      if (!Number.isFinite(distanceValue) || distanceValue < 0) return;
      const next = clone(feature);
      next.properties.radii.push({ id: createId('radius'), distanceM: distanceValue, color: color.input.value, fillOpacity: 0.2 });
      this.store.updateFeature(next, 'Add marker radius', 'radius');
    });
    add.append(distance.wrapper, color.wrapper, button);
    container.appendChild(add);
  }

  private radiusField(feature: Extract<ProjectFeature, { type: 'marker' }>, radius: RadiusRing): HTMLElement {
    const row = document.createElement('div');
    row.className = 'workspace-radius-row';
    const distance = this.numberInput('m', String(radius.distanceM), `radius-distance-${radius.id}`, 0);
    distance.input.addEventListener('change', () => this.updateRadius(feature.id, radius.id, (next) => { next.distanceM = Number(distance.input.value); }, 'Edit radius'));
    const color = this.colorInput('Radius color', radius.color, `radius-color-${radius.id}`);
    color.input.addEventListener('change', () => this.updateRadius(feature.id, radius.id, (next) => { next.color = color.input.value; }, 'Edit radius color'));
    const remove = appendButton(row, `Delete radius ${radius.distanceM} meters`, 'delete-radius', 'workspace-small-button danger');
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      const current = this.findFeature(feature.id);
      if (!current || !isMarker(current)) return;
      this.store.updateFeature({ ...clone(current), properties: { radii: current.properties.radii.filter((item) => item.id !== radius.id) } }, 'Delete marker radius', 'radius');
    });
    row.append(distance.wrapper, color.wrapper, remove);
    return row;
  }

  private renderTextInspector(container: HTMLElement, feature: Extract<ProjectFeature, { type: 'text' }>): void {
    const text = document.createElement('label');
    text.className = 'workspace-field workspace-field-full';
    text.textContent = 'Text';
    const input = document.createElement('textarea');
    input.value = feature.properties.text;
    input.rows = 2;
    input.addEventListener('change', () => this.updateFeature(feature.id, (next) => { if (isText(next)) { next.properties.text = input.value; next.name = input.value.trim() || next.name; } }, 'Edit text', 'content'));
    text.appendChild(input);
    container.appendChild(text);
    container.appendChild(this.colorField('Text color', feature.style.color, '#1f2937', (value) => this.updateStyle(feature.id, { color: value }, 'Edit text color')));
    container.appendChild(this.numberField('Rotation', feature.style.rotationDeg ?? 0, 'rotationDeg', (value) => this.updateStyle(feature.id, { rotationDeg: value }, 'Edit text rotation'), -360, 360));
    container.appendChild(this.numberField('Font size', feature.style.fontSizePx ?? 14, 'fontSizePx', (value) => this.updateStyle(feature.id, { fontSizePx: value }, 'Edit text font size'), 1, 100));
    container.appendChild(this.numberField('Font weight', feature.style.fontWeight ?? 600, 'fontWeight', (value) => this.updateStyle(feature.id, { fontWeight: value }, 'Edit text font weight'), 100, 900));
    container.appendChild(this.checkboxField('Halo', feature.style.halo ?? true, 'inspector-halo', (checked) => this.updateStyle(feature.id, { halo: checked }, 'Toggle text halo')));
  }

  private renderLineInspector(container: HTMLElement, feature: Exclude<ProjectFeature, { type: 'marker' | 'text' | 'circle' | 'polygon' | 'rectangle' }>): void {
    container.appendChild(this.colorField(feature.type === 'arrow' ? 'Arrow color' : 'Stroke color', feature.style.color, feature.type === 'arrow' ? '#10b981' : '#3388ff', (value) => this.updateStyle(feature.id, { color: value }, 'Edit stroke color')));
    container.appendChild(this.numberField('Weight', feature.style.weightPx ?? 4, 'weightPx', (value) => this.updateStyle(feature.id, { weightPx: value }, 'Edit stroke weight'), 0, 100));
    container.appendChild(this.numberField('Opacity', feature.style.opacity ?? 1, 'opacity', (value) => this.updateStyle(feature.id, { opacity: value }, 'Edit stroke opacity'), 0, 1, 0.05));
    const dash = this.textField('Dash pattern', feature.style.dashArray ?? '', 'inspector-dash', (value) => this.updateStyle(feature.id, { dashArray: value || null }, 'Edit dash pattern'));
    container.appendChild(dash);
    if (feature.type === 'arrow') {
      const semantic = document.createElement('p');
      semantic.className = 'workspace-help-text';
      semantic.textContent = 'Semantic arrow head: end';
      container.appendChild(semantic);
    }
  }

  private renderAreaInspector(container: HTMLElement, feature: Extract<ProjectFeature, { type: 'polygon' | 'rectangle' }>): void {
    container.appendChild(this.colorField('Stroke color', feature.style.color, '#f06eaa', (value) => this.updateStyle(feature.id, { color: value }, 'Edit stroke color')));
    container.appendChild(this.colorField('Fill color', feature.style.fillColor ?? feature.style.color, '#f06eaa', (value) => this.updateStyle(feature.id, { fillColor: value }, 'Edit fill color')));
    container.appendChild(this.numberField('Weight', feature.style.weightPx ?? 4, 'weightPx', (value) => this.updateStyle(feature.id, { weightPx: value }, 'Edit stroke weight'), 0, 100));
    container.appendChild(this.numberField('Fill opacity', feature.style.fillOpacity ?? 0.2, 'fillOpacity', (value) => this.updateStyle(feature.id, { fillOpacity: value }, 'Edit fill opacity'), 0, 1, 0.05));
  }

  private renderCircleInspector(container: HTMLElement, feature: Extract<ProjectFeature, { type: 'circle' }>): void {
    container.appendChild(this.numberField('Radius (m)', feature.geometry.radiusM, 'radiusM', (value) => this.updateFeature(feature.id, (next) => { if (next.type === 'circle') next.geometry.radiusM = value; }, 'Edit circle radius', 'geometry'), 0, 100000000));
    container.appendChild(this.colorField('Stroke color', feature.style.color, '#f59e0b', (value) => this.updateStyle(feature.id, { color: value }, 'Edit circle stroke')));
    container.appendChild(this.colorField('Fill color', feature.style.fillColor ?? feature.style.color, '#f59e0b', (value) => this.updateStyle(feature.id, { fillColor: value }, 'Edit circle fill')));
    container.appendChild(this.numberField('Weight', feature.style.weightPx ?? 4, 'weightPx', (value) => this.updateStyle(feature.id, { weightPx: value }, 'Edit circle weight'), 0, 100));
    container.appendChild(this.numberField('Fill opacity', feature.style.fillOpacity ?? 0.2, 'fillOpacity', (value) => this.updateStyle(feature.id, { fillOpacity: value }, 'Edit circle opacity'), 0, 1, 0.05));
  }

  private groupField(feature: ProjectFeature): HTMLElement {
    const label = document.createElement('label');
    label.className = 'workspace-field workspace-field-full';
    label.textContent = 'Group';
    const select = document.createElement('select');
    select.id = 'inspector-group';
    const ungrouped = document.createElement('option');
    ungrouped.value = '';
    ungrouped.textContent = 'Ungrouped';
    select.appendChild(ungrouped);
    this.store.getSnapshot().groups.sort((left, right) => left.order - right.order).forEach((group) => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      select.appendChild(option);
    });
    select.value = feature.groupId ?? '';
    select.addEventListener('change', () => this.updateFeature(feature.id, (next) => { next.groupId = select.value || null; }, 'Assign feature group', 'group'));
    label.appendChild(select);
    return label;
  }

  private textField(labelText: string, value: string, id: string, onChange: (value: string) => void): HTMLElement {
    const label = document.createElement('label');
    label.className = 'workspace-field workspace-field-full';
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.value = value;
    input.addEventListener('change', () => onChange(input.value));
    label.appendChild(input);
    return label;
  }

  private checkboxField(labelText: string, value: boolean, id: string, onChange: (checked: boolean) => void): HTMLElement {
    const label = document.createElement('label');
    label.className = 'workspace-check-field';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = value;
    input.addEventListener('change', () => onChange(input.checked));
    const text = document.createElement('span');
    text.textContent = labelText;
    label.append(input, text);
    return label;
  }

  private colorField(labelText: string, value: string | undefined, fallback: string, onChange: (value: string) => void): HTMLElement {
    const color = this.colorInput(labelText, colorOrDefault(value, fallback), `inspector-${labelText.toLocaleLowerCase().replaceAll(' ', '-')}`);
    color.input.addEventListener('change', () => onChange(color.input.value));
    return color.wrapper;
  }

  private colorInput(labelText: string, value: string, id: string): { wrapper: HTMLElement; input: HTMLInputElement } {
    const label = document.createElement('label');
    label.className = 'workspace-field';
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'color';
    input.id = id;
    input.value = colorOrDefault(value, '#3388ff');
    label.appendChild(input);
    return { wrapper: label, input };
  }

  private numberField(labelText: string, value: number, id: string, onChange: (value: number) => void, min: number, max: number, step = 1): HTMLElement {
    const field = this.numberInput(labelText, String(value), id, min, max, step);
    field.input.addEventListener('change', () => {
      const next = Number(field.input.value);
      if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
    });
    return field.wrapper;
  }

  private numberInput(labelText: string, value: string, id: string, min: number, max = 100000000, step = 1): { wrapper: HTMLElement; input: HTMLInputElement } {
    const label = document.createElement('label');
    label.className = 'workspace-field';
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.value = value;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    label.appendChild(input);
    return { wrapper: label, input };
  }

  private updateRadius(featureId: FeatureId, radiusId: string, update: (radius: RadiusRing) => void, label: string): void {
    const feature = this.findFeature(featureId);
    if (!feature || !isMarker(feature)) return;
    const next = clone(feature);
    const radius = next.properties.radii.find((item) => item.id === radiusId);
    if (!radius) return;
    update(radius);
    if (!Number.isFinite(radius.distanceM) || radius.distanceM < 0) return;
    this.store.updateFeature(next, label, 'radius');
  }

  private updateStyle(featureId: FeatureId, style: Partial<FeatureStyle>, label: string): void {
    this.updateFeature(featureId, (feature) => { feature.style = { ...feature.style, ...style }; }, label, 'style');
  }

  private updateFeature(featureId: FeatureId, update: (feature: ProjectFeature) => void, label: string, mutationKind: Parameters<typeof canMutateFeature>[2] = 'property'): void {
    const feature = this.findFeature(featureId);
    if (!feature) return;
    const next = clone(feature);
    update(next);
    this.store.updateFeature(next, label, mutationKind);
  }

  private updateGroup(groupId: string, update: (group: ProjectGroup) => void, label: string, mutationKind: 'visibility' | 'lock' | 'rename' | 'delete' | 'assignment'): void {
    if (!canMutateGroup(this.store.getSnapshot(), groupId, mutationKind)) return;
    this.store.mutate((draft) => {
      const group = draft.groups.find((candidate) => candidate.id === groupId);
      if (group) update(group);
    }, label);
  }

  private createGroup(): void {
    const name = window.prompt('Group name', 'New group')?.trim();
    if (!name) return;
    this.store.mutate((draft) => {
      const order = draft.groups.reduce((maximum, group) => Math.max(maximum, group.order), 0) + 10;
      draft.groups.push({ id: createId('group'), name, visible: true, locked: false, order });
    });
  }

  private renameGroup(groupId: string): void {
    const group = this.store.getSnapshot().groups.find((candidate) => candidate.id === groupId);
    if (!group) return;
    const name = window.prompt('Group name', group.name)?.trim();
    if (!name || name === group.name) return;
    this.updateGroup(groupId, (next) => { next.name = name; }, 'Rename group', 'rename');
  }

  private deleteGroup(groupId: string): void {
    if (!canMutateGroup(this.store.getSnapshot(), groupId, 'delete')) return;
    this.store.mutate((draft) => {
      draft.features.forEach((feature) => {
        if (feature.groupId === groupId) feature.groupId = null;
      });
      draft.groups = draft.groups.filter((group) => group.id !== groupId);
    }, 'Delete group (ungroup children)');
  }

  private matchesFilter(feature: ProjectFeature, groupName: string): boolean {
    if (!this.filter) return true;
    return `${feature.name} ${feature.type} ${groupName}`.toLocaleLowerCase().includes(this.filter);
  }

  private findFeature(featureId: FeatureId | null): ProjectFeature | null {
    if (!featureId) return null;
    return this.store.getSnapshot().features.find((feature) => feature.id === featureId) ?? null;
  }

  private scrollSelectedRowIntoView(featureId: FeatureId): void {
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-feature-id="${CSS.escape(featureId)}"]`)?.scrollIntoView({ block: 'nearest' }), 0);
  }

  private copyName(name: string, existingNames: string[]): string {
    const names = new Set(existingNames);
    const base = `${name} Copy`;
    if (!names.has(base)) return base;
    let index = 2;
    while (names.has(`${base} ${index}`)) index += 1;
    return `${base} ${index}`;
  }
}

type WorkspaceStateSnapshotLike = ReturnType<WorkspaceState['getSnapshot']>;
