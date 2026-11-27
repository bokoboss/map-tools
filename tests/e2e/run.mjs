// Runs the browser suites in order against a local static server of the repo root.
// Usage: npm test   (from tests/e2e)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outDir = path.join(here, '.output');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(path.join(here, 'fixtures'))) fs.copyFileSync(path.join(here, 'fixtures', f), path.join(outDir, f));

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(root, urlPath);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(8765, '127.0.0.1', r));

const suites = fs.readdirSync(here).filter(f => /^\d\d-.*\.mjs$/.test(f)).sort();
let failed = 0, passed = 0;
for (const suite of suites) {
    // Async spawn: a synchronous child would block this process's static server.
    const r = await new Promise(resolve => {
        const child = spawn(process.execPath, [path.join(here, suite)], {
            env: { ...process.env, BASE_URL: 'http://127.0.0.1:8765/index.html', OUT_DIR: outDir }
        });
        let stdout = '', stderr = '';
        child.stdout.on('data', d => { stdout += d; });
        child.stderr.on('data', d => { stderr += d; });
        const timer = setTimeout(() => child.kill('SIGKILL'), 10 * 60 * 1000);
        child.on('close', status => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
    });
    const lines = (r.stdout || '').split('\n').filter(Boolean);
    const p = lines.filter(l => l.startsWith('PASS')).length;
    const f = lines.filter(l => l.startsWith('FAIL'));
    passed += p;
    const crashed = r.status !== 0 && f.length === 0;
    console.log(`${f.length || crashed ? '✗' : '✓'} ${suite}: ${p} passed${f.length ? `, ${f.length} failed` : ''}${crashed ? ' (crashed)' : ''}`);
    f.forEach(l => console.log('   ' + l));
    if (crashed) console.log((r.stderr || '').split('\n').slice(0, 15).map(l => '   ' + l).join('\n'));
    if (f.length || crashed) failed++;
}
server.close();
console.log(`\n${passed} checks passed; ${failed} suite(s) failed`);
process.exit(failed ? 1 : 0);
