import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildAtlas } from './world/atlas.js';
import { World } from './world/world.js';
import { generateWorld } from './world/worldgen.js';
import { lineOfSight } from './world/raycast.js';
import { Controls } from './player/controls.js';
import { Player } from './player/player.js';
import { Interaction } from './player/interaction.js';
import { DayNight } from './sky/daynight.js';
import { Director } from './ai/director.js';
import { ROSTER } from './characters/roster.js';
import { buildRig, animateRig } from './characters/rig.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { playJumpscare } from './ui/jumpscare.js';
import { initAudio } from './audio/audio.js';
import { SFX } from './audio/sfx.js';
import { MusicSystem } from './audio/music.js';
import { State, StateMachine } from './state.js';

// ---------- renderer / scene / camera ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.PIXEL_RATIO_CAP));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.classList.add('game-canvas');
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.FOV, window.innerWidth / window.innerHeight, 0.1, 420);
scene.add(camera); // the held item is parented to the camera

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- world ----------
const atlas = buildAtlas();
const world = new World(scene, atlas);
let seed = (Math.random() * 1e9) | 0;
let spawn = generateWorld(world, seed);
world.meshAll();

// ---------- systems ----------
const daynight = new DayNight(scene);
const controls = new Controls(renderer.domElement);
const player = new Player(world, camera, controls);
const hud = new HUD();
const director = new Director(world, scene);
const interaction = new Interaction(world, player, controls, camera, scene, hud, () => director.killers, atlas);
const music = new MusicSystem();
const sm = new StateMachine();
const jumpscareCanvas = document.getElementById('jumpscare');

// Per-frame effects channel: killer behaviors write, HUD/sky/audio read.
const effects = { lightDim: 0, static: 0, desat: 0, chainsaw: 0 };

// ---------- AI context ----------
const _camDir = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _point = new THREE.Vector3();

const ctx = {
  world, player, daynight, camera, effects,
  time: 0,
  night: 1,
  playerYaw: () => controls.yaw,
  playerLookingAt(killer) {
    camera.getWorldDirection(_camDir);
    _toTarget.set(
      killer.pos.x - camera.position.x,
      killer.pos.y + killer.height * 0.7 - camera.position.y,
      killer.pos.z - camera.position.z
    );
    const dist = _toTarget.length();
    if (dist > 60) return false;
    if (dist < 2) return true;
    _toTarget.normalize();
    if (_toTarget.dot(_camDir) < 0.57) return false; // ~55 degree cone
    _point.set(killer.pos.x, killer.pos.y + killer.height * 0.85, killer.pos.z);
    return lineOfSight(world, camera.position, _point);
  },
  playerCanSeePoint(p) {
    camera.getWorldDirection(_camDir);
    _toTarget.set(p.x - camera.position.x, p.y + 1 - camera.position.y, p.z - camera.position.z);
    const dist = _toTarget.length();
    if (dist > 90) return false;
    _toTarget.normalize();
    if (_toTarget.dot(_camDir) < 0.25) return false;
    _point.set(p.x, p.y + 1, p.z);
    return lineOfSight(world, camera.position, _point);
  },
  sfx(name, detail, pos) {
    let vol = 1;
    if (pos) {
      const d = Math.hypot(pos.x - player.pos.x, pos.y - player.pos.y, pos.z - player.pos.z);
      if (d > 36) return;
      vol = Math.max(0.06, 1 - d / 36);
    }
    if (SFX[name]) SFX[name](detail, vol);
  },
  onChaseStart() { SFX.stinger(); },
};

// ---------- day/night events ----------
daynight.onDusk = (night) => {
  hud.showMessage('Night falls. They are coming.', true);
  SFX.dusk();
  director.spawnNight(night, ctx);
};
daynight.onDawn = (completedNight) => {
  director.dawn(ctx);
  SFX.dawn();
  if (completedNight >= CONFIG.WIN_NIGHTS) {
    sm.set(State.WON);
  } else {
    hud.showMessage(`You survived night ${completedNight}.`);
  }
};

player.onDamage = () => hud.flashDamage();
player.onStep = () => SFX.step();
player.onDeath = () => sm.set(State.DEAD);
interaction.onSfx = (name, detail) => ctx.sfx(name, detail);

// ---------- persistence ----------
const BEST_KEY = 'nightfall.best';
const bestNights = () => {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
};
const saveBest = (nights) => {
  try { if (nights > bestNights()) localStorage.setItem(BEST_KEY, String(nights)); } catch { /* private mode */ }
};

// ---------- run lifecycle ----------
let worldFresh = true; // the initial world is generated behind the title screen

function regenWorld() {
  world.dispose();
  world.clear();
  seed = (Math.random() * 1e9) | 0;
  spawn = generateWorld(world, seed);
  world.meshAll();
}

function startRun() {
  if (!worldFresh) regenWorld();
  worldFresh = false;
  director.reset();
  daynight.reset();
  player.reset(spawn);
  interaction.reset();
  ctx.time = 0;
  hud.setHealth(player.health);
  hud.updateHotbar(interaction.inventory, interaction.selected);
  sm.set(State.PLAYING);
  hud.showMessage('Survive until 6:00 AM. Seven nights.', false, 5);
}

const menus = new Menus({
  onPlay: startRun,
  onResume: () => sm.set(State.PLAYING),
  onRestart: () => { sm.set(State.MENU); startRun(); },
  onQuit: () => sm.set(State.MENU),
});

// ---------- state machine ----------
sm.on(State.MENU, {
  enter() {
    menus.showTitle(bestNights());
    hud.hide();
    controls.enabled = false;
    controls.unlock();
  },
});
sm.on(State.PLAYING, {
  enter() {
    initAudio();
    menus.hideAll();
    hud.show();
    controls.enabled = true;
    controls.lock();
  },
});
sm.on(State.PAUSED, {
  enter() {
    menus.showPause();
    controls.enabled = false;
    controls.unlock();
  },
});
sm.on(State.DEAD, {
  enter() {
    controls.enabled = false;
    controls.unlock();
    const killer = player.lastAttacker;
    const nights = daynight.day - 1;
    saveBest(nights);
    SFX.screech();
    const face = killer ? killer.rig.painter.getFaceCanvas('headFront') : null;
    playJumpscare(jumpscareCanvas, face, () => {
      menus.showDeath(killer ? killer.def.name : null, nights, bestNights());
    });
  },
});
sm.on(State.WON, {
  enter() {
    controls.enabled = false;
    controls.unlock();
    saveBest(CONFIG.WIN_NIGHTS);
    menus.showWin(bestNights());
  },
});

controls.onLockLost = () => {
  if (sm.current === State.PLAYING) sm.set(State.PAUSED);
};
document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && sm.current === State.PLAYING && !controls.locked) {
    sm.set(State.PAUSED); // fallback when running without pointer lock (tests)
  }
});

// ---------- gallery mode (?gallery): all killers in daylight, for screenshots ----------
const urlParams = new URLSearchParams(location.search);
const galleryMode = urlParams.has('gallery');
const debugMode = urlParams.has('debug'); // gates the cheat/test console below
const galleryRigs = [];

function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 40;
  const g = c.getContext('2d');
  g.font = 'bold 22px monospace';
  g.textAlign = 'center';
  g.fillStyle = '#000';
  g.fillText(text, 129, 27);
  g.fillStyle = '#ffdddd';
  g.fillText(text, 128, 26);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(4.2, 0.66, 1);
  return sprite;
}

function setupGallery() {
  document.getElementById('menus').classList.add('hidden');
  hud.hide();
  interaction.held.visible = false;
  daynight.setTime(0.25);
  const spacing = 3.2;
  const rowZ = Math.floor(spawn.z) - 8;
  const cx = Math.floor(spawn.x);
  const baseX = spawn.x - ((ROSTER.length - 1) / 2) * spacing;

  // flatten a clearing so the lineup is clean regardless of seed
  const y0 = Math.max(world.surfaceHeight(cx, rowZ) + 1, CONFIG.WATER_Y + 3);
  const half = Math.ceil(((ROSTER.length - 1) / 2) * spacing) + 5;
  for (let x = cx - half; x <= cx + half; x++) {
    for (let z = rowZ - 16; z <= rowZ + 5; z++) {
      for (let y = y0; y < CONFIG.WORLD_HEIGHT; y++) world.setBlockSilent(x, y, z, 0);
      for (let y = y0 - 4; y < y0 - 1; y++) {
        const id = world.getBlock(x, y, z);
        if (id === 0 || id === 8) world.setBlockSilent(x, y, z, 2); // fill dips with dirt
      }
      world.setBlockSilent(x, y0 - 1, z, 1); // grass stage
    }
  }
  world.meshAll();

  ROSTER.forEach((def, i) => {
    const rig = buildRig(def);
    const x = baseX + i * spacing;
    rig.group.position.set(x, y0, rowZ);
    rig.group.rotation.y = Math.PI; // face the camera
    scene.add(rig.group);
    const label = makeLabel(def.name);
    label.position.set(x, y0 + 3.1 + (i % 2) * 0.7, rowZ); // alternate heights so labels don't collide
    scene.add(label);
    galleryRigs.push(rig);
  });
  camera.position.set(spawn.x, y0 + 2.6, rowZ - 11);
  camera.lookAt(spawn.x, y0 + 1.2, rowZ);
  const note = document.createElement('div');
  note.className = 'gallery-note';
  note.textContent = 'CHARACTER GALLERY — remove ?gallery from the URL to play';
  app.appendChild(note);
}

// ---------- main loop ----------
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, CONFIG.DT_CLAMP);
  last = now;

  if (galleryMode) {
    ctx.time += dt;
    daynight.update(0, camera.position);
    for (const rig of galleryRigs) {
      animateRig(rig, dt, {
        moveSpeed: 2.2, headYaw: Math.sin(ctx.time * 0.5) * 0.4, headPitch: 0.05,
        crouch: false, attackT: 0, time: ctx.time,
      });
    }
    renderer.render(scene, camera);
    return;
  }

  interaction.held.visible = sm.current === State.PLAYING || sm.current === State.PAUSED;

  if (sm.current === State.MENU) {
    // slow island flyby behind the title screen
    const a = now * 0.00004;
    camera.position.set(spawn.x + Math.cos(a) * 55, 34, spawn.z + Math.sin(a) * 55);
    camera.lookAt(spawn.x, 14, spawn.z);
    daynight.update(0, camera.position);
  }

  if (sm.current === State.PLAYING) {
    ctx.time += dt;
    ctx.night = daynight.day;
    effects.lightDim = 0;
    effects.static = 0;
    effects.desat = 0;
    effects.chainsaw = 0;

    player.update(dt, !daynight.isNight);
    interaction.update(dt);
    director.update(dt, ctx);
    daynight.lightDim = effects.lightDim;
    daynight.update(dt, camera.position);
    world.update();

    hud.setClock(daynight.clockString(), daynight.isNight);
    hud.setDayLabel(daynight.isNight ? `Night ${daynight.day}` : `Day ${daynight.day}`, daynight.isNight);
    hud.setHealth(player.health);
    hud.setStamina(player.stamina);
    hud.setStatic(effects.static);
    hud.setDesat(effects.desat);

    music.update(dt, {
      isNight: daynight.isNight,
      anyChasing: director.anyChasing(),
      nearestDist: director.nearestDist(player.pos),
      staticLevel: effects.static,
      chainsawLevel: effects.chainsaw,
      time: ctx.time,
    });

    controls.endFrame();
  } else {
    music.hush();
  }

  renderer.render(scene, camera);
}

// ---------- boot ----------
document.getElementById('loading').style.display = 'none';
if (galleryMode) {
  setupGallery();
} else {
  sm.set(State.MENU);
}
requestAnimationFrame(frame);

// ---------- debug / test surface (only with ?debug so normal play has no easy cheats) ----------
if (debugMode || galleryMode) {
  window.__game = {
    renderer, scene, camera, world, player, director, daynight, sm, State, ctx, interaction,
    get killers() { return director.killers; },
    debug: {
      play: startRun,
      setTime: (t) => daynight.setTime(t),
      spawn: (id) => director.forceSpawn(id, ctx),
      damage: (n) => player.damage(n, null, player.lastAttacker ?? director.killers[0] ?? null),
      give: (blockId, n = 64) => {
        interaction.inventory[blockId] = (interaction.inventory[blockId] ?? 0) + n;
        hud.updateHotbar(interaction.inventory, interaction.selected);
      },
      night: (n) => { daynight.day = n; },
    },
  };
}
