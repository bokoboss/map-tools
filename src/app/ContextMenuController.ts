import type { Coordinate, ProjectDocumentV2, ProjectFeature } from '../domain/model';
import { effectiveState } from '../domain/project';
import type { GeocodingService } from '../geocoding/GeocodingService';
import type { FeatureAction, MapContextRequest } from '../map/renderer/MapRenderer';

export interface ContextMenuCallbacks {
  getProject(): ProjectDocumentV2;
  onAddMarker(coordinate: Coordinate): void;
  onFeatureAction(action: FeatureAction, featureId: string): void;
  onSelectFeature(featureId: string): void;
}

/** Transient, renderer-neutral context menu state and UI. */
export class ContextMenuController {
  private readonly menu: HTMLElement;
  private readonly geocoder: GeocodingService;
  private readonly callbacks: ContextMenuCallbacks;
  private currentRequest: MapContextRequest | null = null;
  private requestGeneration = 0;

  private readonly reposition = (): void => {
    if (this.currentRequest) this.position(this.currentRequest.clientPoint);
  };

  constructor(menu: HTMLElement, geocoder: GeocodingService, callbacks: ContextMenuCallbacks) {
    this.menu = menu;
    this.geocoder = geocoder;
    this.callbacks = callbacks;
    this.menu.addEventListener('click', (event) => event.stopPropagation());
    window.addEventListener('resize', this.reposition);
    window.addEventListener('scroll', this.reposition, true);
  }

  open(request: MapContextRequest): void {
    this.close();
    this.currentRequest = request;
    this.menu.replaceChildren();

    if (request.featureId) {
      const feature = this.callbacks.getProject().features.find((candidate) => candidate.id === request.featureId);
      if (!feature) {
        this.close();
        return;
      }
      this.callbacks.onSelectFeature(feature.id);
      this.renderFeatureMenu(feature);
    } else {
      this.renderBackgroundMenu(request.coordinate);
    }

    this.menu.classList.remove('hidden');
    this.position(request.clientPoint);
    this.focusFirstAction();
  }

  close(): void {
    this.requestGeneration += 1;
    this.currentRequest = null;
    this.menu.classList.add('hidden');
    this.menu.replaceChildren();
  }

  isOpen(): boolean {
    return this.currentRequest !== null && !this.menu.classList.contains('hidden');
  }

  destroy(): void {
    this.close();
    window.removeEventListener('resize', this.reposition);
    window.removeEventListener('scroll', this.reposition, true);
  }

  private renderBackgroundMenu(coordinate: Coordinate): void {
    const add = this.actionButton('Add marker here', () => this.callbacks.onAddMarker(coordinate));
    add.dataset.contextAction = 'add-marker';
    this.menu.appendChild(add);
    this.menu.appendChild(this.separator());
    this.menu.appendChild(this.info(`Longitude: ${coordinate[0].toFixed(6)}`));
    this.menu.appendChild(this.info(`Latitude: ${coordinate[1].toFixed(6)}`));
    const address = this.info('Looking up address...');
    address.dataset.contextStatus = 'reverse-geocode';
    this.menu.appendChild(address);

    const generation = this.requestGeneration;
    void this.geocoder.reverse(coordinate).then((result) => {
      if (!this.isCurrent(generation) || !address.isConnected) return;
      address.textContent = result?.label ? `Address: ${result.label}` : 'Address unavailable';
    }).catch(() => {
      if (!this.isCurrent(generation) || !address.isConnected) return;
      address.textContent = 'Address unavailable';
    });
  }

  private renderFeatureMenu(feature: ProjectFeature): void {
    const project = this.callbacks.getProject();
    const group = feature.groupId ? project.groups.find((candidate) => candidate.id === feature.groupId) : null;
    const locked = effectiveState(feature, group).locked;
    const title = this.info(feature.name);
    title.classList.add('context-menu-title');
    this.menu.appendChild(title);
    if (locked) {
      const lockStatus = this.info('Locked - editing actions are disabled');
      lockStatus.classList.add('context-menu-locked');
      this.menu.appendChild(lockStatus);
      this.menu.appendChild(this.separator());
    }

    if (feature.type === 'marker') {
      this.appendFeatureAction('Edit marker', 'edit', feature.id, locked);
      this.appendFeatureAction('Manage radii', 'edit-radius', feature.id, locked);
      this.appendFeatureAction('Delete marker', 'delete', feature.id, locked);
    } else if (feature.type === 'text') {
      this.appendFeatureAction('Edit text', 'edit', feature.id, locked);
      this.appendFeatureAction('Rotate text', 'rotate', feature.id, locked);
      this.appendFeatureAction('Delete text', 'delete', feature.id, locked);
    } else {
      this.appendFeatureAction('Edit geometry', 'toggle-edit', feature.id, locked);
      this.appendFeatureAction('Edit style/color', 'edit-style', feature.id, locked);
      this.appendFeatureAction('Delete object', 'delete', feature.id, locked);
    }
  }

  private appendFeatureAction(label: string, action: FeatureAction, featureId: string, disabled: boolean): void {
    const button = this.actionButton(label, () => this.callbacks.onFeatureAction(action, featureId), disabled);
    button.dataset.contextAction = action;
    this.menu.appendChild(button);
  }

  private actionButton(label: string, action: () => void, disabled = false): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'menuitem';
    button.className = 'context-menu-action';
    button.textContent = label;
    button.disabled = disabled;
    button.setAttribute('aria-disabled', String(disabled));
    button.addEventListener('click', () => {
      if (button.disabled) return;
      action();
      this.close();
    });
    return button;
  }

  private info(text: string): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'context-menu-info';
    item.textContent = text;
    return item;
  }

  private separator(): HTMLHRElement {
    return document.createElement('hr');
  }

  private focusFirstAction(): void {
    const first = this.menu.querySelector<HTMLButtonElement>('button:not(:disabled)');
    (first ?? this.menu).focus();
  }

  private position(point: { x: number; y: number }): void {
    const margin = 8;
    const width = this.menu.offsetWidth;
    const height = this.menu.offsetHeight;
    const left = Math.max(margin, Math.min(point.x, window.innerWidth - width - margin));
    const top = Math.max(margin, Math.min(point.y, window.innerHeight - height - margin));
    this.menu.style.left = `${left}px`;
    this.menu.style.top = `${top}px`;
  }

  private isCurrent(generation: number): boolean {
    return generation === this.requestGeneration && this.isOpen();
  }
}
