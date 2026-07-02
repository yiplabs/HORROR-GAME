import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { raycastVoxel, lineOfSight } from '../world/raycast.js';
import { BLOCKS, AIR, WATER, DIRT, STONE, SAND, LOG, LEAVES, PLANKS } from '../world/blocks.js';
import { entityOverlapsBlock } from '../core/physics.js';

export const HOTBAR = [
  { kind: 'weapon', label: 'Axe' },
  { kind: 'block', id: PLANKS },
  { kind: 'block', id: DIRT },
  { kind: 'block', id: STONE },
  { kind: 'block', id: SAND },
  { kind: 'block', id: LOG },
  { kind: 'block', id: LEAVES },
];

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _toKiller = new THREE.Vector3();
const _killerMid = new THREE.Vector3();

export class Interaction {
  constructor(world, player, controls, camera, scene, hud, getKillers, atlas) {
    this.world = world;
    this.player = player;
    this.controls = controls;
    this.camera = camera;
    this.hud = hud;
    this.getKillers = getKillers;

    this.inventory = { [PLANKS]: CONFIG.START_PLANKS, [DIRT]: 0, [STONE]: 0, [SAND]: 0, [LOG]: 0, [LEAVES]: 0 };
    this.selected = 0;
    this.mineKey = null;      // packed coord of the block being mined
    this.mineProgress = 0;    // 0..1
    this.meleeCooldown = 0;
    this.placeCooldown = 0;
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
        new THREE.MeshLambertMaterial({ map: tex })
      );
      mesh.rotation.y = 0.5;
      mesh.visible = false;
      this.blockPreviews[slot.id] = mesh;
      this.held.add(mesh);
    }
  }

  reset() {
    this.inventory = { [PLANKS]: CONFIG.START_PLANKS, [DIRT]: 0, [STONE]: 0, [SAND]: 0, [LOG]: 0, [LEAVES]: 0 };
    this.selected = 0;
    this.mineKey = null;
    this.mineProgress = 0;
    this.hud.updateHotbar(this.inventory, this.selected);
  }

  update(dt) {
    const c = this.controls;
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.swingT = Math.max(0, this.swingT - dt * 4);

    // hotbar selection
    if (c.hotbarKey !== null && c.hotbarKey < HOTBAR.length) this.selected = c.hotbarKey;
    if (c.wheelDelta !== 0) {
      this.selected = (this.selected + c.wheelDelta % HOTBAR.length + HOTBAR.length) % HOTBAR.length;
    }
    const slot = HOTBAR[this.selected];
    this.axe.visible = slot.kind === 'weapon';
    for (const [id, mesh] of Object.entries(this.blockPreviews)) {
      mesh.visible = slot.kind === 'block' && Number(id) === slot.id;
    }

    // targeting ray from the eye
    this.camera.getWorldPosition(_origin);
    this.camera.getWorldDirection(_dir);
    let hit = raycastVoxel(this.world, _origin, _dir, CONFIG.REACH);
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
        if (this.mineProgress >= 1) {
          const drops = BLOCKS[hit.id].drops;
          this.world.setBlock(hit.x, hit.y, hit.z, AIR);
          if (drops !== AIR && drops !== undefined && this.inventory[drops] !== undefined) {
            this.inventory[drops]++;
          }
          if (this.onSfx) this.onSfx('break', BLOCKS[hit.id].sfx);
          this.mineKey = null;
          this.mineProgress = 0;
          this.hud.updateHotbar(this.inventory, this.selected);
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
      if (replaceable && this.inventory[slot.id] > 0 && py >= 0 && py < CONFIG.WORLD_HEIGHT &&
          this.world.inBoundsXZ(px, pz) && !this.blockOverlapsEntity(px, py, pz)) {
        this.world.setBlock(px, py, pz, slot.id, true);
        this.inventory[slot.id]--;
        this.placeCooldown = 0.22;
        this.swingT = 0.6;
        if (this.onSfx) this.onSfx('place', BLOCKS[slot.id].sfx);
        this.hud.updateHotbar(this.inventory, this.selected);
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
    let hitAny = false;
    for (const k of this.getKillers()) {
      if (k.despawned) continue;
      _killerMid.set(k.pos.x, k.pos.y + k.height * 0.6, k.pos.z);
      const dist = _killerMid.distanceTo(origin);
      if (dist > CONFIG.MELEE_RANGE) continue;
      _toKiller.subVectors(_killerMid, origin).normalize();
      if (_toKiller.dot(lookDir) < CONFIG.MELEE_CONE) continue;
      if (!lineOfSight(this.world, origin, _killerMid)) continue;
      if (k.tryStun(_toKiller)) hitAny = true;
    }
    if (this.onSfx) this.onSfx(hitAny ? 'meleeHit' : 'whoosh');
    return hitAny;
  }
}
