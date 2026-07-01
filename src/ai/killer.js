import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { moveAABB } from '../core/physics.js';
import { buildRig, animateRig, disposeRig } from '../characters/rig.js';
import { lineOfSight } from '../world/raycast.js';
import { BLOCKS, AIR } from '../world/blocks.js';

export const STATES = {
  SPAWNING: 'SPAWNING', ROAM: 'ROAM', STALK: 'STALK', CHASE: 'CHASE',
  ATTACK: 'ATTACK', STUNNED: 'STUNNED', FLEE: 'FLEE',
};

const THINK_DT = 1 / CONFIG.THINK_HZ;
const ATTACK_DURATION = 0.5;

const _eye = new THREE.Vector3();
const _playerEye = new THREE.Vector3();
const _tmp = new THREE.Vector3();

let killerCounter = 0;

// Shared chassis every horror icon runs on: FSM + steering + auto-hop + unstuck +
// block breaking. Per-character personality comes from def.behavior hooks
// (think / onSpawn / onStuck / onStun / onDespawn / effects) layered on top.
export class Killer {
  constructor(def, world, scene, night) {
    this.def = def;
    this.world = world;
    this.scene = scene;
    this.night = night;

    // difficulty scaling per night
    const speedMult = Math.min(1 + CONFIG.SPEED_SCALE_PER_NIGHT * (night - 1), CONFIG.SPEED_SCALE_MAX);
    this.stats = { ...def.stats };
    this.stats.speedStalk *= speedMult;
    this.stats.speedChase *= speedMult;
    this.stats.sightRange += CONFIG.SIGHT_BONUS_PER_NIGHT * (night - 1);
    this.stats.stalkTime = Math.max(2, (this.stats.stalkTime ?? 8) - (night - 1));

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.width = def.aabb?.w ?? 0.6 * (def.scale || 1);
    this.height = def.aabb?.h ?? 1.9 * (def.scale || 1);
    this.onGround = false;
    this.blockedXZ = false;

    this.rig = buildRig(def);
    this.scene.add(this.rig.group);

    this.state = STATES.SPAWNING;
    this.stateTime = 0;
    this.thinkTimer = (killerCounter++ % CONFIG.THINK_HZ) * THINK_DT * 0.5; // stagger
    this.target = new THREE.Vector3();
    this.moveSpeed = 0;
    this.facing = Math.random() * Math.PI * 2;
    this.turnRate = def.turnRate ?? 10;

    // cached per-think perception
    this.distToPlayer = 999;
    this.canSee = false;
    this.observed = false;
    this.crouching = false;

    this.stunTimer = 0;
    this.immunity = 0;
    this.attackT = 0;
    this.attackCooldown = 0;
    this.unseenTime = 0;
    this.stalkClock = 0;

    this.stuckWindow = 0;
    this.stuckAnchor = new THREE.Vector3();
    this.sidestepTimer = 0;
    this.sidestepSign = 1;
    this.breaking = null; // { x, y, z, time, total }

    this.despawned = false;
    this.data = {};       // per-behavior scratch space
  }

  spawnAt(spot) {
    this.pos.set(spot.x, spot.y, spot.z);
    this.rig.group.position.copy(this.pos);
    this.stuckAnchor.copy(this.pos);
  }

  teleportTo(spot) {
    this.pos.set(spot.x, spot.y, spot.z);
    this.vel.set(0, 0, 0);
    this.stuckAnchor.copy(this.pos);
    this.stuckWindow = 0;
    this.breaking = null;
  }

  eyePos(target = _eye) {
    return target.set(this.pos.x, this.pos.y + this.height * 0.9, this.pos.z);
  }

  setState(next, ctx) {
    if (this.state === next) return;
    const prev = this.state;
    this.state = next;
    this.stateTime = 0;
    this.unseenTime = 0;
    this.stalkClock = 0;
    if (next === STATES.CHASE && prev !== STATES.ATTACK && prev !== STATES.STUNNED && ctx?.onChaseStart) {
      ctx.onChaseStart(this);
    }
  }

  tryStun(dir) {
    if (this.despawned || this.state === STATES.SPAWNING || this.immunity > 0) return false;
    this.setState(STATES.STUNNED, null);
    this.stunTimer = this.stats.stunTime ?? 2;
    this.attackT = 0;
    this.breaking = null;
    this.vel.x = dir.x * CONFIG.MELEE_KNOCKBACK;
    this.vel.z = dir.z * CONFIG.MELEE_KNOCKBACK;
    this.vel.y = 3.5;
    this.flash(0xffffff);
    if (this.def.behavior?.onStun) this.def.behavior.onStun(this);
    return true;
  }

  flash(color) {
    this.rig.material.emissive.setHex(color);
    this.data.flashUntil = performance.now() + 130;
  }

  update(dt, ctx) {
    if (this.despawned) return;
    this.stateTime += dt;
    this.immunity = Math.max(0, this.immunity - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.data.flashUntil && performance.now() > this.data.flashUntil) {
      this.rig.material.emissive.setHex(0x000000);
      this.data.flashUntil = null;
    }

    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer += THINK_DT;
      this.think(ctx);
    }

    // ---- state-specific per-frame logic ----
    let wantsMove = false;
    switch (this.state) {
      case STATES.SPAWNING:
        if (this.stateTime > 1) this.setState(STATES.ROAM, ctx);
        break;
      case STATES.STUNNED:
        this.stunTimer -= dt;
        if (this.stunTimer <= 0) {
          this.immunity = CONFIG.STUN_IMMUNITY;
          this.setState(STATES.CHASE, ctx);
        }
        break;
      case STATES.ATTACK: {
        const before = this.attackT;
        this.attackT = Math.min(1, this.attackT + dt / ATTACK_DURATION);
        if (before < 0.5 && this.attackT >= 0.5) this.landAttack(ctx);
        if (this.attackT >= 1) {
          this.attackT = 0;
          this.attackCooldown = this.stats.attackCooldown ?? 1.2;
          this.setState(STATES.CHASE, ctx);
        }
        break;
      }
      default:
        wantsMove = true;
    }

    // block breaking pauses movement
    if (this.breaking) {
      wantsMove = false;
      this.breaking.time += dt;
      if (this.breaking.time >= this.breaking.total) {
        const b = this.breaking;
        if (this.world.getBlock(b.x, b.y, b.z) !== AIR) {
          const sfx = BLOCKS[this.world.getBlock(b.x, b.y, b.z)].sfx;
          this.world.setBlock(b.x, b.y, b.z, AIR);
          if (ctx.sfx) ctx.sfx('break', sfx, this.pos);
        }
        this.breaking = null;
      }
    }

    if (wantsMove) this.steer(dt);
    else if (this.state !== STATES.STUNNED) { this.vel.x *= 0.8; this.vel.z *= 0.8; }

    // physics
    this.vel.y -= CONFIG.KILLER_GRAVITY * dt;
    this.vel.y = Math.max(this.vel.y, -50);
    moveAABB(this.world, this, dt);

    if (wantsMove) {
      this.autoHop();
      this.trackStuck(dt, ctx);
    }

    this.syncRig(dt, ctx);
    if (this.def.behavior?.effects) this.def.behavior.effects(this, ctx, dt);
  }

  // ---- perception + default FSM transitions, at THINK_HZ ----
  think(ctx) {
    const player = ctx.player;
    this.distToPlayer = this.pos.distanceTo(player.pos);
    player.getEye(_playerEye);
    this.canSee = this.distToPlayer < this.stats.sightRange &&
      lineOfSight(this.world, this.eyePos(), _playerEye);
    this.observed = ctx.playerLookingAt(this);
    this.crouching = false;

    switch (this.state) {
      case STATES.ROAM: {
        this.moveSpeed = this.stats.speedStalk * 0.85;
        if (_tmp.set(this.target.x, this.pos.y, this.target.z).distanceTo(this.pos) < 2 || this.stateTime > 12) {
          const a = Math.random() * Math.PI * 2;
          const r = 10 + Math.random() * 18;
          this.target.set(player.pos.x + Math.cos(a) * r, 0, player.pos.z + Math.sin(a) * r);
          this.stateTime = 0.01;
        }
        if (this.canSee && this.distToPlayer < this.stats.stalkRange) this.setState(STATES.STALK, ctx);
        if (this.canSee && this.distToPlayer < 7) this.setState(STATES.CHASE, ctx);
        break;
      }
      case STATES.STALK: {
        this.moveSpeed = this.stats.speedStalk;
        this.target.copy(player.pos);
        if (this.canSee) {
          this.stalkClock += THINK_DT;
          this.unseenTime = 0;
        } else {
          this.unseenTime += THINK_DT;
        }
        if (this.canSee && (this.stalkClock > this.stats.stalkTime || this.distToPlayer < 6)) {
          this.setState(STATES.CHASE, ctx);
        } else if (this.unseenTime > 10) {
          this.setState(STATES.ROAM, ctx);
        }
        break;
      }
      case STATES.CHASE: {
        this.moveSpeed = this.stats.speedChase;
        this.target.copy(player.pos);
        if (this.canSee) this.unseenTime = 0;
        else this.unseenTime += THINK_DT;
        if (this.unseenTime > (this.stats.loseSightTime ?? 8)) {
          this.setState(STATES.STALK, ctx);
        } else if (this.distToPlayer < (this.stats.attackRange ?? 1.7) && this.attackCooldown <= 0 &&
                   !player.dead && this.canSee) {
          this.attackT = 0.001;
          this.setState(STATES.ATTACK, ctx);
        }
        break;
      }
      case STATES.FLEE: {
        this.moveSpeed = this.stats.speedChase * 1.1;
        _tmp.subVectors(this.pos, player.pos);
        _tmp.y = 0;
        if (_tmp.lengthSq() < 0.01) _tmp.set(1, 0, 0);
        _tmp.normalize();
        this.target.set(this.pos.x + _tmp.x * 20, 0, this.pos.z + _tmp.z * 20);
        if (this.stateTime > 5 || this.distToPlayer > CONFIG.DESPAWN_DIST) this.despawn();
        break;
      }
    }

    if (this.def.behavior?.think) this.def.behavior.think(this, ctx);
  }

  steer(dt) {
    let dx = this.target.x - this.pos.x;
    let dz = this.target.z - this.pos.z;
    if (this.sidestepTimer > 0) {
      this.sidestepTimer -= dt;
      const len = Math.hypot(dx, dz) || 1;
      const px = (-dz / len) * this.sidestepSign, pz = (dx / len) * this.sidestepSign;
      dx = px; dz = pz;
    }
    const dist = Math.hypot(dx, dz);
    if (dist < 0.4 || this.moveSpeed <= 0) {
      this.vel.x *= 0.8;
      this.vel.z *= 0.8;
      return;
    }
    // heading turns toward the target at turnRate — The Butcher corners badly on purpose
    const desired = Math.atan2(dx, dz);
    let diff = desired - this.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = this.turnRate * dt;
    this.facing += Math.max(-maxTurn, Math.min(maxTurn, diff));

    const k = 1 - Math.exp(-8 * dt);
    this.vel.x += (Math.sin(this.facing) * this.moveSpeed - this.vel.x) * k;
    this.vel.z += (Math.cos(this.facing) * this.moveSpeed - this.vel.z) * k;
  }

  autoHop() {
    if (!this.blockedXZ || !this.onGround) return;
    // hop if the obstacle is exactly one block tall with head clearance
    const dirX = Math.sin(this.facing), dirZ = Math.cos(this.facing);
    const bx = Math.floor(this.pos.x + dirX * (this.width / 2 + 0.4));
    const bz = Math.floor(this.pos.z + dirZ * (this.width / 2 + 0.4));
    const feetY = Math.floor(this.pos.y + 0.01);
    if (this.world.isSolid(bx, feetY, bz) &&
        !this.world.isSolid(bx, feetY + 1, bz) &&
        !this.world.isSolid(Math.floor(this.pos.x), feetY + Math.ceil(this.height) + 1, Math.floor(this.pos.z))) {
      this.vel.y = CONFIG.KILLER_JUMP;
    }
  }

  trackStuck(dt, ctx) {
    if (this.state !== STATES.STALK && this.state !== STATES.CHASE) return;
    this.stuckWindow += dt;
    if (this.stuckWindow < 1.5) return;
    const progress = Math.hypot(this.pos.x - this.stuckAnchor.x, this.pos.z - this.stuckAnchor.z);
    this.stuckWindow = 0;
    this.stuckAnchor.copy(this.pos);
    if (progress < 0.5 && !this.breaking) {
      if (this.def.behavior?.onStuck) this.def.behavior.onStuck(this, ctx);
      else this.defaultUnstuck();
    }
  }

  defaultUnstuck() {
    this.sidestepTimer = 1.3;
    this.sidestepSign = Math.random() < 0.5 ? -1 : 1;
  }

  // Queue a block break directly ahead (feet or head height). filter(x,y,z) gates it.
  startBreakingAhead(secondsPerBlock, filter = null) {
    const dirX = Math.sin(this.facing), dirZ = Math.cos(this.facing);
    const bx = Math.floor(this.pos.x + dirX * (this.width / 2 + 0.5));
    const bz = Math.floor(this.pos.z + dirZ * (this.width / 2 + 0.5));
    const feetY = Math.floor(this.pos.y + 0.01);
    for (const y of [feetY + 1, feetY, feetY + 2]) {
      if (y < 0 || y >= CONFIG.WORLD_HEIGHT) continue;
      if (!this.world.isSolid(bx, y, bz)) continue;
      if (filter && !filter(bx, y, bz)) continue;
      this.breaking = { x: bx, y, z: bz, time: 0, total: secondsPerBlock };
      return true;
    }
    return false;
  }

  landAttack(ctx) {
    const player = ctx.player;
    if (player.dead) return;
    if (this.distToPlayer > (this.stats.attackRange ?? 1.7) + 0.6) return;
    player.damage(this.stats.damage, this.pos, this);
    if (ctx.sfx) ctx.sfx('playerHurt');
  }

  syncRig(dt, ctx) {
    const rig = this.rig;

    // The Drowned Girl renders in quantized snaps; everyone else tracks smoothly.
    if (this.def.anim?.stutter) {
      this.data.snapT = (this.data.snapT || 0) + dt;
      if (this.data.snapT > 0.38) {
        this.data.snapT = 0;
        rig.group.position.copy(this.pos);
        rig.group.rotation.y = this.facing;
      }
    } else {
      rig.group.position.copy(this.pos);
      // face movement direction, or the player while stalking/chasing/attacking
      let face = this.facing;
      if (this.state === STATES.STALK || this.state === STATES.CHASE ||
          this.state === STATES.ATTACK || this.moveSpeed === 0) {
        const dx = ctx.player.pos.x - this.pos.x, dz = ctx.player.pos.z - this.pos.z;
        if (this.state !== STATES.ROAM && (dx !== 0 || dz !== 0) &&
            (this.moveSpeed === 0 || this.distToPlayer < 10)) {
          face = Math.atan2(dx, dz);
        }
      }
      let diff = face - rig.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rig.group.rotation.y += diff * Math.min(1, dt * 6);
    }

    // head look-at, in body-local angles
    const dx = ctx.player.pos.x - this.pos.x, dz = ctx.player.pos.z - this.pos.z;
    const worldYaw = Math.atan2(dx, dz);
    let headYaw = worldYaw - rig.group.rotation.y;
    while (headYaw > Math.PI) headYaw -= Math.PI * 2;
    while (headYaw < -Math.PI) headYaw += Math.PI * 2;
    const dy = (ctx.player.pos.y + 1.6) - (this.pos.y + this.height * 0.9);
    const headPitch = -Math.atan2(dy, Math.hypot(dx, dz)) * 0.8;

    animateRig(rig, dt, {
      moveSpeed: Math.hypot(this.vel.x, this.vel.z),
      headYaw,
      headPitch,
      crouch: this.crouching,
      attackT: this.attackT,
      time: ctx.time,
    });
  }

  flee(ctx) {
    if (this.state !== STATES.FLEE) this.setState(STATES.FLEE, ctx);
  }

  despawn() {
    if (this.despawned) return;
    this.despawned = true;
    if (this.def.behavior?.onDespawn) this.def.behavior.onDespawn(this);
    this.scene.remove(this.rig.group);
    disposeRig(this.rig);
  }
}
