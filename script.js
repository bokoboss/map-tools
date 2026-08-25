// --- Map Initialization ---
const map = L.map('map', { closePopupOnClick: false, zoomControl: false, drawControl: false }).setView([13.7563, 100.5018], 13);
L.control.zoom({ position: 'bottomright' }).addTo(map);

const canvasRenderer = L.canvas();

// --- Base Map Layers ---
const baseMaps = {
    "แผนที่ปกติ": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }),
    "ภาพถ่ายดาวเทียม": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' }),
    "ภาพถ่ายดาวเทียม (Hybrid)": L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri'
        }),
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO',
            pane: 'shadowPane'
        })
    ]),
    "แผนที่ภูมิประเทศ": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    }),
    "แผนที่ Humanitarian (HOT)": L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a> hosted by <a href="https://openstreetmap.fr/" target="_blank">OpenStreetMap France</a>'
    }),
    "แบบสบายตา (สว่าง)": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: '© CARTO' }),
    "แบบสบายตา (มืด)": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: '© CARTO' })
};
let currentLayer = baseMaps["แผนที่ปกติ"];
currentLayer.addTo(map);
const basemapIdOrder = ['osm-standard', 'esri-imagery', 'esri-hybrid', 'opentopomap', 'osm-hot', 'carto-light', 'carto-dark'];
const basemapNames = Object.keys(baseMaps);
const basemapIdByName = Object.fromEntries(basemapNames.map((name, index) => [name, basemapIdOrder[index] || `basemap-${index + 1}`]));
const basemapNameById = Object.fromEntries(Object.entries(basemapIdByName).map(([name, id]) => [id, name]));

// --- App State ---
let markers = [];
let markerToEdit = null;
let itemToDelete = null; // Can be { type: 'marker', ... } or { type: 'shape', ... }
let shapeToEdit = null; 
let selectedColor = '#2563eb';
let radiusToEditId = null;
let newRadiusColor = '#3388ff';
let colorPickerInstance = null;
let colorPickerTarget = null;
let searchResultMarker = null;
let areLabelsVisible = false;
let activeProject = MapToolsSchema.createEmptyProject({ name: 'Untitled Map' });
const presetColors = ['#e11d48', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];
let isAddingText = false;
let textMarkerToEdit = null;
let tempPinLatLng = null;

// Layer group to store all drawn items (polygons, polylines)
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);
const transientSearchLayer = L.layerGroup().addTo(map);

// --- Get DOM Elements ---
const getEl = (id) => document.getElementById(id);
const controlsContainer = getEl('controls-container');
const layerPanel = getEl('layer-panel'), toggleLayersBtn = getEl('toggle-layers-btn'), layerOptionsContainer = getEl('layer-options');
const toolPanel = getEl('main-tool-panel'), toggleToolPanelBtn = getEl('toggle-tool-panel-btn');
const addPinBtn = getEl('add-pin-btn'), pinModal = getEl('pin-modal'), savePinBtn = getEl('save-pin-btn');
const cancelPinBtn = getEl('cancel-pin-btn'), deletePinBtn = getEl('delete-pin-btn'), pinLabelInput = getEl('pin-label-input');
const toggleLabelsBtn = getEl('toggle-labels-btn'), toggleLabelsIcon = getEl('toggle-labels-icon'), deleteAllBtn = getEl('delete-all-btn');
const modalTitle = getEl('modal-title'), markerColorSelector = getEl('marker-color-selector');
const radiusManagementSection = getEl('radius-management-section');
const deleteConfirmModal = getEl('delete-confirm-modal'), cancelDeleteBtn = getEl('cancel-delete-btn'), confirmDeleteBtn = getEl('confirm-delete-btn');
const deleteConfirmMessage = getEl('delete-confirm-message');
const deleteAllConfirmModal = getEl('delete-all-confirm-modal'), cancelDeleteAllBtn = getEl('cancel-delete-all-btn'), confirmDeleteAllBtn = getEl('confirm-delete-all-btn');
const manageRadiusBtn = getEl('manage-radius-btn'), radiusModal = getEl('radius-modal'), radiusInput = getEl('radius-input');
const radiusColorSelector = getEl('radius-color-selector'), addRadiusBtn = getEl('add-radius-btn'), radiusList = getEl('radius-list');
const closeRadiusModalBtn = getEl('close-radius-modal-btn'), radiusFormTitle = getEl('radius-form-title'), cancelEditRadiusBtn = getEl('cancel-edit-radius-btn');
const colorPickerModal = getEl('color-picker-modal'), confirmColorBtn = getEl('confirm-color-btn'), cancelColorBtn = getEl('cancel-color-btn');
const presetPalette = getEl('preset-palette');
const hexInput = getEl('hex-input'), rInput = getEl('rgb-r-input'), gInput = getEl('rgb-g-input'), bInput = getEl('rgb-b-input');
const hInput = getEl('hsl-h-input'), sInput = getEl('hsl-s-input'), lInput = getEl('hsl-l-input');
const saveProjectBtn = getEl('save-btn'), openProjectBtn = getEl('open-btn'), fileInput = getEl('file-input');
const exportImageBtn = getEl('export-image-btn'), loadingOverlay = getEl('loading-overlay');
const toggleSearchBtn = getEl('toggle-search-btn'), searchPanel = getEl('search-panel'), searchInput = getEl('search-input');
const performSearchBtn = getEl('perform-search-btn'), searchResults = getEl('search-results');
const drawPolylineBtn = getEl('draw-polyline-btn'), drawPolygonBtn = getEl('draw-polygon-btn'), drawCircleBtn = getEl('draw-circle-btn');
const drawRectangleBtn = getEl('draw-rectangle-btn'), drawArrowBtn = getEl('draw-arrow-btn'), addTextBtn = getEl('add-text-btn');
const textModal = getEl('text-modal'), textModalTitle = getEl('text-modal-title'), textLabelInput = getEl('text-label-input');
const saveTextBtn = getEl('save-text-btn'), cancelTextBtn = getEl('cancel-text-btn');
const shapeEditModal = getEl('shape-edit-modal');
const shapeColorSelector = getEl('shape-color-selector');
const closeShapeEditBtn = getEl('close-shape-edit-btn');
const textActionsContainer = getEl('text-actions-container'), newTextActionsContainer = getEl('new-text-actions-container');
const rotateTextBtn = getEl('rotate-text-btn'), deleteTextBtn = getEl('delete-text-btn');
const cancelNewTextBtn = getEl('cancel-new-text-btn'), saveNewTextBtn = getEl('save-new-text-btn');
const rotateModal = getEl('rotate-modal'), rotationSlider = getEl('rotation-slider');
const rotationValue = getEl('rotation-value'), closeRotateModalBtn = getEl('close-rotate-modal-btn');
const contextMenu = getEl('context-menu');
const toggleInfoBtn = getEl('toggle-info-btn'), infoModal = getEl('info-modal'), closeInfoBtn = getEl('close-info-btn');


// --- Helper Functions ---
function createMarkerIcon(color) {
    const svg = `<div class="custom-marker-icon"><svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.596 0 0 5.596 0 12.5 0 19.404 12.5 41 12.5 41S25 19.404 25 12.5C25 5.596 19.404 0 12.5 0z" fill="${color}"/><circle cx="12.5" cy="12.5" r="4.5" fill="white"/></svg></div>`;
    return L.divIcon({ html: svg, className: '', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -36] });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function createTextIcon(text, rotation) {
    const safeRotation = Number.isFinite(Number(rotation)) ? Number(rotation) : 0;
    return L.divIcon({
        className: 'text-label-icon',
        html: `<div style="transform: rotate(${safeRotation}deg);">${escapeHtml(text)}</div>`
    });
}

function createPopupContent(marker) {
    const markerId = L.Util.stamp(marker);
    const container = document.createElement('div');
    container.className = 'editable-popup-text';
    const label = document.createElement('b');
    label.textContent = marker.labelText || '';
    container.appendChild(label);
    container.addEventListener('dblclick', () => window.startEdit(markerId));
    return container;
}

function formatArea(area) {
    const rai = Math.floor(area / 1600);
    const ngan = Math.floor((area % 1600) / 400);
    const wa = ((area % 400) / 4).toFixed(2);
    let text = `<b>${area.toLocaleString(undefined, {maximumFractionDigits: 2})} ตร.ม.</b><br>`;
    if (area >= 4) {
         text += `(${rai} ไร่ ${ngan} งาน ${wa} ตร.วา)`;
    }
    return text;
}

function formatDistance(latlngs) {
    let totalDistance = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
        totalDistance += map.distance(latlngs[i], latlngs[i + 1]);
    }
    return totalDistance > 1000
        ? `<b>ระยะทาง:</b> ${(totalDistance / 1000).toFixed(2)} กม.`
        : `<b>ระยะทาง:</b> ${totalDistance.toFixed(0)} เมตร`;
}

window.startEdit = function(markerId) {
    markerToEdit = markers.find(m => L.Util.stamp(m) === markerId);
    if (markerToEdit) {
        modalTitle.innerText = "แก้ไขหมุด";
        pinLabelInput.value = markerToEdit.labelText;
        selectedColor = markerToEdit.markerColor;
        markerColorSelector.style.backgroundColor = selectedColor;
        deletePinBtn.classList.remove('hidden');
        radiusManagementSection.classList.remove('hidden');
        pinModal.classList.remove('hidden');
        pinLabelInput.focus();
    }
}

// --- Radius Functions ---
function drawCirclesForMarker(marker) {
    const latlng = marker.getLatLng();
    marker.circleLayerGroup.clearLayers();
    marker.radii.forEach(radius => {
        L.circle(latlng, {
            renderer: canvasRenderer,
            radius: radius.distance,
            color: radius.color,
            fillColor: radius.color,
            fillOpacity: 0.2
        }).addTo(marker.circleLayerGroup);
    });
}

function renderRadiusList() {
    radiusList.innerHTML = '';
    if (!markerToEdit) return;
    markerToEdit.radii.forEach(radius => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-2 bg-gray-100 rounded-lg';
        item.innerHTML = `
            <div class="flex items-center space-x-3">
                <button class="w-6 h-6 rounded border border-gray-300" style="background-color: ${radius.color};" data-id="${radius.id}" data-action="edit-color"></button>
                <span>${radius.distance.toLocaleString()} เมตร</span>
            </div>
            <div class="flex items-center space-x-3">
                <button class="text-blue-600 hover:text-blue-800 font-semibold" data-id="${radius.id}" data-action="edit">แก้ไข</button>
                <button class="text-red-600 hover:text-red-800 font-semibold" data-id="${radius.id}" data-action="delete">ลบ</button>
            </div>
        `;
        radiusList.appendChild(item);
    });
}

function resetRadiusForm() {
    radiusToEditId = null;
    radiusInput.value = '';
    newRadiusColor = '#3388ff';
    radiusColorSelector.style.backgroundColor = newRadiusColor;
    radiusFormTitle.innerText = 'เพิ่มวงรัศมีใหม่';
    addRadiusBtn.innerText = 'เพิ่ม';
    cancelEditRadiusBtn.classList.add('hidden');
}

// --- Modal Logic ---
function showCreateModal(latlng) {
    markerToEdit = null;
    tempPinLatLng = latlng || null;
    modalTitle.innerText = "เพิ่มหมุดใหม่";
    pinLabelInput.value = '';
    radiusManagementSection.classList.add('hidden');
    selectedColor = '#2563eb';
    markerColorSelector.style.backgroundColor = selectedColor;
    deletePinBtn.classList.add('hidden');
    pinModal.classList.remove('hidden');
    pinLabelInput.focus();
}

function hideAllModals() {
    pinModal.classList.add('hidden');
    radiusModal.classList.add('hidden');
    colorPickerModal.classList.add('hidden');
    shapeEditModal.classList.add('hidden');
    deleteConfirmModal.classList.add('hidden');
    textModal.classList.add('hidden');
    rotateModal.classList.add('hidden');
    infoModal.classList.add('hidden');
    markerToEdit = null;
    shapeToEdit = null;
    itemToDelete = null;
    textMarkerToEdit = null;
}

// --- Event Listeners ---
toggleLayersBtn.addEventListener('click', () => { layerPanel.classList.toggle('hidden'); toolPanel.classList.add('hidden'); searchPanel.classList.add('hidden'); });
toggleToolPanelBtn.addEventListener('click', () => { toolPanel.classList.toggle('hidden'); layerPanel.classList.add('hidden'); searchPanel.classList.add('hidden'); });
toggleSearchBtn.addEventListener('click', () => { searchPanel.classList.toggle('hidden'); toolPanel.classList.add('hidden'); layerPanel.classList.add('hidden'); });

// *** BUG FIX HERE ***
// Call showCreateModal without passing the event object
addPinBtn.addEventListener('click', () => showCreateModal());

cancelPinBtn.addEventListener('click', hideAllModals);
toggleInfoBtn.addEventListener('click', () => infoModal.classList.remove('hidden'));
closeInfoBtn.addEventListener('click', () => infoModal.classList.add('hidden'));

savePinBtn.addEventListener('click', function() {
    const labelText = pinLabelInput.value.trim();
    if (!labelText) return;

    if (markerToEdit) {
        // Editing an existing marker
        markerToEdit.labelText = labelText;
        markerToEdit.projectName = labelText;
        markerToEdit.markerColor = selectedColor;
        markerToEdit.setIcon(createMarkerIcon(selectedColor));
        markerToEdit.setPopupContent(createPopupContent(markerToEdit));
    } else {
        // Creating a new marker
        createMarkerFromData({
            labelText: labelText,
            markerColor: selectedColor,
            latlng: tempPinLatLng || map.getCenter(), // Fallback to map center if no latlng is provided
            radii: []
        });
    }
    hideAllModals();
});

// --- Radius Modal Logic ---
manageRadiusBtn.addEventListener('click', () => {
    pinModal.classList.add('hidden');
    resetRadiusForm();
    renderRadiusList();
    radiusModal.classList.remove('hidden');
});

closeRadiusModalBtn.addEventListener('click', () => { radiusModal.classList.add('hidden'); markerToEdit = null; });
cancelEditRadiusBtn.addEventListener('click', resetRadiusForm);

addRadiusBtn.addEventListener('click', () => {
    const distance = parseFloat(radiusInput.value);
    if (!markerToEdit || !(distance >= 0)) return;

    if (radiusToEditId) {
        const radius = markerToEdit.radii.find(r => r.id === radiusToEditId);
        if (radius) {
            radius.distance = distance;
            radius.color = newRadiusColor;
        }
    } else {
        markerToEdit.radii.push({ id: Date.now(), distance: distance, color: newRadiusColor });
    }
    drawCirclesForMarker(markerToEdit);
    renderRadiusList();
    resetRadiusForm();
});

radiusList.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    const id = parseInt(button.dataset.id, 10);
    const action = button.dataset.action;
    const radius = markerToEdit.radii.find(r => r.id === id);

    if (action === 'delete') {
        markerToEdit.radii = markerToEdit.radii.filter(r => r.id !== id);
        drawCirclesForMarker(markerToEdit);
        renderRadiusList();
    } else if (action === 'edit') {
        if (radius) {
            radiusToEditId = id;
            radiusInput.value = radius.distance;
            newRadiusColor = radius.color;
            radiusColorSelector.style.backgroundColor = newRadiusColor;
            radiusFormTitle.innerText = 'แก้ไขวงรัศมี';
            addRadiusBtn.innerText = 'บันทึก';
            cancelEditRadiusBtn.classList.remove('hidden');
        }
    } else if (action === 'edit-color') {
        showColorPicker(radius.color, { type: 'edit-radius', id: id });
    }
});

// --- Deletion Logic ---
deletePinBtn.addEventListener('click', () => {
    if (markerToEdit) {
        itemToDelete = { type: 'marker', marker: markerToEdit };
        deleteConfirmMessage.innerText = 'คุณแน่ใจหรือไม่ว่าต้องการลบหมุดนี้?';
        pinModal.classList.add('hidden');
        deleteConfirmModal.classList.remove('hidden');
    }
});
cancelDeleteBtn.addEventListener('click', () => {
    if (itemToDelete && itemToDelete.type === 'marker') {
        pinModal.classList.remove('hidden');
    }
    hideAllModals();
});
confirmDeleteBtn.addEventListener('click', () => {
    if (!itemToDelete) return;

    if (itemToDelete.type === 'marker') {
        const marker = itemToDelete.marker;
        map.removeLayer(marker.circleLayerGroup);
        map.removeLayer(marker);
        const index = markers.findIndex(m => L.Util.stamp(m) === L.Util.stamp(marker));
        if (index > -1) markers.splice(index, 1);
    } else if (itemToDelete.type === 'shape') {
        drawnItems.removeLayer(itemToDelete.layer);
    }
    hideAllModals();
});

deleteAllBtn.addEventListener('click', () => { 
    if (markers.length > 0 || drawnItems.getLayers().length > 0) {
        deleteAllConfirmModal.classList.remove('hidden');
    }
});
cancelDeleteAllBtn.addEventListener('click', () => deleteAllConfirmModal.classList.add('hidden'));

function clearMap() {
     markers.forEach(marker => {
        map.removeLayer(marker.circleLayerGroup);
        map.removeLayer(marker);
    });
    markers.length = 0;
    drawnItems.clearLayers();
    transientSearchLayer.clearLayers();
    searchResultMarker = null;
}
confirmDeleteAllBtn.addEventListener('click', () => {
    clearMap();
    deleteAllConfirmModal.classList.add('hidden');
});

pinLabelInput.addEventListener('keyup', e => { if (e.key === 'Enter') { e.preventDefault(); savePinBtn.click(); } });

toggleLabelsBtn.addEventListener('click', () => {
    areLabelsVisible = !areLabelsVisible;
    if (areLabelsVisible) {
        markers.forEach(marker => marker.openPopup());
        toggleLabelsIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />`;
        toggleLabelsBtn.title = "ซ่อนข้อความ";
    } else {
        markers.forEach(marker => marker.closePopup());
        toggleLabelsIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />`;
        toggleLabelsBtn.title = "แสดงข้อความ";
    }
});

// --- Color Picker Logic ---
function showColorPicker(initialColor, target) {
    colorPickerTarget = target;
    colorPickerInstance.color.set(initialColor);
    colorPickerModal.classList.remove('hidden');
}
markerColorSelector.addEventListener('click', () => showColorPicker(selectedColor, { type: 'marker' }));
radiusColorSelector.addEventListener('click', () => showColorPicker(newRadiusColor, { type: 'new-radius' }));
shapeColorSelector.addEventListener('click', () => {
    let initialColor = '#3388ff'; // A default fallback color
    if (shapeToEdit) {
        if (shapeToEdit.isArrow) {
            const line = shapeToEdit.getLayers().find(l => l instanceof L.Polyline);
            if (line) {
                initialColor = line.options.color;
            }
        } else {
            initialColor = shapeToEdit.options.color;
        }
    }
    showColorPicker(initialColor, { type: 'shape' });
});

cancelColorBtn.addEventListener('click', () => colorPickerModal.classList.add('hidden'));
confirmColorBtn.addEventListener('click', () => {
    const newColor = colorPickerInstance.color.hexString;
    if (colorPickerTarget.type === 'marker') {
        selectedColor = newColor;
        markerColorSelector.style.backgroundColor = newColor;
    } else if (colorPickerTarget.type === 'new-radius') {
        newRadiusColor = newColor;
        radiusColorSelector.style.backgroundColor = newColor;
    } else if (colorPickerTarget.type === 'edit-radius') {
         const radius = markerToEdit.radii.find(r => r.id === colorPickerTarget.id);
         if (radius) {
             radius.color = newColor;
             renderRadiusList();
             drawCirclesForMarker(markerToEdit);
         }
    } else if (colorPickerTarget.type === 'shape' && shapeToEdit) {
        if (shapeToEdit.isArrow) {
            const line = shapeToEdit.getLayers().find(l => l instanceof L.Polyline);
            const head = shapeToEdit.getLayers().find(l => l instanceof L.Marker);
            line.setStyle({ color: newColor });
            const newIcon = L.divIcon({
                className: 'arrow-head',
                html: head.getIcon().options.html.replace(/fill="[^"]*"/, `fill="${newColor}"`),
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            head.setIcon(newIcon);
        } else {
            shapeToEdit.setStyle({ color: newColor, fillColor: newColor });
        }
        shapeColorSelector.style.backgroundColor = newColor;
    }
    colorPickerModal.classList.add('hidden');
});

// --- Shape Edit Modal Logic ---
closeShapeEditBtn.addEventListener('click', hideAllModals);

function openShapeEditModal(layer) {
    shapeToEdit = layer;
    if (layer.isArrow) {
        const line = layer.getLayers().find(l => l instanceof L.Polyline);
        shapeColorSelector.style.backgroundColor = line.options.color;
    } else {
        shapeColorSelector.style.backgroundColor = layer.options.color;
    }
    shapeEditModal.classList.remove('hidden');
}

// --- Popup Content and Interaction ---
window.openShapeColorEditorById = function(layerId) {
    const layer = drawnItems.getLayer(layerId);
    if (layer) {
        map.closePopup();
        openShapeEditModal(layer);
    }
}

window.toggleShapeEditById = function(layerId) {
    const layer = drawnItems.getLayer(layerId);
    if (!layer) return;

    const targetLayer = layer.isArrow ? layer.getLayers().find(l => l instanceof L.Polyline) : layer;
    if (!targetLayer || !targetLayer.editing) return;
    
    layer.closePopup();

    if (targetLayer.editing.enabled()) {
        targetLayer.editing.disable();
    } else {
        drawnItems.eachLayer(l => {
            const tl = l.isArrow ? l.getLayers().find(i => i instanceof L.Polyline) : l;
            if (tl && tl.editing && tl.editing.enabled()) {
                tl.editing.disable();
            }
        });
        targetLayer.editing.enable();
    }
}

window.confirmDeleteShapeById = function(layerId) {
    const layer = drawnItems.getLayer(layerId);
    if (layer) {
        itemToDelete = { type: 'shape', layer: layer };
        deleteConfirmMessage.innerText = 'คุณแน่ใจหรือไม่ว่าต้องการลบรูปทรงนี้?';
        map.closePopup();
        deleteConfirmModal.classList.remove('hidden');
    }
}

function createShapePopupContent(layer) {
    const layerId = L.Util.stamp(layer);
    let mainContent = '';
    let targetLayer = layer.isArrow ? layer.getLayers().find(l => l instanceof L.Polyline) : layer;

    if (targetLayer instanceof L.Polygon) {
        const area = L.GeometryUtil.geodesicArea(targetLayer.getLatLngs()[0]);
        mainContent = formatArea(area);
    } else if (targetLayer instanceof L.Polyline) {
        mainContent = formatDistance(targetLayer.getLatLngs());
    } else if (targetLayer instanceof L.Circle) {
        const radius = targetLayer.getRadius();
        const area = Math.PI * Math.pow(radius, 2);
        mainContent = `<b>รัศมี:</b> ${radius.toFixed(2)} ม.<br>${formatArea(area)}`;
    }

    const isEditing = targetLayer.editing && targetLayer.editing.enabled();
    const editButtonSVG = isEditing
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>`;
    const editButtonTitle = isEditing ? 'บันทึกการแก้ไข' : 'แก้ไขรูปทรง';

    return `
        <div class="space-y-2">
            <div>${mainContent}</div>
            <hr class="my-1 border-t border-gray-200">
            <div class="flex items-center justify-around">
                <button class="p-2 rounded-full hover:bg-gray-200 text-gray-600" title="${editButtonTitle}" onclick="toggleShapeEditById(${layerId})">
                    ${editButtonSVG}
                </button>
                <button class="p-2 rounded-full hover:bg-gray-200 text-blue-600" title="แก้ไขสี" onclick="openShapeColorEditorById(${layerId})">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
                </button>
                <button class="p-2 rounded-full hover:bg-gray-200 text-red-600" title="ลบรูปทรง" onclick="confirmDeleteShapeById(${layerId})">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </div>
    `;
}

function bindShapePopup(layer) {
    layer.unbindPopup();
    layer.bindPopup(() => createShapePopupContent(layer), {
        autoClose: true,
        closeOnClick: true
    });

    const targetLayer = layer.isArrow ? layer.getLayers().find(l => l instanceof L.Polyline) : layer;

    targetLayer.off('click');
    targetLayer.on('click', function(e) {
        L.DomEvent.stop(e);
        if (layer.isPopupOpen()) {
            layer.closePopup();
        } else {
            layer.openPopup(e.latlng);
        }
    });
    
    if (targetLayer.editing) {
        targetLayer.on('edit:enabled', function () {
            layer.closePopup();
            if (this instanceof L.Circle) {
                this._editTooltip = L.tooltip({ permanent: true, className: 'leaflet-draw-tooltip' }).addTo(map);
                
                this._updateTooltipOnMove = (e) => {
                    const latlng = e.latlng;
                    const center = this.getLatLng();
                    const radius = center.distanceTo(latlng);
                    this._editTooltip.setLatLng(latlng).setContent(`รัศมี: ${radius.toFixed(2)} ม.`);
                };
                
                map.on('mousemove', this._updateTooltipOnMove);
            }
            if(layer.getPopup()){
                layer.setPopupContent(createShapePopupContent(layer));
            }
        });

        targetLayer.on('edit', function() {
            if (layer.isPopupOpen()) {
                layer.setPopupContent(createShapePopupContent(layer));
            }
            if (layer.isArrow) {
                // Update arrowhead position and rotation
                const line = layer.getLayers().find(l => l instanceof L.Polyline);
                const head = layer.getLayers().find(l => l instanceof L.Marker);
                const latlngs = line.getLatLngs();
                if (latlngs.length < 2) return;
                
                head.setLatLng(latlngs[latlngs.length - 1]);
                const p1 = map.latLngToContainerPoint(latlngs[latlngs.length - 2]);
                const p2 = map.latLngToContainerPoint(latlngs[latlngs.length - 1]);
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
                const newIcon = L.divIcon({
                    className: 'arrow-head',
                    html: `<div style="transform: rotate(${angle + 90}deg); transform-origin: center center;">${head.getIcon().options.html.match(/<svg[\s\S]*<\/svg>/)[0]}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                head.setIcon(newIcon);
            }
        });

        targetLayer.on('edit:disabled', function () {
            if (this._editTooltip) {
                map.removeLayer(this._editTooltip);
                this._editTooltip = null;
            }
            if (this._updateTooltipOnMove) {
                map.off('mousemove', this._updateTooltipOnMove);
                this._updateTooltipOnMove = null;
            }
            layer.bindPopup(() => createShapePopupContent(layer));
        });
    }
}

// --- Context Menu Logic ---
function showContextMenu(point, menuItems) {
    contextMenu.innerHTML = '';
    menuItems.forEach(item => {
        if (item.isSeparator) {
            contextMenu.appendChild(document.createElement('hr'));
        } else if (item.isInfo) {
            const div = document.createElement('div');
            div.className = 'info-item';
            div.innerHTML = item.text;
            contextMenu.appendChild(div);
        } else {
            const link = document.createElement('a');
            link.innerText = item.text;
            link.onclick = () => {
                hideContextMenu();
                item.callback();
            };
            contextMenu.appendChild(link);
        }
    });

    contextMenu.style.left = `${point.x}px`;
    contextMenu.style.top = `${point.y}px`;
    contextMenu.classList.remove('hidden');
}

function hideContextMenu() {
    contextMenu.classList.add('hidden');
}

map.on('click', hideContextMenu);
map.on('contextmenu', function(e) {
    e.originalEvent.preventDefault();
    hideAllModals();
    
    const lat = e.latlng.lat.toFixed(6);
    const lon = e.latlng.lng.toFixed(6);

    const menuItems = [
        { text: 'เพิ่มหมุดที่นี่', callback: () => showCreateModal(e.latlng) },
        { isSeparator: true },
        { text: `พิกัด: ${lat}, ${lon}`, isInfo: true },
        { text: '<i>กำลังค้นหาที่อยู่...</i>', isInfo: true, id: 'address-info' }
    ];
    
    showContextMenu(e.containerPoint, menuItems);

    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${e.latlng.lat}&lon=${e.latlng.lng}&accept-language=th`)
        .then(response => response.ok ? response.json() : Promise.reject('Network response was not ok'))
        .then(data => {
            const addressItem = contextMenu.querySelector('.info-item:last-child');
            if (addressItem) {
                addressItem.textContent = data.display_name || 'ไม่พบข้อมูลที่อยู่';
            }
        })
        .catch(error => {
            const addressItem = contextMenu.querySelector('.info-item:last-child');
            if (addressItem) {
                addressItem.textContent = 'เกิดข้อผิดพลาดในการค้นหา';
            }
        });
});

function addLayerContextMenu(layer) {
    layer.on('contextmenu', function(e) {
        L.DomEvent.stop(e);
        hideContextMenu();
        const menuItems = [];
        const layerId = L.Util.stamp(layer);

        if (layer.isTextLabel) {
            menuItems.push({ text: 'แก้ไขข้อความ', callback: () => {
                textMarkerToEdit = layer;
                textModalTitle.innerText = "แก้ไขข้อความ";
                textLabelInput.value = layer.labelText;
                textActionsContainer.classList.remove('hidden');
                newTextActionsContainer.classList.add('hidden');
                textModal.classList.remove('hidden');
                textLabelInput.focus();
            }});
            menuItems.push({ text: 'หมุนข้อความ', callback: () => {
                textMarkerToEdit = layer;
                rotationSlider.value = layer.rotation || 0;
                rotationValue.innerText = `${rotationSlider.value}°`;
                rotateModal.classList.remove('hidden');
            }});
            menuItems.push({ isSeparator: true });
            menuItems.push({ text: 'ลบข้อความ', callback: () => confirmDeleteShapeById(layerId) });
        } else if (layer.isArrow) {
            menuItems.push({ text: 'แก้ไขรูปทรง', callback: () => toggleShapeEditById(layerId) });
            menuItems.push({ text: 'แก้ไขสี', callback: () => openShapeColorEditorById(layerId) });
            menuItems.push({ isSeparator: true });
            menuItems.push({ text: 'ลบลูกศร', callback: () => confirmDeleteShapeById(layerId) });
        } else if (layer instanceof L.Marker) {
            menuItems.push({ text: 'แก้ไขหมุด', callback: () => startEdit(layerId) });
            menuItems.push({ text: 'จัดการรัศมี', callback: () => {
                markerToEdit = layer;
                resetRadiusForm();
                renderRadiusList();
                radiusModal.classList.remove('hidden');
            }});
            menuItems.push({ isSeparator: true });
            menuItems.push({ text: 'ลบหมุด', callback: () => {
                itemToDelete = { type: 'marker', marker: layer };
                deleteConfirmMessage.innerText = 'คุณแน่ใจหรือไม่ว่าต้องการลบหมุดนี้?';
                deleteConfirmModal.classList.remove('hidden');
            }});
        } else { // Other shapes
            menuItems.push({ text: 'แก้ไขรูปทรง', callback: () => toggleShapeEditById(layerId) });
            menuItems.push({ text: 'แก้ไขสี', callback: () => openShapeColorEditorById(layerId) });
            menuItems.push({ isSeparator: true });
            menuItems.push({ text: 'ลบรูปทรง', callback: () => confirmDeleteShapeById(layerId) });
        }
        showContextMenu(e.containerPoint, menuItems);
    });
}


// --- Save/Load/Export Logic ---
function createMarkerFromData(data) {
    const transient = Boolean(data.transient);
    const targetGroup = transient ? transientSearchLayer : map;
    const newMarker = L.marker(data.latlng, { draggable: true, icon: createMarkerIcon(data.markerColor || '#2563eb') }).addTo(targetGroup);
    newMarker.projectFeatureId = data.id || MapToolsSchema.createId('feature');
    newMarker.projectName = data.name || data.labelText || 'Marker';
    newMarker.labelText = data.labelText || data.name || '';
    newMarker.markerColor = data.markerColor || '#2563eb';
    newMarker.radii = data.radii || [];
    newMarker.circleLayerGroup = L.layerGroup().addTo(targetGroup);
    newMarker.bindPopup(createPopupContent(newMarker), { autoClose: false, closeButton: false });
    
    newMarker.on('dragstart', e => e.target.closePopup());
    newMarker.on('drag', e => drawCirclesForMarker(e.target));
    
    addLayerContextMenu(newMarker);
    drawCirclesForMarker(newMarker);
    if (!transient) markers.push(newMarker);
    return newMarker;
}

function toCoordinate(latlng) {
    return [Number(latlng.lng), Number(latlng.lat)];
}

function toLatLng(coordinate) {
    return [coordinate[1], coordinate[0]];
}

function toLatLngs(coordinates) {
    return coordinates.map(toLatLng);
}

function styleFromLayer(layer, defaults) {
    const options = layer.options || {};
    const style = { ...(defaults || {}) };
    if (options.color !== undefined) style.color = options.color;
    if (options.fillColor !== undefined && options.fillColor !== null) style.fillColor = options.fillColor;
    if (options.weight !== undefined) style.weightPx = options.weight;
    if (options.opacity !== undefined) style.opacity = options.opacity;
    if (options.fillOpacity !== undefined) style.fillOpacity = options.fillOpacity;
    return style;
}

function featureCommon(layer, type, name, style, properties) {
    return {
        id: layer.projectFeatureId || MapToolsSchema.createId('feature'),
        type,
        name: layer.projectName || name,
        groupId: null,
        visible: true,
        locked: false,
        geometry: null,
        style,
        properties: properties || {}
    };
}

function featureFromMarker(marker) {
    const feature = featureCommon(marker, 'marker', marker.labelText || 'Marker', { color: marker.markerColor, symbolId: 'pin' }, {
        radii: (marker.radii || []).map(radius => ({
            id: String(radius.id || MapToolsSchema.createId('radius')),
            distanceM: Number(radius.distanceM ?? radius.distance),
            color: radius.color,
            fillOpacity: radius.fillOpacity === undefined ? 0.2 : Number(radius.fillOpacity)
        }))
    });
    feature.geometry = { kind: 'point', coordinates: toCoordinate(marker.getLatLng()) };
    return feature;
}

function featureFromLayer(layer) {
    if (layer.isTextLabel) {
        const feature = featureCommon(layer, 'text', layer.labelText || 'Text', { color: '#1f2937', fontSizePx: 14, fontWeight: 600, rotationDeg: Number(layer.rotation || 0), halo: true }, { text: layer.labelText || '' });
        feature.geometry = { kind: 'point', coordinates: toCoordinate(layer.getLatLng()) };
        return feature;
    }
    if (layer.isArrow) {
        const line = layer.getLayers().find(item => item instanceof L.Polyline);
        const feature = featureCommon(layer, 'arrow', 'Arrow', styleFromLayer(line, { arrowHead: 'end' }), {});
        feature.geometry = { kind: 'lineString', coordinates: line.getLatLngs().map(toCoordinate) };
        return feature;
    }
    if (layer instanceof L.Circle) {
        const feature = featureCommon(layer, 'circle', 'Circle', styleFromLayer(layer), {});
        feature.geometry = { kind: 'circle', center: toCoordinate(layer.getLatLng()), radiusM: Number(layer.getRadius()) };
        return feature;
    }
    if (layer instanceof L.Rectangle) {
        const bounds = layer.getBounds();
        const feature = featureCommon(layer, 'rectangle', 'Rectangle', styleFromLayer(layer), {});
        feature.geometry = { kind: 'bounds', southWest: toCoordinate(bounds.getSouthWest()), northEast: toCoordinate(bounds.getNorthEast()) };
        return feature;
    }
    if (layer instanceof L.Polygon) {
        const feature = featureCommon(layer, 'polygon', 'Polygon', styleFromLayer(layer), {});
        feature.geometry = { kind: 'polygon', coordinates: layer.getLatLngs()[0].map(toCoordinate) };
        return feature;
    }
    if (layer instanceof L.Polyline) {
        const feature = featureCommon(layer, 'polyline', 'Polyline', styleFromLayer(layer), {});
        feature.geometry = { kind: 'lineString', coordinates: layer.getLatLngs().map(toCoordinate) };
        return feature;
    }
    return null;
}

function createArrowLayer(latlngs, color, weight) {
    const line = L.polyline(latlngs, { color: color || '#10b981', weight: weight || 3 });
    const arrowhead = L.divIcon({
        className: 'arrow-head',
        html: `<div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color || '#10b981'}" width="24px" height="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    return L.featureGroup([line, L.marker(latlngs[latlngs.length - 1], { icon: arrowhead })]);
}

function createTextLayerFromFeature(feature) {
    const layer = L.marker(toLatLng(feature.geometry.coordinates), { icon: createTextIcon(feature.properties.text, feature.style.rotationDeg), draggable: true }).addTo(drawnItems);
    layer.isTextLabel = true;
    layer.projectFeatureId = feature.id;
    layer.projectName = feature.name;
    layer.labelText = feature.properties.text;
    layer.rotation = Number(feature.style.rotationDeg || 0);
    addLayerContextMenu(layer);
    return layer;
}

function renderFeature(feature) {
    if (feature.type === 'marker') {
        return createMarkerFromData({ id: feature.id, name: feature.name, labelText: feature.name, markerColor: feature.style.color, latlng: toLatLng(feature.geometry.coordinates), radii: feature.properties.radii.map(radius => ({ id: radius.id, distance: radius.distanceM, color: radius.color, fillOpacity: radius.fillOpacity })) });
    }
    if (feature.type === 'text') return createTextLayerFromFeature(feature);
    const style = { color: feature.style.color, weight: feature.style.weightPx, opacity: feature.style.opacity, fillColor: feature.style.fillColor, fillOpacity: feature.style.fillOpacity };
    let layer;
    if (feature.type === 'polyline') layer = L.polyline(toLatLngs(feature.geometry.coordinates), style);
    else if (feature.type === 'polygon') layer = L.polygon(toLatLngs(feature.geometry.coordinates), style);
    else if (feature.type === 'rectangle') layer = L.rectangle([toLatLng(feature.geometry.southWest), toLatLng(feature.geometry.northEast)], style);
    else if (feature.type === 'circle') layer = L.circle(toLatLng(feature.geometry.center), { ...style, radius: feature.geometry.radiusM });
    else if (feature.type === 'arrow') layer = createArrowLayer(toLatLngs(feature.geometry.coordinates), feature.style.color, feature.style.weightPx);
    if (!layer) return null;
    layer.projectFeatureId = feature.id;
    layer.projectName = feature.name;
    layer.isArrow = feature.type === 'arrow';
    drawnItems.addLayer(layer);
    addLayerContextMenu(layer);
    bindShapePopup(layer);
    return layer;
}

function captureProjectDocument() {
    const currentBasemapName = basemapNames.find(name => baseMaps[name] === currentLayer);
    const document = MapToolsSchema.createEmptyProject({ projectId: activeProject.project.id, name: activeProject.project.name, center: toCoordinate(map.getCenter()), zoom: map.getZoom(), basemapId: basemapIdByName[currentBasemapName] || 'osm-standard' });
    document.project.createdAt = activeProject.project.createdAt;
    document.project.updatedAt = new Date().toISOString();
    document.features = markers.map(featureFromMarker);
    drawnItems.eachLayer(layer => {
        const feature = featureFromLayer(layer);
        if (feature) document.features.push(feature);
    });
    return MapToolsSchema.normalizeProject(document);
}

function applyProjectDocument(document) {
    clearMap();
    document.features.forEach(renderFeature);
    map.setView(toLatLng(document.mapView.center), document.mapView.zoom);
    const basemapName = basemapNameById[document.mapView.basemapId];
    if (basemapName && baseMaps[basemapName] !== currentLayer) {
        map.removeLayer(currentLayer);
        currentLayer = baseMaps[basemapName];
        map.addLayer(currentLayer);
    } else if (!basemapName) {
        console.warn(`Unknown basemap "${document.mapView.basemapId}"; using the current basemap.`);
    }
    activeProject = document;
}

saveProjectBtn.addEventListener('click', () => {
    const jsonString = MapToolsSchema.serializeProject(captureProjectDocument());
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'map-project-v2.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

openProjectBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const result = MapToolsSchema.deserializeProject(e.target.result);
            applyProjectDocument(result.document);
            if (result.warnings.length) console.warn('Project loaded with warnings:', result.warnings);
        } catch (error) {
            console.error("Error loading project:", error);
            alert(`Project file is invalid or could not be read.\n${error.message}`);
        }
    };
    reader.readAsText(file);
    fileInput.value = '';
});

exportImageBtn.addEventListener('click', () => {
    loadingOverlay.classList.remove('hidden');
    controlsContainer.classList.add('hidden');
    
    setTimeout(() => {
        html2canvas(document.getElementById('map'), {
            useCORS: true,
            logging: false
        }).then(canvas => {
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = 'map-capture.png';
            a.click();
        }).finally(() => {
            loadingOverlay.classList.add('hidden');
            controlsContainer.classList.remove('hidden');
        });
    }, 500);
});

// --- Search Logic ---
function performSearch() {
    const query = searchInput.value;
    if (!query) return;

    searchResults.innerHTML = 'กำลังค้นหา...';
    
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&accept-language=th`)
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (searchResultMarker) {
            transientSearchLayer.clearLayers();
            searchResultMarker = null;
        }

        if (data && data.length > 0) {
            const result = data[0];
            const latlng = [result.lat, result.lon];
            map.flyTo(latlng, 16);
            
            searchResultMarker = createMarkerFromData({
                labelText: result.display_name,
                markerColor: '#475569', // Slate color
                latlng: latlng,
                radii: [],
                transient: true
            });
            const searchPopup = document.createElement('div');
            const searchLabel = document.createElement('div');
            searchLabel.textContent = result.display_name;
            const addSearchResultButton = document.createElement('button');
            addSearchResultButton.type = 'button';
            addSearchResultButton.textContent = 'Add to project';
            addSearchResultButton.className = 'mt-2 rounded bg-blue-600 px-2 py-1 text-white';
            addSearchResultButton.addEventListener('click', () => {
                const projectMarker = createMarkerFromData({ labelText: result.display_name, markerColor: '#475569', latlng, radii: [] });
                transientSearchLayer.clearLayers();
                searchResultMarker = null;
                projectMarker.openPopup();
            });
            searchPopup.append(searchLabel, addSearchResultButton);
            searchResultMarker.bindPopup(searchPopup, { autoClose: false, closeButton: false });
            searchResultMarker.openPopup();
            
            searchResults.innerHTML = '';
        } else {
            searchResults.innerHTML = 'ไม่พบผลลัพธ์';
        }
    })
    .catch(err => {
        console.error("Search error:", err);
        searchResults.innerHTML = 'เกิดข้อผิดพลาดในการค้นหา';
    });
}

performSearchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});

// --- Drawing Logic ---
let activeDrawHandler = null;

function stopAllDrawing() {
    if (activeDrawHandler) {
        activeDrawHandler.disable();
        activeDrawHandler = null;
    }
    [drawPolylineBtn, drawPolygonBtn, drawCircleBtn, drawRectangleBtn, drawArrowBtn, addTextBtn].forEach(btn => btn.classList.remove('active'));
    isAddingText = false;
    L.DomUtil.removeClass(map._container, 'cursor-text-tool');
}

function startDrawing(button, drawer) {
    stopAllDrawing();
    button.classList.add('active');
    activeDrawHandler = drawer;
    activeDrawHandler.enable();
    toolPanel.classList.add('hidden'); // Auto-close panel
}

drawPolylineBtn.addEventListener('click', function() {
    startDrawing(this, new L.Draw.Polyline(map, { shapeOptions: { color: '#3388ff', weight: 4 } }));
});

drawPolygonBtn.addEventListener('click', function() {
    startDrawing(this, new L.Draw.Polygon(map, { allowIntersection: false, showArea: true, shapeOptions: { color: '#f06eaa', weight: 4 } }));
});

drawCircleBtn.addEventListener('click', function() {
    startDrawing(this, new L.Draw.Circle(map, { shapeOptions: { color: '#f59e0b', weight: 4 } }));
});

drawRectangleBtn.addEventListener('click', function() {
    startDrawing(this, new L.Draw.Rectangle(map, { shapeOptions: { color: '#8b5cf6', weight: 4 } }));
});

drawArrowBtn.addEventListener('click', function() {
    startDrawing(this, new L.Draw.Polyline(map, { shapeOptions: { color: '#10b981', weight: 3 } }));
});

addTextBtn.addEventListener('click', function() {
    stopAllDrawing();
    isAddingText = true;
    this.classList.add('active');
    L.DomUtil.addClass(map._container, 'cursor-text-tool');
    toolPanel.classList.add('hidden');
});

map.on('click', function(e) {
    if (isAddingText) {
        tempPinLatLng = e.latlng;
        textModalTitle.innerText = "เพิ่มข้อความ";
        textLabelInput.value = "";
        textActionsContainer.classList.add('hidden');
        newTextActionsContainer.classList.remove('hidden');
        textModal.classList.remove('hidden');
        textLabelInput.focus();
    }
});

cancelTextBtn.addEventListener('click', hideAllModals);
cancelNewTextBtn.addEventListener('click', hideAllModals);

const saveTextHandler = function() {
    const text = textLabelInput.value.trim();
    if (!text) return;

    if (textMarkerToEdit) {
        // Editing existing text marker
        textMarkerToEdit.labelText = text; // Store text for saving
        textMarkerToEdit.setIcon(createTextIcon(text, textMarkerToEdit.rotation || 0));
    } else {
        // Creating new text marker
        const textIcon = createTextIcon(text, 0);
        const textMarker = L.marker(tempPinLatLng, { icon: textIcon, draggable: true }).addTo(drawnItems);
        textMarker.isTextLabel = true;
        textMarker.projectFeatureId = MapToolsSchema.createId('feature');
        textMarker.projectName = text;
        textMarker.labelText = text;
        textMarker.rotation = 0;

        addLayerContextMenu(textMarker);
    }
    
    stopAllDrawing();
    hideAllModals();
};

saveTextBtn.addEventListener('click', saveTextHandler);
saveNewTextBtn.addEventListener('click', saveTextHandler);


deleteTextBtn.addEventListener('click', () => {
    if (textMarkerToEdit) {
        itemToDelete = { type: 'shape', layer: textMarkerToEdit };
        deleteConfirmMessage.innerText = 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อความนี้?';
        textModal.classList.add('hidden');
        deleteConfirmModal.classList.remove('hidden');
    }
});

rotateTextBtn.addEventListener('click', () => {
    if (textMarkerToEdit) {
        rotationSlider.value = textMarkerToEdit.rotation || 0;
        rotationValue.innerText = `${rotationSlider.value}°`;
        rotateModal.classList.remove('hidden');
    }
});

rotationSlider.addEventListener('input', () => {
    if (textMarkerToEdit) {
        const angle = rotationSlider.value;
        rotationValue.innerText = `${angle}°`;
        textMarkerToEdit.rotation = angle;
        textMarkerToEdit.setIcon(createTextIcon(textMarkerToEdit.labelText, angle));
    }
});

closeRotateModalBtn.addEventListener('click', () => {
    rotateModal.classList.add('hidden');
});


map.on('draw:created', function (e) {
    const type = e.layerType;
    const layer = e.layer;

    if (activeDrawHandler.type === 'polyline' && drawArrowBtn.classList.contains('active')) {
        const latlngs = layer.getLatLngs();
        if (latlngs.length < 2) {
            drawnItems.addLayer(layer);
            addLayerContextMenu(layer);
            bindShapePopup(layer);
            return;
        }
        const p1 = map.latLngToContainerPoint(latlngs[latlngs.length - 2]);
        const p2 = map.latLngToContainerPoint(latlngs[latlngs.length - 1]);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

        const arrowhead = L.divIcon({
            className: 'arrow-head',
            html: `<div style="transform: rotate(${angle + 90}deg); transform-origin: center center;">
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${layer.options.color}" width="24px" height="24px">
                           <path d="M0 0h24v24H0z" fill="none"/><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                       </svg>
                   </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const arrowMarker = L.marker(latlngs[latlngs.length - 1], { 
            icon: arrowhead
        });
        
        const arrowGroup = L.featureGroup([layer, arrowMarker]).addTo(drawnItems);
        arrowGroup.isArrow = true;
        arrowGroup.projectFeatureId = MapToolsSchema.createId('feature');
        arrowGroup.projectName = 'Arrow';
        addLayerContextMenu(arrowGroup);
        bindShapePopup(arrowGroup);
    } else {
        layer.projectFeatureId = MapToolsSchema.createId('feature');
        layer.projectName = type ? `${type.charAt(0).toUpperCase()}${type.slice(1)}` : 'Shape';
        drawnItems.addLayer(layer);
        addLayerContextMenu(layer);
        bindShapePopup(layer);
    }
    
    stopAllDrawing();
});

map.on('draw:drawstop', stopAllDrawing);

// --- Final UI Setup ---
Object.keys(baseMaps).forEach(name => {
    const button = document.createElement('button');
    button.className = 'w-full text-left p-2 rounded-md hover:bg-gray-100';
    button.textContent = name;
    button.onclick = () => { 
        const mapContainer = getEl('map');
        map.removeLayer(currentLayer); 
        currentLayer = baseMaps[name]; 
        map.addLayer(currentLayer); 
        layerPanel.classList.add('hidden'); 
        
        mapContainer.classList.remove('light-mode', 'dark-mode');
    };
    layerOptionsContainer.appendChild(button);
});

// --- Initialize Color Picker ---
colorPickerInstance = new iro.ColorPicker('#color-picker-widget', { width: 190, color: "#fff", borderWidth: 2, borderColor: "#ddd" });

const updateInputs = (color) => {
    const { hexString, rgb, hsl } = color;
    hexInput.value = hexString;
    rInput.value = rgb.r; gInput.value = rgb.g; bInput.value = rgb.b;
    hInput.value = Math.round(hsl.h); sInput.value = Math.round(hsl.s); lInput.value = Math.round(hsl.l);
};
colorPickerInstance.on('color:change', updateInputs);

hexInput.addEventListener('change', () => colorPickerInstance.color.set(hexInput.value));
rInput.addEventListener('change', () => colorPickerInstance.color.set({ r: rInput.value }));
gInput.addEventListener('change', () => colorPickerInstance.color.set({ g: gInput.value }));
bInput.addEventListener('change', () => colorPickerInstance.color.set({ b: bInput.value }));
hInput.addEventListener('change', () => colorPickerInstance.color.set({ h: hInput.value }));
sInput.addEventListener('change', () => colorPickerInstance.color.set({ s: sInput.value }));
lInput.addEventListener('change', () => colorPickerInstance.color.set({ l: lInput.value }));

// --- Initialize Preset Palette ---
presetColors.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'preset-swatch';
    swatch.style.backgroundColor = color;
    swatch.dataset.color = color;
    presetPalette.appendChild(swatch);
});
presetPalette.addEventListener('click', (e) => {
    if (e.target.classList.contains('preset-swatch')) {
        colorPickerInstance.color.set(e.target.dataset.color);
    }
});

// Deterministic browser characterization hooks. These are exposed only for the
// local/CI test URL and do not change the production UI or runtime path.
if (new URLSearchParams(window.location.search).has('test')) {
    const latLngSnapshot = (latlng) => [Number(latlng.lat), Number(latlng.lng)];
    const layerType = (layer) => {
        if (layer.isTextLabel) return 'text';
        if (layer.isArrow) return 'arrow';
        if (layer instanceof L.Rectangle) return 'rectangle';
        if (layer instanceof L.Circle) return 'circle';
        if (layer instanceof L.Polygon) return 'polygon';
        if (layer instanceof L.Polyline) return 'polyline';
        return 'unknown';
    };

    window.__mapToolsTest = {
        captureProjectDocument,
        getMarkers: () => markers.slice(),
        getSearchResult: () => searchResultMarker,
        getDrawnLayers: () => drawnItems.getLayers().slice(),
        runtimeSnapshot: () => ({
            markers: markers.map(marker => ({
                id: marker.projectFeatureId,
                label: marker.labelText,
                latlng: latLngSnapshot(marker.getLatLng()),
                radii: marker.radii.map(radius => ({ id: String(radius.id), distance: Number(radius.distance) })),
                circles: marker.circleLayerGroup.getLayers().map(circle => ({ center: latLngSnapshot(circle.getLatLng()), radius: circle.getRadius() }))
            })),
            drawn: drawnItems.getLayers().map(layer => {
                if (layer.isArrow) {
                    const line = layer.getLayers().find(item => item instanceof L.Polyline);
                    const head = layer.getLayers().find(item => item instanceof L.Marker);
                    return { type: 'arrow', line: line.getLatLngs().map(latLngSnapshot), head: latLngSnapshot(head.getLatLng()) };
                }
                if (layer.isTextLabel) return { type: 'text', text: layer.labelText, latlng: latLngSnapshot(layer.getLatLng()), rotation: Number(layer.rotation || 0) };
                if (layer instanceof L.Circle) return { type: 'circle', center: latLngSnapshot(layer.getLatLng()), radius: layer.getRadius() };
                if (layer instanceof L.Rectangle) return { type: 'rectangle', bounds: [latLngSnapshot(layer.getBounds().getSouthWest()), latLngSnapshot(layer.getBounds().getNorthEast())] };
                if (layer instanceof L.Polygon) return { type: 'polygon', coordinates: layer.getLatLngs()[0].map(latLngSnapshot) };
                if (layer instanceof L.Polyline) return { type: 'polyline', coordinates: layer.getLatLngs().map(latLngSnapshot) };
                return { type: layerType(layer) };
            })
        }),
        fireMapClick: (lat, lng) => map.fire('click', { latlng: L.latLng(lat, lng) }),
        addTestShape: (type) => {
            const definitions = {
                polyline: L.polyline([[13.75, 100.5], [13.751, 100.502]], { color: '#3388ff', weight: 4 }),
                polygon: L.polygon([[13.75, 100.5], [13.751, 100.5], [13.751, 100.502]], { color: '#f06eaa', weight: 4, fillColor: '#f06eaa', fillOpacity: 0.2 }),
                rectangle: L.rectangle([[13.75, 100.5], [13.752, 100.503]], { color: '#8b5cf6', weight: 4, fillColor: '#8b5cf6', fillOpacity: 0.2 }),
                circle: L.circle([13.7563, 100.5018], { radius: 250, color: '#f59e0b', weight: 4, fillColor: '#f59e0b', fillOpacity: 0.2 }),
                arrow: L.polyline([[13.75, 100.5], [13.751, 100.502]], { color: '#10b981', weight: 3 })
            };
            const layer = definitions[type];
            if (!layer) throw new Error(`Unknown test shape: ${type}`);
            activeDrawHandler = { type: type === 'arrow' ? 'polyline' : type, disable: () => {} };
            if (type === 'arrow') drawArrowBtn.classList.add('active');
            map.fire('draw:created', { layerType: type === 'arrow' ? 'polyline' : type, layer });
        },
        openTextEditor: (layer) => {
            textMarkerToEdit = layer;
            textModalTitle.innerText = 'แก้ไขข้อความ';
            textLabelInput.value = layer.labelText;
            textActionsContainer.classList.remove('hidden');
            newTextActionsContainer.classList.add('hidden');
            textModal.classList.remove('hidden');
        }
    };
}
