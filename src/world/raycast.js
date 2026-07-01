import { BLOCKS } from './blocks.js';

// Amanatides–Woo voxel traversal. Exact grid coords + hit face normal, and it is
// mesh-independent, so the same ray serves block targeting AND AI line-of-sight.

const solidHit = (id) => BLOCKS[id].solid;

// origin: Vector3-like, dir: normalized Vector3-like.
// Returns { x, y, z, nx, ny, nz, dist, id } or null.
export function raycastVoxel(world, origin, dir, maxDist, predicate = solidHit) {
  let ix = Math.floor(origin.x), iy = Math.floor(origin.y), iz = Math.floor(origin.z);

  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.y > 0 ? 1 : -1;
  const stepZ = dir.z > 0 ? 1 : -1;

  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

  let tMaxX = dir.x !== 0 ? (dir.x > 0 ? ix + 1 - origin.x : origin.x - ix) * tDeltaX : Infinity;
  let tMaxY = dir.y !== 0 ? (dir.y > 0 ? iy + 1 - origin.y : origin.y - iy) * tDeltaY : Infinity;
  let tMaxZ = dir.z !== 0 ? (dir.z > 0 ? iz + 1 - origin.z : origin.z - iz) * tDeltaZ : Infinity;

  let t = 0, nx = 0, ny = 0, nz = 0;
  const maxIter = Math.ceil(maxDist * 3) + 3;

  for (let i = 0; i < maxIter; i++) {
    const id = world.getBlock(ix, iy, iz);
    if (predicate(id)) return { x: ix, y: iy, z: iz, nx, ny, nz, dist: t, id };

    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      ix += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      iy += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
    } else {
      iz += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
    }
    if (t > maxDist) return null;
  }
  return null;
}

const _dir = { x: 0, y: 0, z: 0 };

// Unobstructed straight line between two points (eye to eye)? Leaves block sight.
export function lineOfSight(world, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-4) return true;
  _dir.x = dx / dist; _dir.y = dy / dist; _dir.z = dz / dist;
  const hit = raycastVoxel(world, a, _dir, dist);
  return hit === null;
}
