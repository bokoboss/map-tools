import { chromium } from 'playwright';
const OUT = process.env.OUT_DIR;
const BASE = process.env.BASE_URL;
import fs from 'fs';
const out = []; const check = (n, ok, x='') => out.push(`${ok?'PASS':'FAIL'} ${n} ${x}`);
const b = await chromium.launch(); const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message));
const tool = async s => { await p.evaluate(() => document.getElementById('main-tool-panel').classList.remove('hidden')); await p.click(s); };
await p.goto(BASE); await p.waitForTimeout(900);
const addAt = async (x, y, type, label, code) => {
  await p.mouse.click(x, y, { button: 'right' }); await p.locator('#context-menu a', { hasText: 'เพิ่มหมุดที่นี่' }).click();
  await p.selectOption('#pin-type-select', type);
  if (code !== undefined) await p.fill('#pin-code-input', code);
  const auto = await p.inputValue('#pin-code-input');
  await p.fill('#pin-label-input', label); await p.click('#save-pin-btn'); return auto;
};
check('TMC-01 auto', await addAt(400, 300, 'tmc_signal', 'แยกปทุมวัน') === 'TMC-01');
check('TMC-02 shared numbering', await addAt(500, 300, 'tmc_unsignal', '') === 'TMC-02');
check('MB-01', await addAt(600, 350, 'mb', 'ถ.พระราม 1') === 'MB-01');
check('UT-01', await addAt(700, 350, 'uturn', 'จุดกลับรถหน้าห้าง') === 'UT-01');
await addAt(750, 420, 'ped', 'ทางม้าลาย'); await addAt(800, 450, 'od', '');
await addAt(850, 500, 'general', 'หมุดเดิม');
check('type remembered for next pin', await (async () => { await p.mouse.click(300, 600, { button: 'right' }); await p.locator('#context-menu a', { hasText: 'เพิ่มหมุดที่นี่' }).click(); const v = await p.inputValue('#pin-type-select'); await p.keyboard.press('Escape'); return v; })() === 'general');
const st = await p.evaluate(() => markers.map(m => `${m.pointType}|${m.code}|${m.labelText}`));
check('7 markers with types', st.length === 7 && st[1] === 'tmc_unsignal|TMC-02|' && st[6] === 'general||หมุดเดิม', st.join(' / '));
check('survey icon rendered', await p.locator('.survey-marker-icon').count() === 6);
const leg = await p.evaluate(() => document.querySelector('.survey-legend').innerText);
check('legend lists types+counts, not general', leg.includes('แยกสัญญาณไฟ (TMC)') && leg.includes('จุดกลับรถ (UT)') && !leg.includes('หมุดทั่วไป') && leg.includes('1 จุด'), leg.replace(/\n/g,' | '));
await tool('#toggle-legend-btn');
check('legend toggles off', await p.evaluate(() => document.querySelector('.survey-legend').classList.contains('hidden')));
await tool('#toggle-legend-btn');
// edit: change type general->mb gets next MB code; existing code kept when editing label
await p.evaluate(() => startEdit(L.Util.stamp(markers[6])));
await p.selectOption('#pin-type-select', 'mb');
check('edit to MB gives MB-02', await p.inputValue('#pin-code-input') === 'MB-02');
await p.keyboard.press('Escape');
await p.evaluate(() => startEdit(L.Util.stamp(markers[0])));
check('edit keeps code', await p.inputValue('#pin-code-input') === 'TMC-01' && await p.inputValue('#pin-type-select') === 'tmc_signal');
await p.keyboard.press('Escape');
// radii on survey point
await p.evaluate(() => { markers[0].radii.push({ id: 1, distance: 300, color: '#3388ff' }); drawCirclesForMarker(markers[0]); });
// CSV
const [csvDl] = await Promise.all([p.waitForEvent('download'), tool('#export-csv-btn')]);
await csvDl.saveAs(OUT + '/points.csv'); const csv = fs.readFileSync(OUT + '/points.csv', 'utf8');
const lines = csv.replace(/^﻿/, '').trim().split(/\r\n/);
check('csv BOM + 8 lines + order', csv.charCodeAt(0) === 0xFEFF && lines.length === 8 && lines[1].startsWith('TMC-01,') && lines[2].startsWith('TMC-02,') && lines[7].startsWith(',หมุดทั่วไป'), lines.join(' || '));
check('csv radius', lines[1].endsWith(',300'));
// save / reload / open
const [dl] = await Promise.all([p.waitForEvent('download'), tool('#save-btn')]); await dl.saveAs(OUT + '/survey.json');
await p.waitForTimeout(2300); await p.reload(); await p.waitForTimeout(1200);
const r = await p.evaluate(() => markers.map(m => `${m.pointType}|${m.code}`).join(','));
check('autosave keeps types', r.startsWith('tmc_signal|TMC-01,tmc_unsignal|TMC-02,mb|MB-01,uturn|UT-01'), r);
await tool('#delete-all-btn'); await p.click('#confirm-delete-all-btn');
check('legend hidden when empty', await p.evaluate(() => document.querySelector('.survey-legend').classList.contains('hidden')));
await p.setInputFiles('#file-input', OUT + '/survey.json'); await p.waitForTimeout(600);
check('open file keeps types+legend', await p.evaluate(() => markers.length === 7 && markers[3].pointType === 'uturn' && !document.querySelector('.survey-legend').classList.contains('hidden')));
// old files (no pointType) still load as general
await p.setInputFiles('#file-input', OUT + '/saved.json'); await p.waitForTimeout(600);
check('previous-format file -> general pins', await p.evaluate(() => markers.length === 1 && markers[0].pointType === 'general' && markers[0].radii.length === 2));
await p.setInputFiles('#file-input', OUT + '/survey.json'); await p.waitForTimeout(600);
await p.click('#toggle-labels-btn').catch(()=>{}); await tool('#toggle-labels-btn');
await p.evaluate(() => map.fitBounds(L.latLngBounds(markers.map(m => m.getLatLng())), { padding: [80, 80] }));
await p.waitForTimeout(1500);
const [png] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), (async()=>{await tool('#export-image-btn'); await p.selectOption('#export-paper','screen'); await p.click('#export-run-btn');})()]);
await png.saveAs(OUT + '/survey-export.png');
check('no page errors', errs.length === 0, errs.join(' | '));
console.log(out.join('\n')); if (out.some(l => l.startsWith('FAIL'))) process.exitCode = 1; await b.close();
