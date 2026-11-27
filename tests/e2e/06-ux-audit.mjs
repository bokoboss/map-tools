import { chromium } from 'playwright';
const OUT = process.env.OUT_DIR;
const BASE = process.env.BASE_URL;
const out = []; const check = (n, ok, x = '') => out.push(`${ok ? 'PASS' : 'FAIL'} ${n} ${x}`);
const b = await chromium.launch();
for (const [w, h] of [[1280, 800], [375, 812]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1200);
  const tag = `@${w}`;
  check(`${tag} no horizontal overflow`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  check(`${tag} empty-state hint visible with actions`, await p.isVisible('#empty-hint') && await p.locator('#empty-hint button', { hasText: 'ปักหมุดเร็ว' }).isVisible());
  await p.screenshot({ path: `${OUT}/ux-${w}-empty.png` });
  await p.click('#toggle-tool-panel-btn'); await p.waitForTimeout(300);
  const small = await p.evaluate(() => [...document.querySelectorAll('#controls-container button, #main-tool-panel button, .leaflet-control-zoom a')]
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); }).map(e => e.id || e.className));
  check(`${tag} hit targets >= 44px`, small.length === 0, small.join(','));
  const unnamed = await p.evaluate(() => [...document.querySelectorAll('button')].filter(btn => btn.offsetParent !== null && !btn.textContent.trim() && !btn.getAttribute('aria-label')).map(b => b.id));
  check(`${tag} visible buttons have accessible names`, unnamed.length === 0, unnamed.join(','));
  check(`${tag} tool buttons show text labels`, await p.locator('#main-tool-panel .tool-label').count() === 13);
  check(`${tag} hint hidden while tools open`, !(await p.isVisible('#empty-hint')));
  await p.screenshot({ path: `${OUT}/ux-${w}-tools.png` });
  check(`${tag} no overflow with tools open`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await p.click('#toggle-tool-panel-btn');
  // empty hint -> quick mode
  await p.click('#empty-hint-quick'); await p.waitForTimeout(200);
  check(`${tag} hint starts quick mode and hides`, await p.isVisible('#quick-pin-bar') && !(await p.isVisible('#empty-hint')));
  await p.mouse.click(Math.round(w / 2), Math.round(h / 2)); await p.mouse.click(Math.round(w / 2) + 40, Math.round(h / 2) + 40);
  await p.keyboard.press('Escape');
  check(`${tag} hint stays hidden once pins exist`, !(await p.isVisible('#empty-hint')));
  await p.screenshot({ path: `${OUT}/ux-${w}-pins.png` });
  if (w === 1280) {
    // tooltip on keyboard focus
    await p.focus('#toggle-layers-btn'); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab');
    const tip = await p.evaluate(() => getComputedStyle(document.activeElement, '::after').content);
    check('tooltip shows on keyboard focus', tip.includes('เปลี่ยนแผนที่พื้นหลัง'), tip);
    // delete-all: named, destructive verb, Cancel focused, focus restored, Esc cancels
    await p.click('#toggle-tool-panel-btn'); await p.click('#delete-all-btn'); await p.waitForTimeout(100);
    const msg = await p.innerText('#delete-all-message');
    check('delete-all names what is removed', msg.includes('หมุด 2 จุด'), msg);
    check('delete-all destructive verb', (await p.innerText('#confirm-delete-all-btn')) === 'ลบทั้งหมด');
    check('delete-all Cancel focused', await p.evaluate(() => document.activeElement.id) === 'cancel-delete-all-btn');
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    check('focus trapped in dialog', await p.evaluate(() => document.getElementById('delete-all-confirm-modal').contains(document.activeElement)));
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    check('Esc cancels delete-all', await p.evaluate(() => markers.length) === 2);
    check('focus returns to trigger', await p.evaluate(() => document.activeElement.id) === 'delete-all-btn');
    // single pin delete names the pin
    await p.evaluate(() => { markers[0].code = 'TMC-01'; startEdit(L.Util.stamp(markers[0])); });
    await p.click('#delete-pin-btn'); await p.waitForTimeout(100);
    const t = await p.innerText('#delete-confirm-title');
    check('pin delete names the pin', t.includes('TMC-01') && (await p.innerText('#confirm-delete-btn')) === 'ลบหมุด', t);
    await p.keyboard.press('Escape');
    // bad project file -> toast, no blocking alert
    let dialog = false; p.on('dialog', d => { dialog = true; d.dismiss(); });
    await p.setInputFiles('#file-input', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('not json') });
    await p.waitForTimeout(400);
    check('bad file: toast, no alert()', !dialog && (await p.innerText('#app-toast')).includes('ลองอีกครั้ง'));
    // typography: weights
    const weights = await p.evaluate(() => [...new Set([...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && e.textContent.trim()).map(e => getComputedStyle(e).fontWeight))]);
    check('<= 3 font weights, none > 600', weights.length <= 3 && weights.every(x => +x <= 600), weights.join(','));
    // labels
    const unlabeled = await p.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]):not([type=file]), select')].filter(i => !(i.id && document.querySelector(`label[for="${i.id}"]`)) && !i.closest('label') && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')).map(i => i.id));
    check('every input has a label', unlabeled.length === 0, unlabeled.join(','));
  }
  check(`${tag} no page errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
// reduced motion: dialogs do not scale/translate in
const rm = await b.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } }); const rp = await rm.newPage();
await rp.goto(BASE); await rp.waitForTimeout(800);
await rp.mouse.click(640, 400, { button: 'right' }); await rp.locator('#context-menu a', { hasText: 'เพิ่มหมุดที่นี่' }).click();
check('reduced motion: no dialog animation', await rp.evaluate(() => getComputedStyle(document.querySelector('#pin-modal .modal-content')).animationName) === 'none');
await b.close();
console.log(out.join('\n')); if (out.some(l => l.startsWith('FAIL'))) process.exitCode = 1;
