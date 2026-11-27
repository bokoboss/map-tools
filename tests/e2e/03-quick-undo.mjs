import { chromium } from 'playwright';
const OUT = process.env.OUT_DIR;
const BASE = process.env.BASE_URL;
const out = []; const check = (n, ok, x='') => out.push(`${ok?'PASS':'FAIL'} ${n} ${x}`);
const b = await chromium.launch(); const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message));
const tool = async s => { await p.evaluate(() => document.getElementById('main-tool-panel').classList.remove('hidden')); await p.click(s); };
const count = () => p.evaluate(() => markers.length);
await p.goto(BASE); await p.waitForTimeout(900);
check('undo disabled at start', await p.isDisabled('#undo-btn'));

// 1. optional name
await p.mouse.click(300, 300, { button: 'right' }); await p.locator('#context-menu a', { hasText: 'เพิ่มหมุดที่นี่' }).click();
await p.selectOption('#pin-type-select', 'general'); await p.click('#save-pin-btn');
check('general pin saved without name', await count() === 1);
check('no empty label bubble', await p.locator('.pin-label').count() === 0);
check('popup not empty', (await p.evaluate(() => markers[0].getPopup().getContent())).includes('ไม่มีชื่อ'));
await p.mouse.click(400, 300, { button: 'right' }); await p.locator('#context-menu a', { hasText: 'เพิ่มหมุดที่นี่' }).click();
await p.selectOption('#pin-type-select', 'tmc_signal'); await p.fill('#pin-label-input', 'แยกปทุมวัน'); await p.click('#save-pin-btn');

// 3. permanent label
const lbl = await p.locator('.pin-label').first().innerText();
check('label shows code + name', lbl === 'TMC-01 แยกปทุมวัน', lbl);
check('label visible', await p.locator('.pin-label').first().isVisible());
await tool('#toggle-labels-btn');
check('label hidden by toggle', !(await p.locator('.pin-label').first().isVisible()));
await tool('#toggle-labels-btn');

// 2. quick mode
await tool('#quick-pin-btn');
check('quick bar shown', await p.isVisible('#quick-pin-bar'));
check('quick type = last used', await p.inputValue('#quick-pin-type') === 'tmc_signal');
await p.selectOption('#quick-pin-type', 'mb');
check('next code shown', (await p.innerText('#quick-pin-next')).includes('MB-01'));
for (const [x, y] of [[500, 400], [600, 420], [700, 440]]) { await p.mouse.click(x, y); await p.waitForTimeout(80); }
const codes = await p.evaluate(() => markers.filter(m => m.pointType === 'mb').map(m => m.code).join());
check('three quick MB pins', codes === 'MB-01,MB-02,MB-03', codes);
check('no dialog opened', !(await p.isVisible('#pin-modal')));
check('next updated', (await p.innerText('#quick-pin-next')).includes('MB-04'));
check('legend counts quick pins', (await p.evaluate(() => document.querySelector('.survey-legend').innerText)).includes('3 จุด'));
await p.keyboard.press('Escape');
check('esc exits quick mode', !(await p.isVisible('#quick-pin-bar')));
await p.mouse.click(800, 500); await p.waitForTimeout(200);
check('map click after exit adds nothing', await count() === 5);

// 4. undo/redo
await p.waitForTimeout(300);
await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
check('undo removes last pin', await count() === 4);
await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
check('undo again', await count() === 3);
await p.keyboard.press('Control+y'); await p.waitForTimeout(150);
check('redo', await count() === 4 && await p.evaluate(() => markers.at(-1).code) === 'MB-02');
// drag then undo
const before = await p.evaluate(() => markers[1].getLatLng());
const pos = await p.evaluate(() => { const pt = map.latLngToContainerPoint(markers[1].getLatLng()); const r = map.getContainer().getBoundingClientRect(); return { x: r.left + pt.x, y: r.top + pt.y }; });
await p.mouse.move(pos.x, pos.y); await p.mouse.down(); await p.mouse.move(pos.x + 80, pos.y + 60, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
const moved = await p.evaluate(() => markers[1].getLatLng());
check('pin dragged', Math.abs(moved.lat - before.lat) > 1e-4);
await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
const back = await p.evaluate(() => markers[1].getLatLng());
check('undo restores drag', Math.abs(back.lat - before.lat) < 1e-9 && Math.abs(back.lng - before.lng) < 1e-9);
// delete all then undo
await tool('#delete-all-btn'); await p.click('#confirm-delete-all-btn'); await p.waitForTimeout(300);
check('deleted all', await count() === 0);
await tool('#undo-btn'); await p.waitForTimeout(150);
check('undo restores delete-all', await count() === 4 && await p.locator('.pin-label').count() >= 1);
check('typing in field not hijacked', await (async () => { await p.evaluate(() => startEdit(L.Util.stamp(markers[1]))); await p.fill('#pin-label-input', 'abc'); await p.keyboard.press('Control+z'); const n = await count(); await p.keyboard.press('Escape'); return n === 4; })());
// rename via dialog then undo
await p.evaluate(() => startEdit(L.Util.stamp(markers[1]))); await p.fill('#pin-label-input', 'ชื่อใหม่'); await p.click('#save-pin-btn'); await p.waitForTimeout(300);
await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
check('undo rename', await p.evaluate(() => markers[1].labelText) === 'แยกปทุมวัน');

// export while quick mode active
await tool('#quick-pin-btn');
const [png] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), (async()=>{await tool('#export-image-btn'); await p.selectOption('#export-paper','screen'); await p.click('#export-run-btn');})()]);
await png.saveAs(OUT + '/quick-export.png');
check('png export in quick mode', png.suggestedFilename() === 'map-capture.png');
check('no page errors', errs.length === 0, errs.join(' | '));
await p.screenshot({ path: OUT + '/quick-ui.png' });
console.log(out.join('\n')); if (out.some(l => l.startsWith('FAIL'))) process.exitCode = 1; await b.close();
