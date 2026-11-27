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
let areLabelsVisible = true;
const presetColors = ['#e11d48', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];
// --- Survey point types ---
// Codes are numbered per prefix; both intersection types share TMC numbering.
const SURVEY_TYPES = {
    general:      { label: 'หมุดทั่วไป (เลือกสีเอง)', prefix: '' },
    tmc_signal:   { label: 'แยกสัญญาณไฟ (TMC)', prefix: 'TMC', color: '#E24B4A' },
    tmc_unsignal: { label: 'แยกไม่มีสัญญาณไฟ (TMC)', prefix: 'TMC', color: '#D85A30' },
    uturn:        { label: 'จุดกลับรถ (UT)', prefix: 'UT', color: '#BA7517' },
    mb:           { label: 'นับรถบนช่วงถนน (MB)', prefix: 'MB', color: '#185FA5' },
    ped:          { label: 'นับคนเดิน (PC)', prefix: 'PC', color: '#1D9E75' },
    od:           { label: 'จุดสำรวจ OD', prefix: 'OD', color: '#534AB7' }
};
const SURVEY_TYPE_ORDER = Object.keys(SURVEY_TYPES);
let legendVisible = true;

function normalizeType(type) { return SURVEY_TYPES[type] ? type : 'general'; }

function surveySymbolSvg(type, size = 28) {
    const c = SURVEY_TYPES[type].color;
    const open = `<svg width="${size}" height="${size}" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">`;
    switch (type) {
        case 'tmc_signal':
            return open + `<circle cx="14" cy="14" r="12" fill="${c}" stroke="#fff" stroke-width="2"/><rect x="10.5" y="6" width="7" height="16" rx="2" fill="#fff"/><circle cx="14" cy="9.5" r="1.8" fill="#E24B4A"/><circle cx="14" cy="14" r="1.8" fill="#EF9F27"/><circle cx="14" cy="18.5" r="1.8" fill="#639922"/></svg>`;
        case 'tmc_unsignal':
            return open + `<circle cx="14" cy="14" r="12" fill="${c}" stroke="#fff" stroke-width="2"/><path d="M14 6v16M6 14h16" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;
        case 'uturn':
            return open + `<circle cx="14" cy="14" r="12" fill="${c}" stroke="#fff" stroke-width="2"/><path d="M10 21V12a4 4 0 0 1 8 0v6" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M15 15.5l3 3.5 3-3.5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        case 'mb':
            return open + `<rect x="2" y="2" width="24" height="24" rx="4" fill="${c}" stroke="#fff" stroke-width="2"/><path d="M7 14h14M10 10.5 7 14l3 3.5M18 10.5l3 3.5-3 3.5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        case 'ped':
            return open + `<path d="M14 2 26 24H2Z" fill="${c}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="14" cy="11" r="2" fill="#fff"/><path d="M14 13.5v4.5M11.5 21l2.5-3 2.5 3M11.5 15.5h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`;
        case 'od':
            return open + `<path d="M14 2 24.4 8v12L14 26 3.6 20V8Z" fill="${c}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><text x="14" y="17.5" text-anchor="middle" font-size="9" font-weight="600" fill="#fff" font-family="Sarabun, sans-serif">OD</text></svg>`;
        default:
            return '';
    }
}

function createSurveyIcon(type) {
    return L.divIcon({ html: `<div class="survey-marker-icon">${surveySymbolSvg(type)}</div>`, className: '', iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14], tooltipAnchor: [13, 0] });
}

function iconForMarkerData(type, color) {
    return normalizeType(type) === 'general' ? createMarkerIcon(color) : createSurveyIcon(type);
}

function displayName(marker) {
    return [marker.code, marker.labelText].filter(Boolean).join(' ');
}

function nextCode(prefix, exclude) {
    if (!prefix) return '';
    const re = new RegExp(`^${prefix}-(\\d+)$`, 'i');
    let max = 0;
    markers.forEach(m => {
        if (m === exclude) return;
        const match = String(m.code || '').trim().match(re);
        if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

let isAddingText = false;
let textMarkerToEdit = null;
let tempPinLatLng = null;

// Layer group to store all drawn items (polygons, polylines)
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

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
const pinTypeSelect = getEl('pin-type-select'), pinCodeRow = getEl('pin-code-row'), pinCodeInput = getEl('pin-code-input');
const pinColorRow = getEl('pin-color-row'), toggleLegendBtn = getEl('toggle-legend-btn'), exportCsvBtn = getEl('export-csv-btn');
const deleteConfirmModal = getEl('delete-confirm-modal'), cancelDeleteBtn = getEl('cancel-delete-btn'), confirmDeleteBtn = getEl('confirm-delete-btn');
const deleteConfirmMessage = getEl('delete-confirm-message');
const deleteAllConfirmModal = getEl('delete-all-confirm-modal'), cancelDeleteAllBtn = getEl('cancel-delete-all-btn'), confirmDeleteAllBtn = getEl('confirm-delete-all-btn');

// Delete confirmations name the exact item and use a destructive verb on the button.
function shapeKindLabel(layer) {
    if (layer.isTextLabel) return 'ข้อความ';
    if (layer.isArrow) return 'ลูกศร';
    if (layer instanceof L.Circle) return 'วงกลม';
    if (layer instanceof L.Rectangle) return 'สี่เหลี่ยม';
    if (layer instanceof L.Polygon) return 'รูปหลายเหลี่ยม';
    if (layer instanceof L.Polyline) return 'เส้น';
    return 'รูปทรง';
}
function setDeleteConfirm(kind, name) {
    getEl('delete-confirm-title').textContent = name ? `ลบ${kind} “${name}”?` : `ลบ${kind}นี้?`;
    deleteConfirmMessage.textContent = 'รายการนี้จะหายจากแผนที่ กด Ctrl+Z เพื่อเอากลับได้';
    confirmDeleteBtn.textContent = `ลบ${kind}`;
}
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
// Escape user/remote text before it is placed into HTML (labels, search results, loaded files).
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeColor(value, fallback = '#3388ff') {
    return /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? value : fallback;
}

function showToast(message) {
    let toast = getEl('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function createMarkerIcon(color) {
    color = safeColor(color, '#2563eb');
    const svg = `<div class="custom-marker-icon"><svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.596 0 0 5.596 0 12.5 0 19.404 12.5 41 12.5 41S25 19.404 25 12.5C25 5.596 19.404 0 12.5 0z" fill="${color}"/><circle cx="12.5" cy="12.5" r="4.5" fill="white"/></svg></div>`;
    return L.divIcon({ html: svg, className: '', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -36], tooltipAnchor: [10, -27] });
}

function createPopupContent(marker) {
    const markerId = L.Util.stamp(marker);
    const code = marker.code ? `<b>${escapeHtml(marker.code)}</b>` : '';
    const label = marker.labelText ? (code ? ` ${escapeHtml(marker.labelText)}` : `<b>${escapeHtml(marker.labelText)}</b>`) : '';
    const body = code || label ? `${code}${label}` : `<i class="text-gray-500">${escapeHtml(SURVEY_TYPES[normalizeType(marker.pointType)].label)} (ไม่มีชื่อ)</i>`;
    return `<div class="editable-popup-text" ondblclick="startEdit(${markerId})">${body}</div>`;
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
        setPinTypeUI(markerToEdit.pointType, markerToEdit.code);
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
        const ring = L.circle(latlng, {
            renderer: canvasRenderer,
            radius: radius.distance,
            color: safeColor(radius.color),
            fillColor: safeColor(radius.color),
            fillOpacity: 0.2
        }).addTo(marker.circleLayerGroup);
        // Hover shows which pin/ring this is; it is not part of the exported image.
        ring.bindTooltip(`${escapeHtml(displayName(marker) || SURVEY_TYPES[normalizeType(marker.pointType)].label)} · ${radius.distance.toLocaleString()} ม.`, { sticky: true });
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
                <button class="w-6 h-6 rounded border border-gray-300" style="background-color: ${safeColor(radius.color)};" data-id="${radius.id}" data-action="edit-color"></button>
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

// --- Permanent labels beside pins (code bold + name); hidden with the label toggle ---
function refreshMarkerLabel(marker) {
    marker.unbindTooltip();
    const code = marker.code ? `<b>${escapeHtml(marker.code)}</b>` : '';
    const name = marker.labelText ? escapeHtml(marker.labelText) : '';
    if (!code && !name) return;
    marker.bindTooltip(code && name ? `${code} ${name}` : (code || name), {
        permanent: true, direction: 'right', className: 'pin-label', interactive: false
    });
}

function applyLabelVisibility() {
    map.getContainer().classList.toggle('labels-hidden', !areLabelsVisible);
    toggleLabelsIcon.innerHTML = areLabelsVisible
        ? `<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />`
        : `<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />`;
    toggleLabelsBtn.setAttribute('aria-pressed', String(areLabelsVisible));
}

// --- Point type UI ---
let lastPointType = 'general';
let autoFilledCode = '';
SURVEY_TYPE_ORDER.forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = SURVEY_TYPES[key].label;
    pinTypeSelect.appendChild(opt);
});

function setPinTypeUI(type, existingCode) {
    type = normalizeType(type);
    pinTypeSelect.value = type;
    const isGeneral = type === 'general';
    pinCodeRow.classList.toggle('hidden', isGeneral);
    pinColorRow.classList.toggle('hidden', !isGeneral);
    if (existingCode !== null && existingCode !== undefined) {
        pinCodeInput.value = existingCode;
        autoFilledCode = '';
    } else {
        autoFilledCode = isGeneral ? '' : nextCode(SURVEY_TYPES[type].prefix, markerToEdit);
        pinCodeInput.value = autoFilledCode;
    }
}

pinTypeSelect.addEventListener('change', () => {
    const type = normalizeType(pinTypeSelect.value);
    const current = pinCodeInput.value.trim();
    // Re-number only when the code is empty or still the one filled in automatically.
    const keep = current && current !== autoFilledCode ? current : null;
    if (markerToEdit && keep === null && markerToEdit.code && SURVEY_TYPES[type].prefix &&
        String(markerToEdit.code).toUpperCase().startsWith(SURVEY_TYPES[type].prefix + '-')) {
        setPinTypeUI(type, markerToEdit.code);
    } else {
        setPinTypeUI(type, keep);
    }
});
pinCodeInput.addEventListener('keyup', e => { if (e.key === 'Enter') { e.preventDefault(); savePinBtn.click(); } });

// --- Modal Logic ---
function showCreateModal(latlng) {
    markerToEdit = null;
    tempPinLatLng = latlng || null;
    modalTitle.innerText = "เพิ่มหมุดใหม่";
    pinLabelInput.value = '';
    radiusManagementSection.classList.add('hidden');
    selectedColor = '#2563eb';
    markerColorSelector.style.backgroundColor = selectedColor;
    setPinTypeUI(lastPointType, null);
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
    const pointType = normalizeType(pinTypeSelect.value);
    const code = pointType === 'general' ? '' : pinCodeInput.value.trim();
    const markerColor = pointType === 'general' ? selectedColor : SURVEY_TYPES[pointType].color;

    if (markerToEdit) {
        // Editing an existing marker
        markerToEdit.labelText = labelText;
        markerToEdit.markerColor = markerColor;
        markerToEdit.pointType = pointType;
        markerToEdit.code = code;
        markerToEdit.setIcon(iconForMarkerData(pointType, markerColor));
        markerToEdit.setPopupContent(createPopupContent(markerToEdit));
        refreshMarkerLabel(markerToEdit);
        drawCirclesForMarker(markerToEdit);
    } else {
        // Creating a new marker
        createMarkerFromData({
            labelText: labelText,
            markerColor: markerColor,
            pointType: pointType,
            code: code,
            latlng: tempPinLatLng || map.getCenter(), // Fallback to map center if no latlng is provided
            radii: []
        });
    }
    lastPointType = pointType;
    hideAllModals();
    updateLegend();
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
    if (!markerToEdit || !(distance > 0)) {
        showToast('กรุณาใส่ระยะรัศมีมากกว่า 0 เมตร');
        return;
    }

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
        setDeleteConfirm('หมุด', displayName(markerToEdit));
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
        updateLegend();
    } else if (itemToDelete.type === 'shape') {
        drawnItems.removeLayer(itemToDelete.layer);
    }
    hideAllModals();
});

deleteAllBtn.addEventListener('click', () => { 
    if (markers.length > 0 || drawnItems.getLayers().length > 0) {
        const shapeCount = drawnItems.getLayers().length;
        getEl('delete-all-message').textContent =
            `หมุด ${markers.length} จุด และรูปทรง/ข้อความ ${shapeCount} รายการ จะหายจากแผนที่ กด Ctrl+Z เพื่อเอากลับได้`;
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
    updateLegend();
}
confirmDeleteAllBtn.addEventListener('click', () => {
    clearMap();
    deleteAllConfirmModal.classList.add('hidden');
});

pinLabelInput.addEventListener('keyup', e => { if (e.key === 'Enter') { e.preventDefault(); savePinBtn.click(); } });
pinLabelInput.placeholder = 'เช่น แยกปทุมวัน';

toggleLabelsBtn.addEventListener('click', () => {
    areLabelsVisible = !areLabelsVisible;
    applyLabelVisibility();
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
        setDeleteConfirm(shapeKindLabel(layer), '');
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
                    html: `<div style="transform: rotate(${angle + 90}deg); transform-origin: center center;">${head.getIcon().options.html.match(/<svg.*<\/svg>/)[0]}</div>`,
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
            if (item.copyText) {
                div.classList.add('copyable');
                div.title = 'คลิกเพื่อคัดลอกพิกัด';
                div.onclick = () => {
                    const done = () => showToast(`คัดลอกพิกัดแล้ว: ${item.copyText}`);
                    if (navigator.clipboard) {
                        navigator.clipboard.writeText(item.copyText).then(done, () => showToast(item.copyText));
                    } else {
                        showToast(item.copyText);
                    }
                    hideContextMenu();
                };
            }
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
    // Keep the menu inside the viewport near screen edges.
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) contextMenu.style.left = `${Math.max(8, point.x - rect.width)}px`;
    if (rect.bottom > window.innerHeight - 8) contextMenu.style.top = `${Math.max(8, point.y - rect.height)}px`;
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
        { text: `พิกัด: ${lat}, ${lon} <span class="copy-hint">(คลิกเพื่อคัดลอก)</span>`, isInfo: true, copyText: `${lat}, ${lon}` },
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
                setDeleteConfirm('หมุด', displayName(marker));
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
    const pointType = normalizeType(data.pointType);
    const newMarker = L.marker(data.latlng, { draggable: true, icon: iconForMarkerData(pointType, data.markerColor) }).addTo(map);
    newMarker.labelText = data.labelText;
    newMarker.markerColor = data.markerColor;
    newMarker.pointType = pointType;
    newMarker.code = pointType === 'general' ? '' : String(data.code || '');
    newMarker.radii = data.radii || [];
    newMarker.circleLayerGroup = L.layerGroup().addTo(map);
    newMarker.bindPopup(createPopupContent(newMarker), { autoClose: false, closeButton: false });
    refreshMarkerLabel(newMarker);
    if (document.getElementById('empty-hint')) updateEmptyState();
    
    newMarker.on('dragstart', e => e.target.closePopup());
    newMarker.on('drag', e => drawCirclesForMarker(e.target));
    
    addLayerContextMenu(newMarker);
    drawCirclesForMarker(newMarker);
    markers.push(newMarker);
    return newMarker;
}

// --- Shape factories (shared by drawing, opening files and autosave restore) ---
function arrowHeadIcon(color, angle) {
    return L.divIcon({
        className: 'arrow-head',
        html: `<div style="transform: rotate(${angle + 90}deg); transform-origin: center center;">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${safeColor(color, '#10b981')}" width="24px" height="24px">
                       <path d="M0 0h24v24H0z" fill="none"/><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                   </svg>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

function createArrowFromLine(line) {
    const latlngs = line.getLatLngs();
    const p1 = map.latLngToContainerPoint(latlngs[latlngs.length - 2]);
    const p2 = map.latLngToContainerPoint(latlngs[latlngs.length - 1]);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
    const arrowMarker = L.marker(latlngs[latlngs.length - 1], { icon: arrowHeadIcon(line.options.color, angle) });
    const arrowGroup = L.featureGroup([line, arrowMarker]).addTo(drawnItems);
    arrowGroup.isArrow = true;
    addLayerContextMenu(arrowGroup);
    bindShapePopup(arrowGroup);
    return arrowGroup;
}

function textLabelIcon(text, rotation) {
    return L.divIcon({
        className: 'text-label-icon',
        html: `<div style="transform: rotate(${Number(rotation) || 0}deg);">${escapeHtml(text)}</div>`
    });
}

function createTextLabel(latlng, text, rotation = 0) {
    const textMarker = L.marker(latlng, { icon: textLabelIcon(text, rotation), draggable: true }).addTo(drawnItems);
    textMarker.isTextLabel = true;
    textMarker.labelText = text;
    textMarker.rotation = Number(rotation) || 0;
    addLayerContextMenu(textMarker);
    return textMarker;
}

function addShapeLayer(layer) {
    drawnItems.addLayer(layer);
    addLayerContextMenu(layer);
    bindShapePopup(layer);
    return layer;
}

// --- Project serialisation ---
// Format version 2 keeps every feature type (pins + radii, text + rotation, arrows,
// circles, lines, polygons/rectangles). "drawnShapes" stays as plain GeoJSON for GIS use
// and for files written by the original version, which are still accepted on open.
const PROJECT_FORMAT_VERSION = 2;
const AUTOSAVE_KEY = 'map-tools-classic:autosave';

function latLngPlain(ll) { return { lat: ll.lat, lng: ll.lng }; }

function serializeProject() {
    const shapes = [];
    drawnItems.eachLayer(layer => {
        if (layer.isTextLabel) {
            shapes.push({ kind: 'text', latlng: latLngPlain(layer.getLatLng()), text: layer.labelText, rotation: Number(layer.rotation) || 0 });
        } else if (layer.isArrow) {
            const line = layer.getLayers().find(l => l instanceof L.Polyline);
            if (line) shapes.push({ kind: 'arrow', latlngs: line.getLatLngs().map(latLngPlain), color: line.options.color });
        } else if (layer instanceof L.Circle) {
            shapes.push({ kind: 'circle', center: latLngPlain(layer.getLatLng()), radius: layer.getRadius(), color: layer.options.color, fillColor: layer.options.fillColor });
        } else if (layer instanceof L.Polyline) {
            shapes.push({ kind: 'geojson', feature: layer.toGeoJSON(), style: { color: layer.options.color, fillColor: layer.options.fillColor } });
        }
    });

    return {
        app: 'map-tools-classic',
        version: PROJECT_FORMAT_VERSION,
        savedAt: new Date().toISOString(),
        view: { center: latLngPlain(map.getCenter()), zoom: map.getZoom() },
        markers: markers.map(marker => ({
            labelText: marker.labelText,
            markerColor: marker.markerColor,
            pointType: marker.pointType || 'general',
            code: marker.code || '',
            latlng: latLngPlain(marker.getLatLng()),
            radii: marker.radii
        })),
        shapes,
        drawnShapes: drawnItems.toGeoJSON()
    };
}

function loadShapesV2(shapes) {
    shapes.forEach(shape => {
        try {
            if (shape.kind === 'text') {
                createTextLabel(shape.latlng, String(shape.text ?? ''), shape.rotation);
            } else if (shape.kind === 'arrow' && Array.isArray(shape.latlngs) && shape.latlngs.length >= 2) {
                const line = L.polyline(shape.latlngs, { color: safeColor(shape.color, '#10b981'), weight: 3 });
                createArrowFromLine(line);
            } else if (shape.kind === 'circle') {
                const color = safeColor(shape.color, '#f59e0b');
                addShapeLayer(L.circle(shape.center, { radius: Number(shape.radius) || 0, color, fillColor: safeColor(shape.fillColor, color), weight: 4 }));
            } else if (shape.kind === 'geojson' && shape.feature) {
                const style = { weight: 4, ...(shape.style || {}) };
                style.color = safeColor(style.color);
                style.fillColor = safeColor(style.fillColor, style.color);
                L.geoJSON(shape.feature, { style: () => style }).eachLayer(addShapeLayer);
            }
        } catch (err) {
            console.warn('Skipped an unreadable shape', shape, err);
        }
    });
}

function loadShapesLegacy(drawnShapes) {
    // Original files flatten an arrow into a LineString plus a bare Point at its last vertex.
    // Re-pair them so arrows come back as arrows instead of stray text labels.
    const features = (drawnShapes && drawnShapes.features) || [];
    const sameCoord = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
    const arrowHeads = new Set();
    const arrowLines = new Set();
    features.forEach(pt => {
        if (!pt.geometry || pt.geometry.type !== 'Point' || (pt.properties && pt.properties.radius)) return;
        const line = features.find(f => f.geometry && f.geometry.type === 'LineString' && !arrowLines.has(f)
            && sameCoord(f.geometry.coordinates[f.geometry.coordinates.length - 1], pt.geometry.coordinates));
        if (line) { arrowHeads.add(pt); arrowLines.add(line); }
    });
    arrowLines.forEach(f => {
        const latlngs = f.geometry.coordinates.map(c => [c[1], c[0]]);
        const color = safeColor(f.properties && f.properties.style && f.properties.style.color, '#10b981');
        createArrowFromLine(L.polyline(latlngs, { color, weight: 3 }));
    });
    const rest = features.filter(f => !arrowHeads.has(f) && !arrowLines.has(f));

    L.geoJSON({ type: 'FeatureCollection', features: rest }, {
        style: function (feature) {
            const defaultStyle = {
                color: feature.geometry.type === 'Polygon' ? '#f06eaa' : '#3388ff',
                weight: 4
            };
            return { ...defaultStyle, ...(feature.properties && feature.properties.style) };
        },
        pointToLayer: function(feature, latlng) {
            if (feature.properties && feature.properties.radius) {
                return L.circle(latlng, feature.properties.radius, feature.properties.style);
            }
            return L.marker(latlng);
        },
        onEachFeature: function (feature, layer) {
            if (layer instanceof L.Marker) {
                // Original files stored text labels as bare points without their text.
                createTextLabel(layer.getLatLng(), (feature.properties && feature.properties.text) || 'ข้อความ');
                return;
            }
            addShapeLayer(layer);
        }
    });
}

function loadProject(data, { fitView = false } = {}) {
    clearMap();
    if (Array.isArray(data.markers)) {
        data.markers.forEach(markerData => {
            createMarkerFromData({
                labelText: String(markerData.labelText ?? ''),
                markerColor: safeColor(markerData.markerColor, '#2563eb'),
                pointType: normalizeType(markerData.pointType),
                code: String(markerData.code ?? ''),
                latlng: markerData.latlng,
                radii: Array.isArray(markerData.radii)
                    ? markerData.radii.filter(r => Number(r.distance) > 0).map(r => ({ id: r.id, distance: Number(r.distance), color: safeColor(r.color) }))
                    : []
            });
        });
    }
    if (Array.isArray(data.shapes)) {
        loadShapesV2(data.shapes);
    } else if (data.drawnShapes) {
        loadShapesLegacy(data.drawnShapes);
    }
    updateLegend();
    if (fitView && data.view && data.view.center) {
        map.setView(data.view.center, data.view.zoom || map.getZoom());
    } else if (fitView) {
        const bounds = L.latLngBounds([]);
        markers.forEach(m => bounds.extend(m.getLatLng()));
        drawnItems.eachLayer(l => { if (l.getBounds) bounds.extend(l.getBounds()); else if (l.getLatLng) bounds.extend(l.getLatLng()); });
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
}

function projectFileName() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `map-project-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

saveProjectBtn.addEventListener('click', () => {
    const jsonString = JSON.stringify(serializeProject(), null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = projectFileName();
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
            const data = JSON.parse(e.target.result);
            loadProject(data, { fitView: true });
            showToast(`เปิดโปรเจกต์แล้ว: ${file.name}`);
        } catch (error) {
            console.error("Error loading project:", error);
            showToast('เปิดไฟล์นี้ไม่ได้ เพราะไม่ใช่ไฟล์โปรเจกต์ .json ของ Map Tools เลือกไฟล์ที่บันทึกจากปุ่ม "บันทึก" แล้วลองอีกครั้ง');
        }
    };
    reader.readAsText(file);
    fileInput.value = '';
});

// --- Autosave (browser only) ---
// Keeps the latest work in this browser so a refresh or closed tab does not lose it.
// "Save project" files remain the way to keep or share a project.
let lastAutosave = null;
function autosaveNow() {
    try {
        const data = serializeProject();
        const isEmpty = data.markers.length === 0 && data.shapes.length === 0;
        const payload = isEmpty ? '' : JSON.stringify({ ...data, savedAt: undefined, view: undefined });
        if (payload === lastAutosave) return;
        lastAutosave = payload;
        if (isEmpty) localStorage.removeItem(AUTOSAVE_KEY);
        else localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
    } catch (err) {
        // Storage may be unavailable (private mode, quota); the app keeps working without it.
    }
}

function restoreAutosave() {
    let raw = null;
    try { raw = localStorage.getItem(AUTOSAVE_KEY); } catch (err) { return; }
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        loadProject(data, { fitView: true });
        const when = data.savedAt ? new Date(data.savedAt).toLocaleString('th-TH') : '';
        showToast(`กู้คืนงานล่าสุดในเบราว์เซอร์แล้ว${when ? ' (' + when + ')' : ''}`);
    } catch (err) {
        console.warn('Autosave could not be restored', err);
    }
}

// --- Image export ---
// Screen export keeps the original behaviour; paper sizes frame part of the map at a
// chosen DPI and add title, north arrow and scale bar for reports.
const PAPER_MM = { a4l: [297, 210], a4p: [210, 297], a3l: [420, 297], a3p: [297, 420] };
const exportPanel = getEl('export-panel'), exportFrame = getEl('export-frame');
const exportPaper = getEl('export-paper'), exportDpi = getEl('export-dpi'), exportTitle = getEl('export-title');
const exportNorth = getEl('export-north'), exportScale = getEl('export-scale'), exportLegend = getEl('export-legend'), exportLabels = getEl('export-labels');
const exportSizeInfo = getEl('export-size-info');

const scaleControl = L.control.scale({ metric: true, imperial: false, position: 'bottomright', maxWidth: 160 }).addTo(map);

function exportTargetPx() {
    const paper = PAPER_MM[exportPaper.value];
    if (!paper) return null;
    const dpi = parseInt(exportDpi.value, 10) || 200;
    return { w: Math.round(paper[0] / 25.4 * dpi), h: Math.round(paper[1] / 25.4 * dpi), dpi };
}

function layoutExportFrame() {
    const paper = PAPER_MM[exportPaper.value];
    exportDpi.disabled = !paper;
    if (!paper) {
        exportFrame.classList.add('hidden');
        const r = map.getContainer().getBoundingClientRect();
        exportSizeInfo.textContent = `${Math.round(r.width)} × ${Math.round(r.height)} px`;
        return;
    }
    const panelBottom = exportPanel.getBoundingClientRect().bottom;
    const margin = 24;
    const availW = window.innerWidth - margin * 2;
    const availH = window.innerHeight - panelBottom - margin * 2;
    const ratio = paper[0] / paper[1];
    let w = availW, h = w / ratio;
    if (h > availH) { h = availH; w = h * ratio; }
    exportFrame.style.width = `${Math.round(w)}px`;
    exportFrame.style.height = `${Math.round(h)}px`;
    exportFrame.style.left = `${Math.round((window.innerWidth - w) / 2)}px`;
    exportFrame.style.top = `${Math.round(panelBottom + margin + (availH - h) / 2)}px`;
    exportFrame.classList.remove('hidden');
    const t = exportTargetPx();
    exportSizeInfo.textContent = `${t.w} × ${t.h} px`;
}

function openExportPanel() {
    stopAllDrawing();
    hideContextMenu();
    toolPanel.classList.add('hidden');
    exportLegend.checked = legendVisible;
    exportLabels.checked = areLabelsVisible;
    exportPanel.classList.remove('hidden');
    document.body.classList.add('export-framing');
    layoutExportFrame();
}

function closeExportPanel() {
    exportPanel.classList.add('hidden');
    exportFrame.classList.add('hidden');
    document.body.classList.remove('export-framing');
}

exportImageBtn.addEventListener('click', openExportPanel);
getEl('export-cancel-btn').addEventListener('click', closeExportPanel);
exportPaper.addEventListener('change', layoutExportFrame);
exportDpi.addEventListener('change', layoutExportFrame);
window.addEventListener('resize', () => { if (!exportPanel.classList.contains('hidden')) layoutExportFrame(); });

function tileLayersOf(layer) {
    if (!layer) return [];
    if (layer instanceof L.GridLayer) return [layer];
    if (layer.getLayers) return layer.getLayers().flatMap(tileLayersOf);
    return [];
}

function waitForTiles(timeoutMs = 12000) {
    const layers = tileLayersOf(currentLayer);
    const start = Date.now();
    return new Promise(resolve => {
        (function check() {
            const gl = currentLayer && currentLayer.isVectorBasemap && currentLayer.getMaplibreMap ? currentLayer.getMaplibreMap() : null;
            const glBusy = gl ? !(gl.loaded() && gl.areTilesLoaded()) : false;
            const busy = glBusy || layers.some(l => l.isLoading && l.isLoading());
            if (!busy || Date.now() - start > timeoutMs) setTimeout(resolve, 300);
            else setTimeout(check, 150);
        })();
    });
}

function makeExportControls(opts) {
    const added = [];
    if (opts.title) {
        const c = L.control({ position: 'topleft' });
        c.onAdd = () => {
            const d = L.DomUtil.create('div', 'export-title-block');
            const date = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
            d.innerHTML = `<div class="export-title-text">${escapeHtml(opts.title)}</div><div class="export-title-date">${escapeHtml(date)}</div>`;
            return d;
        };
        c.addTo(map); added.push(c);
    }
    if (opts.north) {
        const c = L.control({ position: 'topright' });
        c.onAdd = () => {
            const d = L.DomUtil.create('div', 'export-north');
            d.innerHTML = `<svg width="44" height="56" viewBox="0 0 44 56" xmlns="http://www.w3.org/2000/svg"><text x="22" y="13" text-anchor="middle" font-size="13" font-weight="600" font-family="Sarabun, sans-serif" fill="#111827">N</text><path d="M22 17 L32 50 L22 43 L12 50 Z" fill="#fff" stroke="#111827" stroke-width="1.5" stroke-linejoin="round"/><path d="M22 17 L22 43 L12 50 Z" fill="#111827"/></svg>`;
            return d;
        };
        c.addTo(map); added.push(c);
    }
    return added;
}

async function runExport() {
    const mapEl = map.getContainer();
    const paperKey = exportPaper.value;
    const target = exportTargetPx();
    const prev = { legend: legendVisible, labels: areLabelsVisible };
    const frameRect = target ? exportFrame.getBoundingClientRect() : null;
    const savedStyle = mapEl.getAttribute('style') || '';
    const savedView = { center: map.getCenter(), zoom: map.getZoom() };

    loadingOverlay.classList.remove('hidden');
    controlsContainer.classList.add('hidden');
    document.body.classList.add('exporting');
    legendVisible = exportLegend.checked; updateLegend();
    areLabelsVisible = exportLabels.checked; applyLabelVisibility();
    mapEl.classList.toggle('export-no-scale', !exportScale.checked);
    const extra = target ? makeExportControls({ title: exportTitle.value.trim(), north: exportNorth.checked }) : [];

    let fileName = 'map-capture.png';
    let savedPixelRatio = null;
    try {
        let scale = 1;
        if (target) {
            // Shrink the map container onto the frame so exactly the framed area is captured.
            mapEl.style.position = 'fixed';
            mapEl.style.left = `${frameRect.left}px`;
            mapEl.style.top = `${frameRect.top}px`;
            mapEl.style.width = `${frameRect.width}px`;
            mapEl.style.height = `${frameRect.height}px`;
            map.invalidateSize({ pan: false });
            map.panBy([frameRect.left, frameRect.top], { animate: false });
            scale = target.w / frameRect.width;
            const stamp = projectFileName().replace('map-project-', '').replace('.json', '');
            fileName = `map-${paperKey.slice(0, 2).toUpperCase()}${paperKey.endsWith('l') ? '-landscape' : '-portrait'}-${target.dpi}dpi-${stamp}.png`;
        }
        // Vector basemaps re-render at the export resolution, so map text stays sharp.
        const gl = currentLayer && currentLayer.isVectorBasemap ? currentLayer.getMaplibreMap() : null;
        if (gl && target) {
            savedPixelRatio = gl.getPixelRatio();
            await new Promise(resolve => {
                const timer = setTimeout(resolve, 10000);
                gl.once('idle', () => { clearTimeout(timer); resolve(); });
                gl.setPixelRatio(Math.min(scale * (window.devicePixelRatio || 1), 8));
                gl.triggerRepaint();
            });
        }
        await waitForTiles();
        let blob = null;
        if (target && window.modernScreenshot) {
            // html2canvas mis-places SVG icons and transformed labels when scale != 1,
            // so paper exports use the browser's own rendering via modern-screenshot.
            try {
                blob = await modernScreenshot.domToBlob(mapEl, { scale, backgroundColor: '#ffffff', type: 'image/png' });
            } catch (err) {
                console.warn('modern-screenshot failed, falling back to html2canvas', err);
            }
        }
        if (!blob) {
            const canvas = await html2canvas(mapEl, { useCORS: true, logging: false, scale, backgroundColor: '#ffffff' });
            blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        if (target) showToast(`ส่งออกแล้ว ${target.w} × ${target.h} px`);
    } catch (err) {
        console.error('Export failed', err);
        showToast('ส่งออกภาพไม่สำเร็จ ลองลดความละเอียดหรือเปลี่ยนแผนที่พื้นหลัง');
    } finally {
        extra.forEach(c => c.remove());
        if (savedPixelRatio !== null && currentLayer.isVectorBasemap) currentLayer.getMaplibreMap().setPixelRatio(savedPixelRatio);
        if (target) {
            mapEl.setAttribute('style', savedStyle);
            map.invalidateSize({ pan: false });
            map.setView(savedView.center, savedView.zoom, { reset: true });
        }
        mapEl.classList.remove('export-no-scale');
        legendVisible = prev.legend; updateLegend();
        areLabelsVisible = prev.labels; applyLabelVisibility();
        loadingOverlay.classList.add('hidden');
        controlsContainer.classList.remove('hidden');
        document.body.classList.remove('exporting');
        closeExportPanel();
    }
}
getEl('export-run-btn').addEventListener('click', runExport);

// --- Search Logic ---
// Accepts "13.7563, 100.5018" (as copied from Google Maps) or "13.7563 100.5018".
function parseLatLng(text) {
    const m = String(text).trim().match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*\)?$/);
    if (!m) return null;
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return L.latLng(lat, lng);
}

function performSearch() {
    const query = searchInput.value;
    if (!query) return;

    const coord = parseLatLng(query);
    if (coord) {
        map.flyTo(coord, Math.max(map.getZoom(), 17));
        searchResults.innerHTML = '';
        searchPanel.classList.add('hidden');
        showCreateModal(coord);
        return;
    }

    searchResults.innerHTML = 'กำลังค้นหา...';
    
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&accept-language=th`)
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (searchResultMarker) {
            const index = markers.indexOf(searchResultMarker);
            if (index > -1) markers.splice(index, 1);
            map.removeLayer(searchResultMarker);
            searchResultMarker = null;
        }

        if (data && data.length > 0) {
            const result = data[0];
            const latlng = [result.lat, result.lon];
            map.flyTo(latlng, 16);
            
            searchResultMarker = createMarkerFromData({
                labelText: String(result.display_name || query),
                markerColor: '#475569', // Slate color
                latlng: latlng,
                radii: []
            });
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
    if (typeof stopQuickPin === 'function') stopQuickPin();
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
        textMarkerToEdit.setIcon(textLabelIcon(text, textMarkerToEdit.rotation));
    } else {
        // Creating new text marker
        createTextLabel(tempPinLatLng, text, 0);
    }
    
    stopAllDrawing();
    hideAllModals();
};

saveTextBtn.addEventListener('click', saveTextHandler);
saveNewTextBtn.addEventListener('click', saveTextHandler);


deleteTextBtn.addEventListener('click', () => {
    if (textMarkerToEdit) {
        itemToDelete = { type: 'shape', layer: textMarkerToEdit };
        setDeleteConfirm('ข้อความ', textMarkerToEdit.labelText);
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
        textMarkerToEdit.setIcon(textLabelIcon(textMarkerToEdit.labelText, angle));
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
        createArrowFromLine(layer);
    } else {
        drawnItems.addLayer(layer);
        addLayerContextMenu(layer);
        bindShapePopup(layer);
    }
    
    stopAllDrawing();
});

map.on('draw:drawstop', stopAllDrawing);

// --- Final UI Setup ---
// --- Vector basemaps (MapLibre, loaded only when first chosen) ---
// Rendered inside Leaflet via maplibre-gl-leaflet, so every drawing tool keeps working.
const MAPLIBRE_JS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.1/dist/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.1/dist/maplibre-gl.css';
const MAPLIBRE_LEAFLET_JS = 'https://cdn.jsdelivr.net/npm/@maplibre/maplibre-gl-leaflet@0.1.4/leaflet-maplibre-gl.js';
const OPENFREEMAP_ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';
const VECTOR_STYLES = {
    'Vector · Liberty (คมชัด)': 'https://tiles.openfreemap.org/styles/liberty',
    'Vector · Positron (สว่าง เรียบ)': 'https://tiles.openfreemap.org/styles/positron',
    'Vector · Bright': 'https://tiles.openfreemap.org/styles/bright'
};
let mapLibreLoading = null;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.onload = resolve;
        el.onerror = () => reject(new Error(`โหลดไม่สำเร็จ: ${src}`));
        document.head.appendChild(el);
    });
}

function ensureMapLibre() {
    if (window.maplibregl && L.maplibreGL) return Promise.resolve();
    if (!mapLibreLoading) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = MAPLIBRE_CSS;
        document.head.appendChild(css);
        mapLibreLoading = loadScript(MAPLIBRE_JS).then(() => loadScript(MAPLIBRE_LEAFLET_JS));
        mapLibreLoading.catch(() => { mapLibreLoading = null; });
    }
    return mapLibreLoading;
}

// Show Thai names (fallback: local name) instead of "Latin + Thai" on two lines.
function useThaiLabels(glMap) {
    glMap.getStyle().layers.forEach(layer => {
        if (layer.type !== 'symbol') return;
        const tf = glMap.getLayoutProperty(layer.id, 'text-field');
        if (tf && JSON.stringify(tf).includes('name:latin')) {
            glMap.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:th'], ['get', 'name']]);
        }
    });
}

function createVectorLayer(styleUrl) {
    const layer = L.maplibreGL({
        style: styleUrl,
        attribution: OPENFREEMAP_ATTRIBUTION,
        // needed so the WebGL canvas can be copied into exported images
        canvasContextAttributes: { preserveDrawingBuffer: true },
        preserveDrawingBuffer: true,
        maxCanvasSize: [16384, 16384]
    });
    layer.isVectorBasemap = true;
    return layer;
}

function attachThaiLabels(layer) {
    const gl = layer.getMaplibreMap && layer.getMaplibreMap();
    if (!gl || gl._thaiLabelHook) return;
    gl._thaiLabelHook = true;
    const apply = () => { if (!gl._thaiLabelsApplied && gl.isStyleLoaded()) { gl._thaiLabelsApplied = true; useThaiLabels(gl); } };
    gl.on('styledata', apply);
    gl.on('load', apply);
    apply();
}

let currentBaseMapName = 'แผนที่ปกติ';
async function switchBaseMap(name) {
    layerPanel.classList.add('hidden');
    if (name === currentBaseMapName) return;
    if (!baseMaps[name] && VECTOR_STYLES[name]) {
        showToast('กำลังโหลดแผนที่ vector…');
        try {
            await ensureMapLibre();
            baseMaps[name] = createVectorLayer(VECTOR_STYLES[name]);
        } catch (err) {
            console.error(err);
            showToast('โหลดแผนที่ vector ไม่สำเร็จ ใช้แผนที่เดิมต่อ');
            return;
        }
    }
    map.removeLayer(currentLayer);
    currentLayer = baseMaps[name];
    currentBaseMapName = name;
    map.addLayer(currentLayer);
    if (currentLayer.isVectorBasemap) attachThaiLabels(currentLayer);
    getEl('map').classList.remove('light-mode', 'dark-mode');
}

function addBaseMapButton(name) {
    const button = document.createElement('button');
    button.className = 'w-full text-left p-2 rounded-md hover:bg-gray-100';
    button.textContent = name;
    button.onclick = () => switchBaseMap(name);
    layerOptionsContainer.appendChild(button);
}
Object.keys(baseMaps).forEach(addBaseMapButton);
const vectorHeading = document.createElement('div');
vectorHeading.className = 'px-2 pt-2 pb-1 text-xs text-gray-500 border-t mt-1';
vectorHeading.textContent = 'แผนที่ vector (คมทุกระดับซูม ภาพส่งออกคมกว่า)';
layerOptionsContainer.appendChild(vectorHeading);
Object.keys(VECTOR_STYLES).forEach(addBaseMapButton);

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

// --- Legend (inside the map, so it is included in PNG export) ---
const legendControl = L.control({ position: 'bottomleft' });
legendControl.onAdd = function() {
    const div = L.DomUtil.create('div', 'survey-legend hidden');
    L.DomEvent.disableClickPropagation(div);
    return div;
};
legendControl.addTo(map);

function updateLegend() {
    const div = legendControl.getContainer();
    if (!div) return;
    const counts = {};
    markers.forEach(m => {
        const t = normalizeType(m.pointType);
        if (t !== 'general') counts[t] = (counts[t] || 0) + 1;
    });
    const types = SURVEY_TYPE_ORDER.filter(t => counts[t]);
    if (document.getElementById('empty-hint')) updateEmptyState();
    div.classList.toggle('hidden', !legendVisible || types.length === 0);
    div.innerHTML = '<div class="survey-legend-title">คำอธิบายสัญลักษณ์</div>' + types.map(t =>
        `<div class="survey-legend-row">${surveySymbolSvg(t, 20)}<span>${escapeHtml(SURVEY_TYPES[t].label)}</span><span class="survey-legend-count">${counts[t]} จุด</span></div>`
    ).join('');
}

toggleLegendBtn.setAttribute('aria-pressed', 'true');
toggleLegendBtn.addEventListener('click', () => {
    legendVisible = !legendVisible;
    toggleLegendBtn.setAttribute('aria-pressed', String(legendVisible));
    updateLegend();
    showToast(legendVisible ? 'แสดงคำอธิบายสัญลักษณ์' : 'ซ่อนคำอธิบายสัญลักษณ์');
});

// --- CSV export of points (UTF-8 with BOM so Excel shows Thai correctly) ---
function csvCell(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportPointsCsv() {
    if (markers.length === 0) { showToast('ยังไม่มีหมุดให้ส่งออก'); return; }
    const rows = markers.slice().sort((a, b) => {
        const ta = SURVEY_TYPE_ORDER.indexOf(normalizeType(a.pointType));
        const tb = SURVEY_TYPE_ORDER.indexOf(normalizeType(b.pointType));
        if (ta !== tb) return (ta === 0 ? 99 : ta) - (tb === 0 ? 99 : tb);
        return String(a.code || a.labelText).localeCompare(String(b.code || b.labelText), 'th', { numeric: true });
    }).map(m => {
        const ll = m.getLatLng();
        return [m.code || '', SURVEY_TYPES[normalizeType(m.pointType)].label, m.labelText || '',
            ll.lat.toFixed(6), ll.lng.toFixed(6), m.radii.map(r => r.distance).join('; ')];
    });
    const header = ['รหัส', 'ประเภท', 'ชื่อ/รายละเอียด', 'ละติจูด', 'ลองจิจูด', 'รัศมี (ม.)'];
    const csv = '\uFEFF' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = projectFileName().replace('map-project', 'survey-points').replace('.json', '.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
exportCsvBtn.addEventListener('click', exportPointsCsv);

// --- CSV import (appends points; columns matched by Thai or English header names) ---
function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/, 1)[0];
    const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (ch === '"') inQuotes = false;
            else field += ch;
        } else if (ch === '"') inQuotes = true;
        else if (ch === delim) { row.push(field); field = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(field); rows.push(row); row = []; field = '';
        } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

const CSV_HEADER_ALIASES = {
    code: ['รหัส', 'รหัสจุด', 'code', 'id', 'station'],
    type: ['ประเภท', 'type', 'category'],
    name: ['ชื่อ/รายละเอียด', 'ชื่อ', 'รายละเอียด', 'name', 'label', 'description'],
    lat: ['ละติจูด', 'lat', 'latitude', 'y'],
    lng: ['ลองจิจูด', 'lng', 'lon', 'long', 'longitude', 'x'],
    radius: ['รัศมี (ม.)', 'รัศมี', 'radius', 'radii', 'radius (m)']
};

function typeFromCsv(typeText, code) {
    const t = String(typeText || '').trim().toLowerCase();
    for (const key of SURVEY_TYPE_ORDER) {
        if (t && (t === key || t === SURVEY_TYPES[key].label.toLowerCase())) return key;
    }
    if (t.includes('ไม่มีสัญญาณ') || t.includes('unsignal')) return 'tmc_unsignal';
    if (t.includes('สัญญาณไฟ') || t.includes('signal')) return 'tmc_signal';
    if (t.includes('กลับรถ') || t.includes('u-turn') || t.includes('uturn')) return 'uturn';
    if (t.includes('คนเดิน') || t.includes('pedestrian')) return 'ped';
    if (t.includes('od')) return 'od';
    if (t.includes('ช่วงถนน') || t.includes('link')) return 'mb';
    const prefix = String(code || '').trim().toUpperCase().split('-')[0];
    const byPrefix = { TMC: 'tmc_signal', UT: 'uturn', MB: 'mb', PC: 'ped', OD: 'od' };
    return byPrefix[prefix] || 'general';
}

function importPointsCsv(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) { showToast('ไฟล์ CSV ไม่มีข้อมูล'); return; }
    const header = rows[0].map(h => String(h).trim().toLowerCase());
    const col = {};
    Object.entries(CSV_HEADER_ALIASES).forEach(([key, names]) => {
        col[key] = header.findIndex(h => names.includes(h));
    });
    if (col.lat < 0 || col.lng < 0) { showToast('ไม่พบคอลัมน์ละติจูด/ลองจิจูด (lat, lng)'); return; }
    let added = 0, skipped = 0;
    const bounds = L.latLngBounds([]);
    rows.slice(1).forEach(r => {
        const lat = parseFloat(String(r[col.lat] ?? '').replace(/\s/g, ''));
        const lng = parseFloat(String(r[col.lng] ?? '').replace(/\s/g, ''));
        if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { skipped++; return; }
        const code = col.code >= 0 ? String(r[col.code] ?? '').trim() : '';
        const type = typeFromCsv(col.type >= 0 ? r[col.type] : '', code);
        const radii = col.radius >= 0
            ? String(r[col.radius] ?? '').split(/[;|\/]/).map(v => parseFloat(v)).filter(v => v > 0)
                .map((d, i) => ({ id: Date.now() + added * 100 + i, distance: d, color: '#3388ff' }))
            : [];
        createMarkerFromData({
            labelText: col.name >= 0 ? String(r[col.name] ?? '').trim() : '',
            markerColor: type === 'general' ? '#2563eb' : SURVEY_TYPES[type].color,
            pointType: type,
            code: type === 'general' ? '' : (code || nextCode(SURVEY_TYPES[type].prefix)),
            latlng: L.latLng(lat, lng),
            radii
        });
        bounds.extend([lat, lng]);
        added++;
    });
    updateLegend();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
    clearTimeout(historyTimer);
    recordHistory();
    showToast(`นำเข้า ${added} จุด${skipped ? ` (ข้าม ${skipped} แถวที่พิกัดไม่ถูกต้อง)` : ''}`);
}

const importCsvInput = getEl('import-csv-input');
getEl('import-csv-btn').addEventListener('click', () => importCsvInput.click());
importCsvInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try { importPointsCsv(String(e.target.result)); }
        catch (err) { console.error(err); showToast('อ่านไฟล์ CSV ไม่สำเร็จ'); }
    };
    reader.readAsText(file, 'utf-8');
    importCsvInput.value = '';
});

// --- KML export (Google Earth / Google My Maps) ---
function xmlEscape(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function kmlColor(hex, alpha = 'ff') {
    const h = safeColor(hex, '#3388ff').replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
    return alpha + full.slice(4, 6) + full.slice(2, 4) + full.slice(0, 2); // aabbggrr
}
function circleRing(center, radiusM, steps = 72) {
    const R = 6378137, lat = center.lat * Math.PI / 180, lng = center.lng * Math.PI / 180, d = radiusM / R;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const brg = 2 * Math.PI * i / steps;
        const lat2 = Math.asin(Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(brg));
        const lng2 = lng + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat), Math.cos(d) - Math.sin(lat) * Math.sin(lat2));
        pts.push(`${(lng2 * 180 / Math.PI).toFixed(7)},${(lat2 * 180 / Math.PI).toFixed(7)},0`);
    }
    return pts.join(' ');
}
function coordsOf(latlngs) { return latlngs.map(ll => `${ll.lng.toFixed(7)},${ll.lat.toFixed(7)},0`).join(' '); }

function exportKml() {
    if (markers.length === 0 && drawnItems.getLayers().length === 0) { showToast('ยังไม่มีข้อมูลให้ส่งออก'); return; }
    const styles = [], folders = [];
    const typesUsed = [...SURVEY_TYPE_ORDER.slice(1), 'general'].filter(t => markers.some(m => normalizeType(m.pointType) === t));
    typesUsed.forEach(t => {
        const pins = markers.filter(m => normalizeType(m.pointType) === t);
        const placemarks = pins.map((m, i) => {
            const color = t === 'general' ? m.markerColor : SURVEY_TYPES[t].color;
            const styleId = `s-${t}-${i}`;
            styles.push(`<Style id="${styleId}"><IconStyle><color>${kmlColor(color)}</color><scale>1.1</scale><Icon><href>https://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href></Icon></IconStyle><LabelStyle><scale>0.9</scale></LabelStyle></Style>`);
            const ll = m.getLatLng();
            const name = displayName(m) || SURVEY_TYPES[t].label;
            const desc = `ประเภท: ${SURVEY_TYPES[t].label}${m.radii.length ? `\nรัศมี: ${m.radii.map(r => r.distance + ' ม.').join(', ')}` : ''}`;
            const rings = m.radii.map(r => `<Placemark><name>${xmlEscape(name)} · ${r.distance} ม.</name><Style><LineStyle><color>${kmlColor(r.color)}</color><width>2</width></LineStyle><PolyStyle><color>${kmlColor(r.color, '33')}</color></PolyStyle></Style><Polygon><outerBoundaryIs><LinearRing><coordinates>${circleRing(ll, r.distance)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`).join('');
            return `<Placemark><name>${xmlEscape(name)}</name><description>${xmlEscape(desc)}</description><styleUrl>#${styleId}</styleUrl><Point><coordinates>${ll.lng.toFixed(7)},${ll.lat.toFixed(7)},0</coordinates></Point></Placemark>${rings}`;
        }).join('');
        folders.push(`<Folder><name>${xmlEscape(SURVEY_TYPES[t].label)} (${pins.length})</name>${placemarks}</Folder>`);
    });
    const shapes = [];
    drawnItems.eachLayer(layer => {
        if (layer.isTextLabel) {
            const ll = layer.getLatLng();
            shapes.push(`<Placemark><name>${xmlEscape(layer.labelText)}</name><Style><IconStyle><scale>0</scale></IconStyle></Style><Point><coordinates>${ll.lng.toFixed(7)},${ll.lat.toFixed(7)},0</coordinates></Point></Placemark>`);
            return;
        }
        const line = layer.isArrow ? layer.getLayers().find(l => l instanceof L.Polyline) : layer;
        const color = line.options.color;
        const style = `<Style><LineStyle><color>${kmlColor(color)}</color><width>3</width></LineStyle><PolyStyle><color>${kmlColor(color, '33')}</color></PolyStyle></Style>`;
        if (line instanceof L.Circle) {
            shapes.push(`<Placemark><name>วงกลม ${Math.round(line.getRadius())} ม.</name>${style}<Polygon><outerBoundaryIs><LinearRing><coordinates>${circleRing(line.getLatLng(), line.getRadius())}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`);
        } else if (line instanceof L.Polygon) {
            const ring = line.getLatLngs()[0];
            shapes.push(`<Placemark><name>รูปหลายเหลี่ยม</name>${style}<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordsOf([...ring, ring[0]])}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`);
        } else if (line instanceof L.Polyline) {
            shapes.push(`<Placemark><name>${layer.isArrow ? 'ลูกศร' : 'เส้น'}</name>${style}<LineString><tessellate>1</tessellate><coordinates>${coordsOf(line.getLatLngs())}</coordinates></LineString></Placemark>`);
        }
    });
    if (shapes.length) folders.push(`<Folder><name>รูปทรงและข้อความ (${shapes.length})</name>${shapes.join('')}</Folder>`);
    const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xmlEscape(exportTitle.value.trim() || 'Map Tools')}</name>${styles.join('')}${folders.join('')}</Document></kml>`;
    const url = URL.createObjectURL(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = projectFileName().replace('map-project', 'map').replace('.json', '.kml');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
getEl('export-kml-btn').addEventListener('click', exportKml);

// --- Quick pin mode: click the map repeatedly to drop pins of one type ---
let quickPinActive = false;
const quickBar = document.createElement('div');
quickBar.id = 'quick-pin-bar';
quickBar.className = 'hidden';
quickBar.setAttribute('role', 'toolbar');
quickBar.innerHTML = `
    <span class="quick-pin-title">ปักหมุดเร็ว</span>
    <label class="sr-only" for="quick-pin-type">ประเภทจุด</label>
    <select id="quick-pin-type"></select>
    <span id="quick-pin-next" class="quick-pin-next"></span>
    <button id="quick-pin-done" type="button">หยุดปักหมุด</button>`;
document.body.appendChild(quickBar);
const quickPinType = getEl('quick-pin-type'), quickPinNext = getEl('quick-pin-next'), quickPinDone = getEl('quick-pin-done');
SURVEY_TYPE_ORDER.forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = SURVEY_TYPES[key].label;
    quickPinType.appendChild(opt);
});

function updateQuickNext() {
    const type = normalizeType(quickPinType.value);
    const code = nextCode(SURVEY_TYPES[type].prefix);
    quickPinNext.textContent = code ? `ถัดไป: ${code}` : 'คลิกบนแผนที่เพื่อวางหมุด';
}

function startQuickPin() {
    stopAllDrawing();
    hideContextMenu();
    quickPinActive = true;
    quickPinType.value = lastPointType;
    updateQuickNext();
    quickBar.classList.remove('hidden');
    quickPinBtn.classList.add('active');
    L.DomUtil.addClass(map.getContainer(), 'cursor-quick-pin');
    toolPanel.classList.add('hidden');
    if (document.getElementById('empty-hint')) updateEmptyState();
}

function stopQuickPin() {
    if (!quickPinActive) return;
    quickPinActive = false;
    quickBar.classList.add('hidden');
    quickPinBtn.classList.remove('active');
    L.DomUtil.removeClass(map.getContainer(), 'cursor-quick-pin');
    if (document.getElementById('empty-hint')) updateEmptyState();
}

quickPinType.addEventListener('change', () => { lastPointType = normalizeType(quickPinType.value); updateQuickNext(); });
quickPinDone.addEventListener('click', stopQuickPin);

map.on('click', function(e) {
    if (!quickPinActive) return;
    const type = normalizeType(quickPinType.value);
    createMarkerFromData({
        labelText: '',
        markerColor: type === 'general' ? selectedColor : SURVEY_TYPES[type].color,
        pointType: type,
        code: nextCode(SURVEY_TYPES[type].prefix),
        latlng: e.latlng,
        radii: []
    });
    lastPointType = type;
    updateLegend();
    updateQuickNext();
    clearTimeout(historyTimer);
    recordHistory(); // each quick pin is its own undo step
});

const quickPinBtn = getEl('quick-pin-btn');
quickPinBtn.addEventListener('click', () => (quickPinActive ? stopQuickPin() : startQuickPin()));

// --- Undo / Redo (snapshot history of the whole project) ---
const HISTORY_LIMIT = 100;
let historyStack = [];
let historyIndex = -1;
let historyTimer = null;
const undoBtn = getEl('undo-btn'), redoBtn = getEl('redo-btn');

function projectSnapshot() {
    const data = serializeProject();
    return JSON.stringify({ markers: data.markers, shapes: data.shapes });
}

function updateHistoryButtons() {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= historyStack.length - 1;
}

function recordHistory() {
    historyTimer = null;
    const snap = projectSnapshot();
    if (historyStack[historyIndex] === snap) return;
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(snap);
    if (historyStack.length > HISTORY_LIMIT) historyStack.shift();
    historyIndex = historyStack.length - 1;
    updateHistoryButtons();
}

function recordHistorySoon() {
    clearTimeout(historyTimer);
    historyTimer = setTimeout(recordHistory, 120);
}

function restoreHistory(index) {
    if (index < 0 || index >= historyStack.length) return;
    clearTimeout(historyTimer);
    historyTimer = null;
    stopAllDrawing();
    hideAllModals();
    hideContextMenu();
    historyIndex = index;
    loadProject(JSON.parse(historyStack[index]));
    // Store the re-serialised form so a no-op comparison never discards the redo stack.
    historyStack[index] = projectSnapshot();
    updateHistoryButtons();
    if (quickPinActive) updateQuickNext();
}

function undo() {
    recordHistory(); // capture any change not yet recorded
    restoreHistory(historyIndex - 1);
}
function redo() { restoreHistory(historyIndex + 1); }

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

// Any finished interaction may have changed the project; the snapshot comparison
// decides whether a history step is actually recorded.
['mouseup', 'touchend', 'keyup', 'change'].forEach(evt => document.addEventListener(evt, recordHistorySoon, true));
map.on('draw:created draw:edited draw:deleted', recordHistorySoon);

document.addEventListener('keydown', (e) => {
    const target = e.target;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
    if (typing || !(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo(); }
});

// --- Tool panel toggle reflects its state for tooltips and assistive tech ---
(function () {
    const btn = getEl('toggle-tool-panel-btn');
    const sync = () => {
        const open = !toolPanel.classList.contains('hidden');
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', open ? 'ปิดเครื่องมือ' : 'เปิดเครื่องมือ');
        btn.dataset.tip = open ? 'ปิดเครื่องมือ' : 'เปิดเครื่องมือ';
        if (document.getElementById('empty-hint')) updateEmptyState();
    };
    new MutationObserver(sync).observe(toolPanel, { attributes: true, attributeFilter: ['class'] });
    sync();
})();

// --- First-use guidance (shown only while the map has no pins or shapes) ---
let emptyHintDismissed = false;
const emptyHint = document.createElement('section');
emptyHint.id = 'empty-hint';
emptyHint.className = 'hidden';
emptyHint.setAttribute('aria-labelledby', 'empty-hint-title');
emptyHint.innerHTML = `
    <div class="empty-hint-head">
        <h2 id="empty-hint-title">เริ่มทำแผนจุดสำรวจ</h2>
        <button type="button" id="empty-hint-close" aria-label="ปิดคำแนะนำ">×</button>
    </div>
    <p>วางจุดนับรถพร้อมรหัสอัตโนมัติ แล้วส่งออกเป็นภาพหรือ CSV สำหรับรายงาน หรือคลิกขวาบนแผนที่เพื่อปักหมุดทีละจุด</p>
    <div class="empty-hint-actions">
        <button type="button" id="empty-hint-quick" class="primary">ปักหมุดเร็ว</button>
        <button type="button" id="empty-hint-import">นำเข้า CSV</button>
        <button type="button" id="empty-hint-open">เปิดโปรเจกต์</button>
    </div>`;
document.body.appendChild(emptyHint);
function updateEmptyState() {
    const empty = markers.length === 0 && drawnItems.getLayers().length === 0;
    const bar = document.getElementById('quick-pin-bar');
    const quickOn = !!bar && !bar.classList.contains('hidden');
    const toolsOpen = !toolPanel.classList.contains('hidden');
    emptyHint.classList.toggle('hidden', !empty || emptyHintDismissed || quickOn || toolsOpen);
}
getEl('empty-hint-close').addEventListener('click', () => { emptyHintDismissed = true; updateEmptyState(); });
getEl('empty-hint-quick').addEventListener('click', () => { startQuickPin(); updateEmptyState(); });
getEl('empty-hint-import').addEventListener('click', () => importCsvInput.click());
getEl('empty-hint-open').addEventListener('click', () => fileInput.click());
drawnItems.on('layeradd layerremove', updateEmptyState);
quickPinDone.addEventListener('click', updateEmptyState);

// --- Dialog focus: move focus in, trap Tab inside, restore to the trigger on close ---
const DIALOG_INITIAL_FOCUS = {
    'delete-confirm-modal': '#cancel-delete-btn',
    'delete-all-confirm-modal': '#cancel-delete-all-btn'
};
const FOCUSABLE = 'button:not([disabled]), [href], input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function visibleDialogs() {
    return [...document.querySelectorAll('[id$="-modal"].fixed')].filter(m => !m.classList.contains('hidden'));
}
document.querySelectorAll('[id$="-modal"].fixed').forEach(modal => {
    modal.setAttribute('role', modal.id.includes('delete') ? 'alertdialog' : 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const heading = modal.querySelector('h3');
    if (heading) { heading.id = heading.id || `${modal.id}-title`; modal.setAttribute('aria-labelledby', heading.id); }
    let wasOpen = !modal.classList.contains('hidden');
    new MutationObserver(() => {
        const open = !modal.classList.contains('hidden');
        if (open === wasOpen) return;
        wasOpen = open;
        if (open) {
            if (!modal.contains(document.activeElement)) modal._returnFocus = document.activeElement;
            setTimeout(() => {
                const forced = DIALOG_INITIAL_FOCUS[modal.id] && modal.querySelector(DIALOG_INITIAL_FOCUS[modal.id]);
                if (forced) forced.focus();
                else if (!modal.contains(document.activeElement)) {
                    const first = [...modal.querySelectorAll(FOCUSABLE)].find(el => el.offsetParent !== null);
                    if (first) first.focus();
                }
            }, 0);
        } else {
            const back = modal._returnFocus;
            modal._returnFocus = null;
            if (back && document.contains(back) && back !== document.body && visibleDialogs().length === 0 && typeof back.focus === 'function') back.focus();
        }
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
});
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const dialogs = visibleDialogs();
    if (!dialogs.length) return;
    const top = dialogs[dialogs.length - 1];
    const items = [...top.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (!top.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

// --- Keyboard: Escape cancels the current tool, menu or dialog ---
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeExportPanel();
    hideContextMenu();
    stopAllDrawing();
    hideAllModals();
    deleteAllConfirmModal.classList.add('hidden');
});

// --- Restore last session and keep autosaving ---
restoreAutosave();
applyLabelVisibility();
updateEmptyState();
recordHistory();
autosaveNow();
setInterval(autosaveNow, 2000);
window.addEventListener('beforeunload', autosaveNow);
