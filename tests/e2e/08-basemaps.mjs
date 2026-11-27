import { chromium } from 'playwright';
const OUT = process.env.OUT_DIR;
const BASE = process.env.BASE_URL;
const out = []; const check = (n, ok, x = '') => out.push(`${ok ? 'PASS' : 'FAIL'} ${n} ${x}`);
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1000, height: 700 } }); const errs = []; const carto = [];
p.on('pageerror', e => errs.push(e.message));
p.on('request', r => { if (r.url().includes('cartocdn.com')) carto.push(r.url()); });
await p.goto(BASE); await p.waitForTimeout(800);
await p.evaluate(() => map.setView([13.7466, 100.5339], 16));
const names = await p.evaluate(() => [...document.querySelectorAll('#layer-options [data-basemap]')].map(b => b.dataset.basemap));
check('no CARTO basemaps listed', !names.some(n => n.includes('สบายตา (สว่าง)') || n.includes('สบายตา (มืด)')), names.join(' | '));
check('7 vector styles listed', names.filter(n => n.startsWith('Vector')).length === 7);
for (const name of names) {
  await p.click('#toggle-layers-btn');
  await p.locator(`#layer-options [data-basemap="${name}"]`).click();
  const isVector = name.startsWith('Vector');
  try {
    if (isVector) {
      await p.waitForFunction(n => currentBaseMapName === n && currentLayer.isVectorBasemap, name, { timeout: 20000 });
      await p.waitForFunction(() => { const g = currentLayer.getMaplibreMap(); return g.isStyleLoaded() && g.loaded() && g.areTilesLoaded(); }, null, { timeout: 40000 });
    } else {
      await p.waitForFunction(n => currentBaseMapName === n, name, { timeout: 10000 });
      await p.waitForFunction(() => !tileLayersOf(currentLayer).some(l => l.isLoading()), null, { timeout: 20000 });
    }
    await p.waitForTimeout(800);
    const slug = name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'raster-' + names.indexOf(name);
    await p.screenshot({ path: `${OUT}/basemap-${names.indexOf(name)}-${slug}.png` });
    check(`loads: ${name}`, true);
  } catch (e) { check(`loads: ${name}`, false, e.message.split('\n')[0]); }
}
// export works with a VersaTiles style (different tile host)
await p.click('#toggle-layers-btn'); await p.click('#layer-options [data-basemap^="Vector · Gray ("]');
await p.waitForFunction(() => { const g = currentLayer.getMaplibreMap && currentLayer.getMaplibreMap(); return g && g.isStyleLoaded() && g.loaded() && g.areTilesLoaded(); }, null, { timeout: 40000 });
await p.evaluate(() => document.getElementById('main-tool-panel').classList.remove('hidden')); await p.click('#export-image-btn');
await p.selectOption('#export-dpi', '150');
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 90000 }), p.click('#export-run-btn')]);
await dl.saveAs(OUT + '/versatiles-export.png');
const buf = (await import('node:fs')).readFileSync(OUT + '/versatiles-export.png');
check('export with VersaTiles style', buf.readUInt32BE(16) === 1754, String(buf.readUInt32BE(16)));
for (const [w, h] of [[1280, 800], [375, 812]]) {
  await p.setViewportSize({ width: w, height: h });
  await p.click('#toggle-layers-btn'); await p.waitForTimeout(300);
  const m = await p.evaluate(() => { const r = document.getElementById('layer-panel').getBoundingClientRect(); const el = document.getElementById('layer-panel'); return { bottom: r.bottom, right: r.right, left: r.left, scrollable: el.scrollHeight > el.clientHeight ? getComputedStyle(el).overflowY : 'fits' }; });
  check(`menu fits viewport @${w}`, m.bottom <= h && m.right <= w && m.left >= 0 && (m.scrollable === 'fits' || m.scrollable === 'auto'), JSON.stringify(m));
  check(`current basemap marked @${w}`, await p.evaluate(() => document.querySelectorAll('#layer-options [aria-pressed="true"]').length === 1 && document.querySelector('#layer-options [aria-pressed="true"]').dataset.basemap === currentBaseMapName));
  check(`thumbnails loaded @${w}`, await p.evaluate(async () => { const imgs = [...document.querySelectorAll('#layer-options img')]; imgs.forEach(i => i.loading = 'eager'); await Promise.all(imgs.map(i => i.decode().catch(() => null))); return imgs.length === 12 && imgs.every(i => i.naturalWidth === 160); }));
  check(`hint hidden while menu open @${w}`, !(await p.isVisible('#empty-hint')));
  await p.screenshot({ path: OUT + `/basemap-menu-${w}.png` });
  await p.click('#toggle-layers-btn');
}
check('hybrid makes no CARTO requests', carto.length === 0, carto.slice(0, 2).join(' '));
check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(out.join('\n')); if (out.some(l => l.startsWith('FAIL'))) process.exitCode = 1;
