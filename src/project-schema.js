(function attachProjectSchema(root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.MapToolsSchema = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createProjectSchema() {
    'use strict';

    const SCHEMA_VERSION = 2;
    const MAX_FEATURES = 5000;
    const MAX_GROUPS = 500;
    const MAX_COORDINATES = 100000;
    const HEX_COLOR = /^#[0-9a-f]{6}$/i;
    let idCounter = 0;

    function createId(prefix) {
        const label = prefix || 'id';
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `${label}-${crypto.randomUUID()}`;
        }
        idCounter += 1;
        return `${label}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function equalCoordinate(a, b) {
        return Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1];
    }

    function validationError(errors, path, message) {
        errors.push(`${path}: ${message}`);
    }

    function finiteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function validateCoordinate(value, path, errors) {
        if (!Array.isArray(value) || value.length !== 2 || !finiteNumber(value[0]) || !finiteNumber(value[1])) {
            validationError(errors, path, 'expected [longitude, latitude] finite numbers');
            return null;
        }
        if (value[0] < -180 || value[0] > 180) validationError(errors, `${path}[0]`, 'longitude must be between -180 and 180');
        if (value[1] < -90 || value[1] > 90) validationError(errors, `${path}[1]`, 'latitude must be between -90 and 90');
        return [value[0], value[1]];
    }

    function validateColor(value, path, errors) {
        if (value !== undefined && (!('' + value).match(HEX_COLOR))) validationError(errors, path, 'expected a six-digit hex color');
        return value;
    }

    function validateStyle(style, path, errors) {
        if (!isObject(style)) {
            validationError(errors, path, 'expected an object');
            return {};
        }
        const result = clone(style);
        ['color', 'fillColor'].forEach((key) => validateColor(result[key], `${path}.${key}`, errors));
        ['opacity', 'fillOpacity'].forEach((key) => {
            if (result[key] !== undefined && (!finiteNumber(result[key]) || result[key] < 0 || result[key] > 1)) {
                validationError(errors, `${path}.${key}`, 'expected a number between 0 and 1');
            }
        });
        ['weightPx', 'fontSizePx'].forEach((key) => {
            if (result[key] !== undefined && (!finiteNumber(result[key]) || result[key] < 0 || result[key] > 100)) {
                validationError(errors, `${path}.${key}`, 'expected a finite number between 0 and 100');
            }
        });
        if (result.fontWeight !== undefined && (!Number.isInteger(result.fontWeight) || result.fontWeight < 100 || result.fontWeight > 900)) {
            validationError(errors, `${path}.fontWeight`, 'expected an integer between 100 and 900');
        }
        if (result.rotationDeg !== undefined && (!finiteNumber(result.rotationDeg) || result.rotationDeg < -360 || result.rotationDeg > 360)) {
            validationError(errors, `${path}.rotationDeg`, 'expected a finite number between -360 and 360');
        }
        if (result.dashArray !== undefined && result.dashArray !== null && typeof result.dashArray !== 'string') {
            validationError(errors, `${path}.dashArray`, 'expected a string or null');
        }
        if (result.arrowHead !== undefined && result.arrowHead !== 'end') validationError(errors, `${path}.arrowHead`, 'only end is supported');
        return result;
    }

    function validateIds(document, errors) {
        const ids = new Set();
        const add = (id, path) => {
            if (typeof id !== 'string' || id.length === 0) validationError(errors, path, 'expected a non-empty string ID');
            else if (ids.has(id)) validationError(errors, path, `duplicate ID ${id}`);
            else ids.add(id);
        };
        add(document.project && document.project.id, 'project.id');
        document.groups.forEach((group, index) => add(group.id, `groups[${index}].id`));
        document.features.forEach((feature, index) => add(feature.id, `features[${index}].id`));
        return ids;
    }

    function validateFeature(feature, index, groupIds, errors) {
        const path = `features[${index}]`;
        if (!isObject(feature)) {
            validationError(errors, path, 'expected an object');
            return null;
        }
        const result = clone(feature);
        if (typeof result.type !== 'string') validationError(errors, `${path}.type`, 'missing feature discriminator');
        if (typeof result.name !== 'string') validationError(errors, `${path}.name`, 'expected a string');
        if (result.groupId !== null && result.groupId !== undefined && !groupIds.has(result.groupId)) validationError(errors, `${path}.groupId`, 'does not reference an existing group');
        if (typeof result.visible !== 'boolean') validationError(errors, `${path}.visible`, 'expected boolean');
        if (typeof result.locked !== 'boolean') validationError(errors, `${path}.locked`, 'expected boolean');
        result.groupId = result.groupId === undefined ? null : result.groupId;
        const style = validateStyle(result.style, `${path}.style`, errors);
        result.style = style;
        if (!isObject(result.properties)) validationError(errors, `${path}.properties`, 'expected an object');
        result.properties = isObject(result.properties) ? result.properties : {};
        const geometry = result.geometry;
        if (!isObject(geometry)) {
            validationError(errors, `${path}.geometry`, 'expected an object');
            return result;
        }

        if (result.type === 'marker' || result.type === 'text') {
            if (geometry.kind !== 'point') validationError(errors, `${path}.geometry.kind`, 'expected point');
            result.geometry = { kind: 'point', coordinates: validateCoordinate(geometry.coordinates, `${path}.geometry.coordinates`, errors) || geometry.coordinates };
            if (result.type === 'marker') {
                if (!Array.isArray(result.properties.radii)) validationError(errors, `${path}.properties.radii`, 'expected an array');
                const radii = Array.isArray(result.properties.radii) ? result.properties.radii : [];
                const radiusIds = new Set();
                result.properties.radii = radii.map((radius, radiusIndex) => {
                    const radiusPath = `${path}.properties.radii[${radiusIndex}]`;
                    const item = isObject(radius) ? clone(radius) : {};
                    if (typeof item.id !== 'string' || !item.id) validationError(errors, `${radiusPath}.id`, 'expected a non-empty string ID');
                    else if (radiusIds.has(item.id)) validationError(errors, `${radiusPath}.id`, 'duplicate radius ID');
                    else radiusIds.add(item.id);
                    if (!finiteNumber(item.distanceM) || item.distanceM < 0) validationError(errors, `${radiusPath}.distanceM`, 'expected a non-negative finite number');
                    validateColor(item.color, `${radiusPath}.color`, errors);
                    if (!finiteNumber(item.fillOpacity) || item.fillOpacity < 0 || item.fillOpacity > 1) validationError(errors, `${radiusPath}.fillOpacity`, 'expected a number between 0 and 1');
                    return item;
                });
            } else {
                if (typeof result.properties.text !== 'string') validationError(errors, `${path}.properties.text`, 'expected plain text');
            }
        } else if (result.type === 'polyline' || result.type === 'arrow') {
            if (geometry.kind !== 'lineString' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) validationError(errors, `${path}.geometry`, 'expected a lineString with at least two coordinates');
            const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
            result.geometry = { kind: 'lineString', coordinates: coordinates.map((coordinate, coordinateIndex) => validateCoordinate(coordinate, `${path}.geometry.coordinates[${coordinateIndex}]`, errors) || coordinate) };
            if (result.type === 'arrow' && result.style.arrowHead === undefined) result.style.arrowHead = 'end';
        } else if (result.type === 'polygon') {
            if (geometry.kind !== 'polygon' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 3) validationError(errors, `${path}.geometry`, 'expected a polygon with at least three coordinates');
            let coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
            coordinates = coordinates.map((coordinate, coordinateIndex) => validateCoordinate(coordinate, `${path}.geometry.coordinates[${coordinateIndex}]`, errors) || coordinate);
            if (coordinates.length > 3 && equalCoordinate(coordinates[0], coordinates[coordinates.length - 1])) coordinates = coordinates.slice(0, -1);
            result.geometry = { kind: 'polygon', coordinates };
        } else if (result.type === 'rectangle') {
            if (geometry.kind !== 'bounds') validationError(errors, `${path}.geometry.kind`, 'expected bounds');
            const southWest = validateCoordinate(geometry.southWest, `${path}.geometry.southWest`, errors) || geometry.southWest;
            const northEast = validateCoordinate(geometry.northEast, `${path}.geometry.northEast`, errors) || geometry.northEast;
            result.geometry = { kind: 'bounds', southWest, northEast };
        } else if (result.type === 'circle') {
            if (geometry.kind !== 'circle') validationError(errors, `${path}.geometry.kind`, 'expected circle');
            const center = validateCoordinate(geometry.center, `${path}.geometry.center`, errors) || geometry.center;
            if (!finiteNumber(geometry.radiusM) || geometry.radiusM < 0) validationError(errors, `${path}.geometry.radiusM`, 'expected a non-negative finite number');
            result.geometry = { kind: 'circle', center, radiusM: geometry.radiusM };
        } else {
            validationError(errors, `${path}.type`, `unsupported feature type ${result.type}`);
        }
        return result;
    }

    function validateProject(input) {
        const errors = [];
        if (!isObject(input)) return { valid: false, errors: ['document: expected an object'], warnings: [] };
        const document = clone(input);
        if (document.schemaVersion !== SCHEMA_VERSION) validationError(errors, 'schemaVersion', `expected ${SCHEMA_VERSION}`);
        if (!isObject(document.app) || typeof document.app.name !== 'string' || typeof document.app.version !== 'string') validationError(errors, 'app', 'expected name and version');
        if (!isObject(document.project)) validationError(errors, 'project', 'expected an object');
        if (isObject(document.project)) {
            ['id', 'name', 'createdAt', 'updatedAt'].forEach((key) => { if (typeof document.project[key] !== 'string' || !document.project[key]) validationError(errors, `project.${key}`, 'expected a non-empty string'); });
            ['createdAt', 'updatedAt'].forEach((key) => { if (typeof document.project[key] === 'string' && Number.isNaN(Date.parse(document.project[key]))) validationError(errors, `project.${key}`, 'expected an ISO-8601 timestamp'); });
        }
        if (!isObject(document.mapView)) validationError(errors, 'mapView', 'expected an object');
        if (isObject(document.mapView)) {
            document.mapView.center = validateCoordinate(document.mapView.center, 'mapView.center', errors) || document.mapView.center;
            if (!finiteNumber(document.mapView.zoom) || document.mapView.zoom < 0 || document.mapView.zoom > 24) validationError(errors, 'mapView.zoom', 'expected a number between 0 and 24');
            if (typeof document.mapView.basemapId !== 'string' || !document.mapView.basemapId) validationError(errors, 'mapView.basemapId', 'expected a non-empty string');
        }
        if (!Array.isArray(document.groups) || document.groups.length > MAX_GROUPS) validationError(errors, 'groups', `expected an array with at most ${MAX_GROUPS} items`);
        if (!Array.isArray(document.features) || document.features.length > MAX_FEATURES) validationError(errors, 'features', `expected an array with at most ${MAX_FEATURES} items`);
        document.groups = Array.isArray(document.groups) ? document.groups : [];
        document.features = Array.isArray(document.features) ? document.features : [];
        const groupIds = new Set();
        document.groups = document.groups.map((group, index) => {
            const path = `groups[${index}]`;
            const item = isObject(group) ? clone(group) : {};
            if (typeof item.id !== 'string' || !item.id) validationError(errors, `${path}.id`, 'expected a non-empty string ID');
            else if (groupIds.has(item.id)) validationError(errors, `${path}.id`, 'duplicate group ID');
            else groupIds.add(item.id);
            if (typeof item.name !== 'string') validationError(errors, `${path}.name`, 'expected a string');
            if (typeof item.visible !== 'boolean') validationError(errors, `${path}.visible`, 'expected boolean');
            if (typeof item.locked !== 'boolean') validationError(errors, `${path}.locked`, 'expected boolean');
            if (!Number.isInteger(item.order)) validationError(errors, `${path}.order`, 'expected an integer');
            return item;
        });
        validateIds(document, errors);
        document.features = document.features.map((feature, index) => validateFeature(feature, index, groupIds, errors));
        const coordinateCount = JSON.stringify(document).match(/\[/g)?.length || 0;
        if (coordinateCount > MAX_COORDINATES) validationError(errors, 'document', `too many nested arrays (limit ${MAX_COORDINATES})`);
        return { valid: errors.length === 0, value: document, errors, warnings: [] };
    }

    function createEmptyProject(options) {
        const now = new Date().toISOString();
        const settings = options || {};
        return {
            schemaVersion: SCHEMA_VERSION,
            app: { name: 'map-tools', version: settings.appVersion || '2.x' },
            project: { id: settings.projectId || createId('project'), name: settings.name || 'Untitled Map', createdAt: now, updatedAt: now },
            mapView: { center: settings.center || [100.5018, 13.7563], zoom: settings.zoom === undefined ? 13 : settings.zoom, basemapId: settings.basemapId || 'osm-standard' },
            groups: [],
            features: []
        };
    }

    function normalizeProject(input) {
        const result = validateProject(input);
        if (!result.valid) throw new Error(`Invalid Project Schema v2:\n${result.errors.join('\n')}`);
        return result.value;
    }

    function serializeProject(input) {
        return JSON.stringify(normalizeProject(input), null, 2);
    }

    function legacyCoordinate(value) {
        if (Array.isArray(value)) return [Number(value[1]), Number(value[0])];
        if (isObject(value) && finiteNumber(Number(value.lat)) && finiteNumber(Number(value.lng ?? value.lon))) return [Number(value.lng ?? value.lon), Number(value.lat)];
        return value;
    }

    function legacyStyle(properties, fallbackColor) {
        const style = isObject(properties && properties.style) ? clone(properties.style) : {};
        style.color = style.color || fallbackColor;
        if (style.fillColor === undefined && properties && properties.fillColor) style.fillColor = properties.fillColor;
        if (style.weightPx === undefined && style.weight !== undefined) style.weightPx = style.weight;
        if (style.fillOpacity === undefined && style.fillOpacity !== undefined) style.fillOpacity = style.fillOpacity;
        return style;
    }

    function migrateV1(input) {
        if (!isObject(input) || (!Array.isArray(input.markers) && !isObject(input.drawnShapes))) throw new Error('Unsupported project file: expected Project Schema v2 or the known v1 shape');
        const document = createEmptyProject({ name: 'Migrated v1 Map' });
        const warnings = [];
        (input.markers || []).forEach((marker, index) => {
            const coordinate = legacyCoordinate(marker.latlng || marker.position);
            const radii = Array.isArray(marker.radii) ? marker.radii.map((radius) => ({ id: createId('radius'), distanceM: Number(radius.distance ?? radius.distanceM), color: radius.color || '#3388ff', fillOpacity: radius.fillOpacity === undefined ? 0.2 : Number(radius.fillOpacity) })) : [];
            document.features.push({ id: createId('feature'), type: 'marker', name: String(marker.labelText || `Marker ${index + 1}`), groupId: null, visible: true, locked: false, geometry: { kind: 'point', coordinates: coordinate }, style: { color: marker.markerColor || '#2563eb', symbolId: 'pin' }, properties: { radii } });
        });
        const featureCollection = input.drawnShapes;
        const features = featureCollection && featureCollection.type === 'FeatureCollection' ? featureCollection.features : [];
        features.forEach((feature, index) => {
            const geometry = feature && feature.geometry;
            const properties = isObject(feature && feature.properties) ? feature.properties : {};
            if (!geometry) { warnings.push(`drawnShapes[${index}] has no geometry and was skipped`); return; }
            const style = legacyStyle(properties, geometry.type === 'Polygon' ? '#f06eaa' : '#3388ff');
            const common = { id: createId('feature'), name: String(properties.name || `Migrated ${geometry.type}`), groupId: null, visible: true, locked: false, style, properties: {} };
            if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) document.features.push({ ...common, type: 'polyline', geometry: { kind: 'lineString', coordinates: geometry.coordinates } });
            else if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates && geometry.coordinates[0])) document.features.push({ ...common, type: 'polygon', geometry: { kind: 'polygon', coordinates: geometry.coordinates[0] } });
            else if (geometry.type === 'Point' && properties.radius !== undefined) document.features.push({ ...common, type: 'circle', geometry: { kind: 'circle', center: geometry.coordinates, radiusM: Number(properties.radius) } });
            else if (geometry.type === 'Point') warnings.push(`drawnShapes[${index}] point semantics were ambiguous and were not invented`);
            else warnings.push(`drawnShapes[${index}] geometry ${geometry.type} was not recoverable and was skipped`);
        });
        return { document: normalizeProject(document), warnings };
    }

    function deserializeProject(input) {
        let value;
        try { value = typeof input === 'string' ? JSON.parse(input) : clone(input); }
        catch (error) { throw new Error(`Invalid project JSON: ${error.message}`); }
        if (value && value.schemaVersion === SCHEMA_VERSION) return { document: normalizeProject(value), warnings: [] };
        if (value && value.schemaVersion !== undefined) throw new Error(`Unsupported project schema version: ${value.schemaVersion}`);
        return migrateV1(value);
    }

    function effectiveState(feature, group) {
        return { visible: Boolean(feature.visible && (!group || group.visible)), locked: Boolean(feature.locked || (group && group.locked)) };
    }

    return { SCHEMA_VERSION, createId, clone, createEmptyProject, validateProject, normalizeProject, serializeProject, deserializeProject, migrateV1, effectiveState };
});
