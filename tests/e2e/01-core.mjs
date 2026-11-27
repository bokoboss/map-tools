import { chromium } from 'playwright';
const OUT = process.env.OUT_DIR;
const BASE = process.env.BASE_URL;
import fs from 'fs';
const URL = BASE;
const results = [];
const check = (name, ok, extra='') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
const tool = async (sel) => { await page.evaluate(() => document.getElementById('main-tool-panel').classList.remove('hidden')); await page.click(sel); };
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/tile|Failed to load resource/i.test(m.text())) errors.push(m.text()); });
await page.goto(URL); await page.waitForFunction(() => window.L && document.querySelector('.leaflet-container'));
await page.waitForTimeout(800);

// 1. Add pin via right-click menu with XSS label
await page.mouse.click(640, 400, { button: 'right' });
await page.locator('#context-menu a', { hasText: 'เพิ่มหมุดที่นี่' }).click();
await page.fill('#pin-label-input', 'ATC-01 <img src=x onerror="window.__xss=1">');
await page.click('#save-pin-btn');
check('pin created', await page.evaluate(() => markers.length) === 1);
// 2. radii via context menu on marker
await page.evaluate(() => markers[0].fire('contextmenu', { originalEvent: new MouseEvent('contextmenu'), containerPoint: L.point(600,380), latlng: markers[0].getLatLng() }));
await page.locator('#context-menu a', { hasText: 'จัดการรัศมี' }).click();
for (const d of ['100','250']) { await page.fill('#radius-input', d); await page.click('#add-radius-btn'); }
await page.fill('#radius-input', '0'); await page.click('#add-radius-btn');
check('two radii, zero rejected', await page.evaluate(() => markers[0].radii.map(r=>r.distance).join()) === '100,250');
await page.click('#close-radius-modal-btn');
await tool('#toggle-labels-btn');
check('label escaped (no xss)', await page.evaluate(() => window.__xss === undefined && document.body.innerHTML.includes('&lt;img')));

// 3. real polygon draw by clicks
await tool('#draw-polygon-btn');
for (const [x,y] of [[300,200],[420,200],[420,300]]) { await page.mouse.click(x,y); await page.waitForTimeout(150); }
await page.mouse.click(300,200); await page.waitForTimeout(300);
check('polygon drawn', await page.evaluate(() => drawnItems.getLayers().filter(l => l instanceof L.Polygon).length) === 1);
// text, arrow, circle, line via factories
await page.evaluate(() => {
  createTextLabel(map.containerPointToLatLng([800,300]), 'จุดนับ A', 30);
  createArrowFromLine(L.polyline([map.containerPointToLatLng([700,500]), map.containerPointToLatLng([850,450])], { color: '#e11d48', weight: 3 }));
  addShapeLayer(L.circle(map.containerPointToLatLng([900,600]), { radius: 120, color: '#f59e0b' }));
  addShapeLayer(L.polyline([map.containerPointToLatLng([200,600]), map.containerPointToLatLng([400,650])], { color: '#3388ff', weight: 4 }));
});
// 4. save
const [dl] = await Promise.all([page.waitForEvent('download'), tool('#save-btn')]);
const savedPath = OUT + '/saved.json'; await dl.saveAs(savedPath);
const saved = JSON.parse(fs.readFileSync(savedPath,'utf8'));
check('save file v2 + name', saved.version === 2 && /^map-project-\d{8}-\d{4}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
check('saved kinds', saved.shapes.map(s=>s.kind).sort().join() === 'arrow,circle,geojson,geojson,text', saved.shapes.map(s=>s.kind).join());

// 5. reload -> autosave restore
await page.waitForTimeout(2300);
await page.reload(); await page.waitForTimeout(1200);
const st = await page.evaluate(() => ({ m: markers.length, r: markers[0]?.radii.length, label: markers[0]?.labelText,
  text: drawnItems.getLayers().filter(l=>l.isTextLabel).map(l=>l.labelText+'@'+l.rotation).join(),
  arrows: drawnItems.getLayers().filter(l=>l.isArrow).length, circles: drawnItems.getLayers().filter(l=>l instanceof L.Circle).length,
  toast: document.getElementById('app-toast')?.textContent }));
check('autosave restored', st.m===1 && st.r===2 && st.text==='จุดนับ A@30' && st.arrows===1 && st.circles===1, JSON.stringify(st));

// 6. delete all, open saved file
await tool('#delete-all-btn'); await page.click('#confirm-delete-all-btn');
check('cleared', await page.evaluate(() => markers.length + drawnItems.getLayers().length) === 0);
await page.setInputFiles('#file-input', savedPath); await page.waitForTimeout(600);
const op = await page.evaluate(() => ({ m: markers.length, shapes: drawnItems.getLayers().length,
  arrowColor: drawnItems.getLayers().find(l=>l.isArrow)?.getLayers().find(x=>x instanceof L.Polyline).options.color,
  polyHasMenu: !!drawnItems.getLayers().find(l=>l instanceof L.Polygon)?.listens('contextmenu') }));
check('open restores all', op.m===1 && op.shapes===5 && op.arrowColor==='#e11d48' && op.polyHasMenu, JSON.stringify(op));

// 7. legacy file (original format: arrow = LineString + bare Point, text = bare Point)
const legacy = { markers: [{ labelText: 'old pin', markerColor: '#22c55e', latlng: { lat: 13.75, lng: 100.5 }, radii: [{ id: 1, distance: 500, color: '#3388ff' }] }],
  drawnShapes: { type: 'FeatureCollection', features: [
    { type:'Feature', properties:{ style:{ color:'#10b981' } }, geometry:{ type:'LineString', coordinates:[[100.50,13.75],[100.51,13.76]] } },
    { type:'Feature', properties:{}, geometry:{ type:'Point', coordinates:[100.51,13.76] } },
    { type:'Feature', properties:{}, geometry:{ type:'Point', coordinates:[100.52,13.74] } },
    { type:'Feature', properties:{ style:{ color:'#f59e0b' }, radius: 300 }, geometry:{ type:'Point', coordinates:[100.49,13.74] } },
    { type:'Feature', properties:{ style:{ color:'#f06eaa' } }, geometry:{ type:'Polygon', coordinates:[[[100.5,13.7],[100.51,13.7],[100.51,13.71],[100.5,13.7]]] } } ] } };
fs.writeFileSync(OUT + '/legacy.json', JSON.stringify(legacy));
await page.setInputFiles('#file-input', OUT + '/legacy.json'); await page.waitForTimeout(600);
const lg = await page.evaluate(() => ({ m: markers.length, r: markers[0].radii[0].distance,
  arrows: drawnItems.getLayers().filter(l=>l.isArrow).length, texts: drawnItems.getLayers().filter(l=>l.isTextLabel).length,
  circles: drawnItems.getLayers().filter(l=>l instanceof L.Circle).map(c=>c.getRadius()).join(), polys: drawnItems.getLayers().filter(l=>l instanceof L.Polygon).length }));
check('legacy file opens', lg.m===1 && lg.r===500 && lg.arrows===1 && lg.texts===1 && lg.circles==='300' && lg.polys===1, JSON.stringify(lg));

// 8. coordinate search
await page.click('#toggle-search-btn'); await page.fill('#search-input', '13.7466, 100.5393'); await page.press('#search-input','Enter');
await page.waitForTimeout(300);
check('coord search opens pin dialog', await page.isVisible('#pin-modal'));
await page.fill('#pin-label-input', 'TMC-02'); await page.click('#save-pin-btn');
const ll = await page.evaluate(() => markers.at(-1).getLatLng());
check('pin at pasted coord', Math.abs(ll.lat-13.7466)<1e-9 && Math.abs(ll.lng-100.5393)<1e-9);

// 9. Escape closes dialog; PNG export still produces a file
await page.mouse.click(640, 400, { button: 'right' }); await page.locator('#context-menu a', { hasText: 'เพิ่มหมุดที่นี่' }).click();
await page.keyboard.press('Escape');
check('escape closes modal', !(await page.isVisible('#pin-modal')));
const [png] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), (async()=>{await tool('#export-image-btn'); await page.selectOption('#export-paper','screen'); await page.click('#export-run-btn');})()]);
check('png export', png.suggestedFilename() === 'map-capture.png');
await page.screenshot({ path: OUT + '/classic.png' });
check('no page errors', errors.length === 0, errors.join(' | '));
console.log(results.join('\n')); if (results.some(l => l.startsWith('FAIL'))) process.exitCode = 1;
await browser.close();
