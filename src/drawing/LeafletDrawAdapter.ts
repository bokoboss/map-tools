import L from 'leaflet';
import type { Coordinate } from '../domain/model';
import type { DrawTool, DrawnFeatureDraft, DrawingAdapter } from './DrawingAdapter';
import type { LeafletRenderer } from '../map/leaflet/LeafletRenderer';

type DrawHandler = {
  enable(): void;
  disable(): void;
};

type CreatedEvent = {
  layerType: string;
  layer: L.Layer;
};

function fromLatLng(latlng: L.LatLng): Coordinate {
  return [Number(latlng.lng), Number(latlng.lat)];
}

function lineCoordinatesFromLayer(layer: L.Polyline): Coordinate[] {
  return (layer.getLatLngs() as L.LatLng[]).map(fromLatLng);
}

function polygonCoordinatesFromLayer(layer: L.Polygon): Coordinate[] {
  return ((layer.getLatLngs()[0] ?? []) as L.LatLng[]).map(fromLatLng);
}

export class LeafletDrawAdapter implements DrawingAdapter {
  private readonly map: L.Map;
  private readonly listeners = new Set<(draft: DrawnFeatureDraft) => void>();
  private activeHandler: DrawHandler | null = null;
  private activeTool: DrawTool | null = null;

  constructor(renderer: LeafletRenderer) {
    this.map = renderer.getMapForDrawing();
    this.map.on('draw:created', this.handleCreated as L.LeafletEventHandlerFn);
  }

  start(tool: DrawTool): void {
    this.cancel();
    this.activeTool = tool;
    const shapeOptions = this.shapeOptions(tool);
    let handler: DrawHandler;
    const drawMap = this.map as unknown as any;
    if (tool === 'polyline' || tool === 'arrow') handler = new L.Draw.Polyline(drawMap, { shapeOptions }) as unknown as DrawHandler;
    else if (tool === 'polygon') handler = new L.Draw.Polygon(drawMap, { allowIntersection: false, showArea: true, shapeOptions }) as unknown as DrawHandler;
    else if (tool === 'circle') handler = new L.Draw.Circle(drawMap, { shapeOptions }) as unknown as DrawHandler;
    else handler = new L.Draw.Rectangle(drawMap, { shapeOptions }) as unknown as DrawHandler;
    this.activeHandler = handler;
    handler.enable();
  }

  cancel(): void {
    this.activeHandler?.disable();
    this.activeHandler = null;
    this.activeTool = null;
  }

  onCreated(listener: (draft: DrawnFeatureDraft) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.cancel();
    this.map.off('draw:created', this.handleCreated as L.LeafletEventHandlerFn);
    this.listeners.clear();
  }

  private readonly handleCreated = (event: L.LeafletEvent): void => {
    const created = event as unknown as CreatedEvent;
    const tool = this.activeTool;
    if (!tool) return;
    const layer = created.layer;
    const draft = this.toDraft(tool, layer);
    this.listeners.forEach((listener) => listener(draft));
    this.cancel();
  };

  private shapeOptions(tool: DrawTool): L.PathOptions {
    if (tool === 'polygon') return { color: '#f06eaa', weight: 4, fillColor: '#f06eaa', fillOpacity: 0.2 };
    if (tool === 'circle') return { color: '#f59e0b', weight: 4, fillColor: '#f59e0b', fillOpacity: 0.2 };
    if (tool === 'rectangle') return { color: '#8b5cf6', weight: 4, fillColor: '#8b5cf6', fillOpacity: 0.2 };
    if (tool === 'arrow') return { color: '#10b981', weight: 3 };
    return { color: '#3388ff', weight: 4 };
  }

  private toDraft(tool: DrawTool, layer: L.Layer): DrawnFeatureDraft {
    const defaults = this.shapeOptions(tool);
    const style = {
      color: defaults.color,
      weightPx: defaults.weight,
      fillColor: defaults.fillColor,
      fillOpacity: defaults.fillOpacity,
      opacity: defaults.opacity
    };
    if (tool === 'circle' && layer instanceof L.Circle) {
      return { type: 'circle', name: 'Circle', geometry: { kind: 'circle', center: fromLatLng(layer.getLatLng()), radiusM: layer.getRadius() }, style };
    }
    if (tool === 'rectangle' && layer instanceof L.Rectangle) {
      const bounds = layer.getBounds();
      return { type: 'rectangle', name: 'Rectangle', geometry: { kind: 'bounds', southWest: fromLatLng(bounds.getSouthWest()), northEast: fromLatLng(bounds.getNorthEast()) }, style };
    }
    if (tool === 'polygon' && layer instanceof L.Polygon) {
      return { type: 'polygon', name: 'Polygon', geometry: { kind: 'polygon', coordinates: polygonCoordinatesFromLayer(layer) }, style };
    }
    const line = layer as L.Polyline;
    return { type: tool === 'arrow' ? 'arrow' : 'polyline', name: tool === 'arrow' ? 'Arrow' : 'Polyline', geometry: { kind: 'lineString', coordinates: lineCoordinatesFromLayer(line) }, style: tool === 'arrow' ? { ...style, arrowHead: 'end' } : style };
  }
}
