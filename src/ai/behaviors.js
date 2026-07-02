import { CONFIG } from '../config.js';
import { aabbFree } from '../core/physics.js';
import { LEAVES, LOG } from '../world/blocks.js';

// Reusable building blocks for character quirks. Roster behavior hooks compose these.

// Standing spot on the terrain surface at (x, z), or null if drowned/blocked.
export function surfaceSpot(world, x, z, killer) {
  const bx = Math.floor(x), bz = Math.floor(z);
  const top = world.surfaceHeight(bx, bz);
  if (top < CONFIG.WATER_Y) return null; // don't materialize in the ocean
  const ground = world.getBlock(bx, top, bz);
  if (ground === LEAVES || ground === LOG) return null; // not on tree canopies
  const spot = { x: bx + 0.5, y: top + 1, z: bz + 0.5 };
  if (killer && !aabbFree(world, { x: spot.x, y: spot.y + 0.01, z: spot.z }, killer.width, killer.height)) return null;
  return spot;
}

// Random valid spot in a ring around a center point. validator(spot) may veto.
export function randomSpotAround(world, center, minR, maxR, killer, validator = null, tries = 24) {
  for (let i = 0; i < tries; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const spot = surfaceSpot(world, center.x + Math.cos(a) * r, center.z + Math.sin(a) * r, killer);
    if (!spot) continue;
    if (validator && !validator(spot)) continue;
    return spot;
  }
  return null;
}

// Teleport somewhere the player is NOT looking. Returns true on success.
export function teleportUnseen(killer, ctx, center, minR, maxR, sfxName = 'teleport') {
  const spot = randomSpotAround(killer.world, center, minR, maxR, killer,
    (s) => !ctx.playerCanSeePoint(s));
  if (!spot) return false;
  killer.teleportTo(spot);
  if (ctx.sfx && sfxName) ctx.sfx(sfxName, null, killer.pos);
  return true;
}

// Teleport to a point N blocks behind the player's current facing.
export function teleportBehindPlayer(killer, ctx, dist, sfxName = 'teleport') {
  const p = ctx.player;
  const fx = Math.sin(ctx.playerYaw()), fz = Math.cos(ctx.playerYaw());
  // camera looks along -Z at yaw 0, so "behind" is +forwardDir inverted
  const spot = surfaceSpot(killer.world, p.pos.x + fx * dist, p.pos.z + fz * dist, killer);
  if (!spot) return false;
  killer.teleportTo(spot);
  if (ctx.sfx && sfxName) ctx.sfx(sfxName, null, killer.pos);
  return true;
}
