import { chromium } from 'playwright';
const OUT = process.env.OUT_DIR;
const BASE = process.env.BASE_URL;
import fs from 'fs';
const out = []; const check = (n, ok, x='') => out.push(`${ok?'PASS':'FAIL'} ${n} ${x}`);
const pngSize = f => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const b = await chromium.launch(); const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message));
const tool = async s => { await p.evaluate(() => document.getElementById('main-tool-panel').classList.remove('hidden')); await p.click(s); };
await p.goto(BASE); await p.waitForTimeout(900);

// CSV import (Thai, own export format)
await tool('#import-csv-btn').catch(()=>{});
await p.setInputFiles('#import-csv-input', OUT + '/import-th.csv'); await p.waitForTimeout(800);
const th = await p.evaluate(() => markers.map(m => `${m.pointType}|${m.code}|${m.labelText}|${m.radii.map(r=>r.distance).join('/')}`));
check('thai csv: 7 imported, bad row skipped', th.length === 7, th.join(' / '));
check('types from labels', th[0] === 'tmc_signal|TMC-01|แยกปทุมวัน, หน้า MBK|100/250' && th[1].startsWith('tmc_unsignal|TMC-02') && th[3].startsWith('uturn|UT-01||') && th[6] === 'general||จุดจอดรถ|');
check('toast reports skip', (await p.innerText('#app-toast')).includes('ข้าม 1'), await p.innerText('#app-toast'));
check('legend after import', (await p.evaluate(() => document.querySelector('.survey-legend').innerText)).includes('จุดกลับรถ'));
// English, semicolon, quotes, type from prefix
await p.setInputFiles('#import-csv-input', OUT + '/import-en.csv'); await p.waitForTimeout(800);
const en = await p.evaluate(() => markers.slice(7).map(m => `${m.pointType}|${m.code}|${m.labelText}`));
check('english csv appended + prefix types', en.join(',') === 'tmc_signal|TMC-07|Junction "A",mb|MB-03|Link B,general||plain point', en.join(','));
await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
check('undo removes whole import', await p.evaluate(() => markers.length) === 7);
// round trip: export CSV then re-import equals
const [csvDl] = await Promise.all([p.waitForEvent('download'), tool('#export-csv-btn')]); await csvDl.saveAs(OUT + '/rt.csv');
await tool('#delete-all-btn'); await p.click('#confirm-delete-all-btn');
await p.setInputFiles('#import-csv-input', OUT + '/rt.csv'); await p.waitForTimeout(800);
const rt = await p.evaluate(() => markers.map(m => `${m.pointType}|${m.code}|${m.labelText}|${m.radii.map(r=>r.distance).join('/')}`));
check('csv round trip', JSON.stringify(rt.slice().sort()) === JSON.stringify(th.slice().sort()));

// add a polygon + text for KML
await p.evaluate(() => { createTextLabel(map.getCenter(), 'โครงการ', 0); addShapeLayer(L.polygon([[13.740,100.525],[13.742,100.528],[13.739,100.529]], { color: '#f06eaa' })); });
const [kmlDl] = await Promise.all([p.waitForEvent('download'), tool('#export-kml-btn')]); await kmlDl.saveAs(OUT + '/out.kml');
check('kml filename', kmlDl.suggestedFilename().endsWith('.kml'));

// report export A4 landscape 200 dpi with title
const before = await p.evaluate(() => ({ c: map.getCenter(), z: map.getZoom(), s: map.getSize() }));
await tool('#export-image-btn');
check('export panel + frame shown', await p.isVisible('#export-panel') && await p.isVisible('#export-frame'));
check('size info A4L 200', (await p.innerText('#export-size-info')) === '2339 × 1654 px');
await p.fill('#export-title', 'ตำแหน่งจุดสำรวจปริมาณจราจร บริเวณสยาม');
const frame = await p.evaluate(() => { const r = document.getElementById('export-frame').getBoundingClientRect(); const c = map.containerPointToLatLng([r.left + r.width/2, r.top + r.height/2]); return { c, r: r.width / r.height }; });
check('frame ratio A4', Math.abs(frame.r - 297/210) < 0.01);
const [png] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('#export-run-btn')]);
await png.saveAs(OUT + '/report-a4l.png');
const [w, h] = pngSize(OUT + '/report-a4l.png');
check('A4L 200dpi pixel size', w === 2339 && Math.abs(h - 1654) <= 1, `${w}x${h}`);
await p.waitForTimeout(400);
const after = await p.evaluate(() => ({ c: map.getCenter(), z: map.getZoom(), s: map.getSize() }));
check('map restored after export', after.z === before.z && after.s.x === before.s.x && Math.abs(after.c.lat - before.c.lat) < 1e-7 && Math.abs(after.c.lng - before.c.lng) < 1e-7, JSON.stringify([before, after]));
check('panel closed, controls back', !(await p.isVisible('#export-panel')) && await p.isVisible('#controls-container'));
check('temporary title removed', await p.locator('.export-title-block').count() === 0);
// A3 portrait 150 dpi, no labels / legend, then Esc closes
await tool('#export-image-btn'); await p.selectOption('#export-paper', 'a3p'); await p.selectOption('#export-dpi', '150');
await p.uncheck('#export-legend'); await p.uncheck('#export-north');
const [png2] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('#export-run-btn')]);
await png2.saveAs(OUT + '/report-a3p.png');
const [w2, h2] = pngSize(OUT + '/report-a3p.png');
check('A3P 150dpi pixel size', w2 === 1754 && Math.abs(h2 - 2480) <= 1, `${w2}x${h2}`);
check('legend setting restored after export', await p.evaluate(() => legendVisible === true && !document.querySelector('.survey-legend').classList.contains('hidden')));
await tool('#export-image-btn'); await p.keyboard.press('Escape');
check('esc closes export panel', !(await p.isVisible('#export-panel')));
check('scale bar on map', await p.locator('.leaflet-control-scale').isVisible());
check('no page errors', errs.length === 0, errs.join(' | '));
console.log(out.join('\n')); if (out.some(l => l.startsWith('FAIL'))) process.exitCode = 1; await b.close();
