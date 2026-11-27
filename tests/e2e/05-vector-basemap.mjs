import { chromium } from 'playwright';
const OUT = process.env.OUT_DIR;
const BASE = process.env.BASE_URL;
import fs from 'fs';
const out = []; const check = (n, ok, x='') => out.push(`${ok?'PASS':'FAIL'} ${n} ${x}`);
const pngSize = f => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
const tool = async s => { await p.evaluate(() => document.getElementById('main-tool-panel').classList.remove('hidden')); await p.click(s); };
await p.goto(BASE); await p.waitForTimeout(900);
check('maplibre not loaded at start', await p.evaluate(() => !window.maplibregl));
await p.setInputFiles('#import-csv-input', OUT + '/import-th.csv'); await p.waitForTimeout(800);
await p.click('#toggle-layers-btn');
await p.locator('#layer-options button', { hasText: 'Vector · Liberty' }).click();
await p.waitForFunction(() => window.maplibregl && currentLayer.isVectorBasemap, null, { timeout: 20000 });
await p.waitForFunction(() => { const g = currentLayer.getMaplibreMap(); return g.loaded() && g.areTilesLoaded(); }, null, { timeout: 30000 });
await p.waitForTimeout(1500);
check('vector basemap active', await p.evaluate(() => currentBaseMapName.startsWith('Vector')));
const tf = await p.evaluate(() => { const g = currentLayer.getMaplibreMap(); const l = g.getStyle().layers.find(x => x.type === 'symbol' && JSON.stringify(g.getLayoutProperty(x.id, 'text-field') || '').includes('name:th')); return l ? l.id : null; });
check('thai label expression applied', !!tf, tf);
check('attribution openfreemap', (await p.innerText('.leaflet-control-attribution')).includes('OpenFreeMap'));
check('pins still on top', await p.locator('.survey-marker-icon').count() === 6);
await p.screenshot({ path: OUT + '/vector-ui.png' });
// draw still works on vector
await p.mouse.click(640, 400, { button: 'right' }); await p.locator('#context-menu a', { hasText: 'เพิ่มหมุดที่นี่' }).click();
await p.selectOption('#pin-type-select', 'mb'); await p.click('#save-pin-btn');
check('add pin on vector map', await p.evaluate(() => markers.length) === 8);
// export A4L 200 dpi
await tool('#export-image-btn'); await p.fill('#export-title', 'ทดสอบแผนที่ vector');
const [png] = await Promise.all([p.waitForEvent('download', { timeout: 90000 }), p.click('#export-run-btn')]);
await png.saveAs(OUT + '/vector-a4l.png');
const [w, h] = pngSize(OUT + '/vector-a4l.png');
check('vector A4L size', w === 2339 && Math.abs(h - 1654) <= 1, `${w}x${h}`);
check('pixel ratio restored', await p.evaluate(() => currentLayer.getMaplibreMap().getPixelRatio()) === 1);
// screen export
await tool('#export-image-btn'); await p.selectOption('#export-paper', 'screen');
const [png2] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('#export-run-btn')]);
await png2.saveAs(OUT + '/vector-screen.png');
// switch back to raster
await p.click('#toggle-layers-btn'); await p.locator('#layer-options button', { hasText: 'แผนที่ปกติ' }).click(); await p.waitForTimeout(800);
check('back to raster', await p.evaluate(() => !currentLayer.isVectorBasemap && currentBaseMapName === 'แผนที่ปกติ'));
check('no gl canvas left', await p.locator('.leaflet-gl-layer').count() === 0);
check('no page errors', errs.length === 0, errs.join(' | '));
console.log(out.join('\n')); if (out.some(l => l.startsWith('FAIL'))) process.exitCode = 1; await b.close();
