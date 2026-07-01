import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { moveAABB } from '../core/physics.js';

const _wish = new THREE.Vector3();

export class Player {
  constructor(world, camera, controls) {
    this.world = world;
    this.camera = camera;
    this.controls = controls;
    camera.rotation.order = 'YXZ';

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.width = CONFIG.PLAYER_WIDTH;
    this.height = CONFIG.PLAYER_HEIGHT;
    this.onGround = false;

    this.health = CONFIG.MAX_HEALTH;
    this.stamina = 100;
    this.sprinting = false;
    this.dead = false;
    this.lastAttacker = null;
    this.stepTimer = 0;

    this.onDeath = null;   // (attacker) => void
    this.onDamage = null;  // (amount) => void
    this.onStep = null;    // (speed) => void
  }

  reset(spawn) {
    this.pos.set(spawn.x, spawn.y, spawn.z);
    this.vel.set(0, 0, 0);
    this.health = CONFIG.MAX_HEALTH;
    this.stamina = 100;
    this.dead = false;
    this.lastAttacker = null;
    this.controls.yaw = Math.random() * Math.PI * 2;
    this.controls.pitch = 0;
    this.syncCamera();
  }

  getEye(target) {
    return target.set(this.pos.x, this.pos.y + CONFIG.EYE_HEIGHT, this.pos.z);
  }

  syncCamera() {
    this.camera.position.set(this.pos.x, this.pos.y + CONFIG.EYE_HEIGHT, this.pos.z);
    this.camera.rotation.y = this.controls.yaw;
    this.camera.rotation.x = this.controls.pitch;
  }

  update(dt, isDay) {
    const c = this.controls;

    // movement wish direction in world space
    _wish.set(0, 0, 0);
    if (!this.dead && c.enabled) {
      if (c.keys.KeyW) _wish.z -= 1;
      if (c.keys.KeyS) _wish.z += 1;
      if (c.keys.KeyA) _wish.x -= 1;
      if (c.keys.KeyD) _wish.x += 1;
    }
    const moving = _wish.lengthSq() > 0;
    if (moving) _wish.normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, c.yaw);

    // sprint + stamina
    const wantsSprint = !!c.keys.ShiftLeft && moving && _wish.dot(this.forwardDir()) > 0.3;
    this.sprinting = wantsSprint && this.stamina > 1;
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - CONFIG.STAMINA_DRAIN * dt);
    else this.stamina = Math.min(100, this.stamina + CONFIG.STAMINA_REGEN * dt);

    const speed = this.sprinting ? CONFIG.SPRINT_SPEED : CONFIG.WALK_SPEED;
    const accel = this.onGround ? 14 : 3.5;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (_wish.x * speed - this.vel.x) * k;
    this.vel.z += (_wish.z * speed - this.vel.z) * k;

    // gravity + jump
    this.vel.y -= CONFIG.GRAVITY * dt;
    this.vel.y = Math.max(this.vel.y, -50);
    if (!this.dead && c.enabled && c.keys.Space && this.onGround) this.vel.y = CONFIG.JUMP_SPEED;

    moveAABB(this.world, this, dt);

    // footsteps
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hSpeed > 1.5) {
      this.stepTimer -= dt * hSpeed;
      if (this.stepTimer <= 0) {
        this.stepTimer = 2.2;
        if (this.onStep) this.onStep(hSpeed);
      }
    }

    // slow regen, daytime only
    if (isDay && !this.dead) {
      this.health = Math.min(CONFIG.MAX_HEALTH, this.health + CONFIG.HEALTH_REGEN_DAY * dt);
    }

    // void safety net
    if (this.pos.y < -12) this.damage(99, null, null);

    this.syncCamera();
  }

  forwardDir() {
    return _forward.set(-Math.sin(this.controls.yaw), 0, -Math.cos(this.controls.yaw));
  }

  damage(amount, fromPos, attacker) {
    if (this.dead) return;
    this.health -= amount;
    if (attacker) this.lastAttacker = attacker;
    if (fromPos) {
      const dx = this.pos.x - fromPos.x, dz = this.pos.z - fromPos.z;
      const d = Math.hypot(dx, dz) || 1;
      this.vel.x += (dx / d) * 7;
      this.vel.z += (dz / d) * 7;
      this.vel.y += 4;
    }
    if (this.onDamage) this.onDamage(amount);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      if (this.onDeath) this.onDeath(this.lastAttacker);
    }
  }
}

const _forward = new THREE.Vector3();
