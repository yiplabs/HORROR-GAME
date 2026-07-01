// Headless smoke test. No npm install needed inside the repo:
//   node test/smoke.mjs
// Requires a Playwright installation (global `npm i -g playwright` works) and a
// Chromium (PLAYWRIGHT_BROWSERS_PATH or a plain `chromium` binary).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8137;

// ---- resolve playwright (local, then global) ----
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(join(globalRoot, 'playwright')));
}

// ---- tiny static server ----
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
};
const server = http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(normalize(ROOT))) throw new Error('traversal');
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(PORT, resolve));

// ---- helpers ----
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push(String(err)));

// 1. page loads and renders the world
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
check('page loads with zero console/page errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
check('canvas is present', await page.locator('canvas.game-canvas').count() === 1);
const tris = await page.evaluate(() => window.__game.renderer.info.render.triangles);
check('world meshed and rendered (triangles > 1000)', tris > 1000, `triangles=${tris}`);

// 2. start a run, move the player
await page.click('#btn-play');
await page.waitForTimeout(300);
// under SwiftShader the clamped dt makes game time run slower than wall time,
// so hold the key long enough for a few seconds of *simulated* time
const startPos = await page.evaluate(() => ({ ...window.__game.player.pos }));
await page.keyboard.down('KeyW');
await page.keyboard.down('Space'); // hop up terrain steps (no auto-jump, like Minecraft)
await page.waitForTimeout(4000);
await page.keyboard.up('KeyW');
await page.keyboard.up('Space');
const endPos = await page.evaluate(() => ({ ...window.__game.player.pos }));
const moved = Math.hypot(endPos.x - startPos.x, endPos.z - startPos.z);
check('player moves with W held (> 2 blocks)', moved > 2, `moved=${moved.toFixed(2)}`);

// 3. nightfall spawns killers that hunt
await page.evaluate(() => window.__game.debug.setTime(0.66));
await page.waitForTimeout(2500);
const killerInfo = await page.evaluate(() => window.__game.killers.map((k) => ({ id: k.def.id, state: k.state })));
check('night spawns at least one killer', killerInfo.length >= 1, JSON.stringify(killerInfo));
await page.waitForTimeout(4000);
const hunting = await page.evaluate(() =>
  window.__game.killers.some((k) => ['ROAM', 'STALK', 'CHASE', 'ATTACK'].includes(k.state)));
check('killers enter hunt states', hunting);

// 4. every roster member spawns cleanly
const rosterIds = ['ghostface', 'camper', 'dreamdemon', 'shape', 'goodguy', 'clown', 'tallone', 'nun', 'drowned', 'butcher'];
const preSpawnErrors = consoleErrors.length;
for (const id of rosterIds) {
  const ok = await page.evaluate((kid) => !!window.__game.debug.spawn(kid), id);
  check(`roster spawn: ${id}`, ok);
}
await page.waitForTimeout(1200);
check('no errors after spawning full roster', consoleErrors.length === preSpawnErrors,
  consoleErrors.slice(preSpawnErrors, preSpawnErrors + 3).join(' | '));

// 5. death -> jumpscare -> death screen -> high score persisted
await page.evaluate(() => { window.__game.debug.night(3); window.__game.debug.damage(99); });
await page.waitForTimeout(2200);
check('death screen shows after jumpscare',
  await page.evaluate(() => !document.getElementById('death-screen').classList.contains('hidden')));
const best = await page.evaluate(() => localStorage.getItem('nightfall.best'));
check('high score persisted', Number(best) >= 2, `best=${best}`);

// 6. gallery mode renders all ten rigs without errors
const preGalleryErrors = consoleErrors.length;
await page.goto(`http://localhost:${PORT}/?gallery`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
check('gallery mode loads without errors', consoleErrors.length === preGalleryErrors,
  consoleErrors.slice(preGalleryErrors, preGalleryErrors + 3).join(' | '));

await browser.close();
server.close();

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
