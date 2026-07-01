import { Killer, STATES } from './killer.js';
import { ROSTER, ROSTER_BY_ID } from '../characters/roster.js';
import { randomSpotAround } from './behaviors.js';
import { CONFIG } from '../config.js';

// A probe AABB used to validate spawn spots before a Killer instance exists.
const SPAWN_PROBE = { width: 0.8, height: 2.8 };

export class Director {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.killers = [];
    this.seen = new Set(); // roster ids already used this run, for variety bias
  }

  reset() {
    for (const k of this.killers) k.despawn();
    this.killers = [];
    this.seen.clear();
  }

  // Dusk: pick tonight's cast. More (and faster — see Killer's scaling) each night,
  // biased toward icons the player hasn't met yet.
  spawnNight(night, ctx) {
    const count = Math.min(1 + Math.floor((night - 1) * 0.75), CONFIG.MAX_KILLERS);
    const eligible = ROSTER.filter((d) => night >= d.stats.firstNight);
    const ranked = [...eligible].sort((a, b) =>
      ((this.seen.has(a.id) ? 1 : 0) + Math.random()) - ((this.seen.has(b.id) ? 1 : 0) + Math.random())
    );
    for (const def of ranked.slice(0, count)) this.spawnKiller(def, night, ctx);
  }

  spawnKiller(def, night, ctx) {
    const probe = { width: def.aabb?.w ?? SPAWN_PROBE.width, height: def.aabb?.h ?? SPAWN_PROBE.height };
    let spot = randomSpotAround(this.world, ctx.player.pos, CONFIG.SPAWN_MIN_DIST, CONFIG.SPAWN_MAX_DIST,
      probe, (s) => !ctx.playerCanSeePoint(s));
    if (!spot) {
      spot = randomSpotAround(this.world, ctx.player.pos, CONFIG.SPAWN_MIN_DIST, CONFIG.SPAWN_MAX_DIST, probe);
    }
    if (!spot) return null;
    const killer = new Killer(def, this.world, this.scene, night);
    killer.spawnAt(spot);
    if (def.behavior?.onSpawn) def.behavior.onSpawn(killer, ctx);
    this.killers.push(killer);
    this.seen.add(def.id);
    return killer;
  }

  // Debug/test hook: drop a specific killer right outside melee range.
  forceSpawn(id, ctx, night = null) {
    const def = ROSTER_BY_ID[id];
    if (!def) return null;
    const probe = { width: def.aabb?.w ?? SPAWN_PROBE.width, height: def.aabb?.h ?? SPAWN_PROBE.height };
    const spot = randomSpotAround(this.world, ctx.player.pos, 8, 14, probe) ??
      { x: ctx.player.pos.x + 6, y: ctx.player.pos.y + 1, z: ctx.player.pos.z };
    const killer = new Killer(def, this.world, this.scene, night ?? ctx.night ?? 1);
    killer.spawnAt(spot);
    if (def.behavior?.onSpawn) def.behavior.onSpawn(killer, ctx);
    this.killers.push(killer);
    this.seen.add(def.id);
    return killer;
  }

  dawn(ctx) {
    for (const k of this.killers) k.flee(ctx);
  }

  update(dt, ctx) {
    let anyGone = false;
    const daylight = !ctx.daynight.isNight;
    for (const k of this.killers) {
      // daylight is absolute: whatever state a killer wriggled back into, it flees
      if (daylight && k.state !== STATES.FLEE && k.state !== STATES.STUNNED) k.flee(ctx);
      k.update(dt, ctx);
      if (k.despawned) anyGone = true;
    }
    if (anyGone) this.killers = this.killers.filter((k) => !k.despawned);
  }

  anyChasing() {
    return this.killers.some((k) =>
      !k.despawned && (k.state === STATES.CHASE || k.state === STATES.ATTACK));
  }

  nearestDist(playerPos) {
    let min = Infinity;
    for (const k of this.killers) {
      if (k.despawned) continue;
      const d = k.pos.distanceTo(playerPos);
      if (d < min) min = d;
    }
    return min;
  }
}
