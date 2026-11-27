import { chromium } from 'playwright';
const OUT = process.env.OUT_DIR;
const BASE = process.env.BASE_URL;
const out = []; const check = (n, ok, x = '') => out.push(`${ok ? 'PASS' : 'FAIL'} ${n} ${x}`);
const b = await chromium.launch();
for (const [w, h] of [[1280, 800], [375, 812]]) {
  const tag = `@${w}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1000);
  await p.setInputFiles('#import-csv-input', OUT + '/import-th.csv'); await p.waitForTimeout(800);
  // new pin: inspector + ghost, map not covered
  await p.mouse.click(Math.round(w / 2), Math.round(h / 3), { button: 'right' });
  await p.locator('#context-menu a', { hasText: 'เพิ่มหมุดที่นี่' }).click(); await p.waitForTimeout(300);
  const panel = await p.evaluate(() => document.querySelector('#pin-modal .modal-content').getBoundingClientRect().toJSON());
  check(`${tag} pin editor is a docked panel`, w > 640 ? (panel.left < 40 && panel.width <= 380) : (Math.abs(panel.bottom - h) < 2 && panel.width >= w - 2), JSON.stringify(panel));
  const freePt = w > 640 ? [Math.round(w * 0.75), Math.round(h / 2)] : [Math.round(w / 2), 80];
  check(`${tag} map not covered by a backdrop`, await p.evaluate(([x, y]) => !!document.elementFromPoint(x, y).closest('#map'), freePt));
  check(`${tag} ghost marker shows new pin position`, await p.locator('path.leaflet-interactive[stroke-dasharray="4 4"], path[stroke-dasharray="4 4"]').count() === 1);
  check(`${tag} label field focused`, await p.evaluate(() => document.activeElement.id) === 'pin-label-input');
  await p.screenshot({ path: `${OUT}/inspector-${w}-new.png` });
  await p.selectOption('#pin-type-select', 'mb'); await p.click('#save-pin-btn'); await p.waitForTimeout(300);
  check(`${tag} save closes panel, ghost removed`, !(await p.isVisible('#pin-modal')) && await p.locator('path[stroke-dasharray="4 4"]').count() === 0);
  // map stays usable while editing: pan the map with the panel open
  await p.evaluate(() => startEdit(L.Util.stamp(markers[0]))); await p.waitForTimeout(300);
  check(`${tag} editing pin is highlighted`, await p.evaluate(() => markers[0]._icon.classList.contains('is-editing')));
  const pin = await p.evaluate(() => { const r = markers[0]._icon.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const pr = await p.evaluate(() => document.querySelector('#pin-modal .modal-content').getBoundingClientRect().toJSON());
  const clear = w > 640 ? pin.x > pr.right : pin.y < pr.top;
  check(`${tag} edited pin kept clear of the panel`, clear, JSON.stringify({ pin, pr }));
  await p.screenshot({ path: `${OUT}/inspector-${w}-edit.png` });
  const c0 = await p.evaluate(() => map.getCenter());
  await p.mouse.move(freePt[0], freePt[1]); await p.mouse.down(); await p.mouse.move(freePt[0] - 60, freePt[1] + 10, { steps: 5 }); await p.mouse.up();
  const c1 = await p.evaluate(() => map.getCenter());
  check(`${tag} map pans while panel open`, Math.abs(c1.lng - c0.lng) > 1e-5 && await p.isVisible('#pin-modal'));
  // radius manager opens in the same docked place
  await p.click('#manage-radius-btn'); await p.waitForTimeout(200);
  const rr = await p.evaluate(() => document.querySelector('#radius-modal .modal-content').getBoundingClientRect().toJSON());
  check(`${tag} radius manager docked in same place`, w > 640 ? rr.left < 40 : Math.abs(rr.bottom - h) < 2);
  await p.fill('#radius-input', '150'); await p.click('#add-radius-btn');
  check(`${tag} radius added from panel`, await p.evaluate(() => markers[0].radii.some(r => r.distance === 150)));
  await p.click('#close-radius-modal-btn'); await p.waitForTimeout(200);
  check(`${tag} highlight cleared on close`, await p.evaluate(() => !document.querySelector('.is-editing')));
  // Esc cancels an open editor without saving
  await p.evaluate(() => startEdit(L.Util.stamp(markers[1]))); await p.fill('#pin-label-input', 'ไม่บันทึก'); await p.keyboard.press('Escape');
  check(`${tag} Esc cancels without saving`, !(await p.isVisible('#pin-modal')) && await p.evaluate(() => markers[1].labelText) !== 'ไม่บันทึก');
  check(`${tag} no page errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await b.close();
console.log(out.join('\n')); if (out.some(l => l.startsWith('FAIL'))) process.exitCode = 1;
