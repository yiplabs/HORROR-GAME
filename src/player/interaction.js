import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { raycastVoxel, lineOfSight } from '../world/raycast.js';
import { BLOCKS, AIR, WATER, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, TORCH, REINFORCED, SPIKES, isTargetable } from '../world/blocks.js';
import { entityOverlapsBlock } from '../core/physics.js';
import { SPARK_COLORS } from '../fx/particles.js';

export const HOTBAR = [
  { kind: 'weapon', label: 'Axe' },
  { kind: 'block', id: PLANKS },
  { kind: 'block', id: DIRT },
  { kind: 'block', id: STONE },
  { kind: 'block', id: SAND },
  { kind: 'block', id: LOG },
  { kind: 'block', id: LEAVES },
  { kind: 'block', id: TORCH },
  { kind: 'block', id: REINFORCED },
  { kind: 'block', id: SPIKES },
];

// A run starts with empty hands: no free blocks, base pockets only.
const EMPTY_INVENTORY = () => ({
  [PLANKS]: 0, [DIRT]: 0, [STONE]: 0, [SAND]: 0, [LOG]: 0, [LEAVES]: 0,
  [TORCH]: 0, [REINFORCED]: 0, [SPIKES]: 0,
});

const targetable = (id) => isTargetable(id);

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _toKiller = new THREE.Vector3();
const _killerMid = new THREE.Vector3();

export class Interaction {
  constructor(world, player, controls, camera, scene, hud, getKillers, atlas, particles) {
    this.world = world;
    this.player = player;
    this.controls = controls;
    this.camera = camera;
    this.hud = hud;
    this.getKillers = getKillers;
    this.atlas = atlas;
    this.particles = particles;
    this.weapon = 'axe'; // 'axe' | 'club' (crafted upgrade)

    this.inventory = EMPTY_INVENTORY();
    this.backpackTier = 1;    // 1 = pockets; crafting a Backpack/Rucksack raises it
    this.selected = 0;
    this.mineKey = null;      // packed coord of the block being mined
    this.mineProgress = 0;    // 0..1
    this.meleeCooldown = 0;
    this.placeCooldown = 0;
    this.fullWarnT = 0;       // throttles the "backpack full" message
    this.onSfx = null;        // (name, detail) => void

    // targeted-block highlight
    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85 })
    );
    this.highlight.visible = false;
    scene.add(this.highlight);
    box.dispose();

    this.buildHeldItem(atlas);
    this.swingT = 0;
    hud.buildHotbar(HOTBAR, atlas);
  }

  buildHeldItem(atlas) {
    // First-person held item, parented to the camera: an axe or a block preview.
    this.held = new THREE.Group();
    this.held.position.set(0.42, -0.4, -0.65);
    this.camera.add(this.held);

    const wood = new THREE.MeshLambertMaterial({ color: 0x7a5636 });
    const steel = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });
    this.axe = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.52, 0.055), wood);
    handle.position.y = -0.05;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.05), steel);
    head.position.set(0.09, 0.24, 0);
    this.axe.add(handle, head);
    this.axe.rotation.z = -0.35;
    this.held.add(this.axe);

    // crafted upgrade: the spiked club
    const darkWood = new THREE.MeshLambertMaterial({ color: 0x4a3220 });
    const stone = new THREE.MeshLambertMaterial({ color: 0x6e6e72 });
    this.club = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.56, 0.07), darkWood);
    shaft.position.y = -0.06;
    const headBlock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.18), stone);
    headBlock.position.y = 0.26;
    this.club.add(shaft, headBlock);
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const spike = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), stone);
      spike.position.set(sx * 0.13, 0.26, sz * 0.13);
      this.club.add(spike);
    }
    this.club.rotation.z = -0.3;
    this.club.visible = false;
    this.held.add(this.club);

    this.blockPreviews = {};
    for (const slot of HOTBAR) {
      if (slot.kind !== 'block') continue;
      const tex = new THREE.CanvasTexture(atlas.tileToCanvas(BLOCKS[slot.id].tiles.side));
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.4 })
      );
      mesh.rotation.y = 0.5;
      mesh.visible = false;
      this.blockPreviews[slot.id] = mesh;
      this.held.add(mesh);
    }
  }

  reset() {
    this.inventory = EMPTY_INVENTORY();
    this.backpackTier = 1;
    this.selected = 0;
    this.mineKey = null;
    this.mineProgress = 0;
    this.weapon = 'axe';
    this.hud.setWeaponIcon('axe');
    this.syncHud();
  }

  // one-time crafted upgrade: longer stuns, bigger knockback
  upgradeWeapon() {
    this.weapon = 'club';
    this.hud.setWeaponIcon('club');
  }

  // ---- backpack: everything you carry shares one capacity pool ----
  get capacity() { return CONFIG.BACKPACK_TIERS[this.backpackTier - 1]; }

  totalCarried() {
    let n = 0;
    for (const v of Object.values(this.inventory)) n += v;
    return n;
  }

  hasRoom(n = 1) { return this.totalCarried() + n <= this.capacity; }

  setBackpackTier(tier) {
    this.backpackTier = Math.max(this.backpackTier, tier);
    this.syncHud();
  }

  syncHud() {
    this.hud.updateHotbar(this.inventory, this.selected);
    this.hud.setBackpack(this.totalCarried(), this.capacity);
  }

  update(dt) {
    const c = this.controls;
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.fullWarnT = Math.max(0, this.fullWarnT - dt);
    this.swingT = Math.max(0, this.swingT - dt * 4);

    // hotbar selection
    if (c.hotbarKey !== null && c.hotbarKey < HOTBAR.length) this.selected = c.hotbarKey;
    if (c.wheelDelta !== 0) {
      this.selected = (this.selected + c.wheelDelta % HOTBAR.length + HOTBAR.length) % HOTBAR.length;
    }
    const slot = HOTBAR[this.selected];
    this.axe.visible = slot.kind === 'weapon' && this.weapon === 'axe';
    this.club.visible = slot.kind === 'weapon' && this.weapon === 'club';
    for (const [id, mesh] of Object.entries(this.blockPreviews)) {
      mesh.visible = slot.kind === 'block' && Number(id) === slot.id;
    }

    // targeting ray from the eye (stops on solid blocks and torches)
    this.camera.getWorldPosition(_origin);
    this.camera.getWorldDirection(_dir);
    let hit = raycastVoxel(this.world, _origin, _dir, CONFIG.REACH, targetable);
    // the solid "floor" below y=0 is a physics wall, not a real block — not
    // targetable (mining it granted infinite drops since setBlock no-ops there)
    if (hit && hit.y < 0) hit = null;

    if (hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.highlight.visible = false;
    }

    // ---- left mouse: melee first, else mine ----
    let mined = false;
    let meleeLanded = false;
    if (c.mouseDown[0] && !this.player.dead) {
      if (c.justPressed[0] && slot.kind === 'weapon' && this.meleeCooldown <= 0) {
        meleeLanded = this.tryMelee(_origin, _dir);
      }
      if (!meleeLanded && hit && BLOCKS[hit.id].breakTime !== undefined) {
        mined = true;
        const key = this.world.packCoord(hit.x, hit.y, hit.z);
        if (key !== this.mineKey) { this.mineKey = key; this.mineProgress = 0; }
        // the axe chops wood faster
        const mult = (slot.kind === 'weapon' && BLOCKS[hit.id].sfx === 'wood') ? 2 : 1;
        this.mineProgress += (dt * mult) / BLOCKS[hit.id].breakTime;
        if (this.swingT <= 0) this.swingT = 0.6;

        // chips fly off the face being worked
        this.chipTimer = (this.chipTimer ?? 0) - dt;
        if (this.chipTimer <= 0) {
          this.chipTimer = 0.13;
          this.particles.burst({
            x: hit.x + 0.5 + hit.nx * 0.55, y: hit.y + 0.5 + hit.ny * 0.55, z: hit.z + 0.5 + hit.nz * 0.55,
            colors: this.atlas.tilePalette(BLOCKS[hit.id].tiles.side),
            count: 2, speed: 1.6, up: 2, ttl: 0.5, size: 0.8, spread: 0.2,
          });
        }

        if (this.mineProgress >= 1) {
          const drops = BLOCKS[hit.id].drops;
          const wantsDrop = drops !== AIR && drops !== undefined && this.inventory[drops] !== undefined;
          if (wantsDrop && !this.hasRoom(1)) {
            // backpack full: the block holds together until there's room for the drop
            this.mineProgress = 1;
            if (this.fullWarnT <= 0) {
              this.fullWarnT = 2.5;
              this.hud.showMessage('Backpack full — place blocks or craft a bigger pack.');
            }
          } else {
            this.particles.burst({
              x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5,
              colors: this.atlas.tilePalette(BLOCKS[hit.id].tiles.side),
              count: 14, speed: 2.8, up: 3.4, ttl: 0.75,
            });
            this.world.setBlock(hit.x, hit.y, hit.z, AIR);
            if (wantsDrop) this.inventory[drops]++;
            if (this.onSfx) this.onSfx('break', BLOCKS[hit.id].sfx);
            this.mineKey = null;
            this.mineProgress = 0;
            this.syncHud();
          }
        }
      }
    }
    if (!mined) { this.mineKey = null; this.mineProgress = 0; }
    this.hud.setMineProgress(mined ? this.mineProgress : 0);

    // ---- right mouse: place block ----
    if (c.mouseDown[2] && this.placeCooldown <= 0 && slot.kind === 'block' && hit && !this.player.dead) {
      const px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
      const targetId = this.world.getBlock(px, py, pz);
      const replaceable = targetId === AIR || targetId === WATER;
      const ghostly = !BLOCKS[slot.id].solid; // torches can share your cell
      if (replaceable && this.inventory[slot.id] > 0 && py >= 0 && py < CONFIG.WORLD_HEIGHT &&
          this.world.inBoundsXZ(px, pz) && (ghostly || !this.blockOverlapsEntity(px, py, pz))) {
        this.world.setBlock(px, py, pz, slot.id, true);
        this.inventory[slot.id]--;
        this.placeCooldown = 0.22;
        this.swingT = 0.6;
        this.particles.burst({
          x: px + 0.5, y: py + 0.5, z: pz + 0.5,
          colors: this.atlas.tilePalette(BLOCKS[slot.id].tiles.side),
          count: 5, speed: 1.4, up: 1.8, ttl: 0.45, size: 0.7,
        });
        if (this.onSfx) this.onSfx('place', BLOCKS[slot.id].sfx);
        this.syncHud();
      }
    }

    // held item swing/bob animation
    const bob = Math.sin(performance.now() * 0.006) * 0.008;
    const swing = Math.sin(Math.min(1, (0.6 - this.swingT) / 0.6 * 2) * Math.PI) * (this.swingT > 0 ? 1 : 0);
    this.held.position.y = -0.4 + bob;
    this.held.rotation.x = -swing * 0.9;

    if (c.hotbarKey !== null || c.wheelDelta !== 0) this.hud.updateHotbar(this.inventory, this.selected);
  }

  blockOverlapsEntity(x, y, z) {
    if (entityOverlapsBlock(this.player, x, y, z)) return true;
    for (const k of this.getKillers()) {
      if (!k.despawned && entityOverlapsBlock(k, x, y, z)) return true;
    }
    return false;
  }

  tryMelee(origin, lookDir) {
    this.meleeCooldown = CONFIG.MELEE_COOLDOWN;
    this.swingT = 0.6;
    const stunMult = this.weapon === 'club' ? 1.7 : 1;
    const kbMult = this.weapon === 'club' ? 1.5 : 1;
    let hitAny = false;
    for (const k of this.getKillers()) {
      if (k.despawned) continue;
      _killerMid.set(k.pos.x, k.pos.y + k.height * 0.6, k.pos.z);
      const dist = _killerMid.distanceTo(origin);
      if (dist > CONFIG.MELEE_RANGE) continue;
      _toKiller.subVectors(_killerMid, origin).normalize();
      if (_toKiller.dot(lookDir) < CONFIG.MELEE_CONE) continue;
      if (!lineOfSight(this.world, origin, _killerMid)) continue;
      if (k.tryStun(_toKiller, stunMult, kbMult)) {
        hitAny = true;
        this.particles.burst({
          x: _killerMid.x, y: _killerMid.y, z: _killerMid.z,
          colors: SPARK_COLORS, count: 10, speed: 3.2, up: 3, ttl: 0.5, size: 0.8,
        });
      }
    }
    if (this.onSfx) this.onSfx(hitAny ? 'meleeHit' : 'whoosh');
    return hitAny;
  }
}
