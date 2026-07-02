import { makeNoise2D, fbm2D } from '../core/noise.js';
import { mulberry32, hash2D } from '../core/rng.js';
import { GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, WATER, AIR } from './blocks.js';
import { WORLD_SIZE } from './world.js';
import { CONFIG } from '../config.js';

// Generates the island: fBM heightmap with radial falloff (beach ring, ocean rim),
// strata, water, scattered trees, and two derelict cabins. Returns the spawn point.
export function generateWorld(world, seed) {
  const noise = makeNoise2D(seed);
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const center = WORLD_SIZE / 2;
  const WATER_Y = CONFIG.WATER_Y;

  // --- heightmap + strata ---
  const heights = new Int16Array(WORLD_SIZE * WORLD_SIZE);
  for (let z = 0; z < WORLD_SIZE; z++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      const r = Math.hypot(x - center, z - center) / (WORLD_SIZE / 2);
      const t = Math.min(Math.max((0.95 - r) / 0.4, 0), 1);
      const falloff = t * t * (3 - 2 * t);
      const n = fbm2D(noise, x * 0.02, z * 0.02, 4) * 0.5 + 0.5;
      // h = y of the first air block in this column
      const h = Math.max(2, Math.round(9 + n * 24 * falloff));
      heights[z * WORLD_SIZE + x] = h;

      const beach = h <= WATER_Y + 2;
      for (let y = 0; y < h; y++) {
        let id;
        if (y < h - 4) id = STONE;
        else if (y < h - 1) id = beach ? SAND : DIRT;
        else id = beach ? SAND : GRASS;
        world.setBlockSilent(x, y, z, id);
      }
      // flood the ocean rim
      for (let y = h; y <= WATER_Y; y++) world.setBlockSilent(x, y, z, WATER);
    }
  }
  const heightAt = (x, z) => heights[z * WORLD_SIZE + x];

  // --- cabins (before trees so trees keep clear of them) ---
  const cabinSpots = [];
  const cabinAngle = rand() * Math.PI * 2;
  // second cabin on the far side of the island so they can never overlap
  for (const angle of [cabinAngle, cabinAngle + Math.PI + (rand() - 0.5) * 0.8]) {
    const dist = 20 + rand() * 10;
    const cx = Math.round(center + Math.cos(angle) * dist);
    const cz = Math.round(center + Math.sin(angle) * dist);
    const spot = stampCabin(world, heights, cx, cz, center);
    if (spot) cabinSpots.push(spot);
  }

  // --- trees ---
  const clearOf = (x, z) => {
    if (Math.hypot(x - center, z - center) < 10) return false;
    for (const c of cabinSpots) {
      if (Math.abs(x - c.x) < 8 && Math.abs(z - c.z) < 8) return false;
    }
    return true;
  };
  for (let z = 4; z < WORLD_SIZE - 4; z++) {
    for (let x = 4; x < WORLD_SIZE - 4; x++) {
      if (hash2D(x, z, seed) >= 0.007) continue;
      const h = heightAt(x, z);
      if (h <= WATER_Y + 2 || h > 40) continue;
      if (world.getBlock(x, h - 1, z) !== GRASS) continue;
      if (!clearOf(x, z)) continue;
      plantTree(world, x, h, z, seed);
    }
  }

  // --- spawn ---
  const sy = world.surfaceHeight(Math.floor(center), Math.floor(center));
  return { x: center + 0.5, y: sy + 1, z: center + 0.5 };
}

function plantTree(world, x, groundY, z, seed) {
  const trunkH = 4 + Math.floor(hash2D(x, z, seed + 7) * 3);
  for (let i = 0; i < trunkH; i++) world.setBlockSilent(x, groundY + i, z, LOG);
  const top = groundY + trunkH;
  for (let dy = -2; dy <= 1; dy++) {
    const radius = dy < 0 ? 2 : 1;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dz === 0 && dy < 0) continue; // trunk passes through
        // trim corners for a rounder canopy
        if (Math.abs(dx) === radius && Math.abs(dz) === radius && hash2D(x + dx, z + dz, seed + dy) < 0.6) continue;
        if (world.getBlock(x + dx, top + dy, z + dz) === AIR) {
          world.setBlockSilent(x + dx, top + dy, z + dz, LEAVES);
        }
      }
    }
  }
  world.setBlockSilent(x, top + 2, z, LEAVES);
}

// A derelict plank cabin: 9x7 footprint, log corner posts, doorway facing the island
// center, window holes, flat roof. Gives the player a defensible anchor on night 1.
function stampCabin(world, heights, cx, cz, center) {
  const W = 9, D = 7; // exterior footprint (x by z)
  const x0 = cx - Math.floor(W / 2), z0 = cz - Math.floor(D / 2);

  // ground level = average first-air height over the footprint; reject steep spots
  let sum = 0, min = 999, max = -999;
  for (let z = z0; z < z0 + D; z++) {
    for (let x = x0; x < x0 + W; x++) {
      const h = heights[z * WORLD_SIZE + x];
      sum += h; min = Math.min(min, h); max = Math.max(max, h);
    }
  }
  if (max - min > 5) return null;
  const g = Math.round(sum / (W * D));
  if (g <= CONFIG.WATER_Y + 1) return null;

  // flatten: fill up to g-1, clear everything above (also removes any water)
  for (let z = z0 - 1; z < z0 + D + 1; z++) {
    for (let x = x0 - 1; x < x0 + W + 1; x++) {
      for (let y = Math.min(min, g) - 2; y < g; y++) {
        const below = world.getBlock(x, y, z);
        if (below === AIR || below === WATER) world.setBlockSilent(x, y, z, DIRT);
      }
      for (let y = g; y < g + 8; y++) world.setBlockSilent(x, y, z, AIR);
      world.setBlockSilent(x, g - 1, z, GRASS);
    }
  }

  // floor
  for (let z = z0; z < z0 + D; z++)
    for (let x = x0; x < x0 + W; x++)
      world.setBlockSilent(x, g - 1, z, PLANKS);

  // walls with log corner posts
  for (let y = g; y < g + 3; y++) {
    for (let x = x0; x < x0 + W; x++) {
      world.setBlockSilent(x, y, z0, PLANKS);
      world.setBlockSilent(x, y, z0 + D - 1, PLANKS);
    }
    for (let z = z0; z < z0 + D; z++) {
      world.setBlockSilent(x0, y, z, PLANKS);
      world.setBlockSilent(x0 + W - 1, y, z, PLANKS);
    }
    world.setBlockSilent(x0, y, z0, LOG);
    world.setBlockSilent(x0 + W - 1, y, z0, LOG);
    world.setBlockSilent(x0, y, z0 + D - 1, LOG);
    world.setBlockSilent(x0 + W - 1, y, z0 + D - 1, LOG);
  }

  // doorway on the side facing the island center
  const facingX = Math.abs(center - cx) > Math.abs(center - cz);
  if (facingX) {
    const doorX = center > cx ? x0 + W - 1 : x0;
    world.setBlockSilent(doorX, g, cz, AIR);
    world.setBlockSilent(doorX, g + 1, cz, AIR);
  } else {
    const doorZ = center > cz ? z0 + D - 1 : z0;
    world.setBlockSilent(cx, g, doorZ, AIR);
    world.setBlockSilent(cx, g + 1, doorZ, AIR);
  }

  // window holes, one per wall
  world.setBlockSilent(x0 + 2, g + 1, z0, AIR);
  world.setBlockSilent(x0 + W - 3, g + 1, z0 + D - 1, AIR);
  world.setBlockSilent(x0, g + 1, z0 + 2, AIR);
  world.setBlockSilent(x0 + W - 1, g + 1, z0 + D - 2, AIR);

  // flat roof with 1-block overhang
  for (let z = z0 - 1; z < z0 + D + 1; z++)
    for (let x = x0 - 1; x < x0 + W + 1; x++)
      world.setBlockSilent(x, g + 3, z, PLANKS);

  return { x: cx, z: cz, y: g };
}
