import { createId, clone } from '../domain/project';
import type { Coordinate, ProjectFeature } from '../domain/model';
import { deserializeProject, normalizeProject, serializeProject } from '../persistence/projectSchema';
import { ProjectStore } from '../store/ProjectStore';
import type { DrawTool, DrawnFeatureDraft, DrawingAdapter } from '../drawing/DrawingAdapter';
import type { GeocodingService } from '../geocoding/GeocodingService';
import { exportMapToPng } from '../export/QuickPngExporter';
import type { FeatureAction, GeocodingPreview, MapRenderer } from '../map/renderer/MapRenderer';

type ColorPickerTarget =
  | { type: 'marker' }
  | { type: 'new-radius' }
  | { type: 'edit-radius'; radiusId: string }
  | { type: 'shape'; featureId: string };

type DeleteTarget = { featureId: string; kind: 'marker' | 'text' | 'shape' } | null;

function requiredElement<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as unknown as T;
}

function isTextFeature(feature: ProjectFeature): feature is Extract<ProjectFeature, { type: 'text' }> {
  return feature.type === 'text';
}

function isMarkerFeature(feature: ProjectFeature): feature is Extract<ProjectFeature, { type: 'marker' }> {
  return feature.type === 'marker';
}

function colorIsValid(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export class AppController {
  private readonly store: ProjectStore;
  private readonly renderer: MapRenderer;
  private drawing: DrawingAdapter;
  private readonly geocoder: GeocodingService;
  private readonly unsubscribeStore: () => void;
  private readonly unsubscribeMapClick: () => void;

  private markerToEditId: string | null = null;
  private shapeToEditId: string | null = null;
  private textToEditId: string | null = null;
  private deleteTarget: DeleteTarget = null;
  private selectedColor = '#2563eb';
  private radiusToEditId: string | null = null;
  private newRadiusColor = '#3388ff';
  private colorPickerTarget: ColorPickerTarget | null = null;
  private tempCoordinate: Coordinate | null = null;
  private isAddingText = false;
  private activeDrawTool: DrawTool | null = null;
  private areLabelsVisible = false;

  private readonly controlsContainer = requiredElement<HTMLElement>('controls-container');
  private readonly layerPanel = requiredElement<HTMLElement>('layer-panel');
  private readonly toggleLayersBtn = requiredElement<HTMLButtonElement>('toggle-layers-btn');
  private readonly layerOptionsContainer = requiredElement<HTMLElement>('layer-options');
  private readonly toolPanel = requiredElement<HTMLElement>('main-tool-panel');
  private readonly toggleToolPanelBtn = requiredElement<HTMLButtonElement>('toggle-tool-panel-btn');
  private readonly addPinBtn = requiredElement<HTMLButtonElement>('add-pin-btn');
  private readonly pinModal = requiredElement<HTMLElement>('pin-modal');
  private readonly savePinBtn = requiredElement<HTMLButtonElement>('save-pin-btn');
  private readonly cancelPinBtn = requiredElement<HTMLButtonElement>('cancel-pin-btn');
  private readonly deletePinBtn = requiredElement<HTMLButtonElement>('delete-pin-btn');
  private readonly pinLabelInput = requiredElement<HTMLInputElement>('pin-label-input');
  private readonly toggleLabelsBtn = requiredElement<HTMLButtonElement>('toggle-labels-btn');
  private readonly toggleLabelsIcon = requiredElement<SVGElement>('toggle-labels-icon');
  private readonly deleteAllBtn = requiredElement<HTMLButtonElement>('delete-all-btn');
  private readonly modalTitle = requiredElement<HTMLElement>('modal-title');
  private readonly markerColorSelector = requiredElement<HTMLElement>('marker-color-selector');
  private readonly radiusManagementSection = requiredElement<HTMLElement>('radius-management-section');
  private readonly deleteConfirmModal = requiredElement<HTMLElement>('delete-confirm-modal');
  private readonly cancelDeleteBtn = requiredElement<HTMLButtonElement>('cancel-delete-btn');
  private readonly confirmDeleteBtn = requiredElement<HTMLButtonElement>('confirm-delete-btn');
  private readonly deleteConfirmMessage = requiredElement<HTMLElement>('delete-confirm-message');
  private readonly deleteAllConfirmModal = requiredElement<HTMLElement>('delete-all-confirm-modal');
  private readonly cancelDeleteAllBtn = requiredElement<HTMLButtonElement>('cancel-delete-all-btn');
  private readonly confirmDeleteAllBtn = requiredElement<HTMLButtonElement>('confirm-delete-all-btn');
  private readonly manageRadiusBtn = requiredElement<HTMLButtonElement>('manage-radius-btn');
  private readonly radiusModal = requiredElement<HTMLElement>('radius-modal');
  private readonly radiusInput = requiredElement<HTMLInputElement>('radius-input');
  private readonly radiusColorSelector = requiredElement<HTMLElement>('radius-color-selector');
  private readonly addRadiusBtn = requiredElement<HTMLButtonElement>('add-radius-btn');
  private readonly radiusList = requiredElement<HTMLElement>('radius-list');
  private readonly closeRadiusModalBtn = requiredElement<HTMLButtonElement>('close-radius-modal-btn');
  private readonly radiusFormTitle = requiredElement<HTMLElement>('radius-form-title');
  private readonly cancelEditRadiusBtn = requiredElement<HTMLButtonElement>('cancel-edit-radius-btn');
  private readonly colorPickerModal = requiredElement<HTMLElement>('color-picker-modal');
  private readonly confirmColorBtn = requiredElement<HTMLButtonElement>('confirm-color-btn');
  private readonly cancelColorBtn = requiredElement<HTMLButtonElement>('cancel-color-btn');
  private readonly presetPalette = requiredElement<HTMLElement>('preset-palette');
  private readonly hexInput = requiredElement<HTMLInputElement>('hex-input');
  private readonly rInput = requiredElement<HTMLInputElement>('rgb-r-input');
  private readonly gInput = requiredElement<HTMLInputElement>('rgb-g-input');
  private readonly bInput = requiredElement<HTMLInputElement>('rgb-b-input');
  private readonly hInput = requiredElement<HTMLInputElement>('hsl-h-input');
  private readonly sInput = requiredElement<HTMLInputElement>('hsl-s-input');
  private readonly lInput = requiredElement<HTMLInputElement>('hsl-l-input');
  private readonly saveProjectBtn = requiredElement<HTMLButtonElement>('save-btn');
  private readonly openProjectBtn = requiredElement<HTMLButtonElement>('open-btn');
  private readonly fileInput = requiredElement<HTMLInputElement>('file-input');
  private readonly exportImageBtn = requiredElement<HTMLButtonElement>('export-image-btn');
  private readonly loadingOverlay = requiredElement<HTMLElement>('loading-overlay');
  private readonly toggleSearchBtn = requiredElement<HTMLButtonElement>('toggle-search-btn');
  private readonly searchPanel = requiredElement<HTMLElement>('search-panel');
  private readonly searchInput = requiredElement<HTMLInputElement>('search-input');
  private readonly performSearchBtn = requiredElement<HTMLButtonElement>('perform-search-btn');
  private readonly searchResults = requiredElement<HTMLElement>('search-results');
  private readonly drawPolylineBtn = requiredElement<HTMLButtonElement>('draw-polyline-btn');
  private readonly drawPolygonBtn = requiredElement<HTMLButtonElement>('draw-polygon-btn');
  private readonly drawCircleBtn = requiredElement<HTMLButtonElement>('draw-circle-btn');
  private readonly drawRectangleBtn = requiredElement<HTMLButtonElement>('draw-rectangle-btn');
  private readonly drawArrowBtn = requiredElement<HTMLButtonElement>('draw-arrow-btn');
  private readonly addTextBtn = requiredElement<HTMLButtonElement>('add-text-btn');
  private readonly textModal = requiredElement<HTMLElement>('text-modal');
  private readonly textModalTitle = requiredElement<HTMLElement>('text-modal-title');
  private readonly textLabelInput = requiredElement<HTMLInputElement>('text-label-input');
  private readonly saveTextBtn = requiredElement<HTMLButtonElement>('save-text-btn');
  private readonly cancelTextBtn = requiredElement<HTMLButtonElement>('cancel-text-btn');
  private readonly textActionsContainer = requiredElement<HTMLElement>('text-actions-container');
  private readonly newTextActionsContainer = requiredElement<HTMLElement>('new-text-actions-container');
  private readonly rotateTextBtn = requiredElement<HTMLButtonElement>('rotate-text-btn');
  private readonly deleteTextBtn = requiredElement<HTMLButtonElement>('delete-text-btn');
  private readonly cancelNewTextBtn = requiredElement<HTMLButtonElement>('cancel-new-text-btn');
  private readonly saveNewTextBtn = requiredElement<HTMLButtonElement>('save-new-text-btn');
  private readonly shapeEditModal = requiredElement<HTMLElement>('shape-edit-modal');
  private readonly shapeColorSelector = requiredElement<HTMLElement>('shape-color-selector');
  private readonly closeShapeEditBtn = requiredElement<HTMLButtonElement>('close-shape-edit-btn');
  private readonly rotateModal = requiredElement<HTMLElement>('rotate-modal');
  private readonly rotationSlider = requiredElement<HTMLInputElement>('rotation-slider');
  private readonly rotationValue = requiredElement<HTMLElement>('rotation-value');
  private readonly closeRotateModalBtn = requiredElement<HTMLButtonElement>('close-rotate-modal-btn');
  private readonly toggleInfoBtn = requiredElement<HTMLButtonElement>('toggle-info-btn');
  private readonly infoModal = requiredElement<HTMLElement>('info-modal');
  private readonly closeInfoBtn = requiredElement<HTMLButtonElement>('close-info-btn');

  constructor(store: ProjectStore, renderer: MapRenderer, drawing: DrawingAdapter, geocoder: GeocodingService) {
    this.store = store;
    this.renderer = renderer;
    this.drawing = drawing;
    this.geocoder = geocoder;
    this.unsubscribeStore = this.store.subscribe((snapshot) => this.renderer.renderProject(snapshot));
    this.unsubscribeMapClick = this.renderer.onMapClick((coordinate) => this.handleMapClick(coordinate));
    this.drawing.onCreated((draft) => this.handleDrawnFeature(draft));
    this.bindEvents();
    this.populateBasemaps();
    this.populatePalette();
    this.renderer.renderProject(this.store.getSnapshot());
  }

  setDrawingAdapter(drawing: DrawingAdapter): void {
    this.drawing.destroy();
    this.drawing = drawing;
    this.drawing.onCreated((draft) => this.handleDrawnFeature(draft));
  }

  destroy(): void {
    this.unsubscribeStore();
    this.unsubscribeMapClick();
    this.drawing.destroy();
  }

  captureProjectDocument() {
    const snapshot = this.store.getSnapshot();
    return normalizeProject(snapshot);
  }

  openMarkerEditor(featureId: string): void {
    const feature = this.findFeature(featureId);
    if (!feature || !isMarkerFeature(feature)) return;
    this.markerToEditId = featureId;
    this.modalTitle.textContent = 'แก้ไขหมุด';
    this.pinLabelInput.value = feature.name;
    this.selectedColor = feature.style.color ?? '#2563eb';
    this.setColorPreview(this.markerColorSelector, this.selectedColor);
    this.deletePinBtn.classList.remove('hidden');
    this.radiusManagementSection.classList.remove('hidden');
    this.pinModal.classList.remove('hidden');
    this.pinLabelInput.focus();
  }

  openTextEditor(featureId: string | null): void {
    this.textToEditId = featureId;
    const feature = featureId ? this.findFeature(featureId) : null;
    if (feature && !isTextFeature(feature)) return;
    this.textModalTitle.textContent = feature ? 'แก้ไขข้อความ' : 'เพิ่มข้อความ';
    this.textLabelInput.value = feature?.properties.text ?? '';
    this.textActionsContainer.classList.toggle('hidden', !feature);
    this.newTextActionsContainer.classList.toggle('hidden', Boolean(feature));
    this.textModal.classList.remove('hidden');
    this.textLabelInput.focus();
  }

  openShapeColorEditor(featureId: string): void {
    const feature = this.findFeature(featureId);
    if (!feature || feature.type === 'marker' || feature.type === 'text') return;
    this.shapeToEditId = featureId;
    this.setColorPreview(this.shapeColorSelector, feature.style.color ?? '#3388ff');
    this.shapeEditModal.classList.remove('hidden');
  }

  toggleShapeEdit(featureId: string): void {
    this.renderer.toggleFeatureEditable(featureId);
  }

  requestDelete(featureId: string): void {
    const feature = this.findFeature(featureId);
    if (!feature) return;
    const kind = feature.type === 'marker' ? 'marker' : feature.type === 'text' ? 'text' : 'shape';
    this.deleteTarget = { featureId, kind };
    this.deleteConfirmMessage.textContent = kind === 'marker' ? 'แน่ใจหรือไม่ว่าต้องการลบหมุดนี้?' : kind === 'text' ? 'แน่ใจหรือไม่ว่าต้องการลบข้อความนี้?' : 'แน่ใจหรือไม่ว่าต้องการลบรูปทรงนี้?';
    this.hideEditingModals();
    this.deleteConfirmModal.classList.remove('hidden');
  }

  handleRendererAction(action: FeatureAction, featureId: string): void {
    if (action === 'edit') {
      const feature = this.findFeature(featureId);
      if (!feature) return;
      if (feature.type === 'marker') this.openMarkerEditor(featureId);
      else if (feature.type === 'text') this.openTextEditor(featureId);
      else this.toggleShapeEdit(featureId);
    } else if (action === 'edit-style') this.openShapeColorEditor(featureId);
    else if (action === 'edit-radius') this.openRadiusEditor(featureId);
    else if (action === 'delete') this.requestDelete(featureId);
    else if (action === 'toggle-edit') this.toggleShapeEdit(featureId);
    else if (action === 'rotate') this.openRotationEditor(featureId);
  }

  addTestShape(type: DrawTool): void {
    const definitions: Record<DrawTool, DrawnFeatureDraft> = {
      polyline: { type: 'polyline', name: 'Polyline', geometry: { kind: 'lineString', coordinates: [[100.5, 13.75], [100.502, 13.751]] }, style: { color: '#3388ff', weightPx: 4 } },
      polygon: { type: 'polygon', name: 'Polygon', geometry: { kind: 'polygon', coordinates: [[100.5, 13.75], [100.5, 13.751], [100.502, 13.751]] }, style: { color: '#f06eaa', weightPx: 4, fillColor: '#f06eaa', fillOpacity: 0.2 } },
      rectangle: { type: 'rectangle', name: 'Rectangle', geometry: { kind: 'bounds', southWest: [100.5, 13.75], northEast: [100.503, 13.752] }, style: { color: '#8b5cf6', weightPx: 4, fillColor: '#8b5cf6', fillOpacity: 0.2 } },
      circle: { type: 'circle', name: 'Circle', geometry: { kind: 'circle', center: [100.5018, 13.7563], radiusM: 250 }, style: { color: '#f59e0b', weightPx: 4, fillColor: '#f59e0b', fillOpacity: 0.2 } },
      arrow: { type: 'arrow', name: 'Arrow', geometry: { kind: 'lineString', coordinates: [[100.5, 13.75], [100.502, 13.751]] }, style: { color: '#10b981', weightPx: 3, arrowHead: 'end' } }
    };
    this.handleDrawnFeature(definitions[type]);
  }

  private bindEvents(): void {
    this.toggleLayersBtn.addEventListener('click', () => this.togglePanel(this.layerPanel, [this.toolPanel, this.searchPanel]));
    this.toggleToolPanelBtn.addEventListener('click', () => this.togglePanel(this.toolPanel, [this.layerPanel, this.searchPanel]));
    this.toggleSearchBtn.addEventListener('click', () => this.togglePanel(this.searchPanel, [this.toolPanel, this.layerPanel]));
    this.addPinBtn.addEventListener('click', () => this.showCreateMarkerModal());
    this.cancelPinBtn.addEventListener('click', () => this.hideAllModals());
    this.toggleInfoBtn.addEventListener('click', () => this.infoModal.classList.remove('hidden'));
    this.closeInfoBtn.addEventListener('click', () => this.infoModal.classList.add('hidden'));
    this.savePinBtn.addEventListener('click', () => this.saveMarker());
    this.pinLabelInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') { event.preventDefault(); this.saveMarker(); } });
    this.manageRadiusBtn.addEventListener('click', () => this.openRadiusEditor(this.markerToEditId));
    this.closeRadiusModalBtn.addEventListener('click', () => this.hideAllModals());
    this.cancelEditRadiusBtn.addEventListener('click', () => this.resetRadiusForm());
    this.addRadiusBtn.addEventListener('click', () => this.saveRadius());
    this.radiusList.addEventListener('click', (event) => this.handleRadiusListClick(event));
    this.deletePinBtn.addEventListener('click', () => { if (this.markerToEditId) this.requestDelete(this.markerToEditId); });
    this.cancelDeleteBtn.addEventListener('click', () => this.hideAllModals());
    this.confirmDeleteBtn.addEventListener('click', () => this.confirmDelete());
    this.deleteAllBtn.addEventListener('click', () => { if (this.store.getSnapshot().features.length) this.deleteAllConfirmModal.classList.remove('hidden'); });
    this.cancelDeleteAllBtn.addEventListener('click', () => this.deleteAllConfirmModal.classList.add('hidden'));
    this.confirmDeleteAllBtn.addEventListener('click', () => this.confirmDeleteAll());
    this.toggleLabelsBtn.addEventListener('click', () => this.toggleLabels());
    this.markerColorSelector.addEventListener('click', () => this.showColorPicker(this.selectedColor, { type: 'marker' }));
    this.radiusColorSelector.addEventListener('click', () => this.showColorPicker(this.newRadiusColor, { type: 'new-radius' }));
    this.shapeColorSelector.addEventListener('click', () => {
      const feature = this.shapeToEditId ? this.findFeature(this.shapeToEditId) : null;
      this.showColorPicker(feature?.style.color ?? '#3388ff', this.shapeToEditId ? { type: 'shape', featureId: this.shapeToEditId } : null);
    });
    this.confirmColorBtn.addEventListener('click', () => this.confirmColor());
    this.cancelColorBtn.addEventListener('click', () => this.colorPickerModal.classList.add('hidden'));
    this.hexInput.addEventListener('change', () => this.setHexInput(this.hexInput.value));
    this.saveProjectBtn.addEventListener('click', () => this.saveProject());
    this.openProjectBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', () => this.openProjectFile());
    this.exportImageBtn.addEventListener('click', () => this.exportImage());
    this.performSearchBtn.addEventListener('click', () => this.performSearch());
    this.searchInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') this.performSearch(); });
    this.drawPolylineBtn.addEventListener('click', () => this.startDrawing('polyline'));
    this.drawPolygonBtn.addEventListener('click', () => this.startDrawing('polygon'));
    this.drawCircleBtn.addEventListener('click', () => this.startDrawing('circle'));
    this.drawRectangleBtn.addEventListener('click', () => this.startDrawing('rectangle'));
    this.drawArrowBtn.addEventListener('click', () => this.startDrawing('arrow'));
    this.addTextBtn.addEventListener('click', () => this.startTextCreation());
    this.cancelTextBtn.addEventListener('click', () => this.hideAllModals());
    this.cancelNewTextBtn.addEventListener('click', () => this.hideAllModals());
    this.saveTextBtn.addEventListener('click', () => this.saveText());
    this.saveNewTextBtn.addEventListener('click', () => this.saveText());
    this.deleteTextBtn.addEventListener('click', () => { if (this.textToEditId) this.requestDelete(this.textToEditId); });
    this.rotateTextBtn.addEventListener('click', () => { if (this.textToEditId) this.openRotationEditor(this.textToEditId); });
    this.rotationSlider.addEventListener('input', () => this.updateRotation());
    this.closeRotateModalBtn.addEventListener('click', () => this.rotateModal.classList.add('hidden'));
    this.closeShapeEditBtn.addEventListener('click', () => this.hideAllModals());
  }

  private togglePanel(panel: HTMLElement, others: HTMLElement[]): void {
    panel.classList.toggle('hidden');
    others.forEach((other) => other.classList.add('hidden'));
  }

  private populateBasemaps(): void {
    this.layerOptionsContainer.replaceChildren();
    this.renderer.getBasemapOptions().forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'w-full text-left p-2 rounded-md hover:bg-gray-100';
      button.textContent = option.label;
      button.addEventListener('click', () => {
        if (this.renderer.setBasemap(option.id)) {
          this.store.setMapView({ ...this.renderer.getView(), basemapId: option.id });
          this.layerPanel.classList.add('hidden');
        }
      });
      this.layerOptionsContainer.appendChild(button);
    });
  }

  private populatePalette(): void {
    const colors = ['#e11d48', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];
    this.presetPalette.replaceChildren();
    colors.forEach((color) => {
      const swatch = document.createElement('div');
      swatch.className = 'preset-swatch';
      swatch.dataset.color = color;
      swatch.style.backgroundColor = color;
      this.presetPalette.appendChild(swatch);
    });
    this.presetPalette.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('preset-swatch') && target.dataset.color) this.setHexInput(target.dataset.color);
    });
  }

  private showCreateMarkerModal(coordinate?: Coordinate): void {
    this.markerToEditId = null;
    this.tempCoordinate = coordinate ?? null;
    this.modalTitle.textContent = 'เพิ่มหมุดใหม่';
    this.pinLabelInput.value = '';
    this.radiusManagementSection.classList.add('hidden');
    this.selectedColor = '#2563eb';
    this.setColorPreview(this.markerColorSelector, this.selectedColor);
    this.deletePinBtn.classList.add('hidden');
    this.pinModal.classList.remove('hidden');
    this.pinLabelInput.focus();
  }

  private saveMarker(): void {
    const name = this.pinLabelInput.value.trim();
    if (!name) return;
    if (this.markerToEditId) {
      const feature = this.findFeature(this.markerToEditId);
      if (feature && isMarkerFeature(feature)) {
        const next = clone(feature);
        next.name = name;
        next.style = { ...next.style, color: this.selectedColor };
        this.store.updateFeature(next);
      }
    } else {
      const coordinate = this.tempCoordinate ?? this.renderer.getView().center;
      this.store.addFeature({ id: createId('feature'), type: 'marker', name, groupId: null, visible: true, locked: false, geometry: { kind: 'point', coordinates: coordinate }, style: { color: this.selectedColor, symbolId: 'pin' }, properties: { radii: [] } });
    }
    this.hideAllModals();
  }

  private openRadiusEditor(featureId: string | null): void {
    if (!featureId) return;
    const feature = this.findFeature(featureId);
    if (!feature || !isMarkerFeature(feature)) return;
    this.markerToEditId = featureId;
    this.pinModal.classList.add('hidden');
    this.resetRadiusForm();
    this.renderRadiusList();
    this.radiusModal.classList.remove('hidden');
  }

  private resetRadiusForm(): void {
    this.radiusToEditId = null;
    this.radiusInput.value = '';
    this.newRadiusColor = '#3388ff';
    this.setColorPreview(this.radiusColorSelector, this.newRadiusColor);
    this.radiusFormTitle.textContent = 'เพิ่มวงรัศมีใหม่';
    this.addRadiusBtn.textContent = 'เพิ่ม';
    this.cancelEditRadiusBtn.classList.add('hidden');
  }

  private renderRadiusList(): void {
    this.radiusList.replaceChildren();
    const feature = this.markerToEditId ? this.findFeature(this.markerToEditId) : null;
    if (!feature || !isMarkerFeature(feature)) return;
    feature.properties.radii.forEach((radius) => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between p-2 bg-gray-100 rounded-lg';
      const left = document.createElement('div');
      left.className = 'flex items-center space-x-3';
      const color = document.createElement('button');
      color.type = 'button';
      color.className = 'w-6 h-6 rounded border border-gray-300';
      color.style.backgroundColor = radius.color;
      color.dataset.id = radius.id;
      color.dataset.action = 'edit-color';
      const distance = document.createElement('span');
      distance.textContent = `${radius.distanceM.toLocaleString()} เมตร`;
      left.append(color, distance);
      const right = document.createElement('div');
      right.className = 'flex items-center space-x-3';
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'text-blue-600 hover:text-blue-800 font-semibold'; edit.textContent = 'แก้ไข'; edit.dataset.id = radius.id; edit.dataset.action = 'edit';
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'text-red-600 hover:text-red-800 font-semibold'; remove.textContent = 'ลบ'; remove.dataset.id = radius.id; remove.dataset.action = 'delete';
      right.append(edit, remove);
      item.append(left, right);
      this.radiusList.appendChild(item);
    });
  }

  private handleRadiusListClick(event: Event): void {
    const button = (event.target as HTMLElement).closest('button');
    if (!button?.dataset.id || !button.dataset.action) return;
    const feature = this.markerToEditId ? this.findFeature(this.markerToEditId) : null;
    if (!feature || !isMarkerFeature(feature)) return;
    const radius = feature.properties.radii.find((item) => item.id === button.dataset.id);
    if (button.dataset.action === 'delete') {
      this.store.updateFeature({ ...clone(feature), properties: { radii: feature.properties.radii.filter((item) => item.id !== button.dataset.id) } });
      this.renderRadiusList();
    } else if (button.dataset.action === 'edit' && radius) {
      this.radiusToEditId = radius.id;
      this.radiusInput.value = String(radius.distanceM);
      this.newRadiusColor = radius.color;
      this.setColorPreview(this.radiusColorSelector, this.newRadiusColor);
      this.radiusFormTitle.textContent = 'แก้ไขวงรัศมี';
      this.addRadiusBtn.textContent = 'บันทึก';
      this.cancelEditRadiusBtn.classList.remove('hidden');
    } else if (button.dataset.action === 'edit-color' && radius) {
      this.showColorPicker(radius.color, { type: 'edit-radius', radiusId: radius.id });
    }
  }

  private saveRadius(): void {
    const feature = this.markerToEditId ? this.findFeature(this.markerToEditId) : null;
    const distanceM = Number.parseFloat(this.radiusInput.value);
    if (!feature || !isMarkerFeature(feature) || !Number.isFinite(distanceM) || distanceM < 0) return;
    const next = clone(feature);
    if (this.radiusToEditId) {
      const radius = next.properties.radii.find((item) => item.id === this.radiusToEditId);
      if (radius) { radius.distanceM = distanceM; radius.color = this.newRadiusColor; }
    } else next.properties.radii.push({ id: createId('radius'), distanceM, color: this.newRadiusColor, fillOpacity: 0.2 });
    this.store.updateFeature(next);
    this.renderRadiusList();
    this.resetRadiusForm();
  }

  private showColorPicker(initialColor: string, target: ColorPickerTarget | null): void {
    if (!target) return;
    this.colorPickerTarget = target;
    this.setHexInput(initialColor);
    this.colorPickerModal.classList.remove('hidden');
  }

  private setHexInput(color: string): void {
    const next = colorIsValid(color) ? color : '#3388ff';
    this.hexInput.value = next;
    this.rInput.value = String(Number.parseInt(next.slice(1, 3), 16));
    this.gInput.value = String(Number.parseInt(next.slice(3, 5), 16));
    this.bInput.value = String(Number.parseInt(next.slice(5, 7), 16));
  }

  private confirmColor(): void {
    const color = this.hexInput.value.trim();
    if (!colorIsValid(color) || !this.colorPickerTarget) return;
    const target = this.colorPickerTarget;
    if (target.type === 'marker') {
      this.selectedColor = color;
      this.setColorPreview(this.markerColorSelector, color);
    } else if (target.type === 'new-radius') {
      this.newRadiusColor = color;
      this.setColorPreview(this.radiusColorSelector, color);
    } else if (target.type === 'edit-radius') {
      const feature = this.markerToEditId ? this.findFeature(this.markerToEditId) : null;
      if (feature && isMarkerFeature(feature)) {
        const next = clone(feature);
        const radius = next.properties.radii.find((item) => item.id === target.radiusId);
        if (radius) radius.color = color;
        this.store.updateFeature(next);
        this.renderRadiusList();
      }
    } else if (target.type === 'shape') {
      const feature = this.findFeature(target.featureId);
      if (feature && feature.type !== 'marker' && feature.type !== 'text') {
        const next = clone(feature);
        next.style = { ...next.style, color, fillColor: color };
        this.store.updateFeature(next);
        this.setColorPreview(this.shapeColorSelector, color);
      }
    }
    this.colorPickerModal.classList.add('hidden');
  }

  private setColorPreview(element: HTMLElement, color: string): void {
    element.style.backgroundColor = color;
  }

  private hideEditingModals(): void {
    this.pinModal.classList.add('hidden');
    this.radiusModal.classList.add('hidden');
    this.shapeEditModal.classList.add('hidden');
    this.textModal.classList.add('hidden');
    this.rotateModal.classList.add('hidden');
  }

  private hideAllModals(): void {
    this.hideEditingModals();
    this.colorPickerModal.classList.add('hidden');
    this.deleteConfirmModal.classList.add('hidden');
    this.deleteAllConfirmModal.classList.add('hidden');
    this.markerToEditId = null;
    this.shapeToEditId = null;
    this.textToEditId = null;
    this.deleteTarget = null;
  }

  private confirmDelete(): void {
    if (this.deleteTarget) this.store.removeFeature(this.deleteTarget.featureId);
    this.hideAllModals();
  }

  private confirmDeleteAll(): void {
    this.store.mutate((draft) => { draft.features = []; });
    this.renderer.selectFeature(null);
    this.deleteAllConfirmModal.classList.add('hidden');
  }

  private toggleLabels(): void {
    this.areLabelsVisible = !this.areLabelsVisible;
    this.renderer.setLabelsVisible(this.areLabelsVisible);
    this.toggleLabelsBtn.title = this.areLabelsVisible ? 'ซ่อนข้อความ' : 'แสดงข้อความ';
    this.toggleLabelsIcon.innerHTML = this.areLabelsVisible
      ? '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7z" />'
      : '<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />';
  }

  private saveProject(): void {
    const jsonString = serializeProject(this.captureProjectDocument());
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'map-project-v2.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    this.store.markSaved();
  }

  private openProjectFile(): void {
    const file = this.fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = deserializeProject(reader.result);
        this.store.replaceProject(result.document);
        if (result.warnings.length) console.warn('Project loaded with warnings:', result.warnings);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error loading project:', error);
        window.alert(`Project file is invalid or could not be read.\n${message}`);
      } finally {
        this.fileInput.value = '';
      }
    };
    reader.readAsText(file);
  }

  private async exportImage(): Promise<void> {
    this.loadingOverlay.classList.remove('hidden');
    this.controlsContainer.classList.add('hidden');
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
      await exportMapToPng(requiredElement<HTMLElement>('map'));
    } finally {
      this.loadingOverlay.classList.add('hidden');
      this.controlsContainer.classList.remove('hidden');
    }
  }

  private async performSearch(): Promise<void> {
    const query = this.searchInput.value.trim();
    if (!query) return;
    this.searchResults.textContent = 'กำลังค้นหา...';
    try {
      const results = await this.geocoder.search(query);
      if (!results.length) {
        this.searchResults.textContent = 'ไม่พบผลลัพธ์';
        return;
      }
      const result = results[0];
      this.searchResults.textContent = results.length > 1 ? `${results.length} ผลลัพธ์ — แสดงผลลัพธ์แรก` : '';
      const preview: GeocodingPreview = { label: result.label, coordinate: [result.lon, result.lat] };
      this.renderer.showSearchResult(preview, () => {
        this.store.addFeature({ id: createId('feature'), type: 'marker', name: result.label, groupId: null, visible: true, locked: false, geometry: { kind: 'point', coordinates: preview.coordinate }, style: { color: '#475569', symbolId: 'pin' }, properties: { radii: [] } });
        this.renderer.clearSearchResult();
      });
    } catch (error) {
      console.error('Search error:', error);
      this.searchResults.textContent = 'เกิดข้อผิดพลาดในการค้นหา';
    }
  }

  private startDrawing(tool: DrawTool): void {
    this.stopAllDrawing();
    this.activeDrawTool = tool;
    this.buttonForTool(tool).classList.add('active');
    this.drawing.start(tool);
    this.toolPanel.classList.add('hidden');
  }

  private startTextCreation(): void {
    this.stopAllDrawing();
    this.isAddingText = true;
    this.addTextBtn.classList.add('active');
    this.toolPanel.classList.add('hidden');
    document.getElementById('map')?.classList.add('cursor-text-tool');
  }

  private stopAllDrawing(): void {
    this.drawing.cancel();
    this.activeDrawTool = null;
    this.isAddingText = false;
    [this.drawPolylineBtn, this.drawPolygonBtn, this.drawCircleBtn, this.drawRectangleBtn, this.drawArrowBtn, this.addTextBtn].forEach((button) => button.classList.remove('active'));
    document.getElementById('map')?.classList.remove('cursor-text-tool');
  }

  private handleMapClick(coordinate: Coordinate): void {
    if (!this.isAddingText) return;
    this.tempCoordinate = coordinate;
    this.openTextEditor(null);
  }

  private handleDrawnFeature(draft: DrawnFeatureDraft): void {
    const feature = {
      id: createId('feature'),
      type: draft.type,
      name: draft.name,
      groupId: null,
      visible: true,
      locked: false,
      geometry: draft.geometry,
      style: draft.style,
      properties: {}
    } as ProjectFeature;
    this.store.addFeature(feature);
    this.stopAllDrawing();
  }

  private saveText(): void {
    const text = this.textLabelInput.value.trim();
    if (!text) return;
    if (this.textToEditId) {
      const feature = this.findFeature(this.textToEditId);
      if (feature && isTextFeature(feature)) {
        const next = clone(feature);
        next.name = text;
        next.properties.text = text;
        this.store.updateFeature(next);
      }
    } else {
      const coordinate = this.tempCoordinate ?? this.renderer.getView().center;
      this.store.addFeature({ id: createId('feature'), type: 'text', name: text, groupId: null, visible: true, locked: false, geometry: { kind: 'point', coordinates: coordinate }, style: { color: '#1f2937', fontSizePx: 14, fontWeight: 600, rotationDeg: 0, halo: true }, properties: { text } });
    }
    this.stopAllDrawing();
    this.hideAllModals();
  }

  private openRotationEditor(featureId: string): void {
    const feature = this.findFeature(featureId);
    if (!feature || !isTextFeature(feature)) return;
    this.textToEditId = featureId;
    const rotation = feature.style.rotationDeg ?? 0;
    this.rotationSlider.value = String(rotation);
    this.rotationValue.textContent = `${rotation}°`;
    this.rotateModal.classList.remove('hidden');
  }

  private updateRotation(): void {
    if (!this.textToEditId) return;
    const feature = this.findFeature(this.textToEditId);
    if (!feature || !isTextFeature(feature)) return;
    const rotation = Number(this.rotationSlider.value);
    this.rotationValue.textContent = `${rotation}°`;
    const next = clone(feature);
    next.style = { ...next.style, rotationDeg: rotation };
    this.store.updateFeature(next);
  }

  private findFeature(featureId: string | null): ProjectFeature | null {
    if (!featureId) return null;
    return this.store.getSnapshot().features.find((feature) => feature.id === featureId) ?? null;
  }

  private buttonForTool(tool: DrawTool): HTMLButtonElement {
    if (tool === 'polyline') return this.drawPolylineBtn;
    if (tool === 'polygon') return this.drawPolygonBtn;
    if (tool === 'circle') return this.drawCircleBtn;
    if (tool === 'rectangle') return this.drawRectangleBtn;
    return this.drawArrowBtn;
  }
}
