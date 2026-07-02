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

// 0. plain page exposes no cheat console
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
check('no debug/cheat surface without ?debug', await page.evaluate(() => window.__game === undefined));

// 1. page loads and renders the world (?debug enables the test surface)
await page.goto(`http://localhost:${PORT}/?debug`, { waitUntil: 'networkidle' });
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

// 2b. crafting: logs -> planks; torches actually light up; particles render
await page.evaluate(() => {
  window.__game.debug.give(5, 3); // logs
  window.__game.debug.give(3, 8); // stone
});
const craftRes = await page.evaluate(() => {
  const g = window.__game;
  const before = g.interaction.inventory[7];
  const ok = g.crafting.craft(0); // Planks x4
  return { ok, gained: g.interaction.inventory[7] - before };
});
check('crafting: 1 log -> 4 planks', craftRes.ok && craftRes.gained === 4, JSON.stringify(craftRes));
const torchCount = await page.evaluate(() => {
  const g = window.__game;
  g.crafting.craft(1); // Torches x4
  const p = g.player.pos;
  g.world.setBlock(Math.floor(p.x) + 2, Math.floor(p.y) + 1, Math.floor(p.z), 9, true);
  return g.interaction.inventory[9];
});
await page.waitForTimeout(1500);
const lightOn = await page.evaluate(() =>
  window.__game.scene.children.some((c) => c.isPointLight && c.intensity > 0.5));
check('torches craft and cast light', torchCount >= 3 && lightOn, `torches=${torchCount} light=${lightOn}`);
await page.evaluate(() => window.__game.particles.burst({ x: 0, y: 20, z: 0, colors: ['#fff'], count: 10, ttl: 3 }));
const sawParticles = await page.waitForFunction(() => window.__game.particles.mesh.count > 0,
  null, { timeout: 8000 }).then(() => true).catch(() => false);
check('particle system renders bursts', sawParticles);

// 3. nightfall spawns killers that hunt
await page.evaluate(() => window.__game.debug.setTime(0.66));
await page.waitForTimeout(2500);
const killerInfo = await page.evaluate(() => window.__game.killers.map((k) => ({ id: k.def.id, state: k.state })));
check('night spawns at least one killer', killerInfo.length >= 1, JSON.stringify(killerInfo));
const hunting = await page.waitForFunction(() =>
  window.__game.killers.some((k) => ['ROAM', 'STALK', 'CHASE', 'ATTACK'].includes(k.state)),
  null, { timeout: 30000 }).then(() => true).catch(() => false);
check('killers enter hunt states', hunting);

// 4. every roster member spawns cleanly
const rosterIds = ['ghostface', 'camper', 'dreamdemon', 'shape', 'goodguy', 'clown', 'tallone', 'nun', 'drowned', 'butcher',
  'teacher', 'showman', 'rabbit', 'chicken', 'piratefox', 'inkdemon', 'neighbor'];
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
